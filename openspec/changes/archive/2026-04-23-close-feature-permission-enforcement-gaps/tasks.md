## 1. 权限真源与覆盖清单

- [x] 1.1 建立“30 个权限点 -> 运行时语义 -> 前端入口 -> 后端执行点 -> 审计事件”的统一覆盖清单与常量定义
- [x] 1.2 收敛 `AccessDecisionService` 的统一输出结构，明确基础开关、菜单和动作的职责边界
- [x] 1.3 为旧的 `isAdmin`、`policy.enabledRoleIds`、`policy.exportRoleIds`、`user.exportAllowed`、`visibleRoleIds` 等遗留判断建立迁移标记与兼容策略

## 2. 系统级页面与治理接口收口

- [x] 2.1 将审计中心后端接口改为强制校验 `audit.view`
- [x] 2.2 将 AI 模型治理后端接口从管理员硬编码切换为 `ai_profile.manage`
- [x] 2.3 将治理策略后端接口从管理员硬编码切换为 `governance.policy.manage`
- [x] 2.4 确保权限中心页面、接口和能力预览继续统一消费 `governance.policy.manage`

## 3. 分析、导出与模板权限收口

- [x] 3.1 为首次问数执行链补齐 `analysis.use` 的统一后端校验与拒绝审计
- [x] 3.2 为解释型追问、条件改写追问和结果详情页继续追问入口补齐 `analysis.follow_up` 校验
- [x] 3.3 为导出接口收敛 `analysis.export` 与 `exportAllowed` 的双轨逻辑，并补权限撤销立即生效验证
- [x] 3.4 将 `GET /analysis/templates` 改为先校验 `template.view`，再叠加模板资源级 `visibleRoleIds`
- [x] 3.5 将模板治理接口继续统一绑定到 `template.manage`，并补前端工作台模板按钮禁用/隐藏逻辑

## 4. 合同审核功能权限收口

- [x] 4.1 为合同审核工作台最近任务列表和本人任务详情补齐基础访问资格校验，不再只靠前端菜单显隐
- [x] 4.2 保持 `contract.review.upload` 对上传接口的后端强校验，并补 UI 按钮状态联动
- [x] 4.3 保持 `contract.review.cross_view` / `contract.review.cross_download` 对跨任务详情与产物下载的后端强校验，并补拒绝审计
- [x] 4.4 明确“本人历史任务在撤权后是否仍可访问”的兼容策略并落文档/测试

## 5. 企业微信通道与工作流动作收口

- [x] 5.1 将企业微信入口判定拆成“通道准入”和“工作流动作准入”两层门槛
- [x] 5.2 为企业微信分析链路补齐 `wecom.analysis.use` 的独立动作校验
- [x] 5.3 为新增客户链路及 `POST /crm/customers` 补齐 `wecom.customer.create` 校验
- [x] 5.4 为新增商机链路及 `POST /crm/opportunities` 补齐 `wecom.opportunity.create` 校验
- [x] 5.5 为跟进草稿创建、确认写回、失败重试与重复确认拦截补齐 `wecom.followup.writeback` 校验
- [x] 5.6 为个人日报预览、小组日报预览及相关企微预览回复补齐 `wecom.daily_report.preview` 校验

## 6. 前端能力快照与入口一致性

- [x] 6.1 更新 `SessionCapabilitiesService`、`auth.store`、`AppShell` 与 `router`，让菜单显隐、路由阻断和动作禁用完全消费统一能力快照
- [x] 6.2 在分析、合同审核、治理后台和权限中心补齐无权限提示，避免只隐藏按钮不解释原因
- [x] 6.3 让权限中心预览结果与真实前端入口行为保持一致，避免“预览显示可用但页面实际不可用”或反之

## 7. 审计、验证与文档

- [x] 7.1 为新增权限拒绝场景扩展统一审计事件字段，记录权限点、资源类型、资源 ID、通道和拒绝原因
- [x] 7.2 为 30 个权限点建立覆盖回归清单，标明每个点至少命中的真实页面或接口
- [x] 7.3 补齐后端单元/集成测试，覆盖系统级治理、分析、导出、模板、合同审核、企微创建、写回和日报预览
- [x] 7.4 补齐前端路由、菜单、按钮和权限中心预览的单测 / E2E 用例
- [x] 7.5 更新 README、quickstart、测试清单与权限中心操作说明，明确“页面权限操作如何真正控制到用户功能”

