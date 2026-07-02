import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AnalysisResultRecord } from '../../shared/types/domain';
import { formatWanAmount, type AmountSourceUnit } from '../../shared/utils/business-amount.util';
import { AnalysisChannelPresenterService } from './analysis-channel-presenter.service';
import { AnalysisRequestRepository } from './analysis-request.repository';

interface PublicResultTableColumn {
  key: string;
  label: string;
}

interface PublicResultSection {
  sectionType: string;
  title: string;
  description?: string;
  rows?: Array<Record<string, unknown>>;
  items?: string[];
  chartType?: string;
  chartData?: Record<string, unknown>;
}

interface PublicReportChartBlock {
  title: string;
  viewType: string;
  series: Array<Record<string, unknown>>;
}

interface NormalizedCoverageRow extends Record<string, unknown> {
  province: string;
  label: string;
  partnerCount: number;
  levelGroups: Array<Record<string, unknown>>;
}

const PUBLIC_COLUMN_LABEL_MAP: Record<string, string> = {
  team: '团队',
  team_name: '团队',
  teamName: '团队',
  region: '区域',
  region_name: '区域',
  regionName: '区域',
  big_region: '大区',
  bigRegion: '大区',
  owner: '负责人',
  ownerId: '负责人ID',
  owner_id: '负责人ID',
  ownerName: '负责人',
  owner_name: '负责人',
  name: '名称',
  partner: '渠道商',
  partnerId: '渠道商ID',
  partner_id: '渠道商ID',
  partnerName: '渠道商',
  partner_name: '渠道商',
  partnerLevel: '合作等级',
  partner_level: '合作等级',
  partnerLevelName: '合作等级',
  partner_level_name: '合作等级',
  cooperationLevel: '合作级别',
  cooperation_level: '合作级别',
  cooperationLevelName: '合作级别',
  cooperation_level_name: '合作级别',
  partnerType: '渠道类型',
  partner_type: '渠道类型',
  partnerRole: '渠道角色',
  partner_role: '渠道角色',
  isTechnicalServiceProvider: '是否技术服务商',
  is_technical_service_provider: '是否技术服务商',
  technicalServiceProvider: '技术服务商',
  technicalServiceProviderType: '技术服务商类型',
  techServiceType: '技术服务商类型',
  tech_service_type: '技术服务商类型',
  techServiceTypeName: '技术服务商类型',
  tech_service_type_name: '技术服务商类型',
  status: '状态',
  statusName: '状态',
  joinDate: '加入日期',
  join_date: '加入日期',
  customer: '最终客户',
  customerId: '客户ID',
  customer_id: '客户ID',
  customer_name: '最终客户',
  customerName: '最终客户',
  customer_level: '客户级别',
  customerLevel: '客户级别',
  customer_category: '客户分类',
  customerCategory: '客户分类',
  opportunity_no: '商机编号',
  opportunityNo: '商机编号',
  opportunity_id: '商机编号',
  opportunityId: '商机编号',
  opportunity_name: '商机名称',
  opportunityName: '商机名称',
  project_name: '项目名称',
  projectName: '项目名称',
  opportunity_title: '项目名称',
  title: '项目名称',
  sales_stage: '销售阶段',
  salesStage: '销售阶段',
  stage: '销售阶段',
  stage_name: '销售阶段',
  stageName: '销售阶段',
  bucket_label: '分组',
  bucketLabel: '分组',
  month_label: '月份',
  monthLabel: '月份',
  amount: '金额（万元）',
  total_amount: '金额（万元）',
  totalAmount: '累计金额（万元）',
  totalAmountText: '累计金额',
  totalAmt: '累计金额（万元）',
  expected_amount: '预计有效收入（万元）',
  expectedAmount: '预计有效收入（万元）',
  contract_count: '合同数',
  contract_amount: '合同总额（万元）',
  valid_income: '有效收入（万元）',
  count: '记录数',
  totalCount: '记录数',
  row_count: '记录数',
  registration_count: '报备数',
  registrationCount: '报备数',
  opportunity_count: '商机数',
  opportunityCount: '商机数',
  opportunity_amount: '商机金额（万元）',
  opportunityAmount: '商机金额（万元）',
  quote_count: '报价数',
  quoteCount: '报价数',
  quote_amount: '报价金额（万元）',
  quoteAmount: '报价金额（万元）',
  order_count: '订单数',
  orderCount: '订单数',
  order_amount: '订单金额（万元）',
  orderAmount: '订单金额（万元）',
  technical_partner_count: '技术服务商数',
  technicalPartnerCount: '技术服务商数',
  new_partner_count: '新增渠道商数',
  newPartnerCount: '新增渠道商数',
  new_opportunity_count: '新增商机数',
  newOpportunityCount: '新增商机数',
  created_at: '创建时间',
  createdAt: '创建时间',
  updated_at: '最后更新时间',
  updatedAt: '最后更新时间',
  last_updated_at: '最后更新时间',
  lastUpdatedAt: '最后更新时间',
  source_updated_at: '最近进展时间',
  sourceUpdatedAt: '最近进展时间',
  stale_days: '未更新天数',
  staleDays: '未更新天数',
  expected_sign_date: '预计签单日期',
  expectedSignDate: '预计签单日期',
  sign_date: '签约日期',
  signDate: '签约日期',
  rank: '排名',
  sequence: '序号',
  level: '合作等级',
  partnerCount: '渠道商数',
  regionCount: '覆盖区域数',
  coveredRegions: '覆盖区域',
  province: '省份',
  coverageKey: '覆盖区域',
  levelSummary: '合作等级',
  businessSection: '经营区块',
  dataEndpoint: '数据文件',
  statisticScope: '统计口径',
  amountText: '金额',
  opportunityAmountText: '商机金额',
  quoteAmountText: '报价金额',
  orderAmountText: '订单金额',
  shareText: '渠道商占比',
  comparisonDimension: '对比维度',
  comparisonObject: '对比对象',
  quarterLabel: '季度',
  quarter_label: '季度',
  countChange: '数量变化',
  countChangeText: '数量变化',
  countChangeRate: '数量变化率',
  amountChange: '金额变化（万元）',
  amountChangeText: '金额变化',
  amountChangeRate: '金额变化率',
  comparisonConclusion: '对比结论',
  riskReason: '风险原因',
  risk_reason: '风险原因',
  actionSuggestion: '动作建议',
  actionAdvice: '动作建议',
  contributionShare: '贡献占比',
  opportunityShare: '商机金额占比',
  orderShare: '订单金额占比',
  opportunityToOrderRate: '商机到订单转化率',
  quoteToOrderRate: '报价到订单转化率',
  bigRegionLabel: '大区',
  partnerTotalCount: '渠道商总数',
  lepCount: 'LEP',
  goldCount: '金牌',
  signedTechnicalCount: '签约技术',
  nominationCount: '提名',
  signedCount2026: '2026签约数',
  signedAmount2026Text: '2026签约额',
  nationalShareText: '占全国比',
  percentage: '占比',
  percent: '占比',
  rate: '转化率',
  conversionRate: '转化率',
  conversion_rate: '转化率',
  oppCount: '商机数',
  oppAmount: '商机金额（万元）',
};

const PUBLIC_HIDDEN_ID_READABLE_PAIRS: Record<string, string[]> = {
  ownerId: ['ownerName', 'owner_name'],
  owner_id: ['ownerName', 'owner_name'],
  partnerId: ['partnerName', 'partner_name'],
  partner_id: ['partnerName', 'partner_name'],
  customerId: ['customerName', 'customer_name'],
  customer_id: ['customerName', 'customer_name'],
  opportunityId: ['opportunityName', 'opportunity_name'],
  opportunity_id: ['opportunityName', 'opportunity_name'],
  teamId: ['teamName', 'team_name'],
  team_id: ['teamName', 'team_name'],
  userId: ['ownerName', 'owner_name'],
  user_id: ['ownerName', 'owner_name'],
  ownerName: ['businessSection'],
};

const MAINLAND_CHINA_PROVINCE_NAMES = [
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

const COVERAGE_LEVEL_COLORS: Record<string, string> = {
  LEP: '#f0883e',
  金牌: '#b38700',
  签约技术: '#1f6feb',
  提名: '#656d76',
  一级渠道: '#0a7f68',
  二级渠道: '#45a36f',
  未设置: '#8b949e',
  未填写等级: '#8b949e',
};

const COVERAGE_LEVEL_ORDER = [
  'LEP',
  '金牌',
  '签约技术',
  '提名',
  '一级渠道',
  '二级渠道',
  '未设置',
  '未填写等级',
];

@Controller('public/analysis-results')
export class PublicAnalysisResultController {
  constructor(
    private readonly analysisRequestRepository: AnalysisRequestRepository,
    private readonly analysisChannelPresenterService: AnalysisChannelPresenterService,
  ) {}

  /**
   * 获取企业微信公开只读分析结果。
   *
   * 参数说明：`queryId` 为已完成分析请求 ID。
   * 返回值说明：返回可供免登录结果页展示的只读结果包。
   * 调用注意事项：该接口只展示已生成结果，不允许触发新查询、追问、导出受控数据或修改权限。
   */
  @Get(':queryId')
  getPublicAnalysisResult(@Param('queryId') queryId: string): Record<string, unknown> {
    return this.buildPublicResultPayload(queryId);
  }

  /**
   * 打开企业微信公开只读 HTML 分析报告。
   *
   * 参数说明：`queryId` 为已完成分析请求 ID。
   * 返回值说明：返回可在企业微信内直接打开或另存的 HTML 报告。
   * 调用注意事项：文件内容来源于已落库结果，不能携带 Cookie、Token、密钥或新的查询能力。
   */
  @Get(':queryId/file')
  @Header('Content-Type', 'text/html; charset=utf-8')
  downloadPublicAnalysisResultFile(
    @Param('queryId') queryId: string,
    @Res() response: Response,
  ): void {
    const payload = this.buildPublicResultPayload(queryId);
    const title = String(payload.title ?? 'CRM 智能分析结果');
    const html = this.renderPublicResultHtml(payload);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(title)}.html"`,
    );
    response.send(html);
  }

  /**
   * 构造公开只读结果包。
   *
   * 参数说明：`queryId` 为分析请求 ID。
   * 返回值说明：返回适合企微公开结果页展示的字段集合。
   * 可能抛出：请求不存在或结果尚未生成时抛出 404。
   */
  private buildPublicResultPayload(queryId: string): Record<string, unknown> {
    const requestRecord = this.analysisRequestRepository.findRequestById(queryId);
    if (!requestRecord) {
      throw new NotFoundException('分析结果不存在。');
    }

    const result = this.analysisRequestRepository.findResultByRequestId(queryId);
    if (!result) {
      throw new NotFoundException('分析结果尚未生成，请稍后在企业微信中重试。');
    }

    const presentedResult = this.analysisChannelPresenterService.presentResult(
      result,
      'web-console',
    );
    return this.toPublicResultPayload(queryId, requestRecord.status, presentedResult);
  }

  /**
   * 将内部分析结果裁剪为公开只读展示字段。
   *
   * 参数说明：`result` 为已按展示通道整理过的结果。
   * 返回值说明：不包含可执行动作、权限快照、SQL 审计和身份信息的结果视图。
   */
  private toPublicResultPayload(
    queryId: string,
    status: string,
    result: AnalysisResultRecord,
  ): Record<string, unknown> {
    const report = result.report
      ? {
          ...result.report,
          availableActions: [],
        }
      : undefined;

    return {
      queryId,
      status,
      title: result.title,
      summary: result.summary,
      report,
      temporalScope: result.temporalScope,
      keyFindings: result.keyFindings,
      scopeSummary: result.scopeSummary,
      appliedFilters: result.appliedFilters,
      metricCards: result.metricCards,
      primaryView: result.primaryView,
      secondaryViews: result.secondaryViews,
      tableRows: result.tableRows,
      rowCount: result.rowCount,
      dataFreshnessAt: result.dataFreshnessAt,
      consistencyToken: result.consistencyToken,
      explanation: result.explanation,
      groundedExplanation: result.groundedExplanation,
      groundedMarkdown: result.groundedMarkdown,
      markdownOutline: result.markdownOutline,
      emptyReason: result.emptyReason,
      completedAt: result.returnedAt,
      publicReadonly: true,
      availableActions: [],
    };
  }

  /**
   * 渲染公开结果 HTML 文件。
   *
   * 参数说明：`payload` 为公开只读结果包。
   * 返回值说明：返回完整 HTML 字符串。
   */
  private renderPublicResultHtml(payload: Record<string, unknown>): string {
    const report = payload.report as
      | {
          reportTitle?: string;
          executiveSummary?: string;
          metricCards?: Array<{ name: string; value: string | number }>;
          keyFindings?: Array<{ title: string; detail?: string }>;
          sourceNotes?: Array<{ key: string; label: string; description: string }>;
          footnotes?: string[];
          chartBlocks?: PublicReportChartBlock[];
          tableBlocks?: Array<{
            title: string;
            rows: Array<Record<string, unknown>>;
            columns?: Array<{ key: string; label: string }>;
          }>;
          dashboardTemplate?: {
            code?: string;
            displayName?: string;
            cardTitle?: string;
          };
          sections?: PublicResultSection[];
          groundedMarkdown?: string;
        }
      | undefined;
    const title = String(report?.reportTitle ?? payload.title ?? 'CRM 智能分析结果');
    const summary = String(report?.executiveSummary ?? payload.summary ?? '当前结果已生成。');
    const metricCards = report?.metricCards ?? [];
    const chartBlocks = report?.chartBlocks ?? [];
    const tableBlocks = report?.tableBlocks ?? [];
    const sections = report?.sections ?? [];
    const dashboardTemplate = report?.dashboardTemplate;
    const chartSections = this.buildPublicChartSections(sections, chartBlocks);

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHtml(title)}</title>
  ${this.renderDashboardChartScriptsHtml(chartSections)}
  <style>
    body{margin:0;background:#f3f6f8;color:#15202b;font-family:"Microsoft YaHei","PingFang SC",sans-serif;}
    .page{width:min(100% - 32px,1720px);max-width:none;margin:0 auto;padding:24px 0 40px;}
    .hero{background:linear-gradient(135deg,#eef8f4,#fff);border:1px solid #dfe9e5;border-radius:22px;padding:22px;box-shadow:0 16px 42px rgba(31,68,58,.08);}
    h1{margin:0 0 12px;font-size:24px;line-height:1.35;}
    h2{margin:0 0 12px;font-size:18px;}
    p{line-height:1.8;}
    .summary{margin:0;color:#43524b;font-size:15px;}
    .template-badge{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:7px 12px;border-radius:999px;background:#e7f5ef;color:#176b52;font-size:13px;font-weight:800;}
    .template-badge small{color:#64736d;font-weight:700;}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0;}
    .report-flow{display:grid;grid-template-columns:1fr;gap:18px;align-items:start;grid-auto-flow:dense;}
    .card,.section{background:#fff;border:1px solid #e3ebe7;border-radius:18px;padding:16px;}
    .metric-name{color:#64736d;font-size:13px;}
    .metric-value{margin-top:8px;font-size:26px;font-weight:800;color:#176b52;}
    ul{padding-left:20px;line-height:1.8;}
    table{width:100%;min-width:760px;border-collapse:collapse;font-size:14px;table-layout:auto;}
    th,td{max-width:240px;padding:11px 12px;border-bottom:1px solid #edf1ef;text-align:left;white-space:normal;word-break:break-word;vertical-align:top;}
    th{background:#f1f6f4;color:#20322e;font-weight:800;}
    .table-wrap--dropdown th{position:sticky;top:0;z-index:1;}
    tr:nth-child(even) td{background:#fafcfd;}
    .table-wrap{overflow-x:auto;border-radius:14px;border:1px solid #e3ebe7;}
    .table-wrap--dropdown{max-height:430px;overflow:auto;}
    .table-hint{margin:-4px 0 10px;color:#64736d;font-size:12px;}
    .table-hint strong{color:#176b52;}
    .meta{margin-top:16px;color:#7b8781;font-size:12px;}
    .dashboard-chart-section{padding:0;overflow:hidden;}
    .dashboard-chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 18px 8px;}
    .dashboard-chart-head h2{margin:0;font-size:18px;}
    .dashboard-chart-desc{margin:0;color:#64736d;font-size:13px;line-height:1.7;}
    .dashboard-chart{height:360px;margin:8px 18px 18px;border:1px solid #e3ebe7;border-radius:16px;background:#fbfdfc;}
    .dashboard-chart--map{height:430px;}
    .dashboard-chart-fallback{display:flex;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;color:#7b8781;}
    .dashboard-chart-insights{margin:0 18px 18px;padding:12px 16px;border-radius:14px;background:#f7faf9;color:#43524b;font-size:13px;line-height:1.8;}
    .coverage-shell{border:1px solid #d8e1dc;border-radius:16px;overflow:hidden;background:#fff;}
    .coverage-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-bottom:1px solid #e4ece8;}
    .coverage-head h2{margin:0;font-size:18px;}
    .coverage-legend{display:flex;align-items:center;gap:18px;color:#64736d;font-size:12px;white-space:nowrap;}
    .legend-dot{width:12px;height:12px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:-2px;}
    .coverage-body{display:grid;grid-template-columns:190px minmax(0,1fr);gap:18px;padding:18px;}
    .coverage-overview{padding:12px 2px;}
    .coverage-overview-label{font-size:12px;color:#64736d;margin-bottom:6px;}
    .coverage-overview-value{font-size:34px;line-height:1;font-weight:800;color:#238636;}
    .coverage-overview-value small{font-size:16px;color:#64736d;font-weight:600;}
    .coverage-overview-rate{margin-top:8px;color:#64736d;font-size:12px;}
    .coverage-uncovered{margin-top:8px;color:#cf222e;font-size:11px;line-height:1.7;}
    .coverage-map{width:100%;height:420px;min-height:360px;border:1px solid #e3ebe7;border-radius:16px;background:#fbfdfc;}
    .coverage-map-fallback{display:flex;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;color:#7b8781;}
    .coverage-description{margin:0 0 12px;color:#64736d;font-size:13px;}
    .modal-overlay{display:none;position:fixed;inset:0;z-index:999;background:rgba(10,20,16,.42);align-items:center;justify-content:center;padding:24px;}
    .modal-overlay.active{display:flex;}
    .modal-box{width:min(560px,calc(100vw - 40px));max-height:min(760px,calc(100vh - 56px));overflow:auto;background:#fff;border:1px solid #d8e1dc;border-radius:16px;padding:28px 32px;box-shadow:0 22px 70px rgba(15,33,27,.24);position:relative;}
    .modal-close{position:absolute;right:20px;top:16px;border:0;background:transparent;color:#6b7780;font-size:26px;line-height:1;cursor:pointer;}
    .modal-title{font-size:20px;font-weight:800;color:#17251f;margin-bottom:8px;}
    .modal-badge{display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;font-size:12px;vertical-align:2px;}
    .badge-covered{background:#dff3e6;color:#1a7f37;}
    .badge-uncovered{background:#fff0f0;color:#cf222e;}
    .modal-subtitle{color:#64736d;font-size:13px;margin-bottom:18px;}
    .modal-level-group{margin:0 0 16px;}
    .modal-level-header{display:flex;align-items:center;gap:8px;font-weight:800;color:#2f3b35;margin-bottom:8px;}
    .lv-dot{width:8px;height:8px;border-radius:50%;display:inline-block;}
    .lv-count{font-weight:700;color:#64736d;font-size:12px;}
    .modal-agent-list{line-height:1.9;color:#43524b;font-size:13px;}
    .agent-item{display:inline;}
    .modal-no-data{padding:18px;border-radius:12px;background:#f7faf9;color:#7b8781;text-align:center;}
    @media (min-width: 1280px){.hero{padding:26px 28px}.grid{grid-template-columns:repeat(6,minmax(0,1fr))}.report-flow{grid-template-columns:repeat(12,minmax(0,1fr))}.report-flow>.section{grid-column:1/-1;margin:0}.report-flow>.dashboard-chart-section{grid-column:span 6}.report-flow>.table-section{grid-column:span 6}.report-flow>.markdown-section{grid-column:1/-1}.report-flow>.coverage-shell{grid-column:1/-1}.dashboard-chart{height:390px}.dashboard-chart--map{height:520px}.coverage-body{grid-template-columns:260px minmax(0,1fr)}.coverage-map{height:540px}}
    @media (max-width: 980px){.page{width:min(100% - 24px,1080px);padding-top:16px}.coverage-body{grid-template-columns:1fr}.coverage-map{height:360px}.coverage-head{align-items:flex-start;flex-direction:column}.coverage-legend{flex-wrap:wrap}.dashboard-chart{height:320px}.dashboard-chart--map{height:360px}.dashboard-chart-head{flex-direction:column}}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      ${this.renderDashboardTemplateBadgeHtml(dashboardTemplate)}
      <h1>${this.escapeHtml(title)}</h1>
      <p class="summary">${this.escapeHtml(summary)}</p>
      <div class="meta">只读分析报告，生成时间：${this.escapeHtml(String(payload.completedAt ?? '未知'))}</div>
    </section>
    ${this.renderMetricCardsHtml(metricCards)}
    <div class="report-flow">
      ${this.renderDashboardTemplateSectionsHtml(sections)}
      ${this.renderDashboardChartSectionsHtml(chartSections)}
      ${this.renderCoverageSectionsHtml(sections)}
      ${this.renderTablesHtml(tableBlocks)}
      ${this.renderMarkdownHtml(String(report?.groundedMarkdown ?? payload.groundedExplanation ?? ''))}
    </div>
  </main>
</body>
</html>`;
  }

  /**
   * 渲染 HTML 指标卡。
   *
   * 参数说明：`metricCards` 为报告关键指标。
   * 返回值说明：返回指标卡 HTML 片段。
   */
  private renderMetricCardsHtml(
    metricCards: Array<{ name: string; value: string | number }>,
  ): string {
    if (metricCards.length === 0) {
      return '';
    }

    return `<section class="grid">${metricCards
      .slice(0, 6)
      .map(
        (item) => `<div class="card"><div class="metric-name">${this.escapeHtml(
          item.name,
        )}</div><div class="metric-value">${this.escapeHtml(String(item.value))}</div></div>`,
      )
      .join('')}</section>`;
  }

  /**
   * 渲染动态看板模板徽标。
   *
   * 参数说明：`dashboardTemplate` 为企微动态看板模板元数据。
   * 返回值说明：存在模板信息时返回顶部徽标 HTML，缺失时返回空字符串。
   */
  private renderDashboardTemplateBadgeHtml(dashboardTemplate?: {
    code?: string;
    displayName?: string;
    cardTitle?: string;
  }): string {
    if (!dashboardTemplate?.displayName && !dashboardTemplate?.cardTitle) {
      return '';
    }

    const title = dashboardTemplate.displayName ?? dashboardTemplate.cardTitle ?? '动态看板模板';
    const code = dashboardTemplate.code ? `｜${dashboardTemplate.code}` : '';
    return `<div class="template-badge">${this.escapeHtml(title)}${this.escapeHtml(code)}</div>`;
  }

  /**
   * 渲染动态看板模板分区。
   *
   * 参数说明：`sections` 为公开报告结构化区块。
   * 返回值说明：只渲染动态模板分区，展示本报告实际采用的看板区块顺序。
   */
  private renderDashboardTemplateSectionsHtml(sections: PublicResultSection[]): string {
    const templateSections = sections.filter((section) => section.sectionType === 'DASHBOARD_TEMPLATE');
    if (templateSections.length === 0) {
      return '';
    }

    return templateSections
      .map((section) => {
        const rows = section.rows ?? [];
        const rowItems = rows
          .map((row) => {
            const title = row.title ?? row.blockType ?? row.sectionType ?? '未命名分区';
            const blockType = row.blockType ? `（${String(row.blockType)}）` : '';
            return `<li>${this.escapeHtml(String(title))}${this.escapeHtml(blockType)}</li>`;
          })
          .join('');
        const rowList = rowItems.length > 0 ? `<ul>${rowItems}</ul>` : '<p class="empty">暂无可展示分区。</p>';

        return `<section class="section">
  <h2>${this.escapeHtml(section.title)}</h2>
  ${section.description ? `<p>${this.escapeHtml(section.description)}</p>` : ''}
  ${rowList}
</section>`;
      })
      .join('');
  }

  /**
   * 合并动态模板图表和旧式报告图表块。
   *
   * 参数说明：`sections` 为结构化报告分区，`chartBlocks` 为报告主视图和二级视图图表。
   * 返回值说明：返回公开页统一可渲染的图表分区集合。
   * 调用注意事项：旧式 `chartBlocks` 是当前主链常用图表载体，公开页必须消费它，避免结果页只有表格。
   */
  private buildPublicChartSections(
    sections: PublicResultSection[],
    chartBlocks: PublicReportChartBlock[],
  ): PublicResultSection[] {
    const convertedChartSections = chartBlocks
      .map((chartBlock) => this.convertPublicChartBlockToSection(chartBlock))
      .filter((section): section is PublicResultSection => Boolean(section));
    const seenKeys = new Set<string>();

    return [...sections, ...convertedChartSections].filter((section) => {
      const sectionKey = `${section.sectionType}:${section.title}:${section.chartType ?? ''}:${JSON.stringify(section.chartData ?? {})}`;
      if (seenKeys.has(sectionKey)) {
        return false;
      }

      seenKeys.add(sectionKey);
      return true;
    });
  }

  /**
   * 将报告图表块转换为动态看板图表分区。
   *
   * 参数说明：`chartBlock` 为报告生成器输出的图表块。
   * 返回值说明：返回折线、柱状或饼图分区；未知类型或空数据返回 `undefined`。
   */
  private convertPublicChartBlockToSection(
    chartBlock: PublicReportChartBlock,
  ): PublicResultSection | undefined {
    const points = this.normalizePublicChartSeries(chartBlock.series);
    if (points.length === 0) {
      return undefined;
    }

    if (chartBlock.viewType === 'LINE_CHART') {
      return {
        sectionType: 'DASHBOARD_CHART',
        title: chartBlock.title,
        chartType: 'composite-trend',
        description: '按当前结果集生成的趋势对比图，和下方明细表使用同一批只读数据。',
        chartData: {
          categories: points.map((point) => point.label),
          lineSeries: [
            {
              name: chartBlock.title,
              values: points.map((point) => point.value),
            },
          ],
          lineUnitLabel: '值',
          insights: this.buildPublicChartInsights(points),
        },
      };
    }

    if (chartBlock.viewType === 'PIE_CHART') {
      return {
        sectionType: 'DASHBOARD_CHART',
        title: chartBlock.title,
        chartType: 'pie-distribution',
        description: '按当前结果集生成的占比分布图，空值或 0 值会如实保留。',
        chartData: {
          segments: points.map((point) => ({
            name: point.label,
            value: point.value,
          })),
          unitLabel: '项',
          insights: this.buildPublicChartInsights(points),
        },
      };
    }

    if (chartBlock.viewType === 'BAR_CHART') {
      return {
        sectionType: 'DASHBOARD_CHART',
        title: chartBlock.title,
        chartType: 'grouped-bar',
        description: '按当前结果集生成的对比柱状图，和表格明细保持同源。',
        chartData: {
          categories: points.map((point) => point.label),
          series: [
            {
              name: chartBlock.title,
              values: points.map((point) => point.value),
            },
          ],
          unitLabel: '值',
          insights: this.buildPublicChartInsights(points),
        },
      };
    }

    return undefined;
  }

  /**
   * 规范化公开报告图表点。
   *
   * 参数说明：`series` 为报告图表点集合。
   * 返回值说明：返回包含中文标签和有限数值的点集合。
   */
  private normalizePublicChartSeries(
    series: Array<Record<string, unknown>>,
  ): Array<{ label: string; value: number }> {
    return series
      .map((point, index) => {
        const label = this.readPublicChartLabel(point, index);
        const value = this.readPublicChartValue(point);
        return { label, value };
      })
      .filter((point) => point.label.length > 0);
  }

  /**
   * 读取公开图表点标签。
   *
   * 参数说明：`point` 为图表点，`index` 为序号。
   * 返回值说明：优先使用业务标签字段，缺失时返回“第 N 项”。
   */
  private readPublicChartLabel(point: Record<string, unknown>, index: number): string {
    const candidates = [
      point.label,
      point.name,
      point.quarterLabel,
      point.bucket_label,
      point.bucketLabel,
      point.region,
      point.bigRegion,
      point.partnerName,
      point.ownerName,
    ];
    const label = candidates.map((item) => String(item ?? '').trim()).find((item) => item.length > 0);
    return label ?? `第 ${index + 1} 项`;
  }

  /**
   * 读取公开图表点数值。
   *
   * 参数说明：`point` 为图表点。
   * 返回值说明：优先使用 `value`，再按金额和数量字段兜底。
   */
  private readPublicChartValue(point: Record<string, unknown>): number {
    const candidates = [
      point.value,
      point.amount,
      point.opportunityAmount,
      point.orderAmount,
      point.quoteAmount,
      point.count,
      point.opportunityCount,
      point.orderCount,
      point.quoteCount,
    ];
    const matchedValue = candidates.find((item) => Number.isFinite(Number(item)));
    return this.toPublicFiniteNumber(matchedValue);
  }

  /**
   * 生成公开图表洞察。
   *
   * 参数说明：`points` 为规范化后的图表点。
   * 返回值说明：返回峰值、低点和总量提示，供图表下方辅助解读。
   */
  private buildPublicChartInsights(points: Array<{ label: string; value: number }>): string[] {
    if (points.length === 0) {
      return [];
    }

    const totalValue = points.reduce((sum, point) => sum + point.value, 0);
    const maxPoint = points.reduce((max, point) => point.value > max.value ? point : max, points[0]);
    const minPoint = points.reduce((min, point) => point.value < min.value ? point : min, points[0]);
    return [
      `图表共覆盖 ${points.length} 个对比点，总值为 ${totalValue.toLocaleString('zh-CN')}。`,
      `最高点为 ${maxPoint.label}，值为 ${maxPoint.value.toLocaleString('zh-CN')}。`,
      `最低点为 ${minPoint.label}，值为 ${minPoint.value.toLocaleString('zh-CN')}。`,
    ];
  }

  /**
   * 按需加载公开报告图表脚本。
   *
   * 参数说明：`sections` 为报告结构化区块。
   * 返回值说明：存在图表分区时返回 ECharts 脚本；存在地图时额外返回中国地图脚本。
   * 调用注意事项：公开页是只读报告，脚本只负责本地渲染和弹窗交互，不触发后端请求。
   */
  private renderDashboardChartScriptsHtml(sections: PublicResultSection[]): string {
    if (!sections.some((section) => this.isDashboardChartSection(section) || this.isCoverageMapSection(section))) {
      return '';
    }

    const scripts = ['<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>'];
    if (sections.some((section) => this.isDashboardMapSection(section) || this.isCoverageMapSection(section))) {
      scripts.push('<script src="https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/china.min.js"></script>');
    }

    return scripts.join('');
  }

  /**
   * 渲染动态看板图表分区。
   *
   * 参数说明：`sections` 为公开报告结构化区块。
   * 返回值说明：返回折线、占比、柱状、漏斗、集中度和全国地图的 HTML 图表片段。
   * 调用注意事项：仅渲染 `DASHBOARD_CHART` 与 `DASHBOARD_GEO_MAP`，避免和旧覆盖地图区块重复。
   */
  private renderDashboardChartSectionsHtml(sections: PublicResultSection[]): string {
    return sections
      .filter((section) => this.isDashboardChartSection(section))
      .map((section) => this.renderDashboardChartSectionHtml(section))
      .filter((item) => item.length > 0)
      .join('');
  }

  /**
   * 判断区块是否为动态看板图表。
   *
   * 参数说明：`section` 为公开报告区块。
   * 返回值说明：动态看板图表和动态看板地图返回 true。
   */
  private isDashboardChartSection(section: PublicResultSection): boolean {
    return section.sectionType === 'DASHBOARD_CHART' || this.isDashboardMapSection(section);
  }

  /**
   * 判断区块是否为动态看板地图。
   *
   * 参数说明：`section` 为公开报告区块。
   * 返回值说明：动态看板全国地图返回 true。
   */
  private isDashboardMapSection(section: PublicResultSection): boolean {
    return section.sectionType === 'DASHBOARD_GEO_MAP' || section.chartType === 'geo-map';
  }

  /**
   * 渲染单个动态看板图表。
   *
   * 参数说明：`section` 为已带 `chartType` 和 `chartData` 的公开图表区块。
   * 返回值说明：返回图表容器、洞察说明和初始化脚本。
   * 调用注意事项：图表初始化失败时只显示兜底提示，不影响报告主体阅读。
   */
  private renderDashboardChartSectionHtml(section: PublicResultSection): string {
    if (!section.chartType || !section.chartData) {
      return '';
    }

    const chartId = `dashboard-chart-${this.hashPublicDomId(`${section.sectionType}-${section.title}-${section.chartType}`)}`;
    const isMap = this.isDashboardMapSection(section);
    const chartClass = isMap ? 'dashboard-chart dashboard-chart--map' : 'dashboard-chart';
    const description = section.description
      ? `<p class="dashboard-chart-desc">${this.escapeHtml(section.description)}</p>`
      : '';
    const insightHtml = this.renderDashboardChartInsightsHtml(section);

    return `<section class="section dashboard-chart-section"><div class="dashboard-chart-head"><div><h2>${this.escapeHtml(section.title)}</h2>${description}</div></div><div class="${chartClass}" id="${chartId}"><div class="dashboard-chart-fallback">图表加载中；若当前网络无法访问图表脚本，请打开完整报告后刷新。</div></div>${insightHtml}<script>${this.renderDashboardChartRuntimeScript(chartId, section.chartType, section.chartData)}</script></section>`;
  }

  /**
   * 渲染图表洞察说明。
   *
   * 参数说明：`section` 为图表区块。
   * 返回值说明：存在洞察或说明项时返回列表，否则返回空字符串。
   */
  private renderDashboardChartInsightsHtml(section: PublicResultSection): string {
    const chartInsights = Array.isArray(section.chartData?.insights)
      ? section.chartData.insights.map((item) => String(item))
      : [];
    const sectionItems = Array.isArray(section.items)
      ? section.items.map((item) => String(item))
      : [];
    const insights = [...chartInsights, ...sectionItems]
      .map((item) => item.trim())
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
      .slice(0, 5);

    if (insights.length === 0) {
      return '';
    }

    return `<ul class="dashboard-chart-insights">${insights
      .map((item) => `<li>${this.escapeHtml(item)}</li>`)
      .join('')}</ul>`;
  }

  /**
   * 渲染动态图表运行时脚本。
   *
   * 参数说明：`chartId/chartType/chartData` 分别为图表容器、图表类型和只读图表数据。
   * 返回值说明：返回 ECharts 初始化脚本。
   * 调用注意事项：脚本中只使用已序列化数据，不读取 Cookie，不发起网络接口请求。
   */
  private renderDashboardChartRuntimeScript(
    chartId: string,
    chartType: string,
    chartData: Record<string, unknown>,
  ): string {
    return `
(function(){
  const chartType = ${this.serializePublicJson(chartType)};
  const chartData = ${this.serializePublicJson(chartData)};
  const chartDom = document.getElementById('${chartId}');
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }
  function toNumber(value){
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function asArray(value){
    return Array.isArray(value) ? value : [];
  }
  function buildSeriesValues(series){
    return asArray(series).map(function(item){
      return {
        name: String(item.name ?? '未命名'),
        values: asArray(item.values).map(toNumber)
      };
    });
  }
  function resolveOption(){
    if (chartType === 'pie-distribution') {
      const unitLabel = chartData.unitLabel ? String(chartData.unitLabel) : '';
      const segments = asArray(chartData.segments).map(function(item){
        return {
          name: String(item.name ?? '未命名'),
          value: toNumber(item.value),
          itemStyle: item.color ? { color: String(item.color) } : undefined
        };
      });
      return {
        tooltip: { trigger: 'item', formatter: function(params){ return escapeHtml(params.name) + '：' + params.value + unitLabel + '（' + params.percent + '%）'; } },
        legend: { bottom: 0, type: 'scroll' },
        series: [{ type: 'pie', radius: ['42%', '70%'], center: ['50%', '45%'], avoidLabelOverlap: true, label: { formatter: '{b}: {d}%' }, data: segments }]
      };
    }
    if (chartType === 'composite-trend') {
      const categories = asArray(chartData.categories).map(function(item){ return String(item); });
      const barSeries = buildSeriesValues(chartData.barSeries).map(function(item){ return { name: item.name, type: 'bar', barMaxWidth: 34, data: item.values }; });
      const lineSeries = buildSeriesValues(chartData.lineSeries).map(function(item){ return { name: item.name, type: 'line', smooth: true, symbolSize: 8, yAxisIndex: 1, data: item.values }; });
      const series = barSeries.concat(lineSeries);
      return {
        tooltip: { trigger: 'axis' },
        legend: { top: 0, type: 'scroll' },
        grid: { left: 52, right: lineSeries.length > 0 ? 56 : 24, top: 56, bottom: 42 },
        xAxis: { type: 'category', data: categories, axisLabel: { color: '#43524b' } },
        yAxis: [
          { type: 'value', name: chartData.barUnitLabel ? String(chartData.barUnitLabel) : '', axisLabel: { color: '#64736d' } },
          { type: 'value', name: chartData.lineUnitLabel ? String(chartData.lineUnitLabel) : '', axisLabel: { color: '#64736d' }, show: lineSeries.length > 0 }
        ],
        series
      };
    }
    if (chartType === 'grouped-bar') {
      const categories = asArray(chartData.categories).map(function(item){ return String(item); });
      const series = buildSeriesValues(chartData.series).map(function(item){ return { name: item.name, type: 'bar', barMaxWidth: 34, data: item.values }; });
      return {
        tooltip: { trigger: 'axis' },
        legend: { top: 0, type: 'scroll' },
        grid: { left: 52, right: 24, top: 56, bottom: 42 },
        xAxis: { type: 'category', data: categories, axisLabel: { color: '#43524b', interval: 0, rotate: categories.length > 6 ? 22 : 0 } },
        yAxis: { type: 'value', name: chartData.unitLabel ? String(chartData.unitLabel) : '', axisLabel: { color: '#64736d' } },
        series
      };
    }
    if (chartType === 'funnel') {
      const stages = asArray(chartData.stages).map(function(item){
        return {
          name: String(item.name ?? '未命名阶段'),
          value: toNumber(item.value)
        };
      });
      return {
        tooltip: { trigger: 'item', formatter: function(params){ return escapeHtml(params.name) + '：' + params.value; } },
        legend: { bottom: 0, type: 'scroll' },
        series: [{ type: 'funnel', left: '8%', top: 28, bottom: 48, width: '84%', minSize: '18%', maxSize: '100%', sort: 'none', label: { formatter: '{b}: {c}' }, data: stages }]
      };
    }
    if (chartType === 'concentration') {
      const tiers = asArray(chartData.tiers);
      const categories = tiers.map(function(item){ return String(item.label ?? '未命名'); });
      const values = tiers.map(function(item){ return toNumber(item.percentage ?? item.value); });
      return {
        tooltip: { trigger: 'axis' },
        grid: { left: 52, right: 24, top: 34, bottom: 42 },
        xAxis: { type: 'category', data: categories, axisLabel: { color: '#43524b' } },
        yAxis: { type: 'value', name: '占比', axisLabel: { formatter: '{value}%', color: '#64736d' } },
        series: [{ type: 'bar', barMaxWidth: 42, data: values, itemStyle: { color: '#2F6B57', borderRadius: [8, 8, 0, 0] }, label: { show: true, position: 'top', formatter: '{c}%' } }]
      };
    }
    if (chartType === 'geo-map') {
      const unitLabel = chartData.unitLabel ? String(chartData.unitLabel) : '个';
      const regions = asArray(chartData.regions).map(function(item){
        return {
          name: String(item.name ?? '未命名区域'),
          value: toNumber(item.value),
          extra: item.extra ? String(item.extra) : ''
        };
      });
      const maxValue = Math.max(1, ...regions.map(function(item){ return item.value; }));
      return {
        tooltip: {
          trigger: 'item',
          backgroundColor: '#ffffff',
          borderColor: '#d0d7de',
          textStyle: { color: '#333333', fontSize: 13 },
          formatter: function(params){
            const extra = params.data && params.data.extra ? '<br/><span style="font-size:12px;color:#64736d">' + escapeHtml(params.data.extra) + '</span>' : '';
            return '<b>' + escapeHtml(params.name) + '</b><br/>命中数量：' + (params.value || 0) + unitLabel + extra;
          }
        },
        visualMap: { min: 0, max: maxValue, left: 12, bottom: 18, text: ['高', '低'], calculable: true, inRange: { color: ['#eaf6ef', '#8bc7a4', '#1f7a55'] } },
        series: [{
          type: 'map',
          map: 'china',
          roam: true,
          zoom: 1.25,
          center: [104, 36],
          label: { show: true, color: '#1f2328', fontSize: 10, fontWeight: 700 },
          emphasis: { label: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' }, itemStyle: { areaColor: '#2ea043' } },
          itemStyle: { areaColor: '#f7faf9', borderColor: '#d0d7de', borderWidth: 0.8 },
          data: regions
        }]
      };
    }
    return undefined;
  }
  if (!chartDom || !window.echarts) {
    return;
  }
  const option = resolveOption();
  if (!option) {
    return;
  }
  chartDom.innerHTML = '';
  const chart = window.echarts.init(chartDom, null, { renderer: 'canvas' });
  chart.setOption(option);
  window.addEventListener('resize', function(){ chart.resize(); });
})();`;
  }

  /**
   * 渲染公开报告中的地图覆盖区块。
   *
   * 参数说明：`sections` 为报告结构化区块。
   * 返回值说明：只渲染服务商发展运营看板中的省份覆盖地图 HTML。
   * 调用注意事项：其它说明、口径和关键发现仍不展开，避免公开页信息噪音回流。
   */
  private renderCoverageSectionsHtml(sections: PublicResultSection[]): string {
    return sections
      .filter((section) => this.isCoverageMapSection(section))
      .map((section) => this.renderCoverageMapSectionHtml(section))
      .filter((item) => item.length > 0)
      .join('');
  }

  /**
   * 判断区块是否为服务商覆盖地图。
   *
   * 参数说明：`section` 为报告区块。
   * 返回值说明：省份覆盖标题且包含覆盖行时返回 true。
   */
  private isCoverageMapSection(section: PublicResultSection): boolean {
    if (this.isDashboardMapSection(section)) {
      return false;
    }

    return /省份.*覆盖|覆盖.*地图/u.test(section.title) && (section.rows?.length ?? 0) > 0;
  }

  /**
   * 渲染服务商覆盖地图卡片。
   *
   * 参数说明：`section` 为省份代理商覆盖情况区块。
   * 返回值说明：返回覆盖概览、中国地图和省份详情弹窗组成的 HTML。
   * 调用注意事项：地图标注基于结果包中的真实区域行，无法落点的区域只进入覆盖概览说明。
   */
  private renderCoverageMapSectionHtml(section: PublicResultSection): string {
    const rows = section.rows ?? [];
    if (rows.length === 0) {
      return '';
    }

    const chartId = `coverage-map-${this.hashPublicDomId(section.title)}`;
    const modalId = `coverage-modal-${this.hashPublicDomId(section.title)}`;
    const normalizedRows = this.normalizeCoverageRows(rows);
    const coveredProvinceSet = new Set(
      normalizedRows.map((row) => row.province).filter((province) => MAINLAND_CHINA_PROVINCE_NAMES.includes(province)),
    );
    const uncoveredProvinces = MAINLAND_CHINA_PROVINCE_NAMES.filter((province) => !coveredProvinceSet.has(province));
    const coverageRate = `${((coveredProvinceSet.size / MAINLAND_CHINA_PROVINCE_NAMES.length) * 100).toFixed(1)}%`;
    const description = section.description
      ? `<p class="coverage-description">${this.escapeHtml(section.description)}</p>`
      : '';
    const uncoveredText = uncoveredProvinces.length > 0
      ? `未覆盖：${uncoveredProvinces.join('、')}`
      : '已覆盖全部 31 省级区域';
    const coverageData = {
      provinces: MAINLAND_CHINA_PROVINCE_NAMES,
      rows: normalizedRows,
      uncoveredProvinces,
    };
    const domSuffix = this.hashPublicDomId(section.title);

    return `<section class="section coverage-shell"><div class="coverage-head"><h2>${this.escapeHtml(section.title)}</h2><div class="coverage-legend"><span><i class="legend-dot" style="background:#238636"></i>已覆盖</span><span><i class="legend-dot" style="background:#fff1b8;border:1px solid #ff8a70"></i>未覆盖</span><span>双击省份查看代理商详情</span></div></div>${description}<div class="coverage-body"><aside class="coverage-overview"><div class="coverage-overview-label">覆盖概览</div><div class="coverage-overview-value">${coveredProvinceSet.size}<small>/${MAINLAND_CHINA_PROVINCE_NAMES.length}省</small></div><div class="coverage-overview-rate">覆盖率 <strong>${coverageRate}</strong></div><div class="coverage-uncovered">${this.escapeHtml(uncoveredText)}</div></aside><div class="coverage-map" id="${chartId}"><div class="coverage-map-fallback">地图加载中；若网络环境无法访问地图脚本，请稍后刷新报告页。</div></div></div><div class="modal-overlay" id="${modalId}"><div class="modal-box"><button class="modal-close" onclick="closeCoverageProvinceModal_${domSuffix}()">&times;</button><div class="modal-title" id="${modalId}-title"></div><div class="modal-subtitle" id="${modalId}-subtitle"></div><div id="${modalId}-body"></div></div></div><script>${this.renderCoverageMapRuntimeScript(chartId, modalId, domSuffix, coverageData)}</script></section>`;
  }

  /**
   * 标准化地图覆盖行。
   *
   * 参数说明：`rows` 为服务商覆盖聚合行。
   * 返回值说明：返回地图和弹窗都能直接使用的安全结构。
   */
  private normalizeCoverageRows(rows: Array<Record<string, unknown>>): NormalizedCoverageRow[] {
    return rows.map((row) => {
      const province = String(row.province ?? '').trim();
      const label = String(row.province ?? row.region ?? row.coverageKey ?? row.bucket_label ?? '未返回区域').trim();
      const levelGroups = Array.isArray(row.levelGroups)
        ? row.levelGroups.map((item) => this.normalizeCoverageLevelGroup(item))
        : [];

      return {
        ...row,
        province,
        label,
        partnerCount: this.toPublicFiniteNumber(row.partnerCount ?? row.agentCount ?? row.count ?? 0),
        levelGroups,
      };
    }) as NormalizedCoverageRow[];
  }

  /**
   * 标准化地图弹窗中的等级分组。
   *
   * 参数说明：`value` 为报告聚合出的等级分组对象。
   * 返回值说明：返回等级、数量和代理商名称列表。
   */
  private normalizeCoverageLevelGroup(value: unknown): Record<string, unknown> {
    const group = value as Record<string, unknown>;
    return {
      level: String(group.level ?? '未设置'),
      count: this.toPublicFiniteNumber(group.count ?? 0),
      agents: Array.isArray(group.agents)
        ? group.agents.map((item) => String(item))
        : [],
    };
  }

  /**
   * 渲染覆盖地图运行时脚本。
   *
   * 参数说明：`chartId/modalId/domSuffix` 为当前地图实例 DOM 标识，`coverageData` 为覆盖数据。
   * 返回值说明：返回初始化 ECharts 地图和省份弹窗的脚本。
   * 调用注意事项：脚本只使用已经写入 HTML 的只读数据，不发起任何新接口请求。
   */
  private renderCoverageMapRuntimeScript(
    chartId: string,
    modalId: string,
    domSuffix: string,
    coverageData: Record<string, unknown>,
  ): string {
    return `
(function(){
  const coverageData = ${this.serializePublicJson(coverageData)};
  const levelColors = ${this.serializePublicJson(COVERAGE_LEVEL_COLORS)};
  const levelOrder = ${this.serializePublicJson(COVERAGE_LEVEL_ORDER)};
  const chartDom = document.getElementById('${chartId}');
  const modalDom = document.getElementById('${modalId}');
  const titleDom = document.getElementById('${modalId}-title');
  const subtitleDom = document.getElementById('${modalId}-subtitle');
  const bodyDom = document.getElementById('${modalId}-body');
  const rows = Array.isArray(coverageData.rows) ? coverageData.rows : [];
  const provinceRows = new Map(rows.filter(row => row.province).map(row => [row.province, row]));
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch];
    });
  }
  function getLevelOrder(level){
    const index = levelOrder.indexOf(level);
    return index >= 0 ? index : 999;
  }
  window.showCoverageProvinceDetail_${domSuffix} = function(provinceName){
    const row = provinceRows.get(provinceName);
    const isCovered = Boolean(row);
    titleDom.innerHTML = escapeHtml(provinceName) + '<span class="modal-badge ' + (isCovered ? 'badge-covered' : 'badge-uncovered') + '">' + (isCovered ? '已覆盖' : '未覆盖') + '</span>';
    subtitleDom.textContent = isCovered ? '共 ' + (row.partnerCount || 0) + ' 家代理商' : '该省份当前未覆盖代理商';
    if (!isCovered) {
      bodyDom.innerHTML = '<div class="modal-no-data">该省份暂无代理商数据</div>';
      modalDom.classList.add('active');
      return;
    }
    const groups = Array.isArray(row.levelGroups) ? row.levelGroups.slice().sort(function(left, right){
      return getLevelOrder(left.level) - getLevelOrder(right.level) || String(left.level).localeCompare(String(right.level), 'zh-CN');
    }) : [];
    if (groups.length === 0) {
      bodyDom.innerHTML = '<div class="modal-no-data">该省份暂无合作等级明细</div>';
      modalDom.classList.add('active');
      return;
    }
    bodyDom.innerHTML = groups.map(function(group){
      const color = levelColors[group.level] || '#8b949e';
      const agents = Array.isArray(group.agents) ? group.agents : [];
      const agentHtml = agents.length
        ? agents.map(function(agent){ return '<span class="agent-item">' + escapeHtml(agent) + '</span>'; }).join('、')
        : '暂无代理商名单';
      return '<div class="modal-level-group"><div class="modal-level-header"><span class="lv-dot" style="background:' + color + '"></span>' + escapeHtml(group.level) + '<span class="lv-count">' + (group.count || agents.length || 0) + '家</span></div><div class="modal-agent-list">' + agentHtml + '</div></div>';
    }).join('');
    modalDom.classList.add('active');
  };
  window.closeCoverageProvinceModal_${domSuffix} = function(){
    modalDom.classList.remove('active');
  };
  modalDom.addEventListener('click', function(event){
    if (event.target === modalDom) window.closeCoverageProvinceModal_${domSuffix}();
  });
  if (!chartDom || !window.echarts) {
    return;
  }
  const mapRows = (coverageData.provinces || []).map(function(province){
    const row = provinceRows.get(province);
    const covered = Boolean(row);
    return {
      name: province,
      value: covered ? Number(row.partnerCount || 0) : 0,
      itemStyle: {
        areaColor: covered ? '#238636' : '#fff1b8',
        borderColor: covered ? '#2ea043' : '#ff8a70',
        borderWidth: covered ? 1.35 : 0.8
      }
    };
  });
  chartDom.innerHTML = '';
  const chart = window.echarts.init(chartDom, null, { renderer: 'canvas' });
  chart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: '#ffffff',
      borderColor: '#d0d7de',
      textStyle: { color: '#333333', fontSize: 13 },
      formatter: function(params){
        const row = provinceRows.get(params.name);
        if (!row) {
          return '<b>' + escapeHtml(params.name) + '</b><br/><span style="color:#cf222e">未覆盖</span><br/>代理商：0家';
        }
        return '<b>' + escapeHtml(params.name) + '</b><br/><span style="color:#238636">已覆盖</span><br/>代理商：' + (row.partnerCount || 0) + '家<br/><span style="font-size:12px;color:#656d76">' + escapeHtml(row.levelSummary || '') + '</span>';
      }
    },
    series: [{
      type: 'map',
      map: 'china',
      roam: true,
      zoom: 1.35,
      center: [104, 36],
      label: {
        show: true,
        color: '#1f2328',
        fontSize: 10,
        fontWeight: 700,
        formatter: function(params){ return params.name; }
      },
      emphasis: {
        label: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
        itemStyle: { areaColor: '#2ea043' }
      },
      itemStyle: {
        areaColor: '#fff1b8',
        borderColor: '#ff8a70',
        borderWidth: 0.8
      },
      select: { disabled: true },
      data: mapRows
    }]
  });
  chart.on('dblclick', function(params){
    window.showCoverageProvinceDetail_${domSuffix}(params.name);
  });
  window.addEventListener('resize', function(){ chart.resize(); });
})();`;
  }

  /**
   * 生成稳定 DOM 后缀。
   *
   * 参数说明：`value` 为区块标题。
   * 返回值说明：返回只包含字母数字的短标识。
   */
  private hashPublicDomId(value: string): string {
    let hash = 0;
    for (const char of value) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    return hash.toString(36);
  }

  /**
   * 序列化公开页脚本数据。
   *
   * 参数说明：`value` 为将写入 HTML 的 JSON 数据。
   * 返回值说明：返回避免闭合脚本和 HTML 注入的 JSON 字符串。
   */
  private serializePublicJson(value: unknown): string {
    return JSON.stringify(value)
      .replace(/</gu, '\\u003c')
      .replace(/>/gu, '\\u003e')
      .replace(/&/gu, '\\u0026');
  }

  /**
   * 渲染公开报告所有表格卡片。
   *
   * 参数说明：`tableBlocks` 为报告中可见的表格区块。
   * 返回值说明：返回多个卡片式表格 HTML 片段。
   * 调用注意事项：企微入口仍发送卡片消息，完整明细留在公开 HTML 页内统一呈现。
   */
  private renderTablesHtml(
    tableBlocks: Array<{
      title: string;
      rows: Array<Record<string, unknown>>;
      columns?: Array<{ key: string; label: string }>;
    }>,
  ): string {
    return tableBlocks
      .map((tableBlock) => this.renderTableHtml(tableBlock))
      .filter((item) => item.length > 0)
      .join('');
  }

  /**
   * 渲染单个公开报告表格卡片。
   *
   * 参数说明：`tableBlock` 为报告表格块。
   * 返回值说明：返回卡片式表格 HTML；超过 7 条时使用固定高度滚动区承载明细。
   * 调用注意事项：不截断明细数据，最多渲染前 200 条，避免公开页一次性撑爆浏览器。
   */
  private renderTableHtml(
    tableBlock:
      | {
          title: string;
          rows: Array<Record<string, unknown>>;
          columns?: Array<{ key: string; label: string }>;
        }
      | undefined,
  ): string {
    if (!tableBlock?.rows?.length) {
      return '';
    }

    const columns = this.resolvePublicTableColumns(tableBlock.rows, tableBlock.columns, tableBlock.title);
    const rows = tableBlock.rows.slice(0, 200);
    const shouldUseDropdown = tableBlock.rows.length > 7;
    const tableHeaderHtml = `<thead><tr>${columns
      .map((column) => `<th>${this.escapeHtml(column.label)}</th>`)
      .join('')}</tr></thead>`;
    const tableHtml = this.renderPublicTableElementHtml(tableHeaderHtml, rows, columns);
    const tableWrapClass = shouldUseDropdown ? 'table-wrap table-wrap--dropdown' : 'table-wrap';
    const tableHintHtml = shouldUseDropdown
      ? `<div class="table-hint">共 <strong>${tableBlock.rows.length}</strong> 条明细，默认展示为下拉滚动表格，可在表格内向下滚动查看更多。</div>`
      : '';

    return `<section class="section table-section"><h2>${this.escapeHtml(tableBlock.title)}</h2>${tableHintHtml}<div class="${tableWrapClass}">${tableHtml}</div></section>`;
  }

  /**
   * 渲染公开报告表格主体。
   *
   * 参数说明：`headerHtml` 为已生成的表头，`rows` 为待渲染行，`columns` 为已翻译列配置。
   * 返回值说明：返回完整 table HTML。
   * 调用注意事项：只接收受控列配置，并对单元格统一转义，避免公开页注入风险。
   */
  private renderPublicTableElementHtml(
    headerHtml: string,
    rows: Array<Record<string, unknown>>,
    columns: PublicResultTableColumn[],
  ): string {
    return `<table>${headerHtml}<tbody>${rows
      .map(
        (row) =>
          `<tr>${columns
            .map(
              (column) =>
                `<td>${this.escapeHtml(this.formatPublicTableCellValue(row[column.key], column.key))}</td>`,
            )
            .join('')}</tr>`,
      )
      .join('')}</tbody></table>`;
  }

  /**
   * 解析公开 HTML 报告表格列。
   *
   * 参数说明：`rows` 为结果行，`configuredColumns` 为报告区块显式列配置。
   * 返回值说明：返回隐藏内部 ID 并翻译中文表头后的列。
   */
  private resolvePublicTableColumns(
    rows: Array<Record<string, unknown>>,
    configuredColumns?: PublicResultTableColumn[],
    tableTitle = '',
  ): PublicResultTableColumn[] {
    const firstRow = rows[0] ?? {};
    const preferredColumns = configuredColumns?.length
      ? []
      : this.resolvePreferredPublicTableColumns(rows, tableTitle);
    const sourceColumns =
      configuredColumns?.length
        ? configuredColumns
        : preferredColumns.length
          ? preferredColumns
        : Object.keys(firstRow).map((key) => ({ key, label: key }));

    const visibleColumns = sourceColumns
      .filter((column) => !this.shouldHidePublicTableColumn(column.key, firstRow))
      .filter((column) => !this.shouldHideDuplicateAggregateColumn(column.key, rows, tableTitle))
      .map((column, index) => ({
        key: column.key,
        label: this.resolvePublicColumnLabel(column.key, column.label, index, tableTitle),
      }));

    if (preferredColumns.length > 0) {
      return visibleColumns;
    }

    return this.sortPublicAggregateColumns(visibleColumns, tableTitle);
  }

  /**
   * 为经营对比类表格选择业务优先列。
   *
   * 参数说明：`rows` 为表格行，`tableTitle` 为表格标题。
   * 返回值说明：对比、贡献和风险建议类表格返回中文业务列；其它表格返回空数组沿用原逻辑。
   * 调用注意事项：该方法专门解决宽表自动推断导致“金额（万元）重复、字段12”等展示错乱问题。
   */
  private resolvePreferredPublicTableColumns(
    rows: Array<Record<string, unknown>>,
    tableTitle: string,
  ): PublicResultTableColumn[] {
    const hasQuarterComparison = this.hasColumn(rows, 'quarterLabel') ||
      this.hasColumn(rows, 'quarter_label') ||
      this.hasColumn(rows, 'comparisonObject');
    const hasBusinessAdvice = this.hasColumn(rows, 'riskReason') ||
      this.hasColumn(rows, 'actionSuggestion') ||
      this.hasColumn(rows, 'contributionShare') ||
      this.hasColumn(rows, 'opportunityShare') ||
      this.hasColumn(rows, 'orderShare');
    const isComparisonTable = /(对比|比较|贡献|汇总|风险|建议|承接|转化)/u.test(tableTitle) ||
      hasQuarterComparison ||
      hasBusinessAdvice;

    if (!isComparisonTable) {
      return [];
    }

    const quarterColumns: PublicResultTableColumn[] = [
      { key: 'comparisonObject', label: '对比对象' },
      { key: 'quarterLabel', label: '季度' },
      { key: 'bigRegion', label: '大区' },
      { key: 'region', label: '区域' },
      { key: 'opportunityCount', label: '商机数' },
      { key: 'opportunityAmountText', label: '商机金额' },
      { key: 'countChangeText', label: '数量变化' },
      { key: 'amountChangeText', label: '金额变化' },
      { key: 'amountChangeRate', label: '金额变化率' },
      { key: 'contributionShare', label: '贡献占比' },
      { key: 'riskReason', label: '风险原因' },
      { key: 'actionSuggestion', label: '动作建议' },
    ];
    const contributionColumns: PublicResultTableColumn[] = [
      { key: 'partnerName', label: '渠道商' },
      { key: 'ownerName', label: '负责人' },
      { key: 'bigRegion', label: '大区' },
      { key: 'region', label: '区域' },
      { key: 'registrationCount', label: '报备数' },
      { key: 'opportunityCount', label: '商机数' },
      { key: 'opportunityAmountText', label: '商机金额' },
      { key: 'quoteCount', label: '报价数' },
      { key: 'orderCount', label: '订单数' },
      { key: 'contributionShare', label: '贡献占比' },
      { key: 'opportunityToOrderRate', label: '商机到订单转化率' },
      { key: 'riskReason', label: '风险原因' },
      { key: 'actionSuggestion', label: '动作建议' },
    ];
    const candidateColumns = hasQuarterComparison ? quarterColumns : contributionColumns;

    return candidateColumns.filter((column) => this.hasColumn(rows, column.key));
  }

  /**
   * 解析公开报告表头。
   *
   * 参数说明：`key` 为字段名，`label` 为上游列名，`index` 为列序号。
   * 返回值说明：优先保留中文业务名，其次使用内置 CRM 字段词典。
   */
  private resolvePublicColumnLabel(
    key: string,
    label: string | undefined,
    index: number,
    tableTitle = '',
  ): string {
    if (label && /[\u4e00-\u9fff]/u.test(label) && !/^字段\d+$/u.test(label.trim())) {
      return label;
    }

    if (key === 'count') {
      return this.resolvePublicCountColumnLabel(tableTitle);
    }

    if (this.shouldFormatPublicAmountColumn(key)) {
      return this.resolvePublicAmountColumnLabel(tableTitle);
    }

    if (key === 'bucket_label' || key === 'bucketLabel') {
      return this.resolvePublicBucketColumnLabel(tableTitle);
    }

    return PUBLIC_COLUMN_LABEL_MAP[key] ?? `字段${index + 1}`;
  }

  /**
   * 隐藏聚合表中的重复分组列。
   *
   * 参数说明：`key` 为候选列，`rows` 为表格行，`tableTitle` 为表格标题。
   * 返回值说明：当 `ownerName/bucket_label/month_label/stage` 表达同一分组时返回 true。
   * 调用注意事项：执行层为了兼容图表会把月份、阶段也放进 `ownerName`；
   * 公开页必须翻译成业务分组，不能把月份或阶段误显示为“负责人”。
   */
  private shouldHideDuplicateAggregateColumn(
    key: string,
    rows: Array<Record<string, unknown>>,
    tableTitle: string,
  ): boolean {
    const title = tableTitle || '';
    const hasSpecificMonthColumn = this.hasColumn(rows, 'month_label') || this.hasColumn(rows, 'monthLabel');
    const hasSpecificStageColumn = this.hasColumn(rows, 'stage') || this.hasColumn(rows, 'stageName') || this.hasColumn(rows, 'stage_name');
    const isOwnerQuestion = /负责人|销售负责人|业务员|跟进人/u.test(title);

    if (key === 'ownerName' && !isOwnerQuestion) {
      return (
        (hasSpecificMonthColumn && this.rowsHaveSameTextValue(rows, key, 'month_label', 'monthLabel')) ||
        (hasSpecificStageColumn && this.rowsHaveSameTextValue(rows, key, 'stage', 'stageName', 'stage_name')) ||
        this.rowsHaveSameTextValue(rows, key, 'bucket_label', 'bucketLabel', 'category', 'businessSection')
      );
    }

    if (key === 'bucket_label' || key === 'bucketLabel') {
      return (
        (hasSpecificMonthColumn && this.rowsHaveSameTextValue(rows, key, 'month_label', 'monthLabel')) ||
        (hasSpecificStageColumn && this.rowsHaveSameTextValue(rows, key, 'stage', 'stageName', 'stage_name'))
      );
    }

    return false;
  }

  /**
   * 对聚合表列做业务顺序整理。
   *
   * 参数说明：`columns` 为已过滤列，`tableTitle` 为表格标题。
   * 返回值说明：趋势/阶段等聚合表优先展示分组，再展示数量和金额。
   */
  private sortPublicAggregateColumns(
    columns: PublicResultTableColumn[],
    tableTitle: string,
  ): PublicResultTableColumn[] {
    const isAggregateTable = columns.some((item) => item.key === 'count') &&
      columns.some((item) => this.shouldFormatPublicAmountColumn(item.key)) &&
      columns.some((item) => this.isPublicGroupColumn(item.key, tableTitle));
    if (!isAggregateTable) {
      return columns;
    }

    return [...columns].sort((left, right) =>
      this.resolvePublicAggregateColumnPriority(left.key, tableTitle) -
        this.resolvePublicAggregateColumnPriority(right.key, tableTitle),
    );
  }

  /**
   * 判断列是否为聚合分组列。
   *
   * 参数说明：`key` 为列名，`tableTitle` 为表格标题。
   * 返回值说明：月份、阶段、分类、区域、渠道商和必要时的负责人列返回 true。
   */
  private isPublicGroupColumn(key: string, tableTitle: string): boolean {
    return [
      'month_label',
      'monthLabel',
      'stage',
      'stageName',
      'stage_name',
      'bucket_label',
      'bucketLabel',
      'category',
      'region',
      'regionName',
      'partnerName',
      'partner_name',
      'ownerName',
    ].includes(key) && !(key === 'ownerName' && !/负责人|销售负责人|业务员|跟进人/u.test(tableTitle));
  }

  /**
   * 返回聚合表列排序优先级。
   *
   * 参数说明：`key` 为列名，`tableTitle` 为表格标题。
   * 返回值说明：分组列优先，其次数量，再次金额，其余列靠后。
   */
  private resolvePublicAggregateColumnPriority(key: string, tableTitle: string): number {
    if (this.isPublicGroupColumn(key, tableTitle)) {
      return 10;
    }

    if (key === 'count') {
      return 20;
    }

    if (this.shouldFormatPublicAmountColumn(key)) {
      return 30;
    }

    return 100;
  }

  /**
   * 按表格主题翻译数量列。
   *
   * 参数说明：`tableTitle` 为当前表格标题。
   * 返回值说明：商机、订单、报备、渠道商主题返回对应业务数量名。
   */
  private resolvePublicCountColumnLabel(tableTitle: string): string {
    if (/商机/u.test(tableTitle)) {
      return '商机数';
    }

    if (/订单|下单/u.test(tableTitle)) {
      return '订单数';
    }

    if (/报备/u.test(tableTitle)) {
      return '报备数';
    }

    if (/渠道商|服务商|代理商|合作伙伴/u.test(tableTitle)) {
      return '渠道商数';
    }

    return '记录数';
  }

  /**
   * 按表格主题翻译金额列。
   *
   * 参数说明：`tableTitle` 为当前表格标题。
   * 返回值说明：根据商机、订单、报备等业务主题返回金额名。
   */
  private resolvePublicAmountColumnLabel(tableTitle: string): string {
    if (/商机/u.test(tableTitle)) {
      return '商机金额（万元）';
    }

    if (/订单|下单/u.test(tableTitle)) {
      return '订单金额（万元）';
    }

    if (/报备/u.test(tableTitle)) {
      return '报备金额（万元）';
    }

    if (/渠道商|服务商|代理商|合作伙伴/u.test(tableTitle)) {
      return '累计金额（万元）';
    }

    return '金额（万元）';
  }

  /**
   * 按表格主题翻译通用分组列。
   *
   * 参数说明：`tableTitle` 为当前表格标题。
   * 返回值说明：趋势表返回月份，阶段表返回销售阶段，其它返回分组。
   */
  private resolvePublicBucketColumnLabel(tableTitle: string): string {
    if (/趋势|月份|月度|最近.*月|近.*月/u.test(tableTitle)) {
      return '月份';
    }

    if (/阶段/u.test(tableTitle)) {
      return '销售阶段';
    }

    return '分组';
  }

  /**
   * 判断行集中是否包含指定列。
   *
   * 参数说明：`rows` 为表格行，`key` 为字段名。
   * 返回值说明：任意行存在该字段时返回 true。
   */
  private hasColumn(rows: Array<Record<string, unknown>>, key: string): boolean {
    return rows.some((row) => Object.prototype.hasOwnProperty.call(row, key));
  }

  /**
   * 判断一个字段是否和候选字段表达同一文本值。
   *
   * 参数说明：`sourceKey` 为待隐藏字段，`targetKeys` 为更具体的业务字段。
   * 返回值说明：所有非空行都能在候选字段中找到相同值时返回 true。
   */
  private rowsHaveSameTextValue(
    rows: Array<Record<string, unknown>>,
    sourceKey: string,
    ...targetKeys: string[]
  ): boolean {
    const rowsWithSource = rows.filter((row) => this.readPublicCellText(row[sourceKey]) !== '');
    if (rowsWithSource.length === 0) {
      return false;
    }

    return rowsWithSource.every((row) => {
      const sourceValue = this.readPublicCellText(row[sourceKey]);
      return targetKeys.some((targetKey) => this.readPublicCellText(row[targetKey]) === sourceValue);
    });
  }

  /**
   * 读取公开表格单元格文本。
   *
   * 参数说明：`value` 为原始单元格值。
   * 返回值说明：返回去空格后的文本，用于列去重判断。
   */
  private readPublicCellText(value: unknown): string {
    return String(value ?? '').trim();
  }

  /**
   * 判断公开报告是否隐藏内部字段。
   *
   * 参数说明：`key` 为字段名，`row` 为首行数据。
   * 返回值说明：存在可读名称字段时隐藏对应 ID。
   */
  private shouldHidePublicTableColumn(key: string, row: Record<string, unknown>): boolean {
    return Boolean(
      PUBLIC_HIDDEN_ID_READABLE_PAIRS[key]?.some((readableKey) => {
        const value = row[readableKey];
        return value !== undefined && value !== null && String(value).trim() !== '';
      }),
    );
  }

  /**
   * 格式化公开报告单元格。
   *
   * 参数说明：`value` 为原始值，`columnKey` 为字段名。
   * 返回值说明：返回中文布尔、枚举和金额单位统一后的展示文本。
   */
  private formatPublicTableCellValue(value: unknown, columnKey: string): string {
    if (value === undefined || value === null || value === '') {
      return '--';
    }

    if (this.shouldFormatPublicAmountColumn(columnKey)) {
      return formatWanAmount(value, this.resolvePublicAmountSourceUnit(columnKey));
    }

    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }

    if (typeof value === 'number') {
      return value.toLocaleString('zh-CN');
    }

    const text = String(value).trim();
    if (!text) {
      return '--';
    }

    const dictionary: Record<string, string> = {
      true: '是',
      false: '否',
      yes: '是',
      no: '否',
      primary: '主渠道',
      secondary: '协作渠道',
      distributor: '经销商',
      integrator: '集成商',
      technical_service_provider: '技术服务商',
      active: '已激活',
      inactive: '未激活/停用',
      disabled: '禁用',
      none: '未设置',
      unknown: '未设置',
      draft: '草稿',
      converted: '已转订单',
      submitted: '已提交',
      approved: '已通过',
      rejected: '已驳回',
      pending: '待处理',
      processing: '处理中',
      completed: '已完成',
      closed: '已关闭',
      cancelled: '已取消',
      canceled: '已取消',
      won: '已成交',
      lost: '已失单',
      contacted: '1%已联系客户',
      registered: '20%已登记/已报备',
      budget: '20%已确认预算',
      testing: '30%客户测试中',
      quoted: '50%已报价',
      negotiation: '70%商务谈判',
    };

    return dictionary[text] ?? text;
  }

  /**
   * 将公开报告中的数量转成有限数字。
   *
   * 参数说明：`value` 为接口或报告聚合出的数量。
   * 返回值说明：异常输入统一返回 0，避免地图点位出现 NaN。
   */
  private toPublicFiniteNumber(value: unknown): number {
    const numberValue = Number(String(value ?? '').replace(/,/gu, '').trim());
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  /**
   * 判断字段是否为金额列。
   *
   * 参数说明：`columnKey` 为字段名。
   * 返回值说明：CRM 元级金额字段返回 true。
   */
  private shouldFormatPublicAmountColumn(columnKey: string): boolean {
    return [
      'amount',
      'total_amount',
      'totalAmount',
      'expected_amount',
      'expectedAmount',
      'annual_forecast',
      'annual_target',
      'contract_amount',
      'valid_income',
      'opportunity_amount',
      'opportunityAmount',
      'quote_amount',
      'quoteAmount',
      'order_amount',
      'orderAmount',
      'amountChange',
      'oppAmount',
    ].includes(columnKey);
  }

  /**
   * 判断金额字段源单位。
   *
   * 参数说明：`columnKey` 为字段名。
   * 返回值说明：少数已是万元口径的字段按万元处理，其余按元转万元。
   */
  private resolvePublicAmountSourceUnit(columnKey: string): AmountSourceUnit {
    return columnKey === 'expected_amount' || columnKey === 'annual_forecast' || columnKey === 'annual_target'
      ? 'wan'
      : 'yuan';
  }

  /**
   * 渲染报告补充说明。
   *
   * 参数说明：`markdown` 为报告说明文本。
   * 返回值说明：返回安全转义后的预格式文本。
   */
  private renderMarkdownHtml(markdown: string): string {
    if (!markdown.trim()) {
      return '';
    }

    return `<section class="section markdown-section"><h2>报告说明</h2><p>${this.escapeHtml(markdown).replace(/\n/gu, '<br>')}</p></section>`;
  }

  /**
   * 转义 HTML 特殊字符。
   *
   * 参数说明：`value` 为待输出文本。
   * 返回值说明：返回 HTML 安全文本。
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/gu, '&amp;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;')
      .replace(/"/gu, '&quot;')
      .replace(/'/gu, '&#39;');
  }
}
