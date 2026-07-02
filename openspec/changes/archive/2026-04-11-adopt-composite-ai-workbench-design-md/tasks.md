## 1. OpenSpec 提案产物

- [x] 1.1 创建 `adopt-composite-ai-workbench-design-md` 变更目录和 `.openspec.yaml`
- [x] 1.2 编写 `proposal.md`，说明新增 `DESIGN.md`、替换旧视觉约束，以及综合参考 `awesome-design-md` 的原因
- [x] 1.3 编写 `design.md`，固化综合型企业 AI 工作台、旧 `.pen` 降级和本次不改页面实现的设计决策
- [x] 1.4 编写 `specs/ui-design-system/spec.md`，定义设计系统入口、综合参考策略、AI 工作台定位、旧原型优先级、可信结果展示和交互无障碍要求

## 2. 设计系统文档

- [x] 2.1 新增根级 `DESIGN.md`，定义 CRM 智能分析系统的新视觉定位、综合参考矩阵、色彩、排版、布局、核心组件、交互状态、动效和无障碍规则
- [x] 2.2 在 `DESIGN.md` 中明确旧 `.pen` 和旧 `UI规范.md` 只作为历史参考，不再作为新视觉强约束
- [x] 2.3 在 `DESIGN.md` 中覆盖分析工作台、合同审核、治理审计、AI 洞察、导出限制和风险状态的设计要求

## 3. 文档优先级同步

- [x] 3.1 更新 `README.md` 的仓库结构、关键文档导航、推荐阅读顺序和协作约束，加入 `DESIGN.md` 并说明旧原型降级
- [x] 3.2 更新 `AGENTS.md` 的关键文档优先级、UI 输出和前端代码样式要求，明确视觉以 `DESIGN.md` 为准
- [x] 3.3 更新 `docs/prototype-ui/UI规范.md` 开头说明，标记其为旧版视觉规范且已被根级 `DESIGN.md` 取代

## 4. 验证

- [x] 4.1 运行 `openspec validate adopt-composite-ai-workbench-design-md --strict`
- [x] 4.2 运行 `git diff --check`
- [x] 4.3 人工检查新增和修改文档均为中文正文，未包含敏感配置明文
