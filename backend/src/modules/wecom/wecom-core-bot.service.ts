import { Injectable, OnModuleInit } from '@nestjs/common';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type {
  QuerySessionRecord,
  StreamBlock,
  WecomInboundMessage,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { UnifiedAiExecutionService } from '../ai-models/unified-ai-execution.service';
import { QuerySessionRepository } from '../sessions/query-session.repository';
import { WecomAuthService } from './wecom-auth.service';
import { WecomDeliveryRecordRepository } from './wecom-delivery-record.repository';
import { WecomMessageAdapterService } from './wecom-message-adapter.service';
import { WecomMessageReceiptRepository } from './wecom-message-receipt.repository';
import type {
  WecomDispatchResult,
  WecomInboundEnvelope,
  WecomReceiveMessageResult,
} from './wecom-message.types';
import { WecomStreamDispatcherService } from './wecom-stream-dispatcher.service';
import { WecomTransportService } from './wecom-transport.service';

const CORE_MODE_DISABLED_REPLY = [
  '当前核心模式仅开放普通 AI 对话和基础帮助。',
  'CRM 问数、渠道分析、经营看板、合同、证书、日报、新增客户/商机、跟进写回和结果导出等业务能力暂未启用。',
  '如果需要恢复某一类业务能力，请先按独立模块确认数据来源、权限边界、审计留痕和回归测试。',
].join('\n');

const AI_UNAVAILABLE_REPLY = [
  'AI 服务暂时不可用或尚未配置完成。',
  '请先在后台 AI 配置中检查当前启用的模型、服务地址和密钥；配置恢复后，企业微信机器人会继续提供普通 AI 对话。',
].join('\n');

@Injectable()
export class WecomCoreBotService implements OnModuleInit {
  constructor(
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly unifiedAiExecutionService: UnifiedAiExecutionService,
    private readonly querySessionRepository: QuerySessionRepository,
    private readonly wecomAuthService: WecomAuthService,
    private readonly wecomMessageAdapterService: WecomMessageAdapterService,
    private readonly wecomMessageReceiptRepository: WecomMessageReceiptRepository,
    private readonly wecomDeliveryRecordRepository: WecomDeliveryRecordRepository,
    private readonly wecomStreamDispatcherService: WecomStreamDispatcherService,
    private readonly wecomTransportService: WecomTransportService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.wecomTransportService.startInboundListener(async (payload) => {
        await this.receiveSdkMessage(payload);
      });
    } catch (error) {
      this.analysisLoggerService.logWarn(
        '企业微信核心机器人入站监听启动失败，已跳过本次监听初始化。',
        {
          reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
        },
      );
    }
  }

  async receiveMessage(
    envelope: WecomInboundEnvelope,
  ): Promise<WecomReceiveMessageResult> {
    let inboundMessage: WecomInboundMessage | undefined;
    try {
      this.validateSignature(envelope.signature);
      this.validateSource(envelope.source);
      inboundMessage = this.wecomMessageAdapterService.normalizeIncomingMessage(
        envelope.body,
      );
      this.wecomAuthService.validateBotId(inboundMessage.botId, {
        required: true,
      });
      return await this.processInboundMessage(inboundMessage);
    } catch (error) {
      return await this.handleReceiveError(error, inboundMessage, {
        fallbackSnapshot: envelope.body,
        deliverToChat: false,
      });
    }
  }

  async receiveSdkMessage(
    body: Record<string, unknown>,
  ): Promise<WecomReceiveMessageResult> {
    let inboundMessage: WecomInboundMessage | undefined;
    try {
      inboundMessage = this.wecomMessageAdapterService.normalizeIncomingMessage(body);
      this.wecomAuthService.validateBotId(inboundMessage.botId);
      return await this.processInboundMessage(inboundMessage);
    } catch (error) {
      return await this.handleReceiveError(error, inboundMessage, {
        fallbackSnapshot: body,
        deliverToChat: true,
      });
    }
  }

  getSession(sessionId: string): QuerySessionRecord | undefined {
    return this.querySessionRepository.findById(sessionId);
  }

  getMessageReceipt(channelMessageId: string): Record<string, unknown> | undefined {
    const receipt =
      this.wecomMessageReceiptRepository.findByChannelMessageId(channelMessageId);
    if (!receipt) {
      return undefined;
    }

    return {
      ...receipt,
      deliveryRecords: this.wecomDeliveryRecordRepository.listByReceiptId(receipt.id),
    };
  }

  private async processInboundMessage(
    inboundMessage: WecomInboundMessage,
  ): Promise<WecomReceiveMessageResult> {
    const existingReceipt =
      this.wecomMessageReceiptRepository.findByChannelMessageId(
        inboundMessage.channelMessageId,
      );
    if (existingReceipt) {
      return {
        receiptId: existingReceipt.id,
        sessionId: existingReceipt.sessionId,
        queryId: existingReceipt.queryId,
        status: existingReceipt.status,
        acceptedAt: existingReceipt.createdAt,
        deduplicated: true,
      };
    }

    const receiptId = buildEntityId('receipt');
    const session = this.getOrCreateSession(inboundMessage, receiptId);
    const receipt = this.wecomMessageReceiptRepository.save({
      id: receiptId,
      channelMessageId: inboundMessage.channelMessageId,
      externalConversationId: inboundMessage.externalConversationId,
      senderId: inboundMessage.senderId,
      requesterId: session.requesterId,
      sessionId: session.id,
      chatType: inboundMessage.chatType,
      messageType: inboundMessage.messageType,
      status: 'ACCEPTED',
      rawPayloadSummary:
        this.wecomMessageAdapterService.summarizePayload(inboundMessage.rawPayload),
      createdAt: inboundMessage.receivedAt,
      updatedAt: inboundMessage.receivedAt,
    });

    const replyText =
      this.isBusinessRequest(inboundMessage.messageText)
        ? CORE_MODE_DISABLED_REPLY
        : await this.generateAiReply(inboundMessage);
    const dispatchResult = await this.dispatchReply({
      inboundMessage,
      receiptId: receipt.id,
      sessionId: session.id,
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(replyText),
    });

    this.querySessionRepository.save({
      ...session,
      contextStatus: 'IDLE',
      lastReceiptId: receipt.id,
      updatedAt: new Date().toISOString(),
    });

    return {
      receiptId: receipt.id,
      sessionId: session.id,
      status:
        replyText === CORE_MODE_DISABLED_REPLY
          ? 'BUSINESS_DISABLED'
          : replyText === AI_UNAVAILABLE_REPLY
            ? 'AI_UNAVAILABLE'
            : 'REPLIED',
      acceptedAt: receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private validateSignature(signature?: string): void {
    this.wecomAuthService.validateSignature(signature);
  }

  private validateSource(source?: string): void {
    this.wecomAuthService.validateSource(source);
  }

  private getOrCreateSession(
    inboundMessage: WecomInboundMessage,
    receiptId: string,
  ): QuerySessionRecord {
    const requesterId = this.buildSenderOnlyRequesterId(inboundMessage.senderId);
    const existingSession = this.querySessionRepository.findByWecomConversation(
      inboundMessage.externalConversationId,
      inboundMessage.senderId,
    );

    if (existingSession) {
      return this.querySessionRepository.save({
        ...existingSession,
        requesterId,
        requesterRoleIds: [],
        contextStatus: 'ACTIVE',
        lastMessageAt: inboundMessage.receivedAt,
        lastReceiptId: receiptId,
        pendingSequence: existingSession.pendingSequence + 1,
        updatedAt: inboundMessage.receivedAt,
      });
    }

    return this.querySessionRepository.save({
      id: buildEntityId('session'),
      channel: 'wecom-bot',
      externalConversationId: inboundMessage.externalConversationId,
      senderId: inboundMessage.senderId,
      requesterId,
      requesterRoleIds: [],
      contextStatus: 'ACTIVE',
      lastMessageAt: inboundMessage.receivedAt,
      lastReceiptId: receiptId,
      pendingSequence: 1,
      createdAt: inboundMessage.receivedAt,
      updatedAt: inboundMessage.receivedAt,
    });
  }

  private buildSenderOnlyRequesterId(senderId: string): string {
    const normalizedSenderId = senderId.replace(/[^\w-]/gu, '_');
    return `wecom_sender_${normalizedSenderId || 'unknown'}`;
  }

  private isBusinessRequest(messageText?: string): boolean {
    const normalizedText = messageText?.replace(/\s+/gu, '') ?? '';
    if (!normalizedText) {
      return false;
    }

    const hasDirectDisabledIntent =
      /(CRM问数|问数|渠道CRM|渠道分析|合同评审|合同审核|日报|周报|月报|跟进写回|新增客户|新增商机|结果导出|导出|经营看板|数据看板)/iu.test(
        normalizedText,
      );
    if (hasDirectDisabledIntent) {
      return true;
    }

    const hasBusinessObject =
      /(CRM|客户|商机|渠道商|渠道|合同|日报|周报|月报|跟进|回款|订单|线索|销售数据|销售业绩|漏斗|赢单|丢单|拜访|经营看板|数据看板)/iu.test(
        normalizedText,
      );
    const hasExecutionVerb =
      /(查|查询|统计|分析|汇总|排名|排行|列出|导出|生成|新增|创建|写回|同步|评审|审核|上传|下载|推送|提醒|看一下|看下)/iu.test(
        normalizedText,
      );
    return hasBusinessObject && hasExecutionVerb;
  }

  private async generateAiReply(
    inboundMessage: WecomInboundMessage,
  ): Promise<string> {
    try {
      const reply = await this.unifiedAiExecutionService.invokeText({
        system: [
          '你是企业内部的普通 AI 助手。',
          '当前系统已开放企业微信 CRM 第一阶段只读问数，但合同、证书、日报、导出或写回系统暂未启用。',
          '可以回答通用知识、写作、总结、翻译、方案梳理和非内部数据类问题。',
          '如果用户要求合同、证书、日报、写回、导出或创建业务对象，必须说明当前能力未启用，不能编造内部数据。',
          '回答应使用简洁、可信、面向业务用户的中文。',
        ].join('\n'),
        prompt: `用户在企业微信中发送了以下消息，请直接回复：\n\n${inboundMessage.messageText ?? ''}`,
        requestOverrides: {
          maxTokens: 1200,
          timeoutMs: 30000,
        },
      });
      return reply.trim() || AI_UNAVAILABLE_REPLY;
    } catch (error) {
      this.analysisLoggerService.logWarn(
        '企业微信核心机器人调用 AI 失败，已返回配置提示。',
        {
          senderId: inboundMessage.senderId,
          reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
        },
      );
      return AI_UNAVAILABLE_REPLY;
    }
  }

  private async dispatchReply(params: {
    inboundMessage: WecomInboundMessage;
    receiptId: string;
    sessionId: string;
    blocks: StreamBlock[];
  }): Promise<WecomDispatchResult> {
    return await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receiptId,
      sessionId: params.sessionId,
      target: {
        chatType: params.inboundMessage.chatType,
        deliveryTargetId: params.inboundMessage.deliveryTargetId,
        senderId: params.inboundMessage.senderId,
        externalConversationId: params.inboundMessage.externalConversationId,
        replyFrameHeaders: params.inboundMessage.replyFrameHeaders,
        streamId: params.receiptId,
      },
      blocks: params.blocks,
    });
  }

  private async handleReceiveError(
    error: unknown,
    inboundMessage: WecomInboundMessage | undefined,
    options: {
      fallbackSnapshot: Record<string, unknown>;
      deliverToChat: boolean;
    },
  ): Promise<WecomReceiveMessageResult> {
    const reason =
      error instanceof Error ? error.message : '企业微信核心机器人处理失败。';
    this.analysisLoggerService.logWarn('企业微信核心机器人入口处理失败。', {
      senderId: inboundMessage?.senderId,
      snapshot: inboundMessage
        ? this.wecomMessageAdapterService.summarizePayload(inboundMessage.rawPayload)
        : this.safeStringifySnapshot(options.fallbackSnapshot),
      reason,
    });

    if (!inboundMessage || !options.deliverToChat) {
      throw error;
    }

    const dispatchResult = await this.dispatchReply({
      inboundMessage,
      receiptId: buildEntityId('receipt'),
      sessionId: buildEntityId('session'),
      blocks: this.wecomStreamDispatcherService.buildBlockedBlocks(
        '当前企业微信消息暂时无法处理，请稍后重试。',
      ),
    });

    return {
      receiptId: buildEntityId('receipt'),
      status: 'BLOCKED',
      acceptedAt: new Date().toISOString(),
      clarificationPrompt: '当前企业微信消息暂时无法处理，请稍后重试。',
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private safeStringifySnapshot(snapshot: Record<string, unknown>): string {
    try {
      return JSON.stringify(snapshot).slice(0, 500);
    } catch {
      return '[unserializable-payload]';
    }
  }
}
