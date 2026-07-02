## ADDED Requirements

### Requirement: 系统必须从版本化 skill pack 加载合同审核标准

系统 MUST 通过版本化 `skill pack` 而不是硬编码规则文件加载合同审核标准。一个激活中的 `skill pack` MUST 至少包含要求正文、工作流说明、执行配置和提示词模板，并在装载成功后生成可供任务引用的 pack 标识、版本号和校验摘要。业务修改审核标准时，系统 MUST 支持通过更新 `skill pack` 文档与配置完成，而不是要求直接修改后端 TypeScript 规则文件。

#### Scenario: 激活 pack 成功后生成可执行标准快照

- **WHEN** 服务启动或运行时重新加载一个合法的合同审核 `skill pack`
- **THEN** 系统必须成功生成该 pack 的标识、版本号、校验摘要和可执行检查项集合，并允许后续审核任务引用

#### Scenario: 非法 pack 不得进入正式审核链路

- **WHEN** `skill pack` 缺少必要文件、格式损坏或必填字段不完整
- **THEN** 系统必须拒绝激活该 pack，并阻止其进入正式审核链路

### Requirement: 系统必须允许通过 pack 配置声明执行策略与适用范围

系统 MUST 允许 `skill pack` 通过配置声明适用的合同类型、启用的提示词模板、确定性校验器集合、默认模型档位和执行模式阈值。任务创建时，系统 MUST 固化本次任务所引用的 pack 配置快照，以保证历史任务可追溯。

#### Scenario: 任务创建时固化 pack 配置快照

- **WHEN** 用户上传合同并创建新的审核任务
- **THEN** 系统必须将当前激活 pack 的版本、适用范围、提示词档位和校验器配置固化到该任务的快照中

#### Scenario: pack 更新后不影响历史任务解释

- **WHEN** 业务更新了 `skill pack` 内容并重新激活新版本
- **THEN** 新任务必须使用新 pack，历史任务仍必须保留原 pack 快照并可继续查看
