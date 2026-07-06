import { Injectable } from '@nestjs/common';
import type {
  LianruanCrmOpenApiDictionaries,
  LianruanCrmOpenApiResource,
  LianruanCrmOpenApiCatalogResource,
  LianruanCrmOpenApiOperationResource,
} from './lianruan-crm-openapi.types';

/**
 * 字段能力注册表覆盖的全部资源类型。
 *
 * 主资源 + 产品目录资源 + 运营与提醒资源。
 * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节。
 */
export type LianruanFieldCapabilityResource =
  | LianruanCrmOpenApiResource
  | LianruanCrmOpenApiCatalogResource
  | LianruanCrmOpenApiOperationResource;

export type LianruanFieldRequiredLevel = 'P0' | 'P1' | 'P2';
export type LianruanFieldAvailabilityStatus = 'AVAILABLE' | 'MISSING' | 'NO_SAMPLE';

export interface LianruanFieldCapability {
  resource: LianruanFieldCapabilityResource;
  field: string;
  label: string;
  requiredLevel: LianruanFieldRequiredLevel;
  filterable: boolean;
  sortable: boolean;
  aggregatable: boolean;
  sensitive: boolean;
  dictionaryKey?: string;
  missingBehavior?: string;
}

export interface LianruanFieldCapabilityDiagnostic extends LianruanFieldCapability {
  available: boolean;
  availabilityStatus: LianruanFieldAvailabilityStatus;
  observedInSample: boolean;
  dictionaryAvailable?: boolean;
}

export interface LianruanResourceFieldDiagnostic {
  resource: LianruanCrmOpenApiResource;
  resourceLabel: string;
  sampleCount: number;
  observedFields: string[];
  totalExpectedFieldCount: number;
  availableFieldCount: number;
  missingP0Fields: string[];
  missingP1Fields: string[];
  completeness: number;
  fields: LianruanFieldCapabilityDiagnostic[];
}

export interface LianruanFieldCapabilitySummary {
  resources: LianruanResourceFieldDiagnostic[];
  overall: {
    totalExpectedFieldCount: number;
    availableFieldCount: number;
    missingP0Fields: Array<{ resource: LianruanCrmOpenApiResource; field: string; label: string }>;
    completeness: number;
  };
}

const RESOURCE_LABELS: Record<LianruanCrmOpenApiResource, string> = {
  users: '用户',
  customers: '客户主数据',
  partners: '服务商',
  registrations: '客户报备',
  opportunities: '商机',
  quotes: '报价',
  orders: '订单',
};

const CATALOG_RESOURCE_LABELS: Record<LianruanCrmOpenApiCatalogResource, string> = {
  categories: '产品大类',
  modules: '产品模块',
  features: '功能产品',
  hardware: '硬件产品',
  packages: '产品套餐',
  products: '产品',
};

const OPERATION_RESOURCE_LABELS: Record<LianruanCrmOpenApiOperationResource, string> = {
  notifications: '通知中心',
  'pending-approvals': '待审批',
  'channel-targets': '渠道目标',
  'channel-visits': '渠道拜访',
  'channel-operations-overview': '渠道运营总览',
  'dashboard-stats': '首页统计',
};

const FIELD_CAPABILITIES: LianruanFieldCapability[] = [
  { resource: 'users', field: 'id', label: '用户ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'users', field: 'username', label: '登录账号', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'users', field: 'name', label: '用户姓名', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'users', field: 'role', label: '角色编码', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'roles' },
  { resource: 'users', field: 'roleName', label: '角色名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'roles' },
  { resource: 'users', field: 'region', label: '区域', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'regions' },
  { resource: 'users', field: 'bigRegion', label: '大区', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'bigRegions' },
  { resource: 'users', field: 'partnerId', label: '绑定服务商ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'users', field: 'partnerName', label: '绑定服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'users', field: 'status', label: '用户状态', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'users', field: 'wecomUserId', label: '企业微信用户ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false, missingBehavior: '企微入口无法按真实 CRM 用户权限落位时，需要回退绑定诊断。' },
  { resource: 'users', field: 'departmentId', label: '部门ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'users', field: 'departmentName', label: '部门名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },

  { resource: 'customers', field: 'id', label: '客户ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'customers', field: 'customerId', label: '客户稳定ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'customers', field: 'name', label: '客户名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'customers', field: 'customer', label: '客户名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'customers', field: 'createdAt', label: '客户创建时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'updatedAt', label: '客户更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'customers', field: 'latestActivityAt', label: '最近活动时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'status', label: '客户生命周期状态', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'customerStatuses' },
  { resource: 'customers', field: 'statusName', label: '客户生命周期状态名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'customerStatuses' },
  { resource: 'customers', field: 'region', label: '区域', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'regions' },
  { resource: 'customers', field: 'bigRegion', label: '大区', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'bigRegions' },
  { resource: 'customers', field: 'ownerId', label: '负责人ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'ownerName', label: '负责人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'customers', field: 'assignedStaffId', label: '分配员工ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'assignedStaffName', label: '分配员工姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'customers', field: 'partnerId', label: '服务商ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'partnerName', label: '服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'customers', field: 'departmentId', label: '部门ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'departmentName', label: '部门名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'organizationId', label: '组织ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'source', label: '客户来源', requiredLevel: 'P2', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'category', label: '客户分类', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'customerCategories' },
  { resource: 'customers', field: 'categoryName', label: '客户分类名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'customerCategories' },
  { resource: 'customers', field: 'hasRegistration', label: '是否有报备', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'registrationCount', label: '报备数量', requiredLevel: 'P0', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'hasOpportunity', label: '是否有商机', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'opportunityCount', label: '商机数量', requiredLevel: 'P0', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'hasQuote', label: '是否有报价', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'quoteCount', label: '报价数量', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'hasOrder', label: '是否有订单', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'orderCount', label: '订单数量', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'ageBucket', label: '创建时长分桶', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'customerIdRule', label: '客户ID生成规则', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'customers', field: 'matchKey', label: '客户匹配键', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },

  { resource: 'partners', field: 'id', label: '服务商ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'partners', field: 'partnerId', label: '服务商标准ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'partners', field: 'name', label: '服务商名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'partners', field: 'partnerName', label: '服务商展示名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'partners', field: 'displayName', label: '服务商显示名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'partners', field: 'shortName', label: '服务商简称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false, missingBehavior: '企业微信图片表格会自动截断或换行服务商全称。' },
  { resource: 'partners', field: 'partnerLevel', label: '渠道等级', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'partnerLevels' },
  { resource: 'partners', field: 'partnerLevelName', label: '渠道等级名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'partnerLevels' },
  { resource: 'partners', field: 'level', label: '渠道等级历史字段', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'partnerLevels', missingBehavior: '联软旧版 SQLite 快照使用 level 表示服务商等级；标准字段 partnerLevel/partnerLevelName 可用时优先使用标准字段。' },
  /**
   * 合作级别（LEP/金牌/银牌/钻石），与合作等级是不同维度。
   * 来源：联软 partners 接口 2026-06-24 更新后返回。
   * 看板中 LEP/金牌 计数读取此字段。
   */
  { resource: 'partners', field: 'cooperationLevel', label: '合作级别', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'partnerCooperationLevels' },
  { resource: 'partners', field: 'cooperationLevelName', label: '合作级别名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'partnerCooperationLevels' },
  { resource: 'partners', field: 'partnerType', label: '服务商类型', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'partnerTypes' },
  { resource: 'partners', field: 'partnerTypeName', label: '服务商类型名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'partnerTypes' },
  { resource: 'partners', field: 'isTechnicalServiceProvider', label: '是否技术服务商兼容字段', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'partnerTypes', missingBehavior: '联软新契约优先使用 partnerType/partnerTypeName；该兼容字段缺失时不影响服务商类型分析。' },
  { resource: 'partners', field: 'technicalServiceProviderType', label: '技术服务商类型兼容字段', requiredLevel: 'P2', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'partnerTypes' },
  { resource: 'partners', field: 'isTechService', label: '是否技术服务商历史字段', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'partnerTypes', missingBehavior: '联软旧版 SQLite 快照使用 isTechService；OpenAPI 标准字段可用时优先使用 isTechnicalServiceProvider。' },
  { resource: 'partners', field: 'techServiceType', label: '技术服务商类型历史字段', requiredLevel: 'P2', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'partnerTypes', missingBehavior: '联软旧版 SQLite 快照使用 techServiceType；OpenAPI 标准字段可用时优先使用 technicalServiceProviderType。' },
  { resource: 'partners', field: 'region', label: '区域', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'regions' },
  { resource: 'partners', field: 'city', label: '所在城市', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, missingBehavior: '渠道商所在城市用于地市覆盖率分析；缺失时地图只能退回公司名、地址或区域文本兜底识别。' },
  { resource: 'partners', field: 'bigRegion', label: '大区', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'bigRegions' },
  { resource: 'partners', field: 'status', label: '服务商状态', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'partners', field: 'parentPartnerId', label: '上级服务商ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'partners', field: 'parentPartnerIds', label: '服务商上级链路', requiredLevel: 'P1', filterable: false, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'partners', field: 'joinDate', label: '服务商加入时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'partners', field: 'quoteCount', label: '服务商报价数量', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'partners', field: 'orderCount', label: '服务商订单数量', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'partners', field: 'totalAmt', label: '服务商累计金额历史字段', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false, missingBehavior: '联软旧版 SQLite 快照使用 totalAmt；OpenAPI 标准字段可用时优先使用 totalAmount 或订单/商机明细聚合。' },
  { resource: 'partners', field: 'totalAmount', label: '服务商累计金额', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'partners', field: 'createdAt', label: '加入时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'partners', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'registrations', field: 'id', label: '报备ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'registrationId', label: '报备标准ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'customerId', label: '客户稳定ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'registrations', field: 'customerIdRule', label: '客户ID生成规则', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'registrations', field: 'customer', label: '客户名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'customerName', label: '客户展示名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'status', label: '报备状态', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'registrationStatuses' },
  { resource: 'registrations', field: 'createdBy', label: '创建人ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'registrations', field: 'createdByName', label: '创建人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'assignedStaffId', label: '分配员工ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'registrations', field: 'assignedStaffName', label: '分配员工姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'partnerId', label: '服务商ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'registrations', field: 'partnerName', label: '服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'assignedPartnerId', label: '归属服务商ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'registrations', field: 'assignedPartnerName', label: '归属服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'opportunityId', label: '关联商机ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'opportunityName', label: '关联商机名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'region', label: '区域', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'regions' },
  { resource: 'registrations', field: 'bigRegion', label: '大区', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'bigRegions' },
  { resource: 'registrations', field: 'createdAt', label: '报备时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'registrations', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'registrations', field: 'approvedAt', label: '审核通过时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'registrations', field: 'expireAt', label: '报备失效时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false },

  { resource: 'opportunities', field: 'id', label: '商机ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'opportunityId', label: '商机标准ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'name', label: '商机名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'opportunityName', label: '商机展示名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'customerId', label: '客户稳定ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'customerIdRule', label: '客户ID生成规则', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'customer', label: '客户', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'customerName', label: '客户展示名称', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'registrationId', label: '来源报备标准ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'stage', label: '商机阶段', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'opportunityStages' },
  { resource: 'opportunities', field: 'stageName', label: '商机阶段名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'opportunityStages' },
  { resource: 'opportunities', field: 'status', label: '商机状态', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'opportunityStages' },
  { resource: 'opportunities', field: 'amount', label: '商机金额', requiredLevel: 'P0', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'expectedClose', label: '预计成交时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'ownerId', label: '负责人ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'ownerName', label: '负责人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'createdBy', label: '创建人ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'createdByName', label: '创建人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'assignedStaffId', label: '分配员工ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'assignedStaffName', label: '分配员工姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'partnerId', label: '服务商ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'partnerName', label: '服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'assignedPartnerId', label: '归属服务商ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'assignedPartnerName', label: '归属服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'region', label: '区域', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'regions' },
  { resource: 'opportunities', field: 'bigRegion', label: '大区', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'bigRegions' },
  { resource: 'opportunities', field: 'regId', label: '来源报备ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'quoteId', label: '关联报价ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'opportunities', field: 'createdAt', label: '商机创建时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'opportunities', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'quotes', field: 'id', label: '报价ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'quoteId', label: '报价标准ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'quoteName', label: '报价名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'customerId', label: '客户稳定ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'customerIdRule', label: '客户ID生成规则', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'customer', label: '客户名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'customerName', label: '客户名称', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'registrationId', label: '来源报备标准ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'regId', label: '来源报备兼容ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'opportunityId', label: '关联商机标准ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'opportunityIds', label: '关联商机标准ID集合', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'opportunityName', label: '关联商机名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'oppId', label: '关联商机ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'oppIds', label: '关联商机ID集合', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'partnerId', label: '服务商ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'partnerName', label: '服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'assignedPartnerId', label: '归属服务商ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'assignedPartnerName', label: '归属服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'parentPartnerId', label: '上级服务商ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'amount', label: '报价金额', requiredLevel: 'P0', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'total', label: '报价总额', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'totalAmount', label: '报价总金额', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'originalTotal', label: '报价原始总额', requiredLevel: 'P2', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'discountAmount', label: '报价优惠金额', requiredLevel: 'P2', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'ownerId', label: '负责人ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'ownerName', label: '负责人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'assignedStaffId', label: '分配员工ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'assignedStaffName', label: '分配员工姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'createdBy', label: '创建人ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'createdByName', label: '创建人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'quotes', field: 'status', label: '报价状态', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'quoteStatuses' },
  { resource: 'quotes', field: 'region', label: '区域', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'regions' },
  { resource: 'quotes', field: 'bigRegion', label: '大区', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'bigRegions' },
  { resource: 'quotes', field: 'createdAt', label: '报价时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'quotes', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'orders', field: 'id', label: '订单ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'orderId', label: '订单标准ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'orderNo', label: '订单编号', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'orderName', label: '订单名称', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'customerId', label: '客户稳定ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'customerIdRule', label: '客户ID生成规则', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'customer', label: '客户名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'customerName', label: '客户名称', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'registrationId', label: '来源报备标准ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'regId', label: '来源报备兼容ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'opportunityId', label: '关联商机标准ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'opportunityName', label: '关联商机名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'quoteId', label: '关联报价ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'partnerId', label: '服务商ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'partnerName', label: '服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'assignedPartnerId', label: '归属服务商ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'assignedPartnerName', label: '归属服务商名称', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'parentPartnerId', label: '上级服务商ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'amount', label: '订单金额', requiredLevel: 'P0', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'total', label: '订单总额', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'totalAmount', label: '订单总金额', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'ownerId', label: '负责人ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'ownerName', label: '负责人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'assignedStaffId', label: '分配员工ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'assignedStaffName', label: '分配员工姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'createdBy', label: '创建人ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'createdByName', label: '创建人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'orders', field: 'status', label: '订单状态', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'orderStatuses' },
  { resource: 'orders', field: 'region', label: '区域', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'regions' },
  { resource: 'orders', field: 'bigRegion', label: '大区', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'bigRegions' },
  { resource: 'orders', field: 'createdAt', label: '订单创建时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'dealAt', label: '成交时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'orders', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  // 产品目录资源字段（来源：契约文档第 19 节 + 扩展资源说明 2026-06-24）
  { resource: 'categories', field: 'id', label: '产品大类ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'categories', field: 'name', label: '产品大类名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'categories', field: 'type', label: '产品大类类型', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'categories', field: 'status', label: '状态', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'productStatuses' },
  { resource: 'categories', field: 'sort', label: '排序', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'categories', field: 'desc', label: '描述', requiredLevel: 'P2', filterable: false, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'categories', field: 'createdAt', label: '创建时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'categories', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'modules', field: 'id', label: '产品模块ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'modules', field: 'categoryId', label: '所属产品大类ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'modules', field: 'name', label: '产品模块名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'modules', field: 'status', label: '状态', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'productStatuses' },
  { resource: 'modules', field: 'sort', label: '排序', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'modules', field: 'desc', label: '描述', requiredLevel: 'P2', filterable: false, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'modules', field: 'createdAt', label: '创建时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'modules', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'features', field: 'id', label: '功能产品ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'features', field: 'moduleId', label: '所属产品模块ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'features', field: 'name', label: '功能产品名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'features', field: 'productCode', label: '产品编码', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'features', field: 'status', label: '状态', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'productStatuses' },
  { resource: 'features', field: 'published', label: '发布状态', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'publishStatuses' },
  { resource: 'features', field: 'price', label: '价格', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'features', field: 'sort', label: '排序', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'features', field: 'createdAt', label: '创建时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'features', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'hardware', field: 'id', label: '硬件产品ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'hardware', field: 'name', label: '硬件产品名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'hardware', field: 'productCode', label: '产品编码', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'hardware', field: 'brand', label: '品牌', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'hardware', field: 'model', label: '型号', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'hardware', field: 'status', label: '状态', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'productStatuses' },
  { resource: 'hardware', field: 'published', label: '发布状态', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'publishStatuses' },
  { resource: 'hardware', field: 'price', label: '价格', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'hardware', field: 'sort', label: '排序', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'hardware', field: 'createdAt', label: '创建时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'hardware', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'packages', field: 'id', label: '套餐ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'packages', field: 'name', label: '套餐名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'packages', field: 'featureIds', label: '包含功能产品ID', requiredLevel: 'P1', filterable: false, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'packages', field: 'hardwareIds', label: '包含硬件产品ID', requiredLevel: 'P1', filterable: false, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'packages', field: 'moduleIds', label: '包含产品模块ID', requiredLevel: 'P1', filterable: false, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'packages', field: 'status', label: '状态', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'productStatuses' },
  { resource: 'packages', field: 'sort', label: '排序', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'packages', field: 'desc', label: '描述', requiredLevel: 'P2', filterable: false, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'packages', field: 'createdAt', label: '创建时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'packages', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'products', field: 'id', label: '产品ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'products', field: 'name', label: '产品名称', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'products', field: 'categoryId', label: '所属产品大类ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'products', field: 'moduleId', label: '所属产品模块ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'products', field: 'featureId', label: '所属功能产品ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'products', field: 'status', label: '状态', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'productStatuses' },
  { resource: 'products', field: 'sort', label: '排序', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'products', field: 'createdAt', label: '创建时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },
  { resource: 'products', field: 'updatedAt', label: '更新时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  // 运营与提醒资源字段（来源：扩展资源说明 2026-06-24 第 3 节）
  { resource: 'notifications', field: 'id', label: '通知ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'notifications', field: 'type', label: '通知类型', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'notificationTypes' },
  { resource: 'notifications', field: 'title', label: '通知标题', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'notifications', field: 'content', label: '通知内容', requiredLevel: 'P1', filterable: false, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'notifications', field: 'status', label: '状态', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'notifications', field: 'createdAt', label: '创建时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },

  { resource: 'pending-approvals', field: 'id', label: '审批ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'pending-approvals', field: 'type', label: '审批类型', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'approvalTypes' },
  { resource: 'pending-approvals', field: 'status', label: '审批状态', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'approvalStatuses' },
  { resource: 'pending-approvals', field: 'title', label: '审批标题', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'pending-approvals', field: 'applicantId', label: '申请人ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'pending-approvals', field: 'applicantName', label: '申请人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'pending-approvals', field: 'createdAt', label: '创建时间', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },

  { resource: 'channel-targets', field: 'id', label: '渠道目标ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'channel-targets', field: 'partnerId', label: '渠道商ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'channel-targets', field: 'partnerName', label: '渠道商名称', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'channel-targets', field: 'year', label: '目标年份', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'channel-targets', field: 'targetAmount', label: '目标金额', requiredLevel: 'P0', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'channel-targets', field: 'actualAmount', label: '实际金额', requiredLevel: 'P0', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'channel-targets', field: 'completionRate', label: '完成率', requiredLevel: 'P1', filterable: false, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'channel-targets', field: 'createdAt', label: '创建时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  { resource: 'channel-visits', field: 'id', label: '拜访ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'channel-visits', field: 'partnerId', label: '渠道商ID', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'channel-visits', field: 'partnerName', label: '渠道商名称', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'channel-visits', field: 'type', label: '拜访类型', requiredLevel: 'P0', filterable: true, sortable: false, aggregatable: true, sensitive: false, dictionaryKey: 'channelVisitTypes' },
  { resource: 'channel-visits', field: 'status', label: '拜访状态', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false, dictionaryKey: 'channelVisitStatuses' },
  { resource: 'channel-visits', field: 'visitorId', label: '拜访人ID', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: true, sensitive: false },
  { resource: 'channel-visits', field: 'visitorName', label: '拜访人姓名', requiredLevel: 'P1', filterable: true, sortable: false, aggregatable: false, sensitive: false },
  { resource: 'channel-visits', field: 'visitDate', label: '拜访日期', requiredLevel: 'P0', filterable: true, sortable: true, aggregatable: true, sensitive: false },
  { resource: 'channel-visits', field: 'createdAt', label: '创建时间', requiredLevel: 'P1', filterable: true, sortable: true, aggregatable: false, sensitive: false },

  // channel-operations-overview 和 dashboard-stats 是单数聚合端点，
  // 不进入列表分页主链，无独立字段能力定义。
];

@Injectable()
export class LianruanCrmFieldCapabilityRegistry {
  /**
   * 读取全部联软标准字段能力定义。
   *
   * 参数说明：无。
   * 返回值说明：返回六类对象的字段能力定义副本。
   * 调用注意事项：调用方不得直接修改返回对象，避免影响全局诊断口径。
   */
  listCapabilities(): LianruanFieldCapability[] {
    return FIELD_CAPABILITIES.map((item) => ({ ...item }));
  }

  /**
   * 按资源和字段读取字段能力定义。
   *
   * 参数说明：
   * - `resource`：联软标准资源名（主资源/产品目录/运营资源）。
   * - `field`：标准 API 字段名。
   * 返回值说明：命中时返回字段能力副本，否则返回 `undefined`。
   * 调用注意事项：该方法只读取静态契约能力，不代表本次远端样例一定返回了字段值。
   */
  findCapability(
    resource: LianruanFieldCapabilityResource,
    field: string,
  ): LianruanFieldCapability | undefined {
    const capability = FIELD_CAPABILITIES.find(
      (item) => item.resource === resource && item.field === field,
    );
    return capability ? { ...capability } : undefined;
  }

  /**
   * 判断字段是否具备指定用途能力。
   *
   * 参数说明：
   * - `resource`：联软标准资源名（主资源/产品目录/运营资源）。
   * - `field`：标准 API 字段名。
   * - `usage`：字段用途，支持过滤、排序、聚合或只读展示。
   * 返回值说明：字段存在且满足用途能力时返回 true。
   * 调用注意事项：展示用途只校验字段存在；过滤、排序、聚合必须读取对应能力位。
   */
  supportsFieldUsage(
    resource: LianruanFieldCapabilityResource,
    field: string,
    usage: 'filter' | 'sort' | 'aggregate' | 'read',
  ): boolean {
    const capability = this.findCapability(resource, field);
    if (!capability) {
      return false;
    }

    if (usage === 'filter') {
      return capability.filterable;
    }

    if (usage === 'sort') {
      return capability.sortable;
    }

    if (usage === 'aggregate') {
      return capability.aggregatable;
    }

    return true;
  }

  /**
   * 读取产品目录资源的字段能力。
   *
   * 参数说明：无。
   * 返回值说明：返回 categories/modules/features/hardware/packages/products 的字段能力。
   */
  listCatalogCapabilities(): LianruanFieldCapability[] {
    const catalogResources = Object.keys(CATALOG_RESOURCE_LABELS) as LianruanCrmOpenApiCatalogResource[];
    return FIELD_CAPABILITIES.filter(
      (item) => catalogResources.includes(item.resource as LianruanCrmOpenApiCatalogResource),
    ).map((item) => ({ ...item }));
  }

  /**
   * 读取运营与提醒资源的字段能力。
   *
   * 参数说明：无。
   * 返回值说明：返回 notifications/pending-approvals/channel-targets/channel-visits 的字段能力。
   */
  listOperationCapabilities(): LianruanFieldCapability[] {
    const operationResources = Object.keys(OPERATION_RESOURCE_LABELS) as LianruanCrmOpenApiOperationResource[];
    return FIELD_CAPABILITIES.filter(
      (item) => operationResources.includes(item.resource as LianruanCrmOpenApiOperationResource),
    ).map((item) => ({ ...item }));
  }

  /**
   * 基于远端样例数据生成字段完整性诊断。
   *
   * 参数说明：
   * - `samplesByResource`：按资源名分组的远端样例数据。
   * - `dictionaries`：联软标准字典快照。
   * 返回值说明：返回每个对象的字段完整性、P0 缺失项和整体完整度。
   * 调用注意事项：样例为空时只标记为 `NO_SAMPLE`，不把字段永久判定为不可用。
   */
  buildDiagnostics(
    samplesByResource: Partial<Record<LianruanCrmOpenApiResource, Record<string, unknown>[]>>,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): LianruanFieldCapabilitySummary {
    const resources = (Object.keys(RESOURCE_LABELS) as LianruanCrmOpenApiResource[]).map(
      (resource) => this.buildResourceDiagnostic(resource, samplesByResource[resource] ?? [], dictionaries),
    );
    const totalExpectedFieldCount = resources.reduce(
      (sum, item) => sum + item.totalExpectedFieldCount,
      0,
    );
    const availableFieldCount = resources.reduce(
      (sum, item) => sum + item.availableFieldCount,
      0,
    );
    const missingP0Fields = resources.flatMap((item) =>
      item.fields
        .filter((field) => field.requiredLevel === 'P0' && !field.available)
        .map((field) => ({
          resource: item.resource,
          field: field.field,
          label: field.label,
        })),
    );

    return {
      resources,
      overall: {
        totalExpectedFieldCount,
        availableFieldCount,
        missingP0Fields,
        completeness: this.calculateCompleteness(
          availableFieldCount,
          totalExpectedFieldCount,
        ),
      },
    };
  }

  /**
   * 为单个资源生成字段完整性诊断。
   *
   * 参数说明：
   * - `resource`：联软标准资源名。
   * - `samples`：该资源已拉取的样例行。
   * - `dictionaries`：字典快照，用于判断字典字段是否有可用翻译。
   * 返回值说明：返回资源级字段诊断。
   */
  private buildResourceDiagnostic(
    resource: LianruanCrmOpenApiResource,
    samples: Record<string, unknown>[],
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): LianruanResourceFieldDiagnostic {
    const observedFields = this.collectObservedFields(samples);
    const capabilities = FIELD_CAPABILITIES.filter((item) => item.resource === resource);
    const fields = capabilities.map((item) =>
      this.buildFieldDiagnostic(item, observedFields, samples.length, dictionaries),
    );
    const availableFieldCount = fields.filter((item) => item.available).length;

    return {
      resource,
      resourceLabel: RESOURCE_LABELS[resource],
      sampleCount: samples.length,
      observedFields,
      totalExpectedFieldCount: fields.length,
      availableFieldCount,
      missingP0Fields: fields
        .filter((item) => item.requiredLevel === 'P0' && !item.available)
        .map((item) => item.field),
      missingP1Fields: fields
        .filter((item) => item.requiredLevel === 'P1' && !item.available)
        .map((item) => item.field),
      completeness: this.calculateCompleteness(availableFieldCount, fields.length),
      fields,
    };
  }

  /**
   * 为单个字段生成可用性诊断。
   *
   * 参数说明：
   * - `capability`：字段能力定义。
   * - `observedFields`：远端样例实际返回字段。
   * - `sampleCount`：样例行数。
   * - `dictionaries`：字典快照。
   * 返回值说明：返回字段级可用性和字典状态。
   */
  private buildFieldDiagnostic(
    capability: LianruanFieldCapability,
    observedFields: string[],
    sampleCount: number,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): LianruanFieldCapabilityDiagnostic {
    const observedInSample = observedFields.includes(capability.field);
    const availabilityStatus = sampleCount === 0
      ? 'NO_SAMPLE'
      : observedInSample
        ? 'AVAILABLE'
        : 'MISSING';
    const dictionaryAvailable = capability.dictionaryKey
      ? Array.isArray(dictionaries[capability.dictionaryKey])
      : undefined;

    return {
      ...capability,
      available: observedInSample,
      availabilityStatus,
      observedInSample,
      dictionaryAvailable,
    };
  }

  /**
   * 汇总样例行中实际出现过的字段。
   *
   * 参数说明：`samples` 为远端返回的对象样例。
   * 返回值说明：返回去重且排序后的字段名列表。
   */
  private collectObservedFields(samples: Record<string, unknown>[]): string[] {
    return Array.from(
      new Set(samples.flatMap((item) => Object.keys(item))),
    ).sort((left, right) => left.localeCompare(right));
  }

  /**
   * 计算字段完整度比例。
   *
   * 参数说明：`availableCount` 为可用字段数，`totalCount` 为应有字段数。
   * 返回值说明：返回 0 到 1 的两位小数比例。
   */
  private calculateCompleteness(availableCount: number, totalCount: number): number {
    if (totalCount === 0) {
      return 1;
    }

    return Number((availableCount / totalCount).toFixed(2));
  }
}
