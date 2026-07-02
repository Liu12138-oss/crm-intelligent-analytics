## Why

当前企业微信“今日跟进”入口主要依赖精确短语匹配，像“跟进商机”“跟进今日商机”这类更自然、更短的口语表达仍会落到普通分析链路，导致用户被错误补问时间范围，入口识别过紧。

## What Changes

- 放宽企业微信今日跟进入口识别规则，从精确短语提升为宽松语义匹配。
- 兼容更短、更口语化的表达，如“跟进商机”“跟进今日商机”“今日商机跟进”“客户跟进”等。
- 保留对普通分析问题的边界，避免把纯查询类商机问题误识别成今日跟进。

## Capabilities

### New Capabilities
- `wecom-follow-up-intent-recognition`: 定义企业微信今日跟进入口的宽松语义识别规则。

### Modified Capabilities
- `wecom-follow-up-chat-simplification`: 细化“今日跟进入口”的触发方式，允许更多自然表达进入首次确认直写链路。

## Impact

- 影响 `backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts` 的入口判定逻辑。
- 影响 `backend/src/modules/wecom/wecom-bot.service.ts` 的主题入口重置逻辑。
- 影响 `backend/src/modules/wecom/wecom-ai-prompt.config.ts` 的关键词定义与测试。
