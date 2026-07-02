## Why

当前企业微信今日跟进链路存在两个直接影响使用体验的问题：一是单对象跟进摘要在确认区会丢掉后续补充句，导致用户看到的写回内容不完整；二是单聊写回成功后仍附带“当前会话不是群聊，暂不支持直接分享到群”的提示，噪音较大。

## What Changes

- 调整企业微信今日跟进摘要提取逻辑，单对象场景保留同一条口述中的后续补充说明，避免写回内容截断。
- 调整单聊写回成功后的成功文案，只保留“已写入 CRM”的结果提示，不再输出暂不支持分享到群的提示。

## Capabilities

### New Capabilities
- `wecom-follow-up-summary-refinement`: 定义企业微信今日跟进摘要完整性与单聊成功提示要求。

### Modified Capabilities
- `wecom-follow-up-chat-simplification`: 细化今日跟进简化链路中的摘要展示和完成态提示行为。

## Impact

- 影响 `backend/src/modules/wecom/wecom-bot.service.ts` 的摘要抽取与成功提示拼装逻辑。
- 影响 `backend/src/modules/wecom/wecom-ai-prompt.config.ts` 的单聊成功文案。
- 影响企业微信会话集成测试中的摘要文本与成功提示断言。
