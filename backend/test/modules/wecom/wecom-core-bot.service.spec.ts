import { WecomCoreBotService } from '../../../src/modules/wecom/wecom-core-bot.service';
import { WecomMessageAdapterService } from '../../../src/modules/wecom/wecom-message-adapter.service';

describe('WecomCoreBotService', () => {
  const buildService = () => {
    const sessions: any[] = [];
    const receipts: any[] = [];
    const dispatchEnvelopes: any[] = [];
    const invokeText = jest.fn();
    const dispatch = jest.fn(async (envelope: any) => {
      dispatchEnvelopes.push(envelope);
      return {
        status: 'SENT',
        deliveredCount: envelope.blocks.length,
        failedCount: 0,
        records: [],
      };
    });

    const service = new WecomCoreBotService(
      {
        logWarn: jest.fn(),
        logStep: jest.fn(),
      } as never,
      {
        invokeText,
      } as never,
      {
        findById: jest.fn((sessionId: string) =>
          sessions.find((item) => item.id === sessionId),
        ),
        findByWecomConversation: jest.fn(
          (externalConversationId: string, senderId?: string) =>
            sessions.find(
              (item) =>
                item.externalConversationId === externalConversationId &&
                (!senderId || item.senderId === senderId),
            ),
        ),
        save: jest.fn((session: any) => {
          const index = sessions.findIndex((item) => item.id === session.id);
          if (index >= 0) {
            sessions[index] = session;
            return session;
          }
          sessions.unshift(session);
          return session;
        }),
      } as never,
      {
        validateSignature: jest.fn(),
        validateSource: jest.fn(),
        validateBotId: jest.fn(),
      } as never,
      new WecomMessageAdapterService(),
      {
        findByChannelMessageId: jest.fn((messageId: string) =>
          receipts.find((item) => item.channelMessageId === messageId),
        ),
        save: jest.fn((receipt: any) => {
          const index = receipts.findIndex((item) => item.id === receipt.id);
          if (index >= 0) {
            receipts[index] = receipt;
            return receipt;
          }
          receipts.unshift(receipt);
          return receipt;
        }),
      } as never,
      {
        listByReceiptId: jest.fn(() => []),
      } as never,
      {
        buildDirectReplyBlocks: jest.fn((message: string) => [
          {
            sequence: 0,
            blockType: 'PROCESSING_NOTICE',
            content: message,
          },
        ]),
        buildBlockedBlocks: jest.fn((message: string) => [
          {
            sequence: 0,
            blockType: 'ERROR',
            content: message,
          },
        ]),
        dispatch,
      } as never,
      {
        startInboundListener: jest.fn(),
      } as never,
    );

    return {
      service,
      invokeText,
      dispatch,
      dispatchEnvelopes,
      sessions,
      receipts,
    };
  };

  const buildMessage = (messageId: string, content: string) => ({
    msgid: messageId,
    senderId: 'bot_crm_assistant',
    aibotid: 'bot_crm_assistant',
    from: {
      userid: 'wx_sales_user',
    },
    chatid: 'single_chat_wx_sales_user',
    msgtype: 'text',
    text: {
      content,
    },
  });

  it('业务请求应返回收敛提示且不调用 AI', async () => {
    const { service, invokeText, dispatchEnvelopes } = buildService();

    const result = await service.receiveSdkMessage(
      buildMessage('msg_business_001', '帮我查询本月客户和商机排名'),
    );

    expect(result.status).toBe('BUSINESS_DISABLED');
    expect(invokeText).not.toHaveBeenCalled();
    expect(dispatchEnvelopes[0].blocks[0].content).toContain(
      '当前核心模式仅开放普通 AI 对话和基础帮助',
    );
  });

  it('普通问题在 AI 不可用时应返回配置提示', async () => {
    const { service, invokeText, dispatchEnvelopes } = buildService();
    invokeText.mockRejectedValue(new Error('AI profile missing'));

    const result = await service.receiveSdkMessage(
      buildMessage('msg_ai_unavailable_001', '帮我写一段会议纪要开头'),
    );

    expect(result.status).toBe('AI_UNAVAILABLE');
    expect(invokeText).toHaveBeenCalledTimes(1);
    expect(dispatchEnvelopes[0].blocks[0].content).toContain(
      'AI 服务暂时不可用或尚未配置完成',
    );
  });

  it('重复消息应命中去重且不重复投递', async () => {
    const { service, dispatch } = buildService();

    await service.receiveSdkMessage(
      buildMessage('msg_duplicate_001', '帮我查询本月客户和商机排名'),
    );
    const duplicatedResult = await service.receiveSdkMessage(
      buildMessage('msg_duplicate_001', '帮我查询本月客户和商机排名'),
    );

    expect(duplicatedResult.deduplicated).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
