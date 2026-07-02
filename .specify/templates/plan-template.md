# 实施计划：[功能名称]

**分支**：`[###-feature-name]` | **日期**：[DATE] | **规格**：[link]
**输入**：来自 `/specs/[###-feature-name]/spec.md` 的功能规格

**说明**：本模板由 `/speckit.plan` 填充，最终交付文档必须使用中文，并与 `.specify/memory/constitution.md` 保持一致。

## 摘要

[从功能规格提炼：核心业务目标 + 选定技术路线 + 关键风险控制方式]

## 技术上下文

<!--
  必填：将本节替换为该功能的具体技术上下文。
  若信息尚未确定，可先写 NEEDS CLARIFICATION，
  但 Phase 0 研究结束前必须清零。
-->

**语言/版本**：[例如 TypeScript 5.x / Python 3.11 / NEEDS CLARIFICATION]
**主要依赖**：[例如 Vue 3、NestJS、MySQL / NEEDS CLARIFICATION]
**存储**：[例如 MySQL、文件存储、N/A]
**测试方案**：[例如 Vitest、Jest、Playwright / NEEDS CLARIFICATION]
**目标平台**：[例如 Linux 内网环境、桌面浏览器 / NEEDS CLARIFICATION]
**项目类型**：[例如 前后端分离 Web 应用 / 移动端 + API / NEEDS CLARIFICATION]
**性能目标**：[例如 95% 请求在 5 秒内返回 / NEEDS CLARIFICATION]
**约束条件**：[例如 只读访问、内网部署、默认拒绝 / NEEDS CLARIFICATION]
**规模/范围**：[例如 1400 名用户、10 个高频场景 / NEEDS CLARIFICATION]

## 宪章检查

*门禁：Phase 0 研究前必须通过；Phase 1 设计完成后必须复核。*

### Phase 0 前检查

- **原则 I 中文一致性交付**：[说明计划、研究、模型、契约、任务和提示文案如何满足中文与 UTF-8 约束]
- **原则 II CRM只读与最小授权边界**：[说明只读边界、授权来源和默认拒绝策略]
- **原则 III 受控查询与双重校验**：[说明结构化意图、白名单编译、AST 校验与补问策略]
- **原则 IV 审计留痕与关键链路验证**：[说明审计事件和自动化验证如何纳入计划]
- **原则 V 小步交付与复杂度控制**：[说明一期范围、MVP 边界和复杂度控制方式]

### Phase 1 设计后复核

- **研究结论已闭环**：[引用 research.md，说明 NEEDS CLARIFICATION 是否全部收敛]
- **数据模型与接口契约齐全**：[引用 data-model.md 与 contracts/]
- **任务清单可承接关键链路**：[确认 tasks.md 将覆盖安全、审计、导出、补问和验证任务]
- **复杂度例外已记录**：[如无例外，请明确写“无”]

## 项目结构

### 本功能文档

```text
specs/[###-feature-name]/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### 源码结构（仓库根目录）

<!--
  必填：将下方示例树替换为真实结构。
  删除无关选项，不要把“Option 1/2/3”字样保留到最终计划。
-->

```text
# 单项目示例
src/
├── models/
├── services/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# 前后端分离示例
backend/
├── src/
│   ├── modules/
│   ├── database/
│   └── shared/
└── test/

frontend/
├── src/
│   ├── pages/
│   ├── components/
│   ├── stores/
│   └── services/
└── tests/
```

**结构决策**：[说明最终采用的目录结构、原因，以及它如何满足一期范围与复杂度控制]

## 复杂度跟踪

> 仅当宪章检查存在例外且必须保留时填写。

| 例外项 | 必要性说明 | 被拒绝的更简单方案 |
|--------|------------|--------------------|
| [例如新增服务] | [当前需求] | [为什么现有结构不足] |
