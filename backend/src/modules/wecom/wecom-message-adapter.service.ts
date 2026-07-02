import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  WecomChatType,
  WecomInboundMessage,
  WecomInboundMessageType,
} from '../../shared/types/domain';

@Injectable()
export class WecomMessageAdapterService {
  normalizeIncomingMessage(body: Record<string, unknown>): WecomInboundMessage {
    const normalizedBody = this.extractSourceBody(body);
    const chatType = this.resolveChatType(normalizedBody);
    const rawSenderId = this.resolveString(normalizedBody.senderId);
    const botId = this.resolveString(
      normalizedBody.aibotid,
      normalizedBody.botId,
      normalizedBody.agentid,
      this.readNested(normalizedBody, ['bot', 'id']),
    );
    const channelAgentId = this.resolveString(botId, rawSenderId);
    const channelMessageId = this.resolveString(
      normalizedBody.messageId,
      normalizedBody.msgid,
      normalizedBody.id,
    );
    const reliableSenderId = this.resolveString(
      this.readNested(normalizedBody, ['from', 'userid']),
      this.readNested(normalizedBody, ['sender', 'id']),
      normalizedBody.userid,
    );
    const senderId = this.resolveString(
      reliableSenderId,
      rawSenderId && rawSenderId !== botId ? rawSenderId : undefined,
    );
    const externalConversationId = this.resolveString(
      normalizedBody.externalConversationId,
      normalizedBody.chatid,
      this.readNested(normalizedBody, ['conversation', 'id']),
      this.readNested(normalizedBody, ['session', 'id']),
      chatType === 'single' ? senderId : undefined,
    );
    const deliveryTargetId = this.resolveString(
      normalizedBody.deliveryTargetId,
      normalizedBody.chatid,
      externalConversationId,
      senderId,
    );
    const messageType = this.resolveMessageType(normalizedBody);
    const messageText = this.resolveMessageText(normalizedBody, messageType);

    if (!channelMessageId || !senderId || !externalConversationId || !deliveryTargetId) {
      throw new BadRequestException('企业微信消息结构不完整。');
    }

    if (chatType === 'group' && !senderId) {
      throw new BadRequestException('企业微信群聊消息缺少可靠发送者标识。');
    }

    if (messageType !== 'text' && messageType !== 'voice') {
      throw new BadRequestException('当前企业微信入口仅支持文本和语音问数。');
    }

    if (!messageText?.trim()) {
      throw new BadRequestException('企业微信消息内容不能为空。');
    }

    return {
      channelMessageId,
      externalConversationId,
      senderId,
      rawSenderId,
      deliveryTargetId,
      chatType,
      messageType,
      messageText: messageText.trim(),
      botId,
      channelAgentId,
      responseUrl: this.resolveString(
        normalizedBody.response_url,
        normalizedBody.responseUrl,
      ),
      replyFrameHeaders: this.resolveReplyFrameHeaders(body),
      rawPayload: normalizedBody,
      receivedAt: new Date().toISOString(),
    };
  }

  summarizePayload(body: Record<string, unknown>): string {
    const normalizedBody = this.extractSourceBody(body);
    const rawSenderId = this.resolveString(normalizedBody.senderId);
    const botId = this.resolveString(
      normalizedBody.aibotid,
      normalizedBody.botId,
      normalizedBody.agentid,
      this.readNested(normalizedBody, ['bot', 'id']),
    );
    const summary = {
      messageId: this.resolveString(
        normalizedBody.messageId,
        normalizedBody.msgid,
        normalizedBody.id,
      ),
      senderId: this.resolveString(
        this.readNested(normalizedBody, ['from', 'userid']),
        this.readNested(normalizedBody, ['sender', 'id']),
        normalizedBody.userid,
        rawSenderId && rawSenderId !== botId ? rawSenderId : undefined,
      ),
      rawSenderId,
      botId,
      channelAgentId: this.resolveString(botId, rawSenderId),
      chatType: this.resolveChatType(normalizedBody),
      messageType: this.resolveMessageType(normalizedBody),
      reqId: this.resolveReplyFrameHeaders(body)?.req_id,
    };
    return JSON.stringify(summary);
  }

  private extractSourceBody(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const frameBody = this.readNested(payload, ['body']);
    if (frameBody && typeof frameBody === 'object') {
      return frameBody as Record<string, unknown>;
    }

    return payload;
  }

  private resolveReplyFrameHeaders(
    payload: Record<string, unknown>,
  ): { req_id: string } | undefined {
    const reqId = this.resolveString(this.readNested(payload, ['headers', 'req_id']));
    if (!reqId) {
      return undefined;
    }

    return {
      req_id: reqId,
    };
  }

  private resolveChatType(body: Record<string, unknown>): WecomChatType {
    const rawChatType = this.resolveString(
      body.chatType,
      body.chattype,
      this.readNested(body, ['conversation', 'type']),
    );
    return rawChatType === 'group' ? 'group' : 'single';
  }

  private resolveMessageType(
    body: Record<string, unknown>,
  ): WecomInboundMessageType {
    const rawType = this.resolveString(
      body.messageType,
      body.msgType,
      body.msgtype,
      this.readNested(body, ['message', 'type']),
    );
    if (!rawType) {
      if (
        this.resolveString(
          body.messageText,
          body.content,
          this.readNested(body, ['text', 'content']),
          this.readNested(body, ['message', 'text', 'content']),
        )
      ) {
        return 'text';
      }
      return 'unknown';
    }

    if (
      rawType === 'text' ||
      rawType === 'image' ||
      rawType === 'mixed' ||
      rawType === 'voice' ||
      rawType === 'file'
    ) {
      return rawType;
    }

    return 'unknown';
  }

  private resolveMessageText(
    body: Record<string, unknown>,
    messageType: WecomInboundMessageType,
  ): string | undefined {
    // 文本消息：从 text/content 字段解析
    if (messageType === 'text') {
      return this.resolveString(
        body.messageText,
        body.content,
        this.readNested(body, ['text', 'content']),
        this.readNested(body, ['message', 'text', 'content']),
      );
    }

    // 语音消息：企微已将语音转为文本，从 voice.content 字段解析
    // 参考企微开发者文档 path/100719 接收消息
    if (messageType === 'voice') {
      return this.resolveString(
        this.readNested(body, ['voice', 'content']),
        this.readNested(body, ['voice', 'text', 'content']),
        this.readNested(body, ['message', 'voice', 'content']),
        body.voiceContent as string | undefined,
        body.voice_text as string | undefined,
      );
    }

    return undefined;
  }

  private readNested(
    value: Record<string, unknown>,
    path: string[],
  ): unknown {
    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private resolveString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }
}
