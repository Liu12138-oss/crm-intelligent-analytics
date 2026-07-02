import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import * as childProcess from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { buildEntityId } from '../../shared/utils/id.util';
import type { WecomDeliveryTarget } from './wecom-message.types';
import { WecomBotConnectionConfigService } from '../governance/wecom-bot-connection-config.service';

type WecomMediaType = 'file' | 'image' | 'voice' | 'video';

type WecomSdkClient = {
  connect(): unknown;
  disconnect(): void;
  isConnected?: boolean;
  on(event: string, listener: (...args: unknown[]) => void): void;
  replyStream(
    frame: { headers: { req_id: string } },
    streamId: string,
    content: string,
    finish?: boolean,
    msgItem?: unknown[],
    feedback?: { id: string },
  ): Promise<{ header?: { msgid?: string } } | Record<string, unknown>>;
  sendMessage(
    chatId: string,
    body: Record<string, unknown>,
  ): Promise<{ header?: { msgid?: string } } | Record<string, unknown>>;
  uploadMedia(
    fileBuffer: Buffer,
    options: { type: WecomMediaType; filename: string },
  ): Promise<{ media_id?: string; type?: string; created_at?: number } | Record<string, unknown>>;
  sendMediaMessage(
    chatId: string,
    mediaType: WecomMediaType,
    mediaId: string,
  ): Promise<{ header?: { msgid?: string } } | Record<string, unknown>>;
};

type WecomSdkModule = {
  default?: {
    WSClient: new (options: Record<string, unknown>) => WecomSdkClient;
  };
  WSClient?: new (options: Record<string, unknown>) => WecomSdkClient;
};

@Injectable()
export class WecomTransportService implements OnModuleDestroy {
  private wsClient?: WecomSdkClient;
  private wsClientReady?: Promise<void>;
  private inboundListenerStarted = false;
  private inboundRetryTimer?: NodeJS.Timeout;
  private inboundListenerLockAcquired = false;
  private readonly sdkConnectTimeoutMs = 15000;

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    @Optional()
    private readonly wecomBotConnectionConfigService?: WecomBotConnectionConfigService,
  ) {}

  onModuleDestroy(): void {
    this.close();
  }

  async sendMarkdownMessage(
    target: WecomDeliveryTarget,
    content: string,
  ): Promise<{ externalMessageId: string }> {
    return await this.sendProactiveMessage(target, {
      msgtype: 'markdown',
      markdown: {
        content,
      },
    });
  }

  async sendTemplateCardMessage(
    target: WecomDeliveryTarget,
    templateCard: Record<string, unknown>,
  ): Promise<{ externalMessageId: string }> {
    return await this.sendProactiveMessage(target, {
      msgtype: 'template_card',
      template_card: templateCard,
    });
  }

  /**
   * 上传并发送企业微信图片媒体消息。
   *
   * 参数说明：`target` 为企微投递目标，`buffer` 为图片内容，`filename` 为上传素材文件名。
   * 返回值说明：返回企微外部消息 ID。
   * 调用注意事项：该方法只用于机器人结果增强展示，调用方必须保留文本兜底。
   */
  async sendImageMessage(
    target: WecomDeliveryTarget,
    buffer: Buffer,
    filename: string,
  ): Promise<{ externalMessageId: string }> {
    if (this.shouldUseMockTransport()) {
      return {
        externalMessageId: `mock-image-delivery-${buildEntityId('wecom')}`,
      };
    }

    const client = await this.ensureSdkClient();
    const uploadResult = await client.uploadMedia(buffer, {
      type: 'image',
      filename,
    });
    const mediaId = String(uploadResult.media_id ?? '');
    if (!mediaId) {
      throw new Error('企业微信图片素材上传失败：未返回 media_id。');
    }

    const response = await client.sendMediaMessage(
      target.deliveryTargetId,
      'image',
      mediaId,
    );
    this.assertSuccessfulSdkResponse(response);

    return {
      externalMessageId:
        (response as { header?: { msgid?: string } }).header?.msgid ??
        `sdk-image-delivery-${buildEntityId('wecom')}`,
    };
  }

  private async sendProactiveMessage(
    target: WecomDeliveryTarget,
    body: Record<string, unknown>,
  ): Promise<{ externalMessageId: string }> {
    if (this.shouldUseMockTransport()) {
      return {
        externalMessageId: `mock-delivery-${buildEntityId('wecom')}`,
      };
    }

    const client = await this.ensureSdkClient();
    const response = await client.sendMessage(target.deliveryTargetId, body);
    this.assertSuccessfulSdkResponse(response);

    return {
      externalMessageId:
        (response as { header?: { msgid?: string } }).header?.msgid ??
        `sdk-delivery-${buildEntityId('wecom')}`,
    };
  }

  async replyStreamMessage(params: {
    frameHeaders: { req_id: string };
    streamId: string;
    content: string;
    finish: boolean;
    /**
     * 反馈 ID，设置后企微会在消息上展示"准确/不准确"反馈入口。
     * 通常传入本次查询的 queryId，便于反馈事件回调时关联到原查询。
     * 参考企微开发者文档 path/101027 接收事件 - 用户反馈事件。
     */
    feedbackId?: string;
  }): Promise<{ externalMessageId: string }> {
    if (this.shouldUseMockTransport()) {
      return {
        externalMessageId: `mock-stream-${buildEntityId('wecom')}`,
      };
    }

    const client = await this.ensureSdkClient();
    // 企微 SDK replyStream 第 6 参数为 feedback 对象（可选）
    // 设置后用户可在消息上点"准确/不准确"，触发 feedback_event 回调
    const response = await client.replyStream(
      { headers: params.frameHeaders },
      params.streamId,
      params.content,
      params.finish,
      undefined,
      params.feedbackId ? { id: params.feedbackId } : undefined,
    );

    return {
      externalMessageId:
        (response as { header?: { msgid?: string } }).header?.msgid ??
        `sdk-stream-${buildEntityId('wecom')}`,
    };
  }

  async startInboundListener(
    onTextMessage: (payload: Record<string, unknown>) => Promise<void>,
    onFeedbackEvent?: (payload: Record<string, unknown>) => Promise<void>,
    onStreamRefresh?: (payload: Record<string, unknown>) => Promise<void>,
  ): Promise<void> {
    if (this.shouldUseMockTransport()) {
      this.analysisLoggerService.logWarn(
        '企业微信机器人当前使用 mock transport，已跳过真实入站监听。',
      );
      return;
    }

    if (!this.isInboundTransportReady()) {
      this.analysisLoggerService.logWarn(
        '企业微信机器人已跳过真实入站监听，因为当前实例尚未建立可用的 CRM 实时连接。',
        {
          retryInMs: 10000,
          reason: 'wecom-sdk-config-not-ready',
        },
      );
      this.scheduleInboundRetry(onTextMessage);
      return;
    }

    if (!this.acquireInboundListenerLock()) {
      this.scheduleInboundRetry(onTextMessage);
      return;
    }

    let client: Awaited<ReturnType<typeof this.ensureSdkClient>>;
    try {
      client = await this.ensureSdkClient();
    } catch (error) {
      this.analysisLoggerService.logWarn(
        '企业微信机器人入站监听准备失败，已稍后自动重试。',
        {
          retryInMs: 10000,
          reason: error instanceof Error ? error.message : 'unknown',
        },
      );
      this.scheduleInboundRetry(onTextMessage);
      return;
    }
    if (this.inboundListenerStarted) {
      return;
    }

    this.clearInboundRetry();
    this.inboundListenerStarted = true;
    client.on('message.text', async (frame: unknown) => {
      try {
        const payload = frame as Record<string, unknown>;
        await onTextMessage(payload);
      } catch (error) {
        this.analysisLoggerService.logWarn('企业微信文本消息处理失败。', {
          reason: error instanceof Error ? error.message : 'unknown',
        });
      }
    });

    // 监听语音消息事件，企微已将语音转为文本
    // voice.content 作为自然语言输入送入分析链路
    // 参考企微开发者文档 path/100719 接收消息
    client.on('message.voice', async (frame: unknown) => {
      try {
        const payload = frame as Record<string, unknown>;
        await onTextMessage(payload);
      } catch (error) {
        this.analysisLoggerService.logWarn('企业微信语音消息处理失败。', {
          reason: error instanceof Error ? error.message : 'unknown',
        });
      }
    });

    // 监听企微原生反馈事件（feedback_event），用户点"准确/不准确"时触发
    // 参考企微开发者文档 path/101027 接收事件 - 用户反馈事件
    if (onFeedbackEvent) {
      client.on('feedback_event', async (frame: unknown) => {
        try {
          const payload = frame as Record<string, unknown>;
          await onFeedbackEvent(payload);
        } catch (error) {
          this.analysisLoggerService.logWarn('企业微信反馈事件处理失败。', {
            reason: error instanceof Error ? error.message : 'unknown',
          });
        }
      });
    }

    // 监听流式刷新回调（stream_refresh），企微在流式消息生命周期内定期推送
    // 收到后需返回当前进度文字，否则用户会看到"无响应"
    // 参考企微开发者文档 path/101031 被动回复
    if (onStreamRefresh) {
      client.on('stream_refresh', async (frame: unknown) => {
        try {
          const payload = frame as Record<string, unknown>;
          await onStreamRefresh(payload);
        } catch (error) {
          this.analysisLoggerService.logWarn('企业微信流式刷新回调处理失败。', {
            reason: error instanceof Error ? error.message : 'unknown',
          });
        }
      });
    }

    client.on('connected', () => {
      this.analysisLoggerService.logStep('企业微信机器人 WebSocket 已连接。');
    });
    client.on('authenticated', () => {
      this.analysisLoggerService.logStep('企业微信机器人 WebSocket 认证成功。');
    });
    client.on('disconnected', (reason: unknown) => {
      this.analysisLoggerService.logWarn('企业微信机器人 WebSocket 已断开。', {
        reason: String(reason ?? 'unknown'),
      });
    });
    client.on('reconnecting', (attempt: unknown) => {
      this.analysisLoggerService.logWarn('企业微信机器人 WebSocket 正在重连。', {
        attempt: Number(attempt ?? 0),
      });
    });
    client.on('error', (error: unknown) => {
      this.analysisLoggerService.logWarn('企业微信机器人 WebSocket 发生错误。', {
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
    });

    this.analysisLoggerService.logStep('企业微信机器人入站监听已启用。', {
      transportMode: 'sdk',
      pid: process.pid,
    });
  }

  private shouldUseMockTransport(): boolean {
    const config = this.resolveWecomRuntimeConfig();
    return (
      config.botTransportMode !== 'sdk' ||
      (process.env.NODE_ENV === 'test' &&
        process.env.WECOM_ENABLE_SDK_TRANSPORT !== 'true')
    );
  }

  /**
   * 判断企微入站监听是否具备可用数据源。
   *
   * 参数说明：无。
   * 返回值说明：只读库可用或联软标准 OpenAPI 已配置时返回 `true`。
   * 调用注意事项：标准 OpenAPI 模式下仍会在后续身份解析阶段校验发送人权限，
   * 这里只负责避免 SQLite/OpenAPI 部署被旧 MySQL 只读库门禁误拦截。
   */
  private isInboundTransportReady(): boolean {
    const config = this.resolveWecomRuntimeConfig();
    return Boolean(
      config.botTransportMode === 'sdk' &&
        config.botWsUrl &&
        config.botId &&
        config.botSecret,
    );
  }

  private assertSuccessfulSdkResponse(response: Record<string, unknown>): void {
    const rawErrcode = response.errcode ?? (response as { error?: { code?: unknown } }).error?.code;
    const errcode = Number(rawErrcode ?? 0);
    if (!Number.isFinite(errcode) || errcode === 0) {
      return;
    }

    const errmsg = String(
      response.errmsg ??
        (response as { error?: { message?: unknown } }).error?.message ??
        'unknown',
    );
    const hint = response.hint ? ` hint=${String(response.hint)}` : '';
    throw new Error(`企业微信机器人 SDK ACK 失败：errcode=${errcode} errmsg=${errmsg}${hint}`);
  }

  private async ensureSdkClient(): Promise<WecomSdkClient> {
    if (this.wsClient?.isConnected) {
      return this.wsClient;
    }

    if (!this.wsClientReady) {
      this.wsClientReady = this.createSdkClient();
    }

    await this.wsClientReady;
    if (!this.wsClient) {
      throw new Error('企业微信机器人 SDK 客户端初始化失败。');
    }
    return this.wsClient;
  }

  close(): void {
    this.clearInboundRetry();
    try {
      this.wsClient?.disconnect();
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信机器人 SDK 关闭失败。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.wsClient = undefined;
      this.wsClientReady = undefined;
      this.inboundListenerStarted = false;
      this.releaseInboundListenerLock();
    }
  }

  private async createSdkClient(): Promise<void> {
    const config = this.resolveWecomRuntimeConfig();
    if (!config.botWsUrl || !config.botId || !config.botSecret) {
      throw new Error('企业微信机器人 SDK 连接参数未完整配置。');
    }

    const sdkModule = await this.importWecomSdk();
    const ClientCtor = sdkModule.default?.WSClient ?? sdkModule.WSClient;
    if (!ClientCtor) {
      throw new Error('企业微信机器人 SDK 不可用。');
    }

    this.wsClient = new ClientCtor({
      botId: config.botId,
      secret: config.botSecret,
      wsUrl: config.botWsUrl,
      maxReconnectAttempts: config.botMaxReconnectAttempts,
      heartbeatInterval: config.botHeartbeatIntervalMs,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('企业微信机器人 SDK 连接超时。'));
      }, this.sdkConnectTimeoutMs);

      this.wsClient!.on('authenticated', () => {
        clearTimeout(timeout);
        resolve();
      });
      this.wsClient!.on('error', (...args: unknown[]) => {
        clearTimeout(timeout);
        reject(
          new Error(
            `企业微信机器人 SDK 连接失败：${args.map((item) => String(item)).join(' ')}`,
          ),
        );
      });
      this.wsClient!.connect();
    });
  }

  private resolveWecomRuntimeConfig() {
    return (
      this.wecomBotConnectionConfigService?.getEffectiveRuntimeConfig() ??
      this.localRuntimeConfigService.getWecomRuntimeConfig()
    );
  }

  private async importWecomSdk(): Promise<WecomSdkModule> {
    try {
      // 优先走 CommonJS require，兼容当前企业微信 SDK 在测试环境下的导出形态。
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@wecom/aibot-node-sdk') as WecomSdkModule;
    } catch {
      return (new Function(
        'specifier',
        'return import(specifier);',
      )('@wecom/aibot-node-sdk')) as Promise<WecomSdkModule>;
    }
  }

  private scheduleInboundRetry(
    onTextMessage: (payload: Record<string, unknown>) => Promise<void>,
  ): void {
    if (this.inboundRetryTimer) {
      return;
    }

    this.inboundRetryTimer = setTimeout(() => {
      this.inboundRetryTimer = undefined;
      void this.startInboundListener(onTextMessage);
    }, 10000);
  }

  private clearInboundRetry(): void {
    if (!this.inboundRetryTimer) {
      return;
    }

    clearTimeout(this.inboundRetryTimer);
    this.inboundRetryTimer = undefined;
  }

  private acquireInboundListenerLock(): boolean {
    if (this.inboundListenerLockAcquired) {
      return true;
    }

    const lockPath = this.getInboundListenerLockPath();
    mkdirSync(dirname(lockPath), { recursive: true });

    if (existsSync(lockPath)) {
      const existingOwnerPid = this.readLockOwnerPid(lockPath);
      if (
        existingOwnerPid !== undefined &&
        existingOwnerPid !== process.pid &&
        this.isProcessAlive(existingOwnerPid)
      ) {
        this.analysisLoggerService.logWarn(
          '企业微信机器人入站监听未启动，因为本机已有另一个进程持有监听锁。',
          {
            currentPid: process.pid,
            ownerPid: existingOwnerPid,
            lockPath,
          },
        );
        return false;
      }

      try {
        rmSync(lockPath, { force: true });
      } catch {
        this.analysisLoggerService.logWarn('企业微信机器人监听锁清理失败，已跳过本次监听启动。', {
          currentPid: process.pid,
          lockPath,
        });
        return false;
      }
    }

    try {
      writeFileSync(
        lockPath,
        JSON.stringify(
          {
            pid: process.pid,
            acquiredAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        { encoding: 'utf8', flag: 'wx' },
      );
      this.inboundListenerLockAcquired = true;
      return true;
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信机器人监听锁创建失败，已跳过本次监听启动。', {
        currentPid: process.pid,
        lockPath,
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return false;
    }
  }

  private releaseInboundListenerLock(): void {
    if (!this.inboundListenerLockAcquired) {
      return;
    }

    const lockPath = this.getInboundListenerLockPath();
    try {
      const ownerPid = this.readLockOwnerPid(lockPath);
      if (ownerPid === undefined || ownerPid === process.pid) {
        rmSync(lockPath, { force: true });
      }
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信机器人监听锁释放失败。', {
        currentPid: process.pid,
        lockPath,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      this.inboundListenerLockAcquired = false;
    }
  }

  private getInboundListenerLockPath(): string {
    return join(
      this.localRuntimeConfigService.getRepoRoot(),
      '.runtime',
      'wecom-bot-listener.lock',
    );
  }

  private readLockOwnerPid(lockPath: string): number | undefined {
    if (!existsSync(lockPath)) {
      return undefined;
    }

    try {
      const content = readFileSync(lockPath, 'utf8');
      const parsed = JSON.parse(content) as { pid?: unknown };
      return typeof parsed.pid === 'number' ? parsed.pid : undefined;
    } catch {
      return undefined;
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return !this.isZombieProcess(pid);
    } catch {
      return false;
    }
  }

  /**
   * 判断进程是否为僵尸态。
   *
   * 参数说明：`pid` 为监听锁记录的进程号。
   * 返回值说明：当系统进程状态为 `Z` 时返回 `true`，无法读取时按非僵尸处理。
   * 调用注意事项：`process.kill(pid, 0)` 对僵尸进程也会返回成功，所以需要额外读取系统状态。
   */
  private isZombieProcess(pid: number): boolean {
    try {
      return this.readProcessStatus(pid).startsWith('Z');
    } catch {
      return false;
    }
  }

  /**
   * 读取进程状态。
   *
   * 参数说明：`pid` 为进程号。
   * 返回值说明：返回 `ps` 命令中的进程状态短码，例如 `S+`、`Z+`。
   * 调用注意事项：仅供监听锁存活判断使用，不承载业务逻辑。
   */
  private readProcessStatus(pid: number): string {
    return childProcess
      .execFileSync('ps', ['-p', String(pid), '-o', 'stat='], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .trim();
  }
}
