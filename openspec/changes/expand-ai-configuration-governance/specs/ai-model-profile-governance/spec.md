## ADDED Requirements

### Requirement: AI 配置中心必须同时承载模型档案治理与上下文策略治理
系统 MUST 在同一个 AI 配置中心内同时提供 AI Profile 档案治理和 AI 上下文策略治理两类能力。管理员进入该页面后，MUST 能在同一入口内查看当前生效 AI Profile、管理模型档案，并查看和维护上下文治理阈值；系统 MUST 不得要求管理员再切换到其它治理菜单才能完成 AI 上下文相关配置。

#### Scenario: 管理员在同一入口完成模型与上下文治理
- **WHEN** 管理员进入 AI 配置中心
- **THEN** 页面必须同时提供 AI Profile 治理区域和 AI 上下文策略治理区域
- **THEN** 管理员不得需要跳转到其它治理菜单才能修改 AI 上下文阈值

#### Scenario: AI 配置中心统一复用既有权限动作
- **WHEN** 用户被授予 `ai_profile.manage` 并访问 AI 配置中心
- **THEN** 系统必须允许其同时访问 AI Profile 治理和 AI 上下文策略治理能力
- **THEN** 系统不得额外要求该用户再具备 `governance.policy.manage` 才能修改 AI 上下文治理策略

## MODIFIED Requirements

### Requirement: 系统必须提供管理员专用的 AI 模型治理页面
系统 MUST 在 Web 治理后台提供独立的 AI 配置页面，并作为现有治理导航中的统一 AI 入口。该页面 MUST 继续支持查看当前激活配置、浏览 Profile 列表、执行新增编辑、复制、测试连接、启停与激活动作，同时 MUST 提供 AI 上下文策略治理分区。系统 MUST 仅允许具备 `ai_profile.manage` 动作的用户访问该页面及相关接口；未被授予该动作的用户 MUST 被阻断。系统 MUST 不得继续仅凭 `isAdmin` 或角色名称包含“管理员”放行 AI 配置治理能力。

#### Scenario: 被授予 ai_profile.manage 的非管理员用户可以进入治理页
- **WHEN** 某个业务管理角色未被标记为管理员，但被显式授予 `ai_profile.manage`
- **THEN** 系统必须允许其访问 AI 配置页面和相关接口
- **THEN** 该用户必须可以查看当前激活配置、浏览列表、执行被授权的治理动作，并查看上下文策略治理分区

#### Scenario: 历史管理员未授予 ai_profile.manage 时被阻断
- **WHEN** 某个历史管理员用户未在当前权限矩阵中被授予 `ai_profile.manage`，并尝试访问 AI 配置页面或调用对应接口
- **THEN** 系统必须拒绝访问
- **THEN** 不得仅凭管理员身份或角色名称自动放行

#### Scenario: 导航与页面标题统一显示为 AI 配置
- **WHEN** 用户在治理后台查看导航、页面标题、权限说明或操作反馈
- **THEN** 系统必须统一展示“AI配置”或等价中文名称
- **THEN** 用户界面不得继续显示“AI 模型治理”作为页面主名称
