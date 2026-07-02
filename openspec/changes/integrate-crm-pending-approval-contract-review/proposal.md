## Why

当前智能合同审核仍以“先上传本地合同文件，再进入审核”的方式运行，这与商务人员在 CRM 中处理“待1级审批”合同的实际工作流割裂，也带来了重复导出、重复上传和版本不一致的风险。现在需要把合同审核入口前移到已有 CRM 合同审批清单，直接围绕待审批合同发起审核，减少人工搬运并确保审核基于当前 CRM 数据。

## What Changes

- **BREAKING**：智能合同审核工作台默认入口不再以本地 `.docx` 上传区作为主流程，而是改为展示 CRM 中“待1级审批”的合同表格。
- 新增待1级审批合同列表接口、合同源数据详情接口和基于合同记录直接创建审核任务的接口。
- 新增“点击合同名称查看合同数据、在操作列发起审核、自动进入审核结果详情页”的前端交互。
- 合同审核任务将补充 CRM 来源快照，记录源合同 ID、审批步骤、关键字段摘要与审核时刻的源数据留痕。
- 合同来源接入将执行“CRM 官方 API 优先、受控只读兜底”的评估，并在缺少直接满足“待1级审批列表”能力时走受控只读路径。
- 合同审核审计范围补充源合同查看与基于 CRM 合同发起审核的留痕要求。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `contract-review-workbench`: 智能合同审核工作台从上传驱动改为 CRM 待1级审批合同表格驱动，并补充合同数据查看与行内发起审核。
- `contract-review-orchestration`: 合同审核任务支持从 CRM 待1级审批合同快照创建，而不再只依赖本地上传文件。
- `contract-review-auditability`: 合同源数据查看、源合同快照追溯和基于 CRM 合同创建审核任务需要进入统一审计与权限边界。

## Impact

- 影响前端 [`frontend/src/pages/contract-review/ContractReviewWorkbenchPage.vue`](c:\code\CRM-Agent\frontend\src\pages\contract-review\ContractReviewWorkbenchPage.vue)、[`frontend/src/services/contract-review.service.ts`](c:\code\CRM-Agent\frontend\src\services\contract-review.service.ts) 与 [`frontend/src/types/contract-review.ts`](c:\code\CRM-Agent\frontend\src\types\contract-review.ts)。
- 影响后端 [`backend/src/modules/contract-review/`](c:\code\CRM-Agent\backend\src\modules\contract-review) 模块控制器、服务、类型定义与审计事件，以及 [`backend/src/database/crm-readonly/crm-readonly.service.ts`](c:\code\CRM-Agent\backend\src\database\crm-readonly\crm-readonly.service.ts) 的 CRM 读取能力。
- 影响合同审核接口契约、一期快速验证场景和主规格中的合同审核流程描述，需要同步更新 [`specs/001-crm-intelligent-analytics/contracts/openapi.yaml`](c:\code\CRM-Agent\specs\001-crm-intelligent-analytics\contracts\openapi.yaml) 与相关说明文档。
