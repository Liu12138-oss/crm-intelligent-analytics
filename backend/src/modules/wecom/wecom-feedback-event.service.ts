/**
 * 企微反馈事件处理服务
 *
 * 处理企微原生 feedback_event 回调，把用户对机器人回复的反馈
 * （准确/不准确+原因）写入审计，对接学习闭环。
 *
 * 企微官方反馈类型：
 * - type=1: 准确
 * - type=2: 不准确（可附带 inaccurate_reason_list 和 content）
 * - type=3: 取消（忽略）
 *
 * 不准确原因枚举：
 * - 1: 与问题无关
 * - 2: 内容不完整
 * - 3: 内容有错误
 * - 4: 数据分析错误
 *
 * 约束：
 * - feedback_event 仅支持回复空包（不能同时回复新消息）
 * - 收到反馈后只记录，不回复
 */

import { Injectable } from '@nestjs/common';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { buildEntityId } from '../../shared/utils/id.util';

/**
 * 企微反馈事件类型枚举
 */
export const WECOM_FEEDBACK_TYPE_ACCURATE = 1;
export const WECOM_FEEDBACK_TYPE_INACCURATE = 2;
export const WECOM_FEEDBACK_TYPE_CANCEL = 3;

/**
 * 企微不准确原因枚举
 */
export const WECOM_INACCURATE_REASON_MAP: Record<number, string> = {
  1: '与问题无关',
  2: '内容不完整',
  3: '内容有错误',
  4: '数据分析错误',
};

/**
 * 反馈事件载荷
 */
export interface WecomFeedbackEventPayload {
  /** 反馈类型：1=准确, 2=不准确, 3=取消 */
  type: number;
  /** 反馈关联的消息 ID（对应回复时设置的 feedback.id） */
  feedbackId?: string;
  /** 不准确时的原因列表（type=2 时存在） */
  inaccurateReasonList?: number[];
  /** 用户自述反馈内容（type=2 时可能存在） */
  content?: string;
  /** 发送反馈的用户 ID */
  userId?: string;
  /** 会话 ID */
  chatId?: string;
  /** 机器人 ID */
  botId?: string;
}

/**
 * 反馈处理结果
 */
export interface WecomFeedbackHandleResult {
  recorded: boolean;
  feedbackType: 'USEFUL' | 'NOT_USEFUL' | 'CALIBRATION_ISSUE' | 'IGNORED';
  reason?: string;
  userContent?: string;
}

@Injectable()
export class WecomFeedbackEventService {
  constructor(
    private readonly auditEventRepository: AuditEventRepository,
    private readonly logger: AnalysisLoggerService,
  ) {}

  /**
   * 处理企微 feedback_event 回调
   *
   * 参数说明：`payload` 为企微推送的反馈事件载荷。
   * 返回值说明：返回处理结果，包含是否记录和反馈类型映射。
   * 调用注意事项：feedback_event 仅支持回复空包，本方法不产生任何回复消息。
   */
  async handleFeedbackEvent(payload: WecomFeedbackEventPayload): Promise<WecomFeedbackHandleResult> {
    // type=3 取消反馈，直接忽略
    if (payload.type === WECOM_FEEDBACK_TYPE_CANCEL) {
      return { recorded: false, feedbackType: 'IGNORED' };
    }

    // 解析反馈类型和原因
    const result = this.resolveFeedbackType(payload);
    if (result.feedbackType === 'IGNORED') {
      return result;
    }

    // 写入审计事件（对接学习闭环第 2 层显式反馈）
    const queryId = payload.feedbackId ?? 'unknown';
    const auditDetail = {
      queryId,
      feedbackType: result.feedbackType,
      feedbackSource: 'WECOM_FEEDBACK_EVENT',
      reason: result.reason,
      userContent: result.userContent,
      wecomUserId: payload.userId,
      wecomChatId: payload.chatId,
      wecomBotId: payload.botId,
    };

    try {
      this.auditEventRepository.create({
        id: buildEntityId('audit_event'),
        eventType: 'ANALYSIS_RESULT_FEEDBACK' as never,
        actorId: payload.userId ?? 'wecom-anonymous',
        actorType: 'wecom-user',
        actorRoleIds: [],
        scopeSnapshot: {
          source: 'wecom-feedback',
          queryId,
        },
        riskLevel: 'info',
        reviewStatus: 'auto',
        detail: auditDetail,
        occurredAt: new Date().toISOString(),
      } as never);

      this.logger.logStep('企微反馈事件已写入审计', auditDetail);
    } catch (error) {
      this.logger.logWarn('企微反馈事件写入审计失败', {
        queryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { ...result, recorded: true };
  }

  /**
   * 解析反馈类型，映射到学习闭环的反馈分类
   */
  private resolveFeedbackType(payload: WecomFeedbackEventPayload): WecomFeedbackHandleResult {
    if (payload.type === WECOM_FEEDBACK_TYPE_ACCURATE) {
      return { recorded: false, feedbackType: 'USEFUL' };
    }

    if (payload.type === WECOM_FEEDBACK_TYPE_INACCURATE) {
      // 解析不准确原因
      const reasons = (payload.inaccurateReasonList ?? []).map(
        (code) => WECOM_INACCURATE_REASON_MAP[code] ?? `未知原因(${code})`,
      );
      const reason = reasons.length > 0 ? reasons.join('；') : undefined;
      const userContent = payload.content?.trim() || undefined;

      // 原因 4（数据分析错误）或用户自述内容映射为口径纠错
      const isCalibrationIssue =
        payload.inaccurateReasonList?.includes(4) ?? Boolean(userContent);

      return {
        recorded: false,
        feedbackType: isCalibrationIssue ? 'CALIBRATION_ISSUE' : 'NOT_USEFUL',
        reason,
        userContent,
      };
    }

    return { recorded: false, feedbackType: 'IGNORED' };
  }

  /**
   * 从企微原始事件帧解析反馈载荷
   * 企微 SDK 推送的事件结构因 SDK 版本而异，这里做兼容性解析
   */
  static parseFromSdkFrame(frame: Record<string, unknown>): WecomFeedbackEventPayload | null {
    const eventType = String(frame.eventType ?? frame.event_type ?? frame.type ?? '');
    if (!eventType.includes('feedback')) {
      return null;
    }

    const data = (frame.data ?? frame.feedback ?? frame) as Record<string, unknown>;
    return {
      type: Number(data.type ?? data.feedbackType ?? 0),
      feedbackId: String(data.feedbackId ?? data.feedback_id ?? data.id ?? ''),
      inaccurateReasonList: Array.isArray(data.inaccurateReasonList)
        ? data.inaccurateReasonList.map(Number)
        : Array.isArray(data.inaccurate_reason_list)
          ? data.inaccurate_reason_list.map(Number)
          : undefined,
      content: data.content ? String(data.content) : undefined,
      userId: String(data.userId ?? data.userid ?? data.user_id ?? ''),
      chatId: String(data.chatId ?? data.chatid ?? data.chat_id ?? ''),
      botId: String(data.botId ?? data.bot_id ?? data.aibotid ?? ''),
    };
  }
}
