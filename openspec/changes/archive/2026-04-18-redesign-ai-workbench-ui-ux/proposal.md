## Why

当前 Web 前端仍以白底蓝灰传统后台结构和分散页面骨架为主，和根级 `DESIGN.md` 当前定义的“浅色主导、Stripe 化企业工作台、统一内容骨架、响应式优先”方向不一致。需要先建立独立 OpenSpec 变更，明确后续 UI/UX 重设只触达模板结构和样式层，不改业务数据流、接口、路由、状态管理或后端能力。

## What Changes

- 将现有 Web UI/UX 改造范围规划为“模板 + 样式”层：允许调整 Vue `template` 结构、CSS class、全局样式和静态体验文案，但登录页文案必须沿用现有系统口径。
- 明确禁止修改 `<script setup>` 业务逻辑、Pinia store、service、router、types、后端 API、数据库和 OpenAPI 契约。
- 按 `DESIGN.md` 重设登录页、应用壳层、分析工作台、分析结果详情、合同审核工作台、合同审核详情、治理配置、模板管理、连接策略和审计检索页面的视觉与体验。
- 建立页面级验收要求：统一骨架、左侧导航收起、顶部吸顶、滚动区边界、AI 问数首屏、可信结果呈现、合同风险优先、治理审计控制塔、移动端可读性、交互状态和无障碍。
- 保持本次变更为 OpenSpec 提案产物，不直接实施前端页面改造。

## Capabilities

### New Capabilities

- `web-ui-ux-redesign`: 定义基于 `DESIGN.md` 的 Web UI/UX 重设范围、页面级验收、禁止触达的功能代码边界和后续实施验证要求。

### Modified Capabilities

- 无。

## Impact

- 后续实施将影响 `frontend/src/styles/main.css` 以及现有页面和分析组件的 `template` 与 class 组织。
- 后续实施不得影响后端 API、数据库、OpenAPI 契约、前端路由路径、TypeScript 类型、Pinia store、service 方法或现有业务函数签名。
- 本提案依赖根级 `DESIGN.md` 和主规格 `openspec/specs/ui-design-system/spec.md`，不依赖旧 `.pen` 原型或旧 `docs/prototype-ui/UI规范.md`。
- 后续实施必须同步满足根级 `DESIGN.md` 中关于响应式、控件圆角统一、标签不换行、登录页现有文案基线和页面主次减噪的新增约束。
