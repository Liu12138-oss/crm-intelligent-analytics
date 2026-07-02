# AI 与企业微信机器人核心收敛清理执行记录

## 1. 执行时间

2026-06-27。

## 2. 备份情况

已在清理源项目前创建源码与运行资料备份：

`.tmp/backups/crm-agent-base-pre-contraction-20260627-145205.zip`

备份排除了 `node_modules`、`dist`、`.git` 和旧压缩包，保留源码、文档、配置文件与 `.runtime` 运行资料，便于回滚本次收敛。

## 3. 本次收敛范围

本次执行的是第一批保守收敛，目标是让默认项目形态回到“AI 配置 + 企业微信机器人普通 AI 对话”：

1. 后端默认 controller 收敛为 `AnalysisController` 的 capability 子能力、AI 模型治理、AI 上下文治理、企业微信机器人入口和认证入口。
2. Web 智能分析查询接口默认返回“能力未启用”，但保留 `/analysis/capabilities`，避免登录后权限快照失效。
3. 企业微信机器人默认关闭 CRM 问数、渠道分析、合同评审、日报、新增客户/商机、跟进写回、实体查询、结果重显和导出等业务动作。
4. 企业微信普通文本在核心模式下进入普通 AI 对话，不再进入 CRM 分析执行链。
5. 业务动作关闭时，企业微信机器人不再强制检查实时 CRM 数据源。
6. 业务动作关闭时，已通过企业微信验签和来源校验的 senderId 可使用临时身份进行普通 AI 对话；该身份没有 CRM 查询、导出或写回权限。
7. 前端默认路由和导航只保留登录、企业微信扫码回调、无权限页和 AI 配置页。
8. README 中的项目定位和企业微信机器人当前能力已同步更新。

## 4. 未物理删除的内容

以下历史业务代码暂时保留，不在本轮物理删除：

- CRM 智能问数执行链路。
- 渠道 CRM OpenAPI 和看板链路。
- 合同评审链路。
- 日报和主动通知链路。
- 客户/商机创建和跟进写回链路。
- 审计、模板、最近查询、语义治理和权限中心页面代码。

保留原因是这些服务仍存在构造期依赖，直接删除会影响应用启动或企业微信机器人核心链路。后续若要物理归档，应先完成 provider 拆分和对应回归测试。

## 5. 验证结果

已通过：

- `pnpm --dir backend exec jest --runInBand --runTestsByPath test/modules/ai-models/ai-runtime-config.resolver.spec.ts test/modules/ai-models/unified-ai-execution.service.spec.ts test/modules/wecom/wecom-message-adapter.service.spec.ts test/modules/wecom/wecom-maintenance-degradation.service.spec.ts`
- `pnpm --dir backend exec ts-node --transpile-only -e "require('./src/app.module'); require('./src/modules/wecom/wecom-bot.service'); require('./src/modules/wecom/wecom-auth.service'); require('./src/modules/analysis/ai-gateway.service'); console.log('core modules loaded')"`

受本地环境影响未通过：

- `pnpm --dir backend build`：失败原因是仓库既有 TypeScript 环境缺少完整 Express、Fetch、Supertest 类型，报错分布在 `main.ts`、多个历史 CRM/合同/通知模块和测试文件中，不是本次收敛新增的单点错误。
- `pnpm --dir frontend build`：失败原因是当前 Node 24 环境下依赖导出解析异常，`estree-walker` 报 `No "exports" main defined`，尚未进入源码编译阶段。
- `pnpm --dir frontend exec vitest run ...`：失败原因是 `esbuild` host 版本 `0.27.7` 与 binary 版本 `0.25.12` 不一致，属于本地依赖安装状态问题。

## 6. 当前项目状态

当前源项目已进入核心收敛状态：默认用户入口只保留 AI 配置，默认企业微信机器人只保留普通 AI 对话与未启用提示。暂缓业务没有物理删除，仍可作为后续独立模块恢复的代码基础。

## 7. 2026-06-30 继续清理记录

本次在不影响当前 AI 配置、企业微信通道和联调管理入口的前提下，继续清理默认链路中的历史业务耦合：

1. 企业微信核心机器人不再默认调用 CRM 只读问数服务。
2. CRM 问数、渠道分析、经营看板、合同、日报、写回和导出类消息统一返回“业务能力暂未启用”提示，不进入 CRM OpenAPI 查询。
3. 删除已从默认链路摘除的 `wecom-crm-readonly-question.service.ts` 及对应单元测试。
4. 核心能力快照中的“企微 CRM 只读问数”口径已调整为“企微普通 AI 对话”，不再暴露历史指标和维度清单。
5. 前端启动入口不再全局注册经营报表 block 渲染器，经营报表历史组件仅在对应历史页面自身加载时注册。

保留内容：

- “联调管理”仍保留 CRM OpenAPI 配置、自检、诊断和身份映射能力，用于后续独立模块恢复前的联调治理。
- `dist/` 下旧构建产物未作为源码依据处理，后续重新构建后会自然刷新。
