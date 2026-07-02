# 智能分析全量授权与模板 SQL 权限注入改造方案

## 1. 背景

当前查询模板治理页已经支持维护真实 SQL，并且模板执行链路已经切到真实 CRM 只读库执行。但现状仍存在两个明显问题：

1. 模板作者在治理页里能直接看到权限占位符，SQL 可读性差，维护成本高。
2. 模板执行与自由 AI 问数在“高层查全量、普通用户按部门范围查”的需求上还没有统一成同一套权限模式。

本方案的目标不是削弱权限控制，而是把“作者看到的模板 SQL”和“执行时的实时权限收口”彻底解耦：

- 页面只展示作者编写的原始 SQL。
- 后端在执行时，根据当前用户权限模式和模板 SQL 自身范围条件，决定是否自动注入范围、是否允许执行。
- 查询模板、自由 AI 问数、最近查询重跑三条链路必须共用同一套分析范围模式。

## 2. 目标

### 2.1 功能目标

1. 查询模板治理页不再展示权限占位符，模板作者只维护业务 SQL。
2. 新增统一的“分析全量查询授权”能力，在权限中心按人员维护。
3. 公司少数高层管理可以对模板查询和自由 AI 问数查全公司数据。
4. 其他所有用户都按当前企业微信组织范围进行部门级数据查询。
5. 如果模板 SQL 已经显式写了范围条件，则不再重复注入，改为做范围兼容性校验。
6. 所有模板都允许查看；是否能执行、执行时能看到多少数据，由后端统一决定。

### 2.2 非目标

1. 本轮不放开任意复杂 SQL 的权限推断。
2. 本轮不新增模板级“适用人员白名单”概念。
3. 本轮不改变现有 CRM 登录、会话鉴权和统一权限矩阵的主链路。
4. 本轮不改变现有导出、审计、白名单、只读 SQL 和 AST 安全底座。

## 3. 核心决策

### 决策一：统一引入分析范围模式 `AnalysisScopeMode`

系统统一只认两种分析范围模式：

- `FULL_ANALYSIS_SCOPE`
- `DEPARTMENT_ANALYSIS_SCOPE`

该模式同时作用于：

- 查询模板执行
- 查询模板预览
- 自由 AI 问数
- 最近查询重跑

`AnalysisScopeMode` 不由模板决定，而由权限中心新增的“分析全量查询授权”配置决定。

### 决策二：模板 SQL 不再显式要求权限占位符

治理页中的 SQL 输入框只展示作者编写的原始 SQL。后端在执行时自行判断：

- 当前模板 SQL 是否已经显式声明了范围条件
- 当前执行人是全量模式还是部门模式
- 是否需要自动注入范围
- 是否需要做范围兼容性校验

### 决策三：模板 SQL 分成两种范围模式

模板新增 `scopeMode` 字段：

- `AUTO_SCOPE`
- `DECLARED_SCOPE`

含义：

- `AUTO_SCOPE`
  作者 SQL 本身没有显式写 `organization_id / department_id / user_id` 条件，由后端根据执行用户自动收口。

- `DECLARED_SCOPE`
  作者 SQL 已经显式写了组织、部门或负责人范围条件，后端不再自动注入，只负责做范围兼容性校验。

### 决策四：所有模板都可见，执行阶段再区分高层与普通用户

模板列表不再按高层/普通用户做可见性切分。所有有 `template.view` / 智能分析模板可见能力的用户都可以看到全部模板。执行时规则如下：

- 高层用户执行任意模板：可查全量，不做部门范围自动注入。
- 普通用户执行 `AUTO_SCOPE` 模板：后端自动按部门范围收口。
- 普通用户执行 `DECLARED_SCOPE` 模板：不再注入，改做范围兼容性校验。

## 4. 权限中心改造

### 4.1 新增配置对象

新增 `AnalysisScopePolicyRecord`，建议保存在应用库存储态中。

字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 固定主键，例如 `analysis_scope_policy_current` |
| `fullAccessUserIds` | 已开通全量分析权限的 CRM 用户 ID 列表 |
| `updatedBy` | 最后更新人 |
| `updatedAt` | 最后更新时间 |
| `changeReason` | 本次调整原因 |

### 4.2 权限中心 UI

在 `权限中心` 新增一个独立小区块：

- 标题：`分析全量查询授权`
- 表单内容：
  - 人员多选
  - 变更原因
  - 当前已授权人员列表

该区块复用现有 `accessOptions.users` 用户选项源，不要求再造一套用户选择器。

### 4.3 接口建议

新增治理接口：

- `GET /api/v1/governance/analysis-scope-policy`
- `PUT /api/v1/governance/analysis-scope-policy`

前端服务层新增：

- `analysisService.getAnalysisScopePolicy()`
- `analysisService.updateAnalysisScopePolicy()`

## 5. 分析范围模式判定

### 5.1 新增服务

建议新增：

- `backend/src/modules/analysis/analysis-scope-mode.service.ts`

职责：

1. 读取 `AnalysisScopePolicyRecord`
2. 判断当前用户是否属于全量查询授权名单
3. 生成本次执行应使用的最终 `scopeSnapshot`

### 5.2 判定规则

#### 全量模式

当 `user.id` 命中 `fullAccessUserIds` 时：

- `mode = FULL_ANALYSIS_SCOPE`
- `scopeSnapshot.organizationIds = user.organizationIds`
- `scopeSnapshot.departmentIds = []`
- `scopeSnapshot.ownerIds = []`
- `scopeSummary = 当前已开通全量分析权限，可查看全公司数据。`

#### 部门模式

当用户不在 `fullAccessUserIds` 中时：

- `mode = DEPARTMENT_ANALYSIS_SCOPE`
- `scopeSnapshot = UserScopeService.resolveScope(user)`

即普通用户继续复用现有企业微信组织范围推导逻辑。

## 6. 模板 SQL 范围模式识别

### 6.1 识别目标

后端对作者原始 SQL 做语法分析，判断它属于：

- `AUTO_SCOPE`
- `DECLARED_SCOPE`

### 6.2 第一版允许识别的标准字段

只认以下字段作为“范围字段”：

- `organization_id`
- `department_id`
- `user_id`

### 6.3 第一版允许识别的标准谓词

只认以下谓词：

- `=`
- `IN (...)`

### 6.4 判定规则

- 未检测到上述范围字段条件 -> `AUTO_SCOPE`
- 检测到上述范围字段条件 -> `DECLARED_SCOPE`
- 检测到复杂表达式、函数包裹、无法安全判断 -> 校验失败，提示作者调整 SQL

### 6.5 识别范围

第一版需要支持识别：

- 单层 `SELECT`
- `WITH ... SELECT`
- `UNION / UNION ALL`
- 访问业务主表的子查询 `WHERE`

## 7. 执行规则

### 7.1 模板执行

#### 场景一：`FULL_ANALYSIS_SCOPE + AUTO_SCOPE`

- 不注入部门/负责人范围
- 原始 SQL 直接执行

#### 场景二：`FULL_ANALYSIS_SCOPE + DECLARED_SCOPE`

- 不注入部门/负责人范围
- 原始 SQL 直接执行

#### 场景三：`DEPARTMENT_ANALYSIS_SCOPE + AUTO_SCOPE`

- 后端自动注入当前用户组织/部门/负责人范围
- 注入后的 SQL 再执行

#### 场景四：`DEPARTMENT_ANALYSIS_SCOPE + DECLARED_SCOPE`

- 不再自动注入
- 先解析 SQL 已声明的组织/部门/负责人范围
- 做范围兼容性校验
- 校验通过后执行原始 SQL

### 7.2 自由 AI 问数

自由 AI 问数必须和模板链路共用同一个 `AnalysisScopeModeService`：

- `FULL_ANALYSIS_SCOPE`：AI 编译后的受控 SQL 不再注入部门/负责人收口
- `DEPARTMENT_ANALYSIS_SCOPE`：继续按组织/部门/负责人范围注入

### 7.3 最近查询重跑

最近查询重跑必须按当前用户当前权限重新计算：

- 高层今天重跑 -> 按全量模式
- 普通用户今天重跑 -> 按部门模式

禁止复用旧结果快照绕过当前权限。

## 8. 自动权限注入设计

### 8.1 只对主业务表注入

第一版建议只对以下主业务表做自动注入：

- `opportunities`
- `contracts`
- `customers`
- `users`（仅支持简单场景）

### 8.2 注入规则

#### `opportunities`

注入条件：

- `organization_id IN 当前 organizationIds`
- 且 `department_id IN 当前 departmentIds OR user_id IN 当前 ownerIds`

#### `contracts`

注入条件：

- `organization_id IN 当前 organizationIds`
- 且 `department_id IN 当前 departmentIds OR user_id IN 当前 ownerIds`

#### `customers`

注入条件：

- `organization_id IN 当前 organizationIds`
- 且 `department_id IN 当前 departmentIds`

#### `users`

第一版只允许：

- `organization_id IN 当前 organizationIds`

### 8.3 注入位置

建议统一做 AST 注入，不做字符串拼接：

- 单层查询：补到 `WHERE`
- `WITH`：补到命中业务主表的 CTE 分支
- `UNION / UNION ALL`：每个分支单独补
- 子查询：补到子查询内部访问主表的 `WHERE`

## 9. 显式范围模板兼容性校验

### 9.1 普通用户兼容性规则

对于 `DEPARTMENT_ANALYSIS_SCOPE + DECLARED_SCOPE`：

- 若 `SQL 声明范围 ⊆ 用户实际权限范围` -> 允许执行
- 若 `SQL 声明范围 ⊄ 用户实际权限范围` -> 阻断执行

### 9.2 兼容性校验对象

第一版只校验：

- `organization_id`
- `department_id`
- `user_id`

### 9.3 复杂条件处理

如果模板里写了复杂范围表达式，例如：

- 函数包裹字段
- 部分分支有范围、部分分支无范围
- 多层逻辑组合后无法安全归纳范围

则直接阻断，并提示作者改成标准写法或切回 `AUTO_SCOPE`。

## 10. 用户提示策略

### 10.1 范围自动收口提示

治理页 SQL 校验成功后，如果识别为 `AUTO_SCOPE`，展示：

- `未检测到显式范围条件，系统将在执行时按当前用户权限自动收口。`

### 10.2 显式范围模板提示

如果识别为 `DECLARED_SCOPE`，展示：

- `检测到模板已显式限定组织 / 部门 / 负责人范围，执行时将按当前用户权限做范围兼容性校验。`

### 10.3 普通用户越权提示

当普通用户执行 `DECLARED_SCOPE` 模板但范围超出自身权限时：

- `这个模板已经限定了特定部门或负责人范围，但你当前只开通了「{scopeSummary}」的数据权限，暂时不能直接使用。你可以联系管理员调整模板范围，或去掉范围条件后让系统按当前权限自动收口。`

### 10.4 复杂条件不支持提示

当 SQL 范围条件过于复杂时：

- `当前 SQL 的范围条件较复杂，系统暂时无法安全判断是否应自动按权限收口。请改成标准的 organization_id / department_id / user_id 条件，或去掉范围条件交给系统自动处理。`

## 11. 内置模板策略

当前系统内置模板全部采用统一规则：

- 所有人都可见
- 默认原始 SQL 不写权限占位符
- 范围模式统一按识别结果处理，原则上应落到 `AUTO_SCOPE`

执行时：

- 高层用户 -> 看全量
- 普通用户 -> 后端自动部门收口

## 12. 主要代码改造清单

### 12.1 后端新增

- `backend/src/modules/analysis/analysis-scope-mode.service.ts`
- `backend/src/modules/governance/analysis-scope-policy.repository.ts`
- 可选：`backend/src/modules/query-assets/query-template-scope-analyzer.service.ts`
- 可选：`backend/src/modules/query-assets/query-template-scope-injector.service.ts`
- 可选：`backend/src/modules/query-assets/query-template-scope-compatibility.service.ts`

### 12.2 后端修改

- `backend/src/modules/query-assets/query-template-execution.service.ts`
- `backend/src/modules/query-assets/query-template-admin.controller.ts`
- `backend/src/modules/query-assets/query-template.repository.ts`
- `backend/src/modules/analysis/analysis.service.ts`
- `backend/src/modules/analysis/query-scope.service.ts`
- `backend/src/modules/governance/access-governance.service.ts`
- `backend/src/modules/governance/access-governance.controller.ts`
- `backend/src/modules/governance/access-governance.schema.ts`
- `backend/src/shared/types/domain.ts`
- `backend/src/shared/mock/sample-data.ts`

### 12.3 前端修改

- `frontend/src/pages/governance/QueryTemplatePage.vue`
- `frontend/src/pages/governance/PermissionCenterPage.vue`
- `frontend/src/services/analysis.service.ts`
- `frontend/src/types/analysis.ts`

## 13. 测试方案

### 13.1 后端单测

至少新增：

1. `AnalysisScopeModeService`
   - 命中高层名单时返回 `FULL_ANALYSIS_SCOPE`
   - 普通用户返回 `DEPARTMENT_ANALYSIS_SCOPE`

2. `TemplateScopeAnalyzer`
   - 无范围条件识别为 `AUTO_SCOPE`
   - 标准 `department_id / user_id / organization_id` 条件识别为 `DECLARED_SCOPE`
   - 复杂表达式识别失败

3. `TemplateScopeInjector`
   - 普通用户对 `AUTO_SCOPE` 模板正确注入
   - 高层用户不注入

4. `DeclaredScopeCompatibilityChecker`
   - 范围被用户权限覆盖 -> 放行
   - 范围超出用户权限 -> 阻断

### 13.2 后端集成测试

至少覆盖：

1. 高层用户执行 `AUTO_SCOPE` 模板 -> 返回全量
2. 普通用户执行 `AUTO_SCOPE` 模板 -> 自动按部门收口
3. 普通用户执行 `DECLARED_SCOPE` 模板且范围兼容 -> 成功
4. 普通用户执行 `DECLARED_SCOPE` 模板且范围越权 -> 友好阻断
5. 高层自由 AI 问数 -> 不再注入部门范围
6. 普通用户自由 AI 问数 -> 保持部门收口
7. 最近查询重跑按当前权限重新执行

### 13.3 前端测试

至少覆盖：

1. 模板治理页不再显示占位符提示
2. 模板治理页展示范围识别结果
3. 权限中心新增“分析全量查询授权”区块
4. 权限中心支持保存授权人员与变更原因

## 14. 实施顺序建议

### Phase 1：权限中心与统一范围模式

1. 新增 `AnalysisScopePolicyRecord`
2. 新增权限中心配置区块
3. 新增 `AnalysisScopeModeService`

### Phase 2：模板执行改造

1. 模板 SQL 范围识别
2. `AUTO_SCOPE` 自动注入
3. `DECLARED_SCOPE` 兼容性校验
4. 模板治理页去掉占位符提示

### Phase 3：自由 AI 问数同步

1. `AnalysisService` 接入 `AnalysisScopeModeService`
2. `QueryScopeService` 只消费最终范围快照
3. 最近查询重跑复用同一套模式

## 15. 风险与取舍

### 风险一：复杂 SQL 难以稳定识别范围

取舍：

- 第一版只支持标准字段与简单谓词
- 无法安全识别时直接阻断，不做猜测性执行

### 风险二：高层全量查询可能带来性能压力

取舍：

- 继续保留行数上限、超时、AST、预检和审计
- 不因为高层权限就放开任意大查询

### 风险三：模板与自由 AI 问数口径漂移

取舍：

- 两条链路统一依赖 `AnalysisScopeModeService`
- 统一按当前权限实时执行，不复用历史范围

## 16. 结论

本方案将当前“模板 SQL 显式带权限占位符”的维护方式，升级为“作者维护原始 SQL、后端按用户权限模式自动决定是否注入范围”的执行模型，并且把查询模板、自由 AI 问数和最近查询重跑统一到同一套 `AnalysisScopeMode` 之下。

最终效果是：

1. 模板治理页只展示作者真正关心的业务 SQL。
2. 公司高层可以在模板查询和自由 AI 问数中查全量。
3. 普通用户默认按企业微信部门范围执行。
4. 作者自己写了范围条件的模板不会被重复注入，但会严格校验是否越权。
5. 整个分析系统继续遵守现有只读 SQL、白名单、AST、预检、导出和审计边界。
