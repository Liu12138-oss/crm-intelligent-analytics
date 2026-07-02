## ADDED Requirements

### Requirement: 企业微信个人与团队日报预览必须校验 wecom.daily_report.preview
系统 MUST 在企业微信个人今日日报预览、小组日报预览和相关自然语言预览入口上校验 `wecom.daily_report.preview`。企业微信用户即使已经通过机器人通道准入，也不得因为拥有问数、创建或写回能力而自动获得日报预览权限。

#### Scenario: 缺少 wecom.daily_report.preview 的用户不能查看个人日报预览
- **WHEN** 某用户已通过企业微信通道准入，但未被授予 `wecom.daily_report.preview`，并请求查看自己的今日日报预览
- **THEN** 系统必须拒绝该预览请求
- **THEN** 不得返回日报正文、草稿摘要或空状态预览内容

#### Scenario: 缺少 wecom.daily_report.preview 的用户不能查看团队日报预览
- **WHEN** 某用户已通过企业微信通道准入，但未被授予 `wecom.daily_report.preview`，并请求查看某个小组当天日报预览
- **THEN** 系统必须拒绝该预览请求
- **THEN** 不得继续进入负责人解析、团队汇总或主管洞察生成链路

### Requirement: 日报预览必须在每次返回前按实时权限重新校验
系统 MUST 在每次构造个人日报预览或小组日报预览前重新校验当前用户是否仍具备 `wecom.daily_report.preview`。若用户在同一会话中被撤销该动作，后续预览请求 MUST 立即失效，不得继续复用历史会话状态放行。

#### Scenario: 会话建立后权限被撤销时后续日报预览立即失效
- **WHEN** 某用户已进入企业微信会话并成功查看过日报预览，随后被撤销 `wecom.daily_report.preview`
- **THEN** 该用户后续再次请求日报预览时系统必须拒绝
- **THEN** 不得因为会话仍然有效就继续返回预览结果
