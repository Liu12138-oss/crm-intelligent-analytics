import { BadRequestException } from '@nestjs/common';
import { WecomMessageAdapterService } from '../../../src/modules/wecom/wecom-message-adapter.service';

describe('WecomMessageAdapterService', () => {
  const service = new WecomMessageAdapterService();

  it('SDK body 应优先使用 from.userid 作为真实发送人', () => {
    const message = service.normalizeIncomingMessage({
      body: {
        msgid: 'sdk_msg_001',
        senderId: 'bot_crm_assistant',
        aibotid: 'bot_crm_assistant',
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '本月商机排名',
        },
      },
    });

    expect(message.senderId).toBe('wx_sales_director');
    expect(message.rawSenderId).toBe('bot_crm_assistant');
    expect(message.botId).toBe('bot_crm_assistant');
    expect(message.channelAgentId).toBe('bot_crm_assistant');
  });

  it('webhook body 应兼容 sender.id 作为真实发送人', () => {
    const message = service.normalizeIncomingMessage({
      messageId: 'webhook_msg_001',
      sender: {
        id: 'wx_sales_rep',
      },
      externalConversationId: 'conv_sales_rep',
      msgtype: 'text',
      content: '帮我查客户跟进',
    });

    expect(message.senderId).toBe('wx_sales_rep');
    expect(message.externalConversationId).toBe('conv_sales_rep');
  });

  it('顶层 senderId 为机器人时不得作为真实用户', () => {
    expect(() =>
      service.normalizeIncomingMessage({
        msgid: 'sdk_msg_robot_only',
        senderId: 'bot_crm_assistant',
        botId: 'bot_crm_assistant',
        msgtype: 'text',
        text: {
          content: '你好',
        },
      }),
    ).toThrow(BadRequestException);
  });

  it('群聊消息应使用真实发送人并按群会话隔离', () => {
    const message = service.normalizeIncomingMessage({
      msgid: 'group_msg_001',
      chattype: 'group',
      chatid: 'group_chat_001',
      senderId: 'bot_crm_assistant',
      aibotid: 'bot_crm_assistant',
      from: {
        userid: 'wx_group_member',
      },
      msgtype: 'text',
      text: {
        content: '团队日报',
      },
    });

    expect(message.chatType).toBe('group');
    expect(message.senderId).toBe('wx_group_member');
    expect(message.externalConversationId).toBe('group_chat_001');
    expect(message.deliveryTargetId).toBe('group_chat_001');
  });
});
