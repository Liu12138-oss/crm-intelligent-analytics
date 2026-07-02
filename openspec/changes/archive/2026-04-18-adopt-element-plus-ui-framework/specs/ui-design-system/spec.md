## ADDED Requirements

### Requirement: 前端必须统一采用 Element Plus 作为基础 UI 框架

系统 MUST 在后续 Web 前端重构中统一采用 `Element Plus` 作为 Vue 3 基础 UI 组件库，并配套使用 `@element-plus/icons-vue` 作为默认图标来源。Element Plus MUST 用于承接按钮、表单、输入框、选择器、表格、标签、提示、抽屉、上传、加载、空状态、消息反馈等通用交互组件，避免继续在各页面重复手写基础控件。

#### Scenario: 协作者开始前端 UI 框架重构

- **WHEN** 协作者开始实施前端 UI 框架重构
- **THEN** 必须安装并接入 `element-plus`
- **THEN** 必须安装并接入 `@element-plus/icons-vue`
- **THEN** 不得再引入第二套桌面端 Vue UI 组件库承担同类基础组件职责

#### Scenario: 页面需要新增通用交互控件

- **WHEN** 页面需要新增按钮、表单、输入框、表格、标签、抽屉、上传、加载或空状态
- **THEN** 应优先使用 Element Plus 对应组件或项目封装后的 Element Plus 组件
- **THEN** 不得无理由新增与 Element Plus 能力重复的手写基础控件

### Requirement: Element Plus 主题必须服从 DESIGN.md

系统 MUST 将 Element Plus 作为基础组件能力来源，而不是视觉风格来源。Element Plus 的颜色、圆角、字体、边框、焦点、禁用、加载和状态表达 MUST 通过主题变量、项目级样式覆盖或项目封装组件与根级 `DESIGN.md` 对齐。页面 MUST 保持浅色主导、克制可信、统一 `12px` 控件圆角、标签不换行、清晰加载反馈和响应式优先的视觉方向。

#### Scenario: 协作者接入 Element Plus 样式

- **WHEN** 协作者导入 Element Plus 基础样式
- **THEN** 必须同时提供项目级主题覆盖
- **THEN** 主色、状态色、圆角、边框、字体和焦点外环必须映射到 `DESIGN.md` 的设计令牌
- **THEN** 页面不得呈现 Element Plus 默认蓝白后台风格作为最终交付效果

#### Scenario: 协作者重构已有页面

- **WHEN** 协作者使用 Element Plus 重构登录、分析、合同、治理或审计页面
- **THEN** 页面骨架、信息层级、权限边界、风险表达和交互反馈仍必须遵循 `DESIGN.md`
- **THEN** 不得因为使用 UI 框架而弱化可信结果说明、审计留痕、权限范围或响应式可读性

### Requirement: 图标语义必须由 Element Plus 图标体系补齐

系统 MUST 使用 `@element-plus/icons-vue` 补齐当前缺失的图标语义。关键导航、主操作、状态、风险、上传、导出、刷新、筛选、搜索、返回、关闭、展开收起、审计事件类型和合同风险等级 MUST 有稳定图标表达，并与中文文案共同传达状态；颜色不得作为唯一状态信号。

#### Scenario: 协作者重构应用壳层导航

- **WHEN** 协作者使用 Element Plus 重构左侧导航或顶部栏
- **THEN** 导航项必须使用稳定图标表达业务入口
- **THEN** 不得继续使用文字首字、临时字符或无语义装饰作为导航图标
- **THEN** 当前激活项必须同时通过图标、文字和视觉状态表达

#### Scenario: 页面展示状态或风险

- **WHEN** 页面展示成功、失败、警告、风险、阻断、加载、上传、导出或审计事件状态
- **THEN** 状态必须同时包含图标和中文说明
- **THEN** 图标语义必须与状态含义一致
- **THEN** 不得只依赖颜色区分状态等级

### Requirement: Element Plus 重构必须保持现有业务行为不变

系统 MUST 将 Element Plus 重构限定在前端 UI 表现层、组件标签、样式、图标和局部展示状态范围内。实施时 MUST 保留现有路由、`v-model`、事件绑定、store/service 调用、登录流程、分析请求、结果导出、追问、合同上传、风险展开、治理保存、模板创建、审计刷新和筛选行为。除非另立功能变更，系统 MUST NOT 修改后端 API、数据库、OpenAPI 契约、权限模型或企业微信能力边界。

#### Scenario: 协作者替换页面按钮与表单

- **WHEN** 协作者将原生按钮、输入框或表单替换为 Element Plus 组件
- **THEN** 原有 `@click`、`v-model`、`:disabled`、加载状态和错误提示必须保持等价
- **THEN** 已有单元测试和 E2E 覆盖的用户行为不得发生回归

#### Scenario: 协作者替换上传、抽屉、表格或消息组件

- **WHEN** 协作者将上传、抽屉、表格或消息反馈替换为 Element Plus 组件
- **THEN** 文件选择、拖拽上传、导出、分页、空状态、错误状态和关闭操作必须保持原有业务调用
- **THEN** 如果 Element Plus 组件事件模型不同，必须在页面层适配，不得改变 service 或后端契约

### Requirement: Element Plus 重构必须采用渐进式迁移与验证

系统 MUST 按阶段实施 Element Plus 重构，先建立依赖、主题覆盖和图标映射，再逐页替换登录、应用壳层、分析链路、合同审核、治理配置和审计中心。每个阶段 MUST 运行对应验证，最终 MUST 运行前端 lint、单元测试、E2E 测试和构建。

#### Scenario: 协作者完成基础接入阶段

- **WHEN** Element Plus 依赖、主题覆盖和图标映射完成
- **THEN** 必须运行 `pnpm --dir frontend lint`
- **THEN** 必须运行 `pnpm --dir frontend build`
- **THEN** 页面不得出现全局样式污染导致的登录页、工作台或表格布局明显异常

#### Scenario: 协作者完成页面替换阶段

- **WHEN** 任一页面完成 Element Plus 替换
- **THEN** 必须核对该页面所有请求型按钮都有加载反馈
- **THEN** 必须核对该页面关键图标、状态说明、空状态和失败反馈完整
- **THEN** 必须运行覆盖该页面的单元测试或 E2E 测试

#### Scenario: 协作者完成全部前端重构

- **WHEN** 所有目标页面完成 Element Plus 重构
- **THEN** 必须运行 `pnpm --dir frontend lint`
- **THEN** 必须运行 `pnpm --dir frontend test:unit`
- **THEN** 必须运行 `pnpm --dir frontend test:e2e`
- **THEN** 必须运行 `pnpm --dir frontend build`
