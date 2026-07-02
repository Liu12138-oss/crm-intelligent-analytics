# 简化权限模型上线核查与回滚记录

## 目的

本文档用于记录“菜单权限包 + 风险子权限”上线前的权限样本、映射对比、异常半配置角色处理和回滚步骤。该变更只调整管理员配置口径和保存映射，不改变 CRM 数据范围、字段白名单、导出阈值、企业微信灰度、合同对象级权限和审计留痕边界。

## 基线角色样本

| 样本角色 | 样本来源 | 旧运行时字段摘要 | 新界面回显 | 上线核查结论 |
| --- | --- | --- | --- | --- |
| 系统管理员 `role_admin` | `DEFAULT_ROLE_PERMISSIONS` | 全部 Web 菜单、系统维护动作、企业微信动作、合同跨查看和跨下载 | 智能分析、经营报表、智能合同审核、企业微信机器人、全部系统维护菜单；全部风险子权限 | 不应丢失任何治理、审计、导出和合同审核能力 |
| 销售总监 `role_sales_director` | `DEFAULT_ROLE_PERMISSIONS` | 智能分析、经营报表、合同审核、企业微信动作、分析导出、经营报表导出 | 智能分析、经营报表、智能合同审核、企业微信机器人；分析导出、经营报表导出 | 常规问数、报表、合同发起、企业微信入口保持可用；不新增合同跨查看或跨下载 |
| 区域经理 `role_region_manager` | `DEFAULT_ROLE_PERMISSIONS` | 智能分析、经营报表、企业微信问数和日报预览，无导出 | 智能分析、经营报表、企业微信机器人；无风险子权限 | 可继续使用常规问数和报表；导出仍被阻断 |
| 销售副总 `role_sales_vp` | `DEFAULT_ROLE_PERMISSIONS` | 智能分析、经营报表、企业微信问数和日报预览，无导出 | 智能分析、经营报表、企业微信机器人；无风险子权限 | 可继续使用常规经营分析；导出仍被阻断 |
| 合同审核角色 | 合同审核权限回归样本 | 合同审核菜单、`contract.review.upload`，按需包含跨查看或跨下载动作 | 智能合同审核；按旧动作回显查询他人合同、下载他人合同或审核产物 | 本人合同审核不受影响；跨合同动作仍按风险子权限独立控制 |
| 企业微信机器人角色 | 企业微信灰度集成样本 | `wecomBotEligible=true` 与 `wecom.*` 动作 | 企业微信机器人 | 只授予角色侧入口资格，仍受灰度、停用名单、身份映射、对象级授权和确认门闩控制 |
| 审计角色 | 审计中心回归样本 | `audit.view`、`audit.sql.view`、`audit.sql.view_sensitive` | 审计中心 | SQL 审计和敏感明细 reveal 可用，reveal 必须继续写审计事件 |
| 历史半配置角色 `role_product_manager` | `access-governance.integration-spec.ts` | `webConsoleEnabled=true`，无 Web 菜单和动作 | 不自动勾选菜单，显示 `WEB_CONSOLE_WITHOUT_MENU` 提示 | 管理员保存前必须补充至少一个 Web 菜单，或确认取消 Web 入口能力 |

## 新旧映射验收表

| 旧字段命中条件 | 新界面回显 | 保存后规范化结果 |
| --- | --- | --- |
| `analysis-workbench`、`analysis.use`、`analysis.follow_up`、`template.view` 任一存在 | 智能分析 | `analysis-workbench`、`analysis.use`、`analysis.follow_up`、`template.view` |
| `analysis.export` 或 `exportAllowed=true` | 智能分析 / 导出数据 | `analysis.export`、`exportAllowed=true`，且必须依附智能分析 |
| `management-report` 或 `management.report.view` | 经营报表 | `management-report`、`management.report.view` |
| `management.report.export` | 经营报表 / 导出数据 | `management.report.export`，且必须依附经营报表 |
| `contract-review`、`contract.review.upload`、`contractReviewUploadAllowed=true` 任一存在 | 智能合同审核 | `contract-review`、`contract.review.upload`、`contractReviewUploadAllowed=true` |
| `contract.review.cross_view` 或 `contractReviewCrossViewAllowed=true` | 智能合同审核 / 查询他人合同 | `contract.review.cross_view`、`contractReviewCrossViewAllowed=true`，且必须依附智能合同审核 |
| `contract.review.cross_download` 或 `contractReviewCrossDownloadAllowed=true` | 智能合同审核 / 下载他人合同或审核产物 | `contract.review.cross_download`、`contractReviewCrossDownloadAllowed=true`，且必须依附智能合同审核 |
| `wecomBotEligible=true` 或任一 `wecom.*` 动作 | 企业微信机器人 | `wecomBotEligible=true` 与当前已上线 `wecom.*` 动作 |
| `permission-center` 或 `governance.policy.manage` | 权限中心 | `permission-center`、`governance.policy.manage` |
| `template-governance`、`template.manage`、`templateManageAllowed=true` 任一存在 | 查询模板管理 | `template-governance`、`template.manage`、`templateManageAllowed=true` |
| `connection-policy` 或 `governance.policy.manage` | 连接策略 | `connection-policy`、`governance.policy.manage` |
| `ai-model-governance` 或 `ai_profile.manage` | AI配置 | `ai-model-governance`、`ai_profile.manage` |
| `audit-center` 或任一 `audit.*` 动作 | 审计中心 | `audit-center`、`audit.view`、`audit.sql.view`、`audit.sql.view_sensitive` |

## 异常半配置角色处理

上线前必须通过权限中心角色列表或接口结果检查 `simplifiedPermissionProfile.legacyWarnings`。若出现 `WEB_CONSOLE_WITHOUT_MENU`：

1. 确认该角色历史上是否真实需要 Web 工作台入口。
2. 需要 Web 入口时，管理员必须显式勾选至少一个 Web 菜单后再保存。
3. 不需要 Web 入口时，可以保持所有 Web 菜单不勾选并保存，系统会规范化为 `webConsoleEnabled=false`。
4. 不允许在没有业务确认的情况下批量保存该类角色，避免静默收缩或扩大权限。

## 不变边界

- CRM 组织、部门、负责人、角色和对象级数据范围不变。
- 字段白名单、SQL 只读约束、行数限制、超时限制不变。
- 分析导出和经营报表导出的单次行数上限、每日次数上限和导出审计不变。
- 企业微信 `DISABLED`、`PILOT_ONLY`、`FULL` 灰度模式、用户停用名单和身份映射不变。
- 合同本人可见、跨负责人查看、跨产物下载和下载审计不变。
- 审计中心 reveal 敏感明细必须继续记录独立审计事件。

## 上线前验证结果

| 验证项 | 覆盖命令或用例 | 结果要求 |
| --- | --- | --- |
| 简化映射单元测试 | `backend/test/modules/governance/simplified-permission-profile.spec.ts` | 旧数据回显、新配置保存、风险子权限清理、Web 入口派生、企业微信包派生全部通过 |
| 后端权限与集成测试 | `npm --prefix backend test` | 权限中心、分析、报表、合同审核、审计、企业微信、日报预览相关用例通过 |
| 前端单元测试 | `npm --prefix frontend run test:unit` | 权限抽屉、权限中心页面、路由守卫和业务页面测试通过 |
| 真实浏览器冒烟 | `npm --prefix frontend run test:e2e` | 登录、导航、分析工作台、经营报表、治理能力刷新等 Playwright 用例通过 |
| 构建与规格校验 | `npm --prefix backend run build`、`npm --prefix frontend run build`、`openspec validate "simplify-permission-center-menu-model" --type change --strict` | 构建和 OpenSpec 严格校验通过 |

## 回滚步骤

1. 保留后端旧运行时字段：`visibleMenus`、`actionKeys`、`webConsoleEnabled`、`wecomBotEligible`、`exportAllowed`、`templateManageAllowed`、合同审核兼容字段仍由新保存逻辑生成。
2. 若前端简化抽屉出现问题，可回滚 `RolePermissionFormDrawer.vue` 到旧基础开关、菜单和动作列表界面；已保存的新配置仍能被旧界面按旧字段读取。
3. 若简化保存接口出现问题，可暂时关闭 `simplifiedPermissionProfile` 提交入口，继续使用旧载荷保存路径；后端兼容旧载荷。
4. 回滚后必须重新运行后端权限测试、前端权限中心测试和 Playwright 冒烟，确认旧界面读取新保存记录时没有丢失菜单、动作和风险权限。
5. 对已经标记 `WEB_CONSOLE_WITHOUT_MENU` 的历史半配置角色，回滚后仍需人工复核，不能把该提示当作已完成授权。
