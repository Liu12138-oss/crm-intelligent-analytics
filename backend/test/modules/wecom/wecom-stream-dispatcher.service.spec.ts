import { WecomStreamDispatcherService } from '../../../src/modules/wecom/wecom-stream-dispatcher.service';

describe('WecomStreamDispatcherService', () => {
  it('企业微信分析报告应先下发模板卡片再下发文本摘要', async () => {
    const sendTemplateCardMessage = jest.fn(async () => ({
      externalMessageId: 'sdk-card-test',
    }));
    const sendMarkdownMessage = jest.fn(async () => ({
      externalMessageId: 'sdk-markdown-test',
    }));
    const service = new WecomStreamDispatcherService(
      {
        getWecomRuntimeConfig: jest.fn(() => ({
          deliveryMaxRetries: 0,
          deliveryRetryDelayMs: 0,
          deliveryChunkMaxLength: 900,
        })),
      } as never,
      {
        sendTemplateCardMessage,
        sendMarkdownMessage,
      } as never,
      {
        save: jest.fn((record) => record),
      } as never,
    );

    const result = await service.dispatch({
      receiptId: 'receipt_test',
      sessionId: 'session_test',
      target: {
        chatType: 'single',
        deliveryTargetId: 'wx_sales_director',
        senderId: 'wx_sales_director',
        externalConversationId: 'conv_test',
      },
      templateCards: [
        {
          sequence: 8000,
          templateCard: {
            card_type: 'text_notice',
            main_title: {
              title: '订单与商机分块分析',
            },
            card_action: {
              type: 1,
              url: 'http://127.0.0.1:5173',
            },
          },
          contentPreview: '订单与商机分块分析',
        },
      ],
      blocks: [
        {
          sequence: 0,
          blockType: 'REPORT',
          content: '## 短摘要',
        },
      ],
    });

    expect(result.status).toBe('SENT');
    expect(result.deliveredCount).toBe(2);
    expect(sendTemplateCardMessage).toHaveBeenCalledTimes(1);
    expect(sendMarkdownMessage).toHaveBeenCalledTimes(1);
    expect(sendTemplateCardMessage.mock.invocationCallOrder[0]).toBeLessThan(
      sendMarkdownMessage.mock.invocationCallOrder[0],
    );
  });

  it('企业微信流式回传最终报告时不应按主动消息阈值拆成多次 stream 回复', async () => {
    const replyStreamMessage = jest.fn(async () => ({
      externalMessageId: 'sdk-stream-test',
    }));
    const service = new WecomStreamDispatcherService(
      {
        getWecomRuntimeConfig: jest.fn(() => ({
          deliveryMaxRetries: 0,
          deliveryRetryDelayMs: 0,
          deliveryChunkMaxLength: 20,
        })),
      } as never,
      {
        replyStreamMessage,
      } as never,
      {
        save: jest.fn((record) => record),
      } as never,
    );

    await service.dispatch({
      receiptId: 'receipt_test',
      sessionId: 'session_test',
      target: {
        chatType: 'single',
        deliveryTargetId: 'wx_sales_director',
        senderId: 'wx_sales_director',
        externalConversationId: 'conv_test',
        replyFrameHeaders: {
          req_id: 'req_test',
        },
        streamId: 'stream_test',
      },
      blocks: [
        {
          sequence: 0,
          blockType: 'REPORT',
          content: '#'.repeat(200),
        },
      ],
    });

    expect(replyStreamMessage).toHaveBeenCalledTimes(1);
    expect(replyStreamMessage).toHaveBeenCalledWith({
      frameHeaders: { req_id: 'req_test' },
      streamId: 'stream_test',
      content: '#'.repeat(200),
      finish: true,
    });
  });

  it('模板卡片下发失败时应记录企业微信错误码和错误信息', async () => {
    const sendTemplateCardMessage = jest.fn(async () => {
      throw {
        errcode: 40058,
        errmsg: 'invalid template_card',
      };
    });
    const save = jest.fn((record) => record);
    const service = new WecomStreamDispatcherService(
      {
        getWecomRuntimeConfig: jest.fn(() => ({
          deliveryMaxRetries: 0,
          deliveryRetryDelayMs: 0,
          deliveryChunkMaxLength: 900,
        })),
      } as never,
      {
        sendTemplateCardMessage,
      } as never,
      {
        save,
      } as never,
    );

    const result = await service.dispatch({
      receiptId: 'receipt_test',
      sessionId: 'session_test',
      target: {
        chatType: 'single',
        deliveryTargetId: 'wx_sales_director',
        senderId: 'wx_sales_director',
        externalConversationId: 'conv_test',
      },
      templateCards: [
        {
          sequence: 8000,
          templateCard: {
            card_type: 'text_notice',
          },
          contentPreview: '模板卡片摘要',
        },
      ],
      blocks: [],
    });

    expect(result.records[0]).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        failureReason: '企业微信卡片下发失败。 errcode=40058 errmsg=invalid template_card',
      }),
    );
  });
});
