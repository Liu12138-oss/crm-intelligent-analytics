import { buildAnalysisWecomMarkdown } from '../../../src/modules/analysis/analysis-markdown.util';

describe('analysis markdown governance notes', () => {
  it('template-card summary should not inline governance notes in WeCom Markdown', () => {
    const markdown = buildAnalysisWecomMarkdown({
      title: '最近一年商机情况',
      summary: '当前权限范围内共 41 条商机，金额 15 万元。',
      metricCards: [{ name: '商机数量', value: 41 }],
      keyFindings: [],
      rows: [{ month_label: '2026-05', opportunity_count: 10 }],
      appliedFilters: [
        { label: '时间口径', value: '最近一年' },
        { label: '有效商机', value: '排除赢单、输单、取消、审批中和 1% 初始接触' },
      ],
      sourceNotes: [
        {
          key: 'result-consistency',
          label: '结果一致性',
          description: '摘要、模板卡片、表格和 HTML 报告均复用同一结果包。',
        },
      ],
      footnotes: ['只读查询不使用企业微信写回内置账号。'],
      secondaryViewSummaries: [
        {
          title: '商机趋势图',
          rowCount: 12,
          renderType: '图表区块',
        },
      ],
      variant: 'trend',
      preferImageAttachments: true,
    });

    expect(markdown).toContain('### 模板卡片摘要');
    expect(markdown).not.toContain('### 统计口径');
    expect(markdown).not.toContain('时间口径：最近一年');
    expect(markdown).not.toContain('有效商机：排除赢单、输单、取消、审批中和 1% 初始接触');
    expect(markdown).not.toContain('结果一致性：摘要、模板卡片、表格和 HTML 报告均复用同一结果包。');
  });
});
