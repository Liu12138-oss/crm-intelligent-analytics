## Why

当前仓库已经落地权限中心页面、角色能力矩阵、企业微信灰度、用户权限预览和身份映射诊断，但这套矩阵还没有完整接到所有真实执行链路。系统里仍然存在“前端菜单隐藏了但后端接口还能调”“权限中心里配了动作，但对应功能仍按旧的管理员硬编码或全局策略判断”“企业微信通道已准入，但不同工作流没有按具体动作继续收口”的问题。随着权限中心已经进入可操作状态，下一步必须把页面上的权限操作真正落实到用户可执行的功能上，否则权限治理只停留在展示层，会持续制造越权风险、排障困难和验收口径不一致。

## What Changes

- 建立一条独立的“功能权限收口”变更，把权限中心中的 `30` 个权限点从“可配置”推进到“可执行”，明确每个权限点对应的后端执行点、前端入口点和审计留痕要求。
- 新增统一的权限执行收口能力，要求菜单、基础开关和动作权限必须分别承担明确职责：
  - 基础开关负责角色是否参与聚合、Web/企微通道准入和少量派生布尔能力；
  - 菜单负责导航显隐和页面级基础访问资格；
  - 动作负责后端真实执行校验，不允许再只在前端藏按钮。
- 将当前仍走旧逻辑的功能改造为消费统一权限矩阵，包括：
  - 智能分析首次问数、继续追问、导出结果、模板可见；
  - 审计中心访问；
  - AI 模型治理访问；
  - 治理策略访问；
  - 企业微信新增客户、新增商机、跟进写回、日报预览；
  - 合同审核工作台/本人任务详情的基础访问资格。
- 收敛“管理员硬编码”“全局角色白名单”“旧导出角色配置”“仅前端路由限制”等散落判断，统一迁移到 `AccessDecisionService` 或等价的统一权限执行服务上，保证权限中心是运行时真源。
- 明确企业微信通道准入与工作流动作校验是两层门槛：`wecomBotEligible` / 灰度命中只决定“能不能进企业微信入口”，不能再代表“该入口里所有能力都可用”；企业微信分析、客户创建、商机创建、跟进写回、日报预览必须再按各自动作独立校验。
- 为所有新接入的拒绝场景补权限拒绝审计，记录具体权限点、目标资源、拒绝原因和命中角色，保证管理员能从权限中心和审计中心解释“为什么这个人进得来页面但点不了功能”或“为什么这个人根本不能进入某个功能”。
- 补充权限覆盖矩阵与回归验证清单，确保权限中心里每个可操作权限点都至少能映射到一个真实功能执行点，不再留下“页面能配、系统不认”的死配置。

## Capabilities

### New Capabilities
- `feature-permission-enforcement`: 定义权限中心 30 个权限点到真实页面、接口、企业微信工作流和后端执行点的统一映射、统一校验、拒绝审计和覆盖验证要求。

### Modified Capabilities
- `controlled-analysis-orchestration`: 将首次问数、继续追问、导出结果和模板可见改为消费统一动作权限，而不是继续混用旧的全局策略和前端按钮显隐。
- `contract-review-auditability`: 将合同审核工作台基础访问、上传、跨任务查看和跨任务下载统一收口到权限矩阵，补足本人任务详情访问的后端资格控制。
- `ai-model-profile-governance`: 将 AI 模型治理的访问控制从“管理员硬编码”调整为 `ai_profile.manage` 动作治理。
- `wecom-customer-create-chat`: 将企业微信新增客户及对应受控创建入口接入 `wecom.customer.create` 权限校验。
- `wecom-opportunity-create-chat`: 将企业微信新增商机及对应受控创建入口接入 `wecom.opportunity.create` 权限校验。
- `wecom-follow-up-guided-template`: 将企业微信跟进草稿、确认写回、失败重试和二次执行接入 `wecom.followup.writeback` 权限校验。
- `wecom-on-demand-team-daily-report-delivery`: 将个人日报预览、小组日报预览和相关企业微信预览链路接入 `wecom.daily_report.preview` 权限校验。

## Impact

- 影响后端 `backend/src/modules/governance`、`analysis`、`export`、`query-assets`、`audit`、`ai-models`、`contract-review`、`opportunities`、`wecom`、`daily-report`、`sessions` 等模块，需要把分散的权限判断收敛到统一权限执行服务。
- 影响前端 `AppShell`、`router`、`auth.store`、智能分析结果页、合同审核工作台、治理后台和权限中心，需要让菜单显隐、按钮可用态和后端拒绝提示与统一权限快照保持一致。
- 影响若干已有接口的鉴权语义，包括但不限于：
  - `GET /analysis/templates`
  - `POST /analysis/queries/:queryId/exports`
  - `GET /audit-events`
  - `/governance/policies/*`
  - `/governance/ai-models/*`
  - `POST /crm/customers`
  - `POST /crm/opportunities`
  - `GET /contract-reviews/tasks/:taskId`
  - `GET /contract-reviews/tasks/:taskId/artifacts/:artifactId/download`
  - 企业微信机器人中的分析、创建、跟进写回和日报预览工作流
- 影响现有运行时兼容逻辑，需要处理旧的 `policy.exportRoleIds`、`user.exportAllowed`、`isAdmin`、模板 `visibleRoleIds` 和环境变量导出的兼容迁移，确保切换到统一权限真源时不会把现有已开通功能误关掉。
- 影响测试与验收，需要新增“权限点覆盖矩阵”“前后端一致性回归”“通道准入与动作准入分层验证”“管理员撤权后立即生效”的验证场景。
