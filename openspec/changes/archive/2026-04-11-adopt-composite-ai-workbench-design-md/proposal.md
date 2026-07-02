## Why

当前仓库已有一期主规格、前端页面和旧版 `.pen` 原型，但缺少一份面向后续设计、前端实现和代理协作的统一设计系统入口。旧版原型和 UI 规范偏传统后台风格，无法支撑“企业 AI 分析工作台、可解释问数、合同风险识别和治理审计”的产品气质，因此需要参考 `awesome-design-md` 中多家大公司设计体系，综合沉淀一套适合本系统的根级 `DESIGN.md`，明确后续视觉方向可以脱离旧 `.pen` 约束并进行颠覆式重设。

## What Changes

- 新增根级 `DESIGN.md`，作为 CRM 智能分析系统后续 UI 设计、编码实现和设计评审的最高视觉规范入口。
- 综合参考 Cohere、Sentry、ClickHouse、Linear、Airtable、Coinbase、IBM、Intercom、Apple、Vercel 等方向，形成 CRM 智能分析系统专属设计语言。
- 明确最佳设计组合：以 Cohere 的 AI 平台感为外壳，以 Sentry / ClickHouse 的数据可信感支撑分析，以 Linear 的克制精确降低噪声，以 Airtable 的结构化数据体验承载模板和表格，以 Coinbase / IBM 的可信企业感兜住权限、审计和无障碍，以 Intercom 的对话体验优化补问和追问。
- 明确旧 `.pen` 原型和 `docs/prototype-ui/UI规范.md` 只作为历史参考，不再作为视觉风格或布局结构的强约束。
- 更新仓库协作文档和入口文档，确保后续协作者优先读取 `DESIGN.md`，避免继续按旧白底蓝灰后台风格实现新界面。
- 保持本次变更为文档与规范层变更，不修改后端 API、数据库、前端路由、前端组件实现或运行时配置。

## Capabilities

### New Capabilities

- `ui-design-system`: 定义 CRM 智能分析系统的设计系统入口、综合参考策略、视觉方向、组件原则、交互反馈、无障碍要求，以及它与旧原型和主规格之间的优先级关系。

### Modified Capabilities

- 无。

## Impact

- 影响根级 `DESIGN.md`、`README.md`、`AGENTS.md` 和 `docs/prototype-ui/UI规范.md` 的文档说明与协作优先级。
- 影响后续前端页面设计与实现决策，但本次不直接修改 `frontend/` 代码。
- 不影响后端 API、数据库结构、企业微信机器人能力、CRM 接入链路、OpenAPI 契约或现有测试运行方式。
