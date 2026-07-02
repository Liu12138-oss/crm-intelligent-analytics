import { describe, expect, it } from 'vitest';
import {
  auditEventTypeOptions,
  formatActionTypeLabel,
  formatAnalysisStatusLabel,
  formatAuditEventTypeLabel,
  formatAuditLevelLabel,
  formatBusinessCodeText,
  formatEntrySceneLabel,
  formatExecutionModeLabel,
  formatExecutionSourceLabel,
  formatFallbackReasonLabel,
  formatIdentityMappingStatusLabel,
  formatPermissionActionLabel,
  formatPermissionMenuLabel,
  formatRiskLevelLabel,
  formatServiceStatusLabel,
  formatViewTypeLabel,
  formatWorkflowLabel,
} from '@/ui/business-code-labels';

const backendAuditEventTypes = [
  'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_SAVED',
  'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_STATUS_UPDATED',
  'ANALYSIS_SEMANTIC_KNOWLEDGE_PUBLISHED',
  'ANALYSIS_SEMANTIC_KNOWLEDGE_ROLLED_BACK',
  'ACCESS_ACTION_DENIED',
  'ACCESS_MENU_DENIED',
  'ACCESS_CHANNEL_DENIED',
  'ANALYSIS_SCOPE_POLICY_UPDATED',
  'ACCESS_ROLE_PERMISSION_UPDATED',
  'ACCESS_ROLE_PERMISSION_PUBLISHED',
  'ACCESS_PREVIEW_EXECUTED',
  'DATA_SCOPE_GRANT_UPDATED',
  'DATA_SCOPE_PREVIEW_EXECUTED',
  'DAILY_REPORT_DELIVERY_POLICY_UPDATED',
  'DAILY_REPORT_DELIVERY_PREVIEW_EXECUTED',
  'IDENTITY_MAPPING_DIAGNOSTIC_QUERIED',
  'WECOM_PILOT_POLICY_UPDATED',
  'WECOM_PILOT_POLICY_PREVIEWED',
  'WECOM_PILOT_ACCESS_DENIED',
  'QUERY_SUCCEEDED',
  'QUERY_BLOCKED',
  'MANAGEMENT_REPORT_VIEWED',
  'MANAGEMENT_REPORT_EXPORTED',
  'MANAGEMENT_REPORT_SCOPE_BLOCKED',
  'CLARIFICATION_REQUESTED',
  'TEMPLATE_EXECUTED',
  'HISTORY_RERUN',
  'EXPORT_SUCCEEDED',
  'EXPORT_BLOCKED',
  'AUTH_LOGIN_SUCCEEDED',
  'AUTH_LOGIN_FAILED',
  'WECOM_AUTH_SUCCEEDED',
  'WECOM_AUTH_FAILED',
  'WECOM_MESSAGE_ACCEPTED',
  'WECOM_MESSAGE_DEDUPED',
  'WECOM_MESSAGE_REJECTED',
  'WECOM_SESSION_STATE_CHANGED',
  'WECOM_DELIVERY_SUCCEEDED',
  'PROACTIVE_NOTIFICATION_REQUESTED',
  'PROACTIVE_NOTIFICATION_DEDUPED',
  'PROACTIVE_NOTIFICATION_SENT',
  'PROACTIVE_NOTIFICATION_FAILED',
  'PROACTIVE_NOTIFICATION_BLOCKED',
  'AI_CONTEXT_READ',
  'AI_ANALYSIS_REQUESTED',
  'AI_RESULT_EXPLAINED',
  'DAILY_REPORT_DRAFT_SAVED',
  'DAILY_REPORT_CONFIRMED',
  'DAILY_REPORT_DELIVERY_SENT',
  'DAILY_REPORT_ASSISTANCE_SENT',
  'DAILY_REPORT_ASSISTANCE_BLOCKED',
  'DAILY_REPORT_ASSISTANCE_FAILED',
  'DAILY_REPORT_REMINDER_SENT',
  'DAILY_REPORT_CLOSED',
  'DAILY_REPORT_SUMMARIZED',
  'MAINTENANCE_DEGRADED',
  'MAINTENANCE_RECOVERED',
  'WECOM_DIRECTORY_SYNC_TRIGGERED',
  'WECOM_DIRECTORY_SYNC_FINISHED',
  'WECOM_IDENTITY_RESOLVED',
  'FOLLOW_UP_WRITEBACK_DRAFTED',
  'FOLLOW_UP_WRITEBACK_INTENT_CONFIRMED',
  'FOLLOW_UP_WRITEBACK_CONTENT_CONFIRMED',
  'FOLLOW_UP_WRITEBACK_CANCELLED',
  'FOLLOW_UP_WRITEBACK_SUCCEEDED',
  'FOLLOW_UP_WRITEBACK_FAILED',
  'FOLLOW_UP_WRITEBACK_DUPLICATE_BLOCKED',
  'FOLLOW_UP_SHARE_PENDING_CONFIRMATION',
  'FOLLOW_UP_SHARE_SUCCEEDED',
  'FOLLOW_UP_SHARE_CANCELLED',
  'FOLLOW_UP_SHARE_FAILED',
  'WECOM_CRM_CREATE_DRAFTED',
  'WECOM_CRM_CREATE_CONFIRMED',
  'WECOM_CRM_CREATE_CANCELLED',
  'WECOM_CRM_CREATE_SUCCEEDED',
  'WECOM_CRM_CREATE_FAILED',
  'WECOM_CRM_CREATE_DUPLICATE_BLOCKED',
  'WECOM_AI_DRAFT_STRUCTURED',
  'WECOM_CANDIDATE_RERANKED',
  'AI_MODEL_PROFILE_CREATED',
  'AI_MODEL_PROFILE_UPDATED',
  'AI_MODEL_PROFILE_SECRET_CLEARED',
  'AI_MODEL_PROFILE_HEALTH_CHECKED',
  'AI_MODEL_PROFILE_ACTIVATED',
  'AI_MODEL_PROFILE_ACTIVATION_ROLLED_BACK',
  'AI_CONTEXT_POLICY_READ',
  'AI_CONTEXT_POLICY_UPDATED',
  'AI_CONTEXT_POLICY_UPDATE_FAILED',
  'SECURITY_INTERCEPTED',
  'CONNECTION_INTERRUPTED',
  'STREAM_DELIVERY_FAILED',
  'CONTRACT_REVIEW_FILE_UPLOADED',
  'CONTRACT_REVIEW_SOURCE_CONTRACT_VIEWED',
  'CONTRACT_REVIEW_SOURCE_REVIEW_STARTED',
  'CONTRACT_REVIEW_TASK_CREATED',
  'CONTRACT_REVIEW_TASK_COMPLETED',
  'CONTRACT_REVIEW_TASK_FAILED',
  'CONTRACT_REVIEW_TASK_BLOCKED',
  'CONTRACT_REVIEW_ARTIFACT_DOWNLOADED',
  'SQL_AUDIT_RAW_VIEWED',
];

describe('business code labels', () => {
  it('应将截图中的审计入口、工作流、fallback 和风险代码转换为中文', () => {
    expect(formatEntrySceneLabel('WECOM_IDLE_MESSAGE')).toBe('企业微信空闲消息');
    expect(formatEntrySceneLabel('WECOM_DAILY_REPORT_ENTRY')).toBe('企业微信日报入口');
    expect(formatWorkflowLabel('ANALYSIS_QUERY_EXECUTION')).toBe('分析问数执行');
    expect(formatFallbackReasonLabel('active-conversation-flow-continue')).toBe('活跃会话流程继续');
    expect(formatFallbackReasonLabel('ai-unavailable-or-invalid')).toBe('AI 不可用或返回无效');
    expect(formatRiskLevelLabel('LOW')).toBe('低风险');
    expect(formatAuditLevelLabel('critical')).toBe('严重');
    expect(formatAuditLevelLabel('info')).toBe('提示');
  });

  it('应将分析状态、执行模式、数据来源、动作和视图类型转换为中文', () => {
    expect(formatServiceStatusLabel('ONLINE')).toBe('在线');
    expect(formatAnalysisStatusLabel('RETURNED')).toBe('已返回结果');
    expect(formatAnalysisStatusLabel('BLOCKED')).toBe('已阻断');
    expect(formatExecutionModeLabel('PLAN_EXECUTION')).toBe('计划编排执行');
    expect(formatExecutionSourceLabel('GUARDED_READONLY_SQL')).toBe('受控只读 SQL');
    expect(formatActionTypeLabel('EXPORT')).toBe('导出结果');
    expect(formatViewTypeLabel('RANKING_TABLE')).toBe('排名表');
    expect(formatPermissionMenuLabel('analysis-workbench')).toBe('智能分析');
    expect(formatPermissionMenuLabel('ai-model-governance')).toBe('AI配置');
    expect(formatPermissionActionLabel('analysis.follow_up')).toBe('继续追问');
    expect(formatPermissionActionLabel('ai_profile.manage')).toBe('AI配置治理');
    expect(formatIdentityMappingStatusLabel('MAPPED')).toBe('已映射');
  });

  it('未知代码应显示中文兜底并保留原始代码，空值应显示占位', () => {
    expect(formatAuditEventTypeLabel('NEW_INTERNAL_EVENT')).toBe('未知事件类型（NEW_INTERNAL_EVENT）');
    expect(formatEntrySceneLabel(undefined)).toBe('--');
    expect(formatWorkflowLabel(null)).toBe('--');
  });

  it('应替换接口文案中夹带的已知业务代码', () => {
    expect(formatBusinessCodeText('WEB_ANALYSIS_QUERY 入口存在 fallback')).toBe(
      'Web 分析问数 入口存在 AI 兜底',
    );
    expect(formatBusinessCodeText('执行模式：GUARDED_DIRECT_QUERY')).toBe('执行模式：受控直查');
    expect(formatBusinessCodeText('当前状态：PILOT_REQUIRED，菜单：analysis-workbench')).toBe(
      '当前状态：待灰度开通，菜单：智能分析',
    );
  });

  it('应覆盖日报、主动通知、跟进写回、合同审核和语义知识治理事件', () => {
    expect(formatAuditEventTypeLabel('DAILY_REPORT_SUMMARIZED')).toBe('日报汇总已生成');
    expect(formatAuditEventTypeLabel('PROACTIVE_NOTIFICATION_SENT')).toBe('主动通知已发送');
    expect(formatAuditEventTypeLabel('FOLLOW_UP_WRITEBACK_SUCCEEDED')).toBe('跟进写回成功');
    expect(formatAuditEventTypeLabel('CONTRACT_REVIEW_TASK_COMPLETED')).toBe('合同审核任务已完成');
    expect(formatAuditEventTypeLabel('ANALYSIS_SEMANTIC_KNOWLEDGE_PUBLISHED')).toBe('语义知识已发布');
  });

  it('当前后端已定义审计事件不应显示为未知事件类型', () => {
    const optionValues = new Set(auditEventTypeOptions.map((item) => item.value));
    for (const eventType of backendAuditEventTypes) {
      expect(optionValues.has(eventType)).toBe(true);
      expect(formatAuditEventTypeLabel(eventType)).not.toContain('未知事件类型');
    }
  });
});
