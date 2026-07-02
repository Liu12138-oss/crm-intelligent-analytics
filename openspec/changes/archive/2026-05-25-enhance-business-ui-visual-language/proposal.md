## Why

当前 Web 界面已经完成 Element Plus 与浅色工作台方向的基础迁移，但页面视觉仍容易落到“白色卡片 + 灰字 + 单一蓝紫按钮”的通用后台效果。领导反馈的“颜色太单一、页面太粗糙、图标图形元素太少、字体间距层级不足”说明根级 `DESIGN.md` 需要进一步固化业务视觉语言，并把后续页面改造拆成可执行、可验收的 OpenSpec 任务。

本变更用于承接 2026-05-23 对 `DESIGN.md` 的补强方向，避免后续实现因上下文丢失而只做局部美化，确保智能分析、经营报表、模板治理、权限连接、合同审核、审计中心和 AI 配置都按统一业务视觉系统升级。

## What Changes

- 强化根级 `DESIGN.md` 对视觉丰富度的约束：新增业务视觉锚点、业务辅助色、图表色板、图标图形体系、业务插画、数据可视化语法和设计评审清单。
- 将“克制可信”从“少用颜色、少用图形”修正为“颜色和图形必须服务业务识别、状态理解和数据比较”，避免页面继续显得单调粗糙。
- 建立各业务页面的改造基线：
  - 智能分析工作台：形成 `AI 问数 + 经营概览 + 可复用资产 + 可信边界` 的组合。
  - 经营报表：强化周期、负责人、部门、客户范围、趋势、排行、漏斗和经营异常。
  - 查询模板与模板治理：采用“左侧分类 / 中间列表 / 右侧详情或抽屉”的方案库结构。
  - 权限中心与连接策略：突出对象类型、权限生效、连接状态、同步健康和影响范围。
  - 合同审核：形成“总体结论 / 风险项清单 / 原文证据”的三层阅读结构。
  - 审计中心：从日志表升级为事件复核工作台。
  - AI 配置：分层展示 Profile、模型、上下文策略、健康检查和切换历史。
- 补齐前端实现约束：扩展 `UiIcons` 业务对象图标、建立视觉 token、升级图表组件、优化表格主列、补齐空状态 / 加载态 / 无权限态图形，并按响应式断点验证。
- 明确本次提案不改变后端 API、数据库、OpenAPI 契约、权限模型、企业微信能力边界或自然语言理解链路。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `ui-design-system`：补充业务视觉语言、视觉丰富度底线、业务辅助色、图表色板、图标图形体系、页面级视觉改造基线和设计评审检查清单。
- `web-ui-ux-redesign`：将现有 Web UI/UX 重设要求从基础浅色工作台升级为可执行的业务页面视觉改造要求，覆盖智能分析、经营报表、模板治理、权限连接、合同审核、审计中心和 AI 配置。

## Impact

- 主要影响文档与前端表现层：
  - `DESIGN.md`
  - `frontend/src/styles/main.css`
  - `frontend/src/styles/element-plus-theme.css`
  - `frontend/src/ui/icons.ts`
  - `frontend/src/components/analysis/*`
  - `frontend/src/components/management-report/*`
  - `frontend/src/components/governance/*`
  - `frontend/src/pages/analysis/*`
  - `frontend/src/pages/management-report/*`
  - `frontend/src/pages/governance/*`
  - `frontend/src/pages/contract-review/*`
  - `frontend/src/pages/audit/*`
- 可能新增前端展示型组件，例如模块徽标、业务空状态、状态摘要条、图表色板工具、对象图标标签、风险等级图标、页面状态条和抽屉详情组件。
- 不影响：
  - 后端 API、数据库、OpenAPI 契约
  - CRM 官方 API 优先接入原则
  - 权限模型、审计留痕、白名单边界
  - 企业微信机器人能力清单
  - 当前登录、会话、企业微信扫码回跳兜底逻辑
- 验证影响：
  - 需要前端单元测试覆盖新增视觉映射和业务代码展示。
  - 需要 Playwright 或等价截图巡检覆盖主要页面桌面端与窄屏响应式。
  - 需要构建、lint、单元测试和相关 E2E 回归，确保视觉改造不破坏现有业务行为。
