## Why

当前权限中心把同一业务能力拆成基础开关、菜单可见性和动作权限多层配置，管理员需要同时理解 `Web 入口`、`菜单`、`动作`、`兼容布尔开关` 才能放行一个功能，配置成本高且容易出现“菜单已勾选但按钮不可用”“动作已勾选但页面进不去”的误配。权限体系已经接入真实页面和后端执行点，本次变更需要在保留现有安全边界和审计能力的基础上，把管理员配置入口收口为“菜单权限包 + 少量高风险动作”。

本次改动风险较高：如果迁移或映射错误，会直接导致已授权用户无法使用智能分析、经营报表、合同审核、企业微信机器人或治理后台。因此提案要求采用兼容式迁移、双向映射和全链路回归，先降低配置复杂度，再逐步清理内部历史权限点。

## What Changes

- 将角色权限编辑界面从“基础开关 + 菜单可见性 + 动作权限”改为按菜单维度配置的权限树。
- 勾选某个菜单后，默认授予该菜单的常规查看、查询、维护或使用能力；管理员不再单独配置这些常规动作。
- 业务菜单仅保留必要的风险子权限：
  - `智能分析`：保留 `导出数据`。
  - `经营报表`：保留 `导出数据`。
  - `智能合同审核`：保留 `查询他人合同`、`下载他人合同/审核产物`。
- 系统维护菜单一旦勾选，即默认具备该页面的维护能力：
  - `权限中心` 默认包含系统级治理能力。
  - `查询模板管理` 默认包含模板治理能力。
  - `连接策略` 默认包含连接策略保存能力。
  - `AI配置` 默认包含 AI 配置治理能力。
  - `审计中心` 默认包含审计查看、SQL 审计查看和 SQL 敏感明细查看能力。
- `Web 入口` 不再作为管理员可见开关。角色只要勾选任意 Web 菜单，即自动具备 Web 工作台入口资格；没有任何 Web 菜单时不具备 Web 入口资格。
- `企业微信机器人` 改为独立入口权限包。勾选后默认开通现有企业微信机器人业务能力包，包括问数、新增客户、新增商机、跟进写回和日报预览；正式执行仍必须通过企业微信灰度策略、身份映射、CRM 数据范围、目标对象权限、确认门闩和审计留痕。
- 保留后端现有 `visibleMenus`、`actionKeys`、`webConsoleEnabled`、`wecomBotEligible` 和合同审核扩展字段作为迁移期内部存储与执行兼容字段，但管理员界面不再直接暴露大部分旧字段。
- 新增简化权限配置与旧权限矩阵之间的规范映射，确保旧角色配置可正确回显到新界面，新界面保存后可生成后端仍能消费的旧字段。
- 更新权限预览、权限覆盖矩阵、管理员使用说明和测试用例，保证预览结果、前端菜单、后端接口和企业微信工作流仍一致。
- 不改变 CRM 组织、部门、负责人、角色、字段白名单、导出次数、导出行数、合同对象级权限和企业微信灰度策略的安全边界。

## Capabilities

### New Capabilities

- 无。该变更收敛既有权限治理能力，不新增独立业务能力。

### Modified Capabilities

- `access-governance-center`：角色权限维护方式从细粒度动作矩阵改为菜单权限包配置，并定义简化配置与内部执行权限的兼容映射、回显和权限预览规则。
- `feature-permission-enforcement`：权限执行语义从“每个管理员可见权限点必须逐项配置”调整为“菜单包授权常规动作，风险动作独立校验”，并要求保持后端真实执行点覆盖和拒绝审计。
- `wecom-bot-pilot-access`：企业微信角色侧准入从多个可见动作点收口为 `企业微信机器人` 权限包；灰度、强制停用、身份映射和工作流安全门闩仍保持独立。

## Impact

- 前端：
  - `frontend/src/components/governance/RolePermissionFormDrawer.vue`
  - `frontend/src/pages/governance/PermissionCenterPage.vue`
  - `frontend/src/router/index.ts`
  - `frontend/src/stores/auth.store.ts`
  - `frontend/src/ui/business-code-labels.ts`
  - 相关权限中心、路由守卫和页面动作可用态单测。
- 后端：
  - `backend/src/modules/governance/feature-permission-catalog.ts`
  - `backend/src/modules/governance/access-decision.service.ts`
  - `backend/src/modules/governance/permission-enforcement.service.ts`
  - `backend/src/modules/governance/role-permission.repository.ts`
  - `backend/src/modules/governance/access-governance.service.ts`
  - `backend/src/modules/sessions/session-capabilities.service.ts`
  - 分析、经营报表、合同审核、查询模板、审计、AI 配置和企业微信相关权限校验调用点。
- API 与数据：
  - 角色权限保存接口可以继续接受旧字段，但需要支持简化权限树提交格式。
  - 有效权限快照仍返回前端运行所需的 `visibleMenus`、`actionKeys` 和风险动作状态。
  - 旧存量角色权限数据必须自动映射到简化权限树，不要求管理员手工重配。
- 文档与测试：
  - 更新 `docs/testing/feature-permission-enforcement-matrix.md`。
  - 更新根目录管理员权限说明文档。
  - 增加迁移映射、权限预览、前端路由、后端接口、企业微信机器人、导出、合同跨查看/下载和审计拒绝回归测试。
