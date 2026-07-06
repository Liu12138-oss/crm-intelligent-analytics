export type LianruanCrmOpenApiResource =
  | 'users'
  | 'customers'
  | 'partners'
  | 'registrations'
  | 'opportunities'
  | 'quotes'
  | 'orders';

export type LianruanCrmOpenApiCatalogResource =
  | 'categories'
  | 'modules'
  | 'features'
  | 'hardware'
  | 'packages'
  | 'products';

/**
 * 联软 OpenAPI 2026-06-24 扩展开放的产品与统计资源。
 *
 * 单数端点（product-tree / product-stats）对应只读树/统计接口，
 * 不进入分页列表主链，单独通过专用方法拉取。
 */
export type LianruanCrmOpenApiProductStatResource =
  | 'product-tree'
  | 'product-stats';

/**
 * 联软 OpenAPI 2026-06-24 扩展开放的运营与提醒资源。
 *
 * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节「运营与提醒」。
 */
export type LianruanCrmOpenApiOperationResource =
  | 'notifications'
  | 'pending-approvals'
  | 'channel-targets'
  | 'channel-visits'
  | 'channel-operations-overview'
  | 'dashboard-stats';

/**
 * 联软 OpenAPI 2026-06-24 扩展开放的计算与实施配置资源。
 *
 * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节「计算与实施配置」。
 * 工作量预览和 IPG 参考价预览为 POST 计算，不进入列表分页主链。
 */
export type LianruanCrmOpenApiWorkloadResource =
  | 'workload-classifications'
  | 'workload-delivery-rules'
  | 'workload-mappings'
  | 'workload-rules';

/**
 * 联软 OpenAPI 2026-06-24 扩展开放的辅助分析资源。
 *
 * audit-logs 仅超级管理员可见；identity/diagnostics/analytics 已在主链接入。
 */
export type LianruanCrmOpenApiAuxiliaryResource =
  | 'audit-logs'
  | 'company-search';

export interface LianruanCrmOpenApiBoundUser {
  id: string;
  username: string;
  name: string;
  role: string;
  roleName?: string;
  region?: string;
  bigRegion?: string;
  partnerId?: string;
  partnerName?: string;
  wecomUserId?: string;
  departmentId?: string;
  departmentName?: string;
  status?: string;
}

export interface LianruanCrmOpenApiClientContext {
  id: string;
  name: string;
  boundUserId: string;
  status: string;
  allowedResources: string[];
  ipWhitelist: string[];
  expiresAt?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LianruanCrmOpenApiPermissionScope {
  user: {
    id: string;
    name: string;
    role: string;
  };
  scopeType: 'all' | 'region' | 'partner' | 'user' | string;
  regions: string[];
  partnerIds: string[];
  userIds: string[];
}

export interface LianruanCrmOpenApiDictionaryItem {
  value: string;
  label: string;
  sort?: number;
  enabled?: boolean;
}

export interface LianruanCrmOpenApiDictionaries {
  roles?: LianruanCrmOpenApiDictionaryItem[];
  customerStatuses?: LianruanCrmOpenApiDictionaryItem[];
  customerCategories?: LianruanCrmOpenApiDictionaryItem[];
  customerTypes?: LianruanCrmOpenApiDictionaryItem[];
  partnerLevels?: LianruanCrmOpenApiDictionaryItem[];
  partnerTypes?: LianruanCrmOpenApiDictionaryItem[];
  partnerCooperationLevels?: LianruanCrmOpenApiDictionaryItem[];
  registrationStatuses?: LianruanCrmOpenApiDictionaryItem[];
  opportunityStages?: LianruanCrmOpenApiDictionaryItem[];
  quoteStatuses?: LianruanCrmOpenApiDictionaryItem[];
  orderStatuses?: LianruanCrmOpenApiDictionaryItem[];
  regions?: LianruanCrmOpenApiDictionaryItem[];
  bigRegions?: LianruanCrmOpenApiDictionaryItem[];
  technicalServiceProviderTypes?: LianruanCrmOpenApiDictionaryItem[];
  /**
   * 2026-06-24 字典增强，来源：《AI-agent 全量业务 OpenAPI 取数说明》第 5 节。
   */
  openApiResources?: LianruanCrmOpenApiDictionaryItem[];
  openApiResourceGroups?: LianruanCrmOpenApiDictionaryItem[];
  productStatuses?: LianruanCrmOpenApiDictionaryItem[];
  priceTypes?: LianruanCrmOpenApiDictionaryItem[];
  publishStatuses?: LianruanCrmOpenApiDictionaryItem[];
  approvalTypes?: LianruanCrmOpenApiDictionaryItem[];
  approvalStatuses?: LianruanCrmOpenApiDictionaryItem[];
  notificationTypes?: LianruanCrmOpenApiDictionaryItem[];
  channelVisitTypes?: LianruanCrmOpenApiDictionaryItem[];
  channelVisitStatuses?: LianruanCrmOpenApiDictionaryItem[];
  workloadProductTypes?: LianruanCrmOpenApiDictionaryItem[];
  workloadDeliveryTags?: LianruanCrmOpenApiDictionaryItem[];
  auditModules?: LianruanCrmOpenApiDictionaryItem[];
  auditActions?: LianruanCrmOpenApiDictionaryItem[];
  auditResults?: LianruanCrmOpenApiDictionaryItem[];
  businessFieldDictionary?: Record<string, unknown>;
  [key: string]:
    | LianruanCrmOpenApiDictionaryItem[]
    | Record<string, unknown>
    | undefined;
}

export interface LianruanCrmOpenApiSuccessResponse<T> {
  code: 0;
  message: string;
  data: T;
  requestId?: string;
}

export interface LianruanCrmOpenApiErrorResponse {
  code: number;
  message: string;
  requestId?: string;
}

export type LianruanCrmOpenApiResponse<T> =
  | LianruanCrmOpenApiSuccessResponse<T>
  | LianruanCrmOpenApiErrorResponse;

export interface LianruanCrmOpenApiPagedResponse<T> {
  code: number;
  message: string;
  data: T[];
  requestId?: string;
  pageNo?: number;
  pageSize?: number;
  total?: number;
  returnedCount?: number;
}

export interface LianruanCrmOpenApiTokenPayload {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer' | string;
  clientId: string;
  clientName: string;
  boundUser: LianruanCrmOpenApiBoundUser;
}

export interface LianruanCrmOpenApiAuthMePayload {
  client: LianruanCrmOpenApiClientContext;
  user: LianruanCrmOpenApiBoundUser;
}

export interface LianruanCrmOpenApiListQuery {
  pageNo?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  region?: string;
  bigRegion?: string;
  partnerId?: string;
  partnerName?: string;
  customer?: string;
  customerId?: string;
  registrationId?: string;
  opportunityId?: string;
  quoteId?: string;
  orderId?: string;
  orderNo?: string;
  assignedStaffId?: string;
  ownerId?: string;
  ownerName?: string;
  createdBy?: string;
  stage?: string;
  partnerLevel?: string;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
  isTechnicalServiceProvider?: boolean;
}

export type LianruanCrmOpenApiAnalyticsQuery = Omit<
  LianruanCrmOpenApiListQuery,
  'pageNo' | 'pageSize' | 'keyword' | 'sortBy' | 'sortOrder'
>;

export interface LianruanCrmOpenApiPageResult<T extends Record<string, unknown>> {
  items: T[];
  pageNo: number;
  pageSize: number;
  total: number;
  returnedCount: number;
  requestId?: string;
}

export interface LianruanCrmOpenApiPartnerContributionRecord extends Record<string, unknown> {
  partnerId: string;
  partnerName: string;
  partnerLevel?: string;
  partnerLevelName?: string;
  region?: string;
  bigRegion?: string;
  registrationCount?: number;
  opportunityCount?: number;
  opportunityAmount?: number;
  quoteCount?: number;
  quoteAmount?: number;
  orderCount?: number;
  orderAmount?: number;
  /** 合作级别（lep/gold/silver/diamond），来源 2026-06-24 端点增强 */
  cooperationLevel?: string;
  /** 合作级别中文名称（LEP/金牌/银牌/钻石） */
  cooperationLevelName?: string;
  /** 技术服务商类型（none/full/developing/nominated） */
  techServiceType?: string;
  /** 技术服务商类型中文名称 */
  techServiceTypeName?: string;
  /** 是否为技术服务商 */
  isTechnicalServiceProvider?: boolean;
  /** 状态 */
  status?: string;
}

export interface LianruanCrmOpenApiPartnerProfileBucket extends Record<string, unknown> {
  key?: string;
  value?: string | boolean | number;
  label?: string;
  name?: string;
  count?: number;
}

export interface LianruanCrmOpenApiPartnerProfileAnalytics extends Record<string, unknown> {
  totalCount?: number;
  activeCount?: number;
  technicalServiceProviderCount?: number;
  byLevel?: LianruanCrmOpenApiPartnerProfileBucket[];
  byPartnerLevel?: LianruanCrmOpenApiPartnerProfileBucket[];
  byTechnicalServiceProvider?: LianruanCrmOpenApiPartnerProfileBucket[];
  byStatus?: LianruanCrmOpenApiPartnerProfileBucket[];
  byRegion?: LianruanCrmOpenApiPartnerProfileBucket[];
  byBigRegion?: LianruanCrmOpenApiPartnerProfileBucket[];
}

export interface LianruanCrmOpenApiFunnelAnalytics extends Record<string, unknown> {
  registrationCount?: number;
  opportunityCount?: number;
  quoteCount?: number;
  orderCount?: number;
  registrationToOpportunityRate?: number;
  opportunityToQuoteRate?: number;
  quoteToOrderRate?: number;
  /** 漏斗各阶段金额（2026-06-24 增强） */
  registrationAmount?: number;
  opportunityAmount?: number;
  quoteAmount?: number;
  orderAmount?: number;
  /** 维度分布（2026-06-24 增强） */
  dimensions?: LianruanCrmOpenApiSummaryBuckets;
  /** 时间序列（2026-06-24 增强） */
  timeSeries?: LianruanCrmOpenApiTimeSeriesPeriod[];
}

/**
 * 统计维度分桶项。
 *
 * 来源：2026-06-24 统计端点增强，适用于 summary/byStatus/byRegion/byCooperationLevel 等维度。
 * 字段含义：key 为枚举值（如 'lep'/'gold'/'full'/'proposal'），count 为数量，amount 为金额（可选）。
 */
export interface LianruanCrmOpenApiSummaryBucket {
  key: string;
  count: number;
  amount?: number;
}

/** 维度分桶集合，统一收纳各维度分布 */
export interface LianruanCrmOpenApiSummaryBuckets {
  byStatus?: LianruanCrmOpenApiSummaryBucket[];
  statusDistribution?: LianruanCrmOpenApiSummaryBucket[];
  byRegion?: LianruanCrmOpenApiSummaryBucket[];
  byBigRegion?: LianruanCrmOpenApiSummaryBucket[];
  byPartnerLevel?: LianruanCrmOpenApiSummaryBucket[];
  byCooperationLevel?: LianruanCrmOpenApiSummaryBucket[];
  byTechServiceType?: LianruanCrmOpenApiSummaryBucket[];
  byTechnicalServiceProviderType?: LianruanCrmOpenApiSummaryBucket[];
  byPartner?: LianruanCrmOpenApiSummaryBucket[];
  byPartnerName?: LianruanCrmOpenApiSummaryBucket[];
  byMonth?: LianruanCrmOpenApiSummaryBucket[];
  [key: string]: LianruanCrmOpenApiSummaryBucket[] | undefined;
}

/**
 * 时间序列周期项。
 *
 * 来源：2026-06-24 统计端点增强。每个周期按 dateField + granularity 分桶。
 * 嵌套维度可选，与外层 dimensions 结构一致，用于按时间下钻分析。
 */
export interface LianruanCrmOpenApiTimeSeriesPeriod {
  period: string;
  key: string;
  count: number;
  amount?: number;
  byStatus?: LianruanCrmOpenApiSummaryBucket[];
  byCooperationLevel?: LianruanCrmOpenApiSummaryBucket[];
  byTechServiceType?: LianruanCrmOpenApiSummaryBucket[];
  byRegion?: LianruanCrmOpenApiSummaryBucket[];
  byBigRegion?: LianruanCrmOpenApiSummaryBucket[];
}

/**
 * summary 端点统一响应。
 *
 * 来源：2026-06-24 联软统计端点增强，GET /analytics/{resource}/summary 统一返回此结构。
 * 适用于 partners/registrations/opportunities/quotes/orders/technical-service-providers。
 */
export interface LianruanCrmOpenApiResourceSummary extends Record<string, unknown> {
  resource: string;
  totalCount: number;
  totalAmount?: number;
  statusField?: string;
  byStatus?: LianruanCrmOpenApiSummaryBucket[];
  byRegion?: LianruanCrmOpenApiSummaryBucket[];
  byBigRegion?: LianruanCrmOpenApiSummaryBucket[];
  byMonth?: LianruanCrmOpenApiSummaryBucket[];
  byCooperationLevel?: LianruanCrmOpenApiSummaryBucket[];
  byTechServiceType?: LianruanCrmOpenApiSummaryBucket[];
  byPartnerLevel?: LianruanCrmOpenApiSummaryBucket[];
  statusDistribution?: LianruanCrmOpenApiSummaryBucket[];
  dimensions?: LianruanCrmOpenApiSummaryBuckets;
  timeSeries?: LianruanCrmOpenApiTimeSeriesPeriod[];
  topPartners?: LianruanCrmOpenApiSummaryBucket[];
  topStaff?: LianruanCrmOpenApiSummaryBucket[];
  dataSource?: string;
}

export interface LianruanCrmOpenApiRegionContributionRecord extends Record<string, unknown> {
  region?: string;
  bigRegion?: string;
  registrationCount?: number;
  opportunityCount?: number;
  opportunityAmount?: number;
  quoteCount?: number;
  quoteAmount?: number;
  orderCount?: number;
  orderAmount?: number;
}

export interface LianruanCrmOpenApiOwnerContributionRecord extends Record<string, unknown> {
  ownerId?: string;
  ownerName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  registrationCount?: number;
  opportunityCount?: number;
  opportunityAmount?: number;
  quoteCount?: number;
  quoteAmount?: number;
  orderCount?: number;
  orderAmount?: number;
}

export interface LianruanCrmOpenApiCustomerLifecycleBucket extends Record<string, unknown> {
  key?: string;
  value?: string | boolean | number;
  label?: string;
  name?: string;
  count?: number;
}

export interface LianruanCrmOpenApiCustomerLifecycleAnalytics extends Record<string, unknown> {
  totalCount?: number;
  idleCount?: number;
  noRegistrationCount?: number;
  noOpportunityCount?: number;
  noQuoteCount?: number;
  noOrderCount?: number;
  byStatus?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  byAgeBucket?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  byRegion?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  byBigRegion?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  byOwner?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  byPartner?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  idleSamples?: LianruanCrmOpenApiCustomerRecord[];
}

export interface LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics extends Record<string, unknown> {
  noRegistrationCount?: number;
  noOpportunityCount?: number;
  noQuoteCount?: number;
  noOrderCount?: number;
  noRegistrationByAgeBucket?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  noOpportunityByOwner?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  noOpportunityByRegion?: LianruanCrmOpenApiCustomerLifecycleBucket[] | Record<string, unknown>;
  samples?: LianruanCrmOpenApiCustomerRecord[];
}

export interface LianruanCrmOpenApiUserRecord extends Record<string, unknown> {
  id: string;
  username: string;
  name: string;
  role: string;
  roleName?: string;
  region?: string;
  bigRegion?: string;
  partnerId?: string;
  partnerName?: string;
  wecomUserId?: string;
  departmentId?: string;
  departmentName?: string;
  status?: string;
}

export interface LianruanCrmOpenApiCustomerRecord extends Record<string, unknown> {
  id: string;
  customerId?: string;
  name?: string;
  customer?: string;
  createdAt?: string;
  updatedAt?: string;
  latestActivityAt?: string;
  status?: string;
  statusName?: string;
  region?: string;
  bigRegion?: string;
  ownerId?: string;
  ownerName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  partnerId?: string;
  partnerName?: string;
  departmentId?: string;
  departmentName?: string;
  organizationId?: string;
  source?: string;
  category?: string;
  categoryName?: string;
  hasRegistration?: boolean;
  registrationCount?: number;
  hasOpportunity?: boolean;
  opportunityCount?: number;
  hasQuote?: boolean;
  quoteCount?: number;
  hasOrder?: boolean;
  orderCount?: number;
  ageBucket?: string;
  customerIdRule?: string;
  matchKey?: string;
}

export interface LianruanCrmOpenApiPartnerRecord extends Record<string, unknown> {
  id: string;
  partnerId?: string;
  name: string;
  partnerName?: string;
  displayName?: string;
  shortName?: string;
  partnerLevel?: string;
  partnerLevelName?: string;
  level?: string;
  /**
   * 合作级别编码（lep/gold/silver/diamond）。
   *
   * 与 partnerLevel（合作等级：一级/二级/未设置）是不同维度。
   * 来源：联软 partners 接口 2026-06-24 更新后返回。
   */
  cooperationLevel?: string;
  /** 合作级别中文名称（LEP/金牌/银牌/钻石）。 */
  cooperationLevelName?: string;
  partnerType?: string;
  partnerTypeName?: string;
  isTechnicalServiceProvider?: boolean;
  technicalServiceProviderType?: string;
  isTechService?: boolean;
  /**
   * 技术服务商类型（full=签约技术服务商，developing=提名技术服务商，none=非技术服务商）。
   *
   * 来源：联软 partners 接口。看板"签约技术"计数读 full，"提名"计数读 developing。
   */
  techServiceType?: string;
  parentPartnerId?: string;
  parentPartnerIds?: string[];
  region?: string;
  city?: string;
  bigRegion?: string;
  status?: string;
  joinDate?: string;
  quoteCount?: number;
  orderCount?: number;
  totalAmt?: number;
  totalAmount?: number;
  contact?: string;
  phone?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LianruanCrmOpenApiRegistrationRecord extends Record<string, unknown> {
  id: string;
  registrationId?: string;
  customerId?: string;
  customerIdRule?: string;
  customer: string;
  customerName?: string;
  contact?: string;
  phone?: string;
  creditCode?: string;
  industry?: string;
  status?: string;
  createdBy?: string;
  createdByName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  partnerId?: string;
  partnerName?: string;
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  opportunityId?: string;
  opportunityName?: string;
  region?: string;
  bigRegion?: string;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
  expireAt?: string;
}

export interface LianruanCrmOpenApiOpportunityRecord extends Record<string, unknown> {
  id: string;
  opportunityId?: string;
  name: string;
  opportunityName?: string;
  customerId?: string;
  customerIdRule?: string;
  customer?: string;
  customerName?: string;
  registrationId?: string;
  stage?: string;
  stageName?: string;
  status?: string;
  amount?: number;
  expectedClose?: string;
  createdBy?: string;
  createdByName?: string;
  ownerId?: string;
  ownerName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  partnerId?: string;
  partnerName?: string;
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  region?: string;
  bigRegion?: string;
  regId?: string;
  quoteId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LianruanCrmOpenApiQuoteRecord extends Record<string, unknown> {
  id: string;
  quoteId?: string;
  quoteName?: string;
  customerId?: string;
  customerIdRule?: string;
  customer?: string;
  customerName?: string;
  registrationId?: string;
  regId?: string;
  opportunityId?: string;
  opportunityIds?: string[];
  opportunityName?: string;
  oppId?: string;
  oppIds?: string[];
  partnerId?: string;
  partnerName?: string;
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  ownerId?: string;
  ownerName?: string;
  amount?: number;
  total?: number;
  totalAmount?: number;
  originalTotal?: number;
  discountAmount?: number;
  status?: string;
  endpoints?: unknown;
  products?: unknown;
  quoteMode?: string;
  createdBy?: string;
  createdByName?: string;
  region?: string;
  bigRegion?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LianruanCrmOpenApiOrderRecord extends Record<string, unknown> {
  id: string;
  orderId?: string;
  orderNo?: string;
  orderName?: string;
  customerId?: string;
  customerIdRule?: string;
  customer?: string;
  customerName?: string;
  registrationId?: string;
  regId?: string;
  opportunityId?: string;
  opportunityName?: string;
  quoteId?: string;
  partnerId?: string;
  partnerName?: string;
  parentPartnerId?: string;
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  ownerId?: string;
  ownerName?: string;
  amount?: number;
  total?: number;
  totalAmount?: number;
  dealAt?: string;
  status?: string;
  region?: string;
  bigRegion?: string;
  deliveryAddr?: string;
  contacts?: unknown;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 联软 OpenAPI 标准错误码映射。
 *
 * 来源：《联软 CRM 对接 AI-agent 标准 API 契约》第 4 节。
 * 用于客户端把错误码翻译为可读原因，避免散落硬编码。
 */
export const LIANRUAN_CRM_OPENAPI_ERROR_CODES = {
  40111: '缺少 appKey 或 appSecret',
  40112: 'client 无效',
  40113: 'appSecret 无效',
  40101: '缺少 accessToken',
  40102: 'accessToken 无效或过期',
  40312: 'IP 不在白名单',
  40313: '绑定 CRM 用户不可用',
  40301: 'client 被禁用或已过期',
  40302: '当前请求 IP 不允许',
  40303: '资源未授权',
  40304: '绑定 CRM 用户不可访问',
  40401: '用户不存在',
  40402: '渠道不存在',
  40403: '报备不存在',
  40404: '商机不存在',
  40405: '报价不存在',
  40406: '订单不存在',
  40407: '套餐不存在',
  40408: '产品不存在',
  40409: '统计资源不存在',
} as const;

export type LianruanCrmOpenApiErrorCode =
  keyof typeof LIANRUAN_CRM_OPENAPI_ERROR_CODES;

/**
 * 解析联软 OpenAPI 错误码为中文说明。
 *
 * 参数说明：`code` 为响应中的数字错误码。
 * 返回值说明：已知错误码返回中文说明，未知错误码返回 undefined。
 */
export function describeLianruanCrmOpenApiErrorCode(
  code: number,
): string | undefined {
  return (LIANRUAN_CRM_OPENAPI_ERROR_CODES as Record<number, string>)[code];
}
