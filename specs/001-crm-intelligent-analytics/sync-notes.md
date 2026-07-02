# 需求同步说明：一期主规格统一优化

**同步日期**：2026-03-24  
**同步来源**：[原始需求.md](D:/code/CRM/需求文档/原始需求.md)

## 本次同步目标

本次调整不再只做规格合并，而是继续把一期目录下的计划、预研、数据模型、快速开始、任务清单、接口契约和治理检查清单统一到同一套需求口径。

## 本次同步内容

1. 将企业微信机器人问数与 Web 智能分析工作台统一为一期双入口。
2. 将 AI 自然语言问数、结构化结果展示、常用查询、最近查询纳入一期主链路。
3. 将“数据准确性保护、结果一致性、当前权限重跑、全链路审计”明确写入计划、预研、数据模型、契约和任务清单。

## 已同步到的文档

- [spec.md](./spec.md)
  已统一为一期主规格基线，覆盖企业微信问数、Web 智能分析工作台、常用查询、最近查询、导出限制和审计治理。

- [plan.md](./plan.md)
  已改为“企业微信问数 + Web 智能分析工作台 + Web 治理审计”的统一实施计划，并补充 AI 接入、结果展示和查询资产管理要求。

- [research.md](./research.md)
  已补充 AI 接入方式、结果归一化展示、查询资产管理和数据准确性保护决策。

- [data-model.md](./data-model.md)
  已扩展到查询会话、结果视图、常用查询、最近查询与重跑审计模型。

- [quickstart.md](./quickstart.md)
  已补充 Web 工作台、常用查询、最近查询和结果一致性验证场景。

- [tasks.md](./tasks.md)
  已按双入口问数、结果展示、查询复用、权限与稳定性、治理与审计重新组织任务。

- [contracts/openapi.yaml](./contracts/openapi.yaml)
  已扩展分析工作台、查询模板、最近查询和重跑接口。

- [checklists/requirements.md](./checklists/requirements.md)
  已更新为一期统一规格质量检查清单。

- [checklists/security.md](./checklists/security.md)
  已按双入口、查询复用、结果一致性和权限重跑要求重写检查项。

## 当前同步结论

- `specs/001-crm-intelligent-analytics/` 现为一期唯一需求与设计目录。
- 一期范围已统一包含企业微信机器人问数、Web 智能分析工作台、结构化结果展示、常用查询、最近查询、权限控制、受限导出和审计追踪。
- 后续若继续细化设计，应直接以当前目录为唯一基线，不再新建新的一期规格目录。

## 增量同步说明：智能合同审核模块

**同步日期**：2026-04-06

### 本次同步内容

1. 在 `contracts/openapi.yaml` 中补充智能合同审核任务列表、上传创建、详情查询和产物下载接口契约。
2. 在 `quickstart.md` 中补充合同审核环境变量映射、本地验证场景和权限边界说明。
3. 在 `docs/testing/crm-intelligent-analytics-quickstart-checklist.md` 中补充合同审核最小闭环与权限验证检查项。

### 本次同步结论

- 一期主规格文档已允许在统一壳子内落入 `智能合同审核` 模块的接口与联调说明。
- 合同审核继续遵循“上传者本人可见、授权角色扩展查看、下载再次鉴权”的默认边界。

## 增量同步说明：合同审核升级为 skill pack 运行时

**同步日期**：2026-04-07

### 本次同步内容

1. 在 `contracts/openapi.yaml` 中补充合同审核 `reviewBasis`、执行模式枚举、降级原因和产物级追溯字段。
2. 在 `quickstart.md` 与 `docs/testing/crm-intelligent-analytics-quickstart-checklist.md` 中补充 `skill pack` 环境变量、`AI_HYBRID / DETERMINISTIC_ONLY / BLOCKED` 口径，以及规则快审、降级快审和 AI 补充审核验证项。
3. 在 `spec.md`、`plan.md` 和 `data-model.md` 中补充合同审核运行时能力边界、AI 补充审核状态字段和追溯要求。

### 本次同步结论

- 合同审核当前正式路径已调整为“版本化 `skill pack` + 确定性规则快审 + 可选 AI 补充审核”。
- `DETERMINISTIC_ONLY` 当前需要区分“规则快审”和“降级快审”：存在 `degradationReason` 时必须明确展示降级原因；不存在时必须明确说明当前仅覆盖已配置的明确判定项。
- 合同审核任务、问题、产物和审计事件现统一使用 `reviewBasis` 作为审核依据元数据。
