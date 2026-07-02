## ADDED Requirements

### Requirement: 系统必须提供根级设计系统入口

仓库 MUST 在根目录提供 `DESIGN.md`，作为 CRM 智能分析系统后续 UI 视觉、组件、动效、文案语气和设计评审的统一入口。`DESIGN.md` MUST 使用中文正文，并明确功能边界、权限规则、接口字段和验收口径仍以 `specs/001-crm-intelligent-analytics/` 下的主规格为准。

#### Scenario: 协作者查找 UI 设计规范

- **WHEN** 协作者需要实现或评审 Web UI
- **THEN** 仓库必须提供根级 `DESIGN.md` 作为优先读取入口
- **THEN** `DESIGN.md` 必须说明它与一期主规格之间的职责分工

### Requirement: 新视觉方向必须采用企业 AI 工作台定位

`DESIGN.md` MUST 将 CRM 智能分析系统定义为企业 AI 经营指挥舱，而不是传统后台管理界面。设计系统 MUST 综合参考多个成熟产品设计方向，并明确每个方向在本系统中的吸收范围。设计系统 MUST 覆盖自然语言问数、阶段反馈、结构化结果、AI grounded 洞察、合同风险识别、治理审计和导出限制等核心场景的视觉与交互原则。

#### Scenario: 后续新增分析工作台界面

- **WHEN** 后续变更新增或重构 Web 智能分析工作台
- **THEN** 设计输入必须优先体现 AI 问数、执行过程、可信解释和继续追问能力
- **THEN** 不得只按传统菜单、筛选表单和静态表格组织首屏体验

#### Scenario: 后续协作者查看设计参考来源

- **WHEN** 协作者需要理解本系统设计为何不是单一 Cohere 风格
- **THEN** `DESIGN.md` 必须说明 Cohere、Sentry、ClickHouse、Linear、Airtable、Coinbase、IBM、Intercom、Apple 或 Vercel 等参考方向的取舍
- **THEN** `DESIGN.md` 必须给出适合本系统的综合设计结论

### Requirement: 旧原型不得继续作为新视觉强约束

仓库 MUST 明确 `docs/prototype-ui/crm-intelligent-analytics-ui.pen` 和 `docs/prototype-ui/UI规范.md` 是旧版历史参考，不再作为新视觉风格、布局结构、卡片形态、尺寸或一级导航的强约束。后续需要可读尺寸原型时，MUST 基于 `DESIGN.md` 重新生成新的 `.pen`，不得以旧原型小修小补替代新版设计。

#### Scenario: 后续 UI 方案与旧 pen 不一致

- **WHEN** 后续 UI 方案基于 `DESIGN.md` 重设导航、首屏结构、核心卡片或结果详情
- **THEN** 不得因旧 `.pen` 原型不一致而判定方案无效
- **THEN** 若需要原型交付，必须输出与新设计系统一致的新 `.pen`

### Requirement: 设计系统必须约束可信 AI 结果呈现

`DESIGN.md` MUST 要求分析结果、合同审核结果和治理审计结果展示事实来源、权限范围、筛选条件、数据更新时间、口径说明、执行状态和审计状态。AI 洞察 MUST 与当前受控结果绑定，不得在视觉或文案上暗示未验证事实。

#### Scenario: 展示一次分析结果

- **WHEN** Web 页面展示一次 AI 分析结果
- **THEN** 页面必须能够呈现摘要、关键指标、主视图、明细、口径说明、权限范围和审计状态
- **THEN** AI 洞察必须被标识为基于当前结果事实生成

### Requirement: 设计系统必须覆盖交互反馈与无障碍要求

`DESIGN.md` MUST 定义关键交互状态和无障碍要求，至少覆盖悬浮、点击、聚焦、禁用、加载、成功、失败、空状态、无权限、超时、降级和风险提示。颜色不得作为唯一状态区分方式，文字对比度 MUST 满足可读性要求。

#### Scenario: 用户触发导出但被限制

- **WHEN** 用户触发导出但因权限、次数或行数限制被阻断
- **THEN** 界面必须展示清晰的阻断原因和下一步建议
- **THEN** 阻断状态必须通过颜色以外的文本或图标同步表达
