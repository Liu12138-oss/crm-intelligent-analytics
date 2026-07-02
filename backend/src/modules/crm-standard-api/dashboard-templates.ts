/**
 * 看板模板配置
 *
 * 把两个标杆看板沉淀为可复用模板，支持条件改写（改区域、改时间范围）。
 * 看板模板接入权限与审计通过 DashboardController 的 SessionAuthGuard 和审计事件实现。
 *
 * 设计目标：
 * - 看板模板是预定义的看板配置，用户可一键生成
 * - 支持条件改写：用户可在模板基础上修改筛选条件
 * - 模板配置外置，后续可迁移到 DB 或治理后台维护
 */

import type { DashboardProfile } from './dashboard-report-composer.service';
import type { DashboardAnalyticsQuery } from './dashboard-analytics.service';

/**
 * 看板模板定义
 */
export interface DashboardTemplate {
  /** 模板唯一标识 */
  templateId: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 看板类型 */
  profile: DashboardProfile;
  /** 默认查询参数 */
  defaultQuery: DashboardAnalyticsQuery;
  /** 适用角色（空数组表示所有角色） */
  applicableRoles: string[];
  /** 支持的条件改写字段 */
  rewriteableFields: DashboardRewriteableField[];
  /** 分类标签 */
  category: 'channel' | 'agent' | 'region' | 'owner';
  /** 显示顺序 */
  displayOrder: number;
}

/**
 * 可改写的条件字段
 */
export interface DashboardRewriteableField {
  key: string;
  label: string;
  type: 'text' | 'select';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

/**
 * 内置看板模板
 * 第 2 期先硬编码，后续可迁移到 DB 或治理后台维护
 */
export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    templateId: 'tpl_channel_order_summary',
    name: '渠道下单汇总分析',
    description: '按渠道统计下单金额、数量、集中度和排名，对标广州办渠道下单汇总看板',
    profile: 'channel-order-summary',
    defaultQuery: {},
    applicableRoles: [],
    category: 'channel',
    displayOrder: 1,
    rewriteableFields: [
      {
        key: 'region',
        label: '区域',
        type: 'text',
        placeholder: '如：广州办',
      },
      {
        key: 'bigRegion',
        label: '大区',
        type: 'select',
        options: [
          { value: '', label: '全部大区' },
          { value: '大北区', label: '大北区' },
          { value: '大东区', label: '大东区' },
          { value: '大南区', label: '大南区' },
          { value: '大西区', label: '大西区' },
        ],
      },
      {
        key: 'limit',
        label: '返回条数',
        type: 'text',
        placeholder: '默认 50',
      },
    ],
  },
  {
    templateId: 'tpl_agent_development',
    name: '代理商/渠道商数据运营看板',
    description: '全国代理商/渠道商/服务商数据运营全景看板：核心KPI、合作级别分布、技术服务商建设、大区对比、省份覆盖、商机阶段分布、报价/订单状态、月度趋势、业务转化漏斗、区域贡献明细、代理商运营明细。对标 AI 直连数据库分析的运营看板。',
    profile: 'agent-development',
    defaultQuery: {},
    applicableRoles: [],
    category: 'agent',
    displayOrder: 2,
    rewriteableFields: [
      {
        key: 'bigRegion',
        label: '大区',
        type: 'select',
        options: [
          { value: '', label: '全国' },
          { value: '大北区', label: '大北区' },
          { value: '大东区', label: '大东区' },
          { value: '大南区', label: '大南区' },
          { value: '大西区', label: '大西区' },
        ],
      },
      {
        key: 'limit',
        label: '返回条数',
        type: 'text',
        placeholder: '默认 50',
      },
    ],
  },
  {
    templateId: 'tpl_region_overview',
    name: '区域经营概览',
    description: '按区域统计下单、商机、报价等经营指标',
    profile: 'region-overview',
    defaultQuery: {},
    applicableRoles: [],
    category: 'region',
    displayOrder: 3,
    rewriteableFields: [],
  },
  {
    templateId: 'tpl_owner_performance',
    name: '负责人业绩看板',
    description: '按负责人统计下单金额、数量、商机等业绩指标',
    profile: 'owner-performance',
    defaultQuery: {},
    applicableRoles: [],
    category: 'owner',
    displayOrder: 4,
    rewriteableFields: [],
  },
];

/**
 * 查找看板模板
 */
export function findDashboardTemplate(templateId: string): DashboardTemplate | undefined {
  return DASHBOARD_TEMPLATES.find((t) => t.templateId === templateId);
}

/**
 * 列出看板模板（可按角色过滤）
 */
export function listDashboardTemplates(roles: string[] = []): DashboardTemplate[] {
  if (roles.length === 0) {
    return [...DASHBOARD_TEMPLATES].sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return DASHBOARD_TEMPLATES.filter(
    (t) => t.applicableRoles.length === 0 || t.applicableRoles.some((r) => roles.includes(r)),
  ).sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * 合并模板默认参数和用户改写参数
 */
export function resolveDashboardQuery(
  templateId: string,
  overrides: Partial<DashboardAnalyticsQuery> = {},
): DashboardAnalyticsQuery {
  const template = findDashboardTemplate(templateId);
  if (!template) {
    return overrides;
  }
  return { ...template.defaultQuery, ...overrides };
}
