## Why

当前仓库已经具备 CRM 查询、问数、日报与受控跟进写回能力，但还没有“新增客户”的后端接口口子，后续企业微信机器人即使识别到新增客户意图，也无法通过统一服务受控调用 CRM 官方 Open API。现在先补齐后端创建入口，可以把创建逻辑、字段校验、默认值策略与错误处理收敛到本系统，后续机器人接入时无需再重复设计一套写入链路。

## What Changes

- 新增受会话鉴权保护的“新增客户”后端接口，仅提供给后续机器人或其它受控调用方使用，本轮不接入机器人对话流程。
- 按截图收敛新增客户的必填输入，至少覆盖“名称、IT决策权所在地、统一社会信用代码、电话”四项校验。
- 通过 CRM 官方 `/api/v2/customers` 接口创建客户，禁止回退到数据库直写。
- 为客户自定义字段补充可配置映射，支持把截图中的业务字段映射到 CRM 自定义字段键名。
- 补充接口契约、集成测试与主规格同步说明，明确当前阶段只提供接口口子，不开放机器人直接创建。

## Capabilities

### New Capabilities
- `crm-customer-create-endpoint`: 提供受控的新增客户接口，统一封装字段校验、默认值处理、自定义字段映射和 CRM Open API 调用。

### Modified Capabilities
- 无

## Impact

- 影响代码：`backend/src/modules/opportunities/`、`backend/src/shared/config/`、`backend/test/`
- 影响接口：新增内部“新增客户”HTTP 接口与返回模型
- 影响文档：`specs/001-crm-intelligent-analytics/` 下规格、快速开始、数据模型与 `contracts/openapi.yaml`
- 依赖能力：CRM Open API 登录态、`/api/v2/customers`、客户字段映射配置
