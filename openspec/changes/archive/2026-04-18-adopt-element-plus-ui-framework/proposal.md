## Why

当前前端已经进入实现阶段，但运行时依赖仍只有 Vue、Vue Router 和 Pinia，缺少统一 UI 组件库与图标体系。近期 UI 重设依靠大量自定义 class 补齐基础控件，后续继续扩展登录、智能分析、合同审核、治理审计和审计检索页面时，容易重复实现按钮、表单、表格、抽屉、上传、加载、空状态和图标语义，维护成本与交互一致性风险都会上升。

本变更选择 `Element Plus` 作为 Vue 3 基础 UI 组件库，并配套使用 `@element-plus/icons-vue` 补齐图标能力，为后续渐进式前端重构建立依赖、主题、图标、组件映射和回归验证边界。

## What Changes

- 在前端依赖中引入 `element-plus` 和 `@element-plus/icons-vue`，作为后续 Web 重构的统一基础组件和图标来源。
- 建立 Element Plus 接入层，包括全局注册策略、样式导入、主题变量覆盖、图标命名映射和项目级组件封装边界。
- 按 `DESIGN.md` 保留浅色主导、克制可信、统一 `12px` 控件圆角、标签不换行、明确加载反馈和响应式骨架，不直接套用 Element Plus 默认后台视觉。
- 用 Element Plus 逐步替换现有自定义按钮、输入框、文本域、表格、标签、提示、抽屉、上传、加载、空状态和消息反馈。
- 使用 `@element-plus/icons-vue` 补齐当前缺失的导航、操作、状态、风险、上传、导出、刷新、筛选、搜索、返回、关闭、展开收起等图标语义。
- 保持本变更为前端 UI 层重构：不得修改后端 API、数据库、OpenAPI 契约、业务权限模型或企业微信能力边界。
- 重构必须保持现有路由、事件绑定、`v-model`、store/service 调用和已验收交互行为不变，除非另行提出功能变更。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `ui-design-system`: 增加 Element Plus 与 `@element-plus/icons-vue` 的前端 UI 基础设施要求，明确主题覆盖、图标补齐、渐进式重构和验证边界。

## Impact

- 影响前端依赖：`frontend/package.json`、锁文件、`frontend/src/main.ts`、全局样式与主题变量。
- 影响前端 UI 代码：登录页、应用壳层、分析工作台、结果详情、合同审核、治理策略、模板管理、连接策略、审计中心和分析组件。
- 影响测试：需要更新或补充单元测试、E2E 测试和构建验证，确保 Element Plus 组件接入后仍保留原有业务行为。
- 不影响后端 API、数据库、OpenAPI 契约、CRM 读写边界、企业微信机器人能力和认证会话业务逻辑。
