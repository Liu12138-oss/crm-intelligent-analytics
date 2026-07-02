## Context

当前系统已经通过 `add-access-governance-and-wecom-pilot-control` 这条变更引入了权限中心页面、角色权限矩阵、企业微信灰度策略、用户权限预览和身份映射诊断，但权限收口仍处于“半完成”状态：

- `AccessDecisionService` 已经能按角色矩阵输出 `visibleMenus`、`actionKeys`、`contractPermissions` 和企业微信入口决策，但很多业务模块还没有在真实执行前调用它。
- 前端菜单和路由已经开始消费 `visibleMenus / actionKeys`，但对很多页面来说，当前仍属于“入口隐藏”，而不是“后端真正禁止调用”。
- 后端仍混用以下旧逻辑：
  - `user.isAdmin`
  - `policy.enabledRoleIds`
  - `policy.exportRoleIds`
  - `user.exportAllowed`
  - 查询模板自身的 `visibleRoleIds`
  - 企业微信通道准入只判断“是否命中任一 `wecom.*` 动作”
- 权限中心里已有的权限点一共 30 个，分为三类：
  - 基础开关 8 个：`status`、`webConsoleEnabled`、`wecomBotEligible`、`exportAllowed`、`templateManageAllowed`、`contractReviewUploadAllowed`、`contractReviewCrossViewAllowed`、`contractReviewCrossDownloadAllowed`
  - 菜单可见性 6 个：`analysis-workbench`、`contract-review`、`template-governance`、`permission-center`、`audit-center`、`ai-model-governance`
  - 动作权限 16 个：`analysis.use`、`analysis.follow_up`、`analysis.export`、`template.view`、`template.manage`、`wecom.analysis.use`、`wecom.customer.create`、`wecom.opportunity.create`、`wecom.followup.writeback`、`wecom.daily_report.preview`、`governance.policy.manage`、`audit.view`、`ai_profile.manage`、`contract.review.upload`、`contract.review.cross_view`、`contract.review.cross_download`

目前真正接入后端校验的只是一部分：

- 已较完整接入：`analysis.use`、`template.manage`、`contract.review.upload`、`contract.review.cross_view`、`contract.review.cross_download`、`webConsoleEnabled`、`wecomBotEligible`
- 仍走旧逻辑或只有前端限制：`analysis.follow_up`、`template.view`、`audit.view`、`ai_profile.manage`、`governance.policy.manage`、`wecom.customer.create`、`wecom.opportunity.create`、`wecom.followup.writeback`、`wecom.daily_report.preview`

这次设计的核心不是新增更多权限点，而是让现有 30 个权限点都具备明确的“运行时语义”和“执行点”，做到：

1. 管理员在权限中心里改了什么，系统下一次请求就按什么执行。
2. 页面上看到什么、能点什么、接口是否放行，这三者是一致的。
3. 企业微信通道准入与工作流动作准入清晰分层，不再出现“进了机器人就什么都能干”。
4. 旧的管理员硬编码和遗留策略要么纳入兼容迁移，要么逐步移除，不能长期双轨并存。

## Goals / Non-Goals

**Goals:**

- 将权限中心中的 30 个权限点全部映射到明确的运行时控制语义和真实执行点。
- 让“菜单显隐、页面访问、按钮可点、接口放行、企业微信工作流放行”消费同一套有效权限结果。
- 将仍走 `isAdmin`、`policy.exportRoleIds`、`policy.enabledRoleIds`、`visibleRoleIds` 的能力逐步迁移到统一权限矩阵。
- 区分“通道准入”和“动作准入”：Web/企微入口只是第一层，进入后仍要按具体动作控制。
- 为所有新增权限拒绝补齐标准化审计事件和中文拒绝原因。
- 形成可执行的权限覆盖矩阵，确保每个权限点至少落到一个真实页面或接口。

**Non-Goals:**

- 不新增新的权限点，不把当前 30 个配置维度扩展成更复杂的 RBAC/ABAC 平台。
- 不重新设计 CRM 组织树、部门树、负责人树和数据范围；数据范围仍然由 CRM 实时上下文决定。
- 不在本次变更里重写登录、会话和统一鉴权装载链路，只在会话后的能力决策和业务执行前加权限门闩。
- 不把所有菜单权限都升级成独立动作点；一期仍允许“菜单权限”承担页面级基础访问资格，但必须有明确使用边界。
- 不在这次变更里处理企业微信组织同步、CRM 身份映射算法本身或 AI 入口语义理解问题，除非它们直接影响权限执行。

## Decisions

### 决策 1：建立“权限点 -> 运行时语义 -> 执行点”的统一映射表

本次变更引入一份仓库内的权限覆盖清单，由后端常量和测试共同消费。每个权限点都必须标明：

- 权限类别：基础开关 / 菜单 / 动作
- 真正作用：通道准入 / 页面基础访问 / 具体动作执行 / 扩展访问
- 前端消费点：菜单、路由、按钮、禁用提示
- 后端消费点：controller/service/workflow guard
- 审计事件：允许/拒绝时应写什么事件

这份映射不是给用户看的字典，而是给代码和测试用的“执行责任表”。它解决两个问题：

1. 防止再出现“权限中心可配，但业务模块没人接”的死配置。
2. 防止同一个权限点被多个旧逻辑分裂解释。

典型映射示例：

| 权限点 | 运行时语义 | 执行点 |
|---|---|---|
| `analysis.use` | Web/企微分析执行资格 | `AnalysisService.createQuery` 前 |
| `analysis.follow_up` | 基于已有结果继续追问资格 | 追问意图分流后、进入 follow-up 前 |
| `analysis.export` | 导出发起资格 | `ExportService.createExport` |
| `template.view` | 分析页模板列表可见资格 | `QueryTemplateService.listVisible` |
| `audit.view` | 审计中心数据读取资格 | `AuditController.listAuditEvents` |
| `ai_profile.manage` | AI 模型治理接口资格 | `AiModelGovernanceController` |
| `wecom.customer.create` | 企业微信新增客户资格 | `CustomerCreateController` 与企微客户创建工作流 |
| `wecom.followup.writeback` | 企微跟进写回资格 | 企微写回草稿创建、确认执行、失败重试 |
| `wecom.daily_report.preview` | 企微个人/团队日报预览资格 | `WecomBotService.handleDailyReportPreviewQuery` 与团队预览分支 |

### 决策 2：统一权限矩阵成为功能权限真源，旧逻辑只允许短期兼容

后端所有“是否允许执行某功能”的判断，最终必须收敛到：

- `AccessDecisionService.buildDecision(...)`
- `AccessDecisionService.hasAction(...)`
- `AccessDecisionService.ensureAction(...)`

以及必要时对 `visibleMenus` 的页面级基础访问判断。

兼容策略如下：

- `policy.exportRoleIds`、`user.exportAllowed` 允许在迁移期继续参与导出判定，但必须包在“统一权限结果之后”，并在 design/tasks 中列为待移除项。
- `isAdmin` 允许在迁移期继续用于初始化默认角色权限，但不得再作为治理接口的唯一放行条件。
- 模板自身的 `visibleRoleIds` 继续保留，用于模板资源级可见性；但用户是否有资格看模板列表，必须先命中 `template.view`。

也就是说，最终判定顺序固定为：

```text
登录与会话鉴权
-> CRM 实时用户上下文
-> 统一权限决策（菜单 / 动作 / 通道）
-> 功能级兼容条件（如导出限额、模板资源级 visibleRoleIds）
-> 最终执行 / 拒绝审计
```

### 决策 3：区分“通道准入”和“工作流动作准入”

当前企业微信链路最大的问题是：一旦某用户命中 `wecomBotEligible` 且拥有任意 `wecom.*` 动作，就可能进入机器人后使用多个工作流。这与权限中心里的细分动作不一致。

新规则固定为两层：

1. **通道准入**
   - Web：`status=ACTIVE + webConsoleEnabled`
   - 企微：`status=ACTIVE + wecomBotEligible + 灰度/停用名单`
2. **工作流动作准入**
   - 企微分析：`wecom.analysis.use`
   - 新增客户：`wecom.customer.create`
   - 新增商机：`wecom.opportunity.create`
   - 跟进写回：`wecom.followup.writeback`
   - 日报预览：`wecom.daily_report.preview`

这样，用户可以：

- 命中企微通道，但只能看日报预览，不能问数；
- 命中企微通道和问数，但不能新增客户；
- 命中企微通道和客户创建，但不能写回跟进。

这是让“页面上的动作权限”真正控制“用户在机器人里能做什么”的关键。

### 决策 4：页面菜单权限继续保留，但必须定义后端使用边界

当前 6 个菜单权限不会在这次变更中扩成新的动作点，但要明确它们的后端语义：

- `analysis-workbench`
  - 用于 Web 分析页及结果详情页的基础进入资格
  - 真正执行仍必须额外命中 `analysis.use` / `analysis.follow_up`
- `contract-review`
  - 用于合同审核工作台、本人任务详情的基础进入资格
  - 上传、跨任务查看、跨任务下载仍要继续命中各自动作
- `permission-center`
  - 前端导航入口；后端真正权限仍是 `governance.policy.manage`
- `audit-center`
  - 前端导航入口；后端真正权限仍是 `audit.view`
- `ai-model-governance`
  - 前端导航入口；后端真正权限仍是 `ai_profile.manage`
- `template-governance`
  - 前端导航入口；后端真正权限仍是 `template.manage`

其中“合同审核工作台 / 本人任务详情”是一个明确缺口：目前后端主要靠“任务属于自己”放行，而没有页面级基础访问资格。此次变更要求补齐这个门槛。

### 决策 5：系统级页面接口全部从“管理员硬编码”迁移到动作权限

以下接口不再以 `user.isAdmin` 为真源：

- 治理策略：`governance.policy.manage`
- 权限中心：`governance.policy.manage`
- 审计中心：`audit.view`
- AI 模型治理：`ai_profile.manage`

保留的唯一管理员语义是：

- 初始化默认角色权限时，带“管理员”字样的 CRM 角色可获得一套迁移默认值；
- 权限中心预览与审计里可以展示“管理员角色”的说明文案。

运行时放行必须依赖动作，而不是“名字里含管理员”。

### 决策 6：所有权限拒绝都要生成“可排障”的审计与文案

每个新增的拒绝点都必须返回：

- 中文拒绝原因
- 命中的权限点
- 若为企业微信，还要包含 `state`
- 审计里记录：用户、角色、权限点、资源、拒绝原因、时间

建议新增统一拒绝事件类型：

- `ACCESS_ACTION_DENIED`
- `ACCESS_MENU_DENIED`
- `ACCESS_CHANNEL_DENIED`

以及在现有事件中补充 `permissionKey`、`resourceType`、`resourceId`、`channel`。

这样权限中心和审计中心才能真正解释：

- 为什么有菜单但点不动；
- 为什么 Web 能进但企业微信不能用；
- 为什么能看自己合同但不能下载别人产物。

### 决策 7：权限覆盖回归必须按“权限点覆盖矩阵”组织，而不是按页面随机点测

这次变更的验收不能只看页面，因为大量漏口都在后端 controller/service/workflow。

验收矩阵至少包括：

- `30 个权限点` 是否各自映射到一个真实执行点
- 前端菜单/路由是否与后端放行一致
- 权限中心预览结果是否与真实接口行为一致
- 权限变更后下一次请求是否立即生效
- 企业微信通道准入与工作流动作准入是否正确分层

推荐测试分层：

- 单元测试：`AccessDecisionService`、feature guards
- 集成测试：controller/service 拒绝与放行
- 前端单测：菜单、路由、按钮显隐
- 端到端验收：真实账号/角色矩阵联调

## Risks / Trade-offs

- [风险] 旧逻辑和新矩阵双轨并行期间可能出现“前端显示允许、后端仍按旧逻辑拒绝”
  - 缓解：先建立权限点映射表和覆盖测试，再逐模块替换；每替换一条链路都要补集成测试
- [风险] `isAdmin` 去硬编码后，历史管理员角色若未同步配置动作，可能短期失去治理入口
  - 缓解：增加迁移脚本/默认回填，并在切换前跑权限预览演练
- [风险] `template.view`、`analysis.export` 等旧逻辑切到新矩阵后，已有用户感知到能力变化
  - 缓解：迁移期保留兼容判定，并在审计中记录旧/新结果差异
- [风险] 企业微信工作流动作分层后，首批试点用户可能“能进机器人但部分功能不能用”，带来理解成本
  - 缓解：统一拒绝文案，明确提示“当前仅开放日报预览/问数/创建中的某一类能力”
- [风险] 合同审核“本人任务可见”如果引入基础访问资格，历史任务访问语义会变化
  - 缓解：先与业务确认“撤权后是否仍允许查看历史本人任务”，未确认前保留兼容开关

## Migration Plan

1. 新增权限点映射表、拒绝审计字段和统一 helper，但暂不替换旧判断。
2. 先替换系统级接口：
   - 审计中心
   - AI 模型治理
   - 治理策略
   - 模板可见列表
3. 再替换分析与导出链：
   - `analysis.use`
   - `analysis.follow_up`
   - `analysis.export`
4. 再替换合同审核链：
   - 工作台基础访问
   - 上传
   - 跨任务查看/下载
5. 最后替换企业微信工作流链：
   - 分析
   - 新增客户
   - 新增商机
   - 跟进写回
   - 日报预览
6. 灰度观察一轮权限拒绝审计与权限中心预览结果，确认“预览结果 = 真实执行结果”后，再移除旧的管理员/全局角色硬编码。

回滚策略：

- 每条链路的旧判断保留在切换期分支中；
- 若上线后出现大面积误拒绝，可按模块回退到旧判断，但必须保留新审计字段和差异日志，便于后续修正再切回。

## Open Questions

- `contract-review` 菜单是否应被视为“本人合同任务基础访问资格”的后端真源，还是允许被撤权用户继续看自己的历史任务？当前需要业务明确。
- `/crm/customers` 与 `/crm/opportunities` 如果未来提供 Web 页面入口，是否继续复用 `wecom.customer.create / wecom.opportunity.create`，还是拆分 Web 专属动作？当前建议先复用，后续再按渠道拆分。
- `analysis.follow_up` 是否只控制“基于已有结果继续追问”，还是也要覆盖解释型追问与条件改写追问两个子路径？当前设计默认都要覆盖，但需要在实现时统一定义 follow-up 入口。
