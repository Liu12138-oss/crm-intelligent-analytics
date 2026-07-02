## Why

当前系统只有商机查询与跟进写回能力，还缺少“新增商机”的统一后端接口，后续机器人即使识别到建商机意图，也无法通过受控服务把数据写入 CRM 官方 Open API。先补齐后端创建接口，可以提前固化必填字段、产品关联、自定义字段映射和错误边界，为后续机器人编排提供稳定落点。

## What Changes

- 新增受会话鉴权保护的“新增商机”后端接口，仅提供接口口子，本轮不接入企业微信机器人创建流程。
- 按截图收敛新增商机的必填输入，至少覆盖“项目名称、最终客户、线索编号、关联产品、预计有效收入、预计签单日期、被续签合同号、代理商全称、项目现状及关键点、售前”等必填约束。
- 通过 CRM 官方 `/api/v2/opportunities` 接口创建商机，统一处理标准字段、产品关联字段与自定义字段。
- 为截图中的业务字段补充可配置的 CRM 自定义字段映射，避免把页面文案硬编码为 CRM 内部字段键名。
- 补充接口契约、集成测试与主规格同步说明，明确当前阶段仍不开放机器人直接发起创建。

## Capabilities

### New Capabilities
- `crm-opportunity-create-endpoint`: 提供受控的新增商机接口，统一封装必填校验、产品关联、自定义字段映射和 CRM Open API 调用。

### Modified Capabilities
- 无

## Impact

- 影响代码：`backend/src/modules/opportunities/`、`backend/src/shared/config/`、`backend/test/`
- 影响接口：新增内部“新增商机”HTTP 接口与返回模型
- 影响文档：`specs/001-crm-intelligent-analytics/` 下规格、快速开始、数据模型与 `contracts/openapi.yaml`
- 依赖能力：CRM Open API 登录态、`/api/v2/opportunities`、商机字段映射配置、产品关联字段入参格式
