import type { WecomFollowUpTemplateDraft } from '../../../../shared/types/domain';

export interface WecomFollowUpStructuredDraftFixture {
  messageText: string;
  expectedDraft: Pick<
    WecomFollowUpTemplateDraft,
    'followUpContent' | 'helpNeeded' | 'informationShare' | 'visitPlan'
  >;
}

export const WECOM_FOLLOW_UP_STRUCTURED_DRAFT_FIXTURES: WecomFollowUpStructuredDraftFixture[] =
  [
    {
      messageText:
        '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      expectedDraft: {
        followUpContent: '今天跟进了安恒信息；尬聊了一天；无进度更新',
        helpNeeded: '客户不好沟通；推进缓慢',
        informationShare: undefined,
        visitPlan: '明天继续跟进',
      },
    },
    {
      messageText:
        '今天拜访了山东农信续约项目，客户认可续签方向，但需要区域经理确认折扣底线，客户更关注交付周期，明天下午继续确认 POC 时间。',
      expectedDraft: {
        followUpContent: '今天拜访了山东农信续约项目；客户认可续签方向',
        helpNeeded: '需要区域经理确认折扣底线',
        informationShare: '客户更关注交付周期',
        visitPlan: '明天下午继续确认 POC 时间',
      },
    },
  ];
