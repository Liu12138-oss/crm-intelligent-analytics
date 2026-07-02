## Why

当前多个 Web 页面直接展示后端枚举、审计代码和内部工作流标识，例如 `WECOM_IDLE_MESSAGE`、`active-conversation-flow-continue`、`LOW`、`critical`、`ACTIVE` 和 `RETURNED`，导致业务用户无法理解页面含义。截图问题的根因不是样式或字体，而是前端缺少统一的业务代码中文展示层，需要在进入下一轮页面修复前先建立 OpenSpec 约束。

## What Changes

- 建立前端业务代码中文展示要求，覆盖智能分析工作台、分析结果详情、合同审核工作台、合同审核详情、治理策略、查询模板、连接策略、审计中心和登录页的页面级检查。
- 将后端返回的状态、风险等级、审计事件类型、入口场景、目标工作流、fallback 原因、执行模式、数据来源、模板状态、服务状态和可执行动作统一转换为中文标签。
- 新增统一业务字典 / 展示适配模块，页面禁止继续直接渲染内部枚举、英文等级、kebab-case 原因码或全大写代码。
- 对未知代码保留可诊断兜底：页面显示“未知类型（原始代码）”或同等中文提示，避免静默丢失审计线索。
- 补充单元测试和页面级 E2E / 组件测试，确保每个路由页面不再把典型内部代码直接暴露给用户。
- 本提案只定义修复范围和验收口径，不直接实施前端代码变更。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `ui-design-system`: 增加“业务代码必须转换为中文业务标签后展示”的 UI 展示要求，并要求后续页面实现复用统一映射出口。

## Impact

- 后续实施主要影响 `frontend/src/pages/`、`frontend/src/components/analysis/`、`frontend/src/types/analysis.ts`、`frontend/src/types/contract-review.ts` 以及新增的前端展示字典 / 格式化工具模块。
- 后续实施需要更新或新增 `frontend/tests/unit/` 和 `frontend/tests/e2e/` 中覆盖分析、治理、审计、合同审核页面的测试。
- 后端 API、数据库、OpenAPI 契约、权限模型、企业微信能力边界和敏感配置不在本次变更范围内。
- 实现时不得读取或转抄 `backend/.env.local`、`配置/` 下的密钥、Token、数据库账号或网关凭证。
