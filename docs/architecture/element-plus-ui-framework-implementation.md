# Element Plus 前端重构实施记录

## 实施范围

本次按 OpenSpec 变更 `adopt-element-plus-ui-framework` 引入 `Element Plus` 与 `@element-plus/icons-vue`，完成前端基础组件与图标体系接入，并对现有主要页面进行渐进式替换。

已覆盖页面与组件：

- 登录页：账号密码登录、企业微信扫码入口、管理员联系方式、登录请求态。
- 应用壳层：左侧导航、顶部栏、退出登录、运行信息区。
- 分析工作台：自然语言问数输入、刷新、提交、导出、查看详情、查询资产抽屉。
- 分析结果详情：状态标签、导出、推荐追问、追问提交、可信说明和结果表格。
- 分析组件：常用查询、最近查询、指标卡、摘要、图表空状态、结果表格。
- 合同审核：上传入口、拖拽提示、反馈提示、最近任务、风险标签、产物下载和风险依据展开。
- 治理配置：权限中心、查询模板、连接策略的表单、保存/创建请求态和摘要卡。
- 审计中心：刷新、筛选、筛选表单、事件明细表、AI 预警和治理建议状态标签。

## 组件覆盖

- `ElButton`：主要请求型按钮、返回、导出、刷新、筛选、保存、创建、执行与重跑。
- `ElInput`：登录账号密码、问数文本域、追问文本域、治理表单、模板表单、连接策略和审计筛选。
- `ElTag`：服务状态、权限状态、导航与业务状态、风险等级、模板状态和动作标签。
- `ElAlert`：登录反馈、权限范围、可信说明、错误/成功/警告/信息反馈、降级提示。
- `ElDrawer`：分析工作台查询资产抽屉。
- `ElTable` / `ElTableColumn`：结果明细、模板列表和审计事件明细。
- `ElEmpty`：结果表格和图表空状态。
- `ElCard`：分析指标卡。
- `ElIcon`：导航、操作、状态、风险、上传、导出、刷新、筛选、搜索、返回、展开收起等语义图标。

## 主题与样式

- 新增 `frontend/src/styles/element-plus-theme.css`，将 Element Plus 变量映射到 `DESIGN.md` 的浅色主导、克制可信视觉体系。
- 保留 `frontend/src/styles/main.css` 作为页面骨架和项目级布局样式，不直接套用 Element Plus 默认后台视觉。
- `Vite` 已将 Vue 和 Element Plus 拆分为独立 chunk，避免 UI 框架体积与业务入口脚本混在一起。
- `frontend/tsconfig.json` 开启 `skipLibCheck`，避免 Element Plus 及其间接依赖声明文件在当前 TypeScript / vue-tsc 组合下阻塞业务构建。

## 图标补齐

- 新增 `frontend/src/ui/icons.ts` 作为图标语义映射入口。
- 新增 `frontend/src/ui/README.md` 说明图标使用原则，禁止继续使用文字首字、临时符号或无语义装饰作为关键图标。
- 当前已覆盖左侧导航、登录、上传、下载、刷新、筛选、查询、风险、成功、警告、失败、返回、展开收起等主要图标语义。

## 未完全迁移项

- 审计中心中的部分 AI 聚合统计小表仍保留原生表格结构，原因是它们是只读小型统计块，当前没有分页、排序或复杂交互；事件明细主表已迁移为 Element Plus 表格。
- 自定义图表仍保留现有轻量 DOM/CSS 实现，未引入新图表库；本次变更不包含图表库选型。
- 部分局部布局 class 继续保留，用于维持 `DESIGN.md` 规定的页面骨架、响应式和信息层级。

## 风险与后续建议

- Element Plus 独立 chunk 当前约 `914KB`，gzip 后约 `295KB`；已通过 Vite 手动分包隔离。后续若继续关注体积，可评估按需样式导入或组件自动导入插件。
- 后续新增页面应先复用 `UiIcons` 和 Element Plus 基础组件，再按 `DESIGN.md` 做项目级封装，避免重新发明按钮、表单、表格、标签和提示组件。
- 若继续重构审计聚合小表，可在不改变数据结构的前提下逐步替换为 `ElTable` 或卡片化摘要。

## 验证记录

本次实施已运行以下命令：

- `openspec validate adopt-element-plus-ui-framework --strict`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend test:unit`
- `pnpm --dir frontend test:e2e`
- `pnpm --dir frontend build`
