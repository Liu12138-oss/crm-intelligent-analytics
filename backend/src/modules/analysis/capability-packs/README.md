# capability packs

## 目录结构

- `ai-capability-pack.types.ts`
  统一定义 capability pack 的 metadata、provider tuning、request overrides、运行结果与失败分类。
- `ai-capability-pack.registry.ts`
  注册项目内可用的 capability pack，运行时只允许从这里加载已登记 pack。
- `ai-capability-pack.runtime.ts`
  统一执行 pack 的 prompt 渲染、provider tuning、结构化调用、归一化、条件校验与失败分类。
- `runtime/pack-rollout.policy.ts`
  负责 pack 级启停与灰度回退判断。
- `provider-tuning/`
  收敛 provider / model 维度的少量受控调优逻辑。
- `packs/`
  按业务语义拆分的 capability pack 定义文件。
- `fixtures/`
  沉淀测试桩、golden case 与回归输入样例，测试环境与单测优先复用这里的样例。

## 版本规则

- 每个 pack 必须显式声明 `packCode` 与 `packVersion`。
- `packVersion` 由代码变更手工维护，随提示词、few-shot、条件校验或 provider tuning 变化而递增。
- 审计、日志、快照与集成测试断言必须优先消费 `packCode` / `packVersion`，避免“提示词已经变了但看不出来”。

## few-shot 约束

- few-shot 只允许表达当前 pack 负责的最小业务语义，不得把其它场景的执行细节混入示例。
- 示例必须围绕“最小公共 contract + 条件必填字段”组织，避免重新把全部字段写成静态必填。
- provider 特化示例应放在 `provider-tuning/` 内统一选择，不得在业务服务里额外拼接第二套示例。

## fixture 用法

- `fixtures/` 中的样例优先供 `NODE_ENV=test` 下的轻量桩、pack runtime 单测和集成测试复用。
- 新增入口语义、provider 回归或 validation 失败场景时，先补 fixture，再补对应测试。
- 禁止在测试文件里长期维护一套与 runtime 脱节的硬编码意图逻辑；如果必须写测试桩，也要从 fixture 推导。

## provider override 白名单

capability pack 目前只允许透传以下 request overrides：

- `wireApi`
- `structuredOutputMode`
- `disableResponseStorage`
- `enableThinking`
- `maxTokens`
- `timeoutMs`
- `retryOnTimeout`

超出白名单的字段必须在 adapter 层直接拒绝，不能静默透传。

## 灰度与回滚

- 使用环境变量 `AI_CAPABILITY_DISABLED_PACKS` 按逗号分隔声明要关闭的 `packCode`。
- pack 被关闭后，只影响对应场景，运行时会返回 `PACK_DISABLED` 并交由上层进入最小安全 fallback。
- provider tuning 出现兼容问题时，优先回退单个 pack 或单个 provider 模块，而不是整体关闭统一 AI 运行时。
