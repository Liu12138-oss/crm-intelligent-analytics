# 联软 CRM P3 语义层与 AI 查询计划落地记录

> 日期：2026-06-09 至 2026-06-10  
> 输入资料：联软《发给 crm-agent-联软CRM权限字段关系指标字典样例补充回复》《发给 crm-agent-四类角色权限回归期望结果与截图口径》以及 `role-regression-expected-20260610.json`  
> 本轮目标：吸收联软补充的权限、字段、关系、指标、字典和样例，启动 P3 语义层与 AI 查询计划增强。

## 1. 本轮已吸收的联软补充

| 联软补充项 | 我方落地状态 | 说明 |
| --- | --- | --- |
| 权限桥表新增字段 | 已吸收 | 支持 `bigRegions / ownerIds / managedUserIds / departmentIds / organizationIds / includeChildPartners`。 |
| 报价区域字段 | 已吸收 | `fact_lianruan_quote` 新增 `region / big_region / assigned_partner_id / parent_partner_id`。 |
| 订单区域字段 | 已吸收 | `fact_lianruan_order` 新增 `region / big_region`，用于区域订单分析。 |
| 报备大区字段 | 已吸收 | `fact_lianruan_registration` 新增 `big_region`。 |
| 字段能力清单 | 已吸收 | 联软字段能力表、业务白名单、SQL Guard 白名单已同步更新。 |
| 指标口径 | 已吸收首批 | 新增有效订单、超两周未更新商机、未活跃客户、报备到订单漏斗等语义指标。 |
| 字典与同义词 | 已吸收首批 | 补充服务商/渠道/代理商、下单/订单、沉默客户、停滞商机等同义词。 |
| 样例问题 | 已吸收首批 | 超管、区管、渠道、销售员工的典型问法已进入知识层和回归测试。 |
| 四类角色权限期望 | 已吸收 | 固化超管、区管、渠道账号、销售员工的权限注入回归断言。 |
| 复杂组合问法 | 已落地首版 | 支持客户、报备、商机、订单、未关联商机报备、超期商机的组合经营分析切片。 |

## 2. 已改造能力

### 2.1 分析库字段补齐

已补齐以下分析库标准模型字段：

| 表 | 新增字段 |
| --- | --- |
| `fact_lianruan_registration` | `big_region` |
| `fact_lianruan_quote` | `assigned_partner_id`、`parent_partner_id`、`region`、`big_region` |
| `fact_lianruan_order` | `region`、`big_region` |
| `bridge_lianruan_user_permission` | `big_regions_json`、`owner_ids_json`、`managed_user_ids_json`、`department_ids_json`、`organization_ids_json`、`include_child_partners` |

已有本地分析库会在启动或同步时自动补列，不删除历史数据。

### 2.2 权限注入增强

非全量角色查询分析库时，当前支持：

| 权限类型 | 注入字段 |
| --- | --- |
| 区域权限 | `region / big_region` |
| 服务商权限 | `partner_id / assigned_partner_id / parent_partner_id` |
| 负责人权限 | `owner_id / assigned_staff_id / created_by` |

报价、订单现在可以直接按区域权限裁剪，不再只能通过服务商间接承接。

### 2.3 P3 语义理解增强

已补充以下业务语义：

| 问法 | 规范理解 |
| --- | --- |
| 渠道、渠道商、代理商、经销商、合作伙伴 | 服务商 |
| 下单金额、成单金额、订单总金额 | 订单金额 |
| 报价总金额、报价单金额 | 报价金额 |
| 超两周未更新、超过 14 天没更新、长期没跟进、停滞商机 | 超过两周未更新商机 |
| 沉默客户、最近 30 天没有活跃、没有活动客户 | 未活跃客户 |
| 报备到订单、报备转商机、商机转报价、报价转订单 | 漏斗转化 |

### 2.4 指标口径增强

已进入语义指标目录的新增口径：

| 指标 | 口径 |
| --- | --- |
| 有效订单数量 | 排除 `cancelled / canceled / void / rejected / deleted`。 |
| 有效订单金额 | 有效订单范围内汇总 `amount`。 |
| 超过两周未更新商机数量 | `source_updated_at` 超过 14 天，且不属于已成交/已失单。 |
| 最近 30 天未活跃客户数量 | `latest_activity_at` 为空或超过 30 天。 |
| 报备到订单转化漏斗 | 报备、商机、报价、订单逐级统计，复杂关联后续进入 P4 受控模板深化。 |

## 3. 已验证结果

| 验证项 | 结果 |
| --- | --- |
| 后端专项测试 | 通过，5 个测试文件、28 个用例。 |
| 后端构建 | 通过。 |
| 分析库同步验证 | 通过，OpenAPI 同步、落库、受控 SQL 抽样成功。 |
| 语义字段目录 | 报价 12 个字段、订单 11 个字段、报备 7 个字段已写入语义层。 |

## 4. 当前 P3 已完成范围

本轮完成的是 P3 的基础能力、可执行高频模板、四类角色回归和首版组合经营分析：

1. 字段目录补齐。
2. 权限字段补齐。
3. 业务同义词补齐。
4. 高频样例进入知识层。
5. 宽意图理解枚举扩展。
6. 字段能力校验扩展。
7. SQL Guard 白名单扩展。
8. 分析库同步与回归验证。
9. 客户报备未关联商机固定模板。
10. 超过两周未更新商机固定模板。
11. 最近 30 天未活跃客户固定模板。
12. 有效订单区域汇总固定模板。
13. 山东区域等明确业务范围过滤，和权限范围分层叠加。
14. 四类角色权限注入回归：超管、区管、渠道账号、销售员工。
15. 复杂组合问法首版：客户、报备、商机、订单、未关联商机报备、超期商机合并输出一个经营分析切片。

## 5. 本轮新增的 P3 可执行模板

| 模板 | 命中问法示例 | 数据表 | 权限控制 | 输出 |
| --- | --- | --- | --- | --- |
| 客户报备未关联商机 | “有多少客户是没有报备商机的，分别创建了多长时间” | `fact_lianruan_registration`、`fact_lianruan_opportunity` | 报备表行级范围注入 | 数量、平均创建时长、客户报备明细 |
| 超过两周未更新商机 | “本区域超两周未更新的商机有哪些” | `fact_lianruan_opportunity` | 商机表行级范围注入 | 超期商机数量、涉及金额、最长未更新天数、明细 |
| 最近 30 天未活跃客户 | “最近 30 天没有活跃的客户有哪些” | `dim_lianruan_customer` | 客户表行级范围注入 | 未活跃客户数量、最长未活跃天数、明细 |
| 有效订单区域汇总 | “山东区域本月订单金额是多少” | `fact_lianruan_order` | 订单表行级范围注入 | 有效订单数量、有效订单金额、区域汇总表 |
| 组合经营分析 | “今年山东区域合作伙伴客户、商机的报备情况和下单情况，同时统计未关联商机客户报备和超两周未更新商机” | `dim_lianruan_customer`、`fact_lianruan_registration`、`fact_lianruan_opportunity`、`fact_lianruan_order` | 每个子任务分别注入对应表行级权限 | 经营概览、未关联商机报备明细、超期商机明细 |

这些模板不是绕过 AI，而是 P3 的“确定口径受控执行积木”：

1. 入口仍先经过统一问数链路和 AI 时间/意图理解。
2. 命中明确高频口径时，程序使用固定只读 SQL 模板。
3. 所有 SQL 仍经过 SQL Guard、字段白名单、行级权限注入、行数限制和审计。
4. 未命中模板时继续走 AI Text-to-SQL，再由安全链路决定是否执行或回退。

## 6. 四类角色权限回归落地

| 角色 | 用户 | 联软期望范围 | 我方回归断言 |
| --- | --- | --- | --- |
| 超管 | `liulonghai / A030` | `scopeType=all`，全量可见 | 不注入区域、渠道、负责人裁剪条件。 |
| 区管 | `admin_sd / A013` | `region=山东区`，`bigRegion=大北区` | 对订单、报价、商机、客户等按 `region / big_region` 注入裁剪。 |
| 渠道账号 | `liangcui / PA001` | `partnerIds=["P001"]` | 对渠道链路字段 `partner_id / assigned_partner_id / parent_partner_id` 注入裁剪。 |
| 销售员工 | `shangxichao / S022` | `userIds=["S022"]` | 对负责人字段 `owner_id / assigned_staff_id / created_by` 注入裁剪。 |

同一数据快照下，联软提供的当前期望数量为：

| 角色 | users | partners | customers | registrations | opportunities | quotes | orders |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 超管 | 61 | 174 | 178 | 150 | 44 | 17 | 2 |
| 区管 | 46 | 32 | 178 | 150 | 44 | 17 | 2 |
| 渠道账号 | 9 | 1 | 83 | 81 | 15 | 16 | 1 |
| 销售员工 | 1 | 1 | 7 | 4 | 3 | 0 | 0 |

说明：当前自动化回归重点校验“权限注入方式和不越权边界”，数量矩阵随 SIT 数据变化可能波动；如果联软重新导出 JSON，应同步刷新对应断言材料。

## 7. P3 收尾后进入 P4 的事项

| 优先级 | 事项 | 说明 |
| --- | --- | --- |
| P0 | 结构化查询计划协议深化 | 当前组合报告是程序固定模板；P4 应让 AI 输出可审计多子任务计划，再由程序选择模板或编译器执行。 |
| P0 | 低置信追问 | 字段、口径、对象不明确时追问，不默认返回同一份数据。 |
| P0 | 漏斗链路深化 | 报备、商机、报价、订单逐级转化率仍需联软提供完整链路样例后进入 P4 模板。 |
| P1 | 语义资产治理页面联动 | 把同义词、样例、负例、指标口径进入治理后台可维护资产。 |
| P1 | 查询计划到 P4 编译器衔接 | 为受控 SQL 编译、分页、多图表和报告化准备稳定 contract。 |

## 8. 仍需联软继续配合

| 事项 | 说明 |
| --- | --- |
| 权限接口多用户持续验证 | 四类角色本轮已吸收；后续如权限模型或数据快照变化，请重新导出 JSON。 |
| 报价/订单区域样例 | 请提供至少几条对象自身为空、通过继承规则补齐 `region/bigRegion` 的报价和订单样例。 |
| 状态字典稳定性 | 请确认 `won/lost/completed/cancelled` 等编码和中文状态长期稳定。 |
| 漏斗关联样例 | 请提供一组客户从报备、商机、报价到订单的完整链路样例，用于 P4 漏斗模板校验。 |
| 结果口径确认 | 对“有效订单、未活跃客户、超两周未更新商机、转化率”给出 CRM 页面可复核口径。 |

## 9. 风险与边界

1. P3 重点是“理解和计划”，不是放开自由查库。
2. AI 仍不能绕过 SQL Guard、权限注入、字段白名单和审计。
3. 复杂组合问法首版已支持多子任务聚合切片；复杂漏斗、多事实表关联和子查询能力会在 P4 受控 SQL 执行阶段继续深化。
4. 如果联软字段值为空或权限接口未覆盖某个账号，我方会保守降级或提示补充，不返回全量数据。
5. “山东区域”等业务范围过滤只支持明确已标准化区域词；不明确的范围仍应追问或交由 AI 计划层处理。

## 10. 本轮验证记录

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| 执行器与 SQL Guard 专项 | `pnpm --dir backend test -- analysis-warehouse-sql-guard.service.spec.ts analysis-warehouse-analysis-executor.service.spec.ts` | 通过，2 个测试文件、18 个用例。 |
| P3 相关回归 | `pnpm --dir backend test -- lianruan-crm-field-capability.registry.spec.ts business-analysis-intent-mapper.service.spec.ts business-analysis-intent.pack.spec.ts analysis-warehouse-sql-guard.service.spec.ts analysis-warehouse-analysis-executor.service.spec.ts` | 通过，5 个测试文件、36 个用例。 |
| 后端构建 | `pnpm --dir backend build` | 通过。 |
| 分析库联通与同步 | `pnpm --dir backend verify:analysis-warehouse -- --include-contract-pending` | 2026-06-10 通过，OpenAPI 同步成功，用户 61、服务商 100/174、客户 100/178、报备 100/150、商机 44、报价 17、订单 2 已落库抽样验证。 |

## 11. 2026-06-10 P3 完结与 P4/P5 首批落地补充

> 新增输入：联软《发给 crm-agent-P3-P5 高频问法复杂问题与展示验收配合资料》及 `p3-p5-assets-20260610.json`。  
> 本轮结论：P3 已按联软最新资料完成收口；P4/P5 已完成首批受控模板和企微展示中文化增强，后续继续推进复杂链路、查询计划编译器和报告化体验。

### 11.1 P3 完结项

| 完结项 | 落地说明 |
| --- | --- |
| 高频问法吸收 | 已把“有报价未下单、报备到订单漏斗、有效订单、未活跃客户、渠道活跃度”等问法纳入语义知识层。 |
| 复杂问题样例吸收 | 已以“漏斗转化”和“报价未下单”为 P4 首批复杂模板入口，保留后续多子任务报告扩展空间。 |
| 状态字典吸收 | 报价、订单、渠道等级等枚举在企微展示层转为中文业务表达。 |
| 有效订单口径更新 | 按联软资料，`confirmed/completed` 计入有效成交；`pending/processing` 作为过程订单展示，不计入有效订单。 |
| 安全边界确认 | 仍坚持 SQL Guard、字段白名单、权限注入、LIMIT、超时和审计，不允许 AI 绕过安全链路。 |

### 11.2 P4 首批已落地能力

| 能力 | 命中问法 | 当前口径 | 说明 |
| --- | --- | --- | --- |
| 报备到订单转化漏斗 | “报备到订单整体转化率是多少”“分析山东区本季度从报备到订单的转化情况” | 分别统计报备、商机、报价、有效订单数量和金额，并计算逐级转化率。 | 当前为总量漏斗首版；完整 `regId -> oppId -> quoteId -> orderId` 链路将在后续链路模板深化。 |
| 有报价未下单客户 | “找出有报价但未下单的客户，并按报价金额排序” | 以报价表为主表，左关联有效订单，返回未匹配有效订单的报价客户。 | 当前分析库订单表尚未落 `quote_id`，先按 `customer_id` 兜底关联，并在结果口径中明确说明。 |
| 有效订单汇总口径 | “订单金额是多少”“山东区域本月订单金额是多少” | 仅统计 `confirmed/completed`。 | 这会导致当前 SIT 数据中 `pending/processing` 两笔订单不计入有效成交，属于预期口径差异。 |

### 11.3 P5 首批已落地能力

| 能力 | 落地说明 |
| --- | --- |
| 企微字段中文化 | 新增漏斗阶段、报价 ID、订单 ID、分配人员、阶段数量、阶段金额、转化率、停滞天数、未活跃天数等中文列。 |
| 状态字典中文化 | `draft/submitted/approved/rejected/converted/pending/processing/confirmed/completed` 等状态转为中文。 |
| 渠道等级中文化 | `primary/secondary/none` 转为一级渠道、二级渠道、未设置。 |
| 列表卡片稳定展示 | 企微继续采用列表卡片展示前 10 条，避免 Markdown 宽表在移动端错位。 |

### 11.4 本轮验证记录

| 验证项 | 命令 | 结果 |
| --- | --- | --- |
| P3/P4/P5 专项回归 | `pnpm --dir backend test -- analysis-warehouse-analysis-executor.service.spec.ts analysis-warehouse-sql-guard.service.spec.ts analysis-query-knowledge.service.spec.ts analysis-markdown.util.spec.ts` | 通过，4 个测试文件、39 个用例。 |
| 后端构建 | `pnpm --dir backend build` | 通过。 |

### 11.5 后续未完成事项

| 阶段 | 未完成事项 | 需要联软配合 |
| --- | --- | --- |
| P4 | 完整链路漏斗：按 `regId -> oppId -> quoteId -> orderId` 直接链路计算真实转化和流失样例。 | 后续 OpenAPI 或分析库字段需稳定提供订单 `quote_id/opp_id/reg_id` 或等价链路字段。 |
| P4 | 查询计划到受控 SQL 编译器：让 AI 输出结构化计划，再由程序编译 SQL。 | 持续提供复杂问法期望、页面对账结果和字段变化通知。 |
| P5 | 图片/附件报告：让企微输出更接近经营看板的图片、HTML 或文件。 | 提供最终看板验收样例、可展示字段边界和导出权限规则。 |
