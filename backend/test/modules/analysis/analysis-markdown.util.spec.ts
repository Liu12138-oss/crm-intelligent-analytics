import {
  buildAnalysisDetailMarkdown,
  buildAnalysisGroundedMarkdown,
  buildAnalysisWecomMarkdown,
  buildAnalysisWorkbenchMarkdown,
} from '../../../src/modules/analysis/analysis-markdown.util';

describe('analysis markdown util', () => {
  function createRows(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      ownerName: `负责人${index + 1}`,
      amount: 1000 - index,
      count: index + 1,
    }));
  }

  it('企业微信 Markdown 应用表格展示详细排名结果且不再提示去 Web 查看', () => {
    const markdown = buildAnalysisWecomMarkdown({
      title: '商机数量排名报告',
      summary: '第一季度商机排名已生成。',
      groundedExplanation: '当前商机数量排名由负责人1领先。',
      metricCards: [{ name: '累计金额', value: '23,682,880.7' }],
      keyFindings: [{ title: '关键发现 1', detail: '负责人1当前领先。', tone: 'positive', datasetId: 'dataset_1' }],
      nextBestQuestions: ['第二名与第一名差距是多少？'],
      scopeSummary: '测试范围',
      recommendationSummaries: ['建议优先跟进负责人1名下高价值商机。'],
      rows: createRows(12),
      variant: 'ranking',
    });

    expect(markdown).toContain('### AI分析报告');
    expect(markdown).toContain('### 关键指标');
    expect(markdown).toContain('### 重点汇总');
    expect(markdown).toContain('### 经营建议');
    expect(markdown).toContain('建议优先跟进负责人1名下高价值商机');
    expect(markdown).toContain('### 已生成');
    expect(markdown).toContain('### 详细结果');
    expect(markdown).toContain('**1. 负责人1**');
    expect(markdown).toContain('> 金额：0.1 万元 ｜ 数量：1');
    expect(markdown).toContain('**10. 负责人10**');
    expect(markdown).toContain('结果较多，企微先展示前 10 条');
    expect(markdown).toContain('### 你可以继续回复');
    expect(markdown).toContain('「看前10」');
    expect(markdown).toContain('「看差距」');
    expect(markdown).not.toContain('负责人11');
    expect(markdown).not.toContain('完整结果请到 Web');
  });

  it('企业微信 Markdown 表格应使用中文业务列名并转义单元格分隔符', () => {
    const markdown = buildAnalysisWecomMarkdown({
      title: '商机明细',
      summary: '商机明细已生成。',
      metricCards: [],
      keyFindings: [],
      rows: [
        {
          customer_name: '山东｜测试客户',
          project_name: '桌管|扩容项目',
          stage_name: '30%有预算',
          owner_name: '王亮',
          expected_amount: 15,
        },
      ],
      variant: 'summary',
    });

    expect(markdown).toContain('**1. 山东｜测试客户**');
    expect(markdown).toContain('项目/商机：桌管｜扩容项目');
    expect(markdown).toContain('桌管｜扩容项目');
    expect(markdown).toContain('15 万元');
    expect(markdown).not.toContain('customer_name');
  });

  it('企微服务商聚合表应隐藏重复列并把有数量的零金额展示为未填金额', () => {
    const markdown = buildAnalysisWecomMarkdown({
      title: '新增商机金额渠道商贡献报告',
      summary: '最近三个月山东区域服务商商机贡献已生成。',
      metricCards: [
        { name: '累计商机金额', value: '15 万元' },
        { name: '命中商机数', value: 40 },
      ],
      keyFindings: [],
      rows: [
        {
          partnerName: '山东华安赛服智能科技有限公司',
          ownerName: '山东华安赛服智能科技有限公司',
          region: '山东区',
          partnerLevel: 'primary',
          amount: 100000,
          count: 8,
        },
        {
          partnerName: '山东凯航信息科技有限公司',
          ownerName: '山东凯航信息科技有限公司',
          region: '山东区',
          partnerLevel: 'secondary',
          amount: 0,
          count: 19,
        },
      ],
      variant: 'ranking',
    });

    expect(markdown).toContain('**1. 山东华安赛服智能科技有限公司**');
    expect(markdown).not.toContain('负责人');
    expect(markdown).toContain('**2. 山东凯航信息科技有限公司**');
    expect(markdown).toContain('合作等级：协作渠道');
    expect(markdown).toContain('金额：未填金额 ｜ 数量：19');
  });

  it('联软 P4/P5 企微展示应中文化漏斗字段、状态和合作等级', () => {
    const markdown = buildAnalysisWecomMarkdown({
      title: '报备到订单转化漏斗',
      summary: '当前权限范围内报备到订单转化漏斗已生成。',
      metricCards: [{ name: '有效订单转化率', value: '1.33%' }],
      keyFindings: [],
      rows: [
        {
          funnel_stage: '有效订单',
          stage_count: 2,
          stage_amount: 45450,
          conversion_rate: '11.76%',
          status: 'processing',
          partner_level: 'primary',
        },
      ],
      variant: 'summary',
    });

    expect(markdown).toContain('有效订单');
    expect(markdown).toContain('数量：2');
    expect(markdown).toContain('金额：4.54 万元');
    expect(markdown).toContain('转化率：11.76%');
    expect(markdown).toContain('状态：处理中');
    expect(markdown).not.toContain('funnel_stage');
    expect(markdown).not.toContain('processing');
  });

  it('企业微信 Markdown 应默认发送完整经营分析报告核心区块', () => {
    const markdown = buildAnalysisWecomMarkdown({
      title: '山东区域服务商商机分析',
      summary: '山东区域近三个月服务商商机贡献已生成。',
      metricCards: [
        { name: '累计商机金额', value: '15 万元' },
        { name: '命中商机数', value: 40 },
      ],
      keyFindings: [
        {
          title: '头部服务商贡献集中',
          detail: '山东华安赛服智能科技有限公司贡献 10 万元，位列第一。',
          tone: 'positive',
          datasetId: 'dataset_1',
        },
      ],
      forecastSummary: '下一周期金额预计在 12 万至 18 万之间。',
      riskSummaries: ['部分服务商存在商机数量较多但金额未填的情况。'],
      recommendationSummaries: [
        '优先核对未填金额服务商的商机质量与预计金额。',
        '围绕头部服务商安排下钻复盘。',
      ],
      rows: [
        {
          partnerName: '山东华安赛服智能科技有限公司',
          region: '山东区',
          amount: 100000,
          count: 8,
        },
      ],
      variant: 'distribution',
    });

    expect(markdown).toContain('### AI分析报告');
    expect(markdown).toContain('山东区域近三个月服务商商机贡献已生成。');
    expect(markdown).not.toContain('### 关键发现');
    expect(markdown).not.toContain('头部服务商贡献集中');
    expect(markdown).toContain('### 重点汇总');
    expect(markdown).toContain('山东华安赛服智能科技有限公司');
    expect(markdown).toContain('### 经营建议');
    expect(markdown).toContain('优先核对未填金额服务商');
    expect(markdown).toContain('### 风险提醒');
    expect(markdown).toContain('金额未填');
  });

  it('企业微信 Markdown 应展示报告区块且不再平铺统计口径，避免空喊图片或附件', () => {
    const markdown = buildAnalysisWecomMarkdown({
      title: '联软 CRM 经营简报',
      summary: '已生成联软 CRM 经营简报。',
      metricCards: [{ name: '客户报备数', value: 150 }],
      keyFindings: [],
      rows: [
        {
          section_name: '经营概览',
          section_summary: '客户、报备、商机、订单概览已生成。',
          row_count: 8,
        },
      ],
      secondaryViewSummaries: [
        { title: '经营简报区块总览', rowCount: 3, renderType: '表格' },
        { title: '报备到订单转化漏斗', rowCount: 4, renderType: '图表区块' },
        { title: '有报价但未下单客户明细', rowCount: 1, renderType: '表格' },
      ],
      appliedFilters: [
        { label: '数据来源', value: 'AI-agent 自建分析库' },
        { label: '统计口径', value: 'P4 多子任务经营简报' },
        { label: '权限范围', value: '全部数据范围' },
      ],
      variant: 'summary',
    });

    expect(markdown).toContain('### 报告区块');
    expect(markdown).toContain('经营简报区块总览：3 条，表格');
    expect(markdown).toContain('报备到订单转化漏斗：4 条，图表区块');
    expect(markdown).not.toContain('### 统计口径');
    expect(markdown).not.toContain('统计口径：P4 多子任务经营简报');
    expect(markdown).toContain('### 已生成');
    expect(markdown).toContain('结果预览表格');
    expect(markdown).not.toContain('图片版结果海报');
  });

  it('企业微信模板卡片优先模式应压缩文字并突出卡片摘要区块', () => {
    const markdown = buildAnalysisWecomMarkdown({
      title: '订单与商机分块分析',
      summary: '已按两个区块完成分析：订单情况和商机情况。',
      metricCards: [
        { name: '有效订单数量', value: 5 },
        { name: '有效订单金额', value: '78 万元' },
        { name: '商机数量', value: 20 },
        { name: '商机金额', value: '20 万元' },
        { name: '额外指标', value: 999 },
      ],
      keyFindings: [
        {
          title: '订单增长',
          detail: '订单增长较明显。',
          tone: 'positive',
          datasetId: 'dataset_1',
        },
      ],
      recommendationSummaries: ['建议继续跟进重点服务商。'],
      rows: [
        {
          section_name: '订单情况',
          section_summary: '有效订单 5 单。',
          row_count: 2,
        },
      ],
      secondaryViewSummaries: [
        { title: '订单情况（趋势/表格）', rowCount: 2, renderType: '图表区块' },
        { title: '商机情况（趋势/表格）', rowCount: 2, renderType: '图表区块' },
      ],
      appliedFilters: [{ label: '统计口径', value: '订单与商机独立汇总' }],
      variant: 'summary',
      preferImageAttachments: true,
    });

    expect(markdown).toContain('### 模板卡片摘要');
    expect(markdown).toContain('订单情况（趋势/表格）：2 条，图表区块');
    expect(markdown).toContain('商机情况（趋势/表格）：2 条，图表区块');
    expect(markdown).toContain('有效订单数量');
    expect(markdown).toContain('商机金额');
    expect(markdown).not.toContain('额外指标');
    expect(markdown).not.toContain('### 关键发现');
    expect(markdown).not.toContain('### 经营建议');
    expect(markdown).not.toContain('### 统计口径');
    expect(markdown).not.toContain('### 详细结果');
  });

  it('排名类 Markdown 最多展示前 20 条，少于 20 条时展示全部', () => {
    const markdown = buildAnalysisGroundedMarkdown({
      title: '商机数量排名报告',
      summary: '第一季度商机排名已生成。',
      metricCards: [],
      keyFindings: [],
      rows: createRows(25),
      variant: 'ranking',
    });

    expect(markdown).toContain('1. 负责人1');
    expect(markdown).toContain('20. 负责人20');
    expect(markdown).not.toContain('21. 负责人21');
  });

  it('Markdown 应展示统一时间口径，避免渠道侧重新推断时间范围', () => {
    const markdown = buildAnalysisGroundedMarkdown({
      title: '新增商机金额趋势分析',
      summary: '最近四个月新增商机金额趋势已生成。',
      metricCards: [],
      keyFindings: [],
      rows: [],
      variant: 'trend',
      temporalScope: {
        rawText: '最近四个月',
        normalizedLabel: '最近四个月',
        startAt: '2025-12-31T16:00:00.000Z',
        endAt: '2026-04-30T16:00:00.000Z',
        granularity: 'month',
        timezone: 'Asia/Shanghai',
        source: 'AI_TEMPORAL_SLOT',
      },
    });

    expect(markdown).toContain('## 时间口径');
    expect(markdown).toContain('最近四个月');
    expect(markdown).toContain('2025-12-31T16:00:00.000Z');
    expect(markdown).toContain('2026-04-30T16:00:00.000Z');
  });

  it('完整版与工作台版 Markdown 应体现趋势预测和经营建议的分层差异', () => {
    const payload = {
      title: '新增商机金额趋势分析',
      summary: '最近四个月新增商机金额趋势已生成。',
      groundedExplanation: '整体趋势上行，建议提前预排资源。',
      metricCards: [{ name: '累计金额', value: '565' }],
      keyFindings: [{ title: '趋势观察', detail: '最近一期继续抬升。', tone: 'positive' as const, datasetId: 'dataset_1' }],
      nextBestQuestions: ['继续比较区域差异'],
      scopeSummary: '测试范围',
      rows: createRows(4),
      variant: 'trend' as const,
      forecastSummary: '预计下一周期大概率落在 150 到 175 之间。',
      riskSummaries: ['样本长度有限，需结合下周期数据复核。'],
      recommendationSummaries: ['建议提前锁定头部项目推进节奏。'],
      evidenceSummary: '预测基于近四期趋势与最新一期权重提升。',
    };

    const detailMarkdown = buildAnalysisDetailMarkdown(payload);
    const workbenchMarkdown = buildAnalysisWorkbenchMarkdown(payload);

    expect(detailMarkdown).toContain('## 趋势预测');
    expect(detailMarkdown).toContain('## 经营建议');
    expect(detailMarkdown).toContain('## 结果依据');
    expect(workbenchMarkdown).toContain('## 趋势预测');
    expect(workbenchMarkdown).not.toContain('## 结果依据');
  });

  it('商机明细 Markdown 应使用业务字段生成详细结果，不能把预计金额显示为 --', () => {
    const markdown = buildAnalysisDetailMarkdown({
      title: '近一周新增商机明细',
      summary: '本周新增商机 2 笔。',
      metricCards: [{ name: '新增金额', value: 35 }],
      keyFindings: [],
      rows: [
        {
          team_name: '大北区-北区（政府企业）',
          customer_name: '宁波泰康脑科医院有限公司',
          project_name: '宁波泰康脑科医院准入桌管二期扩容',
          stage_name: '30%有预算且最认可',
          owner_name: '李威V',
          expected_amount: '15.00',
          expected_sign_date: '2026-09-30',
        },
      ],
      variant: 'summary',
    });

    expect(markdown).toContain('## 详细结果');
    expect(markdown).toContain('宁波泰康脑科医院有限公司');
    expect(markdown).toContain('宁波泰康脑科医院准入桌管二期扩容');
    expect(markdown).toContain('预计金额 15');
    expect(markdown).toContain('李威V');
    expect(markdown).not.toContain('：--');
  });
});
