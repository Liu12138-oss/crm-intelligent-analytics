import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { formatWanAmount, toWanAmount } from '../../shared/utils/business-amount.util';
import {
  MANAGEMENT_REPORT_CONTRACTS,
  MANAGEMENT_REPORT_CUSTOMERS,
  MANAGEMENT_REPORT_LEADS,
  MANAGEMENT_REPORT_OPPORTUNITIES,
  MANAGEMENT_REPORT_PAYMENT_PLANS,
  MANAGEMENT_REPORT_PAYMENTS,
  type ManagementReportContractRecord,
  type ManagementReportCustomerRecord,
  type ManagementReportLeadRecord,
  type ManagementReportOpportunityRecord,
  type ManagementReportPaymentPlanRecord,
  type ManagementReportPaymentRecord,
} from './management-report.mock-data';
import { buildAcceptanceReport } from './builders/acceptance-report.builder';
import { buildAgentsReport } from './builders/agents-report.builder';
import { buildCollectionsReport } from './builders/collections-report.builder';
import { buildCustomersReport } from './builders/customers-report.builder';
import { buildExecutiveSummaryReport } from './builders/executive-summary-report.builder';
import { buildLeadConversionReport } from './builders/lead-conversion-report.builder';
import { buildLeadOpportunityReport } from './builders/lead-opportunity-report.builder';
import { buildLeadsReport } from './builders/leads-report.builder';
import { buildOpportunitiesReport } from './builders/opportunities-report.builder';
import { buildOverviewReport } from './builders/overview-report.builder';
import { buildProductsReport } from './builders/products-report.builder';
import { buildRegionalReport } from './builders/regional-report.builder';
import { buildRisksReport } from './builders/risks-report.builder';
import { createEmptyPreviewBlock } from './management-report.types';
import type {
  ManagementReportContext,
  ManagementReportSectionData,
  ManagementReportSectionKey,
} from './management-report.types';

type PaymentPlanView = ManagementReportPaymentPlanRecord & {
  customerName: string;
  ownerName: string;
};

type PaymentView = ManagementReportPaymentRecord & {
  customerName: string;
  ownerName: string;
};

interface CustomFieldDefinition {
  id: number;
  label: string;
  originLabel?: string;
  fieldType: string;
  optionMap: Record<string, string>;
}

interface LeadAssetView {
  consultationContent?: string;
  consultationRole?: string;
  productType?: string;
}

interface DemandTagRule {
  label: string;
  keywords: string[];
}

const OPPORTUNITY_COMMITMENT_FIELD_NAME = 'text_asset_96585a';
const OPPORTUNITY_COMMITMENT_SELECTED_VALUE = 'sel_0cae';
const CONTRACT_VALID_INCOME_FIELD_NAME = 'numeric_asset_7ee237';

const DEMAND_TAG_RULES: DemandTagRule[] = [
  {
    label: 'DLP',
    keywords: ['dlp', 'des', '数据防泄露', '数据防泄漏', '防泄露', '防泄漏', '防泄密', '文档加密'],
  },
  {
    label: '终端安全',
    keywords: ['终端安全', '终端防护', '主机安全', '杀毒', 'edr', 'access'],
  },
  {
    label: '终端准入',
    keywords: ['终端准入', '终端接入', '准入控制', 'nac', '网络准入'],
  },
  {
    label: '研发数据加密',
    keywords: ['研发数据加密', '研发加密', '代码加密', '图纸加密', '源代码加密'],
  },
  {
    label: '跨网文件交换',
    keywords: ['跨网文件交换', '文件交换', '安全摆渡', '摆渡', '网闸', 'nxg'],
  },
  {
    label: '移动办公',
    keywords: ['移动办公', '移动办公安全', '移动安全', 'mdm', 'mam', 'emm'],
  },
  {
    label: '零信任',
    keywords: ['零信任', 'ztna', '远程访问', 'sdp'],
  },
  {
    label: '桌面管理',
    keywords: ['桌面管理', '桌管', '终端运维', '资产管理'],
  },
  {
    label: '软件管理',
    keywords: ['软件管理', '软件资产', '补丁管理', '应用管理'],
  },
];

interface LiveContextData {
  leadsInRange: ManagementReportLeadRecord[];
  customersByEnd: ManagementReportCustomerRecord[];
  customersInRange: ManagementReportCustomerRecord[];
  opportunitiesByEnd: ManagementReportOpportunityRecord[];
  opportunitiesInRange: ManagementReportOpportunityRecord[];
  contractsByEnd: ManagementReportContractRecord[];
  contractsInRange: ManagementReportContractRecord[];
  paymentPlansByEnd: PaymentPlanView[];
  paymentPlansInRange: PaymentPlanView[];
  overduePlansByEnd: PaymentPlanView[];
  paymentsInRange: PaymentView[];
}

/**
 * 经营报表查询服务：
 * - 测试环境复用样本数据
 * - 运行环境优先读取真实 CRM 只读库
 */
@Injectable()
export class ManagementReportQueryService {
  private readonly liveContextCache = new Map<string, LiveContextData>();
  private readonly liveContextLoadPromises = new Map<string, Promise<void>>();

  constructor(
    @Optional()
    private readonly crmReadonlyService?: CrmReadonlyService,
  ) {}

  /**
   * 在运行态预加载当前报表上下文所需的真实数据。
   */
  async prepareContextData(context: ManagementReportContext): Promise<void> {
    if (this.shouldUseMockData()) {
      return;
    }

    if (!this.crmReadonlyService) {
      throw new ServiceUnavailableException('经营报表未注入 CRM 只读数据源。');
    }

    if (this.liveContextCache.has(context.reportId)) {
      return;
    }

    const pendingLoad = this.liveContextLoadPromises.get(context.reportId);
    if (pendingLoad) {
      await pendingLoad;
      return;
    }

    const loadingPromise = (async () => {
      const ready = await this.crmReadonlyService!.ensureLiveQueryReady();
      if (!ready) {
        throw new ServiceUnavailableException('经营报表真实数据源不可用，请检查 CRM 只读库配置。');
      }

      const liveData = await this.loadLiveContextData(context);
      this.liveContextCache.set(context.reportId, liveData);
    })();
    this.liveContextLoadPromises.set(context.reportId, loadingPromise);

    try {
      await loadingPromise;
    } finally {
      // 同一上下文的并发请求会共用当前 Promise；完成或失败后必须释放，避免后续重试被旧状态卡住。
      if (this.liveContextLoadPromises.get(context.reportId) === loadingPromise) {
        this.liveContextLoadPromises.delete(context.reportId);
      }
    }
  }

  /**
   * 构造总览专题。
   */
  buildOverview(context: ManagementReportContext): ManagementReportSectionData {
    return buildOverviewReport(this, context);
  }

  /**
   * 构造经营摘要专题。
   */
  buildExecutiveSummary(
    context: ManagementReportContext,
  ): ManagementReportSectionData {
    return buildExecutiveSummaryReport(this, context);
  }

  /**
   * 按专题键构造详情专题。
   */
  buildSection(
    context: ManagementReportContext,
    sectionKey: ManagementReportSectionKey,
  ): ManagementReportSectionData {
    switch (sectionKey) {
      case 'regional':
        return buildRegionalReport(this, context);
      case 'leads':
        return buildLeadsReport(this, context);
      case 'lead-conversion':
        return buildLeadConversionReport(this, context);
      case 'lead-opportunity':
        return buildLeadOpportunityReport(this, context);
      case 'opportunities':
        return buildOpportunitiesReport(this, context);
      case 'customers':
        return buildCustomersReport(this, context);
      case 'agents':
        return buildAgentsReport(this, context);
      case 'products':
        return buildProductsReport(this, context);
      case 'acceptance':
        return buildAcceptanceReport(this, context);
      case 'collections':
        return buildCollectionsReport(this, context);
      case 'risks':
        return buildRisksReport(this, context);
      default:
        return this.buildUnavailableSection(sectionKey);
    }
  }

  /**
   * 统一筛选筛选期内线索。
   */
  listLeadsInPeriod(context: ManagementReportContext) {
    if (this.shouldUseMockData()) {
      return MANAGEMENT_REPORT_LEADS.filter(
        (item) =>
          context.filter.includedDepartmentIds.includes(item.departmentId) &&
          this.isBetween(item.createdAt, context.filter.startDate, context.filter.endDate),
      );
    }

    return this.requireLiveContextData(context).leadsInRange;
  }

  /**
   * 统一筛选筛选期内新增客户。
   */
  listCustomersInPeriod(context: ManagementReportContext) {
    if (this.shouldUseMockData()) {
      return MANAGEMENT_REPORT_CUSTOMERS.filter(
        (item) =>
          context.filter.includedDepartmentIds.includes(item.departmentId) &&
          this.isBetween(item.createdAt, context.filter.startDate, context.filter.endDate),
      );
    }

    return this.requireLiveContextData(context).customersInRange;
  }

  /**
   * 统一筛选截至 endDate 的客户池。
   */
  listCustomersByEndDate(context: ManagementReportContext) {
    if (this.shouldUseMockData()) {
      return MANAGEMENT_REPORT_CUSTOMERS.filter(
        (item) =>
          context.filter.includedDepartmentIds.includes(item.departmentId) &&
          item.createdAt <= context.filter.endDate,
      );
    }

    return this.requireLiveContextData(context).customersByEnd;
  }

  /**
   * 按名称查找当前范围内客户。
   */
  findCustomerByName(context: ManagementReportContext, customerName: string) {
    return this.listCustomersByEndDate(context).find((item) => item.name === customerName);
  }

  /**
   * 统一筛选筛选期内商机。
   */
  listOpportunitiesInPeriod(context: ManagementReportContext) {
    if (this.shouldUseMockData()) {
      return MANAGEMENT_REPORT_OPPORTUNITIES.filter((item) => {
        const businessDate = item.getTime ?? item.createdAt;
        return (
          context.filter.includedDepartmentIds.includes(item.departmentId) &&
          this.isBetween(businessDate, context.filter.startDate, context.filter.endDate)
        );
      });
    }

    return this.requireLiveContextData(context).opportunitiesInRange;
  }

  /**
   * 统一筛选截至 endDate 仍在手的商机池。
   */
  listOpenOpportunitiesByEndDate(context: ManagementReportContext) {
    if (this.shouldUseMockData()) {
      return MANAGEMENT_REPORT_OPPORTUNITIES.filter((item) => {
        const businessDate = item.getTime ?? item.createdAt;
        return (
          context.filter.includedDepartmentIds.includes(item.departmentId) &&
          businessDate <= context.filter.endDate &&
          item.stage !== '赢单'
        );
      });
    }

    return this.requireLiveContextData(context).opportunitiesByEnd.filter(
      (item) => item.stage !== '赢单' && !item.stage.includes('输单'),
    );
  }

  /**
   * 按客户名称查找当前范围内商机。
   */
  listOpportunitiesByCustomerName(
    context: ManagementReportContext,
    customerName: string,
  ) {
    return this.listOpenOpportunitiesByEndDate(context).filter(
      (item) => item.customerName === customerName,
    );
  }

  /**
   * 统一筛选筛选期内合同。
   */
  listContractsInPeriod(context: ManagementReportContext) {
    if (this.shouldUseMockData()) {
      return MANAGEMENT_REPORT_CONTRACTS.filter((item) => {
        const businessDate = item.signDate ?? item.createdAt;
        return (
          context.filter.includedDepartmentIds.includes(item.departmentId) &&
          this.isBetween(businessDate, context.filter.startDate, context.filter.endDate)
        );
      });
    }

    return this.requireLiveContextData(context).contractsInRange;
  }

  /**
   * 统一筛选筛选期内实际回款。
   */
  listPaymentsInPeriod(context: ManagementReportContext): PaymentView[] {
    if (this.shouldUseMockData()) {
      const departmentIds = new Set(context.filter.includedDepartmentIds);
      const contractsById = new Map(
        MANAGEMENT_REPORT_CONTRACTS.map((item) => [item.id, item] as const),
      );

      return MANAGEMENT_REPORT_PAYMENTS.filter((item) => {
        const contract = contractsById.get(item.contractId);
        return (
          Boolean(contract) &&
          departmentIds.has(contract!.departmentId) &&
          this.isBetween(item.receiveDate, context.filter.startDate, context.filter.endDate)
        );
      }).map((item) => ({
        ...item,
        customerName: contractsById.get(item.contractId)?.customerName ?? '--',
        ownerName: contractsById.get(item.contractId)?.ownerName ?? '--',
      }));
    }

    return this.requireLiveContextData(context).paymentsInRange;
  }

  /**
   * 统一筛选筛选期内应收计划。
   */
  listPaymentPlansInPeriod(context: ManagementReportContext): PaymentPlanView[] {
    if (this.shouldUseMockData()) {
      const departmentIds = new Set(context.filter.includedDepartmentIds);
      const contractsById = new Map(
        MANAGEMENT_REPORT_CONTRACTS.map((item) => [item.id, item] as const),
      );

      return MANAGEMENT_REPORT_PAYMENT_PLANS.filter((item) => {
        const contract = contractsById.get(item.contractId);
        return (
          Boolean(contract) &&
          departmentIds.has(contract!.departmentId) &&
          this.isBetween(item.receiveDate, context.filter.startDate, context.filter.endDate)
        );
      }).map((item) => ({
        ...item,
        customerName: contractsById.get(item.contractId)?.customerName ?? '--',
        ownerName: contractsById.get(item.contractId)?.ownerName ?? '--',
      }));
    }

    return this.requireLiveContextData(context).paymentPlansInRange;
  }

  /**
   * 统一筛选截至 endDate 的逾期应收计划。
   */
  listOverduePlansByEndDate(context: ManagementReportContext): PaymentPlanView[] {
    if (this.shouldUseMockData()) {
      const departmentIds = new Set(context.filter.includedDepartmentIds);
      const contractsById = new Map(
        MANAGEMENT_REPORT_CONTRACTS.map((item) => [item.id, item] as const),
      );

      return MANAGEMENT_REPORT_PAYMENT_PLANS.filter((item) => {
        const contract = contractsById.get(item.contractId);
        return (
          Boolean(contract) &&
          departmentIds.has(contract!.departmentId) &&
          item.receiveDate <= context.filter.endDate &&
          item.status === 'OVERDUE'
        );
      }).map((item) => ({
        ...item,
        customerName: contractsById.get(item.contractId)?.customerName ?? '--',
        ownerName: contractsById.get(item.contractId)?.ownerName ?? '--',
      }));
    }

    return this.requireLiveContextData(context).overduePlansByEnd;
  }

  /**
   * 统一识别风险商机。
   */
  listRiskOpportunities(context: ManagementReportContext) {
    return this.listOpenOpportunitiesByEndDate(context).filter((item) => {
      const staleRevisit = item.revisitAt
        ? this.diffDays(item.revisitAt, context.filter.endDate) > 14
        : true;
      const signPressure = Boolean(
        item.expectSignDate && item.expectSignDate <= context.filter.endDate,
      );
      return staleRevisit || signPressure;
    });
  }

  /**
   * 统一筛选待验收合同。
   */
  listPendingAcceptanceContracts(context: ManagementReportContext) {
    if (this.shouldUseMockData()) {
      return MANAGEMENT_REPORT_CONTRACTS.filter((item) => {
        const businessDate = item.signDate ?? item.createdAt;
        return (
          context.filter.includedDepartmentIds.includes(item.departmentId) &&
          businessDate <= context.filter.endDate &&
          !item.acceptedAt
        );
      });
    }

    return this.requireLiveContextData(context).contractsByEnd.filter(
      (item) => !item.acceptedAt,
    );
  }

  /**
   * 聚合求和并输出排序后的图表项。
   */
  groupSumBy<T>(
    items: T[],
    labelResolver: (item: T) => string,
    valueResolver: (item: T) => number,
  ) {
    const grouped = new Map<string, number>();
    for (const item of items) {
      const label = labelResolver(item);
      grouped.set(label, (grouped.get(label) ?? 0) + valueResolver(item));
    }

    return Array.from(grouped.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
  }

  /**
   * 聚合计数并输出排序后的图表项。
   */
  groupCountBy<T>(items: T[], labelResolver: (item: T) => string) {
    const grouped = new Map<string, number>();
    for (const item of items) {
      const label = labelResolver(item);
      grouped.set(label, (grouped.get(label) ?? 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
  }

  /**
   * 计算数字数组总和。
   */
  sumValues(values: number[]): number {
    return values.reduce((total, current) => total + current, 0);
  }

  /**
   * 将金额统一格式化为万元展示。
   */
  formatCurrency(value: number): string {
    return formatWanAmount(value);
  }

  /**
   * 将元级金额换算成万元数值，供图表继续保留可计算数值。
   */
  toWanAmount(value: number): number {
    return toWanAmount(value);
  }

  /**
   * 将比率统一格式化为百分比展示。
   */
  formatPercent(numerator: number, denominator: number): string {
    if (denominator <= 0) {
      return '0%';
    }

    return `${((numerator / denominator) * 100).toFixed(1)}%`;
  }

  /**
   * 构造数据质量行。
   */
  buildDataQualityRow(
    tableName: string,
    fieldName: string,
    filledCount: number,
    totalCount: number,
  ) {
    const missingCount = Math.max(totalCount - filledCount, 0);
    return {
      tableName,
      fieldName,
      filledCount: String(filledCount),
      missingCount: String(missingCount),
      completeness: this.formatPercent(filledCount, totalCount),
    };
  }

  /**
   * 判断商机阶段是否达到 10%/30%/50% 管理阈值。
   */
  resolveStageScore(stage: string): number {
    if (stage.includes('赢单') || stage.includes('50%') || stage.includes('谈判')) {
      return 50;
    }

    if (stage.includes('30%') || stage.includes('方案')) {
      return 30;
    }

    if (stage.includes('10%') || stage.includes('1%') || stage.includes('初访')) {
      return 10;
    }

    return 0;
  }

  /**
   * 构造当前不可用专题的厚退化结构。
   */
  private buildUnavailableSection(sectionKey: string): ManagementReportSectionData {
    return {
      sectionKey,
      title:
        sectionKey === 'agents'
          ? '代理商/生态'
          : sectionKey === 'products'
            ? '产品方案'
            : '专题暂不可用',
      summary: '当前专题字段仍在核对，但已保留足够的结构用于后续平滑切换成正式统计。',
      state: 'degraded',
      blocks: [
        createEmptyPreviewBlock({
          blockId: `${sectionKey}-empty`,
          title: '专题暂不可用',
          description: '当前专题还未完成正式映射，请稍后查看。',
        }),
      ],
      footnotes: ['字段核对完成后可切换为正式统计结果。'],
      emptyReason: '首版暂未开放正式统计。',
    };
  }

  /**
   * 真实库模式下加载当前上下文所需的基础对象池。
   */
  private async loadLiveContextData(
    context: ManagementReportContext,
  ): Promise<LiveContextData> {
    if (!this.crmReadonlyService) {
      throw new ServiceUnavailableException('CRM 只读服务未注册。');
    }

    const organizationIds = context.organizationIds ?? [];
    const isFullAccess = context.isFullAccess === true || context.scopeSource === 'application-super-admin';
    const departmentIds = !isFullAccess && context.filter.includedDepartmentIds.length > 0
      ? context.filter.includedDepartmentIds
      : ['__none__'];
    const ownerIds = !isFullAccess && (context.ownerIds?.length ?? 0) > 0
      ? context.ownerIds!
      : ['__none__'];
    const startAt = `${context.filter.startDate} 00:00:00`;
    const endExclusive = `${this.addOneDay(context.filter.endDate)} 00:00:00`;
    const endDate = context.filter.endDate;

    const [
      leadSourceValues,
      leadStatusValues,
      opportunityStageValues,
      opportunitySourceValues,
      customerCategoryValues,
    ] = await Promise.all([
      this.collectDistinctValues('leads', 'source', `created_at >= '${startAt}' and created_at < '${endExclusive}'`, departmentIds, ownerIds, isFullAccess),
      this.collectDistinctValues('leads', 'status', `created_at >= '${startAt}' and created_at < '${endExclusive}'`, departmentIds, ownerIds, isFullAccess),
      this.collectDistinctValues('opportunities', 'stage', `coalesce(get_time, date(created_at)) <= '${endDate}' and ${this.buildApprovedEntityCondition()}`, departmentIds, ownerIds, isFullAccess),
      this.collectDistinctValues('opportunities', 'source', `coalesce(get_time, date(created_at)) <= '${endDate}' and ${this.buildApprovedEntityCondition()}`, departmentIds, ownerIds, isFullAccess),
      this.collectDistinctValues('customers', 'category', `created_at < '${endExclusive}' and ${this.buildApprovedEntityCondition()}`, departmentIds, ownerIds, isFullAccess),
    ]);

    const [
      leadSourceOptionMap,
      leadStatusOptionMap,
      opportunityStageOptionMap,
      opportunitySourceOptionMap,
      customerCategoryOptionMap,
      customerCustomFields,
      leadCustomFields,
      opportunityCustomFields,
    ] = await Promise.all([
      this.loadFieldValueMap('source', 'Lead', organizationIds, leadSourceValues),
      this.loadFieldValueMap('status', 'Lead', organizationIds, leadStatusValues),
      this.loadFieldValueMap('stage', 'Opportunity', organizationIds, opportunityStageValues),
      this.loadFieldValueMap('source', 'Opportunity', organizationIds, opportunitySourceValues),
      this.loadFieldValueMap('category', 'Customer', organizationIds, customerCategoryValues),
      this.loadCustomFieldDefinitions(
        organizationIds,
        ['IT决策权所在地', '所属主行业'],
      ),
      this.loadCustomFieldDefinitions(
        organizationIds,
        ['咨询内容', '咨询角色', '产品类型'],
      ),
      this.loadCustomFieldDefinitions(
        organizationIds,
        ['代理商全称', '生态项目分类', '产品解决方案', '行业解决方案'],
      ),
    ]);

    const customerScope = this.buildOwnershipScopeCondition('c', 'c', isFullAccess, departmentIds, ownerIds);
    const customerRows = await this.crmReadonlyService.executeQuery<{
      id: string;
      departmentId: string | null;
      userId: string;
      ownerName: string | null;
      name: string | null;
      companyName: string | null;
      createdAt: string;
      categoryCode: string | null;
      latestFollowUpAt: string | null;
    }>(
      `
      select
        cast(c.id as char) as id,
        cast(c.department_id as char) as departmentId,
        cast(c.user_id as char) as userId,
        u.name as ownerName,
        c.name as name,
        c.company_name as companyName,
        date(c.created_at) as createdAt,
        cast(c.category as char) as categoryCode,
        date(coalesce(c.real_revisit_at, c.revisit_at)) as latestFollowUpAt
      from customers c
      left join users u on u.id = c.user_id
      where ${customerScope.sql}
        and ${this.buildApprovedEntityCondition('c')}
        and c.created_at < ?
      `,
      [...customerScope.params, endExclusive],
    );

    const customerIds = customerRows.map((item) => item.id);
    const [customerAddressMap, customerAssetMap] = await Promise.all([
      this.loadCustomerAddressMap(customerIds),
      this.loadCustomerAssetMap(
        customerIds,
        customerCustomFields,
      ),
    ]);

    const opportunityScope = this.buildOwnershipScopeCondition('o', 'o', isFullAccess, departmentIds, ownerIds);
    const opportunityRows = await this.crmReadonlyService.executeQuery<{
      id: string;
      departmentId: string | null;
      userId: string;
      ownerName: string | null;
      customerId: string | null;
      customerName: string | null;
      amount: string | number | null;
      stageCode: string | null;
      sourceCode: string | null;
      kindCode: string | null;
      createdAt: string;
      getTime: string | null;
      expectSignDate: string | null;
      revisitAt: string | null;
      stageUpdatedAt: string | null;
      commitmentFlag: string | null;
    }>(
      `
      select
        cast(o.id as char) as id,
        cast(o.department_id as char) as departmentId,
        cast(o.user_id as char) as userId,
        u.name as ownerName,
        cast(o.customer_id as char) as customerId,
        coalesce(c.name, c.company_name) as customerName,
        o.expect_amount as amount,
        cast(o.stage as char) as stageCode,
        cast(o.source as char) as sourceCode,
        cast(o.kind as char) as kindCode,
        date(o.created_at) as createdAt,
        date(o.get_time) as getTime,
        date(o.expect_sign_date) as expectSignDate,
        date(coalesce(o.real_revisit_at, o.revisit_at)) as revisitAt,
        date(o.stage_updated_at) as stageUpdatedAt,
        oa_commitment.text_asset as commitmentFlag
      from opportunities o
      left join users u on u.id = o.user_id
      left join customers c on c.id = o.customer_id
      left join opportunity_assets oa_commitment
        on oa_commitment.entity_id = o.id
       and oa_commitment.custom_field_name = '${OPPORTUNITY_COMMITMENT_FIELD_NAME}'
      where ${opportunityScope.sql}
        and ${this.buildApprovedEntityCondition('o')}
        and coalesce(o.get_time, date(o.created_at)) <= ?
      `,
      [...opportunityScope.params, endDate],
    );

    const opportunityIds = opportunityRows.map((item) => item.id);
    const opportunityAssetMap = await this.loadOpportunityAssetMap(
      opportunityIds,
      opportunityCustomFields,
    );

    const contractScope = this.buildOwnershipScopeCondition('ct', 'ct', isFullAccess, departmentIds, ownerIds);
    const contractRows = await this.crmReadonlyService.executeQuery<{
      id: string;
      departmentId: string | null;
      userId: string;
      ownerName: string | null;
      customerId: string | null;
      customerName: string | null;
      amount: string | number | null;
      createdAt: string;
      signDate: string | null;
      statusCode: string | null;
      endAt: string | null;
      receivedPaymentsAmount: string | number | null;
      unreceivedAmount: string | number | null;
    }>(
      `
      select
        cast(ct.id as char) as id,
        cast(ct.department_id as char) as departmentId,
        cast(ct.user_id as char) as userId,
        u.name as ownerName,
        cast(ct.customer_id as char) as customerId,
        coalesce(c.name, c.company_name) as customerName,
        ca_valid_income.valid_income as amount,
        date(ct.created_at) as createdAt,
        date(ct.sign_date) as signDate,
        cast(ct.status as char) as statusCode,
        date(ct.end_at) as endAt,
        ct.received_payments_amount as receivedPaymentsAmount,
        ct.unreceived_amount as unreceivedAmount
      from contracts ct
      left join users u on u.id = ct.user_id
      left join customers c on c.id = ct.customer_id
      left join (
        select entity_id, sum(coalesce(numeric_asset, 0)) as valid_income
        from contract_assets
        where custom_field_name = '${CONTRACT_VALID_INCOME_FIELD_NAME}'
        group by entity_id
      ) ca_valid_income on ca_valid_income.entity_id = ct.id
      where ${contractScope.sql}
        and ${this.buildApprovedEntityCondition('ct')}
        and coalesce(ct.sign_date, date(ct.created_at)) <= ?
      `,
      [...contractScope.params, endDate],
    );

    const contractStatusMap = await this.loadFieldValueMap(
      'status',
      'Contract',
      organizationIds,
      Array.from(new Set(contractRows.map((item) => item.statusCode).filter(Boolean))) as string[],
    );
    const planRowsRaw = await this.crmReadonlyService.executeQuery<{
      id: string;
      contractId: string;
      amount: string | number | null;
      receivedAmount: string | number | null;
      receiveDate: string;
      status: number;
      customerName: string | null;
      ownerName: string | null;
      departmentId: string | null;
      userId: string;
    }>(
      `
      select
        cast(rpp.id as char) as id,
        cast(rpp.contract_id as char) as contractId,
        rpp.amount as amount,
        rpp.received_amount as receivedAmount,
        date(rpp.receive_date) as receiveDate,
        rpp.status as status,
        coalesce(c.name, c.company_name) as customerName,
        u.name as ownerName,
        cast(ct.department_id as char) as departmentId,
        cast(ct.user_id as char) as userId
      from received_payment_plans rpp
      inner join contracts ct on ct.id = rpp.contract_id
      left join customers c on c.id = ct.customer_id
      left join users u on u.id = ct.user_id
      where ${contractScope.sql}
        and ${this.buildApprovedEntityCondition('ct')}
        and rpp.receive_date <= ?
      `,
      [...contractScope.params, endDate],
    );
    const paymentRowsRaw = await this.crmReadonlyService.executeQuery<{
      id: string;
      contractId: string;
      amount: string | number | null;
      receiveDate: string;
      customerName: string | null;
      ownerName: string | null;
      departmentId: string | null;
      userId: string;
    }>(
      `
      select
        cast(rp.id as char) as id,
        cast(rp.contract_id as char) as contractId,
        rp.amount as amount,
        date(rp.receive_date) as receiveDate,
        coalesce(c.name, c.company_name) as customerName,
        u.name as ownerName,
        cast(ct.department_id as char) as departmentId,
        cast(ct.user_id as char) as userId
      from received_payments rp
      inner join contracts ct on ct.id = rp.contract_id
      left join customers c on c.id = ct.customer_id
      left join users u on u.id = ct.user_id
      where ${contractScope.sql}
        and ${this.buildApprovedEntityCondition('ct')}
        and (rp.submit_applying_at is null or rp.finish_approve_at is not null)
        and rp.receive_date >= ?
        and rp.receive_date <= ?
      `,
      [...contractScope.params, context.filter.startDate, endDate],
    );

    const customerById = new Map<string, ManagementReportCustomerRecord>();
    const opportunityStatsByCustomer = new Map<string, { firstAt?: string; total: number; wonAt?: string }>();
    for (const row of opportunityRows) {
      if (!row.customerId) {
        continue;
      }

      const businessDate = row.getTime ?? row.createdAt;
      const current = opportunityStatsByCustomer.get(row.customerId) ?? { total: 0 };
      current.total += 1;
      if (!current.firstAt || businessDate < current.firstAt) {
        current.firstAt = businessDate;
      }
      const stageLabel = opportunityStageOptionMap[row.stageCode ?? ''] ?? row.stageCode ?? '未知阶段';
      if (stageLabel.includes('赢单') && (!current.wonAt || businessDate < current.wonAt)) {
        current.wonAt = businessDate;
      }
      opportunityStatsByCustomer.set(row.customerId, current);
    }

    const historyDealCustomerIds = new Set(
      contractRows
        .filter((row) => this.resolveContractAccepted(contractStatusMap[row.statusCode ?? ''] ?? row.statusCode ?? ''))
        .map((row) => row.customerId)
        .filter((item): item is string => Boolean(item)),
    );

    const customersByEnd: ManagementReportCustomerRecord[] = customerRows.map((row) => {
      const asset = customerAssetMap.get(row.id);
      const address = customerAddressMap.get(row.id);
      const opportunityStat = opportunityStatsByCustomer.get(row.id);
      const locationText = asset?.itDecisionLocation || address?.regionInfo || '';
      const { region, city } = this.deriveRegionAndCity(locationText, address?.provinceName, address?.cityName);
      const industry = asset?.mainIndustry || '未分类';
      const hasOpportunity = Boolean(opportunityStat?.total);
      const latestFollowUp = this.normalizeDateValue(row.latestFollowUpAt);
      const createdAt = this.normalizeDateValue(row.createdAt) ?? '1970-01-01';
      return {
        id: row.id,
        departmentId: row.departmentId ?? '__unknown__',
        name: row.name?.trim() || row.companyName?.trim() || `客户#${row.id}`,
        ownerName: row.ownerName?.trim() || row.userId,
        level: customerCategoryOptionMap[row.categoryCode ?? ''] ?? '未分级',
        city,
        region,
        industry,
        createdAt,
        activeSince: opportunityStat?.firstAt,
        hasOpportunity,
        followUpStatus: this.resolveCustomerFollowUpStatus(hasOpportunity, latestFollowUp ?? null, context.filter.endDate),
        historyDeal: historyDealCustomerIds.has(row.id),
        lifecycleStage: this.resolveCustomerLifecycleStage({
          hasOpportunity,
          historyDeal: historyDealCustomerIds.has(row.id),
          createdAt,
          startDate: context.filter.startDate,
          latestFollowUpAt: latestFollowUp ?? null,
          endDate: context.filter.endDate,
        }),
      };
    });
    for (const customer of customersByEnd) {
      customerById.set(customer.id, customer);
    }

    const opportunitiesByEnd: ManagementReportOpportunityRecord[] = opportunityRows.map((row) => {
      const customer = row.customerId ? customerById.get(row.customerId) : undefined;
      const asset = opportunityAssetMap.get(row.id);
      const stage = opportunityStageOptionMap[row.stageCode ?? ''] ?? row.stageCode ?? '未知阶段';
      const source = opportunitySourceOptionMap[row.sourceCode ?? ''] ?? row.sourceCode ?? '未知来源';
      const amount = Number(row.amount ?? 0);
      const ecosystemType = this.normalizeEcosystemType(asset?.ecosystemType);
      const createdAt = this.normalizeDateValue(row.createdAt) ?? '1970-01-01';
      const getTime = this.normalizeDateValue(row.getTime) ?? createdAt;
      const expectSignDate = this.normalizeDateValue(row.expectSignDate);
      const revisitAt = this.normalizeDateValue(row.revisitAt) ?? this.normalizeDateValue(row.stageUpdatedAt);
      const stageUpdatedAt = this.normalizeDateValue(row.stageUpdatedAt);
      return {
        id: row.id,
        departmentId: row.departmentId ?? '__unknown__',
        ownerName: row.ownerName?.trim() || row.userId,
        customerName: row.customerName?.trim() || customer?.name || `商机客户#${row.customerId ?? row.id}`,
        region: customer?.region ?? '未分区',
        city: customer?.city ?? '未知城市',
        industry: customer?.industry ?? '未分类',
        amount,
        stage,
        source,
        agentName: asset?.agentName,
        ecosystemType,
        productSolution: asset?.productSolution ?? '未配置方案',
        industrySolution: asset?.industrySolution ?? '未配置行业方案',
        promised: row.commitmentFlag === OPPORTUNITY_COMMITMENT_SELECTED_VALUE || asset?.promised === true,
        createdAt,
        getTime,
        expectSignDate: expectSignDate ?? undefined,
        revisitAt: revisitAt ?? undefined,
        stageUpdatedAt: stageUpdatedAt ?? undefined,
      };
    });

    const contractsByEnd: ManagementReportContractRecord[] = contractRows.map((row) => {
      const statusLabel = contractStatusMap[row.statusCode ?? ''] ?? row.statusCode ?? '未知状态';
      const accepted = this.resolveContractAccepted(statusLabel);
      const createdAt = this.normalizeDateValue(row.createdAt) ?? '1970-01-01';
      const signDate = this.normalizeDateValue(row.signDate) ?? createdAt;
      const endAt = this.normalizeDateValue(row.endAt);
      return {
        id: row.id,
        departmentId: row.departmentId ?? '__unknown__',
        customerName: row.customerName?.trim() || `合同客户#${row.customerId ?? row.id}`,
        ownerName: row.ownerName?.trim() || row.userId,
        amount: Number(row.amount ?? 0),
        createdAt,
        signDate,
        acceptedAt: accepted ? (endAt ?? signDate ?? createdAt) : undefined,
        expectedAcceptanceDate: endAt ?? signDate ?? undefined,
      };
    });

    const plansByEnd: PaymentPlanView[] = planRowsRaw.map((row) => {
      const amount = Number(row.amount ?? 0);
      const receivedAmount = Number(row.receivedAmount ?? 0);
      const receiveDate = this.normalizeDateValue(row.receiveDate) ?? '1970-01-01';
      return {
        id: row.id,
        contractId: row.contractId,
        amount,
        receiveDate,
        status: this.resolvePaymentPlanStatus(row.status, receiveDate, amount, receivedAmount, context.filter.endDate),
        customerName: row.customerName?.trim() || `合同#${row.contractId}`,
        ownerName: row.ownerName?.trim() || row.userId,
      };
    });
    const paymentsInRange: PaymentView[] = paymentRowsRaw.map((row) => ({
      id: row.id,
      contractId: row.contractId,
      amount: Number(row.amount ?? 0),
      receiveDate: this.normalizeDateValue(row.receiveDate) ?? '1970-01-01',
      customerName: row.customerName?.trim() || `合同#${row.contractId}`,
      ownerName: row.ownerName?.trim() || row.userId,
    }));

    const leadScope = this.buildOwnershipScopeCondition('l', 'l', isFullAccess, departmentIds, ownerIds);
    const leadRows = (await this.crmReadonlyService.executeQuery(
      `
      select
        cast(l.id as char) as id,
        cast(l.department_id as char) as departmentId,
        cast(l.user_id as char) as userId,
        u.name as ownerName,
        coalesce(nullif(l.company_name, ''), l.name) as companyName,
        cast(l.source as char) as sourceCode,
        cast(l.status as char) as statusCode,
        date(l.created_at) as createdAt,
        date(l.turned_at) as turnedAt,
        cast(l.turned_customer_id as char) as turnedCustomerId,
        l.customer_requirement as customerRequirement
      from leads l
      left join users u on u.id = l.user_id
      where ${leadScope.sql}
        and l.created_at >= ?
        and l.created_at < ?
      `,
      [...leadScope.params, startAt, endExclusive],
    )) as Array<{
      id: string;
      departmentId: string | null;
      userId: string;
      ownerName: string | null;
      companyName: string | null;
      sourceCode: string | null;
      statusCode: string | null;
      createdAt: string;
      turnedAt: string | null;
      turnedCustomerId: string | null;
      customerRequirement: string | null;
    }>;
    const leadAssetMap = await this.loadLeadAssetMap(
      leadRows.map((item) => item.id),
      leadCustomFields,
    );
    const leadsInRange: ManagementReportLeadRecord[] = leadRows.map((row) => {
      const leadAsset = leadAssetMap.get(row.id);
      const source = leadSourceOptionMap[row.sourceCode ?? ''] ?? row.sourceCode ?? '未知来源';
      const status = leadStatusOptionMap[row.statusCode ?? ''] ?? row.statusCode ?? '未知状态';
      const turnedCustomerId = row.turnedCustomerId ? String(row.turnedCustomerId) : undefined;
      const createdAt = this.normalizeDateValue(row.createdAt) ?? '1970-01-01';
      const turnedAt = this.normalizeDateValue(row.turnedAt);
      const leadIntentText = [
        leadAsset?.consultationRole,
        leadAsset?.consultationContent,
        leadAsset?.productType,
        row.customerRequirement,
      ]
        .filter((item): item is string => Boolean(item?.trim()))
        .join('；');
      const convertedOpportunities = row.turnedCustomerId
        ? opportunitiesByEnd
            .filter((item) =>
              item.customerName === (customerById.get(turnedCustomerId ?? '')?.name ?? ''),
            )
            .sort((left, right) =>
              String(left.getTime ?? left.createdAt).localeCompare(
                String(right.getTime ?? right.createdAt),
              ),
            )
        : [];
      const wonAt = convertedOpportunities.find((item) => item.stage.includes('赢单'))?.getTime;
      return {
        id: row.id,
        departmentId: row.departmentId ?? '__unknown__',
        companyName: row.companyName?.trim() || `线索#${row.id}`,
        ownerName: row.ownerName?.trim() || row.userId,
        source,
        followUpStatus: this.resolveLeadFollowUpStatus(status),
        qualityLevel: this.resolveLeadQualityLevel(status, Boolean(convertedOpportunities.length), Boolean(row.turnedCustomerId)),
        demandTag: this.extractDemandTag(leadIntentText),
        responseHours: this.resolveLeadResponseHours(createdAt, turnedAt),
        customerRole: this.resolveCustomerRole(leadIntentText, row.companyName ?? ''),
        createdAt,
        convertedCustomerAt: row.turnedCustomerId ? turnedAt ?? undefined : undefined,
        convertedOpportunityAt: convertedOpportunities[0]?.getTime,
        wonAt,
        riskFlag: this.resolveLeadRiskFlag(status, turnedAt ?? null, context.filter.endDate),
      };
    });

    const customersInRange = customersByEnd.filter((item) =>
      this.isBetween(item.createdAt, context.filter.startDate, context.filter.endDate),
    );
    const opportunitiesInRange = opportunitiesByEnd.filter((item) =>
      this.isBetween(item.getTime ?? item.createdAt, context.filter.startDate, context.filter.endDate),
    );
    const contractsInRange = contractsByEnd.filter((item) =>
      this.isBetween(item.signDate ?? item.createdAt, context.filter.startDate, context.filter.endDate),
    );
    const paymentPlansInRange = plansByEnd.filter((item) =>
      this.isBetween(item.receiveDate, context.filter.startDate, context.filter.endDate),
    );
    const overduePlansByEnd = plansByEnd.filter((item) => item.status === 'OVERDUE');

    return {
      leadsInRange,
      customersByEnd,
      customersInRange,
      opportunitiesByEnd,
      opportunitiesInRange,
      contractsByEnd,
      contractsInRange,
      paymentPlansByEnd: plansByEnd,
      paymentPlansInRange,
      overduePlansByEnd,
      paymentsInRange,
    };
  }

  /**
   * 读取当前上下文缓存，运行态未命中时直接视为调用顺序错误。
   */
  private requireLiveContextData(context: ManagementReportContext): LiveContextData {
    const data = this.liveContextCache.get(context.reportId);
    if (!data) {
      throw new ServiceUnavailableException('经营报表真实数据尚未准备好，请先刷新快照。');
    }

    return data;
  }

  /**
   * 当前是否仍应走样本分支。
   */
  private shouldUseMockData(): boolean {
    return process.env.NODE_ENV === 'test' || !this.crmReadonlyService;
  }

  /**
   * 查询某张主表中的离散枚举值。
   */
  private async collectDistinctValues(
    tableName: 'leads' | 'opportunities' | 'customers',
    fieldName: string,
    whereClause: string,
    departmentIds: string[],
    ownerIds: string[],
    isFullAccess = false,
  ): Promise<string[]> {
    if (!this.crmReadonlyService) {
      return [];
    }

    const userField = tableName === 'customers' ? 'user_id' : 'user_id';
    const scopeCondition = this.buildOwnershipScopeCondition(undefined, undefined, isFullAccess, departmentIds, ownerIds);
    const [rows] = await Promise.all([
      this.crmReadonlyService.executeQuery<{ value: string | null }>(
        `
        select distinct cast(${fieldName} as char) as value
        from ${tableName}
        where ${scopeCondition.sql.replace('user_id', userField)}
          and ${whereClause}
          and ${fieldName} is not null
          and cast(${fieldName} as char) <> ''
        `,
        scopeCondition.params,
      ),
    ]);

    return rows
      .map((item) => item.value?.trim() ?? '')
      .filter(Boolean);
  }

  /**
   * 构造部门/负责人范围条件。
   * 参数：部门字段别名、负责人字段别名、是否全量范围、部门 ID、负责人 ID。
   * 返回：SQL 条件和参数。
   * 注意：应用超级管理员全量范围必须生成恒真条件，避免空数组被误转成无结果占位。
   */
  private buildOwnershipScopeCondition(
    departmentAlias: string | undefined,
    userAlias: string | undefined,
    isFullAccess: boolean,
    departmentIds: string[],
    ownerIds: string[],
  ): { sql: string; params: unknown[] } {
    if (isFullAccess) {
      return {
        sql: '1 = 1',
        params: [],
      };
    }

    const departmentPrefix = departmentAlias ? `${departmentAlias}.` : '';
    const userPrefix = userAlias ? `${userAlias}.` : '';
    return {
      sql: `((cast(${departmentPrefix}department_id as char) in (?)) or (${departmentPrefix}department_id is null and cast(${userPrefix}user_id as char) in (?)))`,
      params: [departmentIds, ownerIds],
    };
  }

  /**
   * 通过 field_values 把枚举值映射成可读中文。
   */
  private async loadFieldValueMap(
    fieldName: string,
    klassName: 'Lead' | 'Opportunity' | 'Customer' | 'Contract',
    organizationIds: string[],
    values: string[],
  ): Promise<Record<string, string>> {
    if (!this.crmReadonlyService || values.length === 0) {
      return {};
    }

    return this.crmReadonlyService.resolveFieldValueLabels({
      fieldName,
      values,
      organizationIds,
      klassNameLike: `%${klassName}%`,
    });
  }

  /**
   * 读取当前组织下所需的自定义字段定义，并解析下拉/多选选项。
   */
  private async loadCustomFieldDefinitions(
    organizationIds: string[],
    labels: string[],
  ): Promise<CustomFieldDefinition[]> {
    if (!this.crmReadonlyService || labels.length === 0) {
      return [];
    }

    const rows = await this.crmReadonlyService.executeQuery<{
      id: number;
      label: string;
      origin_label: string | null;
      field_type: string;
      options: string | null;
    }>(
      `
      select id, label, origin_label, field_type, options
      from custom_fields
      where (label in (?) or origin_label in (?))
        ${
          organizationIds.length > 0
            ? 'and (cast(organization_id as char) in (?) or organization_id is null)'
            : ''
        }
      `,
      organizationIds.length > 0 ? [labels, labels, organizationIds] : [labels, labels],
    );

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      originLabel: row.origin_label ?? undefined,
      fieldType: row.field_type,
      optionMap: this.parseSelectOptions(row.options ?? ''),
    }));
  }

  /**
   * 构造审批完成过滤条件，避免经营报表把仍在审批流中的对象计入经营结果。
   */
  private buildApprovedEntityCondition(alias?: string): string {
    const prefix = alias ? `${alias}.` : '';
    return `coalesce(${prefix}pending_step, 0) = 0 and (${prefix}submit_applying_at is null or ${prefix}finish_approve_at is not null)`;
  }

  /**
   * 读取客户地址信息。
   */
  private async loadCustomerAddressMap(customerIds: string[]) {
    if (!this.crmReadonlyService || customerIds.length === 0) {
      return new Map<string, { regionInfo?: string; cityName?: string; provinceName?: string }>();
    }

    const rows = await this.crmReadonlyService.executeQuery<{
      customerId: string;
      regionInfo: string | null;
      cityName: string | null;
      provinceName: string | null;
    }>(
      `
      select
        cast(la.addressable_id as char) as customerId,
        ca.region_info as regionInfo,
        ci.name as cityName,
        pr.name as provinceName
      from (
        select addressable_id, max(id) as latest_id
        from customer_addresses
        where addressable_type = 'Customer'
          and cast(addressable_id as char) in (?)
        group by addressable_id
      ) la
      inner join customer_addresses ca on ca.id = la.latest_id
      left join cities ci on ci.id = ca.city_id
      left join provinces pr on pr.id = ca.province_id
      `,
      [customerIds],
    );

    return new Map(
      rows.map((row) => [
        row.customerId,
        {
          regionInfo: row.regionInfo ?? undefined,
          cityName: row.cityName ?? undefined,
          provinceName: row.provinceName ?? undefined,
        },
      ] as const),
    );
  }

  /**
   * 读取客户扩展字段。
   */
  private async loadCustomerAssetMap(
    customerIds: string[],
    definitions: CustomFieldDefinition[],
  ) {
    if (!this.crmReadonlyService || customerIds.length === 0 || definitions.length === 0) {
      return new Map<string, { itDecisionLocation?: string; mainIndustry?: string }>();
    }

    const fieldIds = definitions.map((item) => item.id);
    const definitionById = new Map(definitions.map((item) => [item.id, item] as const));
    const rows = await this.crmReadonlyService.executeQuery<{
      customerId: string;
      customFieldId: number;
      textAsset: string | null;
    }>(
      `
      select cast(entity_id as char) as customerId, custom_field_id as customFieldId, text_asset as textAsset
      from customer_assets
      where cast(entity_id as char) in (?)
        and custom_field_id in (?)
      `,
      [customerIds, fieldIds],
    );

    const result = new Map<string, { itDecisionLocation?: string; mainIndustry?: string }>();

    for (const row of rows) {
      const current = result.get(row.customerId) ?? {};
      const definition = definitionById.get(row.customFieldId);
      if (!definition) {
        continue;
      }

      if (definition.label === 'IT决策权所在地') {
        current.itDecisionLocation = row.textAsset?.trim() || current.itDecisionLocation;
      }

      if (definition.label === '所属主行业') {
        current.mainIndustry = this.decodeOptionValue(
          row.textAsset ?? '',
          definition.optionMap,
        );
      }

      result.set(row.customerId, current);
    }

    return result;
  }

  /**
   * 读取线索扩展字段，补齐咨询内容、咨询角色和产品类型。
   */
  private async loadLeadAssetMap(
    leadIds: string[],
    definitions: CustomFieldDefinition[],
  ) {
    if (!this.crmReadonlyService || leadIds.length === 0 || definitions.length === 0) {
      return new Map<string, LeadAssetView>();
    }

    const fieldIds = definitions.map((item) => item.id);
    const definitionById = new Map(definitions.map((item) => [item.id, item] as const));
    const rows = await this.crmReadonlyService.executeQuery<{
      leadId: string;
      customFieldId: number;
      textAsset: string | null;
    }>(
      `
      select cast(entity_id as char) as leadId, custom_field_id as customFieldId, text_asset as textAsset
      from lead_assets
      where cast(entity_id as char) in (?)
        and custom_field_id in (?)
      `,
      [leadIds, fieldIds],
    );

    const result = new Map<string, LeadAssetView>();

    for (const row of rows) {
      const current = result.get(row.leadId) ?? {};
      const definition = definitionById.get(row.customFieldId);
      if (!definition) {
        continue;
      }

      if (definition.label === '咨询内容') {
        current.consultationContent = row.textAsset?.trim() || current.consultationContent;
      }

      if (definition.label === '咨询角色') {
        current.consultationRole = this.decodeOptionValue(
          row.textAsset ?? '',
          definition.optionMap,
        );
      }

      if (definition.label === '产品类型') {
        current.productType = this.decodeOptionValue(
          row.textAsset ?? '',
          definition.optionMap,
        );
      }

      result.set(row.leadId, current);
    }

    return result;
  }

  /**
   * 读取商机扩展字段。
   */
  private async loadOpportunityAssetMap(
    opportunityIds: string[],
    definitions: CustomFieldDefinition[],
  ) {
    if (!this.crmReadonlyService || opportunityIds.length === 0) {
      return new Map<string, { agentName?: string; ecosystemType?: string; productSolution?: string; industrySolution?: string; promised?: boolean }>();
    }

    const fieldIds = definitions.map((item) => item.id);
    const definitionById = new Map(definitions.map((item) => [item.id, item] as const));
    const rows = await this.crmReadonlyService.executeQuery<{
      opportunityId: string;
      customFieldId: number | null;
      customFieldName: string | null;
      textAsset: string | null;
    }>(
      `
      select
        cast(entity_id as char) as opportunityId,
        custom_field_id as customFieldId,
        custom_field_name as customFieldName,
        text_asset as textAsset
      from opportunity_assets
      where cast(entity_id as char) in (?)
        and (
          custom_field_name = '${OPPORTUNITY_COMMITMENT_FIELD_NAME}'
          ${fieldIds.length > 0 ? 'or custom_field_id in (?)' : ''}
        )
      `,
      fieldIds.length > 0 ? [opportunityIds, fieldIds] : [opportunityIds],
    );

    const result = new Map<string, { agentName?: string; ecosystemType?: string; productSolution?: string; industrySolution?: string; promised?: boolean }>();

    for (const row of rows) {
      const current = result.get(row.opportunityId) ?? {};
      if (row.customFieldName === OPPORTUNITY_COMMITMENT_FIELD_NAME) {
        current.promised = row.textAsset === OPPORTUNITY_COMMITMENT_SELECTED_VALUE;
        result.set(row.opportunityId, current);
        continue;
      }

      if (row.customFieldId === null) {
        result.set(row.opportunityId, current);
        continue;
      }

      const definition = definitionById.get(row.customFieldId);
      if (!definition) {
        continue;
      }

      if (definition.label === '代理商全称') {
        current.agentName = row.textAsset?.trim() || current.agentName;
      }

      if (definition.label === '生态项目分类') {
        current.ecosystemType = this.decodeOptionValue(
          row.textAsset ?? '',
          definition.optionMap,
        );
      }

      if (definition.label === '产品解决方案') {
        current.productSolution = this.decodeOptionValue(
          row.textAsset ?? '',
          definition.optionMap,
        );
      }

      if (definition.label === '行业解决方案') {
        current.industrySolution = this.decodeOptionValue(
          row.textAsset ?? '',
          definition.optionMap,
        );
      }

      result.set(row.opportunityId, current);
    }

    return result;
  }

  /**
   * 解析自定义字段 options 中的选项映射。
   */
  private parseSelectOptions(rawOptions: string): Record<string, string> {
    const optionMap: Record<string, string> = {};
    const pattern = /- - (.+?)\n\s+- ([^\n]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(rawOptions)) !== null) {
      optionMap[match[2].trim()] = match[1].trim();
    }
    return optionMap;
  }

  /**
   * 把 select/multi_select 编码翻译成中文标签。
   */
  private decodeOptionValue(value: string, optionMap: Record<string, string>): string {
    const rawValue = value.trim();
    if (!rawValue) {
      return '未分类';
    }

    const translated = rawValue
      .split(',')
      .map((item) => optionMap[item.trim()] ?? item.trim())
      .filter(Boolean);

    return translated.length > 0 ? translated.join('、') : rawValue;
  }

  /**
   * 由 IT 决策地或地址推导区域和城市。
   */
  private deriveRegionAndCity(
    locationText: string,
    provinceName?: string,
    cityName?: string,
  ) {
    const normalizedLocation = locationText.trim();
    if (normalizedLocation) {
      const segments = normalizedLocation.split(/\s+/).filter(Boolean);
      if (segments.length >= 2) {
        return {
          region: segments[0].replace('中国', '').trim() || provinceName || '未分区',
          city: segments[segments.length - 1] || cityName || '未知城市',
        };
      }

      if (normalizedLocation.includes('省') || normalizedLocation.includes('市')) {
        const cityMatch = normalizedLocation.match(/([\u4e00-\u9fa5]+市)/u);
        const provinceMatch = normalizedLocation.match(/([\u4e00-\u9fa5]+省)/u);
        return {
          region: provinceMatch?.[1] ?? provinceName ?? normalizedLocation,
          city: cityMatch?.[1] ?? cityName ?? normalizedLocation,
        };
      }
    }

    return {
      region: provinceName ?? '未分区',
      city: cityName ?? '未知城市',
    };
  }

  /**
   * 解析线索跟进状态。
   */
  private resolveLeadFollowUpStatus(rawStatus: string): ManagementReportLeadRecord['followUpStatus'] {
    if (rawStatus.includes('待处理')) {
      return '待处理';
    }
    if (rawStatus.includes('无效') || rawStatus.includes('联系方式无效')) {
      return '关闭';
    }
    if (rawStatus.includes('已转化')) {
      return '已转商机';
    }
    return '持续跟进';
  }

  /**
   * 解析线索质量等级。
   */
  private resolveLeadQualityLevel(
    rawStatus: string,
    hasOpportunity: boolean,
    hasCustomer: boolean,
  ): ManagementReportLeadRecord['qualityLevel'] {
    if (rawStatus.includes('无效') || rawStatus.includes('联系方式无效')) {
      return '风险';
    }
    if (hasOpportunity) {
      return '高质量';
    }
    if (hasCustomer) {
      return '中质量';
    }
    return '待培育';
  }

  /**
   * 从需求正文中抽取一个粗粒度需求标签。
   */
  private extractDemandTag(requirement?: string | null): string {
    const rawText = requirement?.trim() ?? '';
    if (!rawText) {
      return '未填写需求';
    }

    const normalizedText = rawText.toLowerCase();

    // 真实 CRM 里的需求正文写法非常分散，这里统一做别名归并，避免大量文本被压成“通用安全”。
    for (const rule of DEMAND_TAG_RULES) {
      if (rule.keywords.some((keyword) => normalizedText.includes(keyword))) {
        return rule.label;
      }
    }

    return '通用安全';
  }

  /**
   * 从需求正文推测客户角色。
   */
  private resolveCustomerRole(
    requirement?: string | null,
    companyName?: string | null,
  ): ManagementReportLeadRecord['customerRole'] {
    const rawText = [requirement?.trim() ?? '', companyName?.trim() ?? '']
      .filter(Boolean)
      .join('；');
    if (rawText.includes('代理商')) {
      return '代理商';
    }
    if (rawText.includes('集成商')) {
      return '集成商';
    }
    if (rawText.includes('同行')) {
      return '集成商';
    }
    if (rawText.includes('最终用户')) {
      return '最终客户';
    }
    return '最终客户';
  }

  /**
   * 估算线索响应时长。
   */
  private resolveLeadResponseHours(createdAt: string, followedAt?: string | null): number {
    if (!followedAt) {
      return 72;
    }

    const start = new Date(`${createdAt}T00:00:00.000Z`).getTime();
    const end = new Date(`${followedAt}T00:00:00.000Z`).getTime();
    const diffHours = Math.max(Math.round((end - start) / (60 * 60 * 1000)), 1);
    return diffHours;
  }

  /**
   * 判定线索风险。
   */
  private resolveLeadRiskFlag(rawStatus: string, turnedAt: string | null, endDate: string): boolean {
    if (rawStatus.includes('待处理') || rawStatus.includes('无效')) {
      return true;
    }

    if (!turnedAt) {
      return true;
    }

    return this.diffDays(turnedAt, endDate) > 30;
  }

  /**
   * 归一化 mysql 返回的 date/datetime 值。
   */
  private normalizeDateValue(value: string | Date | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const text = String(value).trim();
    if (!text) {
      return undefined;
    }

    return text.slice(0, 10);
  }

  /**
   * 判定客户跟进状态。
   */
  private resolveCustomerFollowUpStatus(
    hasOpportunity: boolean,
    latestFollowUpAt: string | null,
    endDate: string,
  ): ManagementReportCustomerRecord['followUpStatus'] {
    if (hasOpportunity) {
      return '持续推进';
    }
    if (!latestFollowUpAt) {
      return '初次联络';
    }
    return this.diffDays(latestFollowUpAt, endDate) > 30 ? '停滞观察' : '持续推进';
  }

  /**
   * 判定客户生命周期。
   */
  private resolveCustomerLifecycleStage(params: {
    hasOpportunity: boolean;
    historyDeal: boolean;
    createdAt: string;
    startDate: string;
    latestFollowUpAt: string | null;
    endDate: string;
  }): ManagementReportCustomerRecord['lifecycleStage'] {
    if (params.createdAt >= params.startDate && !params.hasOpportunity) {
      return '新客户';
    }
    if (params.historyDeal && params.hasOpportunity) {
      return '深耕池';
    }
    if (params.hasOpportunity) {
      return '激活池';
    }
    return this.resolveCustomerFollowUpStatus(
      params.hasOpportunity,
      params.latestFollowUpAt,
      params.endDate,
    ) === '停滞观察'
      ? '预警池'
      : '新客户';
  }

  /**
   * 判定合同是否已验收。
   */
  private resolveContractAccepted(statusLabel: string): boolean {
    return statusLabel.includes('已验收') || statusLabel.includes('成功结束');
  }

  /**
   * 按真实字段判定应收计划状态。
   */
  private resolvePaymentPlanStatus(
    rawStatus: number,
    receiveDate: string,
    amount: number,
    receivedAmount: number,
    endDate: string,
  ): ManagementReportPaymentPlanRecord['status'] {
    if (receivedAmount >= amount || rawStatus === 1) {
      return 'RECEIVED';
    }
    if (receiveDate < endDate) {
      return 'OVERDUE';
    }
    return 'PLANNED';
  }

  /**
   * 将生态分类收敛到当前专题允许的三种伙伴类型。
   */
  private normalizeEcosystemType(
    rawValue?: string,
  ): ManagementReportOpportunityRecord['ecosystemType'] {
    if (!rawValue?.trim()) {
      return undefined;
    }

    if (rawValue.includes('华为') || rawValue.includes('阿里') || rawValue.includes('其他生态项目')) {
      return '核心伙伴';
    }
    if (rawValue.includes('非生态项目')) {
      return '成长伙伴';
    }
    return '沉睡伙伴';
  }

  /**
   * 判断业务日期是否落在筛选期内。
   */
  private isBetween(value: string, startDate: string, endDate: string): boolean {
    return value >= startDate && value <= endDate;
  }

  /**
   * 日期加一天，供 datetime 右开区间使用。
   */
  private addOneDay(dateText: string): string {
    const currentDate = new Date(`${dateText}T00:00:00.000Z`);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    return currentDate.toISOString().slice(0, 10);
  }

  /**
   * 计算两个业务日期之间的天数差。
   */
  private diffDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
    return Math.floor((end - start) / (24 * 60 * 60 * 1000));
  }
}
