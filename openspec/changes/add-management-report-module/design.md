## Context

当前仓库已经形成了 `analysis` 自由问数、`contract-review` 合同审核、`governance` 治理、`audit` 审计的主骨架，但“管理经营报表”仍然缺少独立入口。现有自由问数链路适合处理“单问题 -> 单结果”，不适合承载多专题固定驾驶舱，因为同一页需要共享统一的时间范围、统一的部门范围、统一的数据生成时间、统一的导出口径，以及一套对管理者可读的固定信息结构。

本次需求已经明确收敛为以下边界：

- 新增独立 `经营报表` 模块，而不是扩展自由问数工作台。
- 保留的专题是：总览、经营摘要、区域经营、线索、线索转化、线索机会、商机、客户、代理商/生态、产品方案、验收进度、收款情况、经营风险和建议。
- 排除的专题是：区域热点、招投标信息、任务完成。
- `收款情况` 只允许使用 CRM 内部 `contracts`、`received_payment_plans`、`received_payments` 数据，不再保留周报管理口径。
- 页面必须支持团队/部门切换和时间筛选，并继续严格继承 CRM 权限边界。所选部门默认递归包含全部子部门，不再提供单独开关。

从数据层看，经营报表至少涉及以下对象：

- 销售链路：`leads`、`customers`、`opportunities`、`contracts`
- 财务闭环：`received_payment_plans`、`received_payments`
- 组织权限：`users`、`departments`、`organizations`

并且不同专题使用的时间语义不同：

- 有些是“筛选时间段内发生了什么”，例如线索新增、月度回款趋势
- 有些是“截至结束日当前处于什么状态”，例如客户池、风险商机、未验收合同

如果仍按自由问数模式拆成多个动态查询结果，或在页面首次加载时把所有专题一起查完，就会出现：

- 同页多个 `queryId`
- 不同专题的时间口径不一致
- 不同块的生成时间和缓存时间不一致
- 导出与页面结果对不上
- 页面首屏瞬间并发大量 CRM 查询
- 多个管理者同时切换筛选时把 CRM 读库打爆

因此，本次设计选择“独立固定报表模块 + 统一报表上下文 + 专题按需加载”。

## Goals / Non-Goals

**Goals:**

- 提供独立的 `经营报表` Web 模块，服务管理层与已授权管理角色查看固定专题经营驾驶舱。
- 提供统一筛选栏，支持企业微信组织架构树形部门/团队选择和时间范围筛选。
- 让整页报表一次生成统一快照，确保总览、摘要、专题块和导出共用同一范围、同一时间参数和同一数据生成时间。
- 在收款专题中仅使用 CRM 内部回款与应收数据，并明确按合同归属维度做团队/部门汇总。
- 为经营报表新增独立菜单权限、查看/导出动作权限和审计事件。
- 为每个统计数字建立可追溯的指标定义、聚合来源和交叉校验链路，确保报表数字可复核、可回归、可阻断错误交付。

**Non-Goals:**

- 不把经营报表做成自由配置的 BI 设计器。
- 不把收款、回款、应收能力开放给自由问数链路。
- 不接入周报 Excel、外部资讯、招投标、任务完成等专题数据源。
- 不在本次变更中重构现有 `analysis`、`contract-review` 或企业微信问数主链。
- 不在本次变更中处理企业微信端经营报表交付，首版仅交付 Web 端。

## Decisions

### 决策 1：经营报表作为独立模块实现，而不是复用自由问数结果页

新增 `management-report` 模块，前端新增独立菜单与路由，后端新增独立控制器、服务、查询聚合层和 DTO。该模块只消费固定筛选条件和固定 SQL 聚合结果，不生成自由问数 `queryId`，也不经过 AI 主题编排层。

建议的代码落点如下：

```text
backend/src/modules/management-report/
├── management-report.module.ts
├── management-report.controller.ts
├── management-report.service.ts
├── management-report-query.service.ts
├── management-report-composer.service.ts
└── management-report.types.ts

frontend/src/
├── pages/management-report/ManagementReportPage.vue
├── services/management-report.service.ts
├── types/management-report.ts
└── components/management-report/*
```

原因：

- 管理页是固定驾驶舱，不是动态问答。
- 同页多个主题如果拆成多个 `queryId`，会导致数据生成时间、权限快照和导出口径分裂。
- 独立模块可以合法纳入 `received_payment_plans`、`received_payments` 等对象，而不需要把自由问数白名单扩到财务闭环。

备选方案：

- 复用 `AnalysisService.createQuery` 逐个专题拼页。问题是同页一致性差，接口噪声大。
- 把管理页当成一个固定问题模板交给 AI。问题是过于间接，且不利于收款专题的严格口径控制。

### 决策 2：首屏只返回统一报表上下文与核心摘要，重专题按需加载

后端不再让首屏一次性查询全部专题，而是拆为两层：

1. 报表上下文初始化
   - 生成统一筛选上下文
   - 返回总览、经营摘要、范围说明、时间范围、专题可用性和缓存键
2. 专题按需加载
   - 当前激活页签、用户展开或明确请求时再加载专题详情

建议接口拆分如下：

- `GET /management-report/options`
- `POST /management-report/snapshot`
- `POST /management-report/sections/:sectionKey`
- `POST /management-report/export`

核心上下文对象建议如下：

```ts
interface ManagementReportContext {
  reportId: string;
  meta: {
    startDate: string;
    endDate: string;
    presetKey?: string;
    departmentId?: string;
    departmentLabel: string;
    scopeSummary: string;
    generatedAt: string;
    dataFreshnessAt?: string;
  };
  overview: OverviewSection;
  executiveSummary: ExecutiveSummarySection;
  sections: Array<{
    sectionKey: string;
    title: string;
    loadMode: 'lazy';
    available: boolean;
    cached: boolean;
    summary?: string;
  }>;
}
```

专题详情统一结构建议如下：

```ts
interface ManagementReportSectionPayload<TSection> {
  reportId: string;
  sectionKey: string;
  generatedAt: string;
  timeBasis: string;
  scopeBasis: string;
  section: TSection;
}
```

原因：

- 首屏只查核心摘要，能显著降低页面首次加载压力。
- 专题按需加载可以把重查询延后到真正需要时再执行。
- 统一 `reportId` 仍然能保证全部专题属于同一筛选上下文。
- 后续可以按 `reportId + sectionKey` 细粒度缓存和导出复用。

备选方案：

- 首屏一次性返回整页全部专题。问题是对 CRM 读库压力过大。
- 每个专题自由使用自己的一套筛选参数。问题是上下文和口径会漂移。

### 决策 2A：新增“指标字典 + 专题聚合定义 + 一致性校验”三层正确性控制

为确保每个统计数字都可解释、可复核、可测试，本次经营报表不允许在页面层自由拼装数字，而是新增三层正确性控制：

1. 指标字典层
   - 定义每个核心指标的业务名称、来源表、来源字段、时间字段、聚合方式、过滤条件和口径说明
2. 专题聚合定义层
   - 定义每个专题块使用哪些指标、哪些明细和哪些分组结果
3. 一致性校验层
   - 在快照正式返回前校验摘要、图表、表格、排行和导出是否引用同一组聚合结果

建议在后端新增如下结构：

```ts
interface ManagementMetricDefinition {
  key: string;
  label: string;
  sourceTables: string[];
  sourceFields: string[];
  timeField: string;
  aggregation: 'count' | 'sum' | 'ratio' | 'distinct-count';
  formula?: string;
  description: string;
}

interface SectionDatasetDefinition {
  sectionKey: string;
  metricKeys: string[];
  groupBy?: string[];
  detailColumns?: string[];
  totalsCheck?: boolean;
}
```

原因：

- 没有指标字典，后续任何人都可能在不同专题里重复写出不同算法。
- 没有一致性校验，页面看起来完整，但数字可能已经错了。

本次变更同步新增补充文档 `metric-dictionary.md`，作为经营报表第一阶段的统计口径真源。实现阶段新增或调整核心指标时，必须先同步更新该文档，再修改代码与测试。该文档当前已经细化到实现级别，覆盖：

- SQL 粒度
- 去重主键
- join 路径
- 空值处理
- 状态映射约束
- 缓存与失效规则
- 整页阻断与专题降级边界

备选方案：

- 由查询层自行维护每个专题公式。问题是无法统一审查和回归。
- 由前端汇总表格再算摘要。问题是数值真源丢失，且容易因分页或格式化导致错误。

### 决策 3：筛选模型使用“统一入参 + 专题时间基准”双层机制

接口层统一接收：

```ts
interface ManagementReportFilter {
  startDate: string;
  endDate: string;
  presetKey?: 'q1' | 'q2' | 'q3' | 'q4' | 'this-month' | 'this-year' | 'last-30-days' | 'last-90-days' | 'custom';
  departmentId?: string;
}
```

部门筛选规则：

- 前端使用企业微信组织架构树形组件展示部门
- 默认选中 `全公司`
- 用户选择任一节点后，系统默认递归包含其全部子部门
- `includeSubDepartments` 不再作为用户可见参数存在；若后端内部继续保留该字段，只能固定为 `true`

时间默认值规则：

- 默认 `presetKey = q1`
- 默认 `startDate` / `endDate` 对应当前日历年第一季度
- 当前年份以服务端当前业务时区计算，避免前端本地时区漂移

但执行层不做“所有专题统一套一个时间字段”，而是按专题显式声明时间依据：

| 专题 | 时间类型 | 时间字段 |
| --- | --- | --- |
| 线索新增 / 来源 / 趋势 | 期间发生 | `leads.created_at` |
| 线索转化 | cohort + 截止期末 | cohort=`leads.created_at`，转化结果看截至 `endDate` |
| 客户新增 | 期间发生 | `customers.created_at` |
| 客户池 / 激活率 / 无商机客户 | 截面 | `customers.created_at <= endDate` |
| 商机新增 / 区域经营 / 金额趋势 | 期间发生 | `COALESCE(opportunities.get_time, opportunities.created_at)` |
| 风险商机 | 截面 | 对象池 `<= endDate`，风险判断结合 `expect_sign_date`、`revisit_at`、`stage_updated_at` |
| 验收进度 | 期间发生 + 截面 | 优先 `contracts.sign_date`，回退 `contracts.created_at` |
| 实际回款 | 期间发生 | `received_payments.receive_date` |
| 应收计划 | 期间发生 / 截面 | `received_payment_plans.receive_date` |

并要求每个专题块在返回结构中带上：

```ts
interface SectionMeta {
  timeBasis: string;
  scopeBasis: string;
  generatedAt: string;
}
```

原因：

- 同一页不同专题的业务时间语义不同，必须显式建模。
- 只做一个统一时间字段会让客户池、风险池、转化率全部失真。

备选方案：

- 所有专题都按 `created_at`。问题是转化和回款类专题口径错误。
- 所有专题都按业务方口头理解临时切换。问题是不可测试、不可审计。

### 决策 4：部门切换复用现有范围治理，不新建第二套权限模型

经营报表的部门切换完全复用 `organization-scope-governance` 的最终有效范围：

- `GET /management-report/options` 只返回当前用户允许切换的部门
- `POST /management-report/snapshot` 与 `POST /management-report/export` 再次校验 `departmentId`
- 所选部门默认递归包含全部子部门，不对用户暴露额外开关

建议前端 options 响应结构：

```ts
interface ManagementReportOptions {
  departments: Array<{
    id: string;
    label: string;
    parentId?: string;
    selectable: boolean;
  }>;
  presets: Array<{
    key: string;
    label: string;
  }>;
  defaultFilter: {
    departmentId?: string;
    presetKey: string;
    startDate: string;
    endDate: string;
  };
}
```

原因：

- 当前仓库已经有组织事实、默认范围和白名单扩展能力。
- 经营报表不能为了方便切换而绕开统一范围服务。

备选方案：

- 在管理报表内部单独判断“是否是经理”。问题是会和现有权限矩阵冲突。

### 决策 5：收款专题只使用 CRM 财务闭环表，并通过合同归属做团队汇总

收款专题只使用：

- `contracts`
- `received_payment_plans`
- `received_payments`

建议拆分的查询能力如下：

1. 收款摘要
   - CRM 已收款累计
   - CRM 应收账单累计
   - CRM 逾期应收金额
   - 筛选期内已回款金额
   - 筛选期内应收计划金额
   - 筛选期内回款率
2. 月度回款趋势
   - 按 `received_payments.receive_date` 聚合
3. 应收状态
   - 未到期
   - 已逾期
   - 计划中
4. 收款负责人
   - 建议先按合同负责人聚合
5. 逾期应收重点项目
   - 合同/客户/金额/逾期天数
6. 合同验收与回款联动
   - 未验收但已有计划应收
   - 已签未回款

按团队/部门汇总时，统一使用 `contract_id -> contracts.department_id / contracts.user_id` 归属，不直接以 `received_payments.organization_id` 作为团队口径。

原因：

- CRM 财务闭环与销售归属的桥梁是合同。
- 直接用回款表自身归属字段做区域经营会与销售归属错位。

备选方案：

- 同时展示周报管理口径。问题是当前需求已明确不要周报口径。
- 直接按 `received_payments.user_id` 汇总。问题是与合同负责人和团队归属可能不一致。

### 决策 5A：关键统计值必须经过“总分对账”和“样例抽查”双重验证

经营报表正式交付前，关键统计值必须经过两类验证：

1. 自动总分对账
   - 总览总数必须等于专题分项汇总
   - 例如：
     - 客户总数 = 客户分类分项求和
     - 商机总额 = 负责人/区域/阶段分组求和
     - 应收总额 = 状态拆解求和
2. 样例抽查对账
   - 对线索、客户、商机、合同、回款各至少保留一组“原始明细抽样”
   - 用于验证某个指标确实能从明细追溯出来

建议在快照生成前增加校验步骤：

```ts
interface ReconciliationIssue {
  sectionKey: string;
  metricKey: string;
  issueType: 'TOTAL_MISMATCH' | 'TIME_BASIS_MISMATCH' | 'SCOPE_MISMATCH';
  expectedValue: number;
  actualValue: number;
  message: string;
}
```

若命中关键对账失败：

- 默认阻断整页正式交付
- 或至少把对应专题标记为不可用，并向前端返回明确错误状态

原因：

- 管理报表的价值建立在数字可信之上。
- “大概对”在经营报表里没有意义。

### 决策 5B：派生指标禁止在前端计算

所有派生指标必须在后端统一计算，并写入同一份专题结果结构中。前端只负责渲染，不负责再根据表格行做二次计算。

受此约束的典型指标包括：

- 线索匹配客户率
- 客户有商机率
- 激活率
- 高阶段率
- 回款率
- 逾期占比

原因：

- 前端二次计算很容易受分页、格式化、空值和四舍五入影响。
- 统一后端计算才能和导出、审计保持一致。

### 决策 6：前端按“统一舞台 + 专题块”实现，不复用分析结果详情页布局

前端新增 `ManagementReportPage.vue`，布局遵循现有设计系统：

- 顶部标题区
- 吸顶筛选栏
- 关键摘要区
- 专题导航区
- 专题块正文区

建议页面结构：

```text
页面标题
├── 当前范围说明 / 时间范围 / 数据生成时间 / 导出
├── 筛选栏（部门、是否含子部门、时间）
├── 总览卡片
├── 经营摘要卡片
└── 专题页签
    ├── 区域经营
    ├── 线索
    ├── 线索转化
    ├── 线索机会
    ├── 商机
    ├── 客户
    ├── 代理商/生态
    ├── 产品方案
    ├── 验收进度
    ├── 收款情况
    └── 经营风险和建议
```

复用的基础组件：

- 指标卡
- 图表组件
- 表格组件
- 标签和口径说明块
- 详情抽屉

不复用的内容：

- `AnalysisResultDetailPage.vue` 的单查询布局
- 当前自由问数的 `queryId` 驱动详情展示模式

原因：

- 经营报表是固定专题页，不应该被约束在“问题摘要 + 单表/单图”的交互结构里。

### 决策 7：新增独立权限点和独立审计事件

新增权限点：

- 菜单：`management-report`
- 动作：`management.report.view`
- 动作：`management.report.export`

新增审计事件：

- `MANAGEMENT_REPORT_VIEWED`
- `MANAGEMENT_REPORT_EXPORTED`
- `MANAGEMENT_REPORT_SCOPE_BLOCKED`

审计字段至少包括：

- actorId
- actorRoleIds
- departmentId
- startDate
- endDate
  - presetKey
- generatedAt
- exportFormat

原因：

- 菜单可见、页面访问、导出权限需要分别控制。
- 经营报表不是自由问数结果，不能复用现有查询审计语义。

备选方案：

- 复用 `analysis.export`。问题是会把固定报表导出和自由问数导出混在一起。

### 决策 8：首版性能控制通过“受控 SQL + 双层缓存 + 查询预算 + 懒加载”实现

首版不引入新的报表物化表，而采用：

- 受控只读 SQL
- 首屏核心摘要与专题详情拆层加载
- 每个专题限制字段和行数
- 报表上下文缓存
- 专题详情缓存
- 查询预算、并发限制和超时降级

缓存键建议：

```text
management-report:context:{userId}:{departmentId}:{startDate}:{endDate}
management-report:section:{userId}:{departmentId}:{startDate}:{endDate}:{sectionKey}
```

缓存有效期建议：

- 5 分钟到 15 分钟

查询保护建议：

- 单个 `reportId` 同时最多只允许 2 到 3 个重专题并发查询
- 单个专题设置独立超时
- 超时后返回专题降级状态，而不是拖垮整页
- 核心摘要与重专题使用不同查询预算

首屏建议只同步加载：

- `overview`
- `executiveSummary`

以下专题默认懒加载：

- `regional`
- `leads`
- `leadConversion`
- `leadOpportunity`
- `opportunities`
- `customers`
- `agents`
- `products`
- `acceptance`
- `collections`
- `risks`

交付顺序：

1. 先交付总览、经营摘要、收款情况、经营风险和建议
2. 再交付线索、客户、商机、验收进度
3. 最后补代理商/生态和产品方案

原因：

- 这样能先把最核心的管理价值上线，同时控制首屏查询复杂度。

### 决策 8A：页面必须允许专题级失败，不允许整页一起失败

在经营报表中，专题失败优先局部降级：

- 若 `overview` 或 `executiveSummary` 失败，整页阻断
- 若某个非核心专题失败，仅阻断该专题，并显示重试按钮与口径提示

原因：

- 这样可以把 CRM 短时抖动的影响控制在单个专题
- 避免“一个专题慢，整页全挂”

### 决策 9：错误数字优先阻断，不输出“看起来正常”的报表

经营报表快照生成遵循以下优先级：

1. 正确性优先于完整性
2. 完整性优先于速度
3. 速度优先于视觉丰富度

这意味着：

- 若关键摘要与分项总和对不上，优先阻断
- 若单个非核心专题存在口径异常，可降级专题，但必须显式标注
- 不允许为了保持页面“完整”而返回未经校验的数字

原因：

- 错误统计会直接误导经营决策
- 对管理页而言，“空”和“异常”都比“错”更安全

### 决策 10：经营报表允许采用更大胆的模块级视觉风格，但必须服从可读性边界

经营报表模块在现有设计系统之上允许使用更鲜艳、更有舞台感的视觉表达，包括：

- 更高饱和度的渐变横幅
- 更鲜明的专题配色
- 更强的指标卡色彩层次
- 更明显的专题区块视觉分割

但必须保持：

- 浅色主导
- 关键数字高对比度
- 正文与表格可读性
- 状态不只靠颜色表达
- 移动端与窄屏端不过度堆叠装饰

建议页面组件结构：

```text
ManagementReportPage
├── ManagementReportHeader
├── ManagementReportFilters
├── ManagementOverviewSection
├── ManagementExecutiveSummarySection
├── ManagementSectionTabs
├── ManagementRegionalSection
├── ManagementLeadSection
├── ManagementCustomerSection
├── ManagementOpportunitySection
├── ManagementAcceptanceSection
├── ManagementCollectionSection
└── ManagementRiskSection
```

原因：

- 用户要求这个模块的 UI 更胆大、更炫酷、更鲜艳。
- 但视觉强化必须只服务于经营阅读效率，不能反过来压制数据理解。

## Risks / Trade-offs

- [专题过多导致首屏加载慢] → 首版统一走整页快照，并按专题聚合 SQL 控制行数与字段范围，必要时增加 5 到 15 分钟缓存。
- [首屏一次性查询全部专题把 CRM 打爆] → 调整为“核心摘要先加载 + 专题懒加载 + 缓存 + 并发限制”。
- [时间筛选口径被误解] → 每个专题在接口和页面上都返回显式的 `timeBasis` 和口径说明。
- [部门切换被误用为越权入口] → 复用现有范围服务，前端只展示允许部门，后端仍做二次校验并记录阻断审计。
- [收款专题与销售归属口径冲突] → 统一规定回款与应收按合同归属汇总，并在设计与测试中固定这一规则。
- [代理商/产品方案字段来源不稳定] → 首版允许先按当前 CRM 已验证字段输出，未确认字段不进必选专题计算。
- [整页快照过大导致导出与页面展示耦合过深] → 页面快照与导出 DTO 共享同一聚合底层，但导出格式化层单独实现。
- [摘要值与表格值对不上] → 增加指标字典、专题聚合定义、总分对账和快照阻断逻辑。
- [派生指标前后端各算一遍导致结果漂移] → 所有派生指标统一在后端生成，前端禁止二次计算。
- [开发后期补专题时悄悄改口径] → 通过指标字典和专题定义集中管理，并为每个核心专题建立样例对账测试。
- [视觉做得太炫导致数字难读] → 将高饱和视觉限制在标题区、摘要卡和专题边框，表格与正文保持可读型样式。

## Migration Plan

1. 新增 OpenSpec 变更，补齐经营报表能力、权限和范围治理需求。
2. 新增后端 `management-report` 模块，先打通 `options`、`snapshot`、`export` 三类接口。
3. 新增前端菜单、路由和页面骨架，先接入总览、经营摘要、收款情况、经营风险和建议四个核心专题。
4. 再补齐线索、客户、商机、验收进度等中层专题。
5. 最后补齐代理商/生态、产品方案、导出与自动化测试。

回滚策略：

- 若新模块稳定性不足，可直接隐藏 `management-report` 菜单并阻断对应接口，不影响现有分析工作台和合同审核。
- 若单个专题 SQL 有问题，可在快照组装层暂时降级移除该专题，不回退整个页面。
- 若收款专题性能异常，可先保留摘要与趋势，暂时关闭重点项目明细块。

## Open Questions

- `代理商/生态` 和 `产品方案` 的核心字段是否已有最终确认清单，还是需要在实现前补一轮字段核对。
- 经营报表导出首版是导出“当前专题”还是“整页快照”，以及是否需要同时支持 Excel 与 CSV。
- 收款专题中的“负责人”最终以合同负责人为准，还是需要额外展示回款记录负责人作为辅助维度。
- 首版是否需要为各专题增加“明细下钻抽屉”，还是先只提供专题表格与导出。
