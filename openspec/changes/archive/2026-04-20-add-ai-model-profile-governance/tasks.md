## 1. 数据模型与运行时解析

- [x] 1.1 在应用存储模型中新增 AI Profile、全局激活记录和最近测试结果字段
- [x] 1.2 新增 `ai-models` 模块，拆分 `AiModelProfileService`、`AiProfileActivationService`、`AiRuntimeConfigResolver`、`AiSecretCryptoService`
- [x] 1.3 实现 AI Profile 仓储与服务端密钥加密/解密能力，支持新增、编辑、复制、启停、留空不改密钥与显式清空密钥
- [x] 1.4 新增统一 `AiRuntimeConfigResolver`，实现“激活 Profile 优先，环境默认兜底”的解析顺序，并支持切换后缓存失效

## 2. Provider 适配层与 SDK 接入

- [x] 2.1 定义 `AiProviderAdapter` 接口与 `AiProviderRegistryService`，统一抽象文本调用、结构化调用和健康检查
- [x] 2.2 将现有 Codex SDK 初始化与调用逻辑迁移到 `codex-provider.adapter.ts`，保持当前能力不回归
- [x] 2.3 在后端安装并接入 Claude SDK，新增 `claude-provider.adapter.ts`，兼容现有 Claude 配置字段与网关鉴权方式
- [x] 2.4 新增统一执行门面，改造分析问数、企业微信 AI 理解和合同审核 AI 编排统一通过门面消费当前激活 Provider
- [x] 2.5 为后续新增模型定义扩展入口，补齐 `sdkOptions` 校验与注册表扩展约束

## 3. 后端治理接口与切换校验

- [x] 3.1 新增管理员专用 AI 模型治理接口，覆盖列表、详情、新增、编辑、复制、启停和激活
- [x] 3.2 实现密钥字段回显保护规则，确保接口只返回掩码状态与更新时间
- [x] 3.3 实现 Codex / Claude Profile 的静态校验与真实 SDK smoke test 接口，返回测试状态、耗时与失败阶段
- [x] 3.4 为 Claude Profile 增加可选 MCP 校验，记录 `mcpConfigPath` 连接状态与失败原因
- [x] 3.5 为激活切换增加切换后再次验证、缓存失效、失败回滚与明确的用户反馈结果

## 4. 前端治理页面与组件封装

- [x] 4.1 在治理导航与路由中新增“AI 模型”入口，并限制为管理员可访问
- [x] 4.2 新增 `AiModelProfilePage.vue` 页面容器，负责列表拉取、摘要刷新与操作编排
- [x] 4.3 拆分 `AiProfileSummaryCard`、`AiProfileTable`、`AiProfileFormDrawer`、`AiProfileHealthCheckDialog` 等组件
- [x] 4.4 实现新增/编辑/复制 Profile 的表单交互，支持 Codex / Claude 不同字段、留空不改密钥与显式清空密钥
- [x] 4.5 实现测试连接、MCP 校验状态、激活切换、启停状态与异常反馈的交互闭环

## 5. 审计与回归验证

- [x] 5.1 扩展审计事件类型与审计快照，覆盖 Profile 创建、更新、密钥变更、测试、激活和回滚
- [x] 5.2 补充后端测试，覆盖密钥不回显、激活唯一性、环境兜底与测试失败阻断激活
- [x] 5.3 补充 Codex / Claude adapter 单测，覆盖参数映射、鉴权注入与统一返回格式
- [x] 5.4 补充切换集成测试，验证 Codex 与 Claude Profile 在切换后都能通过后台真实测试接口
- [x] 5.5 补充前端测试，覆盖管理员访问、组件渲染、密钥交互、测试结果与激活反馈
- [x] 5.6 验证企业微信、智能分析和合同审核在切换激活 Profile 后统一读取新配置

## 6. 文档与运维说明

- [x] 6.1 更新 `backend/.env.example`，补充 AI Profile 主密钥、Claude SDK 兼容配置和环境默认兜底说明
- [x] 6.2 更新快速开始与治理操作文档，写明 Codex / Claude 的配置方式、测试连接方式和回滚方式
- [x] 6.3 补充技术实现说明，明确当前采用的模块边界、Provider 适配器模式和未来新增模型的扩展步骤
- [x] 6.4 补充审计检索与故障排查说明，明确如何定位“当前生效模型”、历史切换记录和测试失败阶段
