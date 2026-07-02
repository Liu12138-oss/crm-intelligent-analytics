## 1. 环境默认档案引导

- [x] 1.1 扩展 AI Profile 领域模型与前端类型，增加环境来源、保留 `bootstrapKey`、引导告警和最近引导时间字段
- [x] 1.2 在 `LocalRuntimeConfigService` 中补充 Claude 环境变量读取与缺失字段识别，兼容 `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`
- [x] 1.3 新增 `AiModelEnvBootstrapService`，在治理初始化时按 `env_codex_default` / `env_claude_default` 缺失自动落表默认档案
- [x] 1.4 实现 Codex 默认档案自动引导与首次可用时自动选中逻辑，保持当前环境默认运行时不回退

## 2. 唯一启用与草稿测试后端改造

- [x] 2.1 改造 `AiProfileActivationService`，让激活成功后自动把其它档案回写为 `INACTIVE`
- [x] 2.2 调整 AI 模型治理列表响应与摘要字段，支持前端按“单选启用”渲染唯一生效项
- [x] 2.3 新增草稿测试接口，支持基于表单 payload 直接执行静态校验与真实 smoke test
- [x] 2.4 实现编辑已有档案时“密钥留空也可测试”的后端复用逻辑

## 3. 前端治理页交互收敛

- [x] 3.1 改造 `AiProfileTable.vue`，移除双状态操作，改为单选启用列并展示环境来源标签
- [x] 3.2 改造 `AiModelProfilePage.vue`，接入唯一启用流程、环境引导摘要和切换后的统一刷新
- [x] 3.3 改造 `AiProfileFormDrawer.vue`，新增“测试连接”按钮、测试态反馈和环境缺失字段提示
- [x] 3.4 调整前端服务层与类型定义，接入草稿测试接口并兼容环境默认档案展示

## 4. 回归验证与文档同步

- [x] 4.1 补充后端单测与契约测试，覆盖环境默认档案落表、Claude 缺失模型提示、唯一启用和草稿测试
- [x] 4.2 补充前端单测，覆盖列表单选启用、抽屉测试按钮、环境来源展示和密钥留空测试
- [x] 4.3 更新 `backend/.env.example`，补充 Claude 推荐模型键位与环境默认档案说明
- [x] 4.4 更新 `specs/001-crm-intelligent-analytics/quickstart.md` 与相关操作说明，明确 Codex / Claude 默认档案引导、单选启用和抽屉测试流程
