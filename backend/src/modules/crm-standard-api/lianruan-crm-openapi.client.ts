import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { LianruanCrmConnectionConfigService } from '../governance/lianruan-crm-connection-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type {
  LianruanCrmOpenApiAuthMePayload,
  LianruanCrmOpenApiDictionaries,
  LianruanCrmOpenApiPageResult,
  LianruanCrmOpenApiPagedResponse,
  LianruanCrmOpenApiPermissionScope,
  LianruanCrmOpenApiResource,
  LianruanCrmOpenApiResponse,
  LianruanCrmOpenApiTokenPayload,
  LianruanCrmOpenApiListQuery,
  LianruanCrmOpenApiAnalyticsQuery,
  LianruanCrmOpenApiCustomerLifecycleAnalytics,
  LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics,
  LianruanCrmOpenApiFunnelAnalytics,
  LianruanCrmOpenApiOwnerContributionRecord,
  LianruanCrmOpenApiPartnerProfileAnalytics,
  LianruanCrmOpenApiPartnerContributionRecord,
  LianruanCrmOpenApiRegionContributionRecord,
  LianruanCrmOpenApiResourceSummary,
  LianruanCrmOpenApiCustomerRecord,
  LianruanCrmOpenApiCatalogResource,
  LianruanCrmOpenApiOperationResource,
  LianruanCrmOpenApiWorkloadResource,
} from './lianruan-crm-openapi.types';

interface RequestOptions {
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}

@Injectable()
export class LianruanCrmOpenApiClient {
  private accessTokenCache?: {
    token: string;
    expiresAt: number;
  };
  private tokenRefreshPromise?: Promise<string>;

  constructor(
    private readonly lianruanCrmConnectionConfigService: LianruanCrmConnectionConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  /**
   * 判断联软标准 OpenAPI 是否已具备最小可用配置。
   *
   * 参数说明：无。
   * 返回值说明：配置完整返回 `true`，否则返回 `false`。
   * 调用注意事项：只用于能力开关判断，不会发起网络请求。
   */
  isEnabled(): boolean {
    return this.lianruanCrmConnectionConfigService.getEffectiveRuntimeConfig().enabled;
  }

  /**
   * 读取当前绑定的 OpenAPI client 和 CRM 用户上下文。
   *
   * 参数说明：无。
   * 返回值说明：返回 `auth/me` 的 `data` 载荷。
   * 调用注意事项：要求标准 OpenAPI 已配置且远端接口可达。
   */
  async getCurrentContext(): Promise<LianruanCrmOpenApiAuthMePayload> {
    return this.requestData<LianruanCrmOpenApiAuthMePayload>('GET', '/auth/me', {
      auth: true,
    });
  }

  /**
   * 读取当前绑定用户的权限范围。
   *
   * 参数说明：无。
   * 返回值说明：返回当前账号的区域、渠道和用户范围信息。
   * 调用注意事项：用于第一阶段前置权限提示与治理验证，不直接替代现有数据范围模型。
   */
  async getPermissionScope(): Promise<LianruanCrmOpenApiPermissionScope> {
    return this.requestData<LianruanCrmOpenApiPermissionScope>(
      'GET',
      '/meta/permission-scope',
      { auth: true },
    );
  }

  /**
   * 读取联软 CRM 角色权限矩阵。
   *
   * 参数说明：无。
   * 返回值说明：返回当前 OpenAPI 暴露的角色权限矩阵原始载荷。
   * 调用注意事项：该数据用于我方构建权限桥表和角色口径说明，不直接替代运行时权限注入。
   */
  async getRolePermissions(): Promise<Record<string, unknown>> {
    return this.requestData<Record<string, unknown>>(
      'GET',
      '/meta/role-permissions',
      { auth: true },
    );
  }

  /**
   * 读取远端暴露的角色、状态和渠道层级字典。
   *
   * 参数说明：无。
   * 返回值说明：返回标准字典对象，供展示翻译和问数口径适配使用。
   * 调用注意事项：若远端字典暂未补齐全部枚举，调用方需按阶段降级处理。
   */
  async getDictionaries(): Promise<LianruanCrmOpenApiDictionaries> {
    return this.requestData<LianruanCrmOpenApiDictionaries>(
      'GET',
      '/meta/dictionaries',
      { auth: true },
    );
  }

  /**
   * 按资源名读取标准分页列表。
   *
   * 参数说明：
   * - `resource`：标准资源名。
   * - `query`：列表分页、关键字和状态等筛选参数。
   * 返回值说明：返回统一分页结构，便于后续在问数和治理入口复用。
   * 调用注意事项：查询仍受对方 CRM 权限边界限制，传入的筛选条件不会突破远端权限收口。
   */
  async listResource<T extends Record<string, unknown>>(
    resource: LianruanCrmOpenApiResource,
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<T>> {
    return this.listPagedPath<T>(`/${resource}`, query, '列表请求');
  }

  /**
   * 按产品目录资源名读取标准分页列表。
   *
   * 参数说明：
   * - `resource`：产品目录资源名，例如 `products/packages/modules`。
   * - `query`：分页、关键字和状态等筛选参数。
   * 返回值说明：返回统一分页结构。
   * 调用注意事项：只供 Markdown 快照刷新使用，不纳入正式业务资源枚举，避免影响既有模块。
   */
  async listCatalogResource<T extends Record<string, unknown>>(
    resource: LianruanCrmOpenApiCatalogResource,
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<T>> {
    return this.listPagedPath<T>(`/${resource}`, query, '产品目录请求');
  }

  /**
   * 拉取联软 OpenAPI 2026-06-24 扩展开放的运营与提醒资源列表。
   *
   * 参数说明：
   * - `resource`：运营资源名（notifications/pending-approvals/channel-targets/channel-visits）。
   * - `query`：分页、关键字和状态等筛选参数。
   * 返回值说明：返回统一分页结构。
   * 调用注意事项：channel-operations-overview/dashboard-stats 为单数聚合端点，
   * 不进入列表主链，需通过专用方法拉取。来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节。
   */
  async listOperationResource<T extends Record<string, unknown>>(
    resource: LianruanCrmOpenApiOperationResource,
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<T>> {
    return this.listPagedPath<T>(`/${resource}`, query, '运营资源请求');
  }

  /**
   * 拉取联软 OpenAPI 2026-06-24 扩展开放的计算与实施配置资源列表。
   *
   * 参数说明：
   * - `resource`：工作量资源名（workload-classifications/workload-delivery-rules/workload-mappings/workload-rules）。
   * - `query`：分页、关键字等筛选参数。
   * 返回值说明：返回统一分页结构。
   * 调用注意事项：报价工作量预览和 IPG 参考价预览为 POST 计算，需通过专用方法调用。
   */
  async listWorkloadResource<T extends Record<string, unknown>>(
    resource: LianruanCrmOpenApiWorkloadResource,
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<T>> {
    return this.listPagedPath<T>(`/${resource}`, query, '工作量配置请求');
  }

  /**
   * 拉取产品目录树。
   *
   * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节 `GET /product-tree`。
   * 返回值说明：返回产品大类→模块→功能产品的树形结构。
   */
  async getProductTree(): Promise<Record<string, unknown>> {
    return this.requestData<Record<string, unknown>>(
      'GET',
      '/product-tree',
      { auth: true },
    );
  }

  /**
   * 拉取产品统计。
   *
   * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节 `GET /product-stats`。
   * 返回值说明：返回按产品维度的统计汇总。
   */
  async getProductStats(query: LianruanCrmOpenApiListQuery = {}): Promise<Record<string, unknown>> {
    return this.requestData<Record<string, unknown>>(
      'GET',
      '/product-stats',
      { auth: true, query },
    );
  }

  /**
   * 拉取渠道运营总览。
   *
   * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节 `GET /channel-operations-overview`。
   * 返回值说明：返回当前权限范围内的渠道运营汇总（目标达成、拜访频次、活跃度等）。
   */
  async getChannelOperationsOverview(query: LianruanCrmOpenApiListQuery = {}): Promise<Record<string, unknown>> {
    return this.requestData<Record<string, unknown>>(
      'GET',
      '/channel-operations-overview',
      { auth: true, query },
    );
  }

  /**
   * 拉取首页统计。
   *
   * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节 `GET /dashboard-stats`。
   * 返回值说明：返回当前权限范围内的首页统计卡片数据。
   */
  async getDashboardStats(): Promise<Record<string, unknown>> {
    return this.requestData<Record<string, unknown>>(
      'GET',
      '/dashboard-stats',
      { auth: true },
    );
  }

  /**
   * 企业搜索。
   *
   * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节 `GET /company-search?keyword=客户名称`。
   * 参数说明：`keyword` 为客户名称关键词。
   * 返回值说明：返回匹配的企业列表。
   */
  async companySearch(keyword: string): Promise<LianruanCrmOpenApiPageResult<Record<string, unknown>>> {
    return this.listPagedPath<Record<string, unknown>>(
      '/company-search',
      { keyword, pageNo: 1, pageSize: 20 },
      '企业搜索请求',
    );
  }

  /**
   * 拉取操作审计日志。
   *
   * 来源：《联软 CRM 对接 AI-agent 标准 API 契约》第 5 节 `audit-logs` 资源。
   * 参数说明：`query` 为分页和筛选参数。
   * 返回值说明：返回审计日志分页列表。仅超级管理员可见。
   */
  async listAuditLogs(query: LianruanCrmOpenApiListQuery = {}): Promise<LianruanCrmOpenApiPageResult<Record<string, unknown>>> {
    return this.listPagedPath<Record<string, unknown>>(
      '/audit-logs',
      query,
      '审计日志请求',
    );
  }

  /**
   * 按路径读取分页列表。
   *
   * 参数说明：`path` 为 OpenAPI 相对路径，`query` 为分页筛选参数，`label` 为错误提示名称。
   * 返回值说明：返回统一分页结构。
   * 调用注意事项：集中处理 `returnedCount/requestId`，保证快照质量报告有稳定依据。
   */
  private async listPagedPath<T extends Record<string, unknown>>(
    path: string,
    query: LianruanCrmOpenApiListQuery,
    label: string,
  ): Promise<LianruanCrmOpenApiPageResult<T>> {
    const response = await this.requestJson<LianruanCrmOpenApiPagedResponse<T>>(
      'GET',
      path,
      {
        auth: true,
        query,
      },
    );

    if (response.code !== 0) {
      throw new Error(
        `联软标准 OpenAPI ${label}失败：${response.message}（code=${response.code}）`,
      );
    }

    return {
      items: Array.isArray(response.data) ? response.data : [],
      pageNo: Number(response.pageNo ?? query.pageNo ?? 1),
      pageSize: Number(response.pageSize ?? query.pageSize ?? 20),
      total: Number(response.total ?? 0),
      returnedCount: Number(
        response.returnedCount ??
          (Array.isArray(response.data) ? response.data.length : 0),
      ),
      requestId: response.requestId,
    };
  }

  /**
   * 读取联软 OpenAPI 自检信息。
   *
   * 参数说明：无。
   * 返回值说明：返回当前 client、绑定用户、权限范围、字典数量和对象可见数量等诊断结果。
   * 调用注意事项：该接口只在快照刷新链使用，用于生成数据质量报告；正式问答阶段不实时调用。
   */
  async getDiagnosticsSelfCheck(): Promise<Record<string, unknown>> {
    return this.requestData<Record<string, unknown>>(
      'GET',
      '/diagnostics/self-check',
      { auth: true },
    );
  }

  /**
   * 读取联软 OpenAPI 经营总览统计。
   *
   * 参数说明：`query` 为时间、区域、渠道、负责人等只读筛选参数。
   * 返回值说明：返回当前 token 权限范围内的经营总览统计载荷。
   * 调用注意事项：统计只写入 Markdown 快照，不在正式问答阶段临时请求。
   */
  async getBusinessOverviewAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<Record<string, unknown>> {
    return this.requestData<Record<string, unknown>>(
      'GET',
      '/analytics/business-overview',
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 读取单对象摘要统计。
   *
   * 参数说明：
   * - `resource`：仅允许联软统计接口支持的业务对象。
   * - `query`：时间、区域、渠道、负责人等筛选参数。
   * 返回值说明：返回单对象数量、金额、状态分布等摘要统计。
   * 调用注意事项：调用方需把结果写入快照，不能在问答阶段用它替代本地明细。
   */
  async getResourceSummaryAnalytics(
    resource: 'partners' | 'registrations' | 'opportunities' | 'quotes' | 'orders',
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiResourceSummary> {
    return this.requestData<LianruanCrmOpenApiResourceSummary>(
      'GET',
      `/analytics/${resource}/summary`,
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 按资源名读取单条详情。
   *
   * 参数说明：
   * - `resource`：标准资源名。
   * - `id`：远端业务对象主键。
   * 返回值说明：返回远端详情原始对象。
   * 调用注意事项：`id` 为空会直接抛错，避免无意义请求进入远端系统。
   */
  async getResourceDetail<T extends Record<string, unknown>>(
    resource: LianruanCrmOpenApiResource,
    id: string,
  ): Promise<T> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('标准 OpenAPI 详情查询缺少对象 ID。');
    }

    return this.requestData<T>('GET', `/${resource}/${encodeURIComponent(normalizedId)}`, {
      auth: true,
    });
  }

  /**
   * 读取渠道贡献统计排行。
   *
   * 参数说明：`query` 为时间、区域、渠道、负责人等统计筛选参数。
   * 返回值说明：返回当前 token 权限范围内的渠道贡献行，包含报备、商机、报价和订单指标。
   * 调用注意事项：该接口由联软 CRM 侧完成权限裁剪与聚合，适合替代分页拉全量后的本地聚合。
   */
  async listPartnerContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiPartnerContributionRecord[]> {
    return this.requestData<LianruanCrmOpenApiPartnerContributionRecord[]>(
      'GET',
      '/analytics/partners/contribution',
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 读取服务商画像统计。
   *
   * 参数说明：`query` 为时间、区域、大区、技术服务商等统计筛选参数。
   * 返回值说明：返回当前 token 权限范围内的服务商总数、有效数和维度分布。
   * 调用注意事项：该接口优先供“服务商数量/等级/技术服务商维度”问数使用，失败时调用方可回退列表聚合。
   */
  async getPartnerProfileAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiPartnerProfileAnalytics> {
    return this.requestData<LianruanCrmOpenApiPartnerProfileAnalytics>(
      'GET',
      '/analytics/partners/profile',
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 读取报备到订单的转化漏斗统计。
   *
   * 参数说明：`query` 为时间、区域、大区等统计筛选参数。
   * 返回值说明：返回报备、商机、报价和订单的数量及可选转化率。
   * 调用注意事项：优先调用联软最新契约路径，便于与自测材料保持一致。
   */
  async getFunnelAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiFunnelAnalytics> {
    return this.requestData<LianruanCrmOpenApiFunnelAnalytics>(
      'GET',
      '/analytics/funnel/registration-opportunity-order',
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 读取客户生命周期统计。
   *
   * 参数说明：`query` 为时间、区域、负责人等筛选参数。
   * 返回值说明：返回客户总数、沉睡客户、未报备/未建商机等生命周期指标。
   * 调用注意事项：该接口由联软侧按当前 token 权限裁剪，我方只做展示和报告编排。
   */
  async getCustomerLifecycleAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiCustomerLifecycleAnalytics> {
    return this.requestData<LianruanCrmOpenApiCustomerLifecycleAnalytics>(
      'GET',
      '/analytics/customers/lifecycle',
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 读取客户反关联统计。
   *
   * 参数说明：`query` 为时间、区域、负责人等筛选参数。
   * 返回值说明：返回未报备、未建商机、未报价、未下单客户统计和样例。
   * 调用注意事项：用于“没有报备商机的客户”等问数，避免我方从已发生记录反推全量客户。
   */
  async getCustomerUnregisteredOpportunityAnalytics(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics> {
    return this.requestData<LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics>(
      'GET',
      '/analytics/customers/unregistered-opportunity',
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 读取沉睡客户分页列表。
   *
   * 参数说明：`query` 支持 `idleDays/pageNo/pageSize` 等筛选。
   * 返回值说明：返回沉睡客户分页结果。
   * 调用注意事项：只用于客户生命周期排查，不读取敏感联系方式。
   */
  async listIdleCustomers(
    query: LianruanCrmOpenApiListQuery = {},
  ): Promise<LianruanCrmOpenApiPageResult<LianruanCrmOpenApiCustomerRecord>> {
    const response = await this.requestJson<
      LianruanCrmOpenApiPagedResponse<LianruanCrmOpenApiCustomerRecord>
    >('GET', '/analytics/customers/idle', {
      auth: true,
      query,
    });

    if (response.code !== 0) {
      throw new Error(
        `联软标准 OpenAPI 沉睡客户请求失败：${response.message}（code=${response.code}）`,
      );
    }

    return {
      items: Array.isArray(response.data) ? response.data : [],
      pageNo: Number(response.pageNo ?? query.pageNo ?? 1),
      pageSize: Number(response.pageSize ?? query.pageSize ?? 20),
      total: Number(response.total ?? 0),
      returnedCount: Number(
        response.returnedCount ??
          (Array.isArray(response.data) ? response.data.length : 0),
      ),
      requestId: response.requestId,
    };
  }

  /**
   * 读取区域或大区经营贡献统计。
   *
   * 参数说明：`query` 为统计筛选参数，可传 `groupBy=bigRegion` 聚合到大区。
   * 返回值说明：返回区域维度的报备、商机、报价和订单指标。
   * 调用注意事项：该接口由联软侧完成权限裁剪，调用方不得再用本地权限放宽结果。
   */
  async listRegionContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiRegionContributionRecord[]> {
    return this.requestData<LianruanCrmOpenApiRegionContributionRecord[]>(
      'GET',
      '/analytics/regions/contribution',
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 读取负责人经营贡献统计。
   *
   * 参数说明：`query` 为时间、区域、渠道等统计筛选参数。
   * 返回值说明：返回负责人维度的报备、商机、报价和订单指标。
   * 调用注意事项：用于后续负责人经营贡献问数，避免分页拉全量后本地聚合。
   */
  async listOwnerContributions(
    query: LianruanCrmOpenApiAnalyticsQuery = {},
  ): Promise<LianruanCrmOpenApiOwnerContributionRecord[]> {
    return this.requestData<LianruanCrmOpenApiOwnerContributionRecord[]>(
      'GET',
      '/analytics/owners/contribution',
      {
        auth: true,
        query,
      },
    );
  }

  /**
   * 获取当前 client 的 Bearer token，并在有效期内复用缓存。
   *
   * 参数说明：无。
   * 返回值说明：返回远端签发的访问令牌。
   * 调用注意事项：该方法会自动预留缓冲秒数，避免快过期 token 被并发请求复用。
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > now) {
      return this.accessTokenCache.token;
    }

    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.refreshAccessToken().finally(() => {
      this.tokenRefreshPromise = undefined;
    });
    return this.tokenRefreshPromise;
  }

  /**
   * 清理当前缓存的联软 OpenAPI access token。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 调用注意事项：治理页修改 Base URL、App Key 或 Secret 后必须调用，避免旧 token 继续命中。
   */
  clearAccessTokenCache(): void {
    this.accessTokenCache = undefined;
    this.tokenRefreshPromise = undefined;
  }

  /**
   * 强制刷新访问令牌。
   *
   * 参数说明：无。
   * 返回值说明：返回新签发的访问令牌。
   * 调用注意事项：仅在首次取 token 或远端返回 token 失效时使用。
   */
  private async refreshAccessToken(): Promise<string> {
    const runtimeConfig = this.ensureEnabled();
    const response = await this.requestData<LianruanCrmOpenApiTokenPayload>(
      'POST',
      '/auth/token',
      {
        body: {
          appKey: runtimeConfig.appKey,
          appSecret: runtimeConfig.appSecret,
        },
        auth: false,
      },
    );

    const expiresAt =
      Date.now() +
      Math.max(
        (Number(response.expiresIn ?? 0) - runtimeConfig.tokenCacheBufferSeconds) * 1000,
        1000,
      );
    this.accessTokenCache = {
      token: response.accessToken,
      expiresAt,
    };

    this.analysisLoggerService.logStep('联软标准 OpenAPI access token 已刷新。', {
      clientId: response.clientId,
      clientName: response.clientName,
      boundUserId: response.boundUser.id,
      expiresInSeconds: response.expiresIn,
    });

    return response.accessToken;
  }

  /**
   * 发起标准 OpenAPI 请求并返回业务层 `data` 载荷。
   *
   * 参数说明：
   * - `method`：HTTP 方法。
   * - `path`：相对 API 路径。
   * - `options`：请求头、查询、超时和请求体等附加参数。
   * 返回值说明：返回成功响应中的 `data` 字段。
   * 调用注意事项：远端返回非零业务码时会直接抛错，由调用方统一处理。
   */
  private async requestData<T>(
    method: 'GET' | 'POST',
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const response = await this.requestJson<LianruanCrmOpenApiResponse<T>>(
      method,
      path,
      options,
    );

    if (response.code !== 0) {
      if (response.code === 40101 || response.code === 40102) {
        throw new UnauthorizedException(response.message);
      }
      throw new Error(
        `联软标准 OpenAPI 请求失败：${response.message}（code=${response.code}）`,
      );
    }

    if (!('data' in response)) {
      throw new Error('联软标准 OpenAPI 成功响应缺少 data 载荷。');
    }

    return response.data;
  }

  /**
   * 发起 HTTP 请求并解析 JSON。
   *
   * 参数说明：
   * - `method`：HTTP 方法。
   * - `path`：相对 API 路径。
   * - `options`：认证、查询、请求体和超时参数。
   * 返回值说明：返回已解析的 JSON 对象。
   * 调用注意事项：该方法只负责 HTTP 与 JSON 解析，不校验业务码。
   */
  private async requestJson<T>(
    method: 'GET' | 'POST',
    path: string,
    options: RequestOptions,
  ): Promise<T> {
    const runtimeConfig = this.ensureEnabled();
    const url = this.buildRequestUrl(runtimeConfig.baseUrl!, path, options.query);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? runtimeConfig.timeoutMs,
    );

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (options.body) {
        headers['Content-Type'] = 'application/json';
      }

      if (options.auth !== false) {
        const accessToken = await this.getAccessToken();
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const payload = await this.parseJsonResponse<T>(response, method, path);

      this.analysisLoggerService.logStep('联软标准 OpenAPI 请求完成。', {
        method,
        path,
        requestUrl: url,
        httpStatus: response.status,
        ok: response.ok,
      });

      return payload;
    } catch (error) {
      this.analysisLoggerService.logWarn('联软标准 OpenAPI 请求失败。', {
        method,
        path,
        requestUrl: url,
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 解析标准 OpenAPI JSON 响应。
   *
   * 参数说明：`response` 为远端 HTTP 响应，`method/path` 用于日志定位。
   * 返回值说明：返回已解析的 JSON 对象。
   * 调用注意事项：当远端误返回 HTML 登录页或文本错误页时，统一抛出中文业务错误，
   * 避免企微回复中出现 `Unexpected token '<'` 这类底层解析异常。
   */
  private async parseJsonResponse<T>(
    response: Response,
    method: 'GET' | 'POST',
    path: string,
  ): Promise<T> {
    const contentType = response.headers?.get?.('content-type') ?? '';
    if (typeof response.text === 'function') {
      const rawBody = await response.text();
      const trimmedBody = rawBody.trim();
      const looksLikeJson =
        contentType.includes('application/json') ||
        trimmedBody.startsWith('{') ||
        trimmedBody.startsWith('[');

      if (!looksLikeJson) {
        const bodyKind = trimmedBody.startsWith('<') ? 'HTML' : '文本';
        this.analysisLoggerService.logWarn('联软标准 OpenAPI 返回格式异常。', {
          method,
          path,
          httpStatus: response.status,
          contentType: contentType || '未返回',
          bodyKind,
        });
        throw new Error(
          `联软标准 OpenAPI 返回格式异常：期望 JSON，实际返回 ${bodyKind}。请确认接口路径、鉴权状态或联软侧接口发布状态。`,
        );
      }

      try {
        return JSON.parse(rawBody) as T;
      } catch {
        this.analysisLoggerService.logWarn('联软标准 OpenAPI JSON 解析失败。', {
          method,
          path,
          httpStatus: response.status,
          contentType: contentType || '未返回',
        });
        throw new Error(
          '联软标准 OpenAPI 返回格式异常：JSON 内容无法解析，请确认联软侧接口响应格式。',
        );
      }
    }

    return (await response.json()) as T;
  }

  /**
   * 校验标准 OpenAPI 配置是否完整。
   *
   * 参数说明：无。
   * 返回值说明：返回运行时配置对象。
   * 调用注意事项：若缺少关键配置会抛出服务不可用异常，避免调用方误走半配置链路。
   */
  private ensureEnabled() {
    const runtimeConfig = this.lianruanCrmConnectionConfigService.getEffectiveRuntimeConfig();
    if (!runtimeConfig.enabled || !runtimeConfig.baseUrl) {
      throw new ServiceUnavailableException(
        '当前未配置联软标准 OpenAPI，请先设置 CRM_STANDARD_OPEN_API_BASE_URL、APP_KEY 和 APP_SECRET。',
      );
    }

    return runtimeConfig;
  }

  /**
   * 统一拼接带查询字符串的请求地址。
   *
   * 参数说明：
   * - `baseUrl`：标准 OpenAPI 基址。
   * - `path`：相对路径。
   * - `query`：可选查询参数。
   * 返回值说明：返回完整请求 URL。
   * 调用注意事项：只保留非空查询参数，避免把空筛选条件发送给远端。
   */
  private buildRequestUrl(
    baseUrl: string,
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
}
