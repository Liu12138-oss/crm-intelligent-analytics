/**
 * 企微流式刷新与超时兜底服务
 *
 * 处理企微流式消息的两个关键约束：
 * 1. stream_refresh 回调：企微在流式消息生命周期内会定期推送 refresh 回调，
 *    收到后必须返回当前进度文字，否则用户会看到"无响应"
 * 2. 6 分钟超时：企微流式消息从用户发消息起最多等待 6 分钟，
 *    超时后消息消失。必须在 5 分 30 秒前主动结束流式并提示后台执行
 *
 * 参考企微开发者文档 path/101031 被动回复
 */

import { Injectable } from '@nestjs/common';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';

/**
 * 流式会话状态
 */
interface StreamSessionState {
  /** 流式会话 ID */
  streamId: string;
  /** 关联的查询 ID */
  queryId: string;
  /** 会话开始时间（毫秒时间戳） */
  startedAt: number;
  /** 最后一次进度文字 */
  lastProgressText: string;
  /** 是否已结束 */
  finished: boolean;
  /** 超时定时器 */
  timeoutTimer?: NodeJS.Timeout;
}

/**
 * 超时兜底回调
 * 当流式会话超时时调用，用于发送超时卡片和启动后台异步推送
 */
export type TimeoutFallbackCallback = (params: {
  streamId: string;
  queryId: string;
  elapsedMs: number;
}) => Promise<void>;

/**
 * 6 分钟超时阈值（毫秒）
 * 企微流式消息从用户发消息起最多等待 6 分钟
 */
const WECOM_STREAM_TIMEOUT_MS = 6 * 60 * 1000;

/**
 * 主动结束流式的时间点（5 分 30 秒）
 * 留 30 秒余量发送超时卡片和结束流式
 */
const WECOM_STREAM_PROACTIVE_FINISH_MS = 5 * 60 * 1000 + 30 * 1000;

@Injectable()
export class WecomStreamRefreshService {
  /** 活跃流式会话表，按 streamId 索引 */
  private readonly activeSessions = new Map<string, StreamSessionState>();

  constructor(
    private readonly logger: AnalysisLoggerService,
  ) {}

  /**
   * 注册流式会话
   *
   * 在开始流式回复时调用，启动超时定时器。
   * 超时后自动触发 fallback 回调。
   *
   * 参数说明：
   * - `streamId` 流式会话 ID
   * - `queryId` 关联的查询 ID
   * - `onTimeout` 超时回调（发送超时卡片+启动后台推送）
   */
  registerStreamSession(
    streamId: string,
    queryId: string,
    onTimeout: TimeoutFallbackCallback,
  ): void {
    const now = Date.now();
    const session: StreamSessionState = {
      streamId,
      queryId,
      startedAt: now,
      lastProgressText: '正在分析中...',
      finished: false,
    };

    // 设置超时定时器
    session.timeoutTimer = setTimeout(() => {
      this.handleTimeout(streamId, onTimeout).catch((error) => {
        this.logger.logWarn('企微流式超时兜底执行失败', {
          streamId,
          queryId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, WECOM_STREAM_PROACTIVE_FINISH_MS);

    this.activeSessions.set(streamId, session);
  }

  /**
   * 更新流式进度文字
   *
   * 在每次流式发送 content 后调用，记录最新进度文字。
   * stream_refresh 回调到来时返回此文字。
   */
  updateProgress(streamId: string, progressText: string): void {
    const session = this.activeSessions.get(streamId);
    if (session) {
      session.lastProgressText = progressText;
    }
  }

  /**
   * 处理 stream_refresh 回调
   *
   * 企微在流式消息生命周期内会定期推送 refresh 回调。
   * 收到后返回当前进度文字，让用户看到"仍在处理中"。
   *
   * 参数说明：`streamId` 为流式会话 ID
   * 返回值说明：返回当前进度文字，若会话不存在或已结束返回 undefined
   */
  handleStreamRefresh(streamId: string): string | undefined {
    const session = this.activeSessions.get(streamId);
    if (!session || session.finished) {
      return undefined;
    }
    return session.lastProgressText;
  }

  /**
   * 标记流式会话已正常结束
   *
   * 在流式 finish=true 发送后调用，清理超时定时器和会话记录。
   */
  finishStreamSession(streamId: string): void {
    const session = this.activeSessions.get(streamId);
    if (session) {
      session.finished = true;
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
        session.timeoutTimer = undefined;
      }
      // 延迟清理，避免 refresh 回调在 finish 后到达时找不到会话
      setTimeout(() => {
        this.activeSessions.delete(streamId);
      }, 60_000);
    }
  }

  /**
   * 处理流式超时
   *
   * 5 分 30 秒未完成时触发：
   * 1. 标记会话为超时状态
   * 2. 调用 onTimeout 回调（发送超时卡片+启动后台推送）
   */
  private async handleTimeout(
    streamId: string,
    onTimeout: TimeoutFallbackCallback,
  ): Promise<void> {
    const session = this.activeSessions.get(streamId);
    if (!session || session.finished) {
      return;
    }

    const elapsedMs = Date.now() - session.startedAt;
    this.logger.logStep('企微流式消息即将超时，启动兜底', {
      streamId,
      queryId: session.queryId,
      elapsedMs,
      thresholdMs: WECOM_STREAM_PROACTIVE_FINISH_MS,
    });

    session.finished = true;
    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
      session.timeoutTimer = undefined;
    }

    await onTimeout({
      streamId,
      queryId: session.queryId,
      elapsedMs,
    });

    // 延迟清理
    setTimeout(() => {
      this.activeSessions.delete(streamId);
    }, 60_000);
  }

  /**
   * 获取当前活跃会话数（用于监控和调试）
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * 从企微原始事件帧解析 stream_refresh
   */
  static isStreamRefreshEvent(frame: Record<string, unknown>): boolean {
    const eventType = String(frame.eventType ?? frame.event_type ?? frame.type ?? '');
    return eventType.includes('stream_refresh') || eventType.includes('streamRefresh');
  }

  /**
   * 从 stream_refresh 帧解析 streamId
   */
  static parseStreamIdFromRefreshFrame(frame: Record<string, unknown>): string | undefined {
    const data = (frame.data ?? frame) as Record<string, unknown>;
    return String(data.streamId ?? data.stream_id ?? data.id ?? '');
  }
}
