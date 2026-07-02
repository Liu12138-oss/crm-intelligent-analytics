# 经营报表查询蓝图（第一阶段）

## 1. 目的

本文件进一步把 `metric-dictionary.md` 的统计口径推进到“实现前查询草案”级别，供后续开发实现 `management-report-query.service.ts` 时直接参考。目标不是一次性写出可执行 SQL 成品，而是先把以下内容固定下来：

- 每个专题该拆成几条查询
- 每条查询的主粒度是什么
- 需要哪些 CTE / 子查询先收敛粒度
- 最终输出哪些字段
- 该专题怎样与摘要、图表、表格和导出复用同一份结果
- 每条查询该如何做对账与阻断

本文件优先覆盖第一阶段正式实现的专题：

- 总览
- 经营摘要
- 线索
- 线索转化
- 客户
- 商机
- 收款
- 风险与建议

以下专题仅保留前置核对说明，不在本轮写正式查询蓝图：

- 区域经营
- 代理商/生态
- 产品方案
- 验收进度

## 2. 通用查询约束

## 2.1 全局筛选输入

后端统一接收：

```ts
interface ManagementReportFilter {
  departmentId?: string; // 未传表示全公司
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  presetKey?: 'q1' | 'q2' | 'q3' | 'q4' | 'this-month' | 'this-year' | 'last-30-days' | 'last-90-days' | 'custom';
}
```

全局默认值：

- `departmentId = undefined`，表示 `全公司`
- `presetKey = q1`
- `startDate` / `endDate` = 当前日历年第一季度

## 2.2 部门/团队范围解析

所有查询执行前必须先得到：

- `resolvedDepartmentIds`
- `resolvedOwnerIds`
- `scopeSummary`

解析要求：

- 用户选择的部门节点默认递归包含全部子部门
- 若未选择部门，则按全公司口径
- 若权限不允许访问该部门节点，直接阻断，不执行后续 SQL

## 2.3 时间边界

### datetime 字段

对 `created_at`、`updated_at`、`revisit_at`、`real_revisit_at` 等 `datetime` 字段，统一使用：

- `>= startDate 00:00:00`
- `< endDate + 1 day 00:00:00`

### date 字段

对 `sign_date`、`receive_date`、`get_time` 等 `date` 字段，统一使用：

- `between startDate and endDate`（含首尾）

## 2.4 查询公共输入 CTE 建议

建议在所有专题查询里复用如下公共 CTE 思路：

```sql
with scoped_departments as (...),
scoped_owners as (...),
base_leads as (...),
base_customers as (...),
base_opportunities as (...),
base_contracts as (...),
base_received_payment_plans as (...),
base_received_payments as (...)
```

原则：

- `base_*` CTE 只负责：
  - 权限范围过滤
  - 时间字段过滤
  - 明确的主键粒度收敛
- 统计层 CTE 再做：
  - 分组
  - 聚合
  - 派生指标

## 2.5 缓存与超时建议

| 查询类别 | 建议缓存 | 建议超时 | 备注 |
| --- | --- | --- | --- |
| 核心摘要 | 300s | 2s | 首屏优先 |
| 线索/客户/商机专题 | 300s | 5s | 默认懒加载 |
| 收款专题 | 300s | 6s | 允许单专题降级 |
| 风险专题 | 300s | 5s | 允许单专题降级 |

## 2.6 统一阻断规则

若查询命中以下情况，必须阻断或降级：

- 权限范围无法解析
- 核心摘要总分对不上
- 同一专题不同查询时间口径不一致
- 收款专题状态拆分求和不等于应收总额

## 3. 总览专题查询蓝图

## 3.1 目标

回答以下问题：

- 当前筛选期新增了多少线索、客户、商机
- 截至 `endDate` 有多少客户被激活
- 截至 `endDate` 有多少历史签约客户
- 截至 `endDate` 有多少风险商机

## 3.2 建议拆分

总览建议拆成 4 条聚合查询，不要强行合并成一条超大 SQL：

1. 新增对象统计
2. 客户池激活统计
3. 历史签约客户统计
4. 风险商机统计

## 3.3 查询 A：新增对象统计

### 输入

- `resolvedDepartmentIds`
- `startDate`
- `endDate`

### 输出

- `lead_created_count`
- `customer_created_count`
- `opportunity_created_count`

### SQL 粒度

- 线索：`lead_id`
- 客户：`customer_id`
- 商机：`opportunity_id`

### 实现建议

分别从：

- `base_leads`
- `base_customers`
- `base_opportunities`

做独立 count，再在服务层合并结果，不建议三张主表直接 cross join。

### 对账

- `lead_created_count` = 线索趋势各月求和
- `customer_created_count` = 客户趋势各月求和
- `opportunity_created_count` = 商机趋势各月求和

## 3.4 查询 B：客户池激活统计

### 输入

- `resolvedDepartmentIds`
- `endDate`

### 输出

- `customer_pool_count_as_of_end`
- `customer_with_opportunity_count`
- `customer_without_opportunity_count`
- `customer_activation_rate`

### SQL 思路

```sql
with base_customers as (... 截至 endDate 的客户池 ...),
customer_opportunity_bridge as (
  select distinct o.customer_id
  from opportunities o
  where ... scope ...
    and coalesce(o.get_time, date(o.created_at)) <= :endDate
)
select ...
```

### 关键约束

- `customer_with_opportunity_count` 必须 `count(distinct customer_id)`
- 不允许直接 join 扩张后 `count(*)`

### 对账

- `customer_pool_count_as_of_end = customer_with_opportunity_count + customer_without_opportunity_count`

## 3.5 查询 C：历史签约客户统计

### 输出

- `signed_customer_count`

### SQL 思路

从 `contracts` 取：

- `customer_id`
- `sign_date` 为空时回退 `created_at`

再做 `count(distinct customer_id)`

### 对账

- `signed_customer_count <= customer_pool_count_as_of_end`

## 3.6 查询 D：风险商机统计

### 输出

- `risk_opportunity_count`

### 规则

基于风险商机规则 v1，优先作为单独 CTE 输出，供总览和风险专题复用。

## 4. 经营摘要专题查询蓝图

## 4.1 目标

经营摘要不建议新增大查询，首版应尽量复用：

- 总览核心指标
- 收款摘要
- 风险专题摘要

## 4.2 输出

- 一句话经营结论
- 管理动作建议
- 风险摘要卡

## 4.3 实现建议

经营摘要首版可以由服务层完成：

1. 先读取总览核心指标
2. 再读取收款摘要
3. 再读取风险摘要
4. 最后按规则模板组装结论文案

首版不建议为经营摘要再单独打数据库。

## 5. 线索专题查询蓝图

## 5.1 查询 A：线索新增趋势

### 输出

- 月度趋势数组

### SQL 粒度

- `lead_id`

### Group By

- `date_format(created_at, '%Y-%m')`

### 对账

- 各月求和 = `lead_created_count`

## 5.2 查询 B：线索来源分布

### 输出

- `source`
- `count`

### 规则

- `source is null or ''` 统一映射为 `未知来源`

### 对账

- 各来源求和 = `lead_created_count`

## 5.3 查询 C：期末线索状态池

### 输出

- `lead_pending_count_as_of_end`
- `lead_invalid_count_as_of_end`
- `lead_converted_count_as_of_end`

### SQL 思路

从截至 `endDate` 的线索池出发，按 `status` 与 `turned_customer_id` 拆分。

## 5.4 查询 D：风险线索列表

### 首版规则

风险线索候选：

- `status = 待处理`
- 或 `status = 联系方式无效`
- 或关键跟进字段缺失

### 注意

首版如缺少稳定跟进字段，不允许把“无跟进记录”纳入正式核心统计，只能作为辅助提示。

## 6. 线索转化专题查询蓝图

## 6.1 查询 A：线索 cohort

筛选期内创建的线索集合，输出：

- `lead_cohort_count`
- `lead_company_distinct_count`

## 6.2 查询 B：cohort 转客户

基于 cohort 子查询，统计截至 `endDate`：

- `lead_cohort_to_customer_count`
- `lead_cohort_to_customer_rate`

### 注意

- 不允许按 `turned_at between startDate and endDate` 统计
- 必须基于 cohort

## 6.3 可选查询 C：转化阶段分层

首版允许输出：

- 未转化
- 已转客户

若要继续细分到商机和成交，必须确认正式关系链是否足够稳定。

## 7. 客户专题查询蓝图

## 7.1 查询 A：客户新增趋势

### 输出

- 按月客户新增数量

### 对账

- 各月求和 = `customer_created_count`

## 7.2 查询 B：期末客户池结构

### 输出

- `customer_pool_count_as_of_end`
- `customer_with_opportunity_count`
- `customer_without_opportunity_count`
- `customer_activation_rate`

### 注意

- 截面专题，不按筛选期创建客户限制对象池
- 只按 `<= endDate` 限制

## 7.3 查询 C：客户分类/行业分布

前提：

- `customers.industry` 或其它行业字段覆盖率足够

若字段质量不足：

- 该子专题仅显示“行业字段待治理”

## 8. 商机专题查询蓝图

## 8.1 查询 A：商机金额与数量趋势

### 输出

- 每月商机数
- 每月商机金额

### 时间字段

- `coalesce(get_time, date(created_at))`

## 8.2 查询 B：负责人拆分

### 输出

- 负责人
- 商机数
- 商机金额

### Group By

- `user_id`

### 对账

- 各负责人金额求和 = `opportunity_amount_sum`

## 8.3 查询 C：阶段分布

### 输出

- `stage`
- 数量
- 金额

### 对账

- 各阶段数量求和 = 商机总数
- 各阶段金额求和 = 商机金额总和

## 8.4 查询 D：风险商机明细

### 输出

- `opportunity_id`
- 客户
- 负责人
- 阶段
- 风险原因

### 规则

必须复用统一风险规则 v1，不允许专题自己再写一套条件。

## 9. 收款专题查询蓝图

## 9.1 查询 A：收款摘要

### 输出

- `received_amount_sum_as_of_end`
- `planned_receivable_sum_as_of_end`
- `overdue_receivable_sum_as_of_end`
- `received_amount_sum_in_range`
- `planned_receivable_sum_in_range`
- `collection_rate_in_range`

### 实现建议

拆成 2 条查询：

1. 截面累计
2. 筛选期累计

### 对账

- `collection_rate_in_range = received_amount_sum_in_range / planned_receivable_sum_in_range`

## 9.2 查询 B：月度回款趋势

### Group By

- `date_format(receive_date, '%Y-%m')`

### 对账

- 各月求和 = `received_amount_sum_in_range`

## 9.3 查询 C：应收状态拆分

### 输出

- 状态
- 条数
- 金额

### 对账

- 状态金额求和 = `planned_receivable_sum_as_of_end`

### 风险

若原始 `status` 枚举未核准，不允许直接上线正式状态名。

## 9.4 查询 D：收款负责人

### 粒度

- `contract_id`

### Group By

- `contracts.user_id`

### 输出

- 负责人
- 应收金额
- 已回款金额
- 逾期金额

### 注意

- 首版以 `contracts.user_id` 为主归属
- `received_payments.user_id` 仅做辅助诊断

## 9.5 查询 E：逾期重点项目

### 输出

- 合同
- 客户
- 负责人
- 应收金额
- 已回款金额
- 逾期天数

### 排序

- 先按逾期金额 desc
- 再按逾期天数 desc

## 10. 风险与建议专题查询蓝图

## 10.1 风险摘要

风险专题尽量不重新查全部底表，而是复用：

- 线索风险结果
- 客户未激活结果
- 商机风险结果
- 收款逾期结果

## 10.2 建议生成

首版采用规则模板：

- 高风险商机超阈值 → 机会池清理建议
- 无商机客户超阈值 → 客户激活建议
- 逾期应收超阈值 → 催收建议

### 注意

- 建议模板必须只引用已通过校验的指标
- 若某个源专题被降级，关联建议必须同步降级或隐藏
