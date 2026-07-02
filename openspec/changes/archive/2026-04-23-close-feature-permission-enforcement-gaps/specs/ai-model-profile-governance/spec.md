## MODIFIED Requirements

### Requirement: 系统必须提供管理员专用的 AI 模型治理页面
系统 MUST 在 Web 治理后台提供独立的 AI 模型治理页面，并作为现有治理导航的新入口。该页面 MUST 支持查看当前激活配置、浏览 Profile 列表、执行新增编辑、复制、测试连接、启停与激活动作。系统 MUST 仅允许具备 `ai_profile.manage` 动作的用户访问该页面及相关接口；未被授予该动作的用户 MUST 被阻断。系统 MUST 不得继续仅凭 `isAdmin` 或角色名称包含“管理员”放行 AI 模型治理能力。

#### Scenario: 被授予 ai_profile.manage 的非管理员用户可以进入治理页
- **WHEN** 某个业务管理角色未被标记为管理员，但被显式授予 `ai_profile.manage`
- **THEN** 系统必须允许其访问 AI 模型治理页面和相关接口
- **THEN** 该用户必须可以查看当前激活配置、浏览列表并执行被授权的治理动作

#### Scenario: 历史管理员未授予 ai_profile.manage 时被阻断
- **WHEN** 某个历史管理员用户未在当前权限矩阵中被授予 `ai_profile.manage`，并尝试访问 AI 模型治理页面或调用对应接口
- **THEN** 系统必须拒绝访问
- **THEN** 不得仅凭管理员身份或角色名称自动放行
