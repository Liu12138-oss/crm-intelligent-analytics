import {
  buildWecomFollowUpTemplateOptionalMissingPrompt,
  isWecomFollowUpTemplateDirectSubmitIntent,
  parseWecomFollowUpTemplateUpdates,
} from '../../../src/modules/wecom/wecom-follow-up-template.helper';

describe('wecom follow up template helper', () => {
  it('只缺信息共享时，缺项提示不应再展示协助和拜访计划示例', () => {
    const prompt = buildWecomFollowUpTemplateOptionalMissingPrompt({
      filledLines: [
        '跟进内容：今天跟进了安恒信息，尬聊了一天，无进度更新。',
        '遇到与协助：客户不好沟通，推进缓慢。',
        '拜访计划：明天继续跟进。',
      ],
      missingLabels: ['信息共享'],
    });

    expect(prompt).toContain('如果方便，也可以继续补充「信息共享」');
    expect(prompt).toContain('信息共享：客户更关注交付周期。');
    expect(prompt).not.toContain('需要协助：需要区域经理确认折扣底线。');
    expect(prompt).not.toContain('拜访计划：明天继续跟客户确认 POC 时间。');
  });

  it('不补充应视为按当前草稿继续，而不是取消', () => {
    expect(isWecomFollowUpTemplateDirectSubmitIntent('不补充')).toBe(true);
    expect(isWecomFollowUpTemplateDirectSubmitIntent('先不补充')).toBe(true);
  });

  it('应兼容解析问题与协助和信息分享这组新模板标签', () => {
    const updates = parseWecomFollowUpTemplateUpdates(
      [
        '跟进内容：今天拜访了海航集团有限公司，确认续签范围。',
        '问题与协助：客户审批卡住，需要销售总监协助推动。',
        '拜访计划：下周二与售前一起复访。',
        '信息分享：客户对交付周期比价格更敏感。',
      ].join('\n'),
    );

    expect(updates).toMatchObject({
      followUpContent: '今天拜访了海航集团有限公司，确认续签范围。',
      helpNeeded: '客户审批卡住，需要销售总监协助推动。',
      visitPlan: '下周二与售前一起复访。',
      informationShare: '客户对交付周期比价格更敏感。',
    });
  });
});
