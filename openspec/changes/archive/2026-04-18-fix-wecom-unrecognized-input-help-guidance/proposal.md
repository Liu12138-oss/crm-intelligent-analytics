## Why

在新的 `unify-ai-first-entry-orchestration` 总提案下，企业微信“未识别输入帮助兜底”不再适合继续靠规则黑名单和空闲短句特判扩张，而应收敛为统一 AI 入口理解层后的低置信 / fallback 帮助策略。本变更需要从“规则收紧主链”改成“AI-first 之后的帮助兜底策略”。

## What Changes

- 将企业微信空闲未识别输入帮助收敛为统一 AI 理解层低置信、不可用或 fallback 命中的帮助出口。
- 保留显式帮助、问候、明确支持入口、明确分析问题和明确实体查询的既有直达路径，不让帮助兜底吞掉稳定能力。
- 不再继续扩大规则黑名单或短句特判范围，而是优先依赖统一 AI 理解层判断“是否真的未识别”。
- 继续复用统一能力目录和帮助提示构造函数，不新增另一份硬编码能力清单。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `wecom-unrecognized-input-help-guidance`: 从“空闲规则兜底修复”收敛为“统一 AI 理解层后的低置信 / fallback 帮助策略”。

## Impact

- 影响 `backend/src/modules/wecom/` 下的会话编排与帮助提示分发逻辑。
- 不再单独推动新的规则入口识别扩张，而是依赖统一 AI 入口提案作为上游。
- 需要回收当前变更中把规则特判视为最终方案的口径。
