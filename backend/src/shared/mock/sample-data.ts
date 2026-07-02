import type {
  AccessPolicyRecord,
  AnalysisScopePolicyRecord,
  AiContextPolicyRecord,
  ApplicationSuperAdminPolicyRecord,
  AppStorageState,
  CrmContract,
  CrmCustomer,
  CrmOpportunity,
  CrmUser,
  QueryTemplateRecord,
  QueryTimeSlotStatRecord,
  QueryUsageProfileRecord,
  RecentQueryRecord,
  RolePermissionRecord,
  WecomBotConnectionConfigRecord,
  WecomPilotPolicyRecord,
} from '../types/domain';
import { mergeLianruanOpenApiAccessPolicySupplement } from '../governance/lianruan-openapi-access-policy-supplement';

export const DEFAULT_DATA_FRESHNESS_AT = '2026-03-24T09:00:00.000Z';

export const CRM_AUTH_ACCOUNTS = [
  {
    login: 'director',
    password: 'director123',
    corpId: 'mock-corp',
    userId: 'user_sales_director',
    wecomSenderId: 'wx_sales_director',
    wecomCode: 'mock-wecom-director',
  },
  {
    login: 'manager',
    password: 'manager123',
    corpId: 'mock-corp',
    userId: 'user_region_manager',
    wecomSenderId: 'wx_region_manager',
    wecomCode: 'mock-wecom-manager',
  },
  {
    login: 'admin',
    password: 'admin123',
    corpId: 'mock-corp',
    userId: 'user_admin',
    wecomCode: 'mock-wecom-admin',
  },
] as const;

export const CRM_USERS: CrmUser[] = [
  {
    id: 'user_sales_director',
    name: '销售总监',
    roleIds: ['role_sales_director'],
    roleNames: ['销售总监'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_sales'],
    ownerIds: ['owner_zhang', 'owner_li', 'owner_wang'],
    isAdmin: false,
    exportAllowed: true,
    channels: ['web-console', 'wecom-bot'],
    wecomSenderId: 'wx_sales_director',
    supervisorId: 'user_region_manager',
    supervisorName: '区域经理',
  },
  {
    id: 'user_region_manager',
    name: '区域经理',
    roleIds: ['role_region_manager'],
    roleNames: ['区域经理'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_region_east'],
    ownerIds: ['owner_zhang'],
    isAdmin: false,
    exportAllowed: false,
    channels: ['web-console', 'wecom-bot'],
    wecomSenderId: 'wx_region_manager',
    supervisorId: 'user_sales_vp',
    supervisorName: '销售副总',
  },
  {
    id: 'user_sales_vp',
    name: '销售副总',
    roleIds: ['role_sales_vp'],
    roleNames: ['销售副总'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_sales_management'],
    ownerIds: ['owner_zhang', 'owner_li', 'owner_wang'],
    isAdmin: false,
    exportAllowed: false,
    channels: ['web-console', 'wecom-bot'],
    wecomSenderId: 'wx_sales_vp',
  },
  {
    id: 'user_product_li_si',
    name: '李四',
    roleIds: ['role_product_manager'],
    roleNames: ['产品经理'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_product'],
    ownerIds: [],
    isAdmin: false,
    exportAllowed: false,
    channels: ['web-console', 'wecom-bot'],
    wecomSenderId: 'wx_product_li_si',
    supervisorId: 'user_product_director',
    supervisorName: '产品总监',
  },
  {
    id: 'user_product_director',
    name: '产品总监',
    roleIds: ['role_product_director'],
    roleNames: ['产品总监'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_product'],
    ownerIds: [],
    isAdmin: false,
    exportAllowed: false,
    channels: ['web-console', 'wecom-bot'],
    wecomSenderId: 'wx_product_director',
  },
  {
    id: 'user_admin',
    name: '系统管理员',
    roleIds: ['role_admin'],
    roleNames: ['系统管理员'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_admin'],
    ownerIds: ['owner_zhang', 'owner_li', 'owner_wang'],
    isAdmin: true,
    exportAllowed: true,
    channels: ['web-console'],
  },
];

export const CRM_OPPORTUNITIES: CrmOpportunity[] = [
  {
    id: 'opp_001',
    title: '山东农信续约',
    ownerId: 'owner_zhang',
    ownerName: '张琳',
    organizationId: 'org_north',
    departmentId: 'dept_region_east',
    expectAmount: 860000,
    stage: '谈判',
    createdAt: '2026-03-05T10:00:00.000Z',
  },
  {
    id: 'opp_002',
    title: '苏州制造升级',
    ownerId: 'owner_li',
    ownerName: '李浩',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    expectAmount: 540000,
    stage: '方案',
    createdAt: '2026-03-08T10:00:00.000Z',
  },
  {
    id: 'opp_003',
    title: '青岛零售集团',
    ownerId: 'owner_wang',
    ownerName: '王敏',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    expectAmount: 730000,
    stage: '初访',
    createdAt: '2026-03-10T10:00:00.000Z',
  },
  {
    id: 'opp_004',
    title: '近三个月趋势样本A',
    ownerId: 'owner_zhang',
    ownerName: '张琳',
    organizationId: 'org_north',
    departmentId: 'dept_region_east',
    expectAmount: 420000,
    stage: '赢单',
    createdAt: '2026-02-18T10:00:00.000Z',
  },
  {
    id: 'opp_005',
    title: '近三个月趋势样本B',
    ownerId: 'owner_li',
    ownerName: '李浩',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    expectAmount: 390000,
    stage: '赢单',
    createdAt: '2026-01-12T10:00:00.000Z',
  },
  {
    id: 'opp_006',
    title: '年度排名样本A',
    ownerId: 'owner_zhang',
    ownerName: '张琳',
    organizationId: 'org_north',
    departmentId: 'dept_region_east',
    expectAmount: 1280000,
    stage: '赢单',
    createdAt: '2025-11-18T10:00:00.000Z',
  },
  {
    id: 'opp_007',
    title: '年度排名样本B',
    ownerId: 'owner_li',
    ownerName: '李浩',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    expectAmount: 1160000,
    stage: '谈判',
    createdAt: '2025-09-08T10:00:00.000Z',
  },
  {
    id: 'opp_008',
    title: '年度排名样本C',
    ownerId: 'owner_wang',
    ownerName: '王敏',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    expectAmount: 1420000,
    stage: '方案',
    createdAt: '2025-07-14T10:00:00.000Z',
  },
  {
    id: 'opp_009',
    title: '年度趋势样本D',
    ownerId: 'owner_zhang',
    ownerName: '张琳',
    organizationId: 'org_north',
    departmentId: 'dept_region_east',
    expectAmount: 980000,
    stage: '初访',
    createdAt: '2025-05-21T10:00:00.000Z',
  },
  {
    id: 'opp_010',
    title: '年度趋势样本E',
    ownerId: 'owner_li',
    ownerName: '李浩',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    expectAmount: 870000,
    stage: '赢单',
    createdAt: '2025-04-09T10:00:00.000Z',
  },
];

export const CRM_CONTRACTS: CrmContract[] = [
  {
    id: 'con_001',
    title: '山东农信合同',
    ownerId: 'owner_zhang',
    ownerName: '张琳',
    organizationId: 'org_north',
    departmentId: 'dept_region_east',
    totalAmount: 510000,
    status: '已签约',
    signDate: '2026-03-19T09:00:00.000Z',
  },
  {
    id: 'con_002',
    title: '苏州制造合同',
    ownerId: 'owner_li',
    ownerName: '李浩',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    totalAmount: 360000,
    status: '已签约',
    signDate: '2026-03-16T09:00:00.000Z',
  },
];

export const CRM_CUSTOMERS: CrmCustomer[] = [
  {
    id: 'cus_001',
    name: '山东农信',
    ownerId: 'owner_zhang',
    organizationId: 'org_north',
    departmentId: 'dept_region_east',
    category: '重点客户',
    createdAt: '2026-03-05T10:00:00.000Z',
  },
  {
    id: 'cus_002',
    name: '苏州制造',
    ownerId: 'owner_li',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    category: '战略客户',
    createdAt: '2026-03-08T10:00:00.000Z',
  },
  {
    id: 'cus_003',
    name: '联软科技集团',
    ownerId: 'owner_wang',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    category: '重点客户',
    createdAt: '2026-03-10T10:00:00.000Z',
  },
];

const DEFAULT_QUERY_TEMPLATE_VISIBLE_ROLE_IDS = [
  'role_sales_director',
  'role_region_manager',
];
const DEFAULT_QUERY_TEMPLATE_OWNER_ID = 'user_admin';
const DEFAULT_QUERY_TEMPLATE_SQL_VERSION = '2026.05.28-dimension-left-join';
const DEFAULT_QUERY_TEMPLATE_UPDATED_AT = '2026-05-28T16:30:00.000Z';
const DEFAULT_QUERY_TEMPLATE_VALIDATION_SNAPSHOT = {
  status: 'PASSED' as const,
  message: 'SQL 已通过只读校验。',
};

/**
 * 将《公司 2026》Grafana 看板沉淀为内置查询模板。
 *
 * 设计原因：
 * 1. 根目录 JSON 在发布脚本中会被排除，不可能依赖线上动态读取；
 * 2. 这里把看板主题转成受控只读 SQL 模板，避免治理页每次上线后还要手工补录；
 * 3. 所有模板都限制在当前白名单表内，保证预览、执行和治理口径一致。
 */
function createDefaultQueryTemplate(
  template: {
    id: string;
    name: string;
    description: string;
    defaultQuestionText: string;
    defaultFilters: Record<string, unknown>;
    defaultViewType: QueryTemplateRecord['defaultViewType'];
    sqlText: string;
    parameterSchema?: QueryTemplateRecord['parameterSchema'];
    renderConfig: QueryTemplateRecord['renderConfig'];
    displayOrder: number;
    clickCount7d?: number;
    hitRatePercent?: number;
  },
): QueryTemplateRecord {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    tags: ['内置模板', '常用查询'],
    defaultQuestionText: template.defaultQuestionText,
    defaultFilters: template.defaultFilters,
    defaultViewType: template.defaultViewType,
    queryMode: 'FIXED_SQL',
    sqlText: template.sqlText,
    sqlVersion: DEFAULT_QUERY_TEMPLATE_SQL_VERSION,
    parameterSchema: template.parameterSchema ?? [],
    renderConfig: template.renderConfig,
    visibleRoleIds: [...DEFAULT_QUERY_TEMPLATE_VISIBLE_ROLE_IDS],
    ownerUserId: DEFAULT_QUERY_TEMPLATE_OWNER_ID,
    visibilityType: 'SHARED',
    displayOrder: template.displayOrder,
    clickCount7d: template.clickCount7d ?? 0,
    usageCountTotal: template.clickCount7d ?? 0,
    hitRatePercent: template.hitRatePercent ?? 0,
    optimizationStatus: 'HEALTHY',
    status: 'ACTIVE',
    sourceType: 'GOVERNANCE_CREATED',
    ownedBy: DEFAULT_QUERY_TEMPLATE_OWNER_ID,
    updatedAt: DEFAULT_QUERY_TEMPLATE_UPDATED_AT,
    validationSnapshot: {
      ...DEFAULT_QUERY_TEMPLATE_VALIDATION_SNAPSHOT,
    },
    lastValidatedAt: DEFAULT_QUERY_TEMPLATE_UPDATED_AT,
  };
}

export const DEFAULT_QUERY_TEMPLATES: QueryTemplateRecord[] = [
  createDefaultQueryTemplate({
    id: 'tpl_company_quarterly_opportunity_health',
    name: '2026 团队新增商机月度分布',
    description:
      '按团队统计 2026 年 1-12 月新增商机金额，展示各月新增规模和全年合计，便于比较团队新增储备节奏。',
    defaultQuestionText: '2026 各团队新增商机月度分布',
    defaultFilters: {
      year: 2026,
      metricScope: 'monthly_new_opportunity_by_team',
      groupBy: 'team',
      granularity: 'month',
    },
    defaultViewType: 'BAR_CHART',
    sqlText: `SELECT
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE d.name
  END AS team_name,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 1 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS jan_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 2 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS feb_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 3 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS mar_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 4 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS apr_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 5 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS may_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 6 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS jun_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 7 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS jul_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 8 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS aug_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 9 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS sep_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 10 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS oct_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 11 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS nov_amount,
  ROUND(SUM(CASE WHEN MONTH(o.created_at) = 12 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS dec_amount,
  ROUND(SUM(COALESCE(o.expect_amount, 0)) / 10000, 2) AS annual_total_amount
FROM opportunities o
LEFT JOIN customers cu ON o.customer_id = cu.id
LEFT JOIN departments d ON o.department_id = d.id
WHERE YEAR(o.created_at) = :year
  AND o.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
  AND COALESCE(o.pending_step, 0) = 0
  AND (o.submit_applying_at IS NULL OR o.finish_approve_at IS NOT NULL)
GROUP BY
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE d.name
  END
ORDER BY annual_total_amount DESC`,
    parameterSchema: [
      {
        key: 'year',
        label: '统计年份',
        type: 'number',
        required: true,
        defaultValue: 2026,
      },
    ],
    renderConfig: {
      primaryViewType: 'BAR_CHART',
      primaryTitle: '2026 团队新增商机年度合计',
      chartDimensionKey: 'team_name',
      chartMetricKey: 'annual_total_amount',
      tableColumns: [
        { key: 'team_name', label: '团队', width: 180 },
        { key: 'jan_amount', label: '1月', width: 110 },
        { key: 'feb_amount', label: '2月', width: 110 },
        { key: 'mar_amount', label: '3月', width: 110 },
        { key: 'apr_amount', label: '4月', width: 110 },
        { key: 'may_amount', label: '5月', width: 110 },
        { key: 'jun_amount', label: '6月', width: 110 },
        { key: 'jul_amount', label: '7月', width: 110 },
        { key: 'aug_amount', label: '8月', width: 110 },
        { key: 'sep_amount', label: '9月', width: 110 },
        { key: 'oct_amount', label: '10月', width: 110 },
        { key: 'nov_amount', label: '11月', width: 110 },
        { key: 'dec_amount', label: '12月', width: 110 },
        { key: 'annual_total_amount', label: '全年合计（万元）', width: 160 },
      ],
      metricFields: [
        { key: 'annual_total_amount', label: '全年新增商机金额' },
      ],
      moduleHeight: 420,
    },
    displayOrder: 1,
    clickCount7d: 42,
    hitRatePercent: 92.4,
  }),
  createDefaultQueryTemplate({
    id: 'tpl_company_weekly_new_opportunity',
    name: '近一周新增商机明细',
    description:
      '查看近 7 天新增商机明细、负责人、销售阶段、预计签单日期和预计有效收入，便于快速跟进新增机会。',
    defaultQuestionText: '近一周新增商机明细',
    defaultFilters: {
      days: 7,
      metricScope: 'new_opportunity_detail',
      sortBy: 'created_at_desc',
    },
    defaultViewType: 'DETAIL_TABLE',
    sqlText: `SELECT
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE d.name
  END AS team_name,
  cu.name AS customer_name,
  fv_customer.VALUE AS customer_level,
  ca_customer_category.text_asset AS customer_category,
  oa_opportunity_code.text_asset AS opportunity_code,
  o.title AS project_name,
  ROUND(COALESCE(o.expect_amount, 0) / 10000, 2) AS expected_amount,
  DATE_FORMAT(o.created_at, '%Y-%m-%d') AS created_at,
  DATE_FORMAT(o.expect_sign_date, '%Y-%m-%d') AS expected_sign_date,
  fv_stage.VALUE AS stage_name,
  CASE WHEN oa_commitment.text_asset = 'sel_0cae' THEN '是' ELSE '否' END AS committed_flag,
  u.name AS owner_name,
  CASE WHEN oa_innovation.text_asset = 'sel_cdff' THEN '信创' ELSE '非信创' END AS innovation_flag,
  CASE
    WHEN oa_implementation.text_asset = 'sel_40fc' THEN '我方'
    WHEN oa_implementation.text_asset = 'sel_d8e0' THEN '维保'
    WHEN oa_implementation.text_asset = 'sel_944b' THEN '甲方'
    ELSE ''
  END AS implementation_party,
  fv_kind.VALUE AS project_type,
  oa_product_solution.text_asset AS product_solution,
  DATEDIFF(NOW(), o.updated_at) AS idle_days,
  DATE_FORMAT(o.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
FROM opportunities o
LEFT JOIN customers cu ON o.customer_id = cu.id
LEFT JOIN users u ON o.user_id = u.id
LEFT JOIN departments d ON o.department_id = d.id
LEFT JOIN field_values fv_customer ON fv_customer.id = cu.category
LEFT JOIN customer_assets ca_customer_category
  ON ca_customer_category.entity_id = cu.id
 AND ca_customer_category.custom_field_name = 'text_asset_e553a7'
LEFT JOIN opportunity_assets oa_opportunity_code
  ON oa_opportunity_code.entity_id = o.id
 AND oa_opportunity_code.custom_field_name = 'text_asset_3d89d6'
LEFT JOIN field_values fv_stage ON fv_stage.id = o.stage
LEFT JOIN opportunity_assets oa_commitment
  ON oa_commitment.entity_id = o.id
 AND oa_commitment.custom_field_name = 'text_asset_96585a'
LEFT JOIN opportunity_assets oa_innovation
  ON oa_innovation.entity_id = o.id
 AND oa_innovation.custom_field_name = 'text_asset_0fba36'
LEFT JOIN opportunity_assets oa_implementation
  ON oa_implementation.entity_id = o.id
 AND oa_implementation.custom_field_name = 'text_asset_cfd87c'
LEFT JOIN field_values fv_kind ON fv_kind.id = o.kind
LEFT JOIN opportunity_assets oa_product_solution
  ON oa_product_solution.entity_id = o.id
 AND oa_product_solution.custom_field_name = 'text_asset_cd11ac'
WHERE
  o.created_at >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
  AND o.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
  AND COALESCE(o.pending_step, 0) = 0
  AND (o.submit_applying_at IS NULL OR o.finish_approve_at IS NOT NULL)
  AND (fv_stage.VALUE IS NULL OR fv_stage.VALUE NOT IN ('输单', '输单（项目取消）', '1%已联系上客户', '赢单'))
ORDER BY o.created_at DESC
LIMIT 50`,
    parameterSchema: [
      {
        key: 'days',
        label: '最近天数',
        type: 'number',
        required: true,
        defaultValue: 7,
      },
    ],
    renderConfig: {
      primaryViewType: 'TABLE',
      primaryTitle: '近一周新增商机明细',
      tableColumns: [
        { key: 'team_name', label: '团队', width: 180 },
        { key: 'customer_name', label: '最终客户', width: 180 },
        { key: 'customer_level', label: '客户级别', width: 120 },
        { key: 'customer_category', label: '客户分类', width: 140 },
        { key: 'opportunity_code', label: '商机编号', width: 140 },
        { key: 'project_name', label: '项目名称', width: 220 },
        { key: 'stage_name', label: '销售阶段', width: 150 },
        { key: 'committed_flag', label: '承诺签约', width: 110 },
        { key: 'owner_name', label: '负责人', width: 120 },
        { key: 'expected_amount', label: '预计有效收入（万元）', width: 160 },
        { key: 'created_at', label: '创建时间', width: 160 },
        { key: 'expected_sign_date', label: '预计签单日期', width: 160 },
        { key: 'innovation_flag', label: '信创项目', width: 110 },
        { key: 'implementation_party', label: '实施方', width: 110 },
        { key: 'project_type', label: '项目类别', width: 130 },
        { key: 'product_solution', label: '产品解决方案', width: 220 },
        { key: 'idle_days', label: '距上次更新(天)', width: 130 },
        { key: 'updated_at', label: '最后更新时间', width: 180 },
      ],
      metricFields: [
        { key: 'total_count', label: '新增商机数' },
        { key: 'total_amount', label: '新增金额' },
      ],
      moduleHeight: 420,
    },
    displayOrder: 2,
    clickCount7d: 35,
    hitRatePercent: 89.1,
  }),
  createDefaultQueryTemplate({
    id: 'tpl_company_year_completion_snapshot',
    name: '全年完成预测总览',
    description:
      '汇总全年有效收入、承诺商机、季度承诺商机和全年完成预测，便于快速判断年度目标达成空间。',
    defaultQuestionText: '今年全年完成预测总览',
    defaultFilters: {
      year: 2026,
      metricScope: 'completion_forecast_summary',
      granularity: 'quarter',
      committedOnly: true,
    },
    defaultViewType: 'DETAIL_TABLE',
    sqlText: `SELECT
  :year AS year_label,
  COALESCE(contract_snapshot.valid_income, 0) AS valid_income,
  COALESCE(committed_snapshot.committed_amount, 0) AS committed_amount,
  COALESCE(committed_snapshot.q1_committed_amount, 0) AS q1_committed_amount,
  COALESCE(committed_snapshot.q2_committed_amount, 0) AS q2_committed_amount,
  COALESCE(committed_snapshot.q3_committed_amount, 0) AS q3_committed_amount,
  COALESCE(committed_snapshot.q4_committed_amount, 0) AS q4_committed_amount,
  ROUND(COALESCE(contract_snapshot.valid_income, 0) + COALESCE(committed_snapshot.committed_amount, 0), 2) AS annual_forecast
FROM (
  SELECT
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') THEN o.expect_amount ELSE 0 END) / 10000, 2) AS committed_amount,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') AND QUARTER(o.expect_sign_date) = 1 THEN o.expect_amount ELSE 0 END) / 10000, 2) AS q1_committed_amount,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') AND QUARTER(o.expect_sign_date) = 2 THEN o.expect_amount ELSE 0 END) / 10000, 2) AS q2_committed_amount,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') AND QUARTER(o.expect_sign_date) = 3 THEN o.expect_amount ELSE 0 END) / 10000, 2) AS q3_committed_amount,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') AND QUARTER(o.expect_sign_date) = 4 THEN o.expect_amount ELSE 0 END) / 10000, 2) AS q4_committed_amount
  FROM opportunities o
  LEFT JOIN field_values fv_stage ON fv_stage.id = o.stage
  LEFT JOIN opportunity_assets oa_commitment
    ON oa_commitment.entity_id = o.id
   AND oa_commitment.custom_field_name = 'text_asset_96585a'
  WHERE
    YEAR(o.expect_sign_date) = :year
    AND o.organization_id IN (:scopeOrganizationIds)
    AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
    AND COALESCE(o.pending_step, 0) = 0
    AND (o.submit_applying_at IS NULL OR o.finish_approve_at IS NOT NULL)
    AND (fv_stage.VALUE IS NULL OR fv_stage.VALUE NOT IN ('输单', '输单（项目取消）', '1%已联系上客户'))
    AND (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单')
) committed_snapshot
CROSS JOIN (
  SELECT ROUND(SUM(COALESCE(ca_valid_income.numeric_asset, 0)) / 10000, 2) AS valid_income
  FROM contracts co
  LEFT JOIN contract_assets ca_valid_income
    ON ca_valid_income.entity_id = co.id
   AND ca_valid_income.custom_field_name = 'numeric_asset_7ee237'
  WHERE YEAR(co.sign_date) = :year
    AND co.organization_id IN (:scopeOrganizationIds)
    AND (:scopeUnrestricted = 1 OR co.department_id IN (:scopeDepartmentIds) OR co.user_id IN (:scopeOwnerIds))
    AND COALESCE(co.pending_step, 0) = 0
    AND (co.submit_applying_at IS NULL OR co.finish_approve_at IS NOT NULL)
) contract_snapshot`,
    parameterSchema: [
      {
        key: 'year',
        label: '统计年份',
        type: 'number',
        required: true,
        defaultValue: 2026,
      },
    ],
    renderConfig: {
      primaryViewType: 'TABLE',
      primaryTitle: '全年完成预测总览',
      tableColumns: [
        { key: 'year_label', label: '年份', width: 100 },
        { key: 'valid_income', label: '有效收入（万元）', width: 160 },
        { key: 'committed_amount', label: '承诺商机（万元）', width: 160 },
        { key: 'q1_committed_amount', label: 'Q1 承诺商机', width: 150 },
        { key: 'q2_committed_amount', label: 'Q2 承诺商机', width: 150 },
        { key: 'q3_committed_amount', label: 'Q3 承诺商机', width: 150 },
        { key: 'q4_committed_amount', label: 'Q4 承诺商机', width: 150 },
        { key: 'annual_forecast', label: '全年完成预测', width: 160 },
      ],
      metricFields: [
        { key: 'valid_income', label: '有效收入' },
        { key: 'committed_amount', label: '承诺商机' },
        { key: 'annual_forecast', label: '全年完成预测' },
      ],
      moduleHeight: 360,
    },
    displayOrder: 3,
    clickCount7d: 18,
    hitRatePercent: 84.2,
  }),
  createDefaultQueryTemplate({
    id: 'tpl_company_2026_completion',
    name: '2026 各团队完成预测',
    description:
      '按团队查看全年目标、当前有效收入、承诺商机、全年预测和完成率预测，便于识别达成压力与重点团队。',
    defaultQuestionText: '2026 各团队完成预测',
    defaultFilters: {
      year: 2026,
      groupBy: 'team',
      metricScope: 'team_completion_forecast',
    },
    defaultViewType: 'BAR_CHART',
    sqlText: `SELECT
  tt.team_name,
  tt.annual_target,
  COALESCE(ci.contract_count, 0) AS contract_count,
  COALESCE(ci.valid_income, 0) AS valid_income,
  COALESCE(ci.contract_amount, 0) AS contract_amount,
  COALESCE(oc.committed_amount, 0) AS committed_amount,
  COALESCE(oc.q1_committed_amount, 0) AS q1_committed_amount,
  COALESCE(oc.q2_committed_amount, 0) AS q2_committed_amount,
  COALESCE(oc.q3_committed_amount, 0) AS q3_committed_amount,
  COALESCE(oc.q4_committed_amount, 0) AS q4_committed_amount,
  ROUND(COALESCE(ci.valid_income, 0) + COALESCE(oc.committed_amount, 0), 2) AS annual_forecast,
  ROUND((COALESCE(ci.valid_income, 0) + COALESCE(oc.committed_amount, 0)) / NULLIF(tt.annual_target, 0) * 100, 2) AS completion_rate
FROM (
  SELECT '大东区-上海区（非金）' AS team_name, 2500 AS annual_target UNION ALL
  SELECT '大东区-东区金融部', 3700 UNION ALL
  SELECT '大东区-安徽区', 1000 UNION ALL
  SELECT '大东区-江苏区', 2850 UNION ALL
  SELECT '大东区-浙赣区', 2300 UNION ALL
  SELECT '大北区-东北区', 800 UNION ALL
  SELECT '大北区-北区金融部', 6000 UNION ALL
  SELECT '大北区-北区（政府企业）', 3100 UNION ALL
  SELECT '大北区-山东区', 2100 UNION ALL
  SELECT '大北区-晋冀区', 1500 UNION ALL
  SELECT '大北区-河南区', 500 UNION ALL
  SELECT '大南区-南区金融部', 4800 UNION ALL
  SELECT '大南区-广州实验特区', 2500 UNION ALL
  SELECT '大南区-深圳区', 4600 UNION ALL
  SELECT '大南区-湖北区', 1450 UNION ALL
  SELECT '大南区-湖南区', 1100 UNION ALL
  SELECT '西区', 3200
) tt
LEFT JOIN (
  SELECT
    CASE
      WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
      WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
      WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
        SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
        '-',
        SUBSTRING(
          d.name,
          LOCATE('-', d.name) + 1,
          LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
        )
      )
      ELSE d.name
    END AS team_name,
    COUNT(DISTINCT co.id) AS contract_count,
    ROUND(SUM(COALESCE(co.total_amount, 0)) / 10000, 2) AS contract_amount,
    ROUND(SUM(COALESCE(ca_valid_income.numeric_asset, 0)) / 10000, 2) AS valid_income
  FROM contracts co
  LEFT JOIN customers cu ON co.customer_id = cu.id
  LEFT JOIN departments d ON co.department_id = d.id
  LEFT JOIN contract_assets ca_valid_income
    ON ca_valid_income.entity_id = co.id
   AND ca_valid_income.custom_field_name = 'numeric_asset_7ee237'
  WHERE YEAR(co.sign_date) = :year
    AND co.organization_id IN (:scopeOrganizationIds)
    AND (:scopeUnrestricted = 1 OR co.department_id IN (:scopeDepartmentIds) OR co.user_id IN (:scopeOwnerIds))
    AND COALESCE(co.pending_step, 0) = 0
    AND (co.submit_applying_at IS NULL OR co.finish_approve_at IS NOT NULL)
  GROUP BY
    CASE
      WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
      WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
      WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
        SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
        '-',
        SUBSTRING(
          d.name,
          LOCATE('-', d.name) + 1,
          LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
        )
      )
      ELSE d.name
    END
) ci ON ci.team_name = tt.team_name
LEFT JOIN (
  SELECT
    CASE
      WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
      WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
      WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
        SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
        '-',
        SUBSTRING(
          d.name,
          LOCATE('-', d.name) + 1,
          LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
        )
      )
      ELSE d.name
    END AS team_name,
    COUNT(DISTINCT o.id) AS opportunity_count,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') THEN o.expect_amount ELSE 0 END) / 10000, 2) AS committed_amount,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') AND QUARTER(o.expect_sign_date) = 1 THEN o.expect_amount ELSE 0 END) / 10000, 2) AS q1_committed_amount,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') AND QUARTER(o.expect_sign_date) = 2 THEN o.expect_amount ELSE 0 END) / 10000, 2) AS q2_committed_amount,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') AND QUARTER(o.expect_sign_date) = 3 THEN o.expect_amount ELSE 0 END) / 10000, 2) AS q3_committed_amount,
    ROUND(SUM(CASE WHEN (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单') AND QUARTER(o.expect_sign_date) = 4 THEN o.expect_amount ELSE 0 END) / 10000, 2) AS q4_committed_amount
  FROM opportunities o
  LEFT JOIN customers cu ON o.customer_id = cu.id
  LEFT JOIN departments d ON o.department_id = d.id
  LEFT JOIN field_values fv_stage ON fv_stage.id = o.stage
  LEFT JOIN opportunity_assets oa_commitment
    ON oa_commitment.entity_id = o.id
   AND oa_commitment.custom_field_name = 'text_asset_96585a'
  WHERE
    YEAR(o.expect_sign_date) = :year
    AND o.organization_id IN (:scopeOrganizationIds)
    AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
    AND COALESCE(o.pending_step, 0) = 0
    AND (o.submit_applying_at IS NULL OR o.finish_approve_at IS NOT NULL)
    AND (fv_stage.VALUE IS NULL OR fv_stage.VALUE NOT IN ('输单', '输单（项目取消）', '1%已联系上客户'))
    AND (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单')
  GROUP BY
    CASE
      WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
      WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
      WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
        SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
        '-',
        SUBSTRING(
          d.name,
          LOCATE('-', d.name) + 1,
          LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
        )
      )
      ELSE d.name
    END
) oc ON oc.team_name = tt.team_name
WHERE
  :scopeUnrestricted = 1
  OR COALESCE(ci.contract_count, 0) > 0
  OR COALESCE(oc.opportunity_count, 0) > 0
ORDER BY completion_rate DESC, annual_forecast DESC, tt.team_name ASC`,
    parameterSchema: [
      {
        key: 'year',
        label: '统计年份',
        type: 'number',
        required: true,
        defaultValue: 2026,
      },
    ],
    renderConfig: {
      primaryViewType: 'BAR_CHART',
      primaryTitle: '2026 各团队完成率预测',
      chartDimensionKey: 'team_name',
      chartMetricKey: 'completion_rate',
      tableColumns: [
        { key: 'team_name', label: '团队', width: 180 },
        { key: 'annual_target', label: '全年目标', width: 140 },
        { key: 'contract_count', label: '合同数量', width: 120 },
        { key: 'valid_income', label: '有效收入', width: 140 },
        { key: 'contract_amount', label: '合同额', width: 140 },
        { key: 'committed_amount', label: '承诺商机', width: 140 },
        { key: 'q1_committed_amount', label: 'Q1 承诺商机', width: 140 },
        { key: 'q2_committed_amount', label: 'Q2 承诺商机', width: 140 },
        { key: 'q3_committed_amount', label: 'Q3 承诺商机', width: 140 },
        { key: 'q4_committed_amount', label: 'Q4 承诺商机', width: 140 },
        { key: 'annual_forecast', label: '全年预测', width: 140 },
        { key: 'completion_rate', label: '完成率预测（%）', width: 150 },
      ],
      metricFields: [
        { key: 'annual_target', label: '全年目标' },
        { key: 'valid_income', label: '当前有效收入' },
        { key: 'annual_forecast', label: '全年预测' },
      ],
      moduleHeight: 420,
    },
    displayOrder: 4,
    clickCount7d: 28,
    hitRatePercent: 90.6,
  }),
  createDefaultQueryTemplate({
    id: 'tpl_company_contract_effective_income_trend',
    name: '提单合同与有效收入趋势',
    description:
      '查看近四年合同金额、未回款金额和有效收入的季度趋势，便于判断提单质量与收入确认变化。',
    defaultQuestionText: '近四年提单合同与有效收入趋势',
    defaultFilters: {
      recentYears: 4,
      granularity: 'quarter',
      metricScope: 'contract_income_trend',
    },
    defaultViewType: 'BAR_CHART',
    sqlText: `SELECT
  CONCAT(YEAR(co.sign_date), 'Q', QUARTER(co.sign_date)) AS quarter_label,
  ROUND(SUM(COALESCE(co.total_amount, 0)) / 10000, 2) AS contract_amount,
  ROUND(SUM(COALESCE(co.unreceived_amount, 0)) / 10000, 2) AS unreceived_amount,
  ROUND(SUM(COALESCE(cvi.valid_income, 0)), 2) AS valid_income
FROM contracts co
LEFT JOIN (
  SELECT
    entity_id AS contract_id,
    SUM(COALESCE(numeric_asset, 0)) / 10000 AS valid_income
  FROM contract_assets
  WHERE custom_field_name = 'numeric_asset_7ee237'
  GROUP BY entity_id
) cvi ON cvi.contract_id = co.id
WHERE co.sign_date >= DATE_SUB(CURDATE(), INTERVAL :recentYears YEAR)
  AND co.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR co.department_id IN (:scopeDepartmentIds) OR co.user_id IN (:scopeOwnerIds))
  AND COALESCE(co.pending_step, 0) = 0
  AND (co.submit_applying_at IS NULL OR co.finish_approve_at IS NOT NULL)
GROUP BY CONCAT(YEAR(co.sign_date), 'Q', QUARTER(co.sign_date))
ORDER BY quarter_label ASC`,
    parameterSchema: [
      {
        key: 'recentYears',
        label: '最近年数',
        type: 'number',
        required: true,
        defaultValue: 4,
      },
    ],
    renderConfig: {
      primaryViewType: 'BAR_CHART',
      primaryTitle: '提单合同与有效收入趋势',
      chartDimensionKey: 'quarter_label',
      chartMetricKey: 'valid_income',
      tableColumns: [
        { key: 'quarter_label', label: '季度', width: 120 },
        { key: 'contract_amount', label: '合同金额（万元）', width: 160 },
        { key: 'unreceived_amount', label: '未回款（万元）', width: 150 },
        { key: 'valid_income', label: '有效收入（万元）', width: 150 },
      ],
      moduleHeight: 400,
    },
    displayOrder: 5,
    clickCount7d: 14,
    hitRatePercent: 82.5,
  }),
  createDefaultQueryTemplate({
    id: 'tpl_company_ten_percent_opportunity_trend',
    name: '10%+ 商机新增趋势',
    description:
      '查看近四年签单可能性不低于 10% 的新增商机金额季度趋势，便于观察有效机会储备变化。',
    defaultQuestionText: '近四年 10% 以上商机新增趋势',
    defaultFilters: {
      recentYears: 4,
      probabilityFloor: 10,
      granularity: 'quarter',
      metricScope: 'high_probability_opportunity',
    },
    defaultViewType: 'BAR_CHART',
    sqlText: `SELECT
  CONCAT(YEAR(o.created_at), 'Q', QUARTER(o.created_at)) AS quarter_label,
  ROUND(SUM(COALESCE(o.expect_amount, 0)) / 10000, 2) AS opportunity_amount
FROM opportunities o
LEFT JOIN customers cu ON o.customer_id = cu.id
WHERE
  o.created_at >= DATE_SUB(NOW(), INTERVAL :recentYears YEAR)
  AND o.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
  AND COALESCE(o.pending_step, 0) = 0
  AND (o.submit_applying_at IS NULL OR o.finish_approve_at IS NOT NULL)
  AND COALESCE(o.sign_possibility, 0) >= :probabilityFloor
GROUP BY CONCAT(YEAR(o.created_at), 'Q', QUARTER(o.created_at))
ORDER BY quarter_label ASC`,
    parameterSchema: [
      {
        key: 'recentYears',
        label: '最近年数',
        type: 'number',
        required: true,
        defaultValue: 4,
      },
      {
        key: 'probabilityFloor',
        label: '最低签单可能性',
        type: 'number',
        required: true,
        defaultValue: 10,
      },
    ],
    renderConfig: {
      primaryViewType: 'BAR_CHART',
      primaryTitle: '10%+ 商机新增趋势',
      chartDimensionKey: 'quarter_label',
      chartMetricKey: 'opportunity_amount',
      tableColumns: [
        { key: 'quarter_label', label: '季度', width: 120 },
        { key: 'opportunity_amount', label: '新增商机金额（万元）', width: 180 },
      ],
      moduleHeight: 380,
    },
    displayOrder: 6,
    clickCount7d: 11,
    hitRatePercent: 80.4,
  }),
  createDefaultQueryTemplate({
    id: 'tpl_company_committed_opportunity_summary',
    name: '承诺商机季度拆分',
    description:
      '按团队查看承诺商机金额、季度拆分、商机总额和商机数量，便于评估各团队可落地机会结构。',
    defaultQuestionText: '2026 各团队承诺商机季度拆分',
    defaultFilters: {
      year: 2026,
      committedOnly: true,
      excludeLoseStages: true,
      groupBy: 'team',
    },
    defaultViewType: 'RANKING_TABLE',
    sqlText: `SELECT
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE d.name
  END AS team_name,
  ROUND(SUM(COALESCE(o.expect_amount, 0)) / 10000, 2) AS committed_amount,
  ROUND(SUM(CASE WHEN QUARTER(o.expect_sign_date) = 1 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS q1_committed_amount,
  ROUND(SUM(CASE WHEN QUARTER(o.expect_sign_date) = 2 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS q2_committed_amount,
  ROUND(SUM(CASE WHEN QUARTER(o.expect_sign_date) = 3 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS q3_committed_amount,
  ROUND(SUM(CASE WHEN QUARTER(o.expect_sign_date) = 4 THEN COALESCE(o.expect_amount, 0) ELSE 0 END) / 10000, 2) AS q4_committed_amount,
  ROUND(SUM(COALESCE(o.expect_amount, 0)) / 10000, 2) AS total_opportunity_amount,
  COUNT(DISTINCT o.id) AS opportunity_count
FROM opportunities o
LEFT JOIN customers cu ON o.customer_id = cu.id
LEFT JOIN departments d ON o.department_id = d.id
LEFT JOIN field_values fv_stage ON fv_stage.id = o.stage
LEFT JOIN opportunity_assets oa_commitment
  ON oa_commitment.entity_id = o.id
 AND oa_commitment.custom_field_name = 'text_asset_96585a'
WHERE
  YEAR(o.expect_sign_date) = :year
  AND o.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
  AND COALESCE(o.pending_step, 0) = 0
  AND (o.submit_applying_at IS NULL OR o.finish_approve_at IS NOT NULL)
  AND (fv_stage.VALUE IS NULL OR fv_stage.VALUE NOT IN ('输单', '输单（项目取消）', '1%已联系上客户'))
  AND (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单')
GROUP BY
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE d.name
  END
ORDER BY committed_amount DESC, total_opportunity_amount DESC`,
    parameterSchema: [
      {
        key: 'year',
        label: '统计年份',
        type: 'number',
        required: true,
        defaultValue: 2026,
      },
    ],
    renderConfig: {
      primaryViewType: 'RANKING_TABLE',
      primaryTitle: '承诺商机季度拆分',
      chartDimensionKey: 'team_name',
      chartMetricKey: 'committed_amount',
      tableColumns: [
        { key: 'team_name', label: '团队', width: 180 },
        { key: 'committed_amount', label: '承诺商机（万元）', width: 160 },
        { key: 'q1_committed_amount', label: 'Q1 承诺商机', width: 150 },
        { key: 'q2_committed_amount', label: 'Q2 承诺商机', width: 150 },
        { key: 'q3_committed_amount', label: 'Q3 承诺商机', width: 150 },
        { key: 'q4_committed_amount', label: 'Q4 承诺商机', width: 150 },
        { key: 'total_opportunity_amount', label: '商机总额（万元）', width: 160 },
        { key: 'opportunity_count', label: '商机总数', width: 120 },
      ],
      metricFields: [
        { key: 'committed_amount', label: '承诺商机' },
        { key: 'total_opportunity_amount', label: '商机总额' },
      ],
      moduleHeight: 420,
    },
    displayOrder: 7,
    clickCount7d: 9,
    hitRatePercent: 79.8,
  }),
  createDefaultQueryTemplate({
    id: 'tpl_company_valuable_customer_contract_history',
    name: '价值客户历史提单趋势',
    description:
      '按年度查看价值客户合同数、合同总额和有效收入，便于评估重点客户的历史贡献和变化趋势。',
    defaultQuestionText: '价值客户历史提单趋势',
    defaultFilters: {
      groupBy: 'year',
      metricScope: 'valuable_customer_contract_history',
    },
    defaultViewType: 'BAR_CHART',
    sqlText: `SELECT
  YEAR(co.sign_date) AS year_label,
  COUNT(*) AS contract_count,
  ROUND(SUM(COALESCE(co.total_amount, 0)) / 10000, 2) AS contract_amount,
  ROUND(SUM(COALESCE(cvi.valid_income, 0)), 2) AS valid_income
FROM contracts co
LEFT JOIN (
  SELECT
    entity_id AS contract_id,
    SUM(COALESCE(numeric_asset, 0)) / 10000 AS valid_income
  FROM contract_assets
  WHERE custom_field_name = 'numeric_asset_7ee237'
  GROUP BY entity_id
) cvi ON cvi.contract_id = co.id
WHERE
  co.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR co.department_id IN (:scopeDepartmentIds) OR co.user_id IN (:scopeOwnerIds))
  AND COALESCE(co.pending_step, 0) = 0
  AND (co.submit_applying_at IS NULL OR co.finish_approve_at IS NOT NULL)
GROUP BY YEAR(co.sign_date)
ORDER BY year_label ASC`,
    renderConfig: {
      primaryViewType: 'BAR_CHART',
      primaryTitle: '价值客户历史提单趋势',
      chartDimensionKey: 'year_label',
      chartMetricKey: 'contract_amount',
      tableColumns: [
        { key: 'year_label', label: '年份', width: 100 },
        { key: 'contract_count', label: '合同数', width: 120 },
        { key: 'contract_amount', label: '合同总额（万元）', width: 160 },
        { key: 'valid_income', label: '有效收入（万元）', width: 160 },
      ],
      moduleHeight: 380,
    },
    displayOrder: 8,
    clickCount7d: 7,
    hitRatePercent: 76.2,
  }),
  createDefaultQueryTemplate({
    id: 'tpl_company_customer_contract_dimension',
    name: '客户维度提单数据',
    description:
      '按客户查看归属部门、客户级别、合同数量、合同金额和有效收入，便于定位高价值客户和提单结构。',
    defaultQuestionText: '客户维度提单数据',
    defaultFilters: {
      groupBy: 'customer',
      includeValidIncome: true,
      includeCustomerLevel: true,
      sortBy: 'contract_amount_desc',
    },
    defaultViewType: 'DETAIL_TABLE',
    sqlText: `SELECT
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE COALESCE(d.name, '未归属部门')
  END AS department_name,
  COALESCE(cu.name, '未知客户') AS customer_name,
  COALESCE(cl.customer_level, '未定义') AS customer_level,
  COALESCE(c201.branch_201_flag, 0) AS branch_201_flag,
  COALESCE(cc.customer_category, '未分类') AS customer_category,
  COUNT(DISTINCT co.id) AS contract_count,
  ROUND(SUM(COALESCE(co.total_amount, 0)) / 10000, 2) AS contract_amount,
  ROUND(SUM(COALESCE(cvi.valid_income, 0)), 2) AS valid_income,
  ROUND(SUM(CASE WHEN YEAR(co.sign_date) = 2026 THEN COALESCE(co.total_amount, 0) ELSE 0 END) / 10000, 2) AS amount_2026,
  ROUND(SUM(CASE WHEN YEAR(co.sign_date) = 2025 THEN COALESCE(co.total_amount, 0) ELSE 0 END) / 10000, 2) AS amount_2025,
  ROUND(SUM(CASE WHEN YEAR(co.sign_date) = 2024 THEN COALESCE(co.total_amount, 0) ELSE 0 END) / 10000, 2) AS amount_2024,
  ROUND(SUM(CASE WHEN YEAR(co.sign_date) = 2023 THEN COALESCE(co.total_amount, 0) ELSE 0 END) / 10000, 2) AS amount_2023
FROM contracts co
LEFT JOIN customers cu ON cu.id = co.customer_id
LEFT JOIN departments d ON cu.department_id = d.id
LEFT JOIN (
  SELECT
    entity_id AS contract_id,
    SUM(COALESCE(numeric_asset, 0)) / 10000 AS valid_income
  FROM contract_assets
  WHERE custom_field_name = 'numeric_asset_7ee237'
  GROUP BY entity_id
) cvi ON cvi.contract_id = co.id
LEFT JOIN (
  SELECT id AS category_id, VALUE AS customer_level
  FROM field_values
) cl ON cu.category = cl.category_id
LEFT JOIN (
  SELECT entity_id AS customer_id, text_asset AS customer_category
  FROM customer_assets
  WHERE custom_field_name = 'text_asset_e553a7'
) cc ON cu.id = cc.customer_id
LEFT JOIN (
  SELECT DISTINCT entity_id AS customer_id, 1 AS branch_201_flag
  FROM customer_assets
  WHERE text_asset = 'sel_0b5b'
) c201 ON cu.id = c201.customer_id
WHERE co.sign_date IS NOT NULL
  AND co.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR co.department_id IN (:scopeDepartmentIds) OR co.user_id IN (:scopeOwnerIds))
  AND COALESCE(co.pending_step, 0) = 0
  AND (co.submit_applying_at IS NULL OR co.finish_approve_at IS NOT NULL)
GROUP BY
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE COALESCE(d.name, '未归属部门')
  END,
  COALESCE(cu.name, '未知客户'),
  COALESCE(cl.customer_level, '未定义'),
  COALESCE(c201.branch_201_flag, 0),
  COALESCE(cc.customer_category, '未分类')
ORDER BY contract_amount DESC, customer_name ASC`,
    renderConfig: {
      primaryViewType: 'TABLE',
      primaryTitle: '客户维度提单数据',
      tableColumns: [
        { key: 'department_name', label: '所属部门', width: 180 },
        { key: 'customer_name', label: '最终客户', width: 200 },
        { key: 'customer_level', label: '客户级别', width: 140 },
        { key: 'branch_201_flag', label: '201分支', width: 110 },
        { key: 'customer_category', label: '客户分类', width: 140 },
        { key: 'contract_count', label: '合同数量', width: 120 },
        { key: 'contract_amount', label: '合同总额（万元）', width: 160 },
        { key: 'valid_income', label: '有效收入（万元）', width: 160 },
        { key: 'amount_2026', label: '2026年', width: 120 },
        { key: 'amount_2025', label: '2025年', width: 120 },
        { key: 'amount_2024', label: '2024年', width: 120 },
        { key: 'amount_2023', label: '2023年', width: 120 },
      ],
      metricFields: [
        { key: 'contract_count', label: '合同数量' },
        { key: 'contract_amount', label: '合同总额' },
        { key: 'valid_income', label: '有效收入' },
      ],
      moduleHeight: 420,
    },
    displayOrder: 9,
    clickCount7d: 6,
    hitRatePercent: 75.5,
  }),
];

const DEFAULT_ACCESS_POLICY_WHITELIST = mergeLianruanOpenApiAccessPolicySupplement({
  allowedTables: [
    'opportunities',
    'contracts',
    'customers',
    'users',
    'departments',
    'partners',
    'field_values',
    'customer_assets',
    'opportunity_assets',
    'contract_assets',
    'revisit_logs',
  ],
  allowedFields: {
    opportunities: [
      'id',
      'title',
      'stage',
      'organization_id',
      'department_id',
      'user_id',
      'partner_id',
      'expect_amount',
      'created_at',
      'pending_step',
      'submit_applying_at',
      'finish_approve_at',
    ],
    contracts: [
      'id',
      'title',
      'status',
      'organization_id',
      'department_id',
      'user_id',
      'partner_id',
      'total_amount',
      'unreceived_amount',
      'sign_date',
      'created_at',
      'approve_status',
      'pending_step',
      'submit_applying_at',
      'finish_approve_at',
    ],
    customers: ['id', 'name', 'category', 'organization_id', 'department_id', 'created_at'],
    users: ['id', 'name', 'organization_id', 'role_id', 'status', 'usable'],
    departments: ['id', 'name'],
    partners: [
      'id',
      'name',
      'partnerLevel',
      'parentPartnerId',
      'parentPartnerIds',
      'region',
      'bigRegion',
      'status',
      'createdAt',
      'updatedAt',
    ],
    field_values: ['id', 'VALUE'],
    customer_assets: ['entity_id', 'custom_field_name', 'text_asset'],
    opportunity_assets: ['entity_id', 'custom_field_name', 'text_asset'],
    contract_assets: ['entity_id', 'custom_field_name', 'numeric_asset'],
    revisit_logs: ['loggable_id', 'loggable_type', 'real_revisit_at', 'content', 'user_id'],
  },
});

export const DEFAULT_ACCESS_POLICY: AccessPolicyRecord = {
  id: 'policy_current',
  enabledRoleIds: ['role_sales_director', 'role_region_manager', 'role_admin'],
  exportRoleIds: ['role_sales_director', 'role_admin'],
  enabledChannels: ['web-console', 'wecom-bot'],
  allowedDomains: [
    'opportunity-analysis',
    'contract-conversion',
    'customer-relationship',
  ],
  allowedTables: DEFAULT_ACCESS_POLICY_WHITELIST.allowedTables,
  allowedFields: DEFAULT_ACCESS_POLICY_WHITELIST.allowedFields,
  maskedFields: {
    customers: ['mobile', 'email'],
  },
  exportRowLimit: 1000,
  exportDailyLimit: 3,
  maxOnlineSessions: 200,
  maxConcurrentQueries: 50,
  heartbeatIntervalSeconds: 30,
  idleTimeoutSeconds: 120,
  historyRetentionDays: 30,
  status: 'ACTIVE',
  updatedBy: 'user_admin',
  updatedAt: '2026-03-24T10:00:00.000Z',
};

export const DEFAULT_ANALYSIS_SCOPE_POLICY: AnalysisScopePolicyRecord = {
  policyId: 'analysis_scope_policy_current',
  fullAccessUserIds: [],
  updatedBy: 'user_admin',
  updatedAt: '2026-05-12T12:00:00.000Z',
  changeReason: '初始化历史全量分析兼容配置。',
};

export const DEFAULT_APPLICATION_SUPER_ADMIN_POLICY: ApplicationSuperAdminPolicyRecord = {
  policyId: 'application_super_admin_policy_current',
  subjects: [],
  updatedBy: 'system',
  updatedAt: '2026-05-12T12:00:00.000Z',
  changeReason: '系统默认未开通应用超级管理员授权。',
};

export const DEFAULT_AI_CONTEXT_POLICY: AiContextPolicyRecord = {
  id: 'ai_context_policy_current',
  turnRetentionLimit: 8,
  historySummaryMaxLength: 600,
  latestQuestionMaxLength: 200,
  latestSummaryMaxLength: 800,
  analysisSessionIdleTimeoutSeconds: 1800,
  taskSessionIdleTimeoutSeconds: 7200,
  updatedBy: 'user_admin',
  updatedAt: '2026-03-24T10:00:00.000Z',
};

export const DEFAULT_LIANRUAN_CRM_CONNECTION_CONFIG = {
  id: 'lianruan_crm_standard_openapi' as const,
  useRuntimeConfig: false,
  enabled: true,
  timeoutMs: 12000,
  tokenCacheBufferSeconds: 60,
};

export const DEFAULT_WECOM_BOT_CONNECTION_CONFIG: WecomBotConnectionConfigRecord = {
  id: 'wecom_bot_connection',
  useRuntimeConfig: false,
  enabled: true,
  botTransportMode: 'mock',
  botWsUrl: 'wss://openws.work.weixin.qq.com',
  botMaxReconnectAttempts: 10,
  botHeartbeatIntervalMs: 30000,
  deliveryMaxRetries: 2,
  deliveryRetryDelayMs: 300,
  deliveryChunkMaxLength: 900,
  updatedBy: 'system',
  updatedAt: '2026-03-24T10:00:00.000Z',
};

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionRecord[] = [
  {
    roleId: 'role_sales_director',
    roleNameSnapshot: '销售总监',
    status: 'ACTIVE',
    visibleMenus: ['analysis-workbench', 'contract-review', 'management-report'],
    actionKeys: [
      'analysis.use',
      'analysis.follow_up',
      'analysis.export',
      'management.report.view',
      'management.report.export',
      'template.view',
      'wecom.analysis.use',
      'wecom.customer.create',
      'wecom.opportunity.create',
      'wecom.followup.writeback',
      'wecom.daily_report.preview',
      'contract.review.upload',
    ],
    webConsoleEnabled: true,
    wecomBotEligible: true,
    exportAllowed: true,
    templateManageAllowed: false,
    contractReviewUploadAllowed: true,
    contractReviewCrossViewAllowed: false,
    contractReviewCrossDownloadAllowed: false,
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
    changeReason: '默认开通销售总监分析、导出、企业微信创建/写回、日报预览和合同上传能力',
  },
  {
    roleId: 'role_region_manager',
    roleNameSnapshot: '区域经理',
    status: 'ACTIVE',
    visibleMenus: ['analysis-workbench', 'management-report'],
    actionKeys: [
      'analysis.use',
      'analysis.follow_up',
      'management.report.view',
      'template.view',
      'wecom.analysis.use',
      'wecom.daily_report.preview',
    ],
    webConsoleEnabled: true,
    wecomBotEligible: true,
    exportAllowed: false,
    templateManageAllowed: false,
    contractReviewUploadAllowed: false,
    contractReviewCrossViewAllowed: false,
    contractReviewCrossDownloadAllowed: false,
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
    changeReason: '默认开通区域经理分析、企业微信问数和日报预览能力',
  },
  {
    roleId: 'role_sales_vp',
    roleNameSnapshot: '销售副总',
    status: 'ACTIVE',
    visibleMenus: ['analysis-workbench', 'management-report'],
    actionKeys: [
      'analysis.use',
      'analysis.follow_up',
      'management.report.view',
      'template.view',
      'wecom.analysis.use',
      'wecom.daily_report.preview',
    ],
    webConsoleEnabled: true,
    wecomBotEligible: true,
    exportAllowed: false,
    templateManageAllowed: false,
    contractReviewUploadAllowed: false,
    contractReviewCrossViewAllowed: false,
    contractReviewCrossDownloadAllowed: false,
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
    changeReason: '默认开通销售副总分析、企业微信问数和日报预览能力',
  },
  {
    roleId: 'role_admin',
    roleNameSnapshot: '系统管理员',
    status: 'ACTIVE',
    visibleMenus: [
      'analysis-workbench',
      'contract-review',
      'management-report',
      'permission-center',
      'connection-policy',
      'audit-center',
      'ai-model-governance',
    ],
    actionKeys: [
      'analysis.use',
      'analysis.follow_up',
      'analysis.export',
      'management.report.view',
      'management.report.export',
      'template.view',
      'template.manage',
      'template.sql.write',
      'wecom.analysis.use',
      'wecom.customer.create',
      'wecom.opportunity.create',
      'wecom.followup.writeback',
      'wecom.daily_report.preview',
      'governance.policy.manage',
      'audit.view',
      'audit.sql.view',
      'audit.sql.view_sensitive',
      'ai_profile.manage',
      'contract.review.upload',
      'contract.review.cross_view',
      'contract.review.cross_download',
    ],
    webConsoleEnabled: true,
    wecomBotEligible: true,
    exportAllowed: true,
    templateManageAllowed: true,
    contractReviewUploadAllowed: true,
    contractReviewCrossViewAllowed: true,
    contractReviewCrossDownloadAllowed: true,
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
    changeReason: '首次部署默认向系统管理员开放全量权限，确保可直接完成权限配置',
  },
];

export const DEFAULT_WECOM_PILOT_POLICY: WecomPilotPolicyRecord = {
  channel: 'wecom-bot',
  mode: 'FULL',
  allowUserIds: [],
  allowRoleIds: [],
  allowDepartmentIds: [],
  denyUserIds: [],
  note: '默认全量开放给已具备企业微信入口资格的角色',
  updatedBy: 'user_admin',
  updatedAt: '2026-03-24T10:00:00.000Z',
};

export const DEFAULT_ANALYSIS_SEMANTIC_KNOWLEDGE_DRAFT_ASSETS = [
  {
    id: 'semantic_alias_contract_amount',
    type: 'ALIAS' as const,
    name: '签约金额别名',
    status: 'ACTIVE' as const,
    canonicalLabel: '转合同金额',
    synonyms: ['签约金额', '合同金额', '成交金额', '签单金额'],
    matchKeywords: ['签约金额', '合同金额', '成交金额', '签单金额'],
    hint: '签约金额 -> 转合同金额',
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
  },
  {
    id: 'semantic_alias_opportunity_amount',
    type: 'ALIAS' as const,
    name: '商机金额别名',
    status: 'ACTIVE' as const,
    canonicalLabel: '新增商机金额',
    synonyms: ['商机额', '机会金额', '商机金额'],
    matchKeywords: ['商机额', '机会金额', '商机金额'],
    hint: '商机额 -> 新增商机金额',
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
  },
  {
    id: 'semantic_temporal_opportunity',
    type: 'TEMPORAL_FIELD_HINT' as const,
    name: '商机时间口径',
    status: 'ACTIVE' as const,
    matchKeywords: ['商机', '机会', '漏斗', '新增商机金额', '赢单率'],
    hint: '商机新增默认使用 opportunities.created_at，可选口径需显式说明；不得使用 updated_at、deleted_at 或未白名单字段。',
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
  },
  {
    id: 'semantic_org_shandong',
    type: 'ORGANIZATION_NORMALIZATION' as const,
    name: '山东区归一提示',
    status: 'ACTIVE' as const,
    matchKeywords: ['山东区', '团队', '大区'],
    hint: '涉及山东区、团队、大区等组织表达时，必须优先使用已批准的组织别名和归一规则。',
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
  },
  {
    id: 'semantic_validated_owner_ranking',
    type: 'VALIDATED_EXAMPLE' as const,
    name: '新增商机金额排行',
    status: 'ACTIVE' as const,
    questionText: '本月各销售负责人新增商机金额排名',
    matchKeywords: ['本月', '销售负责人', '新增商机金额', '排名'],
    sqlHint: '优先从 opportunities 聚合 expect_amount，并按 users.name 分组后做 owner-ranking。',
    hint: '模板优先：若命中高频负责人排行问题，应优先复用已验证示例。',
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
  },
  {
    id: 'semantic_negative_raw_export',
    type: 'NEGATIVE_EXAMPLE' as const,
    name: '全量原始明细阻断',
    status: 'ACTIVE' as const,
    questionText: '帮我导出全部原始明细',
    matchKeywords: ['全部原始明细', '导出全部原始明细', '全量明细'],
    blockReason: '当前请求命中高风险问法样例，请缩小范围或改用受控导出入口。',
    hint: '当前请求命中高风险问法样例，请缩小范围或改用受控导出入口。',
    updatedBy: 'user_admin',
    updatedAt: '2026-03-24T10:00:00.000Z',
  },
];

export const DEFAULT_ANALYSIS_SEMANTIC_KNOWLEDGE_PUBLICATIONS = [
  {
    version: 'semantic-v1',
    changeSummary: '初始化默认问数语义资产。',
    assetCount: DEFAULT_ANALYSIS_SEMANTIC_KNOWLEDGE_DRAFT_ASSETS.length,
    publishedBy: 'user_admin',
    publishedAt: '2026-03-24T10:00:00.000Z',
    snapshot: DEFAULT_ANALYSIS_SEMANTIC_KNOWLEDGE_DRAFT_ASSETS.map((item) => ({
      ...item,
      matchKeywords: [...item.matchKeywords],
      synonyms: item.synonyms ? [...item.synonyms] : undefined,
    })),
  },
];

export const DEFAULT_RECENT_QUERIES: RecentQueryRecord[] = [
  {
    id: 'history_template_company_2026_completion',
    requesterId: 'user_sales_director',
    sourceRequestId: 'query_template_company_2026_completion',
    sourceType: 'TEMPLATE_QUERY',
    templateId: 'tpl_company_2026_completion',
    templateVersion: '2026.05.11',
    questionText: '2026 各团队完成预测',
    lastUsedChannel: 'web-console',
    lastUsedConditions: { year: 2026 },
    parameterSnapshot: { year: 2026 },
    renderSnapshot: {
      primaryViewType: 'BAR_CHART',
      primaryTitle: '2026 各团队完成率预测',
      chartDimensionKey: 'team_name',
      chartMetricKey: 'completion_rate',
      moduleHeight: 420,
    },
    lastTemporalScope: {
      rawText: '2026 年',
      normalizedLabel: '2026 全年',
      startAt: '2026-01-01T00:00:00.000Z',
      endAt: '2027-01-01T00:00:00.000Z',
      granularity: 'year',
      timezone: 'Asia/Shanghai',
      source: 'AI_TEMPORAL_SLOT',
    },
    resultSummary: '当前已返回各团队完成率预测与承诺商机概览。',
    status: 'SUCCEEDED',
    lastUsedAt: '2026-05-11T08:00:00.000Z',
  },
];

export const DEFAULT_QUERY_USAGE_PROFILES: QueryUsageProfileRecord[] = [
  {
    id: 'usage_profile_sales_director_company_2026_completion',
    userId: 'user_sales_director',
    templateId: 'tpl_company_2026_completion',
    lastClickedAt: '2026-05-11T08:00:00.000Z',
    clickCount7d: 5,
    clickCount30d: 11,
    rerunCount30d: 2,
    successCount30d: 11,
    lastTimeSlot: 'MONTH_END',
    favoriteScore: 98,
  },
  {
    id: 'usage_profile_sales_director_weekly_new_opportunity',
    userId: 'user_sales_director',
    templateId: 'tpl_company_weekly_new_opportunity',
    lastClickedAt: '2026-05-10T17:00:00.000Z',
    clickCount7d: 4,
    clickCount30d: 9,
    rerunCount30d: 1,
    successCount30d: 9,
    lastTimeSlot: 'MONTH_MIDDLE',
    favoriteScore: 91,
  },
];

export const DEFAULT_QUERY_TIME_SLOT_STATS: QueryTimeSlotStatRecord[] = [
  {
    id: 'slot_company_2026_completion_month_end',
    templateId: 'tpl_company_2026_completion',
    timeSlot: 'MONTH_END',
    globalClickCount: 38,
    globalUserCount: 9,
    successRate: 0.94,
    updatedAt: '2026-05-11T08:00:00.000Z',
  },
  {
    id: 'slot_weekly_new_opportunity_month_middle',
    templateId: 'tpl_company_weekly_new_opportunity',
    timeSlot: 'MONTH_MIDDLE',
    globalClickCount: 31,
    globalUserCount: 8,
    successRate: 0.91,
    updatedAt: '2026-05-11T08:00:00.000Z',
  },
];

export function createDefaultAppStorageState(): AppStorageState {
  const now = '2026-03-24T10:00:00.000Z';
  return {
    policy: { ...DEFAULT_ACCESS_POLICY },
    lianruanCrmConnectionConfig: {
      ...DEFAULT_LIANRUAN_CRM_CONNECTION_CONFIG,
    },
    wecomBotConnectionConfig: {
      ...DEFAULT_WECOM_BOT_CONNECTION_CONFIG,
    },
    analysisScopePolicy: {
      ...DEFAULT_ANALYSIS_SCOPE_POLICY,
      fullAccessUserIds: [...DEFAULT_ANALYSIS_SCOPE_POLICY.fullAccessUserIds],
    },
    applicationSuperAdminPolicy: {
      ...DEFAULT_APPLICATION_SUPER_ADMIN_POLICY,
      subjects: DEFAULT_APPLICATION_SUPER_ADMIN_POLICY.subjects.map((item) => ({ ...item })),
    },
    rolePermissions: DEFAULT_ROLE_PERMISSIONS.map((item) => ({
      ...item,
      visibleMenus: [...item.visibleMenus],
      actionKeys: [...item.actionKeys],
    })),
    wecomPilotPolicy: {
      ...DEFAULT_WECOM_PILOT_POLICY,
      allowUserIds: [...DEFAULT_WECOM_PILOT_POLICY.allowUserIds],
      allowRoleIds: [...DEFAULT_WECOM_PILOT_POLICY.allowRoleIds],
      allowDepartmentIds: [...DEFAULT_WECOM_PILOT_POLICY.allowDepartmentIds],
      denyUserIds: [...DEFAULT_WECOM_PILOT_POLICY.denyUserIds],
    },
    queryTemplates: DEFAULT_QUERY_TEMPLATES.map((item) => ({ ...item })),
    analysisSemanticKnowledgeDraftAssets:
      DEFAULT_ANALYSIS_SEMANTIC_KNOWLEDGE_DRAFT_ASSETS.map((item) => ({
        ...item,
        matchKeywords: [...item.matchKeywords],
        synonyms: item.synonyms ? [...item.synonyms] : undefined,
      })),
    analysisSemanticKnowledgePublishedAssets:
      DEFAULT_ANALYSIS_SEMANTIC_KNOWLEDGE_DRAFT_ASSETS.map((item) => ({
        ...item,
        matchKeywords: [...item.matchKeywords],
        synonyms: item.synonyms ? [...item.synonyms] : undefined,
      })),
    analysisSemanticKnowledgePublications:
      DEFAULT_ANALYSIS_SEMANTIC_KNOWLEDGE_PUBLICATIONS.map((item) => ({
        ...item,
        snapshot: item.snapshot.map((asset) => ({
          ...asset,
          matchKeywords: [...asset.matchKeywords],
          synonyms: asset.synonyms ? [...asset.synonyms] : undefined,
        })),
      })),
    analysisWarehouseSyncRuns: [],
    analysisWarehouseRawRecords: [],
    analysisWarehouseSyncCheckpoints: [],
    aiModelProfiles: [],
    aiModelActivation: {
      activeProfileId: undefined,
      activatedAt: undefined,
      activatedBy: undefined,
      lastVerifiedAt: undefined,
      lastVerificationStatus: undefined,
    },
    aiContextPolicy: { ...DEFAULT_AI_CONTEXT_POLICY },
    recentQueries: DEFAULT_RECENT_QUERIES.map((item) => ({
      ...item,
      lastUsedConditions: { ...item.lastUsedConditions },
      parameterSnapshot: item.parameterSnapshot
        ? { ...item.parameterSnapshot }
        : undefined,
      renderSnapshot: item.renderSnapshot
        ? { ...item.renderSnapshot }
        : undefined,
    })),
    queryUsageProfiles: DEFAULT_QUERY_USAGE_PROFILES.map((item) => ({ ...item })),
    queryTimeSlotStats: DEFAULT_QUERY_TIME_SLOT_STATS.map((item) => ({ ...item })),
    analysisRequests: [],
    analysisResults: [],
    auditEvents: [],
    sqlAuditRecords: [],
    exportRequests: [],
    querySessions: [],
    authSessions: [],
    wecomLoginBindings: [],
    pendingWecomBindings: [],
    wecomMessageReceipts: [],
    wecomDeliveryRecords: [],
    wecomConversationContexts: [],
    pendingFollowUpWritebacks: [],
    wecomSyncedDepartments: [],
    wecomSyncedUsers: [],
    wecomUserDeptChanges: [],
    dataScopeGrants: [],
    dailyReportDepartmentPolicies: [],
    dailyReportRecipientOverrides: [],
    dailyReportSalesGroupConfigs: [],
    wecomSyncCheckpoints: [],
    wecomSyncRuns: [],
    crmWxUsers: [
      {
        id: 'crm_wx_user_sales_director',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_sales_director',
        originUserid: 'wx_sales_director',
        name: '销售总监',
        mobile: 'wx_sales_director',
        departmentIds: ['dept_sales'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crm_wx_user_region_manager',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_region_manager',
        originUserid: 'wx_region_manager',
        name: '区域经理',
        email: 'wx_region_manager',
        departmentIds: ['dept_region_east'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crm_wx_user_sales_vp',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_sales_vp',
        originUserid: 'wx_sales_vp',
        name: '销售副总',
        email: 'wx_sales_vp',
        departmentIds: ['dept_sales_management'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crm_wx_user_product_li_si',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_product_li_si',
        originUserid: 'wx_product_li_si',
        name: '李四',
        email: 'wx_product_li_si',
        departmentIds: ['dept_product'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crm_wx_user_product_director',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_product_director',
        originUserid: 'wx_product_director',
        name: '产品总监',
        email: 'wx_product_director',
        departmentIds: ['dept_product'],
        createdAt: now,
        updatedAt: now,
      },
    ],
    crmWxUserMaps: [
      {
        id: 'crm_wx_user_map_sales_director',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_sales_director',
        crmUserId: 'user_sales_director',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crm_wx_user_map_region_manager',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_region_manager',
        crmUserId: 'user_region_manager',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crm_wx_user_map_sales_vp',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_sales_vp',
        crmUserId: 'user_sales_vp',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crm_wx_user_map_product_li_si',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_product_li_si',
        crmUserId: 'user_product_li_si',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'crm_wx_user_map_product_director',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_product_director',
        crmUserId: 'user_product_director',
        createdAt: now,
        updatedAt: now,
      },
    ],
    contractReviewRuleSets: [],
    contractReviewTasks: [],
    contractReviewIssues: [],
    contractReviewArtifacts: [],
    proactiveNotificationTasks: [],
    dailyReports: [],
    dailyReportSummaryBatches: [],
    dailyReportAssistanceEscalations: [],
  };
}
