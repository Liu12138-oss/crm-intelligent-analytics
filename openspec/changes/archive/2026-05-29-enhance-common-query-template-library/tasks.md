## 1. 契约与数据模型

- [x] 1.1 扩展 `backend/src/shared/types/domain.ts` 和 `frontend/src/types/analysis.ts`，为查询模板补充 `category`、`tags`、`sourceType`、`sourceQueryId`、`sourceTemplateId`、`sourceSnapshot`、`ownerUserId`、`visibilityType`、`usageCountTotal`、`lastUsedAt` 字段。
- [x] 1.2 更新 `backend/src/modules/query-assets/query-template.repository.ts` 的历史模板规范化逻辑，为旧模板补齐标签、可见性、归属人和历史点击统计。
- [x] 1.3 更新应用存储初始数据或迁移脚本，确保新字段在 `.runtime/app-storage.json` 和正式应用库迁移路径中均有兼容默认值。
- [x] 1.4 扩展 `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`，补充模板列表分页筛选、保存自由问数为模板、复制到我的模板、分类标签字段和 SQL 编写权限相关契约。
- [x] 1.5 更新 `frontend/src/services/analysis.service.ts`，新增保存模板、复制到我的模板、分类标签查询和分页模板列表调用。

## 2. 后端模板库能力

- [x] 2.1 扩展 `backend/src/modules/query-assets/query-template.controller.ts`，支持 `scope=mine|others`、关键词、标签、创建人、分页和 `usage_desc` 排序。
- [x] 2.2 在 `backend/src/modules/query-assets/query-template.service.ts` 中实现“我的模板 / 其它模板”分层逻辑，确保其它模板不返回当前用户自己的模板副本。
- [x] 2.3 实现 `POST /api/v1/analysis/templates/:templateId/copy-to-mine`，复制模板定义快照生成当前用户个人副本，并记录来源模板 ID、来源名称、来源 SQL 版本和复制时间。
- [x] 2.4 模板执行成功后更新历史累计使用次数和最近使用时间；“添加到我的模板”不得计入执行点击。
- [x] 2.5 新增分类和标签聚合能力，支持工作台和治理页选择已有分类 / 标签，同时允许保存时写入新标签。
- [x] 2.6 为模板复制、模板执行统计更新、分类标签新增或复用补充审计事件。

## 3. 自由问数保存为模板

- [x] 3.1 在分析结果执行快照中确认或补齐保存模板所需的受控 SQL、参数、执行计划、展示配置、范围治理摘要和一致性标识。
- [x] 3.2 新增 `POST /api/v1/analysis/queries/:queryId/templates` 后端接口，只允许基于服务端 `queryId` 执行事实生成模板。
- [x] 3.3 实现自由问数保存策略：优先复用实际执行受控 SQL；仅有执行计划时编译为参数化 SQL 模板；无法安全复现时返回中文不可保存原因。
- [x] 3.4 保存生成模板前重新执行只读 SQL、白名单、AST 安全、危险语句、范围治理和预检校验。
- [x] 3.5 保存成功后默认 `visibilityType=SHARED`，归属当前用户并进入“我的模板”；其它用户可在“其它模板”搜索到。
- [x] 3.6 为保存成功、保存失败、执行计划编译失败和校验失败补充审计。

## 4. 固定部门模板改写

- [x] 4.1 扩展模板范围治理分析，识别问题文本、默认条件和 SQL 中写死的部门 ID、部门名称、负责人、团队、区域和静态团队清单。
- [x] 4.2 在模板执行前校验当前用户范围是否覆盖固定范围；不覆盖时阻断原范围执行。
- [x] 4.3 实现“改为当前可见范围”候选改写生成，返回中文提示并等待用户确认，不允许静默改写执行。
- [x] 4.4 用户确认后将固定范围条件替换为当前 `scopeSnapshot` 覆盖范围，并重新执行 SQL 白名单、AST、范围注入和预检。
- [x] 4.5 对无法可靠替换的固定范围模板返回联系管理员治理为通用模板的中文提示。
- [x] 4.6 为固定范围识别、原范围阻断、用户确认、改写成功和改写失败补充审计快照。

## 5. 权限与治理后台

- [x] 5.1 在权限目录、权限中心配置和后端权限决策中新增 `template.sql.write` 或等价中文权限“查询模板 SQL 编写”。
- [x] 5.2 在后端 SQL 模板新增、校验、预览和保存入口接入 `template.sql.write` 校验；完整模板治理仍保留 `template.manage` 校验。
- [x] 5.3 确保应用超级管理员自动拥有 `template.sql.write`，但仍必须通过 SQL 安全、范围治理和审计。
- [x] 5.4 扩展 `frontend/src/pages/governance/QueryTemplatePage.vue`，支持标签分类、来源模板、归属人、历史点击和 SQL 编写权限下的受控新增入口。
- [x] 5.5 治理页保存或编辑模板时支持选择已有分类、自由输入新分类、选择已有标签和自由输入新标签。

## 6. 工作台前端改造

- [x] 6.1 重构 `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`，将常用查询从抽屉改为桌面端左侧常驻资产区，最近查询继续保持抽屉。
- [x] 6.2 重构 `frontend/src/components/analysis/CommonQueryPanel.vue`，支持“我的模板 / 其它模板”标签页、搜索筛选、标签、创建人筛选和历史点击排序展示。
- [x] 6.3 为左侧常用查询区实现默认宽度、点击展开、点击收缩、拖拽调整宽度、最小 / 最大宽度和窄屏折叠策略。
- [x] 6.4 为模板列表接入服务端分页和虚拟滚动或等效大列表方案，保证 1000 条模板滚动和筛选稳定。
- [x] 6.5 在分析结果区增加“保存为模板”动作和保存弹窗，弹窗包含模板名称、说明、标签、AI 推荐提示、保存和取消动作。
- [x] 6.6 标签控件支持选择已有标签、自由输入新标签和 AI 推荐标签确认；标签不得挤压按钮或造成表单文本重叠。
- [x] 6.7 在“其它模板”列表中增加“添加到我的模板”按钮，成功后提示并刷新“我的模板”列表。
- [x] 6.8 所有保存、复制、加载、空状态、无权限、失败和固定范围改写提示使用中文业务文案，不直接暴露 SQL、字段名、内部枚举或堆栈。

## 7. 测试与验证

- [x] 7.1 新增后端契约测试，覆盖模板列表分页筛选、保存自由问数为模板、复制到我的模板、分类标签字段和 SQL 编写权限。
- [x] 7.2 新增后端集成测试，覆盖个人副本不跟随来源模板变更、默认全员可见但执行按当前用户权限收口、历史点击排序和复制不计点击。
- [x] 7.3 新增固定部门模板测试，覆盖无权限执行山东模板被阻断、用户确认改写为当前可见范围、无法安全改写时阻断和审计记录。
- [x] 7.4 新增自由问数保存测试，覆盖受控 SQL 保存、执行计划编译保存、无法复现时拒绝保存和保存失败审计。
- [x] 7.5 新增权限测试，覆盖 `template.sql.write` 可新增受控 SQL 模板但不能管理全局模板治理，缺少权限时接口拒绝并审计。
- [x] 7.6 新增前端组件和 store 测试，覆盖“我的模板 / 其它模板”切换、搜索筛选、标签输入、复制到我的模板、保存弹窗和反馈文案。
- [x] 7.7 新增或更新 Playwright E2E，覆盖桌面端左侧常驻模板库、宽度拖拽、最近查询抽屉保持、模板达到大列表规模时仍可搜索筛选。
- [x] 7.8 运行 `pnpm --dir backend test`、`pnpm --dir frontend test:unit`、`pnpm --dir frontend test:e2e` 和 `pnpm --dir frontend build`，记录任何无法运行的原因。

## 8. 文档同步

- [x] 8.1 更新 `specs/001-crm-intelligent-analytics/spec.md`，补充常用查询资产库、保存模板、个人副本、分类标签和固定部门改写验收。
- [x] 8.2 更新 `specs/001-crm-intelligent-analytics/data-model.md`，补充模板字段、个人副本来源快照、分类标签和使用统计。
- [x] 8.3 更新 `specs/001-crm-intelligent-analytics/quickstart.md`，新增常用查询优化、自由问数保存、复制到我的模板、固定部门改写和 SQL 编写权限验证场景。
- [x] 8.4 更新 `specs/001-crm-intelligent-analytics/tasks.md` 或实现任务清单，确保后续主规格任务与本 OpenSpec 变更一致。
- [x] 8.5 如用户可见能力清单变化，更新 `README.md` 中智能分析工作台与查询模板相关说明。
