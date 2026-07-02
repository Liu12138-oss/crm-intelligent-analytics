## Why

当前 Web 业务页面已经处于统一的 `AppShell` 壳层之下，但内容区首屏仍额外渲染 `PageHeaderCompact` 标题栏，造成“壳层头部 + 内容页头部”双层标题结构，挤占首屏空间并削弱首个业务面板的直达性。需要统一彻底移除这层冗余内容页头，而不是在页面内容区保留它的迁移版，让用户进入页面后直接聚焦真实业务模块。

## What Changes

- 移除所有由 `AppShell` 承载的业务页面内容区顶部 `PageHeaderCompact` 标题栏，保留全局顶部品牌栏与左侧导航。
- 原内容标题栏中的页面标题、说明文案、状态标签、查询 ID 等上下文元素不再迁移到内容区作为替身继续展示。
- 仅保留确有业务必要的操作按钮，并将其附着到对应业务模块本身，不保留“页头迁移版”结构。
- 统一智能分析工作台、分析结果详情、智能合同审核工作台、智能合同审核详情、治理策略、查询模板管理、连接策略管理、审计中心的首屏结构，让页面加载后直接进入业务区。
- 保持现有路由、接口、权限校验、按钮行为、事件绑定和数据流不变；本次变更仅调整模板结构、样式组织和静态呈现层。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `ui-design-system`: 调整 `AppShell` 内容页的首屏组织方式，禁止重复内容标题栏，并要求页头文案与页头上下文信息不在内容区继续保留替身展示。

## Impact

- 受影响代码主要位于 `frontend/src/pages/analysis/`、`frontend/src/pages/contract-review/`、`frontend/src/pages/governance/`、`frontend/src/pages/audit/`、`frontend/src/components/layout/PageHeaderCompact.vue` 和 `frontend/src/styles/main.css`。
- 不影响前端路由路径、Pinia store、service、后端 API、OpenAPI 契约和数据库结构。
- 后续实现需要逐页校对原有 `@click`、`v-model`、`:disabled`、上传、导出和返回行为，确保页头收口后功能行为保持一致。
