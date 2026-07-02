import { Injectable } from '@nestjs/common';
import { LianruanCrmOpenApiAdapterService } from './lianruan-crm-openapi.adapter.service';
import type {
  LianruanCrmOpenApiListQuery,
  LianruanCrmOpenApiAnalyticsQuery,
  LianruanCrmOpenApiCustomerLifecycleAnalytics,
  LianruanCrmOpenApiCustomerRecord,
  LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics,
  LianruanCrmOpenApiFunnelAnalytics,
  LianruanCrmOpenApiOwnerContributionRecord,
  LianruanCrmOpenApiOrderRecord,
  LianruanCrmOpenApiPageResult,
  LianruanCrmOpenApiPartnerRecord,
  LianruanCrmOpenApiPartnerContributionRecord,
  LianruanCrmOpenApiPartnerProfileAnalytics,
  LianruanCrmOpenApiQuoteRecord,
  LianruanCrmOpenApiRegionContributionRecord,
  LianruanCrmOpenApiRegistrationRecord,
  LianruanCrmOpenApiResource,
  LianruanCrmOpenApiUserRecord,
  LianruanCrmOpenApiOpportunityRecord,
  LianruanCrmOpenApiCatalogResource,
} from './lianruan-crm-openapi.types';

@Injectable()
export class LianruanCrmQueryAdapterService {
  constructor(
    private readonly lianruanCrmOpenApiAdapterService: LianruanCrmOpenApiAdapterService,
  ) {}

  /**
   * 判断联软标准只读查询适配层是否已启用。
   *
   * 参数说明：无。
   * 返回值说明：已配置标准 OpenAPI 时返回 `true`。
   * 调用注意事项：仅用于旁路接入能力判断，不会触发远端请求。
   */
  isEnabled(): boolean {
    return this.lianruanCrmOpenApiAdapterService.isEnabled();
  }

  /**
   * 查询联软标准用户列表。
   *
   * 参数说明：`query` 为分页、关键字和状态等筛选参数。
   * 返回值说明：返回远端标准用户分页结果。
   * 调用注意事项：返回原始标准字段，暂不映射到本项目内部 `CrmUser` 模型。
   */
  async listUsers(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiUserRecord>> {
    return this.lianruanCrmOpenApiAdapterService.listResource<
      LianruanCrmOpenApiUserRecord
    >('users', query);
  }

  /**
   * 查询联软标准用户详情。
   *
   * 参数说明：`id` 为远端用户主键。
   * 返回值说明：返回用户详情对象。
   * 调用注意事项：主要供联调诊断、身份比对和后续权限映射使用。
   */
  async getUserDetail(id: string): Promise<LianruanCrmOpenApiUserRecord> {
    return this.lianruanCrmOpenApiAdapterService.getResourceDetail<
      LianruanCrmOpenApiUserRecord
    >('users', id);
  }

  /**
   * 查询联软标准客户主数据视图列表。
   *
   * 参数说明：`query` 为分页、关键字、区域、负责人和状态等筛选参数。
   * 返回值说明：返回客户主数据视图分页结果。
   * 调用注意事项：该视图由联软侧按当前 token 权限裁剪，我方不得把它当作可写客户表。
   */
  async listCustomers(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiCustomerRecord>> {
    return this.lianruanCrmOpenApiAdapterService.listResource<
      LianruanCrmOpenApiCustomerRecord
    >('customers', query);
  }

  /**
   * 查询联软标准客户详情。
   *
   * 参数说明：`id` 为客户稳定 ID。
   * 返回值说明：返回客户主数据视图详情。
   * 调用注意事项：详情仍是只读视图，不参与 CRM 写入。
   */
  async getCustomerDetail(id: string): Promise<LianruanCrmOpenApiCustomerRecord> {
    return this.lianruanCrmOpenApiAdapterService.getResourceDetail<
      LianruanCrmOpenApiCustomerRecord
    >('customers', id);
  }

  /**
   * 查询联软标准渠道列表。
   *
   * 参数说明：`query` 为分页、关键字和组织筛选参数。
   * 返回值说明：返回渠道分页结果。
   * 调用注意事项：当前把渠道视为外部组织对象，为后续组织语义映射预留入口。
   */
  async listPartners(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiPartnerRecord>> {
    return this.lianruanCrmOpenApiAdapterService.listResource<
      LianruanCrmOpenApiPartnerRecord
    >('partners', query);
  }

  /**
   * 查询联软标准渠道详情。
   *
   * 参数说明：`id` 为渠道主键。
   * 返回值说明：返回渠道详情对象。
   * 调用注意事项：详情中的层级和父级字段可用于联调时验证渠道树口径。
   */
  async getPartnerDetail(id: string): Promise<LianruanCrmOpenApiPartnerRecord> {
    return this.lianruanCrmOpenApiAdapterService.getResourceDetail<
      LianruanCrmOpenApiPartnerRecord
    >('partners', id);
  }

  /**
   * 查询联软标准客户报备列表。
   *
   * 参数说明：`query` 为分页、关键字、状态和渠道筛选参数。
   * 返回值说明：返回报备分页结果。
   * 调用注意事项：当前把 `registrations` 视为客户主入口，不直接等同于稳定客户主数据。
   */
  async listRegistrations(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiRegistrationRecord>> {
    return this.lianruanCrmOpenApiAdapterService.listResource<
      LianruanCrmOpenApiRegistrationRecord
    >('registrations', query);
  }

  /**
   * 查询联软标准客户报备详情。
   *
   * 参数说明：`id` 为报备主键。
   * 返回值说明：返回报备详情对象。
   * 调用注意事项：后续问数主题映射会优先复用该对象的客户、渠道与负责人字段。
   */
  async getRegistrationDetail(
    id: string,
  ): Promise<LianruanCrmOpenApiRegistrationRecord> {
    return this.lianruanCrmOpenApiAdapterService.getResourceDetail<
      LianruanCrmOpenApiRegistrationRecord
    >('registrations', id);
  }

  /**
   * 查询联软标准商机列表。
   *
   * 参数说明：`query` 为分页、关键字、状态和渠道筛选参数。
   * 返回值说明：返回商机分页结果。
   * 调用注意事项：远端列表中的 `status` 实际对应商机 `stage` 过滤，调用时应按阶段理解。
   */
  async listOpportunities(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiOpportunityRecord>> {
    return this.lianruanCrmOpenApiAdapterService.listResource<
      LianruanCrmOpenApiOpportunityRecord
    >('opportunities', query);
  }

  /**
   * 查询联软标准商机详情。
   *
   * 参数说明：`id` 为商机主键。
   * 返回值说明：返回商机详情对象。
   * 调用注意事项：详情字段后续会逐步接到我方只读主题问数和对象详情能力。
   */
  async getOpportunityDetail(
    id: string,
  ): Promise<LianruanCrmOpenApiOpportunityRecord> {
    return this.lianruanCrmOpenApiAdapterService.getResourceDetail<
      LianruanCrmOpenApiOpportunityRecord
    >('opportunities', id);
  }

  /**
   * 查询联软标准报价列表。
   *
   * 参数说明：`query` 为分页、关键字和状态等筛选参数。
   * 返回值说明：返回报价分页结果。
   * 调用注意事项：报价对象当前已被对方归一化 `customer`、`customerName` 和 `updatedAt` 字段。
   */
  async listQuotes(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiQuoteRecord>> {
    return this.lianruanCrmOpenApiAdapterService.listResource<
      LianruanCrmOpenApiQuoteRecord
    >('quotes', query);
  }

  /**
   * 查询联软标准报价详情。
   *
   * 参数说明：`id` 为报价主键。
   * 返回值说明：返回报价详情对象。
   * 调用注意事项：报价详情主要用于联调验证和后续成交链路分析。
   */
  async getQuoteDetail(id: string): Promise<LianruanCrmOpenApiQuoteRecord> {
    return this.lianruanCrmOpenApiAdapterService.getResourceDetail<
      LianruanCrmOpenApiQuoteRecord
    >('quotes', id);
  }

  /**
   * 查询联软标准订单列表。
   *
   * 参数说明：`query` 为分页、关键字和状态等筛选参数。
   * 返回值说明：返回订单分页结果。
   * 调用注意事项：订单对象已归一化 `customer`、`customerName`、`updatedAt` 与渠道归属字段。
   */
  async listOrders(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiOrderRecord>> {
    return this.lianruanCrmOpenApiAdapterService.listResource<
      LianruanCrmOpenApiOrderRecord
    >('orders', query);
  }

  /**
   * 查询联软标准订单详情。
   *
   * 参数说明：`id` 为订单主键。
   * 返回值说明：返回订单详情对象。
   * 调用注意事项：后续若接成交类分析、订单详情问答，可在此基础上继续扩展。
   */
  async getOrderDetail(id: string): Promise<LianruanCrmOpenApiOrderRecord> {
    return this.lianruanCrmOpenApiAdapterService.getResourceDetail<
      LianruanCrmOpenApiOrderRecord
    >('orders', id);
  }

  /**
   * 读取联软 OpenAPI 自检信息。
   *
   * 参数说明：无。
   * 返回值说明：返回当前 client、权限范围、字典数量和对象可见数量等诊断载荷。
   * 调用注意事项：只在 Markdown 快照刷新链使用，不参与正式问答阶段取数。
   */
  async getDiagnosticsSelfCheck(): Promise<Record<string, unknown>> {
    return this.lianruanCrmOpenApiAdapterService.getDiagnosticsSelfCheck();
  }

  /**
   * 查询联软标准经营总览统计。
   *
   * 参数说明：`query` 为时间、区域、渠道和负责人等统计筛选参数。
   * 返回值说明：返回经营总览统计载荷。
   * 调用注意事项：统计结果写入 Markdown 快照，用于 AI 解释口径和交叉校验。
   */
  async getBusinessOverviewAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<Record<string, unknown>> {
    return this.lianruanCrmOpenApiAdapterService.getBusinessOverviewAnalytics(query);
  }

  /**
   * 查询联软标准单对象摘要统计。
   *
   * 参数说明：`resource` 为统计对象，`query` 为筛选参数。
   * 返回值说明：返回对象摘要统计。
   * 调用注意事项：只服务快照生成；正式分析继续读取本地 Markdown 明细。
   */
  async getResourceSummaryAnalytics(
    resource: 'partners' | 'registrations' | 'opportunities' | 'quotes' | 'orders',
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<Record<string, unknown>> {
    return this.lianruanCrmOpenApiAdapterService.getResourceSummaryAnalytics(resource, query);
  }

  /**
   * 查询联软产品目录分页列表。
   *
   * 参数说明：`resource` 为产品目录资源，`query` 为分页和筛选参数。
   * 返回值说明：返回产品、套餐、模块、功能或硬件等目录数据。
   * 调用注意事项：该入口仅用于 OpenAPI Markdown 快照刷新，不参与正式问答实时取数。
   */
  async listCatalogResource(
    resource: LianruanCrmOpenApiCatalogResource,
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<Record<string, unknown>>> {
    return this.lianruanCrmOpenApiAdapterService.listCatalogResource<
      Record<string, unknown>
    >(resource, query);
  }

  /**
   * 查询联软标准渠道贡献统计。
   *
   * 参数说明：`query` 为时间、区域、渠道、负责人等统计筛选参数。
   * 返回值说明：返回已由联软侧按当前 token 权限裁剪并聚合后的渠道贡献行。
   * 调用注意事项：用于智能分析渠道商贡献视角，优先于分页拉取商机后本地聚合。
   */
  async listPartnerContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiPartnerContributionRecord[]> {
    return this.lianruanCrmOpenApiAdapterService.listPartnerContributions(query);
  }

  /**
   * 查询联软标准服务商画像统计。
   *
   * 参数说明：`query` 为时间、区域、大区、技术服务商等筛选参数。
   * 返回值说明：返回服务商总数、有效数、技术服务商数量和维度分布。
   * 调用注意事项：优先用于智能分析画像问数；接口不可用时由分析层回退列表聚合。
   */
  async getPartnerProfileAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiPartnerProfileAnalytics> {
    return this.lianruanCrmOpenApiAdapterService.getPartnerProfileAnalytics(query);
  }

  /**
   * 查询联软标准转化漏斗统计。
   *
   * 参数说明：`query` 为时间和区域等筛选参数。
   * 返回值说明：返回报备、商机、报价、订单数量和转化率。
   * 调用注意事项：只读统计接口仍受当前 OpenAPI token 权限约束。
   */
  async getFunnelAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiFunnelAnalytics> {
    return this.lianruanCrmOpenApiAdapterService.getFunnelAnalytics(query);
  }

  /**
   * 查询联软标准客户生命周期统计。
   *
   * 参数说明：`query` 为时间、区域、负责人等筛选参数。
   * 返回值说明：返回客户总数、沉睡客户、未报备/未建商机等统计。
   */
  async getCustomerLifecycleAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiCustomerLifecycleAnalytics> {
    return this.lianruanCrmOpenApiAdapterService.getCustomerLifecycleAnalytics(query);
  }

  /**
   * 查询联软标准客户反关联统计。
   *
   * 参数说明：`query` 为时间、区域、负责人等筛选参数。
   * 返回值说明：返回未报备、未建商机、未报价、未下单客户统计。
   */
  async getCustomerUnregisteredOpportunityAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics> {
    return this.lianruanCrmOpenApiAdapterService.getCustomerUnregisteredOpportunityAnalytics(query);
  }

  /**
   * 查询联软标准沉睡客户分页列表。
   *
   * 参数说明：`query` 支持 `idleDays/pageNo/pageSize` 等筛选。
   * 返回值说明：返回沉睡客户分页结果。
   */
  async listIdleCustomers(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiCustomerRecord>> {
    return this.lianruanCrmOpenApiAdapterService.listIdleCustomers(query);
  }

  /**
   * 查询联软标准区域经营贡献统计。
   *
   * 参数说明：`query` 为统计筛选参数。
   * 返回值说明：返回区域或大区维度贡献行。
   * 调用注意事项：适合经营看板、企微报告和区域贡献问数复用。
   */
  async listRegionContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiRegionContributionRecord[]> {
    return this.lianruanCrmOpenApiAdapterService.listRegionContributions(query);
  }

  /**
   * 查询联软标准负责人经营贡献统计。
   *
   * 参数说明：`query` 为统计筛选参数。
   * 返回值说明：返回负责人维度贡献行。
   * 调用注意事项：后续负责人排行优先使用该接口，减少分页拉取。
   */
  async listOwnerContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiOwnerContributionRecord[]> {
    return this.lianruanCrmOpenApiAdapterService.listOwnerContributions(query);
  }

  /**
   * 按资源名统一分发列表查询。
   *
   * 参数说明：
   * - `resource`：联软标准资源名。
   * - `query`：分页与筛选参数。
   * 返回值说明：返回对应资源的分页结果。
   * 调用注意事项：主要供内部联调诊断入口复用，避免控制器层写大段分支。
   */
  async listByResource(
    resource: LianruanCrmOpenApiResource,
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<Record<string, unknown>>> {
    switch (resource) {
      case 'users':
        return this.listUsers(query);
      case 'customers':
        return this.listCustomers(query);
      case 'partners':
        return this.listPartners(query);
      case 'registrations':
        return this.listRegistrations(query);
      case 'opportunities':
        return this.listOpportunities(query);
      case 'quotes':
        return this.listQuotes(query);
      case 'orders':
        return this.listOrders(query);
    }
  }

  /**
   * 按资源名统一分发详情查询。
   *
   * 参数说明：
   * - `resource`：联软标准资源名。
   * - `id`：对象主键。
   * 返回值说明：返回对应资源详情。
   * 调用注意事项：主要供内部联调诊断入口复用，避免控制器层重复写判断逻辑。
   */
  async getDetailByResource(
    resource: LianruanCrmOpenApiResource,
    id: string,
  ): Promise<Record<string, unknown>> {
    switch (resource) {
      case 'users':
        return this.getUserDetail(id);
      case 'customers':
        return this.getCustomerDetail(id);
      case 'partners':
        return this.getPartnerDetail(id);
      case 'registrations':
        return this.getRegistrationDetail(id);
      case 'opportunities':
        return this.getOpportunityDetail(id);
      case 'quotes':
        return this.getQuoteDetail(id);
      case 'orders':
        return this.getOrderDetail(id);
    }
  }
}
