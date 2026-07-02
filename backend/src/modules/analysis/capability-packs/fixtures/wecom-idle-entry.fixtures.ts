export interface WecomIdleEntryFixture {
  messageText: string;
  output: Record<string, unknown>;
}

export const WECOM_IDLE_ENTRY_FIXTURES: WecomIdleEntryFixture[] = [
  {
    messageText: '你好',
    output: {
      intent: 'HELP_GUIDANCE',
      helpScene: 'GREETING',
    },
  },
  {
    messageText: '你好，你是谁',
    output: {
      intent: 'HELP_GUIDANCE',
      helpScene: 'GREETING',
    },
  },
  {
    messageText: '跟进商机',
    output: {
      intent: 'DAILY_REPORT',
      dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
    },
  },
  {
    messageText: '新增客户',
    output: {
      intent: 'CRM_CREATE_CUSTOMER',
    },
  },
  {
    messageText: '新增商机',
    output: {
      intent: 'CRM_CREATE_OPPORTUNITY',
    },
  },
  {
    messageText: '查安恒信息项目',
    output: {
      intent: 'OPPORTUNITY_LOOKUP',
      lookupText: '安恒信息',
    },
  },
  {
    messageText: '查我当前跟进的客户',
    output: {
      intent: 'ENTITY_LOOKUP',
      entityLookupAction: 'LIST',
      entityType: 'Customer',
      queryText: '我当前跟进的客户',
      referenceTarget: 'NONE',
      confidence: 'HIGH',
    },
  },
];

export function resolveWecomIdleEntryFixture(
  messageText: string,
): Record<string, unknown> | null {
  const normalizedMessageText = messageText.trim();
  return (
    WECOM_IDLE_ENTRY_FIXTURES.find(
      (item) => item.messageText === normalizedMessageText,
    )?.output ?? null
  );
}
