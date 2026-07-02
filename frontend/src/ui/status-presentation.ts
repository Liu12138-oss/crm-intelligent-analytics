import { UiIcons } from '@/ui/icons';

type StatusTone =
  | 'neutral'
  | 'info'
  | 'online'
  | 'running'
  | 'success'
  | 'warning'
  | 'degraded'
  | 'danger'
  | 'blocked'
  | 'offline';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

type StatusIcon = (typeof UiIcons)[keyof typeof UiIcons];

/**
 * 将状态语义转换为统一样式类，供标签、chip、按钮和提示块复用。
 */
function toStatusToneClass(tone: StatusTone): string {
  return `status-tone--${tone}`;
}

/**
 * 统一清洗状态码，避免接口大小写或空格差异导致样式分支失效。
 */
function normalizeStatusCode(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

/**
 * 将通用反馈语义映射到设计系统状态语义。
 */
function resolveFeedbackTone(tone: FeedbackTone | string | null | undefined): StatusTone {
  switch (String(tone ?? '').trim().toLowerCase()) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'info';
  }
}

/**
 * 将服务状态映射为在线、降级或离线等页面可复用语义。
 */
function resolveServiceStatusTone(value: string | null | undefined): StatusTone {
  switch (normalizeStatusCode(value)) {
    case 'ONLINE':
      return 'online';
    case 'DEGRADED':
      return 'degraded';
    case 'OFFLINE':
      return 'offline';
    default:
      return 'neutral';
  }
}

/**
 * 为服务状态选择语义一致的图标，确保颜色和形态同时表达状态。
 */
function resolveServiceStatusIcon(value: string | null | undefined): StatusIcon {
  switch (normalizeStatusCode(value)) {
    case 'ONLINE':
      return UiIcons.success;
    case 'DEGRADED':
      return UiIcons.warning;
    case 'OFFLINE':
      return UiIcons.error;
    default:
      return UiIcons.info;
  }
}

/**
 * 将分析结果状态映射为统一语义，覆盖排队、补问、阻断和失败等阶段。
 */
function resolveAnalysisStatusTone(value: string | null | undefined): StatusTone {
  switch (normalizeStatusCode(value)) {
    case 'ACTIVE':
    case 'QUEUED':
      return 'running';
    case 'RETURNED':
    case 'SUCCEEDED':
      return 'success';
    case 'CLARIFICATION_REQUIRED':
      return 'warning';
    case 'BLOCKED':
      return 'blocked';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * 为分析状态提供统一图标，让排队、成功、阻断等状态不再共用同一图标。
 */
function resolveAnalysisStatusIcon(value: string | null | undefined): StatusIcon {
  switch (normalizeStatusCode(value)) {
    case 'ACTIVE':
    case 'QUEUED':
      return UiIcons.loading;
    case 'RETURNED':
    case 'SUCCEEDED':
      return UiIcons.success;
    case 'CLARIFICATION_REQUIRED':
      return UiIcons.warning;
    case 'BLOCKED':
      return UiIcons.risk;
    case 'FAILED':
      return UiIcons.error;
    default:
      return UiIcons.result;
  }
}

/**
 * 将治理策略、模板等启停态统一映射到语义色。
 */
function resolvePolicyStatusTone(value: string | null | undefined): StatusTone {
  switch (normalizeStatusCode(value)) {
    case 'ACTIVE':
      return 'success';
    case 'DRAFT':
      return 'warning';
    case 'DISABLED':
    case 'INACTIVE':
      return 'offline';
    case 'ARCHIVED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * 将风险等级映射为统一语义色，用于审计、合同审核等风险场景。
 */
function resolveRiskLevelTone(value: string | null | undefined): StatusTone {
  switch (normalizeStatusCode(value)) {
    case 'CRITICAL':
      return 'blocked';
    case 'HIGH':
      return 'danger';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
      return 'success';
    default:
      return 'neutral';
  }
}

/**
 * 风险等级图标统一出口，避免不同页面各自挑图标导致识别不一致。
 */
function resolveRiskLevelIcon(value: string | null | undefined): StatusIcon {
  switch (normalizeStatusCode(value)) {
    case 'CRITICAL':
    case 'HIGH':
      return UiIcons.risk;
    case 'MEDIUM':
      return UiIcons.warning;
    case 'LOW':
      return UiIcons.success;
    default:
      return UiIcons.info;
  }
}

/**
 * 审计建议等级语义统一映射。
 */
function resolveAuditLevelTone(value: string | null | undefined): StatusTone {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'critical':
      return 'blocked';
    case 'error':
      return 'danger';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    case 'info':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 * 审计建议等级图标统一出口。
 */
function resolveAuditLevelIcon(value: string | null | undefined): StatusIcon {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'critical':
      return UiIcons.risk;
    case 'error':
      return UiIcons.error;
    case 'warning':
      return UiIcons.warning;
    case 'success':
      return UiIcons.success;
    case 'info':
      return UiIcons.info;
    default:
      return UiIcons.info;
  }
}

/**
 * 合同审核总决策语义映射，用于任务卡和结果摘要区。
 */
function resolveContractDecisionTone(value: string | null | undefined): StatusTone {
  switch (normalizeStatusCode(value)) {
    case 'REJECT':
      return 'danger';
    case 'REVISE':
      return 'warning';
    default:
      return 'success';
  }
}

/**
 * 合同审核任务状态语义映射。
 */
function resolveContractReviewStatusTone(value: string | null | undefined): StatusTone {
  switch (normalizeStatusCode(value)) {
    case 'UPLOADED':
    case 'PARSING':
    case 'REVIEWING':
    case 'GENERATING_REPORT':
      return 'running';
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'BLOCKED':
      return 'blocked';
    default:
      return 'neutral';
  }
}

/**
 * 合同审核任务状态图标统一出口。
 */
function resolveContractReviewStatusIcon(value: string | null | undefined): StatusIcon {
  switch (normalizeStatusCode(value)) {
    case 'UPLOADED':
    case 'PARSING':
    case 'REVIEWING':
    case 'GENERATING_REPORT':
      return UiIcons.loading;
    case 'COMPLETED':
      return UiIcons.success;
    case 'FAILED':
      return UiIcons.error;
    case 'BLOCKED':
      return UiIcons.risk;
    default:
      return UiIcons.info;
  }
}

export type { StatusTone };
export {
  resolveAnalysisStatusIcon,
  resolveAnalysisStatusTone,
  resolveAuditLevelIcon,
  resolveAuditLevelTone,
  resolveContractDecisionTone,
  resolveContractReviewStatusIcon,
  resolveContractReviewStatusTone,
  resolveFeedbackTone,
  resolvePolicyStatusTone,
  resolveRiskLevelIcon,
  resolveRiskLevelTone,
  resolveServiceStatusIcon,
  resolveServiceStatusTone,
  toStatusToneClass,
};
