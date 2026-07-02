type BusinessCodeValue = string | null | undefined;

const emptyLabel = '--';

const serviceStatusLabels: Record<string, string> = {
  ONLINE: '在线',
  DEGRADED: '降级运行',
  OFFLINE: '离线',
};

const analysisStatusLabels: Record<string, string> = {
  ACTIVE: '进行中',
  BLOCKED: '已阻断',
  CLARIFICATION_REQUIRED: '需要补充条件',
  FAILED: '失败',
  QUEUED: '排队中',
  RETURNED: '已返回结果',
  SUCCEEDED: '已成功',
};

const policyStatusLabels: Record<string, string> = {
  ACTIVE: '启用',
  ARCHIVED: '已归档',
  DISABLED: '停用',
  DRAFT: '草稿',
  ENABLED: '启用',
  INACTIVE: '停用',
  INHERIT: '继承上级',
};

const dailyReportDepartmentTypeLabels: Record<string, string> = {
  REGION: '区域',
  SALES: '销售',
  NON_SALES: '非销售',
  UNCLASSIFIED: '未识别',
};

const wecomPilotModeLabels: Record<string, string> = {
  DISABLED: '关闭',
  FULL: '全量开放',
  PILOT_ONLY: '白名单开放',
};

const wecomAccessStateLabels: Record<string, string> = {
  ALLOWED: '已开通',
  CHANNEL_DISABLED: '入口关闭',
  EXPLICITLY_DENIED: '已停用',
  PILOT_REQUIRED: '待灰度开通',
  RESOURCE_FORBIDDEN: '资源受限',
  ROLE_NOT_ENABLED: '角色未开通',
  UNMAPPED_CRM_IDENTITY: '未映射 CRM 身份',
};

const identityMappingStatusLabels: Record<string, string> = {
  MAPPED: '已映射',
  UNMAPPED: '未映射',
  CONFLICTED: '映射冲突',
};

const permissionMenuLabels: Record<string, string> = {
  'analysis-workbench': '智能分析',
  'contract-review': '智能合同审核',
  'management-report': '经营报表',
  'template-governance': '查询模板管理',
  'permission-center': '权限中心',
  'connection-policy': '连接策略',
  'audit-center': '审计中心',
  'ai-model-governance': 'AI配置',
};

const permissionActionLabels: Record<string, string> = {
  'analysis.use': '分析问数',
  'analysis.follow_up': '继续追问',
  'analysis.export': '导出结果',
  'management.report.view': '查看经营报表',
  'management.report.export': '导出经营报表',
  'template.view': '模板可见',
  'template.manage': '模板治理',
  'template.sql.write': '查询模板 SQL 编写',
  'wecom.analysis.use': '企业微信问数',
  'wecom.customer.create': '企业微信新增客户',
  'wecom.opportunity.create': '企业微信新增商机',
  'wecom.followup.writeback': '企业微信跟进写回',
  'wecom.daily_report.preview': '日报预览',
  'governance.policy.manage': '系统级治理',
  'audit.view': '查看审计',
  'audit.sql.view': '查看 SQL 审计',
  'audit.sql.view_sensitive': '查看 SQL 敏感明细',
  'ai_profile.manage': 'AI配置治理',
  'contract.review.upload': '合同上传',
  'contract.review.cross_view': '查看他人合同',
  'contract.review.cross_download': '下载他人产物',
};

const riskLevelLabels: Record<string, string> = {
  CRITICAL: '严重风险',
  HIGH: '高风险',
  LOW: '低风险',
  MEDIUM: '中风险',
};

const auditLevelLabels: Record<string, string> = {
  critical: '严重',
  error: '异常',
  info: '提示',
  success: '正常',
  warning: '预警',
};

const auditEventTypeLabels: Record<string, string> = {
  ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_SAVED: '语义知识资产已保存',
  ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_STATUS_UPDATED: '语义知识资产状态已更新',
  ANALYSIS_SEMANTIC_KNOWLEDGE_PUBLISHED: '语义知识已发布',
  ANALYSIS_SEMANTIC_KNOWLEDGE_ROLLED_BACK: '语义知识已回滚',
  ACCESS_ACTION_DENIED: '功能权限拒绝',
  ACCESS_CHANNEL_DENIED: '通道权限拒绝',
  ACCESS_MENU_DENIED: '页面访问拒绝',
  ANALYSIS_SCOPE_POLICY_UPDATED: '旧分析范围策略已更新',
  APPLICATION_SUPER_ADMIN_POLICY_UPDATED: '超级管理员授权已更新',
  DATA_SCOPE_GRANT_UPDATED: '数据范围授权已更新',
  DATA_SCOPE_PREVIEW_EXECUTED: '数据范围预览已执行',
  DAILY_REPORT_DELIVERY_POLICY_UPDATED: '日报投递策略已更新',
  DAILY_REPORT_DELIVERY_PREVIEW_EXECUTED: '日报投递预览已执行',
  IDENTITY_MAPPING_DIAGNOSTIC_QUERIED: '身份映射诊断已查询',
  ACCESS_PREVIEW_EXECUTED: '权限预览已执行',
  ACCESS_ROLE_PERMISSION_PUBLISHED: '角色权限已发布',
  ACCESS_ROLE_PERMISSION_UPDATED: '角色权限已更新',
  AI_MODEL_PROFILE_ACTIVATED: 'AI配置已激活',
  AI_MODEL_PROFILE_ACTIVATION_ROLLED_BACK: 'AI配置已回滚',
  AI_MODEL_PROFILE_CREATED: 'AI配置已创建',
  AI_MODEL_PROFILE_HEALTH_CHECKED: 'AI配置已测试',
  AI_MODEL_PROFILE_SECRET_CLEARED: 'AI配置密钥已清空',
  AI_MODEL_PROFILE_UPDATED: 'AI配置已更新',
  AI_CONTEXT_POLICY_READ: 'AI上下文策略已读取',
  AI_CONTEXT_POLICY_UPDATED: 'AI上下文策略已更新',
  AI_CONTEXT_POLICY_UPDATE_FAILED: 'AI上下文策略更新失败',
  AI_ANALYSIS_REQUESTED: 'AI 分析请求',
  AI_CONTEXT_READ: 'AI 上下文读取',
  AI_RESULT_EXPLAINED: 'AI 结果解释',
  AUTH_LOGIN_FAILED: '登录失败',
  AUTH_LOGIN_SUCCEEDED: '登录成功',
  CLARIFICATION_REQUESTED: '查询条件澄清',
  CONNECTION_INTERRUPTED: '连接已中断',
  CONTRACT_REVIEW_ARTIFACT_DOWNLOADED: '合同审核产物已下载',
  CONTRACT_REVIEW_FILE_UPLOADED: '合同文件已上传',
  CONTRACT_REVIEW_SOURCE_CONTRACT_VIEWED: '合同源文件已查看',
  CONTRACT_REVIEW_SOURCE_REVIEW_STARTED: '合同源文件审核已开始',
  CONTRACT_REVIEW_TASK_BLOCKED: '合同审核任务已阻断',
  CONTRACT_REVIEW_TASK_COMPLETED: '合同审核任务已完成',
  CONTRACT_REVIEW_TASK_CREATED: '合同审核任务已创建',
  CONTRACT_REVIEW_TASK_FAILED: '合同审核任务失败',
  DAILY_REPORT_ASSISTANCE_BLOCKED: '日报协助已阻断',
  DAILY_REPORT_ASSISTANCE_FAILED: '日报协助失败',
  DAILY_REPORT_ASSISTANCE_SENT: '日报协助已发送',
  DAILY_REPORT_CLOSED: '日报已关闭',
  DAILY_REPORT_CONFIRMED: '日报已确认',
  DAILY_REPORT_DELIVERY_SENT: '日报已投递',
  DAILY_REPORT_DRAFT_SAVED: '日报草稿已保存',
  DAILY_REPORT_REMINDER_SENT: '日报提醒已发送',
  DAILY_REPORT_SUMMARIZED: '日报汇总已生成',
  EXPORT_BLOCKED: '导出被阻断',
  EXPORT_SUCCEEDED: '导出成功',
  FOLLOW_UP_SHARE_CANCELLED: '跟进分享已取消',
  FOLLOW_UP_SHARE_FAILED: '跟进分享失败',
  FOLLOW_UP_SHARE_PENDING_CONFIRMATION: '跟进分享待确认',
  FOLLOW_UP_SHARE_SUCCEEDED: '跟进分享成功',
  FOLLOW_UP_WRITEBACK_CANCELLED: '跟进写回已取消',
  FOLLOW_UP_WRITEBACK_CONTENT_CONFIRMED: '跟进写回内容已确认',
  FOLLOW_UP_WRITEBACK_DRAFTED: '跟进写回草稿已生成',
  FOLLOW_UP_WRITEBACK_DUPLICATE_BLOCKED: '跟进写回重复阻断',
  FOLLOW_UP_WRITEBACK_FAILED: '跟进写回失败',
  FOLLOW_UP_WRITEBACK_INTENT_CONFIRMED: '跟进写回意图已确认',
  FOLLOW_UP_WRITEBACK_SUCCEEDED: '跟进写回成功',
  HISTORY_RERUN: '历史查询重跑',
  MANAGEMENT_REPORT_VIEWED: '经营报表已查看',
  MANAGEMENT_REPORT_EXPORTED: '经营报表已导出',
  MANAGEMENT_REPORT_SCOPE_BLOCKED: '经营报表范围阻断',
  MAINTENANCE_DEGRADED: '维护降级已触发',
  MAINTENANCE_RECOVERED: '维护能力已恢复',
  PROACTIVE_NOTIFICATION_BLOCKED: '主动通知已阻断',
  PROACTIVE_NOTIFICATION_DEDUPED: '主动通知已去重',
  PROACTIVE_NOTIFICATION_FAILED: '主动通知失败',
  PROACTIVE_NOTIFICATION_REQUESTED: '主动通知已请求',
  PROACTIVE_NOTIFICATION_SENT: '主动通知已发送',
  QUERY_BLOCKED: '查询被阻断',
  QUERY_SUCCEEDED: '查询成功',
  QUERY_TEMPLATE_COPIED: '模板已添加到我的模板',
  QUERY_TEMPLATE_FIXED_SCOPE_BLOCKED: '固定范围模板已阻断',
  QUERY_TEMPLATE_FIXED_SCOPE_REWRITTEN: '固定范围模板已改写',
  QUERY_TEMPLATE_SAVE_FAILED: '模板保存失败',
  QUERY_TEMPLATE_SAVE_SUCCEEDED: '模板保存成功',
  QUERY_TEMPLATE_TAGS_UPDATED: '模板分类标签已更新',
  QUERY_TEMPLATE_USAGE_UPDATED: '模板使用统计已更新',
  SECURITY_INTERCEPTED: '安全拦截',
  STREAM_DELIVERY_FAILED: '流式投递失败',
  TEMPLATE_EXECUTED: '模板执行',
  WECOM_AI_DRAFT_STRUCTURED: '企业微信 AI 草稿结构化',
  WECOM_AUTH_FAILED: '企业微信认证失败',
  WECOM_AUTH_SUCCEEDED: '企业微信认证通过',
  WECOM_CANDIDATE_RERANKED: '企业微信候选重排',
  WECOM_CRM_CREATE_CANCELLED: '企业微信 CRM 创建已取消',
  WECOM_CRM_CREATE_CONFIRMED: '企业微信 CRM 创建已确认',
  WECOM_CRM_CREATE_DRAFTED: '企业微信 CRM 创建草稿',
  WECOM_CRM_CREATE_DUPLICATE_BLOCKED: '企业微信 CRM 创建重复阻断',
  WECOM_CRM_CREATE_FAILED: '企业微信 CRM 创建失败',
  WECOM_CRM_CREATE_SUCCEEDED: '企业微信 CRM 创建成功',
  WECOM_DELIVERY_SUCCEEDED: '企业微信消息发送成功',
  WECOM_DIRECTORY_SYNC_FINISHED: '企业微信目录同步完成',
  WECOM_DIRECTORY_SYNC_TRIGGERED: '企业微信目录同步触发',
  WECOM_IDENTITY_RESOLVED: '企业微信身份已识别',
  WECOM_PILOT_ACCESS_DENIED: '企业微信灰度准入拒绝',
  WECOM_PILOT_POLICY_PREVIEWED: '企业微信灰度策略预览',
  WECOM_PILOT_POLICY_UPDATED: '企业微信灰度策略已更新',
  WECOM_MESSAGE_ACCEPTED: '企业微信消息已受理',
  WECOM_MESSAGE_DEDUPED: '企业微信消息已去重',
  WECOM_MESSAGE_REJECTED: '企业微信消息已拒绝',
  WECOM_SESSION_STATE_CHANGED: '企业微信会话状态变更',
  SQL_AUDIT_RAW_VIEWED: 'SQL 原始明细已查看',
};

const auditEventTypeOptions = Object.entries(auditEventTypeLabels).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

const sqlAuditStageLabels: Record<string, string> = {
  PREPARED: '已准备',
  PREFLIGHT: '执行前预检',
  EXECUTED: '已执行',
  FAILED: '执行失败',
  BLOCKED: '执行前阻断',
};

const sqlAuditDatabaseRoleLabels: Record<string, string> = {
  CRM_READONLY: 'CRM 只读库',
  CRM_WRITEBACK: 'CRM 写库',
};

const sqlAuditOperationTypeLabels: Record<string, string> = {
  SELECT: '只读查询',
  INSERT: '新增写入',
  UPDATE: '更新写入',
  DELETE: '删除写入',
  EXPLAIN: '执行前预检',
  UNKNOWN: '未识别操作',
};

const sqlAuditModuleLabels: Record<string, string> = {
  'analysis-workbench': '智能分析',
  'management-report': '经营报表',
  'audit-center': '审计中心',
  'access-governance': '权限中心',
  'contract-review': '合同审核',
  'crm-identity': 'CRM 身份解析',
  'wecom-directory-sync': '企业微信目录同步',
  'wecom-bot': '企业微信机器人',
  'wecom-auth': '企业微信登录绑定',
  'daily-report': '日报能力',
  'auth-phone-repair': '登录兜底修复',
  'crm-readonly': 'CRM 只读底座',
  system: '系统任务',
};

const entrySceneLabels: Record<string, string> = {
  WEB_ANALYSIS_FOLLOW_UP: 'Web 分析追问',
  WEB_ANALYSIS_QUERY: 'Web 分析问数',
  WECOM_ACTIVE_TASK_REPLY: '企业微信活跃任务回复',
  WECOM_DAILY_REPORT_ENTRY: '企业微信日报入口',
  WECOM_IDLE_MESSAGE: '企业微信空闲消息',
};

const workflowLabels: Record<string, string> = {
  ANALYSIS_BLOCKED: '分析请求阻断',
  ANALYSIS_CLARIFICATION: '分析补充条件',
  ANALYSIS_QUERY_EXECUTION: '分析问数执行',
  ANALYSIS_RESULT_EXPLANATION: '分析结果解释',
  WECOM_CRM_CREATE_CUSTOMER: '企业微信新增客户',
  WECOM_CRM_CREATE_OPPORTUNITY: '企业微信新增商机',
  WECOM_DAILY_REPORT_ENTRY: '企业微信日报入口',
  WECOM_DAILY_REPORT_QUERY: '企业微信日报查询',
  WECOM_HELP_GUIDANCE: '企业微信帮助引导',
  WECOM_OPPORTUNITY_LOOKUP: '企业微信商机查询',
  WECOM_TASK_ROUTER: '企业微信任务路由',
  WECOM_TEAM_DAILY_REPORT_QUERY: '企业微信团队日报查询',
};

const fallbackReasonLabels: Record<string, string> = {
  'active-conversation-flow-continue': '活跃会话流程继续',
  'ai-unavailable-or-invalid': 'AI 不可用或返回无效',
  'confidence-too-low': 'AI 置信度不足',
  'empty-or-unsafe-intent': '意图为空或不安全',
  'semantic-timeout': '语义理解超时',
};

const executionModeLabels: Record<string, string> = {
  AI_HYBRID: 'AI 规则提示词审核',
  BLOCKED: '审核阻断',
  DETERMINISTIC_ONLY: '规则快审',
  GUARDED_DIRECT_QUERY: '受控直查',
  PLAN_EXECUTION: '计划编排执行',
};

const executionSourceLabels: Record<string, string> = {
  CRM_OFFICIAL_API: 'CRM 官方 API',
  CRM_SQLITE_READONLY: 'CRM SQLite 只读库',
  GUARDED_READONLY_SQL: '受控只读 SQL',
  ANALYSIS_WAREHOUSE: 'AI-agent 分析库',
  INTERNAL_READONLY_API: '内部只读 API',
};

const actionTypeLabels: Record<string, string> = {
  COPY: '复制结果',
  DETAIL: '查看详情',
  DOWNLOAD: '下载文件',
  EXPORT: '导出结果',
  FOLLOW_UP: '继续追问',
  RERUN: '重新运行',
};

const viewTypeLabels: Record<string, string> = {
  BAR_CHART: '柱状图',
  DETAIL_TABLE: '明细表',
  DISTRIBUTION: '分布视图',
  LINE_CHART: '折线图',
  RANKING_TABLE: '排名表',
  SUMMARY: '摘要视图',
  TABLE: '表格',
  TREND: '趋势视图',
};

const streamBlockTypeLabels: Record<string, string> = {
  COMPLETE: '完成',
  ERROR: '异常',
  EXPLANATION: '解释说明',
  PROCESSING_NOTICE: '处理提示',
  SUMMARY: '摘要',
  TABLE_SEGMENT: '表格片段',
};

const reviewStatusLabels: Record<string, string> = {
  APPROVED: '已通过',
  PENDING: '待复核',
  REJECTED: '已拒绝',
  REVIEWED: '已复核',
};

const textReplacementLabels: Record<string, string> = {
  ...auditEventTypeLabels,
  ...entrySceneLabels,
  ...workflowLabels,
  ...fallbackReasonLabels,
  ...identityMappingStatusLabels,
  ...permissionMenuLabels,
  ...permissionActionLabels,
  ...sqlAuditStageLabels,
  ...sqlAuditDatabaseRoleLabels,
  ...sqlAuditOperationTypeLabels,
  ...sqlAuditModuleLabels,
  ...riskLevelLabels,
  ...auditLevelLabels,
  ...executionModeLabels,
  ...executionSourceLabels,
  ...actionTypeLabels,
  ...viewTypeLabels,
  ...serviceStatusLabels,
  ...analysisStatusLabels,
  ...policyStatusLabels,
  ...wecomPilotModeLabels,
  ...wecomAccessStateLabels,
  ...streamBlockTypeLabels,
  ...reviewStatusLabels,
  'errcode=846607 aibot send msg frequency limit exceeded': '企业微信机器人发送频率超限',
  'aibot send msg frequency limit exceeded': '企业微信机器人发送频率超限',
  'errcode=846607': '企业微信机器人发送频率超限',
  846607: '企业微信机器人发送频率超限',
};

/**
 * 规范化接口返回的业务代码，参数允许字符串、空值或未定义，返回去空格后的代码或空值。
 */
function normalizeBusinessCode(value: BusinessCodeValue): string | undefined {
  const code = typeof value === 'string' ? value.trim() : '';

  // 空字符串等同于接口未返回该维度，页面应显示占位而不是未知码。
  if (!code) {
    return undefined;
  }

  return code;
}

/**
 * 按指定业务字典格式化代码，参数为原始代码、分类字典和未知兜底名称，返回中文标签。
 */
function formatBusinessCode(
  value: BusinessCodeValue,
  dictionary: Record<string, string>,
  unknownLabel: string,
): string {
  const code = normalizeBusinessCode(value);

  // 空值保留统一占位，避免把可选字段误报为未知业务代码。
  if (!code) {
    return emptyLabel;
  }

  return dictionary[code] ?? `未知${unknownLabel}（${code}）`;
}

/**
 * 将服务状态代码转换为中文，参数为 `ONLINE`、`DEGRADED`、`OFFLINE` 等状态码。
 */
function formatServiceStatusLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, serviceStatusLabels, '服务状态');
}

/**
 * 将分析结果状态转换为中文，参数为 `RETURNED`、`BLOCKED`、`QUEUED` 等状态码。
 */
function formatAnalysisStatusLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, analysisStatusLabels, '分析状态');
}

/**
 * 将策略或模板状态转换为中文，参数为 `ACTIVE`、`INACTIVE`、`DISABLED` 等状态码。
 */
function formatPolicyStatusLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, policyStatusLabels, '状态');
}

function formatDailyReportDepartmentTypeLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, dailyReportDepartmentTypeLabels, '部门类型');
}

function formatWecomPilotModeLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, wecomPilotModeLabels, '企业微信灰度模式');
}

function formatWecomAccessStateLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, wecomAccessStateLabels, '企业微信入口状态');
}

function formatIdentityMappingStatusLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, identityMappingStatusLabels, '映射状态');
}

function formatPermissionMenuLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, permissionMenuLabels, '菜单');
}

function formatPermissionActionLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, permissionActionLabels, '动作');
}

function formatSqlAuditStageLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, sqlAuditStageLabels, 'SQL 审计阶段');
}

function formatSqlAuditDatabaseRoleLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, sqlAuditDatabaseRoleLabels, '数据库角色');
}

function formatSqlAuditOperationTypeLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, sqlAuditOperationTypeLabels, 'SQL 操作类型');
}

function formatSqlAuditModuleLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, sqlAuditModuleLabels, 'SQL 审计模块');
}

/**
 * 将风险等级转换为中文，参数为 `LOW`、`MEDIUM`、`HIGH` 等等级码。
 */
function formatRiskLevelLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, riskLevelLabels, '风险等级');
}

/**
 * 将审计建议等级转换为中文，参数为 `info`、`warning`、`critical` 等等级码。
 */
function formatAuditLevelLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, auditLevelLabels, '提示等级');
}

/**
 * 将审计事件类型转换为中文，参数为 `QUERY_BLOCKED`、`AUTH_LOGIN_SUCCEEDED` 等事件码。
 */
function formatAuditEventTypeLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, auditEventTypeLabels, '事件类型');
}

/**
 * 将 AI 入口场景转换为中文，参数为 `WEB_ANALYSIS_QUERY`、`WECOM_IDLE_MESSAGE` 等场景码。
 */
function formatEntrySceneLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, entrySceneLabels, '入口场景');
}

/**
 * 将入口目标或程序工作流转换为中文，参数为 `ANALYSIS_QUERY_EXECUTION` 等工作流码。
 */
function formatWorkflowLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, workflowLabels, '工作流');
}

/**
 * 将 fallback 原因转换为中文，参数为 `ai-unavailable-or-invalid` 等原因码。
 */
function formatFallbackReasonLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, fallbackReasonLabels, 'AI 兜底原因');
}

/**
 * 将执行模式转换为中文，参数为 `PLAN_EXECUTION`、`AI_HYBRID` 等模式码。
 */
function formatExecutionModeLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, executionModeLabels, '执行模式');
}

/**
 * 将执行来源转换为中文，参数为 `CRM_OFFICIAL_API`、`GUARDED_READONLY_SQL` 等来源码。
 */
function formatExecutionSourceLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, executionSourceLabels, '执行来源');
}

/**
 * 将可执行动作类型转换为中文，参数为 `EXPORT`、`FOLLOW_UP` 等动作码。
 */
function formatActionTypeLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, actionTypeLabels, '动作类型');
}

/**
 * 将视图类型转换为中文，参数为 `RANKING_TABLE`、`BAR_CHART` 等视图码。
 */
function formatViewTypeLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, viewTypeLabels, '视图类型');
}

/**
 * 将结果流式块类型转换为中文，参数为 `PROCESSING_NOTICE`、`SUMMARY` 等块类型。
 */
function formatStreamBlockTypeLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, streamBlockTypeLabels, '结果块类型');
}

/**
 * 将复核状态转换为中文，参数为 `PENDING`、`REVIEWED` 等复核状态码。
 */
function formatReviewStatusLabel(value: BusinessCodeValue): string {
  return formatBusinessCode(value, reviewStatusLabels, '复核状态');
}

/**
 * 替换接口文案中夹带的已知业务代码，参数为原始文案，返回适合用户阅读的中文文案。
 */
function formatBusinessCodeText(value: BusinessCodeValue): string {
  const text = normalizeBusinessCode(value);

  // 文案为空时沿用占位，避免卡片和提示出现空白。
  if (!text) {
    return emptyLabel;
  }

  return Object.entries(textReplacementLabels).reduce(
    (result, [code, label]) => result.split(code).join(label),
    text,
  ).replace(/fallback/gu, 'AI 兜底');
}

export {
  auditEventTypeOptions,
  formatActionTypeLabel,
  formatAnalysisStatusLabel,
  formatAuditEventTypeLabel,
  formatAuditLevelLabel,
  formatBusinessCodeText,
  formatDailyReportDepartmentTypeLabel,
  formatEntrySceneLabel,
  formatExecutionModeLabel,
  formatExecutionSourceLabel,
  formatFallbackReasonLabel,
  formatIdentityMappingStatusLabel,
  formatPermissionActionLabel,
  formatPermissionMenuLabel,
  formatPolicyStatusLabel,
  formatReviewStatusLabel,
  formatRiskLevelLabel,
  formatSqlAuditDatabaseRoleLabel,
  formatSqlAuditModuleLabel,
  formatSqlAuditOperationTypeLabel,
  formatSqlAuditStageLabel,
  formatServiceStatusLabel,
  formatStreamBlockTypeLabel,
  formatViewTypeLabel,
  formatWecomAccessStateLabel,
  formatWecomPilotModeLabel,
  formatWorkflowLabel,
};
