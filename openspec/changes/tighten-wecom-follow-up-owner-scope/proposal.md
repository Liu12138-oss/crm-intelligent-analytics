## Why

当前企业微信 `跟进客户`、`跟进商机`、`今日跟进` 链路虽然已经具备受控写回能力，但运行时只校验 `wecom.followup.writeback` 功能权限，没有继续校验“当前用户是否与目标对象负责人存在允许的组织关系”。这会导致具备全局跟进写回权限的用户，在对象唯一命中后仍可能对不属于自己、自己小组或上级管理链范围内的客户/商机执行写回。

同时，现有代码与规格已经出现分叉：实现和测试已经部分支持 `Customer` 跟进写回，但主规格、OpenAPI 和待写回对象模型仍以 `Opportunity-only` 为主。该不一致如果继续保留，会让后续权限收口、审计追踪和用户提示长期处于半开半关状态，因此需要在本次一并收口。

## What Changes

- 新增企业微信跟进对象级授权能力，在 `wecom.followup.writeback` 全局动作权限之外，再校验目标对象负责人与当前用户之间是否命中“负责人本人、负责人所在小组成员、负责人递归上级领导、管理员”任一关系。
- 明确 `跟进客户` 与 `跟进商机` 的负责人口径：跟进客户按客户当前负责人判权，跟进商机按商机当前负责人判权；`今日跟进` 在对象识别完成后按最终选中对象类型继承对应负责人口径。
- 将“负责人所在小组”定义为企业微信当前直属上级事实下的最小直属团队，并要求“上面的各层领导”按企业微信直属上级链递归向上判定，不再按页面展示部门名做粗粒度放权。
- 在草稿创建前与最终写回前都执行对象级授权校验；若负责人或组织关系在确认期间变化，系统必须阻断最终写回并保留草稿与失败原因。
- 正式收口 `Customer` 与 `Opportunity` 双对象写回口径，统一更新待写回对象模型、接口契约、用户文案和审计语义，不再保留“代码支持 Customer、规格仍只写 Opportunity”的不一致状态。
- 为对象级授权拒绝补齐统一审计留痕，能够说明被拒绝的目标对象、当前负责人、命中的组织关系或拒绝原因。

## Capabilities

### New Capabilities

- `wecom-follow-up-owner-scope`: 规范企业微信跟进写回在全局动作权限之外，如何基于目标对象负责人、直属团队和递归上级链执行对象级授权，以及 Customer / Opportunity 双对象口径下的草稿创建、最终写回和审计边界。

### Modified Capabilities

- `wecom-follow-up-guided-template`: 跟进模板、自由文本整理、对象识别与最终写回确认链路需要新增对象级授权门闩，并正式承认 `Customer` 与 `Opportunity` 双对象写回口径。
- `organization-scope-governance`: 当前企业微信组织事实除用于默认数据范围解析外，还需要支持跟进对象负责人同组成员、直属上级链和递归上级链的关系判定，且关键字段缺失时不得扩大跟进权限。
- `feature-permission-enforcement`: `wecom.followup.writeback` 需要明确为“全局动作开关”，并与新的对象级授权门闩叠加执行；权限拒绝审计需要能区分“缺少动作权限”和“对象关系不满足”两类阻断。

## Impact

- 后端受影响模块：
  - `backend/src/modules/wecom`
  - `backend/src/modules/opportunities`
  - `backend/src/modules/governance`
  - `backend/src/modules/auth`
  - `backend/src/modules/audit`
- 受影响的数据与契约：
  - 企业微信待写回对象模型与工作记忆字段
  - 企业微信消息响应中的 `followUpWriteback.objectType`
  - 跟进写回相关审计快照字段
- 受影响的依赖与事实来源：
  - 企业微信同步组织事实与 `directLeaderUserids`
  - CRM 用户到企业微信用户映射
  - CRM 官方 `POST /api/v2/revisit_logs` 接口
- 受影响的测试：
  - 企业微信跟进模板 / 自由文本写回集成测试
  - 对象级权限拒绝审计测试
  - 组织关系判定单元测试
