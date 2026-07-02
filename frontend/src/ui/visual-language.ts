import { UiIconGroups, type UiIconComponent } from '@/ui/icons';
import type { StatusTone } from '@/ui/status-presentation';

type BusinessModuleKey =
  | 'analysis'
  | 'management'
  | 'contract'
  | 'template'
  | 'permission'
  | 'connection'
  | 'audit'
  | 'aiProfile'
  | 'knowledge-sedimentation';

interface BusinessModuleVisual {
  key: BusinessModuleKey;
  label: string;
  tone: string;
  icon: UiIconComponent;
  summary: string;
}

interface ChartColorToken {
  key: string;
  color: string;
  label: string;
}

const chartColorTokens: ChartColorToken[] = [
  { key: 'primary', color: '#635BFF', label: '主指标' },
  { key: 'blue', color: '#2563EB', label: '趋势对比' },
  { key: 'teal', color: '#0E9F8A', label: '健康增长' },
  { key: 'amber', color: '#D97706', label: '预警临界' },
  { key: 'red', color: '#C23D4B', label: '高风险' },
  { key: 'violet', color: '#7C3AED', label: '智能推荐' },
  { key: 'cyan', color: '#0891B2', label: '渠道连接' },
  { key: 'slate', color: '#64748B', label: '中性其他' },
];

const businessModuleVisuals: Record<BusinessModuleKey, BusinessModuleVisual> = {
  analysis: {
    key: 'analysis',
    label: '智能分析',
    tone: 'analysis',
    icon: UiIconGroups.navigation.analysis,
    summary: 'AI 问数、可信结果和继续追问',
  },
  management: {
    key: 'management',
    label: '经营报表',
    tone: 'management',
    icon: UiIconGroups.object.report,
    summary: '经营指标、趋势和异常变化',
  },
  contract: {
    key: 'contract',
    label: '智能合同',
    tone: 'contract',
    icon: UiIconGroups.navigation.contract,
    summary: '风险结论、原文证据和审核建议',
  },
  template: {
    key: 'template',
    label: '查询模板',
    tone: 'template',
    icon: UiIconGroups.navigation.template,
    summary: '模板分类、复用资产和权限范围',
  },
  permission: {
    key: 'permission',
    label: '权限中心',
    tone: 'permission',
    icon: UiIconGroups.navigation.permission,
    summary: '角色、用户、部门和动作权限',
  },
  connection: {
    key: 'connection',
    label: '连接策略',
    tone: 'connection',
    icon: UiIconGroups.navigation.connection,
    summary: '连接健康、并发控制和失败回退',
  },
  audit: {
    key: 'audit',
    label: '审计中心',
    tone: 'audit',
    icon: UiIconGroups.navigation.audit,
    summary: '事件复核、风险追踪和证据链',
  },
  aiProfile: {
    key: 'aiProfile',
    label: 'AI配置',
    tone: 'ai-profile',
    icon: UiIconGroups.navigation.aiProfile,
    summary: '模型 Profile、上下文策略和健康检查',
  },
  'knowledge-sedimentation': {
    key: 'knowledge-sedimentation',
    label: '知识沉淀',
    tone: 'audit',
    icon: UiIconGroups.navigation.audit,
    summary: '候选审核、口径收敛和沉淀效果',
  },
};

/**
 * 按序号获取图表色板颜色，用于让自绘图表和摘要图形共享统一业务色。
 * @param index 从 0 开始的数据系列序号。
 * @returns 对应色板色值。
 */
function resolveChartColor(index: number): string {
  return chartColorTokens[index % chartColorTokens.length].color;
}

/**
 * 获取业务模块视觉配置，避免页面局部重复维护模块名称、图标和语义色。
 * @param moduleKey 业务模块标识。
 * @returns 模块视觉配置。
 */
function resolveBusinessModuleVisual(moduleKey: BusinessModuleKey): BusinessModuleVisual {
  return businessModuleVisuals[moduleKey];
}

const statusToneLabels: Record<StatusTone, string> = {
  neutral: '中性',
  info: '提示',
  online: '在线',
  running: '处理中',
  success: '成功',
  warning: '预警',
  degraded: '降级',
  danger: '失败',
  blocked: '阻断',
  offline: '离线',
};

export type { BusinessModuleKey, BusinessModuleVisual, ChartColorToken };
export {
  businessModuleVisuals,
  chartColorTokens,
  resolveBusinessModuleVisual,
  resolveChartColor,
  statusToneLabels,
};
