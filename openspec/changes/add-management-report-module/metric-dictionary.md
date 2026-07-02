# 经营报表指标字典（第一阶段）

## 1. 目的

本文件用于约束 `经营报表` 模块中的核心统计结果，确保：

- 每个统计数字都有明确来源
- 每个派生指标都有明确公式
- 每个专题都能说明时间口径
- 摘要、图表、表格、导出使用同一份聚合结果
- 当数字对不上时，系统优先阻断，而不是输出错误报表

本文件优先覆盖第一阶段可直接落地且字段来源明确的核心指标。对字段来源仍需核对的专题，单独标记为“待字段确认”，在实现前不得直接固化为正式统计口径。

## 2. 全局正确性规则

### 2.1 单一统计真源

- 所有摘要指标、图表值、表格汇总和导出结果必须来自后端统一聚合结果。
- 前端禁止基于分页后的表格、格式化后的字符串或图表点位再做二次统计。
- 同一指标在页面多个位置出现时，必须共享同一 `metricKey` 与同一聚合值。

### 2.2 部门归属规则

#### 直接业务对象

对以下对象，优先使用对象自身的 `department_id` 做部门归属：

- `leads.department_id`
- `customers.department_id`
- `opportunities.department_id`
- `contracts.department_id`

若个别记录 `department_id` 为空，首版允许回退到：

- `user_id` 命中当前允许负责人范围

但回退逻辑必须在代码里显式记录，且回退记录数应纳入诊断日志。

#### 财务对象

对以下对象，禁止直接以自身 `organization_id` 作为经营归属：

- `received_payment_plans`
- `received_payments`

首版统一通过：

- `received_payment_plans.contract_id -> contracts.department_id / contracts.user_id`
- `received_payments.contract_id -> contracts.department_id / contracts.user_id`

做团队/部门经营归属。

### 2.3 时间口径规则

报表统一接收：

- `startDate`
- `endDate`
- `departmentId`
- `presetKey`

说明：

- 用户侧不再暴露 `includeSubDepartments` 开关。
- 经营报表默认按“所选部门 + 全部子部门”计算。
- 若后端内部仍保留 `includeSubDepartments` 字段，只允许固定为 `true`，不得开放成用户输入。

但各专题必须区分：

- 期间发生口径：发生在 `startDate ~ endDate`
- 截面口径：截至 `endDate` 的对象池或状态池

### 2.4 企业名称匹配规则

对于必须进行名称匹配的诊断型指标，统一使用同一个归一函数：

`normalizeCompanyName(value)`：

1. 去除首尾空白
2. 合并中间连续空白
3. 全角括号统一为半角括号
4. 英文字母统一转大写

首版明确约束：

- 名称匹配只允许用于“辅助诊断型指标”
- 不允许用模糊匹配代替正式关系字段
- 有正式关系字段时，优先使用关系字段

### 2.5 SQL 粒度与去重规则

#### 统计粒度

实现时必须先明确每个查询的粒度，再决定是否允许 join。首版推荐的基础粒度如下：

- 线索类：`lead_id`
- 客户类：`customer_id`
- 商机类：`opportunity_id`
- 合同类：`contract_id`
- 应收计划类：`received_payment_plan_id`
- 实际回款类：`received_payment_id`

#### 去重规则

- `count(*)` 只允许用于当前 SQL 已经保证“一行 = 一个统计对象”的场景。
- 一旦查询中存在 1:N 关联扩张风险，必须改用 `count(distinct 主键)`。
- 对客户、商机、合同、回款等总数统计，禁止先 join 扩张再直接 `count(*)`。

#### Join 约束

- 允许的主关系：
  - `customers.id = opportunities.customer_id`
  - `opportunities.id = contracts.opportunity_id`
  - `contracts.id = received_payment_plans.contract_id`
  - `contracts.id = received_payments.contract_id`
- 首版禁止在经营报表主查询里直接 join 高扩张资产表或日志表，例如：
  - `*_assets`
  - `operation_logs`
  - `sales_activities`

#### Fan-out 保护

若某个统计需要经过多张表：

1. 先在子查询中把下游表收敛到主键粒度
2. 再与上游对象做 join
3. 最后做分组与聚合

不允许直接在大宽表 join 后再做金额求和，否则会出现重复累加。

### 2.6 空值、缺失值与异常记录处理规则

#### 空值处理

- 金额字段参与聚合时，统一使用 `COALESCE(amount, 0)`。
- 日期字段作为时间筛选依据时：
  - 正式时间字段为空的，按专题规则回退
  - 无回退规则时，默认排除该记录，并记录排除数量
- `department_id` 为空时，只允许按“当前用户负责人范围”做受控回退，且必须记录回退数量。

#### 缺失值记录要求

每个专题都应返回：

- `excludedRecordCount`
- `fallbackRecordCount`
- `warningMessages`

至少用于说明：

- 因时间字段缺失被排除的记录数
- 因部门字段缺失而回退到负责人归属的记录数
- 因状态无法映射而被排除的记录数

#### 异常记录处理

以下记录首版默认排除，并计入警告：

- 主键为空的脏数据
- 核心归属字段和回退字段同时为空的数据
- 金额为非法字符串或无法转为数值的数据

### 2.7 数值精度、展示单位与前后端分工

#### 后端计算单位

- 所有金额类指标后端统一按数据库原始金额单位计算，保持 `decimal(24,6)` 精度，不得先在 SQL 层换算成“万”。
- 比率类指标后端统一输出原始小数值，例如 `0.2315`，前端再按展示规则格式化为百分比。

#### 前端展示单位

- 金额展示为“万”仅属于表现层规则。
- 前端或导出层可以把原始金额格式化为：
  - 元
  - 万
  - 百分比
  但不得改变后端聚合结果本身。

#### 四舍五入规则

- 百分比默认保留 1 位小数
- 金额“万”默认保留 1 位小数
- 对账时必须使用原始值，不得用格式化后的展示值做对账

### 2.8 缓存、并发与失效规则

#### 缓存层级

- 核心摘要缓存：
  - key: `management-report:context:{userId}:{departmentId}:{startDate}:{endDate}`
- 专题详情缓存：
  - key: `management-report:section:{userId}:{departmentId}:{startDate}:{endDate}:{sectionKey}`

#### 缓存有效期

- 核心摘要：建议 `300s`
- 重专题详情：建议 `300s ~ 900s`

#### 缓存失效触发

以下行为应视为缓存失效条件：

- 用户切换部门
- 用户切换时间范围
- 当前用户权限范围变化

#### 并发控制

- 同一 `reportId` 下重专题最多允许 `2~3` 个并发请求
- 核心摘要和专题详情应使用不同超时预算

### 2.9 阻断与降级规则

#### 整页阻断条件

命中以下条件时，整页经营报表必须阻断：

- 当前用户无权查看当前部门范围
- 核心摘要关键指标对账失败
- 核心摘要时间口径不一致

#### 专题降级条件

命中以下条件时，可以只降级专题：

- 单专题查询超时
- 单专题分项与总计对不上
- 单专题依赖字段尚未确认

#### 降级展示要求

被降级专题必须返回：

- `status = degraded`
- `reason`
- `canRetry`

前端不得把降级专题继续渲染成正常专题。

## 3. 指标字典

## 3.1 总览与经营摘要核心指标

| metricKey | 指标名称 | 统计定义 | 来源表/字段 | 时间口径 | 对账要求 |
| --- | --- | --- | --- | --- | --- |
| `lead_created_count` | 新增线索数 | 筛选期内新增线索记录数 | `leads.id`, `leads.created_at` | 期间发生 | 与线索趋势分月求和一致 |
| `customer_created_count` | 新增客户数 | 筛选期内新增客户记录数 | `customers.id`, `customers.created_at` | 期间发生 | 与客户新增趋势分月求和一致 |
| `opportunity_created_count` | 新增商机数 | 筛选期内新增商机记录数 | `opportunities.id`, `COALESCE(get_time, created_at)` | 期间发生 | 与商机趋势分月求和一致 |
| `lead_turned_customer_count` | 转客户线索数 | 筛选期线索 cohort 中 `turned_customer_id` 非空的线索数 | `leads.turned_customer_id`, `leads.created_at` | cohort + 截止 `endDate` | 不得大于 `lead_created_count` |
| `lead_to_customer_conversion_rate` | 线索转客户率 | `lead_turned_customer_count / lead_created_count` | 派生指标 | cohort + 截止 `endDate` | 分母为 0 时输出 0，不输出 NaN |
| `customer_with_opportunity_count` | 有商机客户数 | 截至 `endDate` 的客户池中，存在关联商机的去重客户数 | `customers.id`, `opportunities.customer_id` | 截面 | 不得大于期末客户池总数 |
| `customer_with_opportunity_rate` | 客户有商机率 | `customer_with_opportunity_count / customer_pool_count_as_of_end` | 派生指标 | 截面 | 与客户分层结果保持一致 |
| `signed_customer_count` | 历史签约客户数 | 截至 `endDate`，在合同表中出现过的去重客户数 | `contracts.customer_id`, `contracts.sign_date` | 截面 | 不得大于期末客户池总数 |
| `risk_opportunity_count` | 风险商机数 | 截至 `endDate` 命中风险规则的商机数 | `opportunities.*` | 截面 | 与风险专题表格数量一致 |

### 说明

- `lead_to_customer_conversion_rate` 首版使用正式关系字段 `turned_customer_id`，不再使用线索公司名与客户名的字符串匹配作为主指标。
- `customer_with_opportunity_count` 首版使用 `opportunities.customer_id` 关系，不使用名称匹配。

### 实现规则

#### 推荐 SQL 粒度

- 主粒度：`lead_id`、`customer_id`、`opportunity_id`
- 汇总层不要直接 join 财务表

#### 推荐查询拆分

建议拆成三段：

1. 线索新增统计
2. 客户池/商机池统计
3. 风险与签约客户统计

这样可以避免一个超大 SQL 把全部摘要算在一起。

## 3.2 线索专题

| metricKey | 指标名称 | 统计定义 | 来源表/字段 | 时间口径 | 对账要求 |
| --- | --- | --- | --- | --- | --- |
| `lead_trend_monthly_count` | 线索新增趋势 | 按月统计筛选期新增线索数 | `leads.created_at` | 期间发生 | 各月求和 = `lead_created_count` |
| `lead_source_count` | 线索来源数 | 按 `source` 统计新增线索数 | `leads.source`, `leads.created_at` | 期间发生 | 各来源求和 = `lead_created_count` |
| `lead_pending_count_as_of_end` | 待处理线索数 | 截至 `endDate`，状态为待处理的线索数 | `leads.status` | 截面 | 与风险线索对象池子集一致 |
| `lead_invalid_count_as_of_end` | 无效线索数 | 截至 `endDate`，状态为无效的线索数 | `leads.status` | 截面 | 与状态拆分一致 |
| `lead_converted_count_as_of_end` | 已转化线索数 | 截至 `endDate`，`turned_customer_id` 非空的线索数 | `leads.turned_customer_id` | 截面 | 不得大于期末线索池 |

### 说明

- 首版线索专题不引入“高质量线索评分”作为正式核心统计指标，除非评分规则单独版本化并补齐测试。
- 若页面需要展示“高质量线索池”，首版只能作为非核心辅助块，且必须标明规则版本。

### 实现规则

#### 推荐 SQL 粒度

- 主粒度：`lead_id`

#### 推荐 group by

- 趋势：`date_format(created_at, '%Y-%m')`
- 来源：`source`
- 状态：`status`

#### 空值处理

- `source` 为空时统一落到 `未知来源`
- `status` 为空时统一落到 `未知状态`

## 3.3 线索转化专题

| metricKey | 指标名称 | 统计定义 | 来源表/字段 | 时间口径 | 对账要求 |
| --- | --- | --- | --- | --- | --- |
| `lead_cohort_count` | 线索 cohort 数 | 筛选期内创建的线索数 | `leads.created_at` | cohort | 等于 `lead_created_count` |
| `lead_cohort_to_customer_count` | cohort 转客户数 | 筛选期线索 cohort 中，截至 `endDate` 已转客户的线索数 | `leads.turned_customer_id`, `leads.created_at` | cohort + 截止 `endDate` | 不得大于 `lead_cohort_count` |
| `lead_cohort_to_customer_rate` | cohort 转客户率 | `lead_cohort_to_customer_count / lead_cohort_count` | 派生指标 | cohort + 截止 `endDate` | 分母为 0 时输出 0 |
| `lead_company_distinct_count` | 线索公司去重数 | 筛选期内按归一公司名去重的线索公司数 | `leads.company_name` | cohort | 不得大于 `lead_cohort_count` |

### 说明

- 若后续需要补“线索公司 -> 商机公司”诊断型匹配，只能作为辅助诊断指标，不得替代正式转化指标。

### 实现规则

#### 推荐 SQL 粒度

- cohort 主粒度：`lead_id`

#### 推荐实现方式

1. 先取筛选期 `leads.created_at` 的 cohort
2. 再基于 cohort 计算截至 `endDate` 的转化结果

#### 禁止实现

- 不允许直接用 `turned_at between startDate and endDate` 代替 cohort 转化

## 3.4 客户专题

| metricKey | 指标名称 | 统计定义 | 来源表/字段 | 时间口径 | 对账要求 |
| --- | --- | --- | --- | --- | --- |
| `customer_pool_count_as_of_end` | 期末客户池总数 | 截至 `endDate` 的客户总数 | `customers.id`, `customers.created_at` | 截面 | 与客户分类分项求和一致 |
| `customer_created_monthly_count` | 客户新增趋势 | 按月统计筛选期新增客户数 | `customers.created_at` | 期间发生 | 各月求和 = `customer_created_count` |
| `customer_with_opportunity_count` | 有商机客户数 | 截至 `endDate` 的客户池中存在关联商机的去重客户数 | `customers.id`, `opportunities.customer_id` | 截面 | 不得大于客户池总数 |
| `customer_without_opportunity_count` | 无商机客户数 | `customer_pool_count_as_of_end - customer_with_opportunity_count` | 派生指标 | 截面 | 两者求和 = 客户池总数 |
| `customer_activation_rate` | 客户激活率 | `customer_with_opportunity_count / customer_pool_count_as_of_end` | 派生指标 | 截面 | 与无商机客户率互补 |

### 实现规则

#### 推荐 SQL 粒度

- 客户池主粒度：`customer_id`

#### 推荐 join 路径

- `customers.id = opportunities.customer_id`

#### 去重约束

- `customer_with_opportunity_count` 必须使用 `count(distinct customers.id)` 或等价去重结果

## 3.5 商机专题

| metricKey | 指标名称 | 统计定义 | 来源表/字段 | 时间口径 | 对账要求 |
| --- | --- | --- | --- | --- | --- |
| `opportunity_amount_sum` | 商机金额 | 筛选期商机金额总和 | `opportunities.expect_amount`, `COALESCE(get_time, created_at)` | 期间发生 | 与按负责人/区域/阶段拆分求和一致 |
| `opportunity_count` | 商机数 | 筛选期商机记录数 | `opportunities.id`, `COALESCE(get_time, created_at)` | 期间发生 | 与趋势各月求和一致 |
| `opportunity_stage_count` | 商机阶段数 | 按 `stage` 统计商机数 | `opportunities.stage` | 期间发生或截面，按专题定义 | 各阶段求和 = 商机总数 |
| `opportunity_owner_amount_sum` | 按负责人商机金额 | 按负责人聚合金额 | `opportunities.user_id`, `expect_amount` | 期间发生 | 各负责人求和 = 商机金额总和 |
| `risk_opportunity_count` | 风险商机数 | 截至 `endDate` 命中风险规则的商机数 | `opportunities.*` | 截面 | 与风险专题对象数一致 |

### 风险规则 v1

首版风险商机默认规则：

- `expect_sign_date < endDate` 且当前仍未进入成功/关闭终态
- 或 `real_revisit_at IS NULL`
- 或 `DATEDIFF(endDate, real_revisit_at) > 90`

说明：

- 该规则是首版受控口径，必须版本化，不允许页面各自写不同阈值。
- 若后续接入更准确的跟进明细表，可升级规则版本，但必须同步补测试。

### 实现规则

#### 推荐 SQL 粒度

- 主粒度：`opportunity_id`

#### 推荐 group by

- 负责人：`user_id`
- 阶段：`stage`
- 区域/部门：`department_id`

#### 金额约束

- `expect_amount` 为空视为 0
- 金额类汇总必须在 `opportunity_id` 粒度去重后求和

## 3.6 验收进度专题

### 当前状态

验收进度相关的正式字段来源仍需在实现前补核。首版只允许使用明确可验证的合同字段，不能直接照搬 HTML 中的“未验收合同”口径。

### 第一阶段可直接落地指标

| metricKey | 指标名称 | 统计定义 | 来源表/字段 | 时间口径 | 对账要求 |
| --- | --- | --- | --- | --- | --- |
| `contract_signed_count` | 已签合同数 | 筛选期签约合同数 | `contracts.sign_date` | 期间发生 | 与签约金额汇总一致 |
| `contract_signed_amount_sum` | 已签合同金额 | 筛选期签约合同总金额 | `contracts.total_amount`, `contracts.sign_date` | 期间发生 | 与合同明细求和一致 |
| `contract_open_status_count` | 未完结合同数 | 截至 `endDate` 仍处于非完结状态的合同数 | `contracts.status` | 截面 | 与状态拆分一致 |

### 待确认指标

- `未验收合同数`
- `验收延期合同数`
- `验收节点逾期金额`

这些指标必须在实现前确认：

- 是否存在正式 `acceptances` 或等价表
- 如果没有，首版是否允许用 `contracts.status` 的状态映射近似表达

未确认前不得作为正式核心经营指标对外展示。

### 实现规则

- 验收专题首版只能把已确认指标做成“正式统计卡”
- 待确认指标只能进入：
  - `comingSoon`
  - `待字段确认`
  - 或完全不展示
- 禁止为了对齐 HTML 现状先用猜测规则上线

## 3.7 收款专题

| metricKey | 指标名称 | 统计定义 | 来源表/字段 | 时间口径 | 对账要求 |
| --- | --- | --- | --- | --- | --- |
| `received_amount_sum_as_of_end` | CRM 已收款累计 | 截至 `endDate` 的实际回款总额 | `received_payments.amount`, `receive_date` | 截面 | 与月度回款累计一致 |
| `planned_receivable_sum_as_of_end` | CRM 应收账单累计 | 截至 `endDate` 的应收计划总额 | `received_payment_plans.amount`, `receive_date` | 截面 | 与状态拆分求和一致 |
| `overdue_receivable_sum_as_of_end` | CRM 逾期应收金额 | 截至 `endDate` 逾期且未完成的应收计划金额总和 | `received_payment_plans.amount`, `status`, `receive_date` | 截面 | 不得大于应收账单累计 |
| `received_amount_sum_in_range` | 筛选期已回款金额 | 筛选期内实际回款金额总和 | `received_payments.amount`, `receive_date` | 期间发生 | 与月度回款趋势求和一致 |
| `planned_receivable_sum_in_range` | 筛选期应收计划金额 | 筛选期内应收计划金额总和 | `received_payment_plans.amount`, `receive_date` | 期间发生 | 与筛选期计划明细求和一致 |
| `collection_rate_in_range` | 筛选期回款率 | `received_amount_sum_in_range / planned_receivable_sum_in_range` | 派生指标 | 期间发生 | 分母为 0 输出 0 |

### 应收状态拆分

首版建议状态拆分：

- `未到期`
- `已逾期`
- `计划中/部分回款`

实现要求：

- 三类状态的金额求和必须等于 `planned_receivable_sum_as_of_end`
- 三类状态的条数求和必须等于期末计划应收记录数

### 收款负责人

首版建议以 `contracts.user_id` 作为经营归属负责人。

可选辅助字段：

- `received_payments.user_id`

但该字段首版只允许作为辅助诊断，不允许替代合同归属负责人做经营看板主口径。

### 实现规则

#### 推荐 SQL 粒度

- 应收计划：`received_payment_plan_id`
- 实际回款：`received_payment_id`

#### 推荐 join 路径

- `received_payment_plans.contract_id = contracts.id`
- `received_payments.contract_id = contracts.id`

#### 状态映射建议

首版应收计划状态建议在服务层统一映射为：

- `OVERDUE`
- `PENDING`
- `PLANNED`

若数据库原始 `status` 枚举语义不明确，必须先补一轮状态映射核对，未经核对不得直接上线。

#### 对账要求

- `planned_receivable_sum_as_of_end`
  = `OVERDUE` + `PENDING` + `PLANNED`
- `received_amount_sum_in_range`
  = 月度回款趋势求和
- `overdue_receivable_sum_as_of_end`
  = 风险专题逾期应收金额

## 3.8 风险与建议专题

### 风险类指标

| metricKey | 指标名称 | 统计定义 | 来源 | 时间口径 | 对账要求 |
| --- | --- | --- | --- | --- | --- |
| `risk_pending_lead_count` | 待处理/异常线索数 | 截至 `endDate` 命中线索风险规则的线索数 | `leads.status` | 截面 | 不得大于期末线索池 |
| `risk_no_opportunity_customer_count` | 无商机客户数 | 截至 `endDate` 客户池中未关联商机的客户数 | `customers`, `opportunities` | 截面 | 与客户专题一致 |
| `risk_opportunity_count` | 风险商机数 | 见商机风险规则 v1 | `opportunities` | 截面 | 与商机专题一致 |
| `risk_contract_open_count` | 合同执行风险数 | 截至 `endDate` 命中合同开放状态规则的合同数 | `contracts.status` | 截面 | 与验收专题一致 |
| `risk_overdue_receivable_sum` | 逾期应收金额 | 截至 `endDate` 逾期未完成应收金额 | `received_payment_plans` | 截面 | 与收款专题一致 |

### 建议生成规则

经营建议不直接由 AI 自由生成，首版应以“风险指标命中 -> 建议模板”方式生成：

- 命中高风险商机数阈值 → 输出机会池清理建议
- 命中无商机客户阈值 → 输出客户激活建议
- 命中逾期应收阈值 → 输出催收建议

这样可以保证建议文案至少建立在真实统计结果上。

### 实现规则

- 建议模板必须引用当前专题已通过校验的指标值
- 禁止建议模板引用未通过对账的数值
- 若风险专题被降级，建议块也必须同步降级或隐藏

## 4. 待字段确认专题

以下专题首版必须先做字段核对，再决定正式统计口径：

### 4.1 区域经营

待确认字段：

- 客户区域/城市字段
- IT 决策权所在地
- 行业主类 / 子类字段

若未确认，首版只能退化为按部门经营，而不能伪装成地理区域经营。

#### 当前可见字段候选

1. 地址链路候选
   - `customer_addresses.province_id`
   - `customer_addresses.city_id`
   - `customer_addresses.region_info`
   - 如果历史数据存在 `_30` 归档表，则同步检查：
     - `customer_addresses_30.province_id`
     - `customer_addresses_30.city_id`
     - `customer_addresses_30.region_info`
2. 文本候选
   - `customers.industry`
   - `customers.company_name`
3. 主数据映射候选
   - `cities.id -> cities.name`
   - `provinces.id -> provinces.name`
4. 业务扩展字段候选
   - `customer_assets` / `customer_assets_30` 通过 `custom_field_id -> custom_fields.label`
   - 重点核对是否存在类似：
     - `IT决策权所在地`
     - `所属主行业`
     - `所属子行业`
     - `区域`
     - `城市`

#### 推荐字段确认顺序

1. 先确认 `customer_addresses` 是否稳定关联客户主数据
2. 再确认 `province_id/city_id` 是否能覆盖绝大多数活跃客户
3. 再核对 `customer_assets` 中是否存在更贴近业务的“IT决策权所在地”自定义字段
4. 最后再决定“区域经营”是按地理区域、按 IT 决策地，还是按部门口径展示

#### 实现风险提示

- 若地址表覆盖率不足，直接做“城市经营图”会误导管理层。
- 若 `IT决策权所在地` 只存在于自定义字段但未统一填写，首版不应把它作为唯一分组字段。
- 若地理字段和 IT 决策字段冲突，必须明确选一个作为主口径，另一个只能做辅助说明。

### 4.2 代理商/生态

待确认字段：

- 商机代理商全称字段
- 代理商类型/生态项目分类字段
- 代理商是否为空的正式判定口径

#### 当前可见字段候选

1. 商机标准/扩展字段候选
   - `opportunities` 主表当前未直接看到 `agent_full_name`
   - 需要优先从 `opportunity_assets` 中通过 `custom_field_id -> custom_fields.label` 反查
2. 已知业务命名候选
   - 从现有受控创建链路可见业务字段名：
     - `代理商全称`
     - `生态项目分类`
   - 这些更可能以自定义字段形式落在：
     - `opportunity_assets`
     - 或 `contract_assets`
3. CMS/外围库候选
   - `ikcrm_cms_production.agents`
   - `ikcrm_cms_production.agent_users`
   - 这些表更偏代理商主数据，不应在首版主查询中直接 join 进经营报表

#### 推荐字段确认顺序

1. 先核对 `custom_fields` 里是否存在 `代理商全称`、`生态项目分类`、`代理商类型` 等 label
2. 再核对 `opportunity_assets` 的 `entity_id` 是否稳定对应 `opportunities.id`
3. 再确认“空代理商”的业务判定：
   - 是自定义字段缺失
   - 还是空字符串
   - 还是只填了 `/`、`-`
4. 若字段稳定，再进入正式统计；否则先只保留“待治理字段”提示，不输出正式代理商经营排行

#### 实现风险提示

- 直接把外围 `agents` 表当作经营归属对象是高风险的，因为它未必和商机实际代理商字段一一对应。
- 若 `代理商全称` 来源不稳定，代理商排行与“无代理商占比”很容易统计失真。

### 4.3 产品方案

待确认字段：

- 产品方案字段
- 行业解决方案字段
- 商机与产品方案的关联表或资产表

这些专题在字段未核实前，不得进入“正式核心经营统计”。

#### 当前可见字段候选

1. 标准产品关联候选
   - `product_assets.assetable_id`
   - `product_assets.assetable_type`
   - `product_assets.product_id`
   - `products.id`
   - `products.name`
   - `products.product_category_id`
   - `product_categories.name`
2. 产品规格扩展候选
   - `product_assets.product_attr_id -> product_attrs.id`
   - `product_attrs.value`
3. 自定义产品方案候选
   - `product_field_assets.entity_id`
   - `product_field_assets.custom_field_id -> custom_fields.label`
4. 商机关联约束
   - 当前必须先确认 `product_assets.assetable_type` 是否存在 `Opportunity`、`Contract` 或等价业务对象类型
   - 只有确认可稳定映射到 `opportunities.id`，才能进入正式专题统计

#### 推荐字段确认顺序

1. 先确认 `product_assets.assetable_type` 的实际枚举
2. 再确认能否稳定从商机拿到产品关联
3. 再确认“产品方案”与“行业解决方案”是否分别来自：
   - 标准产品目录
   - 自定义字段 label
4. 若两套字段并存，必须先决定：
   - 产品专题展示“标准产品”
   - 还是展示“业务方案标签”

#### 实现风险提示

- 仅用 `products.name` 可能只能体现标准产品，不等于业务上的“产品方案”。
- 若 `product_assets` 主要挂在合同或订单而不是商机，直接拿来做商机专题会失真。

### 4.4 验收进度

待确认字段：

- 验收对象与合同的关系字段
- 验收完成、逾期和提醒状态口径
- 验收与回款联动是否通过正式关系建模

#### 当前可见字段候选

1. 独立验收表候选
   - `acceptances.id`
   - `acceptances.organization_id`
   - `acceptances.user_id`
   - `acceptances.acceptance_day3`
   - `acceptances.acceptance_day8`
   - `acceptances.alerted_day3`
   - `acceptances.alerted_day8`
2. 合同状态候选
   - `contracts.status`
   - `contracts.sign_date`
   - `contracts.total_amount`
3. 合同与财务联动候选
   - `contracts.id -> received_payment_plans.contract_id`
   - `contracts.id -> received_payments.contract_id`

#### 推荐字段确认顺序

1. 先确认 `acceptances` 是否与 `contracts`、`customers` 或其它业务对象存在稳定映射关系
2. 若没有稳定关系，则首版不能把 `acceptances` 直接用于合同级验收经营报表
3. 再确认 `contracts.status` 中是否存在可稳定映射为：
   - 已验收
   - 待验收
   - 执行中
4. 若两者都不稳定，验收专题首版只能退化为“签约后开放状态合同观察”，不能输出“未验收合同数”

#### 实现风险提示

- 当前 `acceptances` 表结构非常轻，且没有明显 `contract_id`，贸然用于合同验收统计风险很高。
- 若后续确认没有正式关系字段，应把“验收进度”重命名为更保守的合同执行进度，而不是继续沿用“验收”命名误导业务。

## 5. 对账清单（第一阶段必须覆盖）

至少补齐以下自动对账：

1. `lead_created_count` = 线索趋势各月求和 = 来源分项求和
2. `customer_pool_count_as_of_end` = 有商机客户数 + 无商机客户数
3. `opportunity_amount_sum` = 负责人金额分项求和 = 阶段金额分项求和
4. `planned_receivable_sum_as_of_end` = 应收状态金额分项求和
5. `received_amount_sum_in_range` = 月度回款趋势求和
6. `risk_overdue_receivable_sum` = 收款专题逾期金额 = 风险专题逾期金额

至少补齐以下人工抽样对账：

- 线索 1 组
- 客户 1 组
- 商机 1 组
- 合同 1 组
- 回款/应收 1 组

每组样例应能从原始明细追溯到页面最终指标。

## 6. 实现级口径表（第一阶段重点）

## 6.1 总览核心摘要

| metricKey | SQL 粒度 | 去重主键 | join 路径 | 空值处理 | 阻断级别 |
| --- | --- | --- | --- | --- | --- |
| `lead_created_count` | `lead_id` | `leads.id` | 无 | `created_at` 为空排除并记警告 | 整页阻断 |
| `customer_created_count` | `customer_id` | `customers.id` | 无 | `created_at` 为空排除并记警告 | 整页阻断 |
| `opportunity_created_count` | `opportunity_id` | `opportunities.id` | 无 | 时间用 `COALESCE(get_time, created_at)`；仍为空则排除 | 整页阻断 |
| `customer_with_opportunity_count` | `customer_id` | `customers.id` | `customers -> opportunities` | 仅统计有效客户主键 | 整页阻断 |
| `signed_customer_count` | `customer_id` | `contracts.customer_id` | `contracts` | `sign_date` 为空可回退 `created_at`，但需记警告 | 专题阻断 |

## 6.2 收款核心摘要

| metricKey | SQL 粒度 | 去重主键 | join 路径 | 空值处理 | 阻断级别 |
| --- | --- | --- | --- | --- | --- |
| `received_amount_sum_as_of_end` | `received_payment_id` | `received_payments.id` | `received_payments -> contracts` | `amount` 为空按 0；`contract_id` 为空排除 | 整页阻断 |
| `planned_receivable_sum_as_of_end` | `received_payment_plan_id` | `received_payment_plans.id` | `received_payment_plans -> contracts` | `amount` 为空按 0；`contract_id` 为空排除 | 整页阻断 |
| `overdue_receivable_sum_as_of_end` | `received_payment_plan_id` | `received_payment_plans.id` | `received_payment_plans -> contracts` | 逾期规则未命中则为 0 | 整页阻断 |
| `received_amount_sum_in_range` | `received_payment_id` | `received_payments.id` | `received_payments -> contracts` | `receive_date` 为空排除 | 整页阻断 |
| `planned_receivable_sum_in_range` | `received_payment_plan_id` | `received_payment_plans.id` | `received_payment_plans -> contracts` | `receive_date` 为空排除 | 整页阻断 |

## 6.3 风险专题

| metricKey | SQL 粒度 | 去重主键 | join 路径 | 空值处理 | 阻断级别 |
| --- | --- | --- | --- | --- | --- |
| `risk_pending_lead_count` | `lead_id` | `leads.id` | 无 | `status` 为空落未知状态，不计入风险 | 专题阻断 |
| `risk_opportunity_count` | `opportunity_id` | `opportunities.id` | 无 | 时间字段缺失但无法判定风险时，排除并记警告 | 专题阻断 |
| `risk_overdue_receivable_sum` | `received_payment_plan_id` | `received_payment_plans.id` | `received_payment_plans -> contracts` | 计划日期为空排除 | 专题阻断 |

## 7. 专题加载级别建议

| 专题 | 首屏加载 | 默认懒加载 | 允许缓存 | 建议超时 |
| --- | --- | --- | --- | --- |
| 总览 | 是 | 否 | 是 | 2s |
| 经营摘要 | 是 | 否 | 是 | 2s |
| 区域经营 | 否 | 是 | 是 | 5s |
| 线索 | 否 | 是 | 是 | 5s |
| 线索转化 | 否 | 是 | 是 | 5s |
| 线索机会 | 否 | 是 | 是 | 5s |
| 商机 | 否 | 是 | 是 | 5s |
| 客户 | 否 | 是 | 是 | 5s |
| 代理商/生态 | 否 | 是 | 是 | 6s |
| 产品方案 | 否 | 是 | 是 | 6s |
| 验收进度 | 否 | 是 | 是 | 5s |
| 收款情况 | 否 | 是 | 是 | 6s |
| 经营风险和建议 | 否 | 是 | 是 | 5s |

## 8. 待继续细化项

后续实现前建议继续补齐：

- `区域经营` 的地理字段最终映射
- `代理商/生态` 的字段来源清单
- `产品方案` 的字段来源清单
- `应收计划 status` 原始枚举到业务状态的正式映射表
- 若存在 `acceptances` 或等价表，则补充验收专题正式指标

## 9. 字段核对完成前的实现守门规则

### 9.1 可以进入第一阶段正式实现的专题

- 总览
- 经营摘要
- 线索
- 线索转化
- 客户
- 商机
- 收款
- 风险与建议

### 9.2 需要字段核对后再决定是否上线正式统计的专题

- 区域经营
- 代理商/生态
- 产品方案
- 验收进度

### 9.3 守门要求

- 若字段核对未完成，这些专题可以：
  - 不展示
  - 展示“字段待确认”
  - 仅展示不依赖争议字段的保守子指标
- 若字段核对未完成，这些专题不得：
  - 输出正式排行
  - 输出正式经营结论
  - 进入管理摘要核心数字
