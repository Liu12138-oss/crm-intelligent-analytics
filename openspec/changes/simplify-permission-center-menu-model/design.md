## Context

当前权限中心已经把 `36` 个权限点逐步接入真实页面、接口和企业微信工作流，解决了早期“页面能配置但系统不消费”的问题。但管理员界面仍然直接暴露底层实现形态：基础开关、菜单可见性、动作权限、兼容布尔字段并列存在。一个业务功能经常需要同时勾选入口、菜单和动作，例如进入智能分析需要 `Web 入口`、`智能分析`、`分析问数`，使用常用模板还需要 `模板可见`，导出又需要 `导出权限` 和 `导出结果`。这种设计对系统实现是清晰的，但对管理员配置不友好。

本次设计的核心原则是：**降低管理员配置复杂度，不降低运行时安全边界**。管理员只看到菜单包和少量风险动作；后端仍保留统一权限决策、CRM 数据范围、字段白名单、导出阈值、企业微信灰度、合同对象级授权和审计拒绝。实现上采用一层“简化权限模型适配器”，把简化树转换为当前模块已经消费的 `visibleMenus`、`actionKeys` 和兼容字段。

现有关键事实：

- Web 前端菜单和路由守卫使用 `visibleMenus` 与 `actionKeys`。
- 后端多数业务模块已经通过 `PermissionEnforcementService` 或 `AccessDecisionService` 校验动作。
- 企业微信入口已独立具备签名校验、身份映射、灰度准入、动作校验、对象级授权、确认门闩和审计。
- 合同审核已经独立区分本人任务、跨合同查看和跨产物下载。
- 导出仍受角色动作、单次行数上限、每日次数上限和审计共同控制。

## Goals / Non-Goals

**Goals:**

- 将管理员可见的角色权限配置压缩为 `8` 个主菜单权限包和 `4` 个风险子权限。
- 勾选主菜单即可获得该菜单下常规能力，避免普通功能被多个重复权限点卡住。
- 保留 `智能分析导出`、`经营报表导出`、`查询他人合同`、`下载他人合同/审核产物` 四类业务风险动作的独立控制。
- 将 `Web 入口` 从显式开关改为派生结果：任意 Web 菜单被勾选即具备 Web 入口。
- 将企业微信角色能力收口为 `企业微信机器人` 权限包，但继续保留企业微信灰度、用户级停用、身份映射、CRM 范围和对象级授权。
- 保证旧数据自动回显到新界面，新界面保存后继续生成旧运行时字段，避免一次性重写全部业务模块。
- 通过覆盖矩阵和回归测试证明权限简化后所有既有功能仍可用，风险动作仍可阻断。

**Non-Goals:**

- 不修改 CRM 原有组织、部门、负责人、角色、字段和对象数据权限。
- 不放宽导出行数上限、每日次数上限、字段白名单或敏感字段处理。
- 不取消企业微信灰度策略、用户级停用、身份映射诊断和消息签名校验。
- 不取消合同审核的本人可见、跨负责人查看和跨负责人下载边界。
- 不一次性删除旧 `actionKeys`、`webConsoleEnabled`、`wecomBotEligible` 等字段；本次仅隐藏复杂配置并规范映射。
- 不新增新的一级业务模块或独立权限系统。

## Decisions

### Decision 1: 使用“简化权限树”作为管理员编辑模型

管理员界面展示：

```text
状态：[启用 / 停用]

业务功能
[ ] 智能分析
      [ ] 导出数据
[ ] 经营报表
      [ ] 导出数据
[ ] 智能合同审核
      [ ] 查询他人合同   [ ] 下载他人合同/审核产物

移动端入口
[ ] 企业微信机器人

系统维护
[ ] 权限中心
[ ] 查询模板管理
[ ] 连接策略
[ ] AI配置
[ ] 审计中心
```

选择该方案而不是继续保留动作大列表的原因：管理员配置目标通常是“给某个角色开某个页面/模块”，不是“理解每个内部动作键”。动作大列表仍可以存在于后端和测试覆盖中，但不应该作为日常配置界面。

备选方案：

- 方案 A：只调整文案，不改模型。成本最低，但仍需要管理员同时设置多项权限，不能解决根因。
- 方案 B：彻底删除旧动作权限，仅按菜单校验。实现看似简单，但会影响大量后端调用点，且难以回滚。
- 方案 C：新增简化配置层，保存时映射到旧字段。推荐采用，风险最低。

### Decision 2: 将旧字段作为迁移期运行时兼容层

简化权限树不直接替换数据库和所有业务模块消费格式。保存角色权限时，系统生成现有运行时字段：

| 简化配置 | 生成的菜单 | 生成的动作/字段 |
| --- | --- | --- |
| 智能分析 | `analysis-workbench` | `analysis.use`、`analysis.follow_up`、`template.view` |
| 智能分析 / 导出数据 | `analysis-workbench` | `analysis.export`、`exportAllowed=true` |
| 经营报表 | `management-report` | `management.report.view` |
| 经营报表 / 导出数据 | `management-report` | `management.report.export` |
| 智能合同审核 | `contract-review` | `contract.review.upload`、`contractReviewUploadAllowed=true` |
| 智能合同审核 / 查询他人合同 | `contract-review` | `contract.review.cross_view`、`contractReviewCrossViewAllowed=true` |
| 智能合同审核 / 下载他人合同/审核产物 | `contract-review` | `contract.review.cross_download`、`contractReviewCrossDownloadAllowed=true` |
| 企业微信机器人 | 无 Web 菜单 | `wecomBotEligible=true`、`wecom.analysis.use`、`wecom.customer.create`、`wecom.opportunity.create`、`wecom.followup.writeback`、`wecom.daily_report.preview` |
| 权限中心 | `permission-center` | `governance.policy.manage` |
| 查询模板管理 | `template-governance` | `template.manage`、`templateManageAllowed=true` |
| 连接策略 | `connection-policy` | `governance.policy.manage` |
| AI配置 | `ai-model-governance` | `ai_profile.manage` |
| 审计中心 | `audit-center` | `audit.view`、`audit.sql.view`、`audit.sql.view_sensitive` |

派生规则：

- `webConsoleEnabled=true` 当且仅当至少存在一个 Web 菜单：`analysis-workbench`、`management-report`、`contract-review`、`permission-center`、`template-governance`、`connection-policy`、`ai-model-governance`、`audit-center`。
- `status=INACTIVE` 时该角色不参与最终权限合并。
- 风险子权限不能脱离所属主菜单保存；例如未勾选 `智能合同审核` 时，不能单独保留 `下载他人合同/审核产物`。
- 保存时应生成规范化字段，避免隐藏的历史动作继续残留。

### Decision 3: 旧数据回显必须按“只要能用就勾上”的兼容策略

旧角色权限回显到新界面时，不要求旧字段完全一致，只要旧配置能让用户使用某个菜单常规功能，就应勾选对应主菜单，防止升级后管理员看到空白配置。

回显规则：

- 命中任一 `analysis-workbench`、`analysis.use`、`analysis.follow_up`、`template.view`，回显 `智能分析`。
- 命中任一 `analysis.export` 或 `exportAllowed=true`，回显 `智能分析 / 导出数据`。
- 命中任一 `management-report` 或 `management.report.view`，回显 `经营报表`。
- 命中 `management.report.export`，回显 `经营报表 / 导出数据`。
- 命中任一 `contract-review`、`contract.review.upload`、`contractReviewUploadAllowed=true`，回显 `智能合同审核`。
- 命中任一 `contract.review.cross_view` 或 `contractReviewCrossViewAllowed=true`，回显 `查询他人合同`。
- 命中任一 `contract.review.cross_download` 或 `contractReviewCrossDownloadAllowed=true`，回显 `下载他人合同/审核产物`。
- 命中任一 `wecomBotEligible=true` 或 `wecom.*` 动作，回显 `企业微信机器人`。
- 命中系统维护菜单或对应治理动作，回显对应系统维护菜单。

选择“只要能用就勾上”而不是“严格要求菜单和动作都存在”是为了避免历史半迁移数据在新界面看起来无权限，导致管理员误保存后收回已有能力。真正保存时再统一规范化输出。

### Decision 4: 前端路由按菜单为主，风险动作在页面内控制

路由守卫调整为：

- 进入业务或治理页面主要看 `requiredMenu`。
- `智能分析`、`经营报表` 等页面的常规读取能力由菜单包派生动作在后端继续保障。
- `导出数据`、`查询他人合同`、`下载他人合同/审核产物` 仍按风险动作控制按钮可用态和后端接口。
- 没有任何可用首页时仍进入无权限页，避免重定向循环。

这样可以让“勾选菜单就能打开菜单对应页面”成为管理员可理解的稳定规则。

### Decision 5: 后端保留统一权限决策，新增适配器而不是散落判断

新增或抽取一个简化权限映射模块，建议命名为 `simplified-permission-profile` 或放入现有 `feature-permission-catalog`：

- `toSimplifiedPermissionTree(rolePermission)`：旧运行时字段转新界面树。
- `fromSimplifiedPermissionTree(payload)`：新界面树转旧运行时字段。
- `deriveWebConsoleEnabled(visibleMenus)`：派生 Web 入口。
- `deriveCompatibilityBooleans(actionKeys)`：派生 `exportAllowed`、`templateManageAllowed`、合同审核兼容字段。

业务模块仍调用 `AccessDecisionService.hasAction`、`hasVisibleMenu` 和 `PermissionEnforcementService`。这保证本次 UI 简化不会绕开现有后端执行点。

### Decision 6: 企业微信机器人包简化配置，但不简化安全执行链路

角色层只显示 `企业微信机器人`。保存后生成全部现有企业微信动作，是因为用户诉求是“企业微信机器人是一个入口包”，不再按问数、新增客户、新增商机、跟进写回、日报预览逐项配置。

但企业微信真实执行仍必须经过：

1. 企业微信签名、来源、消息结构校验。
2. 企业微信到 CRM 身份映射。
3. 企业微信灰度模式、白名单和停用名单。
4. CRM 组织、部门、负责人和数据范围。
5. 写回、新增、日报等各自的固定安全前置检查。
6. 跟进写回和创建类流程的候选唯一性、用户确认和幂等。
7. 审计留痕。

因此“机器人包”只降低角色配置复杂度，不等于绕过业务执行约束。

### Decision 7: 审计中心简化为单菜单全能力

当前审计相关权限包含 `audit.view`、`audit.sql.view`、`audit.sql.view_sensitive`。这对安全最细，但对普通权限配置过重。本次按用户要求将审计中心作为系统维护菜单：勾选 `审计中心` 即生成全部审计能力。

风险接受理由：

- 审计中心本身面向系统管理、安全审计人员，不是普通业务菜单。
- 操作 reveal 敏感明细仍可继续记录独立审计事件。
- 若未来发现需要再拆，可作为“高级审计策略”单独设计，不放回普通角色权限抽屉。

## Risks / Trade-offs

- [Risk] 旧权限回显规则过宽，可能让历史只有部分动作的角色在新界面显示为完整菜单包。  
  → Mitigation：回显只影响展示；保存前提示“保存后将按菜单包规范化权限”。上线前导出角色映射对比表，重点复核历史半配置角色。

- [Risk] 新保存逻辑漏生成某个旧动作，导致页面能进但接口 403。  
  → Mitigation：为每个菜单包建立映射单测；权限覆盖矩阵测试必须验证菜单包到真实接口的完整链路。

- [Risk] Web 入口由菜单派生后，历史只开 `webConsoleEnabled` 但没有菜单的角色失去 Web 入口。  
  → Mitigation：迁移回显阶段若历史 `webConsoleEnabled=true` 但没有任何菜单，应标记为“待补菜单”的异常角色，不自动保存收缩；管理员必须选择至少一个菜单后才能保存。

- [Risk] 企业微信机器人包一次性生成所有 `wecom.*` 动作，扩大了角色层动作范围。  
  → Mitigation：保留灰度、对象级权限、确认门闩和固定安全前置检查；回归测试覆盖问数、创建、写回、日报四类工作流；文档明确该包只授予入口能力，业务对象仍按 CRM 权限收口。

- [Risk] 审计中心菜单默认包含 SQL 敏感明细，权限粒度变粗。  
  → Mitigation：只在系统维护分组展示，默认不授予普通业务角色；reveal 行为继续写审计；上线前复核已拥有审计中心角色的人员。

- [Risk] 文档、权限预览和真实执行不一致。  
  → Mitigation：简化权限映射模块作为唯一转换源；预览和保存都复用同一转换函数；测试同时断言 UI 回显、保存载荷和运行时能力快照。

- [Risk] 一次性修改所有模块权限判断导致回归面过大。  
  → Mitigation：第一阶段尽量不改业务模块执行点，只改角色配置 UI 与映射；业务模块继续消费已生成的旧字段。

## Migration Plan

1. 新增简化权限映射模块和单元测试，不改变现有 API 行为。
2. 在权限中心角色列表接口中增加简化权限树视图字段，保留旧字段。
3. 在权限中心保存接口中支持简化权限树输入，并统一生成旧运行时字段。
4. 改造角色权限抽屉，仅展示简化权限树和角色状态。
5. 调整路由和页面动作可用态，使页面入口以菜单为主，风险动作以派生动作控制。
6. 完整回归智能分析、经营报表、合同审核、企业微信机器人、权限中心、模板治理、连接策略、AI配置和审计中心。
7. 更新管理员说明文档和权限覆盖矩阵。

上线前检查：

- 导出全部角色的新旧权限映射对比，重点关注历史半配置角色。
- 选择至少一个管理员角色、一个经营管理角色、一个普通业务角色、一个合同审核角色、一个企业微信用户角色做端到端验证。
- 对权限变更保存后的当前页签快照失效做验证，避免用户继续拿旧权限。

Rollback：

- 保留旧字段和旧后端执行语义，因此回滚前端抽屉即可恢复旧配置界面。
- 若新保存逻辑出现问题，可暂时关闭简化保存入口，继续使用旧字段载荷。
- 已经保存的新配置因生成了旧字段，回滚后仍可被旧界面读取，只是会重新显示为基础开关、菜单和动作列表。

## Open Questions

- 是否接受 `审计中心` 菜单默认包含 `查看 SQL 敏感明细`？当前设计按用户“系统维护菜单都整体授权”的方向处理，但这是唯一明显变粗的安全点。
- 是否需要在新抽屉中显示“保存后将规范化旧权限”的一次性提示？建议保留，尤其用于历史半配置角色。
- 企业微信机器人是否必须一次性包含新增客户、新增商机、跟进写回和日报预览？当前设计按入口包处理；如果后续业务要求拆分，应另设“企业微信高级策略”，不要放回普通角色抽屉。
