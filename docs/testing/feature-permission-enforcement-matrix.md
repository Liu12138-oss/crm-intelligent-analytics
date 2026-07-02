# 功能权限覆盖矩阵

## 目的

本文档用于说明权限中心当前的管理员配置口径：以菜单权限包为主，只保留少量风险子权限。实现层仍会生成旧运行时字段，供现有页面、接口、企业微信工作流、审计拒绝和回滚场景继续消费。

当前判定口径固定为：

- 角色状态：只有 `ACTIVE` 角色参与用户最终权限合并。
- 菜单权限包：决定 Web 页面入口、普通读取和该菜单下常规维护能力。
- 风险子权限：只控制导出、查看他人合同、下载他人合同或审核产物。
- 企业微信机器人：作为移动端入口包配置，但仍受企业微信灰度、停用名单、身份映射、对象级授权、确认和幂等限制。

## 菜单包到运行时字段映射

| 管理员配置 | 生成菜单 | 生成动作 / 兼容字段 | 主要覆盖场景 |
| --- | --- | --- | --- |
| 智能分析 | `analysis-workbench` | `analysis.use`、`analysis.follow_up`、`template.view` | Web 问数、结果详情、继续追问、常用查询 |
| 智能分析 / 导出数据 | `analysis-workbench` | `analysis.export`、`exportAllowed=true` | 分析结果导出，仍受行数和每日次数限制 |
| 经营报表 | `management-report` | `management.report.view` | 报表查询、专题切换、详情查看 |
| 经营报表 / 导出数据 | `management-report` | `management.report.export` | 经营报表导出，仍写导出审计 |
| 智能合同审核 | `contract-review` | `contract.review.upload`、`contractReviewUploadAllowed=true` | CRM 合同列表、发起审核任务、本人任务查看 |
| 智能合同审核 / 查询他人合同 | `contract-review` | `contract.review.cross_view`、`contractReviewCrossViewAllowed=true` | 非本人合同审核详情查看 |
| 智能合同审核 / 下载他人合同或审核产物 | `contract-review` | `contract.review.cross_download`、`contractReviewCrossDownloadAllowed=true` | 非本人审核产物下载 |
| 企业微信机器人 | 无 Web 菜单 | `wecomBotEligible=true` 与当前 `wecom.*` 动作 | 企业微信问数、新增客户、新增商机、跟进写回、日报预览入口资格 |
| 权限中心 | `permission-center` | `governance.policy.manage` | 角色权限、企业微信准入、数据范围、日报治理 |
| 查询模板管理 | `template-governance` | `template.manage`、`templateManageAllowed=true` | 查询模板新增、编辑、删除、启停 |
| 连接策略 | `connection-policy` | `governance.policy.manage` | 会话、并发、心跳、保留周期配置 |
| AI配置 | `ai-model-governance` | `ai_profile.manage` | AI Profile、上下文策略、模型测试 |
| 审计中心 | `audit-center` | `audit.view`、`audit.sql.view`、`audit.sql.view_sensitive` | AI 审计、用户行为审计、SQL 审计和敏感明细 reveal |

## 派生与清理规则

| 规则 | 期望结果 | 覆盖测试 |
| --- | --- | --- |
| 任意 Web 菜单被勾选 | 派生 `webConsoleEnabled=true` | `simplified-permission-profile.spec.ts` |
| 没有任何 Web 菜单 | 派生 `webConsoleEnabled=false` | `simplified-permission-profile.spec.ts` |
| 主菜单取消勾选 | 清理该菜单下导出、查询他人合同、下载他人产物等风险子权限 | 后端映射单测、前端抽屉单测 |
| 历史仅有 `webConsoleEnabled=true` 但没有菜单 | 回显为空菜单并返回 `WEB_CONSOLE_WITHOUT_MENU` 提示 | 后端集成测试、前端抽屉单测 |
| 旧字段载荷保存 | 继续接受旧 `visibleMenus`、`actionKeys`、兼容布尔字段 | `access-governance.integration-spec.ts` |
| 简化树载荷保存 | 统一生成旧运行时字段 | `access-governance.integration-spec.ts` |

## 风险动作执行点

| 风险动作 | 前端控制 | 后端控制 | 审计要求 |
| --- | --- | --- | --- |
| 智能分析导出数据 | 导出按钮可用态 | `ExportPolicyService.evaluate`、`ExportService.createExport` | 超限、无权限和成功导出均留痕 |
| 经营报表导出数据 | 经营报表导出按钮可用态 | `ManagementReportService.exportReport` | 导出成功和拒绝均留痕 |
| 查询他人合同 | 合同详情入口与提示 | `ContractReviewService.getTaskDetail` | 被拒绝时写权限拒绝事件 |
| 下载他人合同或审核产物 | 产物下载按钮可用态 | `ContractReviewService.getArtifactDownload` | 下载成功和拒绝均留痕 |

## 企业微信机器人包边界

勾选企业微信机器人只代表角色层具备机器人入口资格，不代表绕过执行链路。以下约束必须继续成立：

1. 企业微信签名、来源和消息结构先校验。
2. 企业微信用户必须映射到有效 CRM 用户。
3. 灰度模式 `DISABLED`、`PILOT_ONLY`、`FULL` 和用户级停用名单仍优先判断。
4. 问数结果继续按 CRM 当前数据范围收口。
5. 新增客户、新增商机、跟进写回仍需字段抽取、候选确认、用户确认和对象级授权。
6. 日报预览继续按 CRM 身份、负责人关系和日报治理策略计算范围。

## 回归清单

1. 勾选 `智能分析` 后可进入 `/analysis`，可问数、看详情、继续追问、查看常用查询和最近查询。
2. 未勾选 `智能分析 / 导出数据` 时前后端均阻断导出；勾选后仍受行数和每日次数限制。
3. 勾选 `经营报表` 后可进入 `/management-report`，可查询报表和切换专题。
4. 未勾选 `经营报表 / 导出数据` 时前后端均阻断导出；勾选后保留导出审计。
5. 勾选 `智能合同审核` 后可访问本人范围合同审核；未勾选跨查看或跨下载时，他人合同详情和产物下载仍被阻断。
6. 勾选系统维护菜单后，对应页面常规维护能力可用。
7. 勾选 `审计中心` 后 SQL 审计和敏感明细 reveal 可用，reveal 必须新增审计事件。
8. 勾选 `企业微信机器人` 后仍不能绕过灰度、停用名单、身份映射、对象级授权和确认门闩。
