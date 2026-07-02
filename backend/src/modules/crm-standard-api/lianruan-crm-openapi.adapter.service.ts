import { Injectable } from '@nestjs/common';
import { LianruanCrmOpenApiClient } from './lianruan-crm-openapi.client';
import type {
  LianruanCrmOpenApiAuthMePayload,
  LianruanCrmOpenApiDictionaries,
  LianruanCrmOpenApiListQuery,
  LianruanCrmOpenApiPageResult,
  LianruanCrmOpenApiAnalyticsQuery,
  LianruanCrmOpenApiCustomerLifecycleAnalytics,
  LianruanCrmOpenApiCustomerRecord,
  LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics,
  LianruanCrmOpenApiFunnelAnalytics,
  LianruanCrmOpenApiOwnerContributionRecord,
  LianruanCrmOpenApiPartnerContributionRecord,
  LianruanCrmOpenApiPartnerProfileAnalytics,
  LianruanCrmOpenApiPermissionScope,
  LianruanCrmOpenApiRegionContributionRecord,
  LianruanCrmOpenApiResource,
  LianruanCrmOpenApiCatalogResource,
} from './lianruan-crm-openapi.types';

@Injectable()
export class LianruanCrmOpenApiAdapterService {
  constructor(
    private readonly lianruanCrmOpenApiClient: LianruanCrmOpenApiClient,
  ) {}

  /**
   * 判断联软标准 OpenAPI 适配层是否已具备最小配置。
   *
   * 参数说明：无。
   * 返回值说明：配置完整返回 `true`，否则返回 `false`。
   * 调用注意事项：用于旁路能力开关，不影响现有 MySQL 与 CRM 官方 API 主链。
   */
  isEnabled(): boolean {
    return this.lianruanCrmOpenApiClient.isEnabled();
  }

  /**
   * 读取当前 OpenAPI client 绑定的 CRM 用户上下文。
   *
   * 参数说明：无。
   * 返回值说明：返回 `/auth/me` 中的 client 与绑定用户信息。
   * 调用注意事项：该方法不读取字典和权限范围，适合作为企业微信第一阶段联调的轻量身份兜底。
   */
  async getCurrentContext(): Promise<LianruanCrmOpenApiAuthMePayload> {
    return this.lianruanCrmOpenApiClient.getCurrentContext();
  }

  /**
   * 拉取联调启动所需的最小上下文快照。
   *
   * 参数说明：无。
   * 返回值说明：同时返回当前身份、权限范围和字典数据。
   * 调用注意事项：适合在联调诊断、启动检查和后续上下文预热场景中复用。
   */
  async getBootstrapSnapshot(): Promise<{
    context: LianruanCrmOpenApiAuthMePayload;
    permissionScope: LianruanCrmOpenApiPermissionScope;
    dictionaries: LianruanCrmOpenApiDictionaries;
  }> {
    const [context, permissionScope, dictionaries] = await Promise.all([
      this.lianruanCrmOpenApiClient.getCurrentContext(),
      this.lianruanCrmOpenApiClient.getPermissionScope(),
      this.lianruanCrmOpenApiClient.getDictionaries(),
    ]);

    return {
      context,
      permissionScope,
      dictionaries,
    };
  }

  /**
   * 读取联软 CRM 角色权限矩阵。
   *
   * 参数说明：无。
   * 返回值说明：返回 `/meta/role-permissions` 的原始业务载荷。
   * 调用注意事项：用于数仓权限桥表建模和四类账号权限口径对齐，不在这里放宽任何查询权限。
   */
  async getRolePermissions(): Promise<Record<string, unknown>> {
    return this.lianruanCrmOpenApiClient.getRolePermissions();
  }

  /**
   * 读取标准资源分页列表。
   *
   * 参数说明：
   * - `resource`：标准资源名。
   * - `query`：列表查询参数。
   * 返回值说明：返回统一分页结构。
   * 调用注意事项：当前返回远端原始对象，后续再按我方语义层逐步收敛。
   */
  async listResource<T extends Record<string, unknown>>(
    resource: LianruanCrmOpenApiResource,
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<T>> {
    return this.lianruanCrmOpenApiClient.listResource<T>(resource, query);
  }

  /**
   * 读取产品目录分页列表。
   *
   * 参数说明：`resource` 为产品目录资源名，`query` 为分页筛选参数。
   * 返回值说明：返回统一分页结构。
   * 调用注意事项：只供 Markdown 快照刷新使用，正式问答阶段不实时访问 OpenAPI。
   */
  async listCatalogResource<T extends Record<string, unknown>>(
    resource: LianruanCrmOpenApiCatalogResource,
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<T>> {
    return this.lianruanCrmOpenApiClient.listCatalogResource<T>(resource, query);
  }

  /**
   * 读取标准资源详情。
   *
   * 参数说明：
   * - `resource`：标准资源名。
   * - `id`：对象主键。
   * 返回值说明：返回远端详情对象。
   * 调用注意事项：当前保持原始字段口径，避免在第一批改造中误伤现有功能。
   */
  async getResourceDetail<T extends Record<string, unknown>>(
    resource: LianruanCrmOpenApiResource,
    id: string,
  ): Promise<T> {
    return this.lianruanCrmOpenApiClient.getResourceDetail<T>(resource, id);
  }

  /**
   * 读取联软 OpenAPI 联调自检信息。
   *
   * 参数说明：无。
   * 返回值说明：返回当前 client、权限、字典和核心对象可见数量等诊断载荷。
   * 调用注意事项：只用于刷新 Markdown 快照和治理诊断，不参与正式问答实时取数。
   */
  async getDiagnosticsSelfCheck(): Promise<Record<string, unknown>> {
    return this.lianruanCrmOpenApiClient.getDiagnosticsSelfCheck();
  }

  /**
   * 读取联软 OpenAPI 经营总览统计。
   *
   * 参数说明：`query` 为时间、区域、渠道、负责人等筛选参数。
   * 返回值说明：返回经营总览统计载荷。
   * 调用注意事项：刷新链将其落入 Markdown，正式问答只读本地快照。
   */
  async getBusinessOverviewAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<Record<string, unknown>> {
    return this.lianruanCrmOpenApiClient.getBusinessOverviewAnalytics(query);
  }

  /**
   * 读取联软 OpenAPI 单对象摘要统计。
   *
   * 参数说明：`resource` 为统计对象，`query` 为筛选参数。
   * 返回值说明：返回该对象的摘要统计。
   * 调用注意事项：仅供快照刷新链使用，避免问答阶段实时请求 OpenAPI。
   */
  async getResourceSummaryAnalytics(
    resource: 'partners' | 'registrations' | 'opportunities' | 'quotes' | 'orders',
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<Record<string, unknown>> {
    return this.lianruanCrmOpenApiClient.getResourceSummaryAnalytics(resource, query);
  }

  /**
   * 读取渠道贡献统计排行。
   *
   * 参数说明：`query` 为统计筛选参数。
   * 返回值说明：返回联软标准统计接口聚合后的渠道贡献数据。
   * 调用注意事项：优先供智能分析渠道商贡献结果使用，避免分页拉全量后本地聚合。
   */
  async listPartnerContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiPartnerContributionRecord[]> {
    return this.lianruanCrmOpenApiClient.listPartnerContributions(query);
  }

  /**
   * 读取服务商画像统计。
   *
   * 参数说明：`query` 为统计筛选参数。
   * 返回值说明：返回联软标准统计接口聚合后的服务商画像数据。
   * 调用注意事项：该方法只做透传封装，兼容逻辑放在分析执行层。
   */
  async getPartnerProfileAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiPartnerProfileAnalytics> {
    return this.lianruanCrmOpenApiClient.getPartnerProfileAnalytics(query);
  }

  /**
   * 读取转化漏斗统计。
   *
   * 参数说明：`query` 为时间、区域等筛选参数。
   * 返回值说明：返回报备、商机、报价和订单漏斗指标。
   * 调用注意事项：当前优先使用联软最新简写路径。
   */
  async getFunnelAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiFunnelAnalytics> {
    return this.lianruanCrmOpenApiClient.getFunnelAnalytics(query);
  }

  /**
   * 读取客户生命周期统计。
   *
   * 参数说明：`query` 为统计筛选参数。
   * 返回值说明：返回客户生命周期、未报备、未建商机和沉睡客户汇总。
   * 调用注意事项：该方法只透传标准 OpenAPI，不做本地权限放宽。
   */
  async getCustomerLifecycleAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiCustomerLifecycleAnalytics> {
    return this.lianruanCrmOpenApiClient.getCustomerLifecycleAnalytics(query);
  }

  /**
   * 读取客户反关联统计。
   *
   * 参数说明：`query` 为统计筛选参数。
   * 返回值说明：返回未报备、未建商机、未报价、未下单客户统计。
   * 调用注意事项：优先供智能分析客户生命周期问数使用。
   */
  async getCustomerUnregisteredOpportunityAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics> {
    return this.lianruanCrmOpenApiClient.getCustomerUnregisteredOpportunityAnalytics(query);
  }

  /**
   * 读取沉睡客户分页列表。
   *
   * 参数说明：`query` 支持 `idleDays/pageNo/pageSize`。
   * 返回值说明：返回沉睡客户分页数据。
   */
  async listIdleCustomers(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiCustomerRecord>> {
    return this.lianruanCrmOpenApiClient.listIdleCustomers(query);
  }

  /**
   * 读取区域经营贡献统计。
   *
   * 参数说明：`query` 为统计筛选参数。
   * 返回值说明：返回区域或大区维度经营贡献数据。
   * 调用注意事项：权限裁剪由联软标准 OpenAPI 完成。
   */
  async listRegionContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiRegionContributionRecord[]> {
    return this.lianruanCrmOpenApiClient.listRegionContributions(query);
  }

  /**
   * 读取负责人经营贡献统计。
   *
   * 参数说明：`query` 为统计筛选参数。
   * 返回值说明：返回负责人维度经营贡献数据。
   * 调用注意事项：用于问数聚合优先路径，不绕过远端权限。
   */
  async listOwnerContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiOwnerContributionRecord[]> {
    return this.lianruanCrmOpenApiClient.listOwnerContributions(query);
  }
}
