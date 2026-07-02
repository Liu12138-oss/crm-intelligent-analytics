import { Injectable } from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import type { StreamBlock, WecomDeliveryRecord } from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { WecomDeliveryRecordRepository } from './wecom-delivery-record.repository';
import type {
  WecomDispatchEnvelope,
  WecomDispatchImageAttachment,
  WecomDispatchTemplateCard,
  WecomDispatchResult,
} from './wecom-message.types';
import { WecomTransportService } from './wecom-transport.service';

@Injectable()
export class WecomStreamDispatcherService {
  private readonly maxStreamReplyBytes = 20480;

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly wecomTransportService: WecomTransportService,
    private readonly wecomDeliveryRecordRepository: WecomDeliveryRecordRepository,
  ) {}

  async dispatch(envelope: WecomDispatchEnvelope): Promise<WecomDispatchResult> {
    const records: WecomDeliveryRecord[] = [];
    let deliveredCount = 0;
    let failedCount = 0;
    const useStreamReply = Boolean(
      envelope.target.replyFrameHeaders?.req_id && envelope.target.streamId,
    );
    const finalize = envelope.finalize ?? true;

    for (const card of envelope.templateCards ?? []) {
      const record = this.wecomDeliveryRecordRepository.save({
        id: buildEntityId('delivery'),
        receiptId: envelope.receiptId,
        sessionId: envelope.sessionId,
        queryId: envelope.queryId,
        deliveryTargetId: envelope.target.deliveryTargetId,
        blockSequence: card.sequence,
        blockType: 'REPORT',
        contentPreview: card.contentPreview.slice(0, 120),
        status: 'PENDING',
        attemptCount: 0,
        createdAt: new Date().toISOString(),
      });
      const deliveredRecord = await this.deliverTemplateCard(record, envelope.target, card);
      records.push(deliveredRecord);
      if (deliveredRecord.status === 'SENT') {
        deliveredCount += 1;
      }
    }

    for (const block of envelope.blocks) {
      const chunkedContents = useStreamReply
        ? this.splitStreamContent(block.content)
        : this.splitContent(block.content);
      for (let index = 0; index < chunkedContents.length; index += 1) {
        const content = chunkedContents[index];
        const record = this.wecomDeliveryRecordRepository.save({
          id: buildEntityId('delivery'),
          receiptId: envelope.receiptId,
          sessionId: envelope.sessionId,
          queryId: envelope.queryId,
          deliveryTargetId: envelope.target.deliveryTargetId,
          blockSequence: Number(`${block.sequence}${index}`),
          blockType: block.blockType,
          contentPreview: content.slice(0, 120),
          status: 'PENDING',
          attemptCount: 0,
          createdAt: new Date().toISOString(),
        });

        const deliveredRecord = useStreamReply
          ? await this.deliverStreamBlock(
              record,
              content,
              envelope.target.replyFrameHeaders!,
              envelope.target.streamId!,
              finalize &&
                block === envelope.blocks[envelope.blocks.length - 1] &&
                index === chunkedContents.length - 1,
            )
          : await this.deliverBlock(record, content);
        records.push(deliveredRecord);
        if (deliveredRecord.status === 'SENT') {
          deliveredCount += 1;
        } else {
          failedCount += 1;
        }
      }
    }

    for (const attachment of envelope.imageAttachments ?? []) {
      const record = this.wecomDeliveryRecordRepository.save({
        id: buildEntityId('delivery'),
        receiptId: envelope.receiptId,
        sessionId: envelope.sessionId,
        queryId: envelope.queryId,
        deliveryTargetId: envelope.target.deliveryTargetId,
        blockSequence: attachment.sequence,
        blockType: 'REPORT',
        contentPreview: attachment.contentPreview.slice(0, 120),
        status: 'PENDING',
        attemptCount: 0,
        createdAt: new Date().toISOString(),
      });
      const deliveredRecord = await this.deliverImageAttachment(
        record,
        envelope.target,
        attachment,
      );
      records.push(deliveredRecord);
      if (deliveredRecord.status === 'SENT') {
        deliveredCount += 1;
      }
    }

    return {
      status: failedCount > 0 ? 'FAILED' : 'SENT',
      deliveredCount,
      failedCount,
      records,
    };
  }

  buildQueueBlocks(queueNotice?: string): StreamBlock[] {
    return [
      {
        sequence: 0,
        blockType: 'PROCESSING_NOTICE',
        content: queueNotice ?? '当前会话仍有请求处理中，请稍后查看结果。',
      },
    ];
  }

  buildClarificationBlocks(clarificationPrompt: string): StreamBlock[] {
    return [
      {
        sequence: 0,
        blockType: 'PROCESSING_NOTICE',
        content: '已收到你的问题，正在确认补充条件。',
      },
      {
        sequence: 1,
        blockType: 'CLARIFICATION',
        content: clarificationPrompt,
      },
    ];
  }

  buildBlockedBlocks(reason: string): StreamBlock[] {
    return [
      {
        sequence: 0,
        blockType: 'ERROR',
        content: reason,
      },
    ];
  }

  buildExplanationBlocks(explanation: string): StreamBlock[] {
    return [
      {
        sequence: 0,
        blockType: 'EXPLANATION',
        content: explanation,
      },
    ];
  }

  buildDirectReplyBlocks(message: string): StreamBlock[] {
    return [
      {
        sequence: 0,
        blockType: 'PROCESSING_NOTICE',
        content: message,
      },
    ];
  }

  buildImmediateAckBlocks(questionText?: string): StreamBlock[] {
    return [
      {
        sequence: 0,
        blockType: 'PROCESSING_NOTICE',
        content: questionText
          ? `您好，已收到你的消息“${questionText}”，正在处理中，请稍候。`
          : '您好，已收到，正在处理中，请稍候。',
      },
    ];
  }

  buildProgressStageBlocks(
    stage: 'thinking' | 'querying' | 'reporting' | 'explaining',
  ): StreamBlock[] {
    const stageMessageMap: Record<typeof stage, string> = {
      thinking: '正在识别意图并准备后续处理。',
      querying: '正在查询 CRM 实时数据，请稍候。',
      reporting: '正在整理结果并生成结论。',
      explaining: '正在结合上一轮结果整理解释。',
    };

    return [
      {
        sequence: 0,
        blockType: 'PROCESSING_NOTICE',
        content: stageMessageMap[stage],
      },
    ];
  }

  private async deliverBlock(
    record: WecomDeliveryRecord,
    content: string,
  ): Promise<WecomDeliveryRecord> {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const maxAttempts = Math.max(1, config.deliveryMaxRetries + 1);
    let lastError = '企业微信结果下发失败。';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptRecord = this.wecomDeliveryRecordRepository.save({
        ...record,
        status: attempt === 1 ? 'PENDING' : 'RETRYING',
        attemptCount: attempt,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        const response = await this.wecomTransportService.sendMarkdownMessage(
          {
            chatType: 'single',
            deliveryTargetId: attemptRecord.deliveryTargetId,
            senderId: '',
            externalConversationId: attemptRecord.deliveryTargetId,
          },
          content,
        );
        return this.wecomDeliveryRecordRepository.save({
          ...attemptRecord,
          status: 'SENT',
          externalMessageId: response.externalMessageId,
          deliveredAt: new Date().toISOString(),
          failureReason: undefined,
        });
      } catch (error) {
        lastError = error instanceof Error ? error.message : '企业微信结果下发失败。';
        if (attempt < maxAttempts) {
          await this.delay(config.deliveryRetryDelayMs);
          continue;
        }
      }
    }

    return this.wecomDeliveryRecordRepository.save({
      ...record,
      status: 'FAILED',
      attemptCount: maxAttempts,
      lastAttemptAt: new Date().toISOString(),
      failureReason: lastError,
    });
  }

  /**
   * 下发企微图片附件。
   *
   * 参数说明：`record` 为投递审计记录，`target` 为企微目标，`attachment` 为图片附件。
   * 返回值说明：返回更新后的投递记录。
   * 调用注意事项：图片是结果增强展示，失败不累加 `failedCount`，避免影响已成功返回的文本结果。
   */
  private async deliverImageAttachment(
    record: WecomDeliveryRecord,
    target: WecomDispatchEnvelope['target'],
    attachment: WecomDispatchImageAttachment,
  ): Promise<WecomDeliveryRecord> {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const maxAttempts = Math.max(1, config.deliveryMaxRetries + 1);
    let lastError = '企业微信图片下发失败。';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptRecord = this.wecomDeliveryRecordRepository.save({
        ...record,
        status: attempt === 1 ? 'PENDING' : 'RETRYING',
        attemptCount: attempt,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        const response = await this.wecomTransportService.sendImageMessage(
          target,
          attachment.buffer,
          attachment.filename,
        );
        return this.wecomDeliveryRecordRepository.save({
          ...attemptRecord,
          status: 'SENT',
          externalMessageId: response.externalMessageId,
          deliveredAt: new Date().toISOString(),
          failureReason: undefined,
        });
      } catch (error) {
        lastError = this.formatDeliveryError(error, '企业微信图片下发失败。');
        if (attempt < maxAttempts) {
          await this.delay(config.deliveryRetryDelayMs);
          continue;
        }
      }
    }

    return this.wecomDeliveryRecordRepository.save({
      ...record,
      status: 'FAILED',
      failureReason: lastError,
      attemptCount: maxAttempts,
      deliveredAt: undefined,
    });
  }

  /**
   * 下发企微模板卡片。
   *
   * 参数说明：`record` 为投递审计记录，`target` 为企微目标，`card` 为模板卡片内容。
   * 返回值说明：返回更新后的投递记录。
   * 调用注意事项：卡片只是报告门面增强，失败不累加 `failedCount`，避免影响 Markdown 和图片兜底。
   */
  private async deliverTemplateCard(
    record: WecomDeliveryRecord,
    target: WecomDispatchEnvelope['target'],
    card: WecomDispatchTemplateCard,
  ): Promise<WecomDeliveryRecord> {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const maxAttempts = Math.max(1, config.deliveryMaxRetries + 1);
    let lastError = '企业微信卡片下发失败。';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptRecord = this.wecomDeliveryRecordRepository.save({
        ...record,
        status: attempt === 1 ? 'PENDING' : 'RETRYING',
        attemptCount: attempt,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        const response = await this.wecomTransportService.sendTemplateCardMessage(
          target,
          card.templateCard,
        );
        return this.wecomDeliveryRecordRepository.save({
          ...attemptRecord,
          status: 'SENT',
          externalMessageId: response.externalMessageId,
          deliveredAt: new Date().toISOString(),
          failureReason: undefined,
        });
      } catch (error) {
        lastError = this.formatDeliveryError(error, '企业微信卡片下发失败。');
        if (attempt < maxAttempts) {
          await this.delay(config.deliveryRetryDelayMs);
          continue;
        }
      }
    }

    return this.wecomDeliveryRecordRepository.save({
      ...record,
      status: 'FAILED',
      failureReason: lastError,
      attemptCount: maxAttempts,
      deliveredAt: undefined,
    });
  }

  private async deliverStreamBlock(
    record: WecomDeliveryRecord,
    content: string,
    frameHeaders: { req_id: string },
    streamId: string,
    finish: boolean,
  ): Promise<WecomDeliveryRecord> {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const maxAttempts = Math.max(1, config.deliveryMaxRetries + 1);
    let lastError = '企业微信流式结果下发失败。';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptRecord = this.wecomDeliveryRecordRepository.save({
        ...record,
        status: attempt === 1 ? 'PENDING' : 'RETRYING',
        attemptCount: attempt,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        const response = await this.wecomTransportService.replyStreamMessage({
          frameHeaders,
          streamId,
          content,
          finish,
        });
        return this.wecomDeliveryRecordRepository.save({
          ...attemptRecord,
          status: 'SENT',
          externalMessageId: response.externalMessageId,
          deliveredAt: new Date().toISOString(),
          failureReason: undefined,
        });
      } catch (error) {
        lastError = this.formatDeliveryError(error, '企业微信流式结果下发失败。');
        if (attempt < maxAttempts) {
          await this.delay(config.deliveryRetryDelayMs);
          continue;
        }
      }
    }

    return this.wecomDeliveryRecordRepository.save({
      ...record,
      status: 'FAILED',
      attemptCount: maxAttempts,
      lastAttemptAt: new Date().toISOString(),
      failureReason: lastError,
    });
  }

  private splitContent(content: string): string[] {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const maxLength = Math.max(50, config.deliveryChunkMaxLength);
    return this.splitContentByBytes(content, maxLength);
  }

  private formatDeliveryError(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (error && typeof error === 'object') {
      const payload = error as Record<string, unknown>;
      const errcode = payload.errcode ?? payload.errorCode ?? payload.code;
      const errmsg = payload.errmsg ?? payload.errorMessage ?? payload.message;
      if (errcode !== undefined || errmsg !== undefined) {
        return `${fallback} errcode=${String(errcode ?? 'unknown')} errmsg=${String(errmsg ?? 'unknown')}`;
      }

      try {
        return `${fallback} raw=${JSON.stringify(payload).slice(0, 500)}`;
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  /**
   * 流式回复允许更大的单条内容，避免把最终 Markdown 误拆成多次 stream 覆盖。
   *
   * 参数说明：`content` 为最终准备回传的流式文本。
   * 返回值：优先保持单条；仅超出企业微信 stream 上限时才按字节拆分。
   */
  private splitStreamContent(content: string): string[] {
    return this.splitContentByBytes(content, this.maxStreamReplyBytes);
  }

  private splitContentByBytes(content: string, maxBytes: number): string[] {
    if (Buffer.byteLength(content, 'utf8') <= maxBytes) {
      return [content];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    for (const character of content) {
      const nextChunk = `${currentChunk}${character}`;
      if (Buffer.byteLength(nextChunk, 'utf8') > maxBytes) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = character;
        continue;
      }
      currentChunk = nextChunk;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private async delay(durationMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  }
}
