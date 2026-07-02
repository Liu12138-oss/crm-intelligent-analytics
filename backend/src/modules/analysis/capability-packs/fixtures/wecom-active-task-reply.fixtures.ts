export interface WecomActiveTaskReplyFixture {
  messageText: string;
  output: Record<string, unknown>;
}

export const WECOM_ACTIVE_TASK_REPLY_FIXTURES: WecomActiveTaskReplyFixture[] = [
  {
    messageText: '取消',
    output: {
      intent: 'TASK_CANCEL',
    },
  },
  {
    messageText: '生成日报',
    output: {
      intent: 'TASK_SWITCH',
      target: 'DAILY_REPORT_QUERY',
    },
  },
  {
    messageText: '不补充',
    output: {
      intent: 'DIRECT_SUBMIT',
    },
  },
  {
    messageText:
      '今天跟进了安恒信息，客户不好沟通，推进缓慢，明天继续跟进',
    output: {
      intent: 'MODIFY_CONTENT',
    },
  },
];
