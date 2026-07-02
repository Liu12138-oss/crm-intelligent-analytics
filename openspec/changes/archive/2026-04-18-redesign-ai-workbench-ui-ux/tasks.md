## 1. 全局设计令牌与基础样式

- [x] 1.1 在 `frontend/src/styles/main.css` 建立与 `DESIGN.md` 对齐的 CSS 变量，覆盖颜色、渐变、字体层级、圆角、阴影、边框、动画时长和焦点状态
- [x] 1.2 重设 `.page`、`.panel`、`.badge`、`.button-primary`、`.button-secondary`、`.input`、`.textarea`、`.table`、`.grid-two` 等基础 class，形成浅色主导、统一骨架、浅色数据面板组合
- [x] 1.3 补齐按钮、输入框、文本域、表格行、上传区、导航项、禁用、加载、空状态、失败和风险状态样式，并落实统一 `12px` 控件圆角与标签不换行规则
- [x] 1.4 移除或收敛主要页面中的行内视觉样式，改用语义化 class；不得修改 `<script setup>` 逻辑

## 2. 应用壳层与登录页

- [x] 2.1 重设 `AppShell.vue` 的 template 与 class，形成左侧导航、顶部吸顶栏、主内容区、右侧信息区 / 抽屉的统一工作台骨架，并保留当前用户、角色提示、分析服务状态和退出入口
- [x] 2.2 保留 `RouterLink` 路由目标、`isActive` 激活逻辑、`hintText` 提示逻辑和 `logout` 调用不变
- [x] 2.3 重设 `LoginPage.vue` 的 template 与 class，沿用现有系统登录页文案与信息结构，只优化左侧辅助区、账号密码登录、企业微信扫码登录、绑定提示、错误反馈和帮助入口视觉，并确保左右区块共享同一视觉画布
- [x] 2.4 保留登录页所有 `v-model`、登录方式切换、扫码组件挂载、提交登录和帮助入口相关逻辑不变

## 3. 分析链路页面

- [x] 3.1 重设 `AnalysisWorkbenchPage.vue` 的 template 与 class，让自然语言问数成为核心模块之一，同时满足首页减噪和主内容优先原则
- [x] 3.2 强化工作台的当前权限、服务状态、执行中反馈、关键指标、AI 洞察、常用查询、最近查询和结果入口层级
- [x] 3.3 重设 `AnalysisResultDetailPage.vue` 的 template 与 class，突出可信结果详情、筛选条件、权限范围、可执行动作、导出状态和追问区
- [x] 3.4 更新分析组件 template / class，包括 `MetricCardGroup.vue`、`ResultSummaryPanel.vue`、`ResultChartView.vue`、`ResultTableView.vue`、`CommonQueryPanel.vue` 和 `RecentQueryPanel.vue`
- [x] 3.5 核对发起分析、刷新状态、常用查询、最近查询、导出、查看详情和提交追问事件绑定均保持原有调用

## 4. 合同审核页面

- [x] 4.1 重设 `ContractReviewWorkbenchPage.vue` 的 template 与 class，突出上传入口、拖拽区域、审核路径说明、反馈提示和最近任务
- [x] 4.2 重设 `ContractReviewDetailPage.vue` 的 template 与 class，优先展示总体结论、一票否决、高风险项、审核依据、降级初筛提示和产物下载状态
- [x] 4.3 核对文件选择、拖拽上传、任务跳转、风险展开、轮询状态展示和产物下载事件绑定均保持原有调用

## 5. 治理审计页面

- [x] 5.1 重设 `GovernancePolicyPage.vue` 的 template 与 class，形成治理策略控制塔、权限范围、导出限制和并发阈值分区
- [x] 5.2 重设 `QueryTemplatePage.vue` 的 template 与 class，形成模板治理、默认问题、命中率、点击量和状态管理的结构化数据体验
- [x] 5.3 重设 `ConnectionPolicyPage.vue` 的 template 与 class，强化心跳、排队、在线会话和历史保留阈值配置
- [x] 5.4 重设 `AuditEventPage.vue` 的 template 与 class，形成审计控制塔摘要、筛选区和事件流明细
- [x] 5.5 核对保存策略、创建模板、刷新审计和筛选审计事件绑定均保持原有调用

## 6. 响应式、验证与回归

- [x] 6.1 补齐桌面、窄屏和移动端样式，确保登录、问数输入、关键指标、风险结论、治理表单和审计表格摘要可读可用，并覆盖 `360px` 到 `1600px` 断点范围
- [x] 6.2 人工核对本次实施未修改 `<script setup>`、store、service、router、types、后端 API、数据库和 OpenAPI 契约
- [x] 6.3 运行 `openspec validate redesign-ai-workbench-ui-ux --strict`
- [x] 6.4 运行 `pnpm --dir frontend lint`
- [x] 6.5 运行 `pnpm --dir frontend test:unit`
- [x] 6.6 运行 `pnpm --dir frontend build`
- [x] 6.7 人工验收登录、分析工作台、结果详情、合同审核工作台、合同详情、治理策略、模板管理、连接策略和审计检索页面的视觉、交互状态和功能触发不变
