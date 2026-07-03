import { Injectable } from '@nestjs/common';
import type {
  AnalysisDatasetBundle,
  AnalysisDatasetSlice,
  AnalysisKeyFinding,
  AnalysisReportPayload,
  AnalysisReportSection,
  AnalysisReportVariant,
  AnalysisSourceNote,
  AnalysisWorkflowPlan,
  AvailableAction,
  MetricCard,
} from '../../shared/types/domain';
import { formatWanAmount } from '../../shared/utils/business-amount.util';
import { ResultAccuracyError } from './analysis.errors';
import { resolveCrmAnalysisQuestionTemplateRuleByText } from './crm-analysis-question-template.registry';
import { formatTemporalScopeLabel } from './temporal-scope.util';

type BusinessReportTemplate =
  | 'partner-development-operations'
  | 'channel-order-summary'
  | 'opportunity-default-summary';

interface OpportunitySummaryStats {
  opportunityCount: number;
  totalAmount: number;
  averageAmount: number;
  partnerCount: number;
  effectiveOpportunityCount: number;
}

const ORDER_AMOUNT_FIELD_KEYS = [
  'orderAmount',
  'order_amount',
  'contractAmount',
  'contract_amount',
  'totalAmount',
  'total_amount',
  'amount',
];

const ORDER_COUNT_FIELD_KEYS = [
  'orderCount',
  'order_count',
  'contractCount',
  'contract_count',
  'count',
];

const OPPORTUNITY_AMOUNT_FIELD_KEYS = [
  'opportunityAmount',
  'opportunity_amount',
  'amount',
  'expectedAmount',
  'expected_amount',
  'expectAmount',
  'expect_amount',
  'totalAmount',
  'total_amount',
];

const OPPORTUNITY_COUNT_FIELD_KEYS = [
  'opportunityCount',
  'opportunity_count',
  'count',
  'totalCount',
  'total_count',
];

const PARTNER_CONTRIBUTION_AMOUNT_FIELD_KEYS = [
  'orderAmount',
  'order_amount',
  'opportunityAmount',
  'opportunity_amount',
  'totalAmount',
  'total_amount',
  'totalAmt',
  'amount',
];

const PARTNER_CONTRIBUTION_MERGE_FIELD_KEYS = [
  'registrationCount',
  'registration_count',
  'registrationAmount',
  'registration_amount',
  'opportunityCount',
  'opportunity_count',
  'opportunityAmount',
  'opportunity_amount',
  'opportunityAmountText',
  'quoteCount',
  'quote_count',
  'quoteAmount',
  'quote_amount',
  'orderCount',
  'order_count',
  'orderAmount',
  'order_amount',
  'orderAmountText',
  'signedCount2026',
  'signed_count_2026',
  'signedAmount2026',
  'signed_amount_2026',
  'contractCount',
  'contract_count',
  'contractAmount',
  'contract_amount',
  'totalAmount',
  'total_amount',
  'totalAmt',
  'amount',
  'count',
] as const;

const MAINLAND_CHINA_PROVINCE_LABELS = [
  '北京',
  '天津',
  '河北',
  '山西',
  '内蒙古',
  '辽宁',
  '吉林',
  '黑龙江',
  '上海',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '重庆',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
];

const CHINA_PROVINCE_ALIASES: Array<{ province: string; aliases: string[] }> = [
  { province: '北京', aliases: ['北京'] },
  { province: '天津', aliases: ['天津'] },
  { province: '河北', aliases: ['河北', '石家庄', '唐山', '保定', '廊坊'] },
  { province: '山西', aliases: ['山西', '太原', '大同'] },
  { province: '内蒙古', aliases: ['内蒙古', '呼和浩特', '包头'] },
  { province: '辽宁', aliases: ['辽宁', '沈阳', '大连'] },
  { province: '吉林', aliases: ['吉林', '长春'] },
  { province: '黑龙江', aliases: ['黑龙江', '哈尔滨'] },
  { province: '上海', aliases: ['上海'] },
  { province: '江苏', aliases: ['江苏', '南京', '苏州', '无锡', '常州', '南通'] },
  { province: '浙江', aliases: ['浙江', '杭州', '宁波', '温州'] },
  { province: '安徽', aliases: ['安徽', '合肥'] },
  { province: '福建', aliases: ['福建', '福州', '厦门', '泉州'] },
  { province: '江西', aliases: ['江西', '南昌'] },
  { province: '山东', aliases: ['山东', '济南', '青岛', '烟台', '临沂', '淄博'] },
  { province: '河南', aliases: ['河南', '郑州', '洛阳'] },
  { province: '湖北', aliases: ['湖北', '武汉'] },
  { province: '湖南', aliases: ['湖南', '长沙'] },
  { province: '广东', aliases: ['广东', '广州', '深圳', '佛山', '东莞', '珠海'] },
  { province: '广西', aliases: ['广西', '南宁', '柳州'] },
  { province: '海南', aliases: ['海南', '海口'] },
  { province: '重庆', aliases: ['重庆'] },
  { province: '四川', aliases: ['四川', '成都'] },
  { province: '贵州', aliases: ['贵州', '贵阳'] },
  { province: '云南', aliases: ['云南', '昆明'] },
  { province: '西藏', aliases: ['西藏', '拉萨'] },
  { province: '陕西', aliases: ['陕西', '西安'] },
  { province: '甘肃', aliases: ['甘肃', '兰州'] },
  { province: '青海', aliases: ['青海', '西宁'] },
  { province: '宁夏', aliases: ['宁夏', '银川'] },
  { province: '新疆', aliases: ['新疆', '乌鲁木齐'] },
];

const PARTNER_LEVEL_DISPLAY_ORDER = [
  'LEP',
  '金牌',
  '签约技术',
  '提名',
  '一级渠道',
  '二级渠道',
  '未设置',
  '未填写等级',
];

const PARTNER_LEVEL_TABLE_COLUMNS = [
  { key: 'partnerLevel', label: '合作等级' },
  { key: 'partnerCount', label: '渠道商数' },
  { key: 'regionCount', label: '覆盖区域数' },
  { key: 'coveredRegions', label: '覆盖区域' },
  { key: 'amountText', label: '经营金额' },
  { key: 'shareText', label: '渠道商占比' },
];

const PARTNER_SYSTEM_TABLE_COLUMNS = [
  { key: 'bigRegionLabel', label: '大区' },
  { key: 'teamName', label: '团队' },
  { key: 'partnerTotalCount', label: '渠道商总数' },
  { key: 'lepCount', label: 'LEP' },
  { key: 'goldCount', label: '金牌' },
  { key: 'signedTechnicalCount', label: '签约技术' },
  { key: 'nominationCount', label: '提名' },
  { key: 'signedCount2026', label: '2026签约数' },
  { key: 'signedAmount2026Text', label: '2026签约额' },
  { key: 'nationalShareText', label: '占全国比' },
];

const OPPORTUNITY_PARTNER_RANKING_COLUMNS = [
  { key: 'rank', label: '排名' },
  { key: 'partner_name', label: '渠道商' },
  { key: 'opportunity_count', label: '商机数' },
  { key: 'opportunity_amount', label: '商机金额（万元）' },
  { key: 'shareText', label: '金额占比' },
];

const OPPORTUNITY_CONCENTRATION_COLUMNS = [
  { key: 'metric_name', label: '指标' },
  { key: 'partner_count', label: '渠道商数' },
  { key: 'opportunity_amount', label: '商机金额（万元）' },
  { key: 'shareText', label: '金额占比' },
  { key: 'metric_note', label: '说明' },
];

const OPPORTUNITY_PERIOD_COLUMNS = [
  { key: 'period_label', label: '周期' },
  { key: 'opportunity_count', label: '商机数' },
  { key: 'opportunity_amount', label: '商机金额（万元）' },
  { key: 'averageOpportunityAmountText', label: '平均商机金额' },
];

const OPPORTUNITY_DETAIL_COLUMNS = [
  { key: 'opportunity_name', label: '商机名称' },
  { key: 'customer_name', label: '客户' },
  { key: 'partner_name', label: '渠道商' },
  { key: 'stage_name', label: '销售阶段' },
  { key: 'amount', label: '商机金额（万元）' },
  { key: 'created_at', label: '创建时间' },
];

const OPPORTUNITY_LARGE_DEAL_COLUMNS = [
  ...OPPORTUNITY_DETAIL_COLUMNS,
  { key: 'largeDealReason', label: '大单判断' },
];

@Injectable()
export class AnalysisReportComposerService {
  compose(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): AnalysisReportPayload {
    if (datasetBundle.slices.length === 0) {
      throw new ResultAccuracyError('当前分析流程未生成任何可用数据集。');
    }

    const primarySlice = datasetBundle.slices[0];
    const isCompositeBusinessReport = this.isCompositeBusinessReport(workflow, datasetBundle);
    const businessReportTemplate = this.resolveBusinessReportTemplate(workflow, datasetBundle);
    const variant = isCompositeBusinessReport || businessReportTemplate ? 'summary' : this.resolveVariant(primarySlice);
    const metricCards = this.buildMetricCards(
      datasetBundle,
      variant,
      isCompositeBusinessReport,
      businessReportTemplate,
    );
    const keyFindings = this.buildKeyFindings(workflow, datasetBundle, variant);
    const sourceNotes = this.buildSourceNotes(workflow, datasetBundle, metricCards);
    const footnotes = this.buildFootnotes(datasetBundle);
    const sections = this.buildSections(
      workflow,
      datasetBundle,
      metricCards,
      keyFindings,
      sourceNotes,
      footnotes,
      variant,
      businessReportTemplate,
    );

    return {
      variant,
      reportTitle: this.resolveReportTitle(workflow, datasetBundle, businessReportTemplate),
      executiveSummary: this.buildExecutiveSummary(
        workflow,
        datasetBundle,
        variant,
        metricCards,
        businessReportTemplate,
      ),
      temporalScope: datasetBundle.temporalScope,
      keyFindings,
      metricCards,
      chartBlocks: this.buildChartBlocks(datasetBundle),
      tableBlocks: this.buildTableBlocks(datasetBundle, businessReportTemplate),
      sections,
      missingSections: datasetBundle.missingSections ?? [],
      datasetReferences: datasetBundle.slices.map((item) => ({
        datasetId: item.datasetId,
        taskId: item.taskId,
        taskTitle: item.taskTitle,
        purpose: item.purpose,
        rowCount: item.rowCount,
      })),
      scopeSummary: datasetBundle.scopeSummary,
      appliedFilters: datasetBundle.appliedFilters,
      sourceNotes,
      footnotes,
      explanation: `本次分析共执行 ${datasetBundle.slices.length} 个受控查询任务，所有结论均来自统一数据集与只读校验链路。`,
      emptyState: datasetBundle.totalRowCount === 0 ? '当前授权范围内无匹配数据。' : undefined,
      availableActions: this.buildAvailableActions(datasetBundle.totalRowCount > 0),
    };
  }

  private buildSections(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
    keyFindings: AnalysisKeyFinding[],
    sourceNotes: AnalysisSourceNote[],
    footnotes: string[],
    variant: AnalysisReportVariant,
    businessReportTemplate?: BusinessReportTemplate,
  ): AnalysisReportSection[] {
    const sections: AnalysisReportSection[] = [
      {
        sectionType: 'summary',
        title: '执行摘要',
        summary: this.buildExecutiveSummary(
          workflow,
          datasetBundle,
          variant,
          metricCards,
          businessReportTemplate,
        ),
        temporalScope: datasetBundle.temporalScope,
        footnotes,
      },
      {
        sectionType: 'metric-strip',
        title: '关键指标',
        metricCards,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
      },
    ];

    if (businessReportTemplate === 'partner-development-operations') {
      sections.push(
        ...this.buildPartnerDevelopmentOperationSections(datasetBundle, sourceNotes, footnotes),
      );
      return this.deduplicateSections(sections);
    }

    if (businessReportTemplate === 'channel-order-summary') {
      sections.push(
        ...this.buildChannelOrderSummarySections(datasetBundle, sourceNotes, footnotes),
      );
      return this.deduplicateSections(sections);
    }

    if (businessReportTemplate === 'opportunity-default-summary') {
      sections.push(
        ...this.buildOpportunityDefaultSummarySections(datasetBundle, sourceNotes, footnotes),
      );
      return this.deduplicateSections(sections);
    }

    for (const slice of datasetBundle.slices) {
      const section = this.buildSectionFromSlice(slice, datasetBundle.temporalScope, keyFindings);
      if (section) {
        sections.push(section);
      }
    }

    const focusSection = this.buildFocusSection(workflow, datasetBundle);
    if (focusSection) {
      sections.push(focusSection);
    }

    const detailSlice = datasetBundle.slices.find((item) => item.resultKind === 'owner-ranking') ??
      datasetBundle.slices[0];
    sections.push({
      sectionType: 'detail-table',
      title: '明细结果',
      datasetId: detailSlice?.datasetId,
      rows: detailSlice?.tableRows ?? [],
      temporalScope: datasetBundle.temporalScope,
      sourceNotes,
      footnotes,
    });

    sections.push({
      sectionType: 'actions',
      title: '行动建议',
      items: this.buildActionItems(workflow, datasetBundle),
      temporalScope: datasetBundle.temporalScope,
      footnotes,
    });

    return this.deduplicateSections(sections);
  }

  /**
   * 构造报告表格块。
   *
   * 参数说明：`datasetBundle` 为统一数据集包。
   * 返回值说明：返回主表和切片二级视图中的表格数据。
   * 调用注意事项：固定组合模板会把阶段分布、渠道商贡献、重点明细放在 `secondaryViews`，
   * 必须进入统一报告包，否则企业微信和公开 HTML 只能看到主表。
   */
  private buildTableBlocks(
    datasetBundle: AnalysisDatasetBundle,
    businessReportTemplate?: BusinessReportTemplate,
  ): AnalysisReportPayload['tableBlocks'] {
    if (businessReportTemplate === 'partner-development-operations') {
      return this.buildPartnerDevelopmentTableBlocks(datasetBundle);
    }

    if (businessReportTemplate === 'channel-order-summary') {
      return this.buildChannelOrderTableBlocks(datasetBundle);
    }

    if (businessReportTemplate === 'opportunity-default-summary') {
      return this.buildOpportunityDefaultSummaryTableBlocks(datasetBundle);
    }

    return this.deduplicateTableBlocks(datasetBundle.slices.flatMap((item) => {
      const primaryBlock = {
        blockId: `table-${item.datasetId}`,
        title: this.appendTemporalLabel(this.resolveDetailTableTitle(item.taskTitle), datasetBundle.temporalScope),
        rows: item.tableRows,
        datasetId: item.datasetId,
        temporalScope: datasetBundle.temporalScope,
      };
      const secondaryBlocks = item.secondaryViews
        .filter((view) => (view.rows?.length ?? 0) > 0)
        .filter((view) => view.rows !== item.tableRows)
        .map((view, index) => ({
          blockId: `table-${item.datasetId}-secondary-${index + 1}`,
          title: this.appendTemporalLabel(view.title, datasetBundle.temporalScope),
          rows: view.rows ?? [],
          columns: view.columns,
          datasetId: item.datasetId,
          temporalScope: datasetBundle.temporalScope,
        }));

      return [primaryBlock, ...secondaryBlocks];
    }));
  }

  /**
   * 构造报告图表块。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：返回主视图图表以及二级视图中带 `series` 的图表。
   * 调用注意事项：用户明确要求阶段分布、图表或看板时，相关图表可能来自二级视图，不能只读取主视图。
   */
  private buildChartBlocks(datasetBundle: AnalysisDatasetBundle): AnalysisReportPayload['chartBlocks'] {
    return datasetBundle.slices.flatMap((item) => {
      const primaryBlocks = item.primaryView?.series?.length
        ? [
            {
              blockId: `chart-${item.datasetId}`,
              title: this.appendTemporalLabel(
                item.primaryView.title ?? item.taskTitle,
                datasetBundle.temporalScope,
              ),
              viewType: item.primaryView.viewType,
              series: item.primaryView.series,
              datasetId: item.datasetId,
              temporalScope: datasetBundle.temporalScope,
            },
          ]
        : [];
      const secondaryBlocks = item.secondaryViews
        .filter((view) => (view.series?.length ?? 0) > 0)
        .map((view, index) => ({
          blockId: `chart-${item.datasetId}-secondary-${index + 1}`,
          title: this.appendTemporalLabel(view.title, datasetBundle.temporalScope),
          viewType: view.viewType,
          series: view.series ?? [],
          datasetId: item.datasetId,
          temporalScope: datasetBundle.temporalScope,
        }));

      return [...primaryBlocks, ...secondaryBlocks];
    });
  }

  /**
   * 生成明细表标题。
   *
   * 参数说明：`taskTitle` 为规划任务或执行切片标题。
   * 返回值说明：任务名已包含明细/清单时原样返回，否则追加“明细”。
   * 调用注意事项：避免“渠道商类型明细明细”这类重复标题出现在企微卡片和公开页面。
   */
  private resolveDetailTableTitle(taskTitle: string): string {
    return /(明细|清单|名单)$/u.test(taskTitle) ? taskTitle : `${taskTitle}明细`;
  }

  /**
   * 按“全国代理商发展运营数据看板”框架构造服务商发展运营报告区块。
   *
   * 参数说明：`datasetBundle` 为统一结果包，`sourceNotes/footnotes` 为统一口径说明。
   * 返回值说明：返回趋势、大区对比、省份覆盖、渠道体系和行动建议区块。
   * 调用注意事项：这里只重组已经拿到的 OpenAPI 结果，不新增取数、不使用模板中的示例数据；
   * 用户要求去掉的“技术服务人员 & 证书认证”区块不进入默认报告结构。
   */
  private buildPartnerDevelopmentOperationSections(
    datasetBundle: AnalysisDatasetBundle,
    sourceNotes: AnalysisSourceNote[],
    footnotes: string[],
  ): AnalysisReportSection[] {
    const rows = this.resolvePartnerDevelopmentRows(datasetBundle);
    const trendSlice = datasetBundle.slices.find((item) => item.resultKind === 'time-trend');
    const regionRows = this.buildRegionSummaryRows(rows);
    const coverageItems = this.buildPartnerCoverageItems(rows);
    const levelRows = this.buildPartnerLevelRows(rows);
    const coverageRows = this.buildPartnerCoverageRows(rows);
    const teamRows = this.buildPartnerSystemTeamRows(rows);

    return [
      {
        sectionType: 'trend',
        title: '近3年签约 & 商机趋势',
        datasetId: trendSlice?.datasetId,
        description: trendSlice
          ? trendSlice.summary
          : '当前结果包暂未包含多年度趋势数据，已按服务商发展运营看板保留趋势区块；补齐年度签约、订单或商机时间字段后可直接呈现。',
        series: trendSlice?.primaryView?.series ?? [],
        rows: trendSlice?.tableRows ?? [],
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'distribution',
        title: '大区签约额对比（万元）',
        description: regionRows.length
          ? '按区域或大区汇总服务商相关经营结果，用于观察区域覆盖和经营贡献差异。'
          : '当前结果未返回区域字段，暂以服务商明细承接该区块。',
        rows: regionRows.length ? regionRows : teamRows.slice(0, 10),
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'distribution',
        title: '合作等级明细',
        description: levelRows.length
          ? '按当前结果包中已有合作等级拆解渠道商数量、覆盖区域和经营贡献。'
          : '当前结果未返回合作等级字段，暂无法拆解等级明细。',
        rows: levelRows,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'focus-list',
        title: '省份代理商覆盖情况',
        items: coverageItems,
        rows: coverageRows,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'detail-table',
        title: '渠道商体系明细（按团队）',
        rows: teamRows,
        datasetId: datasetBundle.slices[0]?.datasetId,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'actions',
        title: '运营建议',
        items: this.buildPartnerDevelopmentActions(rows, regionRows),
        temporalScope: datasetBundle.temporalScope,
        footnotes,
      },
    ];
  }

  /**
   * 按“渠道商下单汇总分析报告”框架构造订单报告区块。
   *
   * 参数说明：`datasetBundle` 为统一结果包，`sourceNotes/footnotes` 为统一口径说明。
   * 返回值说明：返回集中度、年度趋势、TOP 排名、分段明细、全量排名和订单明细区块。
   * 调用注意事项：框架来自用户给定 HTML，但数据只来自当前 OpenAPI 分析结果包。
   */
  private buildChannelOrderSummarySections(
    datasetBundle: AnalysisDatasetBundle,
    sourceNotes: AnalysisSourceNote[],
    footnotes: string[],
  ): AnalysisReportSection[] {
    const rows = this.resolveChannelOrderRows(datasetBundle);
    const rankedRows = this.rankRowsByAmount(rows, ORDER_AMOUNT_FIELD_KEYS);
    const trendSlice = datasetBundle.slices.find((item) => item.resultKind === 'time-trend');
    const concentrationRows = this.buildOrderConcentrationRows(rankedRows);

    return [
      {
        sectionType: 'distribution',
        title: '渠道集中度分析',
        description: '按订单金额排名计算 TOP 渠道集中度、长尾渠道占比和头部渠道贡献。',
        rows: concentrationRows,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'trend',
        title: '渠道下单年度趋势',
        datasetId: trendSlice?.datasetId,
        description: trendSlice
          ? trendSlice.summary
          : '当前结果包暂未包含年度趋势数据，已按渠道下单汇总模板保留趋势区块；补齐订单签约时间聚合后可直接呈现。',
        series: trendSlice?.primaryView?.series ?? [],
        rows: trendSlice?.tableRows ?? [],
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'detail-table',
        title: '渠道下单排名 TOP 10',
        rows: rankedRows.slice(0, 10),
        datasetId: datasetBundle.slices[0]?.datasetId,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'detail-table',
        title: 'TOP 30 渠道分年下单明细',
        rows: rankedRows.slice(0, 30),
        datasetId: datasetBundle.slices[0]?.datasetId,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'detail-table',
        title: `全部 ${rankedRows.length} 家渠道排名`,
        rows: rankedRows,
        datasetId: datasetBundle.slices[0]?.datasetId,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'detail-table',
        title: `订单明细清单（共 ${rows.length} 条）`,
        rows,
        datasetId: datasetBundle.slices[0]?.datasetId,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'actions',
        title: '经营建议',
        items: this.buildChannelOrderActions(rankedRows, concentrationRows),
        temporalScope: datasetBundle.temporalScope,
        footnotes,
      },
    ];
  }

  /**
   * 构造服务商发展运营模板的表格块。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：优先返回渠道体系明细，匹配服务商发展运营看板结构。
   */
  private buildPartnerDevelopmentTableBlocks(
    datasetBundle: AnalysisDatasetBundle,
  ): AnalysisReportPayload['tableBlocks'] {
    const rows = this.resolvePartnerDevelopmentRows(datasetBundle);
    const levelRows = this.buildPartnerLevelRows(rows);
    const teamRows = this.buildPartnerSystemTeamRows(rows);
    const datasetId = datasetBundle.slices[0]?.datasetId ?? 'partner-development-template';

    return [
      {
        blockId: 'table-partner-development-levels',
        title: this.appendTemporalLabel('合作等级明细', datasetBundle.temporalScope),
        rows: levelRows,
        columns: PARTNER_LEVEL_TABLE_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-partner-development-system',
        title: this.appendTemporalLabel('渠道商体系明细（按团队）', datasetBundle.temporalScope),
        rows: teamRows,
        columns: PARTNER_SYSTEM_TABLE_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
    ];
  }

  /**
   * 构造订单汇总模板的表格块。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：按渠道下单汇总 HTML 的顺序返回 TOP10、TOP30、全部渠道和订单明细。
   */
  private buildChannelOrderTableBlocks(
    datasetBundle: AnalysisDatasetBundle,
  ): AnalysisReportPayload['tableBlocks'] {
    const rows = this.resolveChannelOrderRows(datasetBundle);
    const rankedRows = this.rankRowsByAmount(rows, ORDER_AMOUNT_FIELD_KEYS);
    const datasetId = datasetBundle.slices[0]?.datasetId ?? 'channel-order-template';

    return [
      {
        blockId: 'table-channel-order-top10',
        title: this.appendTemporalLabel('渠道下单排名 TOP 10', datasetBundle.temporalScope),
        rows: rankedRows.slice(0, 10),
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-channel-order-top30-yearly',
        title: this.appendTemporalLabel('TOP 30 渠道分年下单明细', datasetBundle.temporalScope),
        rows: rankedRows.slice(0, 30),
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-channel-order-all-ranking',
        title: this.appendTemporalLabel(`全部 ${rankedRows.length} 家渠道排名`, datasetBundle.temporalScope),
        rows: rankedRows,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-channel-order-order-detail',
        title: this.appendTemporalLabel(`订单明细清单（共 ${rows.length} 条）`, datasetBundle.temporalScope),
        rows,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
    ];
  }

  /**
   * 构造商机默认分析模板的报告区块。
   *
   * 参数说明：`datasetBundle` 为统一结果包，`sourceNotes/footnotes` 为统一口径说明。
   * 返回值说明：返回集中度、年度/半年度趋势、大单和经营建议区块。
   * 调用注意事项：该模板只重组真实结果行，用户明确要求阶段分布、排行或明细时不强套。
   */
  private buildOpportunityDefaultSummarySections(
    datasetBundle: AnalysisDatasetBundle,
    sourceNotes: AnalysisSourceNote[],
    footnotes: string[],
  ): AnalysisReportSection[] {
    const partnerRows = this.buildOpportunityPartnerRankingRows(datasetBundle);
    const detailRows = this.buildOpportunityDetailRows(datasetBundle);
    const stats = this.buildOpportunitySummaryStats(datasetBundle, partnerRows, detailRows);
    const concentrationRows = this.buildOpportunityConcentrationRows(partnerRows, stats.totalAmount);
    const largeDealRows = this.buildOpportunityLargeDealRows(detailRows, stats.averageAmount);
    const annualRows = this.buildOpportunityPeriodRows(detailRows, 'year');
    const halfYearRows = this.buildOpportunityPeriodRows(detailRows, 'half-year');

    return [
      {
        sectionType: 'distribution',
        title: '头部集中度与长尾效应',
        description: '按渠道商商机金额计算 TOP5、TOP10、TOP20 和 TOP20 以外长尾贡献。',
        rows: concentrationRows,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'trend',
        title: '渠道商机年度分析',
        description: annualRows.length
          ? '按商机创建时间聚合年度商机数量、商机金额和平均商机金额。'
          : '当前商机明细未返回可识别创建时间，暂无法生成年度分析。',
        rows: annualRows,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'trend',
        title: '渠道商机半年度分析',
        description: halfYearRows.length
          ? '按商机创建时间聚合上半年/下半年商机数量、商机金额和平均商机金额。'
          : '当前商机明细未返回可识别创建时间，暂无法生成半年度分析。',
        rows: halfYearRows,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'detail-table',
        title: '商机大单',
        description: '优先展示金额不低于平均商机金额 2 倍的大单；不足时展示金额前 10 的商机。',
        rows: largeDealRows,
        datasetId: datasetBundle.slices[0]?.datasetId,
        temporalScope: datasetBundle.temporalScope,
        sourceNotes,
        footnotes,
      },
      {
        sectionType: 'actions',
        title: '经营建议',
        items: this.buildOpportunityDefaultActions(partnerRows, concentrationRows, largeDealRows),
        temporalScope: datasetBundle.temporalScope,
        footnotes,
      },
    ];
  }

  /**
   * 构造商机默认分析模板的表格块。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：返回渠道 TOP 榜、集中度、趋势、大单、TOP10 商机和非取消明细。
   */
  private buildOpportunityDefaultSummaryTableBlocks(
    datasetBundle: AnalysisDatasetBundle,
  ): AnalysisReportPayload['tableBlocks'] {
    const partnerRows = this.buildOpportunityPartnerRankingRows(datasetBundle);
    const detailRows = this.buildOpportunityDetailRows(datasetBundle);
    const stats = this.buildOpportunitySummaryStats(datasetBundle, partnerRows, detailRows);
    const datasetId = datasetBundle.slices[0]?.datasetId ?? 'opportunity-default-summary';
    const nonCancelledRows = detailRows.filter((row) => !this.isCancelledOpportunityRow(row));
    const blocks: AnalysisReportPayload['tableBlocks'] = [
      {
        blockId: 'table-opportunity-partner-top5',
        title: this.appendTemporalLabel('渠道商机金额 TOP5', datasetBundle.temporalScope),
        rows: partnerRows.slice(0, 5),
        columns: OPPORTUNITY_PARTNER_RANKING_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-opportunity-partner-top10',
        title: this.appendTemporalLabel('渠道商机金额 TOP10', datasetBundle.temporalScope),
        rows: partnerRows.slice(0, 10),
        columns: OPPORTUNITY_PARTNER_RANKING_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-opportunity-partner-top20',
        title: this.appendTemporalLabel('渠道商机金额 TOP20', datasetBundle.temporalScope),
        rows: partnerRows.slice(0, 20),
        columns: OPPORTUNITY_PARTNER_RANKING_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-opportunity-concentration',
        title: this.appendTemporalLabel('头部集中度与长尾效应', datasetBundle.temporalScope),
        rows: this.buildOpportunityConcentrationRows(partnerRows, stats.totalAmount),
        columns: OPPORTUNITY_CONCENTRATION_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-opportunity-large-deals',
        title: this.appendTemporalLabel('商机大单', datasetBundle.temporalScope),
        rows: this.buildOpportunityLargeDealRows(detailRows, stats.averageAmount),
        columns: OPPORTUNITY_LARGE_DEAL_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-opportunity-yearly',
        title: this.appendTemporalLabel('渠道商机年度分析', datasetBundle.temporalScope),
        rows: this.buildOpportunityPeriodRows(detailRows, 'year'),
        columns: OPPORTUNITY_PERIOD_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-opportunity-half-year',
        title: this.appendTemporalLabel('渠道商机半年度分析', datasetBundle.temporalScope),
        rows: this.buildOpportunityPeriodRows(detailRows, 'half-year'),
        columns: OPPORTUNITY_PERIOD_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-opportunity-top10-detail',
        title: this.appendTemporalLabel('TOP10商机明细', datasetBundle.temporalScope),
        rows: detailRows.slice(0, 10),
        columns: OPPORTUNITY_DETAIL_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
      {
        blockId: 'table-opportunity-effective-detail',
        title: this.appendTemporalLabel(`非取消商机明细（共 ${nonCancelledRows.length} 条）`, datasetBundle.temporalScope),
        rows: nonCancelledRows,
        columns: OPPORTUNITY_DETAIL_COLUMNS,
        datasetId,
        temporalScope: datasetBundle.temporalScope,
      },
    ];

    return this.deduplicateTableBlocks(blocks.filter((item) => item.rows.length > 0));
  }

  /**
   * 从结果包提取模板可复用明细行。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：优先使用非汇总切片的明细行，避免把单行总览当成排行榜。
   */
  private resolveTemplateRows(
    datasetBundle: AnalysisDatasetBundle,
    preferredViewTitlePattern?: RegExp,
  ): Array<Record<string, unknown>> {
    const preferredSecondaryRows = preferredViewTitlePattern
      ? datasetBundle.slices.flatMap((slice) =>
          slice.secondaryViews
            .filter((view) => preferredViewTitlePattern.test(view.title))
            .flatMap((view) => view.rows ?? []),
        )
      : [];
    if (preferredSecondaryRows.length > 0) {
      return preferredSecondaryRows;
    }

    const preferredRows = datasetBundle.slices
      .filter((slice) => slice.resultKind !== 'metric-summary' && slice.resultKind !== 'time-trend')
      .flatMap((slice) => slice.tableRows);
    if (preferredRows.length > 0) {
      return preferredRows;
    }

    const rows = datasetBundle.slices
      .filter((slice) => slice.resultKind !== 'metric-summary' || slice.tableRows.length > 1)
      .filter((slice) => slice.resultKind !== 'time-trend')
      .flatMap((slice) => slice.tableRows);
    if (rows.length > 0) {
      return rows;
    }

    return datasetBundle.mergedRows.length
      ? datasetBundle.mergedRows
      : datasetBundle.slices.flatMap((slice) => slice.tableRows);
  }

  /**
   * 提取服务商发展运营模板的真实明细行。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：优先返回 OpenAPI 业务链二级视图中的合作伙伴或渠道商贡献明细。
   * 调用注意事项：业务链快照主表只有四个经营区块汇总，不能直接当成渠道商体系明细。
   */
  private resolvePartnerDevelopmentRows(
    datasetBundle: AnalysisDatasetBundle,
  ): Array<Record<string, unknown>> {
    const profileRows = this.resolvePartnerProfileRows(datasetBundle);
    const contributionRows = this.resolvePartnerContributionRows(datasetBundle);
    if (profileRows.length === 0) {
      return contributionRows;
    }
    if (contributionRows.length === 0) {
      return profileRows;
    }

    return this.mergePartnerProfileAndContributionRows(profileRows, contributionRows);
  }

  /**
   * 提取服务商发展运营模板的合作伙伴档案行。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：返回合作伙伴、渠道商体系或服务商画像明细，用于规模、等级和区域覆盖。
   * 调用注意事项：档案行通常不含商机/订单贡献金额，不能单独承担经营指标计算。
   */
  private resolvePartnerProfileRows(
    datasetBundle: AnalysisDatasetBundle,
  ): Array<Record<string, unknown>> {
    return this.resolveTemplateRows(
      datasetBundle,
      /合作伙伴明细|渠道商体系|服务商/u,
    );
  }

  /**
   * 提取服务商发展运营模板的渠道商经营贡献行。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：返回按渠道商聚合的报备、商机和订单贡献行。
   * 调用注意事项：贡献行负责金额和签约数；缺少区域/等级时必须回填到合作伙伴档案后再展示。
   */
  private resolvePartnerContributionRows(
    datasetBundle: AnalysisDatasetBundle,
  ): Array<Record<string, unknown>> {
    return this.resolveTemplateRows(
      datasetBundle,
      /渠道商经营贡献汇总|订单金额渠道商贡献|商机渠道商贡献|渠道商机金额排名/u,
    );
  }

  /**
   * 合并合作伙伴档案和渠道商经营贡献。
   *
   * 参数说明：`profileRows` 为合作伙伴档案行，`contributionRows` 为渠道商贡献聚合行。
   * 返回值说明：返回一行一个渠道商的看板明细，档案字段优先，金额和数量字段使用贡献表。
   * 调用注意事项：这里只按渠道商 ID/名称匹配，不生成虚拟渠道商，避免企微结果出现占位假数据。
   */
  private mergePartnerProfileAndContributionRows(
    profileRows: Array<Record<string, unknown>>,
    contributionRows: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const contributionBuckets: Array<{ row: Record<string, unknown>; matched: boolean }> = [];
    const contributionBucketByKey = new Map<string, { row: Record<string, unknown>; matched: boolean }>();

    contributionRows.forEach((row, index) => {
      const keys = this.resolvePartnerMergeKeys(row, index);
      let bucket = keys.map((key) => contributionBucketByKey.get(key)).find(Boolean);
      if (!bucket) {
        bucket = { row: { ...row }, matched: false };
        contributionBuckets.push(bucket);
      } else {
        bucket.row = this.mergeDuplicatePartnerContributionRow(bucket.row, row);
      }

      keys.forEach((key) => contributionBucketByKey.set(key, bucket!));
    });

    const mergedProfileRows = profileRows.map((row, index) => {
      const bucket = this.resolvePartnerMergeKeys(row, index)
        .map((key) => contributionBucketByKey.get(key))
        .find(Boolean);
      if (!bucket) {
        return row;
      }

      bucket.matched = true;
      return this.mergePartnerContributionIntoProfile(row, bucket.row);
    });

    return [
      ...mergedProfileRows,
      ...contributionBuckets.filter((bucket) => !bucket.matched).map((bucket) => bucket.row),
    ];
  }

  /**
   * 合并同一渠道商的多条贡献记录。
   *
   * 参数说明：`target/source` 为同一渠道商在不同视图中的贡献行。
   * 返回值说明：返回累计数量和金额后的贡献行。
   * 调用注意事项：只有贡献字段白名单会累加，文本字段只在目标缺失时补齐，避免覆盖真实档案名称。
   */
  private mergeDuplicatePartnerContributionRow(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (PARTNER_CONTRIBUTION_MERGE_FIELD_KEYS.includes(key as typeof PARTNER_CONTRIBUTION_MERGE_FIELD_KEYS[number])) {
        merged[key] = this.toFiniteNumber(merged[key]) + this.toFiniteNumber(value);
        continue;
      }

      if (merged[key] === undefined || merged[key] === '') {
        merged[key] = value;
      }
    }

    merged.amount = this.resolvePartnerContributionAmount(merged);
    return merged;
  }

  /**
   * 把贡献表指标回填到合作伙伴档案行。
   *
   * 参数说明：`profileRow` 为合作伙伴档案，`contributionRow` 为同一渠道商贡献聚合。
   * 返回值说明：返回保留档案字段、补齐经营贡献字段的行。
   * 调用注意事项：档案字段优先，经营字段优先用贡献表，保证等级/区域和金额来自各自可信来源。
   */
  private mergePartnerContributionIntoProfile(
    profileRow: Record<string, unknown>,
    contributionRow: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged = { ...profileRow };
    for (const [key, value] of Object.entries(contributionRow)) {
      if (PARTNER_CONTRIBUTION_MERGE_FIELD_KEYS.includes(key as typeof PARTNER_CONTRIBUTION_MERGE_FIELD_KEYS[number])) {
        merged[key] = value;
        continue;
      }

      if (merged[key] === undefined || merged[key] === '') {
        merged[key] = value;
      }
    }

    merged.amount = this.resolvePartnerContributionAmount(merged);
    return merged;
  }

  /**
   * 生成渠道商合并键。
   *
   * 参数说明：`row` 为档案行或贡献行，`index` 为当前序号，仅用于保持调用签名稳定。
   * 返回值说明：返回去重后的 ID、编码、名称匹配键。
   * 调用注意事项：没有真实身份字段时返回空数组，避免按行号把不同渠道商误合并。
   */
  private resolvePartnerMergeKeys(row: Record<string, unknown>, _index: number): string[] {
    void _index;
    const values = [
      row.partnerId,
      row.partner_id,
      row.partnerCode,
      row.partner_code,
      row.code,
      row.partnerName,
      row.partner_name,
      row.partner,
      row.ownerName,
      row.owner_name,
      row.bucket_label,
      row.name,
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);

    return [...new Set(values.map((value) => value.toLocaleLowerCase('zh-CN')))];
  }

  /**
   * 提取渠道下单汇总模板的真实明细行。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：优先返回订单或渠道下单相关明细，缺失时再回到主表。
   */
  private resolveChannelOrderRows(
    datasetBundle: AnalysisDatasetBundle,
  ): Array<Record<string, unknown>> {
    return this.resolveTemplateRows(
      datasetBundle,
      /订单金额渠道商贡献|渠道下单|订单明细|合同明细|渠道商经营贡献汇总/u,
    );
  }

  /**
   * 构造商机渠道商金额排名行。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：优先读取商机渠道商贡献视图，并补充排名、金额占比和标准字段。
   * 调用注意事项：只使用结果包已有真实数据，不根据模板补虚拟渠道商。
   */
  private buildOpportunityPartnerRankingRows(datasetBundle: AnalysisDatasetBundle): Array<Record<string, unknown>> {
    const rows = this.resolveOpportunityPartnerRows(datasetBundle);
    const totalAmount = rows.reduce((sum, row) => sum + this.resolveOpportunityAmount(row), 0);
    return [...rows]
      .sort((left, right) =>
        this.resolveOpportunityAmount(right) - this.resolveOpportunityAmount(left) ||
        this.resolveOpportunityCount(right) - this.resolveOpportunityCount(left),
      )
      .map((row, index) => {
        const opportunityAmount = this.resolveOpportunityAmount(row);
        return {
          rank: index + 1,
          partner_id: row.partner_id ?? row.partnerId ?? '',
          partner_name: this.resolveOpportunityPartnerName(row),
          opportunity_count: this.resolveOpportunityCount(row),
          opportunity_amount: opportunityAmount,
          customer_count: this.toFiniteNumber(row.customer_count ?? row.customerCount ?? 0),
          shareText: totalAmount > 0 ? `${((opportunityAmount / totalAmount) * 100).toFixed(1)}%` : '0.0%',
        };
      });
  }

  /**
   * 提取商机渠道商贡献行。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：优先读取二级视图中的商机渠道商贡献，其次读取 `partner-contribution` 切片主表。
   */
  private resolveOpportunityPartnerRows(datasetBundle: AnalysisDatasetBundle): Array<Record<string, unknown>> {
    const secondaryRows = datasetBundle.slices.flatMap((slice) =>
      slice.secondaryViews
        .filter((view) => /商机渠道商|渠道商贡献|渠道商维度/u.test(view.title))
        .flatMap((view) => view.rows ?? []),
    );
    if (secondaryRows.length > 0) {
      return secondaryRows;
    }

    return datasetBundle.slices
      .filter((slice) => slice.resultKind === 'partner-contribution')
      .flatMap((slice) => slice.tableRows);
  }

  /**
   * 提取并标准化商机明细行。
   *
   * 参数说明：`datasetBundle` 为统一结果包。
   * 返回值说明：返回按商机金额倒序排列的真实商机明细。
   * 调用注意事项：明细只来自执行层已经返回的 OpenAPI/SQLite 只读结果。
   */
  private buildOpportunityDetailRows(datasetBundle: AnalysisDatasetBundle): Array<Record<string, unknown>> {
    const rows = datasetBundle.slices.flatMap((slice) =>
      slice.secondaryViews
        .filter((view) => /重点商机明细|商机明细|机会明细/u.test(view.title))
        .flatMap((view) => view.rows ?? []),
    );

    return rows
      .map((row) => this.normalizeOpportunityDetailRow(row))
      .sort((left, right) => this.resolveOpportunityAmount(right) - this.resolveOpportunityAmount(left));
  }

  /**
   * 标准化商机明细展示字段。
   *
   * 参数说明：`row` 为执行层返回的商机明细行。
   * 返回值说明：返回统一字段名，便于公开页、企微卡片和导出共用。
   */
  private normalizeOpportunityDetailRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
      ...row,
      opportunity_id: row.opportunity_id ?? row.opportunityId ?? '',
      opportunity_name:
        row.opportunity_name ?? row.opportunityName ?? row.project_name ?? row.projectName ?? row.name ?? row.title ?? '未命名商机',
      customer_name: row.customer_name ?? row.customerName ?? row.customer ?? '',
      partner_name: row.partner_name ?? row.partnerName ?? row.partner ?? '',
      owner_name: row.owner_name ?? row.ownerName ?? row.owner ?? '',
      stage_name: row.stage_name ?? row.stageName ?? row.stage ?? row.statusName ?? row.status_name ?? row.status ?? '',
      amount: this.resolveOpportunityAmount(row),
      created_at: row.created_at ?? row.createdAt ?? row.createTime ?? row.create_time ?? '',
    };
  }

  /**
   * 汇总商机默认模板指标。
   *
   * 参数说明：`datasetBundle` 为统一结果包，`partnerRows/detailRows` 为已标准化排名和明细。
   * 返回值说明：返回商机数量、金额、平均金额、渠道商数和非取消商机数。
   */
  private buildOpportunitySummaryStats(
    datasetBundle: AnalysisDatasetBundle,
    partnerRows: Array<Record<string, unknown>>,
    detailRows: Array<Record<string, unknown>>,
  ): OpportunitySummaryStats {
    const totalAmountFromPartners = partnerRows.reduce((sum, row) => sum + this.resolveOpportunityAmount(row), 0);
    const countFromPartners = partnerRows.reduce((sum, row) => sum + this.resolveOpportunityCount(row), 0);
    const totalAmountFromDetails = detailRows.reduce((sum, row) => sum + this.resolveOpportunityAmount(row), 0);
    const metricAmount = this.resolveMetricCardNumber(datasetBundle, /商机金额|新增商机金额|累计商机金额/u);
    const metricCount = this.resolveMetricCardNumber(datasetBundle, /商机数|商机数量|命中商机数|新增商机数/u);
    const totalAmount = totalAmountFromPartners || totalAmountFromDetails || metricAmount;
    const opportunityCount = countFromPartners || detailRows.length || metricCount;
    const averageAmount = opportunityCount > 0 ? totalAmount / opportunityCount : 0;
    return {
      opportunityCount,
      totalAmount,
      averageAmount,
      partnerCount: partnerRows.length,
      effectiveOpportunityCount: detailRows.filter((row) => !this.isCancelledOpportunityRow(row)).length || opportunityCount,
    };
  }

  /**
   * 从指标卡读取数值。
   *
   * 参数说明：`datasetBundle` 为统一结果包，`namePattern` 为指标名匹配规则。
   * 返回值说明：命中时返回可计算数字，未命中返回 0。
   */
  private resolveMetricCardNumber(datasetBundle: AnalysisDatasetBundle, namePattern: RegExp): number {
    const metricCard = datasetBundle.slices
      .flatMap((slice) => slice.metricCards)
      .find((item) => namePattern.test(item.name));
    return metricCard ? this.toFiniteNumber(metricCard.value) : 0;
  }

  /**
   * 构造商机集中度和长尾效应指标。
   *
   * 参数说明：`rankedRows` 为渠道商机金额排名，`totalAmount` 为商机总金额。
   * 返回值说明：返回 TOP5、TOP10、TOP20 和 TOP20 以外长尾贡献。
   */
  private buildOpportunityConcentrationRows(
    rankedRows: Array<Record<string, unknown>>,
    totalAmount: number,
  ): Array<Record<string, unknown>> {
    const buildTopRow = (limit: number): Record<string, unknown> => {
      const rows = rankedRows.slice(0, limit);
      const amount = rows.reduce((sum, row) => sum + this.resolveOpportunityAmount(row), 0);
      return {
        metric_name: `TOP${limit}渠道商机金额`,
        partner_count: rows.length,
        opportunity_amount: amount,
        shareText: totalAmount > 0 ? `${((amount / totalAmount) * 100).toFixed(1)}%` : '0.0%',
        metric_note: `金额排名前 ${limit} 的渠道商合计贡献`,
      };
    };
    const longTailRows = rankedRows.slice(20);
    const longTailAmount = longTailRows.reduce((sum, row) => sum + this.resolveOpportunityAmount(row), 0);
    return [
      buildTopRow(5),
      buildTopRow(10),
      buildTopRow(20),
      {
        metric_name: '长尾效应（TOP20以外）',
        partner_count: longTailRows.length,
        opportunity_amount: longTailAmount,
        shareText: totalAmount > 0 ? `${((longTailAmount / totalAmount) * 100).toFixed(1)}%` : '0.0%',
        metric_note: longTailRows.length > 0
          ? 'TOP20 以外渠道商的商机金额贡献'
          : '当前渠道数量不超过 20 家，暂未形成 TOP20 以外长尾',
      },
    ];
  }

  /**
   * 构造商机大单明细。
   *
   * 参数说明：`detailRows` 为商机明细，`averageAmount` 为平均商机金额。
   * 返回值说明：优先返回金额不低于均值 2 倍的商机，不足时返回金额前 10。
   */
  private buildOpportunityLargeDealRows(
    detailRows: Array<Record<string, unknown>>,
    averageAmount: number,
  ): Array<Record<string, unknown>> {
    const threshold = averageAmount > 0 ? averageAmount * 2 : 0;
    const largeRows = detailRows.filter((row) => this.resolveOpportunityAmount(row) >= threshold && this.resolveOpportunityAmount(row) > 0);
    const sourceRows = largeRows.length > 0 ? largeRows : detailRows.slice(0, 10);
    return sourceRows.map((row) => ({
      ...row,
      largeDealReason: largeRows.length > 0
        ? `金额不低于平均商机金额 2 倍（${formatWanAmount(threshold)}）`
        : '当前未形成 2 倍均值大单，按金额前 10 展示',
    }));
  }

  /**
   * 构造商机年度或半年度分析。
   *
   * 参数说明：`detailRows` 为商机明细，`granularity` 为年度或半年度。
   * 返回值说明：返回按创建时间聚合的商机数量、金额和平均金额。
   */
  private buildOpportunityPeriodRows(
    detailRows: Array<Record<string, unknown>>,
    granularity: 'year' | 'half-year',
  ): Array<Record<string, unknown>> {
    const periodMap = new Map<string, { count: number; amount: number }>();
    for (const row of detailRows) {
      const date = this.resolveOpportunityCreatedDate(row);
      if (!date) {
        continue;
      }

      const year = date.getFullYear();
      const label = granularity === 'year'
        ? `${year}年`
        : `${year}${date.getMonth() < 6 ? '上半年' : '下半年'}`;
      const current = periodMap.get(label) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += this.resolveOpportunityAmount(row);
      periodMap.set(label, current);
    }

    return [...periodMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0], 'zh-CN'))
      .map(([periodLabel, value]) => ({
        period_label: periodLabel,
        opportunity_count: value.count,
        opportunity_amount: value.amount,
        averageOpportunityAmountText: value.count > 0 ? formatWanAmount(value.amount / value.count) : '0 万元',
      }));
  }

  /**
   * 构造商机默认模板经营建议。
   *
   * 参数说明：`partnerRows/concentrationRows/largeDealRows` 为模板核心分析结果。
   * 返回值说明：返回围绕头部渠道、长尾渠道和大单跟进的行动建议。
   */
  private buildOpportunityDefaultActions(
    partnerRows: Array<Record<string, unknown>>,
    concentrationRows: Array<Record<string, unknown>>,
    largeDealRows: Array<Record<string, unknown>>,
  ): string[] {
    const topPartner = partnerRows[0];
    const top5Share = String(concentrationRows[0]?.shareText ?? '').trim();
    return [
      topPartner
        ? `建议优先复盘 ${this.resolveOpportunityPartnerName(topPartner)} 的商机来源、客户行业和推进动作，沉淀可复制打法。`
        : '建议先补齐商机渠道商字段，避免只能看整体金额而无法定位渠道贡献。',
      top5Share
        ? `TOP5 渠道商机金额占比为 ${top5Share}，建议同步评估头部集中度风险和重点渠道资源投入。`
        : '建议补齐商机金额字段后再判断头部集中度。',
      largeDealRows.length > 0
        ? '建议对商机大单建立专项跟进清单，明确下一步动作、预计签单时间和风险阻塞。'
        : '建议持续跟踪高金额商机变化，避免大单沉默或阶段长期不更新。',
    ];
  }

  /**
   * 判断商机是否为取消状态。
   *
   * 参数说明：`row` 为标准化商机明细。
   * 返回值说明：阶段或状态出现取消、作废、删除时返回 true。
   */
  private isCancelledOpportunityRow(row: Record<string, unknown>): boolean {
    const statusText = [
      row.stage_name,
      row.stageName,
      row.stage,
      row.statusName,
      row.status_name,
      row.status,
    ].map((item) => String(item ?? '').trim()).filter(Boolean).join(' ');
    return /(取消|已取消|作废|删除)/u.test(statusText);
  }

  /**
   * 解析商机金额。
   *
   * 参数说明：`row` 为商机聚合或明细行。
   * 返回值说明：按商机金额字段优先级返回元级金额。
   */
  private resolveOpportunityAmount(row: Record<string, unknown>): number {
    for (const field of OPPORTUNITY_AMOUNT_FIELD_KEYS) {
      if (Object.prototype.hasOwnProperty.call(row, field)) {
        return this.toFiniteNumber(row[field]);
      }
    }

    return 0;
  }

  /**
   * 解析商机数量。
   *
   * 参数说明：`row` 为商机聚合行。
   * 返回值说明：优先返回商机数，缺失时按 1 条明细处理。
   */
  private resolveOpportunityCount(row: Record<string, unknown>): number {
    const count = this.resolveRowCountNumber(row, OPPORTUNITY_COUNT_FIELD_KEYS);
    return count > 0 ? count : 1;
  }

  /**
   * 解析渠道商名称。
   *
   * 参数说明：`row` 为商机渠道商聚合或明细行。
   * 返回值说明：返回真实渠道商名称，缺失时给出业务可读兜底。
   */
  private resolveOpportunityPartnerName(row: Record<string, unknown>): string {
    return String(
      row.partner_name ??
        row.partnerName ??
        row.partner ??
        row.channelName ??
        row.channel_name ??
        row.ownerName ??
        row.owner_name ??
        '未填写渠道商',
    ).trim() || '未填写渠道商';
  }

  /**
   * 解析商机创建时间。
   *
   * 参数说明：`row` 为商机明细行。
   * 返回值说明：可解析时返回日期对象，否则返回 undefined。
   */
  private resolveOpportunityCreatedDate(row: Record<string, unknown>): Date | undefined {
    const rawValue = row.created_at ?? row.createdAt ?? row.createTime ?? row.create_time;
    if (!rawValue) {
      return undefined;
    }

    const date = new Date(String(rawValue));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * 按金额倒序生成带排名的行。
   *
   * 参数说明：`rows` 为渠道或服务商聚合行。
   * 返回值说明：返回带 `rank`、`name`、`amountText` 和 `shareText` 的展示行。
   */
  private rankRowsByAmount(
    rows: Array<Record<string, unknown>>,
    preferredAmountFields: readonly string[] = [],
  ): Array<Record<string, unknown>> {
    const totalAmount = rows.reduce((sum, row) => sum + this.resolveRowNumber(row, preferredAmountFields), 0);
    return [...rows]
      .sort((left, right) =>
        this.resolveRowNumber(right, preferredAmountFields) - this.resolveRowNumber(left, preferredAmountFields) ||
        this.resolveRowCountNumber(right) - this.resolveRowCountNumber(left),
      )
      .map((row, index) => {
        const amount = this.resolveRowNumber(row, preferredAmountFields);
        const share = totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
        return {
          rank: index + 1,
          name: this.resolveRowLabel(row),
          ...row,
          amountText: this.formatRowValue(row, preferredAmountFields),
          shareText: `${share.toFixed(1)}%`,
        };
      });
  }

  /**
   * 汇总服务商区域贡献。
   *
   * 参数说明：`rows` 为服务商或渠道聚合行。
   * 返回值说明：按区域返回数量、金额和占比，缺少区域字段时返回空数组。
   */
  private buildRegionSummaryRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const regionMap = new Map<string, { amount: number; count: number }>();
    for (const row of rows) {
      const region = this.resolveRegionLabel(row);
      if (!region) {
        continue;
      }

      const current = regionMap.get(region) ?? { amount: 0, count: 0 };
      current.amount += this.resolvePartnerContributionAmount(row);
      current.count += this.resolveRowCountNumber(row) || 1;
      regionMap.set(region, current);
    }

    const totalAmount = [...regionMap.values()].reduce((sum, item) => sum + item.amount, 0);
    return [...regionMap.entries()]
      .map(([region, value]) => ({
        region,
        ownerName: region,
        bucket_label: region,
        amount: value.amount,
        amountText: formatWanAmount(value.amount),
        count: value.count,
        shareText: totalAmount > 0 ? `${((value.amount / totalAmount) * 100).toFixed(1)}%` : '0.0%',
      }))
      .sort((left, right) => right.amount - left.amount || right.count - left.count);
  }

  /**
   * 按合作等级汇总服务商数量与经营贡献。
   *
   * 参数说明：`rows` 为服务商或渠道商真实明细行。
   * 返回值说明：返回每个已有合作等级的服务商数量、覆盖区域数、金额和占比。
   * 调用注意事项：明细行中 `count` 往往是报备/商机/订单数量，不能直接当成渠道商数量。
   */
  private buildPartnerLevelRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const levelMap = new Map<string, { partnerCount: number; amount: number; regions: Set<string> }>();
    for (const row of rows) {
      const level = this.normalizePartnerLevelLabel(this.resolvePartnerLevelLabel(row));
      const current = levelMap.get(level) ?? { partnerCount: 0, amount: 0, regions: new Set<string>() };
      current.partnerCount += 1;
      current.amount += this.resolvePartnerContributionAmount(row);

      const region = this.resolveRegionLabel(row);
      if (region) {
        current.regions.add(region);
      }

      levelMap.set(level, current);
    }

    const totalPartnerCount = [...levelMap.values()].reduce((sum, item) => sum + item.partnerCount, 0);
    return [...levelMap.entries()]
      .map(([level, value]) => ({
        level,
        partnerLevel: level,
        partnerCount: value.partnerCount,
        regionCount: value.regions.size,
        coveredRegions: [...value.regions].join('、') || '未返回区域',
        amount: value.amount,
        amountText: formatWanAmount(value.amount),
        shareText: totalPartnerCount > 0
          ? `${((value.partnerCount / totalPartnerCount) * 100).toFixed(1)}%`
          : '0.0%',
      }))
      .sort((left, right) => this.comparePartnerLevelRows(left.partnerLevel, right.partnerLevel) || right.partnerCount - left.partnerCount || right.amount - left.amount);
  }

  /**
   * 按大区和团队汇总渠道商体系明细。
   *
   * 参数说明：`rows` 为服务商或渠道商真实明细行。
   * 返回值说明：返回用户模板要求的大区、团队、等级数量、2026 签约数量和签约额。
   * 调用注意事项：渠道商数量按渠道商唯一标识去重；签约指标只读取订单/合同/签约字段，不用商机金额冒充签约额。
   */
  private buildPartnerSystemTeamRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const groupMap = new Map<
      string,
      {
        bigRegionLabel: string;
        teamName: string;
        partnerKeys: Set<string>;
        lepPartnerKeys: Set<string>;
        goldPartnerKeys: Set<string>;
        signedTechnicalPartnerKeys: Set<string>;
        nominationPartnerKeys: Set<string>;
        signedCount2026: number;
        signedAmount2026: number;
      }
    >();

    for (const [index, row] of rows.entries()) {
      const bigRegionLabel = this.resolvePartnerBigRegionLabel(row);
      const teamName = this.resolvePartnerTeamLabel(row);
      const groupKey = `${bigRegionLabel}\u0000${teamName}`;
      const current = groupMap.get(groupKey) ?? {
        bigRegionLabel,
        teamName,
        partnerKeys: new Set<string>(),
        lepPartnerKeys: new Set<string>(),
        goldPartnerKeys: new Set<string>(),
        signedTechnicalPartnerKeys: new Set<string>(),
        nominationPartnerKeys: new Set<string>(),
        signedCount2026: 0,
        signedAmount2026: 0,
      };
      const partnerKey = this.resolvePartnerIdentity(row, index);
      // 修复：LEP/金牌 来自合作级别（cooperationLevel），签约技术/提名 来自技术服务商类型（techServiceType）
      // 原代码误用合作等级（partnerLevel：一级/二级/未设置）匹配 LEP/金牌/签约技术/提名，导致四个计数恒为 0
      const cooperationLevel = this.normalizeCooperationLevelLabel(
        this.resolveCooperationLevelLabel(row),
      );
      const techServiceType = this.normalizeTechServiceTypeLabel(
        this.resolveTechServiceTypeLabel(row),
      );

      current.partnerKeys.add(partnerKey);
      if (cooperationLevel === 'LEP') {
        current.lepPartnerKeys.add(partnerKey);
      }
      if (cooperationLevel === '金牌') {
        current.goldPartnerKeys.add(partnerKey);
      }
      if (techServiceType === '签约技术') {
        current.signedTechnicalPartnerKeys.add(partnerKey);
      }
      if (techServiceType === '提名') {
        current.nominationPartnerKeys.add(partnerKey);
      }
      current.signedCount2026 += this.resolvePartnerSignedCount2026(row);
      current.signedAmount2026 += this.resolvePartnerSignedAmount2026(row);
      groupMap.set(groupKey, current);
    }

    const nationalPartnerCount = new Set(rows.map((row, index) => this.resolvePartnerIdentity(row, index))).size;
    return [...groupMap.values()]
      .map((item) => {
        const partnerTotalCount = item.partnerKeys.size;
        return {
          bigRegionLabel: item.bigRegionLabel,
          teamName: item.teamName,
          partnerTotalCount,
          lepCount: item.lepPartnerKeys.size,
          goldCount: item.goldPartnerKeys.size,
          signedTechnicalCount: item.signedTechnicalPartnerKeys.size,
          nominationCount: item.nominationPartnerKeys.size,
          signedCount2026: item.signedCount2026,
          signedAmount2026: item.signedAmount2026,
          signedAmount2026Text: formatWanAmount(item.signedAmount2026),
          nationalShareText: nationalPartnerCount > 0
            ? `${((partnerTotalCount / nationalPartnerCount) * 100).toFixed(1)}%`
            : '0.0%',
        };
      })
      .sort((left, right) =>
        right.partnerTotalCount - left.partnerTotalCount ||
          left.bigRegionLabel.localeCompare(right.bigRegionLabel, 'zh-CN') ||
          left.teamName.localeCompare(right.teamName, 'zh-CN'),
      );
  }

  /**
   * 解析渠道商体系表的大区名称。
   *
   * 参数说明：`row` 为服务商或渠道商明细行。
   * 返回值说明：优先返回 OpenAPI 已补齐的大区字段，缺失时用区域兜底。
   */
  private resolvePartnerBigRegionLabel(row: Record<string, unknown>): string {
    return String(
      row.bigRegion ??
        row.bigRegionName ??
        row.big_region ??
        row.big_region_name ??
        row['大区'] ??
        row.area ??
        this.resolveRegionLabel(row) ??
        '未返回大区',
    ).trim() || '未返回大区';
  }

  /**
   * 解析渠道商体系表的团队名称。
   *
   * 参数说明：`row` 为服务商或渠道商明细行。
   * 返回值说明：优先返回团队/部门字段，缺失时回退到区域，避免模板表缺少分组。
   */
  private resolvePartnerTeamLabel(row: Record<string, unknown>): string {
    return String(
      row.teamName ??
        row.team_name ??
        row.team ??
        row['团队'] ??
        row.departmentName ??
        row.department_name ??
        row['部门'] ??
        row.regionName ??
        row.region_name ??
        row.region ??
        this.resolvePartnerBigRegionLabel(row) ??
        '未返回团队',
    ).trim() || '未返回团队';
  }

  /**
   * 解析渠道商唯一标识。
   *
   * 参数说明：`row` 为服务商或渠道商明细行，`index` 为当前行序号。
   * 返回值说明：优先使用渠道商 ID/编码/名称，缺失时使用行序号兜底，确保真实行不会被误合并。
   */
  private resolvePartnerIdentity(row: Record<string, unknown>, index: number): string {
    return String(
      row.partnerId ??
        row.partner_id ??
        row.partnerCode ??
        row.partner_code ??
        row.code ??
        row.partnerName ??
        row.partner_name ??
        row.partner ??
        row.name ??
        `row-${index}`,
    ).trim() || `row-${index}`;
  }

  /**
   * 解析 2026 签约数量。
   *
   * 参数说明：`row` 为服务商或渠道商聚合行。
   * 返回值说明：优先读取 2026 专属签约/订单/合同数字段，再读取通用订单/合同数量。
   */
  private resolvePartnerSignedCount2026(row: Record<string, unknown>): number {
    return this.resolveFirstFiniteNumber(row, [
      'signedCount2026',
      'signCount2026',
      'signed_count_2026',
      'sign_count_2026',
      'contractCount2026',
      'contract_count_2026',
      'orderCount2026',
      'order_count_2026',
      'signedCount',
      'signed_count',
      'contractCount',
      'contract_count',
      'orderCount',
      'order_count',
    ]);
  }

  /**
   * 解析 2026 签约金额。
   *
   * 参数说明：`row` 为服务商或渠道商聚合行。
   * 返回值说明：优先读取 2026 专属签约/订单/合同金额字段，再读取通用订单/合同金额。
   */
  private resolvePartnerSignedAmount2026(row: Record<string, unknown>): number {
    return this.resolveFirstFiniteNumber(row, [
      'signedAmount2026',
      'signAmount2026',
      'signed_amount_2026',
      'sign_amount_2026',
      'contractAmount2026',
      'contract_amount_2026',
      'orderAmount2026',
      'order_amount_2026',
      'signedAmount',
      'signed_amount',
      'contractAmount',
      'contract_amount',
      'orderAmount',
      'order_amount',
      'totalOrderAmount',
      'total_order_amount',
      'totalAmount',
      'total_amount',
      'totalAmt',
    ]);
  }

  /**
   * 按候选字段读取第一个可用数字。
   *
   * 参数说明：`row` 为明细行，`fields` 为按优先级排列的字段名。
   * 返回值说明：命中字段后返回有限数值，未命中统一返回 0。
   */
  private resolveFirstFiniteNumber(row: Record<string, unknown>, fields: string[]): number {
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(row, field)) {
        return this.toFiniteNumber(row[field]);
      }
    }

    return 0;
  }

  /**
   * 生成中国地图覆盖所需的省份/区域汇总行。
   *
   * 参数说明：`rows` 为服务商或渠道商真实明细行。
   * 返回值说明：返回可被公开 HTML 渲染成地图标注的数据行。
   * 调用注意事项：能识别省份时写入 `province`；识别不到省份时仍保留原始区域，避免覆盖信息丢失。
   */
  private buildPartnerCoverageRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const coverageMap = new Map<
      string,
      {
        province: string;
        region: string;
        partnerNames: Set<string>;
        amount: number;
        levelAgents: Map<string, Set<string>>;
      }
    >();

    for (const row of rows) {
      const region = this.resolveRegionLabel(row) || '未返回区域';
      const province = this.resolveChinaProvinceLabel(this.buildPartnerCoverageText(row, region));
      const coverageKey = province || region;
      const current = coverageMap.get(coverageKey) ?? {
        province,
        region,
        partnerNames: new Set<string>(),
        amount: 0,
        levelAgents: new Map<string, Set<string>>(),
      };
      const partnerName = this.resolveRowLabel(row);
      const displayPartnerName = partnerName && partnerName !== '未命名分组' ? partnerName : '未命名渠道商';

      current.partnerNames.add(displayPartnerName);
      current.amount += this.resolvePartnerContributionAmount(row);

      const level = this.normalizePartnerLevelLabel(this.resolvePartnerLevelLabel(row));
      const levelAgentSet = current.levelAgents.get(level) ?? new Set<string>();
      levelAgentSet.add(displayPartnerName);
      current.levelAgents.set(level, levelAgentSet);

      coverageMap.set(coverageKey, current);
    }

    return [...coverageMap.entries()]
      .map(([coverageKey, value]) => ({
        coverageKey,
        province: value.province,
        region: value.region,
        covered: Boolean(value.province),
        partnerCount: value.partnerNames.size,
        agentCount: value.partnerNames.size,
        amount: value.amount,
        amountText: formatWanAmount(value.amount),
        levelSummary: this.buildPartnerLevelSummary(value.levelAgents),
        levelGroups: this.buildPartnerLevelGroups(value.levelAgents),
        agents: [...value.partnerNames],
      }))
      .sort((left, right) => right.partnerCount - left.partnerCount || right.amount - left.amount);
  }

  /**
   * 生成服务商覆盖摘要。
   *
   * 参数说明：`rows` 为服务商或渠道明细。
   * 返回值说明：返回省份/区域覆盖、头部服务商和长尾服务商的可读摘要。
   */
  private buildPartnerCoverageItems(rows: Array<Record<string, unknown>>): string[] {
    if (rows.length === 0) {
      return ['当前结果包未返回服务商明细，暂无法计算区域覆盖。'];
    }

    const coveredProvinceCount = new Set(
      rows
        .map((row) => this.resolveChinaProvinceLabel(this.buildPartnerCoverageText(row, this.resolveRegionLabel(row))))
        .filter(Boolean),
    ).size;
    const rankedRows = this.rankRowsByAmount(rows, PARTNER_CONTRIBUTION_AMOUNT_FIELD_KEYS);
    const topPartner = rankedRows[0];
    const oneDealCount = rows.filter((row) => this.resolveRowCountNumber(row) === 1).length;
    const items = [
      `当前覆盖 ${coveredProvinceCount}/${MAINLAND_CHINA_PROVINCE_LABELS.length} 个省级区域，共 ${rows.length} 家服务商或渠道商进入本次结果。`,
    ];

    if (topPartner) {
      items.push(`头部服务商为 ${this.resolveRowLabel(topPartner)}，贡献 ${topPartner.amountText ?? this.formatRowValue(topPartner)}。`);
    }

    if (oneDealCount > 0) {
      items.push(`仅 1 条记录的长尾服务商 ${oneDealCount} 家，建议结合活跃度和最近订单/商机继续分层运营。`);
    }

    return items;
  }

  /**
   * 构造订单集中度行。
   *
   * 参数说明：`rankedRows` 为已按金额排序的渠道行。
   * 返回值说明：返回 TOP5、TOP10、TOP20 和一次性渠道四个集中度指标。
   */
  private buildOrderConcentrationRows(
    rankedRows: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const totalAmount = rankedRows.reduce((sum, row) => sum + this.resolveRowNumber(row, ORDER_AMOUNT_FIELD_KEYS), 0);
    const totalCount = rankedRows.reduce(
      (sum, row) => sum + this.resolveRowCountNumber(row, ORDER_COUNT_FIELD_KEYS),
      0,
    );
    const buildTopRow = (topN: number) => {
      const amount = rankedRows
        .slice(0, topN)
        .reduce((sum, row) => sum + this.resolveRowNumber(row, ORDER_AMOUNT_FIELD_KEYS), 0);
      return {
        name: `TOP ${topN} 渠道金额`,
        amount,
        amountText: formatWanAmount(amount),
        count: rankedRows
          .slice(0, topN)
          .reduce((sum, row) => sum + this.resolveRowCountNumber(row, ORDER_COUNT_FIELD_KEYS), 0),
        shareText: totalAmount > 0 ? `${((amount / totalAmount) * 100).toFixed(1)}%` : '0.0%',
      };
    };
    const oneDealRows = rankedRows.filter((row) => this.resolveRowCountNumber(row, ORDER_COUNT_FIELD_KEYS) <= 1);
    const oneDealAmount = oneDealRows.reduce(
      (sum, row) => sum + this.resolveRowNumber(row, ORDER_AMOUNT_FIELD_KEYS),
      0,
    );

    return [
      buildTopRow(5),
      buildTopRow(10),
      buildTopRow(20),
      {
        name: '一次性渠道',
        count: oneDealRows.length,
        amount: oneDealAmount,
        amountText: formatWanAmount(oneDealAmount),
        shareText: rankedRows.length > 0 ? `${((oneDealRows.length / rankedRows.length) * 100).toFixed(1)}%` : '0.0%',
        totalOrderCount: totalCount,
      },
    ];
  }

  /**
   * 生成服务商发展运营建议。
   *
   * 参数说明：`rows` 为服务商明细，`regionRows` 为区域汇总。
   * 返回值说明：返回贴合服务商发展、覆盖和运营的行动建议。
   */
  private buildPartnerDevelopmentActions(
    rows: Array<Record<string, unknown>>,
    regionRows: Array<Record<string, unknown>>,
  ): string[] {
    const actions = [
      '建议按大区/团队拆解服务商覆盖和贡献，优先补齐未覆盖区域、低活跃服务商和核心服务商的运营责任人。',
      '建议把服务商等级、服务能力和真实商机/订单贡献联动评估，避免只看渠道数量而忽略经营产出。',
    ];

    if (regionRows.length > 0) {
      actions.push(`建议优先复盘 ${this.resolveRowLabel(regionRows[0])} 的服务商打法，并对低覆盖区域建立开拓清单。`);
    } else if (rows.length > 0) {
      actions.push('建议联软补齐服务商区域、省份和团队字段，方便后续按模板输出覆盖地图和渠道体系明细。');
    }

    return actions;
  }

  /**
   * 生成渠道订单经营建议。
   *
   * 参数说明：`rankedRows` 为渠道排名，`concentrationRows` 为集中度指标。
   * 返回值说明：返回贴合渠道订单汇总模板的行动建议。
   */
  private buildChannelOrderActions(
    rankedRows: Array<Record<string, unknown>>,
    concentrationRows: Array<Record<string, unknown>>,
  ): string[] {
    const top5 = concentrationRows[0]?.shareText;
    const topPartner = rankedRows[0];
    return [
      top5
        ? `头部渠道订单金额占比为 ${top5}，建议对 TOP 渠道建立季度复盘和续单/扩容清单。`
        : '建议先补齐渠道订单金额字段，再评估头部集中度。',
      topPartner
        ? `建议重点跟进 ${this.resolveRowLabel(topPartner)} 的订单来源、客户类型和可复制打法。`
        : '建议补齐渠道名称和订单明细，避免订单分析只能停留在总量层面。',
      '建议将一次性下单渠道单独分层，区分偶发大单、沉默渠道和可激活渠道，分别制定跟进动作。',
    ];
  }

  private resolveRegionLabel(row: Record<string, unknown>): string {
    return String(
      row.region ??
        row.bigRegion ??
        row.big_region ??
        row.departmentName ??
        row.department_name ??
        row.area ??
        '',
    ).trim();
  }

  /**
   * 解析服务商合作等级。
   *
   * 参数说明：`row` 为 OpenAPI 返回或聚合后的服务商行。
   * 返回值说明：返回合作等级中文值；缺失时返回空字符串。
   */
  private resolvePartnerLevelLabel(row: Record<string, unknown>): string {
    return String(
      row.partnerLevelName ??
        row.partnerLevel ??
        row.level ??
        row.levelName ??
        '',
    ).trim();
  }

  /**
   * 解析服务商合作级别（LEP/金牌/银牌/钻石）。
   *
   * 参数说明：`row` 为 OpenAPI 返回或聚合后的服务商行。
   * 返回值说明：返回合作级别中文值；缺失时返回空字符串。
   * 调用注意事项：合作级别与合作等级是两个不同维度——合作等级（partnerLevel）是
   * 一级/二级/未设置，合作级别（cooperationLevel）是 LEP/金牌/银牌/钻石。本方法
   * 专用于看板中 LEP/金牌 计数，不与合作等级混用。
   */
  private resolveCooperationLevelLabel(row: Record<string, unknown>): string {
    return String(
      row.cooperationLevelName ??
        row.cooperationLevel ??
        row.partnerCooperationLevel ??
        row.partnerCooperationLevelName ??
        '',
    ).trim();
  }

  /**
   * 归一服务商合作级别名称。
   *
   * 参数说明：`level` 为 CRM 字段或字典翻译后的合作级别文本。
   * 返回值说明：返回看板中稳定展示的合作级别名称。
   */
  private normalizeCooperationLevelLabel(level: string): string {
    const normalizedLevel = level.trim().toLowerCase();
    if (!normalizedLevel) {
      return '';
    }

    if (normalizedLevel === 'lep') {
      return 'LEP';
    }

    if (normalizedLevel === 'gold' || /金牌/u.test(normalizedLevel)) {
      return '金牌';
    }

    return '';
  }

  /**
   * 解析服务商技术服务商类型（full=签约技术/developing=提名/none=非技术服务商）。
   *
   * 参数说明：`row` 为 OpenAPI 返回或聚合后的服务商行。
   * 返回值说明：返回技术服务商类型原始值；缺失时返回空字符串。
   * 调用注意事项：联软 partners 接口返回 technicalServiceProviderType 或历史字段
   * techServiceType，值为 full/developing/none。本方法专用于看板中签约技术/提名计数。
   */
  private resolveTechServiceTypeLabel(row: Record<string, unknown>): string {
    return String(
      row.techServiceType ??
        row.technicalServiceProviderType ??
        row.technical_service_provider_type ??
        '',
    ).trim();
  }

  /**
   * 归一技术服务商类型为看板标签。
   *
   * 参数说明：`techServiceType` 为联软返回的技术服务商类型原始值。
   * 返回值说明：full→签约技术，developing→提名，其余返回空。
   */
  private normalizeTechServiceTypeLabel(techServiceType: string): string {
    const normalized = techServiceType.trim().toLowerCase();
    if (normalized === 'full') {
      return '签约技术';
    }

    if (normalized === 'developing') {
      return '提名';
    }

    return '';
  }

  /**
   * 归一服务商合作等级名称。
   *
   * 参数说明：`level` 为 CRM 字段或字典翻译后的等级文本。
   * 返回值说明：返回看板中稳定展示的等级名称。
   * 调用注意事项：只做同义词折叠，不把未知等级强行改成模板示例等级。
   */
  private normalizePartnerLevelLabel(level: string): string {
    const normalizedLevel = level.trim();
    if (!normalizedLevel) {
      return '未填写等级';
    }

    if (/^lep$/iu.test(normalizedLevel)) {
      return 'LEP';
    }

    if (/金牌/u.test(normalizedLevel)) {
      return '金牌';
    }

    if (/签约技术|签约技服|签约技术服务/u.test(normalizedLevel)) {
      return '签约技术';
    }

    if (/提名/u.test(normalizedLevel)) {
      return '提名';
    }

    if (/未设置|未配置|未知|无等级|未能落到/u.test(normalizedLevel)) {
      return '未设置';
    }

    return normalizedLevel;
  }

  /**
   * 排序合作等级行。
   *
   * 参数说明：`left/right` 为合作等级名称。
   * 返回值说明：模板等级优先，其余等级按中文名称排序。
   */
  private comparePartnerLevelRows(left: string, right: string): number {
    const leftIndex = PARTNER_LEVEL_DISPLAY_ORDER.indexOf(left);
    const rightIndex = PARTNER_LEVEL_DISPLAY_ORDER.indexOf(right);
    const normalizedLeftIndex = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
    const normalizedRightIndex = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;
    if (normalizedLeftIndex !== normalizedRightIndex) {
      return normalizedLeftIndex - normalizedRightIndex;
    }

    return left.localeCompare(right, 'zh-CN');
  }

  /**
   * 生成省份识别用文本。
   *
   * 参数说明：`row` 为服务商明细，`region` 为已解析区域。
   * 返回值说明：拼接省份、区域、部门、渠道商名称等文本，用于省份归一。
   * 调用注意事项：只用于识别地图省份，不改变明细中的原始字段。
   */
  private buildPartnerCoverageText(row: Record<string, unknown>, region: string): string {
    return [
      row.province,
      row.provinceName,
      row.province_name,
      row.region,
      row.regionName,
      row.region_name,
      row.bigRegion,
      row.big_region,
      row.area,
      row.departmentName,
      row.department_name,
      row.team,
      row.teamName,
      row.partnerName,
      row.partner_name,
      region,
    ].map((item) => String(item ?? '').trim()).filter(Boolean).join(' ');
  }

  /**
   * 构造合作等级摘要。
   *
   * 参数说明：`levelAgents` 为等级到代理商集合的映射。
   * 返回值说明：返回“等级 多少家”的摘要文本。
   */
  private buildPartnerLevelSummary(levelAgents: Map<string, Set<string>>): string {
    const groups = this.buildPartnerLevelGroups(levelAgents);
    return groups.length
      ? groups.map((item) => `${item.level} ${item.count} 家`).join('、')
      : '未返回等级';
  }

  /**
   * 构造弹窗使用的合作等级分组。
   *
   * 参数说明：`levelAgents` 为等级到代理商集合的映射。
   * 返回值说明：返回已排序的等级、数量和代理商名单。
   */
  private buildPartnerLevelGroups(levelAgents: Map<string, Set<string>>): Array<{
    level: string;
    count: number;
    agents: string[];
  }> {
    return [...levelAgents.entries()]
      .map(([level, agents]) => ({
        level,
        count: agents.size,
        agents: [...agents],
      }))
      .sort((left, right) => this.comparePartnerLevelRows(left.level, right.level) || right.count - left.count);
  }

  /**
   * 解析服务商经营贡献金额。
   *
   * 参数说明：`row` 为服务商明细或聚合行。
   * 返回值说明：优先返回订单、商机或累计金额字段；没有金额字段时返回 0。
   * 调用注意事项：不能退回 `count`，否则合作等级和地图金额会把记录数误当金额。
   */
  private resolvePartnerContributionAmount(row: Record<string, unknown>): number {
    const explicitTotal = this.resolveOptionalFiniteNumber(row, [
      'amount',
      'totalAmount',
      'total_amount',
      'totalAmt',
    ]);
    const orderOrContractAmount = this.resolveOptionalFiniteNumber(row, [
      'orderAmount',
      'order_amount',
      'signedAmount',
      'signed_amount',
      'contractAmount',
      'contract_amount',
    ]) ?? 0;
    const opportunityAmount = this.resolveOptionalFiniteNumber(row, [
      'opportunityAmount',
      'opportunity_amount',
      'expectedAmount',
      'expected_amount',
    ]) ?? 0;
    const quoteAmount = this.resolveOptionalFiniteNumber(row, [
      'quoteAmount',
      'quote_amount',
    ]) ?? 0;
    const businessAmount = orderOrContractAmount + opportunityAmount + quoteAmount;
    if (explicitTotal !== undefined && explicitTotal !== 0) {
      return explicitTotal;
    }
    if (businessAmount > 0) {
      return businessAmount;
    }
    if (explicitTotal !== undefined) {
      return explicitTotal;
    }

    return 0;
  }

  /**
   * 从候选字段读取可选数字。
   *
   * 参数说明：`row` 为结果行，`fields` 为字段优先级。
   * 返回值说明：字段存在时返回有限数值，不存在时返回 `undefined`。
   * 调用注意事项：用于区分“字段不存在”和“字段存在但值为 0”，避免金额合并误判。
   */
  private resolveOptionalFiniteNumber(row: Record<string, unknown>, fields: string[]): number | undefined {
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(row, field)) {
        return this.toFiniteNumber(row[field]);
      }
    }

    return undefined;
  }

  /**
   * 从区域文本中识别中国省级行政区。
   *
   * 参数说明：`regionText` 为 CRM 返回的区域、大区、省份或部门名称。
   * 返回值说明：能识别省份/直辖市/自治区/特别行政区时返回简称，否则返回空字符串。
   * 调用注意事项：地图标注只使用真实文本归一，不根据模板示例补虚拟省份。
   */
  private resolveChinaProvinceLabel(regionText: string): string {
    const normalizedText = regionText.replace(/\s/gu, '');
    return CHINA_PROVINCE_ALIASES.find((item) =>
      item.aliases.some((alias) => normalizedText.includes(alias)),
    )?.province ?? '';
  }

  private buildSourceNotes(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
  ): AnalysisSourceNote[] {
    const notes: AnalysisSourceNote[] = [
      {
        key: 'analysis-scope',
        label: '分析范围',
        description: datasetBundle.scopeSummary,
      },
      {
        key: 'analysis-workflow',
        label: '执行口径',
        description: `本次问题按“${workflow.normalizedQuestion}”进入受控分析链路，并复用统一时间口径与权限快照。`,
      },
    ];

    notes.push({
      key: 'result-consistency',
      label: '结果一致性',
      description: `本次报告引用 ${datasetBundle.slices.length} 个受控数据集，共 ${datasetBundle.totalRowCount} 行结果；摘要、模板卡片、表格和 HTML 报告均复用同一结果包，不在展示层重新取数。`,
    });

    if (datasetBundle.temporalScope) {
      notes.push({
        key: 'temporal-scope',
        label: '时间口径',
        description: formatTemporalScopeLabel(datasetBundle.temporalScope),
      });
    }

    const presentationLabels = this.resolveOutputPreferenceLabels(workflow.outputPreference ?? []);
    if (presentationLabels.length > 0) {
      notes.push({
        key: 'presentation-preference',
        label: '呈现口径',
        description: `本次已按用户偏好组织为${presentationLabels.join('、')}；所有图表、表格和建议均复用同一批 CRM 结果数据。`,
      });
    }

    for (const metric of metricCards.slice(0, 4)) {
      notes.push({
        key: `metric-${metric.name}`,
        label: String(metric.name),
        description: `${metric.name} 来自统一结果包中的受控统计结果，禁止在展示层重新计算。`,
      });
    }

    return notes;
  }

  /**
   * 将输出偏好枚举转成业务用户可读文案。
   *
   * 参数说明：`preferences` 为意图层解析出的展示偏好。
   * 返回值说明：返回中文呈现方式名称，过滤图片等当前不作为主交付的偏好。
   */
  private resolveOutputPreferenceLabels(
    preferences: NonNullable<AnalysisWorkflowPlan['outputPreference']>,
  ): string[] {
    const labelMap = new Map([
      ['text_summary', '文字摘要'],
      ['table', '表格明细'],
      ['chart', '图表区块'],
      ['html_report', '完整报告页'],
      ['export_file', '导出入口'],
    ]);

    return preferences
      .map((item) => labelMap.get(item))
      .filter((item): item is string => Boolean(item));
  }

  private buildFootnotes(datasetBundle: AnalysisDatasetBundle): string[] {
    const footnotes = [
      '当前结果中的摘要、图表、表格和导出共用同一份受控结果事实与一致性标识。',
    ];

    if ((datasetBundle.missingSections?.length ?? 0) > 0) {
      footnotes.push(
        `存在 ${datasetBundle.missingSections?.length ?? 0} 个可选区块未生成，系统已保留缺失原因并继续返回可用结果。`,
      );
    }

    return footnotes;
  }

  private buildSectionFromSlice(
    slice: AnalysisDatasetSlice,
    temporalScope: AnalysisReportPayload['temporalScope'],
    keyFindings: AnalysisKeyFinding[],
  ): AnalysisReportSection | undefined {
    if (slice.resultKind === 'time-trend') {
      return {
        sectionType: 'trend',
        title: slice.taskTitle,
        datasetId: slice.datasetId,
        description:
          keyFindings.find((item) => item.datasetId === slice.datasetId)?.detail ?? slice.summary,
        series: slice.primaryView?.series ?? [],
        rows: slice.tableRows,
        temporalScope,
      };
    }

    if (
      slice.resultKind === 'stage-distribution' ||
      slice.resultKind === 'category-distribution' ||
      slice.resultKind === 'department-contribution' ||
      slice.resultKind === 'partner-contribution'
    ) {
      return {
        sectionType: 'distribution',
        title: slice.taskTitle,
        datasetId: slice.datasetId,
        description:
          keyFindings.find((item) => item.datasetId === slice.datasetId)?.detail ?? slice.summary,
        series: slice.primaryView?.series ?? [],
        rows: slice.tableRows,
        temporalScope,
      };
    }

    if (slice.resultKind === 'risk-overview') {
      const riskMetricLabel = this.resolveRiskMetricLabel(slice);
      const riskRecordLabel = this.resolveRiskRecordLabel(slice);
      return {
        sectionType: 'risk',
        title: slice.taskTitle,
        datasetId: slice.datasetId,
        description:
          keyFindings.find((item) => item.datasetId === slice.datasetId)?.detail ?? slice.summary,
        rows: slice.tableRows,
        items: slice.tableRows.slice(0, 3).map((item) => {
          const label = this.resolveRowLabel(item);
          return `${label} ${riskMetricLabel} ${this.formatRowValue(item)}，涉及 ${Number(item.count ?? 0)} 条${riskRecordLabel}。`;
        }),
        temporalScope,
      };
    }

    return undefined;
  }

  private buildFocusSection(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): AnalysisReportSection | undefined {
    if (this.isCompositeBusinessReport(workflow, datasetBundle)) {
      return this.buildCompositeFocusSection(datasetBundle);
    }

    const rankingSlice = datasetBundle.slices.find((item) => item.resultKind === 'owner-ranking') ??
      datasetBundle.slices[0];
    if (!rankingSlice?.tableRows.length) {
      return undefined;
    }

    const totalAmount = rankingSlice.tableRows.reduce(
      (sum, item) => sum + this.resolveRowNumber(item),
      0,
    );
    const focusItems = rankingSlice.tableRows.slice(0, 3).map((item, index) => {
      const amount = this.resolveRowNumber(item);
      const share = totalAmount > 0 ? `${((amount / totalAmount) * 100).toFixed(1)}%` : '0.0%';
      return `TOP${index + 1} ${this.resolveRowLabel(item)} 贡献 ${share}，金额 ${formatWanAmount(amount)}。`;
    });
    if (focusItems.length === 0) {
      return undefined;
    }

    return {
      sectionType: 'focus-list',
      title: '重点对象贡献',
      datasetId: rankingSlice.datasetId,
      items: focusItems,
      temporalScope: datasetBundle.temporalScope,
    };
  }

  private deduplicateSections(sections: AnalysisReportSection[]): AnalysisReportSection[] {
    const seenKeys = new Set<string>();
    return sections.filter((item) => {
      const sectionKey = `${item.sectionType}:${item.title}:${item.datasetId ?? ''}`;
      if (seenKeys.has(sectionKey)) {
        return false;
      }

      seenKeys.add(sectionKey);
      return true;
    });
  }

  /**
   * 去除重复表格块。
   *
   * 参数说明：`tableBlocks` 为报告表格块。
   * 返回值说明：标题和行内容完全一致的表格只保留第一份。
   * 调用注意事项：固定模板可能同时把主视图和二级视图命名为同一张表，公开页不能重复展示。
   */
  private deduplicateTableBlocks(
    tableBlocks: AnalysisReportPayload['tableBlocks'],
  ): AnalysisReportPayload['tableBlocks'] {
    const seenKeys = new Set<string>();
    return tableBlocks.filter((item) => {
      const tableKey = `${item.title}:${JSON.stringify(item.rows)}`;
      if (seenKeys.has(tableKey)) {
        return false;
      }

      seenKeys.add(tableKey);
      return true;
    });
  }

  private buildActionItems(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): string[] {
    if (this.isCompositeBusinessReport(workflow, datasetBundle)) {
      return [
        '建议按渠道商把客户报备、商机和订单三段拉通复盘，优先确认报备未转商机、商机未转订单的断点。',
        '建议对订单金额或商机金额靠前的渠道商建立重点跟进清单，补齐下一步负责人、预计成交时间和风险说明。',
        '建议将合作伙伴开拓结果与真实商机、订单贡献一起看，避免只看服务商数量而忽略实际经营产出。',
      ];
    }

    const primaryRows = this.resolveRankingRows(datasetBundle);
    const rankingStats = this.buildRankingStats(primaryRows);
    const riskSlice = datasetBundle.slices.find((item) => item.resultKind === 'risk-overview');
    const actionItems: string[] = [];

    if (rankingStats && rankingStats.top1Share >= 0.35) {
      actionItems.push('头部负责人贡献占比较高，建议同步复盘前两名项目推进方式并制定可复制打法。');
    }

    if ((riskSlice?.rowCount ?? 0) > 0) {
      actionItems.push('高风险商机仍有暴露，建议优先梳理高风险负责人名下项目并安排专项跟进。');
    }

    if (actionItems.length === 0) {
      actionItems.push('当前经营结构整体稳定，建议继续沿用现有节奏并关注下一个时间窗口变化。');
    }

    return actionItems;
  }

  private appendTemporalLabel(
    title: string,
    temporalScope: AnalysisDatasetBundle['temporalScope'],
  ): string {
    if (!temporalScope?.normalizedLabel || title.includes(temporalScope.normalizedLabel)) {
      return title;
    }

    return `${title}（${formatTemporalScopeLabel(temporalScope)}）`;
  }

  private buildExecutiveSummary(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    variant: AnalysisReportVariant,
    metricCards: MetricCard[] = [],
    businessReportTemplate?: BusinessReportTemplate,
  ): string {
    const primarySlice = datasetBundle.slices[0];
    if (datasetBundle.totalRowCount === 0) {
      return '当前问题已进入受控分析流程，但在现有权限范围和筛选条件下没有命中数据。';
    }

    if (businessReportTemplate === 'partner-development-operations') {
      return this.buildPartnerDevelopmentExecutiveSummary(workflow, datasetBundle, metricCards);
    }

    if (businessReportTemplate === 'channel-order-summary') {
      return this.buildChannelOrderExecutiveSummary(workflow, datasetBundle, metricCards);
    }

    if (businessReportTemplate === 'opportunity-default-summary') {
      return this.buildOpportunityDefaultExecutiveSummary(workflow, datasetBundle, metricCards);
    }

    if (this.isCompositeBusinessReport(workflow, datasetBundle)) {
      return this.buildCompositeExecutiveSummary(workflow, datasetBundle, metricCards);
    }

    const rows = primarySlice.tableRows;
    const firstRow = rows[0];

    if (variant === 'trend') {
      return this.buildTrendExecutiveSummary(workflow.normalizedQuestion, rows);
    }

    if (variant === 'distribution') {
      return `${workflow.normalizedQuestion} 已生成分布报告，当前共识别 ${rows.length} 个主要分组，可直接查看结构占比与重点分类。`;
    }

    if (primarySlice.resultKind === 'metric-summary') {
      const totalAmount = this.resolveRowNumber(firstRow ?? {});
      const totalCount = Number(firstRow?.count ?? 0);
      const subjectLabel = this.isOrderQuestionText(workflow)
        ? '订单'
        : workflow.domain === 'opportunity-analysis'
          ? '商机'
          : '合同';
      const rankingRows = this.resolveRankingRows(datasetBundle).slice(0, 3);
      const rankingSummary = rankingRows.length
        ? `排名靠前的销售为：${rankingRows
            .map((item, index) => `TOP${index + 1} ${this.resolveRowLabel(item)} ${this.formatRowValue(item)}`)
            .join('；')}。`
        : '';
      return `${workflow.normalizedQuestion} 已按全量${subjectLabel}记录生成结果，${subjectLabel}金额为 ${this.formatYuanAmount(totalAmount)}，命中${subjectLabel}数 ${totalCount.toLocaleString('zh-CN')}。${rankingSummary}`;
    }

    if (firstRow) {
      const leader = this.resolveRowLabel(firstRow);
      const leaderValue = this.formatRowValue(firstRow);
      const recordScopeSummary = this.buildRecordScopeSummary(primarySlice.metricCards, rows.length);
      const rankingStats = this.buildRankingStats(rows);
      const gapSummary = rankingStats?.leaderGapText
        ? `领先第二名 ${rankingStats.leaderGapText}。`
        : '';
      const shareSummary = rankingStats
        ? `TOP1 贡献占比为 ${rankingStats.top1ShareText}，TOP3 贡献占比为 ${rankingStats.top3ShareText}，平均单笔商机金额为 ${rankingStats.avgTicketText}。`
        : '';
      return `${workflow.normalizedQuestion} 已生成排名报告，当前 ${leader} 暂列第一，核心指标为 ${leaderValue}。${gapSummary}${shareSummary}${recordScopeSummary}`;
    }

    return `${workflow.normalizedQuestion} 已拆解为 ${datasetBundle.slices.length} 个查询任务，并生成最终分析报告。`;
  }

  private buildKeyFindings(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    variant: AnalysisReportVariant,
  ): AnalysisKeyFinding[] {
    const findings: AnalysisKeyFinding[] = [];
    for (const [index, item] of datasetBundle.slices.entries()) {
      if (item.resultKind === 'time-trend') {
        findings.push(this.buildTrendFinding(item, index));
        continue;
      }

      if (
        item.resultKind === 'stage-distribution' ||
        item.resultKind === 'category-distribution' ||
        item.resultKind === 'department-contribution' ||
        item.resultKind === 'partner-contribution'
      ) {
        const firstRow = item.tableRows[0] ?? {};
        findings.push({
          title: `结构观察 ${index + 1}`,
          detail: `${item.taskTitle} 中 ${this.resolveRowLabel(firstRow)} 当前最值得关注，对应值为 ${this.formatRowValue(firstRow)}。`,
          tone: item.rowCount > 0 ? 'neutral' : 'risk',
          datasetId: item.datasetId,
        });
        continue;
      }

      if (item.resultKind === 'risk-overview') {
        const firstRow = item.tableRows[0] ?? {};
        const riskRecordLabel = this.resolveRiskRecordLabel(item);
        findings.push({
          title: '风险观察',
          detail: `${item.taskTitle} 当前重点对象为 ${this.resolveRowLabel(firstRow)}，涉及 ${Number(firstRow.count ?? 0)} 条${riskRecordLabel}。`,
          tone: 'risk',
          datasetId: item.datasetId,
        });
        continue;
      }

      const firstRow = item.tableRows[0] ?? {};
      const rankingStats = this.buildRankingStats(item.tableRows);
      findings.push({
        title: `关键发现 ${index + 1}`,
        detail: `${item.taskTitle} 当前由 ${this.resolveRowLabel(firstRow)} 领先，对应指标为 ${this.formatRowValue(firstRow)}。${rankingStats?.leaderGapText ? `领先第二名 ${rankingStats.leaderGapText}。` : ''}`,
        tone: item.rowCount > 0 ? 'positive' : 'risk',
        datasetId: item.datasetId,
      });
      if ((workflow.analysisFacetProfile === 'owner-performance-ranking' || variant === 'ranking') && rankingStats) {
        findings.push({
          title: '头部贡献',
          detail: `头部贡献方面，TOP1 负责人贡献占比为 ${rankingStats.top1ShareText}，平均单笔商机金额为 ${rankingStats.avgTicketText}。`,
          tone: rankingStats.top1Share >= 0.6 ? 'risk' : 'neutral',
          datasetId: item.datasetId,
        });
      }
    }

    return findings.slice(0, 6);
  }

  private mergeMetricCards(datasetBundle: AnalysisDatasetBundle): MetricCard[] {
    const metricMap = new Map<string, MetricCard>();
    for (const slice of datasetBundle.slices) {
      for (const metricCard of slice.metricCards) {
        if (metricCard.name === '转合同金额' && metricMap.has('合同金额')) {
          continue;
        }

        if (!metricMap.has(metricCard.name)) {
          metricMap.set(metricCard.name, metricCard);
        }
      }
    }
    return [...metricMap.values()].map((item) => this.normalizeMetricCard(item));
  }

  private buildMetricCards(
    datasetBundle: AnalysisDatasetBundle,
    variant: AnalysisReportVariant,
    isCompositeBusinessReport = false,
    businessReportTemplate?: BusinessReportTemplate,
  ): MetricCard[] {
    const metricCards = this.mergeMetricCards(datasetBundle);
    if (businessReportTemplate === 'partner-development-operations') {
      return this.buildPartnerDevelopmentMetricCards(datasetBundle, metricCards);
    }

    if (businessReportTemplate === 'channel-order-summary') {
      return this.buildChannelOrderMetricCards(datasetBundle, metricCards);
    }

    if (businessReportTemplate === 'opportunity-default-summary') {
      return this.buildOpportunityDefaultMetricCards(datasetBundle, metricCards);
    }

    if (isCompositeBusinessReport) {
      return this.prioritizeCompositeMetricCards(metricCards);
    }

    if (variant === 'ranking' || datasetBundle.slices.some((item) => item.resultKind === 'owner-ranking')) {
      const rankingRows = this.resolveRankingRows(datasetBundle);
      const rankingStats = this.buildRankingStats(rankingRows);
      if (rankingStats) {
        const supplementalCards: MetricCard[] = [
          { name: 'TOP1贡献占比', value: rankingStats.top1ShareText },
          { name: 'TOP3贡献占比', value: rankingStats.top3ShareText },
          { name: '平均单笔商机金额', value: rankingStats.avgTicketText },
          { name: '第一名领先第二名差距', value: rankingStats.leaderGapText },
        ];

        for (const metricCard of supplementalCards) {
          if (!metricCards.some((item) => item.name === metricCard.name)) {
            metricCards.push(metricCard);
          }
        }
      }

      return metricCards;
    }

    if (variant !== 'trend') {
      return metricCards;
    }

    const trendStats = this.buildTrendStats(datasetBundle.slices[0]?.tableRows ?? []);
    if (!trendStats) {
      return metricCards;
    }

    const supplementalCards: MetricCard[] = [
      { name: '时间跨度', value: `${trendStats.firstLabel} 至 ${trendStats.lastLabel}` },
      { name: '峰值月份', value: trendStats.peakLabel },
      { name: '最近月份', value: trendStats.lastLabel },
    ];

    for (const metricCard of supplementalCards) {
      if (!metricCards.some((item) => item.name === metricCard.name)) {
        metricCards.push(metricCard);
      }
    }

    return metricCards;
  }

  /**
   * 构造服务商发展运营模板指标卡。
   *
   * 参数说明：`datasetBundle` 为结果包，`metricCards` 为原始指标卡。
   * 返回值说明：按“全国代理商发展运营数据看板”优先展示渠道规模、区域覆盖、合作等级、商机和订单贡献。
   */
  private buildPartnerDevelopmentMetricCards(
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
  ): MetricCard[] {
    const rows = this.resolvePartnerDevelopmentRows(datasetBundle);
    const regionCount = new Set(rows.map((row) => this.resolveRegionLabel(row)).filter(Boolean)).size;
    const partnerCountMetric = metricCards.find((item) =>
      /服务商数量|合作伙伴数|渠道商数|命中渠道数|渠道数量/u.test(item.name),
    );
    const levelCount = new Set(
      rows.map((row) => this.resolvePartnerLevelLabel(row)).filter(Boolean),
    ).size;
    const opportunityAmountMetric = metricCards.find((item) =>
      /商机金额|累计商机金额|新增商机金额/u.test(item.name),
    );
    const orderAmountMetric = metricCards.find((item) =>
      /订单金额|累计订单金额|有效订单金额|渠道下单总额/u.test(item.name),
    );
    const registrationMetric = metricCards.find((item) =>
      /客户报备数|命中报备数|报备数/u.test(item.name),
    );

    return this.mergeMetricCardList([
      { name: '渠道商总数', value: partnerCountMetric?.value ?? rows.length },
      { name: '区域覆盖', value: regionCount > 0 ? `${regionCount} 个区域` : '未返回区域' },
      { name: '合作等级数', value: levelCount > 0 ? `${levelCount} 类` : '未返回等级' },
      ...(opportunityAmountMetric ? [opportunityAmountMetric] : []),
      ...(orderAmountMetric ? [orderAmountMetric] : []),
      ...(registrationMetric ? [registrationMetric] : []),
      ...metricCards,
    ]).slice(0, 6);
  }

  /**
   * 构造渠道订单汇总模板指标卡。
   *
   * 参数说明：`datasetBundle` 为结果包，`metricCards` 为原始指标卡。
   * 返回值说明：优先展示合作渠道总数、下单量、下单金额和平均单笔金额。
   */
  private buildChannelOrderMetricCards(
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
  ): MetricCard[] {
    const rows = this.resolveChannelOrderRows(datasetBundle);
    const totalAmount = rows.reduce((sum, row) => sum + this.resolveRowNumber(row, ORDER_AMOUNT_FIELD_KEYS), 0);
    const totalCount = rows.reduce((sum, row) => sum + this.resolveRowCountNumber(row, ORDER_COUNT_FIELD_KEYS), 0);
    const avgTicket = totalCount > 0 ? totalAmount / totalCount : 0;
    const orderAmountMetric = metricCards.find((item) => /订单金额|合同金额|累计订单金额|有效订单金额/u.test(item.name));
    const orderCountMetric = metricCards.find((item) => /订单数|合同数|命中订单数|有效订单数量/u.test(item.name));

    return this.mergeMetricCardList([
      { name: '合作渠道总数', value: rows.length },
      { name: '渠道下单总量', value: orderCountMetric?.value ?? (totalCount || rows.length) },
      { name: '渠道下单总额', value: orderAmountMetric?.value ?? formatWanAmount(totalAmount) },
      { name: '平均单笔金额', value: avgTicket > 0 ? formatWanAmount(avgTicket) : '暂无金额' },
      ...metricCards.map((item) => this.normalizeChannelOrderMetricCardName(item)),
    ]).slice(0, 6);
  }

  /**
   * 构造商机默认分析模板指标卡。
   *
   * 参数说明：`datasetBundle` 为结果包，`metricCards` 为执行层原始指标卡。
   * 返回值说明：优先展示商机数量、商机金额、平均商机金额、渠道商数和非取消商机数。
   */
  private buildOpportunityDefaultMetricCards(
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
  ): MetricCard[] {
    const partnerRows = this.buildOpportunityPartnerRankingRows(datasetBundle);
    const detailRows = this.buildOpportunityDetailRows(datasetBundle);
    const stats = this.buildOpportunitySummaryStats(datasetBundle, partnerRows, detailRows);
    return this.mergeMetricCardList([
      { name: '商机数量', value: stats.opportunityCount },
      { name: '商机金额', value: formatWanAmount(stats.totalAmount) },
      { name: '平均商机金额', value: stats.averageAmount > 0 ? formatWanAmount(stats.averageAmount) : '0 万元' },
      { name: '关联渠道商数', value: stats.partnerCount },
      { name: '非取消商机数', value: stats.effectiveOpportunityCount },
      ...metricCards,
    ]).slice(0, 6);
  }

  /**
   * 将渠道商下单模板中的历史合同指标名改成订单口径。
   *
   * 参数说明：`metricCard` 为执行层已经生成的指标卡。
   * 返回值说明：返回只调整名称、不改动数值的指标卡。
   * 调用注意事项：底层仍可能复用合同域字段，但用户可见模板必须统一叫订单或下单。
   */
  private normalizeChannelOrderMetricCardName(metricCard: MetricCard): MetricCard {
    return {
      ...metricCard,
      name: metricCard.name.replace(/合同/g, '订单'),
    };
  }

  private mergeMetricCardList(metricCards: MetricCard[]): MetricCard[] {
    const metricMap = new Map<string, MetricCard>();
    for (const metricCard of metricCards) {
      if (!metricMap.has(metricCard.name)) {
        metricMap.set(metricCard.name, this.normalizeMetricCard(metricCard));
      }
    }

    return [...metricMap.values()];
  }

  /**
   * 识别本次报告应套用的业务展示模板。
   *
   * 参数说明：`workflow` 为问题与规划上下文，`datasetBundle` 为已执行数据。
   * 返回值说明：返回服务商发展运营模板、渠道订单汇总模板或空。
   * 调用注意事项：服务商发展运营看板和渠道下单报告是用户明确给定的业务模板；
   * 只有显式四段经营问题才保留综合经营报告，避免模板之间互相抢占。
   */
  private resolveBusinessReportTemplate(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): BusinessReportTemplate | undefined {
    if (this.hasCrmQuestionCatalogTemplateOverride(workflow)) {
      return undefined;
    }

    if (
      this.isPartnerDevelopmentOperationsReport(workflow, datasetBundle) &&
      !this.isNarrowPartnerProfileDetailQuestion(workflow) &&
      !this.isExplicitFourPartBusinessChainQuestion(workflow) &&
      !this.hasUserRequirementOverridingPartnerDevelopmentTemplate(workflow)
    ) {
      return 'partner-development-operations';
    }

    if (this.isCompositeBusinessReport(workflow, datasetBundle)) {
      return undefined;
    }

    if (
      this.isChannelOrderSummaryReport(workflow, datasetBundle) &&
      !this.hasUserRequirementOverridingChannelOrderTemplate(workflow)
    ) {
      return 'channel-order-summary';
    }

    if (
      this.isOpportunityDefaultSummaryReport(workflow, datasetBundle) &&
      !this.hasUserRequirementOverridingOpportunityTemplate(workflow)
    ) {
      return 'opportunity-default-summary';
    }

    return undefined;
  }

  /**
   * 判断 300 问标准模板是否应覆盖历史固定报告模板。
   *
   * 参数说明：`workflow` 为本次问题和规划上下文。
   * 返回值说明：命中 300 问目录且用户没有明确点名历史模板时返回 `true`。
   * 可能抛出的异常：无。
   * 调用注意事项：历史“渠道下单汇总”“全国代理商看板”只适合点名模板的场景；300 问验收必须先服从原问题专题。
   */
  private hasCrmQuestionCatalogTemplateOverride(workflow: AnalysisWorkflowPlan): boolean {
    const questionText = `${workflow.questionText} ${workflow.normalizedQuestion ?? ''}`;
    const catalogRule = resolveCrmAnalysisQuestionTemplateRuleByText(questionText);
    if (!catalogRule) {
      return false;
    }

    return !/(渠道商?下单汇总|渠道商?下单分析报告|全国代理商发展运营数据看板|服务商发展运营数据看板|商机经营分析报告)/u.test(
      questionText,
    );
  }

  /**
   * 判断是否为商机默认经营分析报告。
   *
   * 参数说明：`workflow` 为问题上下文，`datasetBundle` 为执行结果。
   * 返回值说明：只问商机情况、分析、总览、全部或当前时返回 true。
   * 调用注意事项：这里只选择展示模板，不改变执行层已经完成的取数结果。
   */
  private isOpportunityDefaultSummaryReport(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): boolean {
    const questionText = `${workflow.questionText} ${workflow.normalizedQuestion ?? ''}`;
    const hasOpportunitySubject = workflow.domain === 'opportunity-analysis' && /(商机|机会)/u.test(questionText);
    const hasOverviewSignal = /(商机).*(情况|分析|概况|总览|整体|全部|当前|最近|近)|(情况|分析|概况|总览|整体|全部|当前|最近|近).*(商机)/u.test(
      questionText,
    );
    const hasOpportunityOverviewAdapter = datasetBundle.slices.some((item) =>
      /fixed-opportunity-partner-overview|opportunity-partner-contribution|opportunity-metric-summary/u.test(
        `${item.matchedAdapter ?? ''} ${item.taskTitle}`,
      ),
    );

    return hasOpportunitySubject && (hasOverviewSignal || hasOpportunityOverviewAdapter);
  }

  /**
   * 判断用户是否明确覆盖商机默认模板。
   *
   * 参数说明：`workflow` 为用户问题、归一问题和输出偏好。
   * 返回值说明：用户明确要某单一维度、排行、趋势、阶段、风险或指定呈现方式时返回 true。
   * 调用注意事项：时间范围和区域范围不算覆盖，默认模板应在这些范围内继续工作。
   */
  private hasUserRequirementOverridingOpportunityTemplate(workflow: AnalysisWorkflowPlan): boolean {
    const questionText = `${workflow.questionText} ${workflow.normalizedQuestion ?? ''}`;
    return /(只看|仅看|不要|不需要|单独|分别|列一下|列出|名单|明细|清单|阶段|分布|排名|排行|趋势|走势|同比|环比|风险|没有进展|没进展|未进展|停滞|未更新|超期|逾期|图表|导出|Excel|TOP\s*\d+|前\s*(三|五|十|\d+)|按.+(渠道商|服务商|客户|负责人|阶段|状态|月份|月度|季度|年度|区域|大区|部门))/iu.test(
      questionText,
    );
  }

  /**
   * 判断是否为服务商发展、开拓或运营相关报告。
   *
   * 参数说明：`workflow` 为问题上下文，`datasetBundle` 为执行结果。
   * 返回值说明：命中服务商、渠道商、代理商发展开拓、覆盖、等级或技术认证时返回 true。
   */
  private isPartnerDevelopmentOperationsReport(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): boolean {
    const combinedText = this.buildWorkflowDatasetText(workflow, datasetBundle);
    const hasPartnerSubject = /(服务商|渠道商|渠道|合作伙伴|代理商|经销商|伙伴)/u.test(combinedText);
    const hasDevelopmentSignal = /(发展|开拓|拓展|运营|画像|等级|级别|覆盖|技术服务|证书|认证|体系|入驻|加入)/u.test(
      combinedText,
    );
    const hasOrderOnlySignal = /(订单|下单|签单|成交)/u.test(workflow.questionText) &&
      !/(发展|开拓|拓展|运营|画像|等级|级别|覆盖|技术服务|证书|认证|体系)/u.test(workflow.questionText);
    const matchedPartnerProfile = datasetBundle.slices.some((item) =>
      /partner-profile|服务商开拓|服务商画像|合作伙伴开拓/u.test(
        `${item.matchedAdapter ?? ''} ${item.taskTitle}`,
      ),
    );

    return hasPartnerSubject && !hasOrderOnlySignal && (hasDevelopmentSignal || matchedPartnerProfile);
  }

  /**
   * 判断用户本轮要求是否应覆盖服务商发展运营默认看板。
   *
   * 参数说明：`workflow` 为用户问题、归一问题和结构化输出偏好。
   * 返回值说明：用户明确要求只看某范围、明细、名单、排行、对比或指定呈现方式时返回 `true`。
   * 调用注意事项：服务商发展运营看板只作为默认结构；用户提出具体需求时，报告结构必须优先服从用户。
   */
  private hasUserRequirementOverridingPartnerDevelopmentTemplate(workflow: AnalysisWorkflowPlan): boolean {
    const questionText = `${workflow.questionText} ${workflow.normalizedQuestion ?? ''}`;
    const hasExplicitTemplateRequest = /(全国代理商发展运营数据看板|服务商发展运营数据看板|服务商发展运营看板|代理商发展运营看板|渠道商发展运营看板)/u.test(
      questionText,
    );
    const overridePattern =
      /(只看|仅看|不要|不需要|单独|分别|列一下|列出|名单|明细|清单|多少|类型|类别|等级|状态|排名|排行|TOP\s*\d+|前\s*(三|五|十|\d+)|分布|占比|对比|同比|环比|趋势|图表|表格|导出|Excel|按.+(区域|大区|省份|城市|团队|部门|负责人|等级|级别|类型|状态|月份|月度|年度))/iu;
    if (hasExplicitTemplateRequest && !overridePattern.test(questionText)) {
      return false;
    }

    return overridePattern.test(questionText);
  }

  /**
   * 判断是否为渠道商主数据的窄明细查询。
   *
   * 参数说明：`workflow` 为用户原问题和归一化问题。
   * 返回值说明：用户明确要数量、类型、名单或明细时返回 true。
   * 调用注意事项：该类问题只需要精确清单，不应套发展运营大看板，避免混入商机/订单贡献口径。
   */
  private isNarrowPartnerProfileDetailQuestion(workflow: AnalysisWorkflowPlan): boolean {
    const questionText = `${workflow.questionText} ${workflow.normalizedQuestion ?? ''}`;
    const hasPartnerSubject = /(服务商|渠道商|渠道|合作伙伴|代理商|经销商|伙伴)/u.test(questionText);
    const hasDetailSignal = /(多少家|多少个|几家|几个|类型|类别|分类|分别|单独列|列一下|列出|名单|明细|清单|等级|级别|状态)/u.test(
      questionText,
    );
    const hasOperatingSignal = /(经营|运营|贡献|商机|订单|报备|金额|下单|成交|发展运营数据看板|看板)/u.test(
      questionText,
    );

    return hasPartnerSubject && hasDetailSignal && !hasOperatingSignal;
  }

  /**
   * 判断用户是否明确要求四段综合经营拆解。
   *
   * 参数说明：`workflow` 为问题上下文。
   * 返回值说明：同时出现伙伴、报备或商机、订单时返回 `true`。
   * 调用注意事项：只看用户原问题和归一问题，不使用执行后摘要，避免业务链快照把模板识别扩大化。
   */
  private isExplicitFourPartBusinessChainQuestion(workflow: AnalysisWorkflowPlan): boolean {
    const questionText = `${workflow.questionText} ${workflow.normalizedQuestion}`;
    const hasPartner = /(合作伙伴|服务商|渠道商|渠道|代理商|经销商|伙伴)/u.test(questionText);
    const hasRegistration = /(客户商机报备|客户报备|报备情况|报备)/u.test(questionText);
    const hasOpportunity = /(商机|机会)/u.test(questionText);
    const hasOrder = /(订单|下单|成单|签单|成交)/u.test(questionText);

    return hasPartner && hasOrder && (hasRegistration || hasOpportunity);
  }

  /**
   * 判断是否为订单或渠道下单汇总报告。
   *
   * 参数说明：`workflow` 为问题上下文，`datasetBundle` 为执行结果。
   * 返回值说明：命中订单、下单、签单或合同成交口径时返回 true。
   */
  private isChannelOrderSummaryReport(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): boolean {
    const combinedText = this.buildWorkflowDatasetText(workflow, datasetBundle);
    return (
      workflow.domain === 'contract-conversion' ||
      /(订单|下单|签单|成交|合同金额|订单金额|渠道下单)/u.test(combinedText) ||
      datasetBundle.slices.some((item) => /order-/u.test(item.matchedAdapter ?? ''))
    );
  }

  /**
   * 判断用户本轮要求是否应覆盖渠道商下单默认模板。
   *
   * 参数说明：`workflow` 为用户问题、归一问题和结构化输出偏好。
   * 返回值说明：用户明确要求只看某区块、按指定维度、指定明细或指定呈现方式时返回 `true`。
   * 调用注意事项：渠道商下单模板只是默认交付框架；一旦用户说明具体需求，报告结构必须先服从用户问题。
   */
  private hasUserRequirementOverridingChannelOrderTemplate(workflow: AnalysisWorkflowPlan): boolean {
    const questionText = `${workflow.questionText} ${workflow.normalizedQuestion ?? ''}`;
    const hasExplicitTemplateRequest = /(渠道商?下单汇总|渠道商?下单分析报告|渠道商?下单看板|渠道商?下单模板|下单汇总分析)/u.test(
      questionText,
    );
    const hasOnlyTemplateRequest = hasExplicitTemplateRequest &&
      !/(只看|仅看|不要|不需要|单独|分别|列一下|列出|明细|清单|多少|分布|占比|对比|同比|环比|阶段|漏斗|类型|类别|图表|表格|导出|Excel|TOP\s*\d+|前\s*(三|五|十|\d+)|按.+(区域|大区|部门|客户|负责人|产品|状态|月份|月度|年度|阶段|类型|订单编号|客户名称))/iu.test(
        questionText,
      );
    if (hasOnlyTemplateRequest) {
      return false;
    }

    return /(只看|仅看|不要|不需要|单独|分别|列一下|列出|明细|清单|多少|分布|占比|对比|同比|环比|阶段|漏斗|类型|类别|图表|表格|导出|Excel|TOP\s*\d+|前\s*(三|五|十|\d+)|按.+(区域|大区|部门|客户|负责人|产品|状态|月份|月度|年度|阶段|类型|订单编号|客户名称))/iu.test(
      questionText,
    );
  }

  /**
   * 判断用户问题是否使用订单或下单口径。
   *
   * 参数说明：`workflow` 为用户问题和归一化问题上下文。
   * 返回值说明：用户明确提到订单、下单、成单、签单或成交时返回 `true`。
   * 调用注意事项：`contract-conversion` 是内部复用域，展示给用户时必须尊重原问题的业务对象。
   */
  private isOrderQuestionText(workflow: AnalysisWorkflowPlan): boolean {
    return /(订单|下单|成单|签单|成交)/u.test(
      `${workflow.questionText} ${workflow.normalizedQuestion}`,
    );
  }

  private buildWorkflowDatasetText(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): string {
    return [
      workflow.questionText,
      workflow.normalizedQuestion,
      workflow.domain,
      ...workflow.tasks.map((item) => item.title),
      ...datasetBundle.slices.flatMap((item) => [
        item.taskTitle,
        item.summary,
        item.matchedAdapter ?? '',
        item.sql,
        ...item.metricCards.map((metric) => `${metric.name}${metric.value}`),
      ]),
    ].join(' ');
  }

  /**
   * 判断当前报告是否为业务链组合经营报告。
   *
   * 参数说明：`workflow` 为执行计划，`datasetBundle` 为已执行完成的数据集包。
   * 返回值说明：当问题或任务同时覆盖渠道/伙伴、报备或商机、订单等多个经营对象时返回 `true`。
   * 调用注意事项：该判断只影响报告标题、摘要和卡片呈现，不改变任何 OpenAPI 查询、权限或审计边界。
   */
  private isCompositeBusinessReport(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): boolean {
    const matchedAdapterText = datasetBundle.slices
      .map((item) => item.matchedAdapter ?? '')
      .join(' ');
    if (
      /fixed-composite-operations|fixed-business-briefing|business-chain-snapshot|openapi-markdown-snapshot\.business-chain/u.test(
        matchedAdapterText,
      )
    ) {
      return true;
    }

    const combinedText = [
      workflow.questionText,
      workflow.normalizedQuestion,
      ...workflow.tasks.map((item) => item.title),
      ...datasetBundle.slices.flatMap((item) => [
        item.taskTitle,
        item.summary,
        item.sql,
        ...item.appliedFilters.map((filter) => `${filter.label}${filter.value}`),
      ]),
    ].join(' ');
    const hasPartner = /(合作伙伴|服务商|渠道商|渠道|代理商|经销商|伙伴)/u.test(combinedText);
    const hasRegistration = /(客户报备|报备)/u.test(combinedText);
    const hasOpportunity = /(商机|机会)/u.test(combinedText);
    const hasOrder = /(订单|下单|成单|签单|成交)/u.test(combinedText);
    const hasBusinessChain = hasPartner && hasOrder && (hasRegistration || hasOpportunity);

    return hasBusinessChain && (workflow.tasks.length >= 3 || datasetBundle.slices.length >= 3);
  }

  /**
   * 生成组合经营报告执行摘要。
   *
   * 参数说明：`workflow` 为用户问题上下文，`datasetBundle` 为统一数据集包，`metricCards` 为关键指标。
   * 返回值说明：返回面向业务用户的多区块摘要，避免把组合经营误写成单一排名或合同报告。
   * 调用注意事项：摘要只引用已经进入结果包的指标，不在展示层重新计算任何业务数值。
   */
  private buildCompositeExecutiveSummary(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
  ): string {
    const sectionTitles = Array.from(
      new Set(
        datasetBundle.slices
          .flatMap((item) => [
            item.taskTitle.replace(/统计$/u, '').replace(/分析$/u, ''),
            ...item.tableRows
              .map((row) => String(row.businessSection ?? '').trim())
              .filter(Boolean),
          ])
          .filter(Boolean),
      ),
    ).slice(0, 4);
    const metricSummary = this.prioritizeCompositeMetricCards(metricCards)
      .slice(0, 4)
      .map((item) => `${item.name} ${item.value}`)
      .join('；');
    const sectionSummary = sectionTitles.length > 0
      ? `已拆解为 ${sectionTitles.join('、')} ${sectionTitles.length} 个经营区块`
      : `已拆解为 ${datasetBundle.slices.length} 个经营区块`;
    const metricText = metricSummary ? `，关键指标包括 ${metricSummary}` : '';
    const sourceLabel = datasetBundle.slices.some(
      (slice) => slice.executionSource === 'OPENAPI_MARKDOWN_SNAPSHOT',
    )
      ? 'CRM 已同步真实明细数据'
      : '联软标准 OpenAPI 真实数据';

    return `${workflow.normalizedQuestion} ${sectionSummary}，并基于${sourceLabel}完成只读分析${metricText}。后续建议以渠道商为主线复核客户报备、商机推进和订单转化断点。`;
  }

  /**
   * 生成服务商发展运营模板摘要。
   *
   * 参数说明：`workflow` 为用户问题，`datasetBundle` 为统一结果包，`metricCards` 为关键指标。
   * 返回值说明：按发展运营看板口径概述规模、覆盖、经营贡献和后续动作。
   */
  private buildPartnerDevelopmentExecutiveSummary(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
  ): string {
    const rows = this.resolvePartnerDevelopmentRows(datasetBundle);
    const regionRows = this.buildRegionSummaryRows(rows);
    const metricText = metricCards.slice(0, 4).map((item) => `${item.name} ${item.value}`).join('；');
    const regionText = regionRows.length > 0
      ? `，覆盖贡献最高区域为 ${this.resolveRowLabel(regionRows[0])}`
      : '';
    return `${workflow.normalizedQuestion} 已按“全国代理商发展运营数据看板”结构组织结果，覆盖服务商规模、近3年签约 & 商机趋势、大区签约额对比、省份代理商覆盖和渠道商体系明细${regionText}。${metricText ? `关键指标：${metricText}。` : ''}后续建议按区域覆盖、服务能力和真实商机/订单贡献做分层运营。`;
  }

  /**
   * 生成渠道订单汇总模板摘要。
   *
   * 参数说明：`workflow` 为用户问题，`datasetBundle` 为统一结果包，`metricCards` 为关键指标。
   * 返回值说明：按渠道下单汇总报告口径概述 KPI、集中度、趋势和明细。
   */
  private buildChannelOrderExecutiveSummary(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
  ): string {
    const rows = this.rankRowsByAmount(this.resolveChannelOrderRows(datasetBundle), ORDER_AMOUNT_FIELD_KEYS);
    const concentrationRows = this.buildOrderConcentrationRows(rows);
    const topPartner = rows[0];
    const top5Share = concentrationRows[0]?.shareText;
    const metricText = metricCards.slice(0, 4).map((item) => `${item.name} ${item.value}`).join('；');
    const topText = topPartner
      ? `，当前排名第一渠道为 ${this.resolveRowLabel(topPartner)}`
      : '';
    const concentrationText = top5Share ? `，TOP 5 渠道金额占比 ${top5Share}` : '';
    return `${workflow.normalizedQuestion} 已按“渠道商下单汇总分析报告”框架组织结果，覆盖订单 KPI、渠道集中度、年度趋势、TOP 排名和订单明细${topText}${concentrationText}。${metricText ? `关键指标：${metricText}。` : ''}后续建议重点复盘头部渠道和一次性下单渠道。`;
  }

  /**
   * 生成商机默认分析模板摘要。
   *
   * 参数说明：`workflow` 为用户问题，`datasetBundle` 为统一结果包，`metricCards` 为关键指标。
   * 返回值说明：按商机经营分析口径概述 KPI、渠道 TOP、集中度、趋势和明细。
   */
  private buildOpportunityDefaultExecutiveSummary(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    metricCards: MetricCard[],
  ): string {
    const partnerRows = this.buildOpportunityPartnerRankingRows(datasetBundle);
    const detailRows = this.buildOpportunityDetailRows(datasetBundle);
    const stats = this.buildOpportunitySummaryStats(datasetBundle, partnerRows, detailRows);
    const concentrationRows = this.buildOpportunityConcentrationRows(partnerRows, stats.totalAmount);
    const topPartner = partnerRows[0];
    const topText = topPartner
      ? `，当前商机金额第一渠道为 ${this.resolveOpportunityPartnerName(topPartner)}`
      : '';
    const concentrationText = concentrationRows[0]?.shareText
      ? `，TOP5 渠道商机金额占比 ${concentrationRows[0].shareText}`
      : '';
    const metricText = metricCards.slice(0, 4).map((item) => `${item.name} ${item.value}`).join('；');
    return `${workflow.normalizedQuestion} 已按“商机经营分析报告”默认模板组织结果，覆盖商机数量、商机金额、平均商机金额、渠道 TOP5/TOP10/TOP20、头部集中度、长尾效应、商机大单、年度/半年度分析、TOP10 商机和非取消商机明细${topText}${concentrationText}。${metricText ? `关键指标：${metricText}。` : ''}后续建议重点复盘头部渠道、大单推进和长尾渠道激活。`;
  }

  /**
   * 解析组合经营报告标题。
   *
   * 参数说明：`workflow` 为执行计划，`datasetBundle` 为结果数据集。
   * 返回值说明：返回多对象经营标题，确保不会被合同域兜底标题覆盖。
   * 调用注意事项：标题只表达业务主题，不暴露执行器、fallback 或内部域名。
   */
  private resolveCompositeReportTitle(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
  ): string {
    const originalText = [workflow.questionText, workflow.normalizedQuestion].join(' ');
    const originalHasPartner = /(合作伙伴|服务商|渠道商|渠道|伙伴)/u.test(originalText);
    const originalHasOpportunity = /(商机|机会)/u.test(originalText);
    const originalHasOrder = /(订单|下单|成单|签单|成交)/u.test(originalText);
    const originalHasRegistration = /(客户商机报备|客户报备|报备情况|报备)/u.test(originalText);
    if (originalHasPartner && originalHasOpportunity && originalHasOrder && !originalHasRegistration) {
      return '渠道商商机与订单分析报告';
    }

    const combinedText = [
      workflow.questionText,
      workflow.normalizedQuestion,
      ...datasetBundle.slices.map((item) => item.taskTitle),
    ].join(' ');
    const hasPartnerDevelopment = /(合作伙伴|服务商|渠道商|渠道|伙伴).*(开拓|拓展|发展|开发|情况)/u.test(
      combinedText,
    );
    if (hasPartnerDevelopment) {
      return '合作伙伴开拓、客户报备与订单经营分析报告';
    }

    if (/(商机).*(季度|对比|比较|区域|大区)|大区商机季度对比/u.test(combinedText)) {
      return '大区商机季度对比分析报告';
    }

    if (/(渠道商|服务商|合作伙伴|伙伴)/u.test(combinedText)) {
      return '渠道商经营贡献分析报告';
    }

    return '联软 CRM 组合经营分析报告';
  }

  /**
   * 构造组合经营报告的重点区块。
   *
   * 参数说明：`datasetBundle` 为统一数据集包。
   * 返回值说明：返回每个业务区块的摘要和首个关键指标。
   * 调用注意事项：这里不做排序排名推断，只帮助用户快速看到本次覆盖了哪些经营面。
   */
  private buildCompositeFocusSection(
    datasetBundle: AnalysisDatasetBundle,
  ): AnalysisReportSection | undefined {
    const businessRows = datasetBundle.slices.flatMap((slice) =>
      slice.tableRows
        .filter((row) => row.businessSection)
        .map((row) => {
          const amountText = String(row.amountText ?? '').trim();
          const count = Number(row.count ?? 0);
          const countText = Number.isFinite(count) ? `${count} 条/家` : '暂无数量';
          return `${String(row.businessSection)}：${countText}${amountText ? `，金额 ${amountText}` : ''}。`;
        }),
    );
    if (businessRows.length > 1) {
      return {
        sectionType: 'focus-list',
        title: '经营区块',
        items: businessRows.slice(0, 6),
        temporalScope: datasetBundle.temporalScope,
      };
    }

    const items = datasetBundle.slices.slice(0, 4).map((slice) => {
      const primaryMetric = this.prioritizeCompositeMetricCards(slice.metricCards)[0];
      const metricText = primaryMetric ? `，核心指标 ${primaryMetric.name} ${primaryMetric.value}` : '';
      return `${slice.taskTitle}${metricText}。${slice.summary}`;
    });
    if (items.length === 0) {
      return undefined;
    }

    return {
      sectionType: 'focus-list',
      title: '经营区块',
      items,
      temporalScope: datasetBundle.temporalScope,
    };
  }

  /**
   * 对组合经营指标做业务优先级排序。
   *
   * 参数说明：`metricCards` 为各切片合并后的指标卡。
   * 返回值说明：优先返回伙伴、报备、商机、订单四段指标，再追加其余指标。
   * 调用注意事项：排序只影响展示顺序，不新增、不删除、不改写任何指标值。
   */
  private prioritizeCompositeMetricCards(metricCards: MetricCard[]): MetricCard[] {
    const priorityPatterns = [
      /渠道商数|命中渠道数|服务商数量|合作伙伴数/u,
      /客户报备数|命中报备数|报备数/u,
      /商机数|命中商机数|商机数量/u,
      /商机金额|累计商机金额|新增商机金额/u,
      /订单数|命中订单数|有效订单数量/u,
      /订单金额|累计订单金额|有效订单金额|订单总额/u,
      /技术服务商|合作等级数|正常状态服务商/u,
    ];
    const selected: MetricCard[] = [];
    const selectedNames = new Set<string>();

    for (const pattern of priorityPatterns) {
      const matchedMetric = metricCards.find(
        (item) => pattern.test(item.name) && !selectedNames.has(item.name),
      );
      if (matchedMetric) {
        selected.push(matchedMetric);
        selectedNames.add(matchedMetric.name);
      }
    }

    return [
      ...selected,
      ...metricCards.filter((item) => !selectedNames.has(item.name)),
    ];
  }

  private buildTrendExecutiveSummary(
    normalizedQuestion: string,
    rows: Array<Record<string, unknown>>,
  ): string {
    const trendStats = this.buildTrendStats(rows);
    if (!trendStats) {
      return `${normalizedQuestion} 已生成趋势报告，当前共覆盖 ${rows.length} 个时间分段，可直接查看波动变化与关键节点。`;
    }

    if (trendStats.segmentCount === 1) {
      return `${normalizedQuestion} 已生成趋势报告，当前仅覆盖 ${trendStats.firstLabel} 这 1 个时间分段，对应指标为 ${trendStats.firstValue}。`;
    }

    return `${normalizedQuestion} 已生成趋势报告，覆盖 ${trendStats.firstLabel} 至 ${trendStats.lastLabel} 共 ${trendStats.segmentCount} 个时间分段，峰值出现在 ${trendStats.peakLabel}（${trendStats.peakValue}），最近一期为 ${trendStats.lastLabel}（${trendStats.lastValue}）。`;
  }

  private buildTrendFinding(
    item: AnalysisDatasetSlice,
    index: number,
  ): AnalysisKeyFinding {
    const trendStats = this.buildTrendStats(item.tableRows);
    if (!trendStats) {
      return {
        title: `趋势观察 ${index + 1}`,
        detail: `${item.taskTitle} 当前未形成可解释的趋势分段。`,
        tone: 'risk',
        datasetId: item.datasetId,
      };
    }

    if (trendStats.segmentCount === 1) {
      return {
        title: `趋势观察 ${index + 1}`,
        detail: `${item.taskTitle} 当前仅覆盖 ${trendStats.firstLabel}，对应指标为 ${trendStats.firstValue}。`,
        tone: 'neutral',
        datasetId: item.datasetId,
      };
    }

    return {
      title: `趋势观察 ${index + 1}`,
      detail: `${item.taskTitle} 覆盖 ${trendStats.firstLabel} 至 ${trendStats.lastLabel} 共 ${trendStats.segmentCount} 个时间分段，峰值出现在 ${trendStats.peakLabel}（${trendStats.peakValue}），最近一期为 ${trendStats.lastLabel}（${trendStats.lastValue}），${this.describeTrendDirection(trendStats.firstNumber, trendStats.lastNumber)}。`,
      tone: this.resolveTrendTone(trendStats.firstNumber, trendStats.lastNumber),
      datasetId: item.datasetId,
    };
  }

  private buildTrendStats(rows: Array<Record<string, unknown>>): {
    segmentCount: number;
    firstLabel: string;
    lastLabel: string;
    peakLabel: string;
    firstNumber: number;
    lastNumber: number;
    peakNumber: number;
    firstValue: string;
    lastValue: string;
    peakValue: string;
  } | null {
    if (!rows.length) {
      return null;
    }

    const normalizedRows = rows.map((row) => ({
      label: this.resolveRowLabel(row),
      number: this.resolveRowNumber(row),
      source: row,
    }));
    const firstRow = normalizedRows[0];
    const lastRow = normalizedRows.at(-1) ?? firstRow;
    const peakRow = normalizedRows.reduce((currentPeak, row) =>
      row.number > currentPeak.number ? row : currentPeak,
    );

    return {
      segmentCount: normalizedRows.length,
      firstLabel: firstRow.label,
      lastLabel: lastRow.label,
      peakLabel: peakRow.label,
      firstNumber: firstRow.number,
      lastNumber: lastRow.number,
      peakNumber: peakRow.number,
      firstValue: this.formatRowValue(firstRow.source),
      lastValue: this.formatRowValue(lastRow.source),
      peakValue: this.formatRowValue(peakRow.source),
    };
  }

  /**
   * 解析结果行的业务展示名称。
   *
   * 参数说明：`row` 为 OpenAPI 或受控查询返回的聚合/明细行。
   * 返回值说明：优先返回渠道商、客户、商机、区域等真实业务名称，缺失时返回兜底分组名。
   * 调用注意事项：这里不生成占位名称，只读取结果包中已有的白名单字段。
   */
  private resolveRowLabel(row: Record<string, unknown>): string {
    return String(
      row.name ??
        row.partnerName ??
        row.partner_name ??
        row.partner ??
        row.channelName ??
        row.channel_name ??
        row.customerName ??
        row.customer_name ??
        row.opportunityName ??
        row.opportunity_name ??
        row.projectName ??
        row.project_name ??
        row.title ??
        row.region ??
        row.region_name ??
        row.bigRegion ??
        row.big_region ??
        row.month_label ??
        row.monthLabel ??
        row.bucket_label ??
        row.bucketLabel ??
        row.ownerName ??
        row.category ??
        '未命名分组',
    );
  }

  /**
   * 解析结果行的金额或主指标值。
   *
   * 参数说明：`row` 为查询结果行，`preferredFields` 为当前模板的优先金额字段。
   * 返回值说明：返回可计算数值，无法解析时返回 0。
   * 调用注意事项：订单模板会优先取订单金额，避免业务链行中的商机金额混入订单榜。
   */
  private resolveRowNumber(
    row: Record<string, unknown>,
    preferredFields: readonly string[] = [],
  ): number {
    for (const field of preferredFields) {
      if (Object.prototype.hasOwnProperty.call(row, field)) {
        return this.toFiniteNumber(row[field]);
      }
    }

    const rawValue =
      row.amount ??
        row.totalAmount ??
        row.total_amount ??
        row.orderAmount ??
        row.order_amount ??
        row.contractAmount ??
        row.contract_amount ??
        row.opportunityAmount ??
        row.opportunity_amount ??
        row.expectedAmount ??
        row.expected_amount ??
        row.quoteAmount ??
        row.quote_amount ??
        row.metric_value ??
        row.metricValue ??
        row.count ??
        0;
    return this.toFiniteNumber(rawValue);
  }

  /**
   * 解析结果行的记录数量。
   *
   * 参数说明：`row` 为查询结果行，`preferredFields` 为当前模板优先数量字段。
   * 返回值说明：返回订单数、合同数、商机数或通用记录数，缺失时返回 0。
   */
  private resolveRowCountNumber(
    row: Record<string, unknown>,
    preferredFields: readonly string[] = [],
  ): number {
    for (const field of preferredFields) {
      if (Object.prototype.hasOwnProperty.call(row, field)) {
        return this.toFiniteNumber(row[field]);
      }
    }

    const rawValue =
      row.count ??
        row.totalCount ??
        row.total_count ??
        row.orderCount ??
        row.order_count ??
        row.contractCount ??
        row.contract_count ??
        row.opportunityCount ??
        row.opportunity_count ??
        row.registrationCount ??
        row.registration_count ??
        0;
    return this.toFiniteNumber(rawValue);
  }

  /**
   * 将接口返回的数字字符串转为有限数值。
   *
   * 参数说明：`value` 为可能带逗号或万元单位的数值。
   * 返回值说明：返回有限数字，异常输入统一按 0 处理，避免展示层出现 NaN。
   */
  private toFiniteNumber(value: unknown): number {
    const isWanAmountText = typeof value === 'string' && value.includes('万元');
    const normalizedValue = typeof value === 'string'
      ? value.replace(/,/g, '').replace(/万元/u, '').trim()
      : value;
    const numberValue = Number(normalizedValue ?? 0);
    if (!Number.isFinite(numberValue)) {
      return 0;
    }

    return isWanAmountText ? numberValue * 10000 : numberValue;
  }

  /**
   * 将金额类结果行转为统一“万元”展示，非金额行保留普通数值。
   *
   * 参数说明：`row` 为受控查询结果行。
   * 返回值：面向用户的数值文本。
   */
  private formatRowValue(
    row: Record<string, unknown>,
    preferredAmountFields: readonly string[] = [],
  ): string {
    if (this.hasAmountValue(row, preferredAmountFields)) {
      return formatWanAmount(this.resolveRowNumber(row, preferredAmountFields));
    }

    return this.resolveRowNumber(row).toLocaleString('zh-CN');
  }

  private formatYuanAmount(value: number): string {
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * 判断结果行是否含有金额字段，避免把记录数误格式化成万元。
   *
   * 参数说明：`row` 为任意结果行。
   * 返回值：存在可解析金额时返回 true。
   */
  private hasAmountValue(
    row: Record<string, unknown>,
    preferredAmountFields: readonly string[] = [],
  ): boolean {
    const candidateFields = [
      ...preferredAmountFields,
      'amount',
      'totalAmount',
      'total_amount',
      'orderAmount',
      'order_amount',
      'contractAmount',
      'contract_amount',
      'opportunityAmount',
      'opportunity_amount',
      'expectedAmount',
      'expected_amount',
      'quoteAmount',
      'quote_amount',
    ];
    return candidateFields.some((field) =>
      row[field] !== undefined && row[field] !== null && this.toFiniteNumber(row[field]) > 0,
    );
  }

  /**
   * 统一规范金额类指标卡展示单位。
   *
   * 参数说明：`metricCard` 为查询任务或报告派生的指标卡。
   * 返回值：金额类指标卡使用万元，数量和占比保持原样。
   */
  private normalizeMetricCard(metricCard: MetricCard): MetricCard {
    if (!/金额|收入|回款|应收|合同额/u.test(metricCard.name)) {
      return metricCard;
    }

    if (String(metricCard.value).includes('万元')) {
      return metricCard;
    }

    return {
      ...metricCard,
      value: formatWanAmount(metricCard.value),
    };
  }

  private describeTrendDirection(firstValue: number, lastValue: number): string {
    if (lastValue > firstValue) {
      return '最近一期高于起始月份';
    }

    if (lastValue < firstValue) {
      return '最近一期较起始月份回落';
    }

    return '最近一期与起始月份基本持平';
  }

  private resolveTrendTone(
    firstValue: number,
    lastValue: number,
  ): AnalysisKeyFinding['tone'] {
    if (lastValue > firstValue) {
      return 'positive';
    }

    if (lastValue < firstValue) {
      return 'risk';
    }

    return 'neutral';
  }

  private resolveReportTitle(
    workflow: AnalysisWorkflowPlan,
    datasetBundle: AnalysisDatasetBundle,
    businessReportTemplate?: BusinessReportTemplate,
  ): string {
    const primarySlice = datasetBundle.slices[0];
    const fallbackTitle = primarySlice.taskTitle;
    if (businessReportTemplate === 'partner-development-operations') {
      return '服务商发展运营数据看板';
    }

    if (this.isCompositeBusinessReport(workflow, datasetBundle)) {
      return this.resolveCompositeReportTitle(workflow, datasetBundle);
    }

    if (businessReportTemplate === 'channel-order-summary') {
      return '渠道商下单汇总分析报告';
    }

    if (businessReportTemplate === 'opportunity-default-summary') {
      return '商机经营分析报告';
    }

    const matchedAdapter = primarySlice.matchedAdapter ?? '';
    if (
      matchedAdapter.includes('fixed-composite-operations') ||
      matchedAdapter.includes('fixed-business-briefing')
    ) {
      return fallbackTitle ? `${fallbackTitle}报告` : '联软 CRM 组合经营分析报告';
    }

    if (
      matchedAdapter.includes('fixed-order-opportunity-overview') ||
      matchedAdapter.includes('fixed-partner-opportunity-growth')
    ) {
      return fallbackTitle ? `${fallbackTitle}报告` : '联软 CRM 分块经营分析报告';
    }

    if (
      this.isNarrowPartnerProfileDetailQuestion(workflow) ||
      matchedAdapter.includes('partner-profile')
    ) {
      return fallbackTitle ? `${fallbackTitle}报告` : '渠道商画像明细分析报告';
    }

    if (workflow.analysisFacetProfile === 'owner-performance-ranking') {
      return fallbackTitle ? `${fallbackTitle}报告` : '负责人经营分析报告';
    }

    if (workflow.analysisFacetProfile === 'opportunity-risk') {
      return '商机风险分析报告';
    }

    if (workflow.domain === 'contract-conversion') {
      return this.isOrderQuestionText(workflow) ? '订单分析报告' : '合同转化分析报告';
    }

    if (workflow.domain === 'customer-relationship') {
      return '客户关系分析报告';
    }

    return fallbackTitle ? `${fallbackTitle}报告` : 'CRM 智能分析报告';
  }

  private resolveVariant(primarySlice: AnalysisDatasetSlice): AnalysisReportVariant {
    if (primarySlice.resultKind === 'metric-summary') {
      return 'ranking';
    }

    if (primarySlice.resultKind === 'time-trend') {
      return 'trend';
    }

    if (
      primarySlice.resultKind === 'stage-distribution' ||
      primarySlice.resultKind === 'category-distribution' ||
      primarySlice.resultKind === 'department-contribution' ||
      primarySlice.resultKind === 'partner-contribution'
    ) {
      return 'distribution';
    }

    if (
      primarySlice.resultKind === 'owner-ranking' ||
      primarySlice.resultKind === 'risk-overview'
    ) {
      return 'ranking';
    }

    return 'summary';
  }

  private buildAvailableActions(hasData: boolean): AvailableAction[] {
    return [
      { actionType: 'FOLLOW_UP', enabled: true },
      { actionType: 'RERUN', enabled: true },
      { actionType: 'SAVE_TO_RECENT', enabled: true },
      {
        actionType: 'EXPORT',
        enabled: hasData,
        reason: hasData ? undefined : '当前没有可导出的结果数据。',
      },
    ];
  }

  private buildRecordScopeSummary(
    metricCards: MetricCard[],
    groupCount: number,
  ): string {
    const countMetric = metricCards.find(
      (item) => item.name !== '分组数量' && item.name.endsWith('数'),
    );
    if (!countMetric) {
      return '';
    }

    const recordCount = Number(String(countMetric.value).replace(/,/g, ''));
    if (!Number.isFinite(recordCount) || recordCount <= 0) {
      return '';
    }

    const groupLabel = groupCount > 0 ? `${groupCount} 个业务分组` : '当前分组结果';
    return `本次展示为 ${groupLabel}，共覆盖 ${recordCount.toLocaleString()} 条${countMetric.name.replace(/^命中/u, '').replace(/数$/u, '记录')}。`;
  }

  private resolveRankingRows(datasetBundle: AnalysisDatasetBundle): Array<Record<string, unknown>> {
    return datasetBundle.slices.find((item) => item.resultKind === 'owner-ranking')?.tableRows ??
      datasetBundle.slices[0]?.tableRows ??
      [];
  }

  private buildRankingStats(rows: Array<Record<string, unknown>>): {
    top1Share: number;
    top1ShareText: string;
    top3ShareText: string;
    avgTicketText: string;
    leaderGapText: string;
  } | null {
    if (!rows.length) {
      return null;
    }

    const totalAmount = rows.reduce((sum, item) => sum + this.resolveRowNumber(item), 0);
    const totalCount = rows.reduce((sum, item) => sum + Number(item.count ?? 0), 0);
    if (totalAmount <= 0 || totalCount <= 0) {
      return null;
    }

    const top1Amount = this.resolveRowNumber(rows[0]);
    const top3Amount = rows
      .slice(0, 3)
      .reduce((sum, item) => sum + this.resolveRowNumber(item), 0);
    const leaderGap = rows.length >= 2
      ? Math.max(this.resolveRowNumber(rows[0]) - this.resolveRowNumber(rows[1]), 0)
      : 0;
    const top1Share = top1Amount / totalAmount;
    const avgTicket = totalAmount / totalCount;

    return {
      top1Share,
      top1ShareText: `${(top1Share * 100).toFixed(1)}%`,
      top3ShareText: `${((top3Amount / totalAmount) * 100).toFixed(1)}%`,
      avgTicketText: formatWanAmount(avgTicket),
      leaderGapText: formatWanAmount(leaderGap),
    };
  }

  private resolveRiskMetricLabel(slice: AnalysisDatasetSlice): string {
    if (/未更新|未进展|停滞/u.test(slice.taskTitle)) {
      return '未更新商机金额';
    }

    if (/预计签约未报价/u.test(slice.taskTitle)) {
      return '预计签约未报价商机金额';
    }

    return '风险商机金额';
  }

  private resolveRiskRecordLabel(slice: AnalysisDatasetSlice): string {
    if (/未更新|未进展|停滞/u.test(slice.taskTitle)) {
      return '未更新商机';
    }

    if (/预计签约未报价/u.test(slice.taskTitle)) {
      return '预计签约未报价商机';
    }

    return '风险商机';
  }
}
