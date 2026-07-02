## gContext

当前仓库已经具备一套最小可用的权限治理底座，但它仍停留在“全局开通”阶段，无法支撑企业微信首批灰度体验、菜单与动作治理、用户级排障和统一权限预览：

- `AccessPolicyRecord` 当前只覆盖 `enabledRoleIds`、`exportRoleIds`、`enabledChannels`、`allowedFields`、`maskedFields`、导出阈值和若干运行时阈值，适合全局基线策略，但不适合表达“某个 CRM 角色能看到哪些菜单、能点哪些按钮、能否进入企业微信机器人、能否跨任务查看合同”等角色能力矩阵。
- `GovernanceController` 当前只暴露单一的全局策略读写接口，管理员可以改全局白名单和阈值，但无法维护角色级权限、企业微信灰度名单、用户级禁用和权限预览。
- `SessionCapabilitiesService` 当前只返回 `scopeSummary`、`roleNames`、`exportAllowed`、`templateCount`、`dataFreshnessAt` 等摘要，无法支撑前端对导航显隐、动作禁用和企业微信入口状态做细粒度控制。
- `WecomAuthService` 当前只判断“当前角色是否在 `enabledRoleIds`、当前通道是否在 `enabledChannels`、用户对象是否包含该通道”，无法实现“同一角色中只有一批首测用户能进企业微信机器人”的灰度要求，也无法向用户返回统一的准入状态码。
- 合同审核跨任务查看/下载当前主要依赖环境变量授权角色与运行时判断，缺少与统一权限中心打通的角色动作矩阵和实时撤权后的统一治理能力。

与此同时，业务约束已经很明确：

- CRM 组织、部门、负责人、角色和数据范围仍是分析与合同审核访问控制的权威来源，应用层不得扩权，只能做菜单、动作、渠道和灰度层的收口。
- 企业微信身份映射依赖 `wx_user_maps`、`wx_users`、`wx_organization_maps`、`wx_departments`、`wx_user_department_maps`，必须提供明确的排障链路，而不是把“未映射”与“无权限”混成同一类提示。
- 公司没有专门的“治理审计管理员”岗位，因此设计不能要求新增组织角色；模板治理、权限发布、审计检索和 AI 模型治理必须由平台管理员和被授权的业务管理角色分担。
- 企业微信机器人存在典型的首批试点需求，需要支持“先关总闸、再白名单放量、最后全量开放”的运营节奏，并允许紧急单用户停用与快速回滚。

这次设计不是只新增一个权限页面，而是要建立一套可落地的双层权限模型：

1. **CRM 权限层**：决定用户能看什么数据、属于哪些组织/部门/负责人范围。
2. **应用能力层**：决定用户能看到什么菜单、能执行什么动作、能否从 Web 或企业微信进入、是否命中企业微信灰度。

## Goals / Non-Goals

**Goals:**

- 建立“CRM 权限权威源 + 应用能力治理层”的双层权限模型，明确应用层只能收紧，不能扩权。
- 新增角色能力矩阵，按 CRM 角色维护菜单可见性、动作权限、Web / 企业微信入口资格、导出资格、模板治理资格和合同审核扩展权限。
- 新增企业微信机器人灰度准入策略，支持 `DISABLED`、`PILOT_ONLY`、`FULL` 三种模式，并支持按用户、角色、部门放量，以及按用户强制停用。
- 为 Web 工作台、合同审核、企业微信入口和治理后台提供统一的有效权限快照和统一的拒绝原因。
- 为管理员提供权限中心页面、身份映射诊断页和用户权限预览能力，解决“这个人为什么不能用”的排障问题。
- 将合同审核上传、跨任务查看和跨任务下载权限纳入统一权限中心治理，同时保持当前“上传者本人可见、扩展角色可查看/下载、下载再次鉴权”的边界。
- 为角色权限变更、灰度策略发布、灰度命中/拒绝和权限预览建立可追溯审计事件。

**Non-Goals:**

- 不重新设计 CRM 的组织树、部门树、负责人树和数据权限树；应用层不提供第二套可编辑数据范围树。
- 不引入自定义角色编辑器、审批流、多人会签发布或 RBAC/ABAC 平台化系统；一期仍以 CRM 角色为主键。
- 不把企业微信灰度策略扩展为所有渠道的流量路由平台；本次只治理 `wecom-bot` 入口。
- 不让普通业务角色直接维护字段白名单、脱敏字段和导出硬阈值，这些仍属于平台级基线策略。
- 不改动现有稳定的登录、会话建立和统一鉴权装载链路，只在其后叠加新的权限决策。

## Decisions

### 决策 1：采用“CRM 权限权威源 + 应用能力治理层”的双层权限模型

最终权限判定固定为：

```text
固定安全前置检查
-> 身份识别（Web 登录 / 企业微信映射）
-> CRM 权限解析（角色、组织、部门、负责人范围）
-> 角色能力矩阵匹配
-> 通道准入判断（Web / 企业微信）
-> 企业微信灰度判断（仅 wecom-bot）
-> 场景级资源权限判断（模板、导出、合同审核跨任务查看/下载）
-> 最终有效权限快照 / 拒绝结果
```

这里最关键的约束是：

- CRM 负责“数据看多大”；
- 应用能力层负责“入口、菜单、动作是否开放”。

因此：

- 角色即使拥有 `analysis.use`，其数据范围仍必须来自 CRM 权限与 `ScopeSnapshot`，不能因为应用层配置而扩大。
- 企业微信灰度只影响 `wecom-bot` 入口，不影响同一用户的 Web 登录与 Web 工作台可用性。
- 字段白名单、脱敏字段、导出行数/次数上限仍保留在全局基线策略里，角色动作只决定“有没有资格发起这个动作”，不决定阈值本身。

**备选方案：**

- 以企业微信组织树或企业微信部门作为主权限树。问题是这会与主规格“CRM 权限是权威源”的前提冲突，也会在身份映射不稳定时放大排障复杂度。
- 直接引入产品权限包（role -> permission-pack -> action）。这是合理的二期方向，但对当前团队和一期范围来说抽象过重，不利于快速落地与排障，因此一期先按 `CRM roleId` 直配能力。

### 决策 2：保留 `AccessPolicyRecord` 作为全局基线策略，新增 `RolePermissionRecord` 承载角色能力矩阵

现有 `AccessPolicyRecord` 继续负责：

- `enabledChannels`
- `allowedDomains`
- `allowedTables`
- `allowedFields`
- `maskedFields`
- `exportRowLimit`
- `exportDailyLimit`
- 运行时并发和会话阈值

新增 `RolePermissionRecord` 承载按 CRM 角色的能力矩阵，建议字段如下：

```ts
interface RolePermissionRecord {
  roleId: string;
  roleNameSnapshot: string;
  status: 'ACTIVE' | 'INACTIVE';
  visibleMenus: string[];
  actionKeys: string[];
  webConsoleEnabled: boolean;
  wecomBotEligible: boolean;
  exportAllowed: boolean;
  templateManageAllowed: boolean;
  contractReviewUploadAllowed: boolean;
  contractReviewCrossViewAllowed: boolean;
  contractReviewCrossDownloadAllowed: boolean;
  updatedBy: string;
  updatedAt: string;
  changeReason?: string;
}
```

菜单键建议一期固定为：

- `analysis-workbench`
- `contract-review`
- `template-governance`
- `permission-center`
- `audit-center`
- `ai-model-governance`

动作键建议一期固定为：

- `analysis.use`
- `analysis.follow_up`
- `analysis.export`
- `template.view`
- `template.manage`
- `wecom.analysis.use`
- `wecom.customer.create`
- `wecom.opportunity.create`
- `wecom.followup.writeback`
- `wecom.daily_report.preview`
- `governance.policy.manage`
- `audit.view`
- `ai_profile.manage`
- `contract.review.upload`
- `contract.review.cross_view`
- `contract.review.cross_download`

**为什么不把这些继续塞进 `AccessPolicyRecord`：**

- 全局策略适合表达单条当前生效策略，不适合按角色展开矩阵。
- 继续塞进单对象会让字段越来越扁平，既难维护，也不利于逐角色 diff、审计和页面渲染。

### 决策 3：企业微信灰度策略单独建模为 `WecomPilotPolicyRecord`

企业微信灰度是“通道准入控制”，不是“数据权限控制”，因此单独建模，避免与角色矩阵混杂：

```ts
interface WecomPilotPolicyRecord {
  channel: 'wecom-bot';
  mode: 'DISABLED' | 'PILOT_ONLY' | 'FULL';
  allowUserIds: string[];
  allowRoleIds: string[];
  allowDepartmentIds: string[];
  denyUserIds: string[];
  note?: string;
  updatedBy: string;
  updatedAt: string;
}
```

判定优先级固定如下：

1. `mode = DISABLED`：全拒绝。
2. 命中 `denyUserIds`：强制拒绝。
3. `mode = FULL`：只要角色能力已允许 `wecomBotEligible + wecom.analysis.use` 即可通过。
4. `mode = PILOT_ONLY`：必须命中 `allowUserIds / allowRoleIds / allowDepartmentIds` 之一，且不在 `denyUserIds` 内。

这套策略只使用 CRM 维度（CRM 用户、CRM 角色、CRM 部门），不直接按企业微信组织树做授权判断。企业微信组织数据只用于身份映射诊断和同步观察。

**备选方案：**

- 给首批体验用户额外挂一个 CRM “体验角色”。问题是会污染 CRM 业务角色语义，后续难以解释“这个角色是业务角色还是系统试点角色”。
- 直接按企业微信用户 ID 白名单。问题是不能表达“某个 CRM 部门整体试点”，也无法与 CRM 角色权限联动。

### 决策 4：新增统一权限决策服务，输出标准化 `AccessDecision`

后端新增统一权限决策服务，建议命名为：

- `AccessDecisionService`
- `WecomPilotAccessService`
- `RolePermissionService`
- `AccessPreviewService`

标准化返回结构建议如下：

```ts
interface AccessDecision {
  allowed: boolean;
  channel: 'web-console' | 'wecom-bot';
  state:
    | 'ALLOWED'
    | 'CHANNEL_DISABLED'
    | 'ROLE_NOT_ENABLED'
    | 'PILOT_REQUIRED'
    | 'EXPLICITLY_DENIED'
    | 'UNMAPPED_CRM_IDENTITY'
    | 'RESOURCE_FORBIDDEN';
  reason?: string;
  matchedRoleIds: string[];
  visibleMenus: string[];
  actionKeys: string[];
  scopeSnapshot: ScopeSnapshot;
  wecomPilotSnapshot?: {
    mode: 'DISABLED' | 'PILOT_ONLY' | 'FULL';
    matchedBy?: 'user' | 'role' | 'department';
    deniedByUserId?: string;
  };
}
```

这样做有三个目的：

- 前端可以直接用 `visibleMenus` / `actionKeys` 控菜单与按钮。
- 企业微信可以按 `state` 返回统一中文提示，不再把灰度未开通误判成无权限或无数据。
- 审计和排障页可以直接展示命中的决策快照。

### 决策 5：扩展 `GET /analysis/capabilities` 为统一有效权限快照接口

当前 `SessionCapabilitiesService` 已返回角色名称、权限摘要、导出摘要和模板数量，但粒度不足。建议把它升级为统一有效权限快照接口，新增至少以下字段：

```ts
interface AnalysisCapabilitySnapshot {
  serviceStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  scopeSummary: string;
  roleNames: string[];
  channels: string[];
  domains: string[];
  metrics: string[];
  dimensions: string[];
  exportAllowed: boolean;
  exportRowLimit: number;
  exportDailyLimit: number;
  remainingDailyExports: number;
  templateCount: number;
  dataFreshnessAt: string;
  visibleMenus: string[];
  actionKeys: string[];
  wecomBotAccessState:
    | 'ALLOWED'
    | 'CHANNEL_DISABLED'
    | 'ROLE_NOT_ENABLED'
    | 'PILOT_REQUIRED'
    | 'EXPLICITLY_DENIED';
  wecomBotAccessReason?: string;
  contractPermissions: {
    uploadAllowed: boolean;
    crossViewAllowed: boolean;
    crossDownloadAllowed: boolean;
  };
}
```

前端使用方式：

- `visibleMenus` 控制左侧导航是否展示 `智能分析`、`智能合同审核`、`查询模板管理`、`权限中心`、`审计检索`、`AI 模型治理`。
- `actionKeys` 控制导出按钮、模板维护入口、合同下载按钮等动作是否可点。
- `wecomBotAccessState` 主要用于权限中心预览、身份诊断和 Web 端说明，不要求 Web 用户必须能用企业微信才能进 Web。

### 决策 6：权限中心页面采用单页多分区结构，而不是分散到多个治理页面

前端新增 `权限中心` 页面，纳入治理区导航。页面结构固定为：

```text
权限中心
├─ 顶部摘要卡
├─ 角色权限
├─ 企业微信灰度
├─ 数据与导出基线
├─ 身份映射诊断
└─ 变更记录
```

每个分区职责如下：

1. **顶部摘要卡**

   - 已开通分析角色数
   - 企业微信灰度状态
   - 白名单人数
   - 导出开通角色数
   - 身份映射异常数
2. **角色权限**

   - 按 CRM 角色列表展示矩阵
   - 编辑抽屉中配置菜单、动作、渠道、合同审核权限、变更说明
3. **企业微信灰度**

   - 模式切换
   - 白名单（用户 / 角色 / 部门）
   - 停用名单
   - 命中预览
4. **数据与导出基线**

   - 只读展示“CRM 是数据权威源”
   - 全局白名单字段、脱敏字段、导出行数 / 次数阈值
   - 平台管理员可编辑全局基线
5. **身份映射诊断**

   - 输入企业微信用户 ID / CRM 用户 ID 查询映射链
   - 列表看映射状态、角色、部门、入口状态、失败原因
6. **变更记录**

   - 展示角色权限变更、灰度切换、白名单调整、停用名单调整

**为什么不拆成多个独立页面：**

- 权限排障的核心链路是连贯的，管理员通常需要在“角色权限、灰度策略、映射状态、审计记录”之间来回比对。
- 根级 `DESIGN.md` 也强调治理页应保持控制塔式信息层级，详情优先用抽屉，而不是在多个页面中频繁跳转。

### 决策 7：身份映射诊断作为一等能力落地，不把排障留给数据库查询

企业微信首批试点最大的实际问题不是“功能没有”，而是“用户说他不能用，但没人知道卡在哪”。因此新增身份映射诊断服务，建议查询并聚合：

- `wx_user_maps`
- `wx_users`
- `wx_organization_maps`
- `wx_departments`
- `wx_user_department_maps`
- CRM `users`
- CRM `roles`
- CRM `users_departments`
- 角色能力矩阵
- 企业微信灰度策略

返回结构建议如下：

```ts
interface IdentityMappingDiagnosticRecord {
  wecomUserId: string;
  wecomName?: string;
  mappingStatus: 'MAPPED' | 'UNMAPPED' | 'CONFLICTED';
  crmUserId?: string;
  crmUserName?: string;
  crmRoleNames: string[];
  crmDepartmentNames: string[];
  analysisEnabled: boolean;
  wecomBotAccessState:
    | 'ALLOWED'
    | 'CHANNEL_DISABLED'
    | 'ROLE_NOT_ENABLED'
    | 'PILOT_REQUIRED'
    | 'EXPLICITLY_DENIED'
    | 'UNMAPPED_CRM_IDENTITY';
  failedReason?: string;
  lastDirectorySyncAt?: string;
}
```

诊断页详情抽屉必须展示完整链路：

```text
企业微信账号
-> wx_user_maps 是否命中
-> CRM 用户是否存在且可用
-> CRM 角色是否已开通 analysis.use
-> 角色是否允许 wecomBotEligible
-> wecomPilotPolicy 是否命中
-> 最终结果
```

### 决策 8：合同审核访问控制统一接入角色动作矩阵，但保留当前实时二次鉴权

合同审核相关动作统一映射到三个权限点：

- `contract.review.upload`
- `contract.review.cross_view`
- `contract.review.cross_download`

行为规则：

- 上传者本人始终可查看自己创建的任务；
- 上传动作需要 `contract.review.upload`；
- 查看他人任务详情需要 `contract.review.cross_view`；
- 下载他人产物需要 `contract.review.cross_download`；
- 下载必须再次实时校验，不得因为曾经有权限就沿用旧快照放行。

为兼容现有实现，迁移期可保留环境变量：

- `CONTRACT_REVIEW_REVIEWER_ROLE_IDS`
- `CONTRACT_REVIEW_DOWNLOADER_ROLE_IDS`

作为初始化默认值或应急回退来源，但最终治理入口应迁移到权限中心。

### 决策 9：所有权限变更和关键拒绝都进入审计事件

新增或扩展以下事件类型：

- `ACCESS_ROLE_PERMISSION_UPDATED`
- `ACCESS_ROLE_PERMISSION_PUBLISHED`
- `WECOM_PILOT_POLICY_UPDATED`
- `WECOM_PILOT_POLICY_PREVIEWED`
- `WECOM_PILOT_ACCESS_DENIED`
- `ACCESS_PREVIEW_EXECUTED`
- `IDENTITY_MAPPING_DIAGNOSTIC_QUERIED`
- `CONTRACT_REVIEW_ACCESS_DENIED`

审计快照中至少保存：

- 操作人
- 变更对象（roleId / wecomUserId / policy mode）
- 变更前摘要
- 变更后摘要
- 拒绝状态码
- 中文失败原因
- 命中的角色和灰度快照

这里遵循现有审计设计，不新增独立审计系统，只在现有 `AuditEventRepository` 与审计查询接口上增加类型和聚合维度。

### 决策 10：以“兼容读 + 渐进写 + 最终切换”的方式迁移，避免一次性替换所有权限判断

迁移分三段：

1. **兼容读阶段**

   - 新增角色权限矩阵和企业微信灰度策略的存储结构
   - 若某角色没有新记录，则按当前 `enabledRoleIds` / `exportRoleIds` / 环境变量生成兼容默认值
2. **渐进写阶段**

   - 权限中心上线后，管理员开始通过新页面维护角色权限和灰度策略
   - `GET /analysis/capabilities`、`WecomAuthService`、合同审核访问控制同时读取新旧两套数据，并以新数据优先
3. **最终切换阶段**

   - 当角色矩阵和灰度策略已稳定覆盖生产角色后，停止从兼容默认值推导新权限
   - 保留全局基线策略与环境变量回滚能力，但不再作为主治理入口

## Risks / Trade-offs

- [CRM 角色数量较多会导致矩阵页面很长] → 通过角色搜索、分页、角色人数摘要和编辑抽屉降低单屏复杂度，一期不做拖拽矩阵大屏。
- [灰度策略和角色权限叠加后，管理员可能不清楚最终命中哪条规则] → 所有预览和拒绝结果必须返回 `state + reason + matchedBy`，并在诊断页展示完整命中链路。
- [兼容期同时读取旧配置和新配置，容易出现判断不一致] → 统一由 `AccessDecisionService` 负责新旧兼容逻辑，禁止业务模块各自拼装判断。
- [企业微信映射异常可能被误报成普通无权限] → 单独引入 `UNMAPPED_CRM_IDENTITY` 状态码和专属文案，不与 `ROLE_NOT_ENABLED` 混用。
- [实时撤权后，已有页面或下载链接可能仍残留旧按钮状态] → 关键动作继续服务端二次鉴权，前端按钮状态只作体验增强，不能作为最终安全边界。
- [合同审核环境变量与权限中心双轨并存会拉长迁移周期] → 明确环境变量只作为初始化默认值与回滚兜底，并在迁移完成后逐步降级其优先级。

## Migration Plan

1. 在应用库存储层新增 `RolePermissionRecord` 与 `WecomPilotPolicyRecord`，并提供默认初始化逻辑。
2. 在治理模块新增角色权限服务、企业微信灰度服务、权限预览服务和身份映射诊断服务。
3. 扩展 `GET /analysis/capabilities`，新增有效权限快照字段，同时保证旧字段兼容。
4. 改造 `WecomAuthService`，将企业微信入口判断改为统一消费角色矩阵和灰度策略，并输出标准化准入状态。
5. 改造合同审核访问控制，将跨任务查看/下载判断接入角色动作矩阵；环境变量在迁移期内仅作默认值。
6. 在治理前端新增 `权限中心` 页面与相关抽屉/诊断界面，并在导航中接入。
7. 为新增接口、状态码、审计事件和错误提示补齐后端单测、集成测试、前端页面测试和灰度验收文档。

**上线顺序建议：**

- 第一步：先上线只读诊断与预览接口，不改变真实权限逻辑；
- 第二步：上线角色矩阵和企业微信灰度策略，但先对测试环境或灰度环境生效；
- 第三步：切换生产企业微信入口到新灰度逻辑；
- 第四步：切换合同审核扩展授权到新角色矩阵；
- 第五步：关闭兼容默认值的主路径，仅保留回滚兜底。

**回滚策略：**

- 若权限中心页面或角色矩阵逻辑异常，可立即回退到旧的 `enabledRoleIds / exportRoleIds / enabledChannels` 判断；
- 若企业微信灰度策略异常，可将 `mode` 直接切回 `DISABLED`，快速关闭机器人入口；
- 若合同审核权限接入异常，可临时恢复环境变量角色授权为主判定来源。

## Open Questions

- `allowDepartmentIds` 在灰度策略中是否需要默认包含子部门递归命中；当前建议按 CRM 部门树递归命中，但上线前需与业务确认。
- 企业微信受控新增客户、受控新增商机、跟进写回和日报预览是否全部复用同一套 `wecom.analysis.use` 准入门闩；当前建议统一复用入口门闩，再由动作键决定是否可继续执行具体业务动作。
- 权限预览是否需要记录每次“预览了哪个用户”的审计事件；当前建议记录，避免权限排障本身成为不可追溯的治理盲区。
