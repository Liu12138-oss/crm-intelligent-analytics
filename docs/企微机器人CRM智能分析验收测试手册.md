# 企微机器人 CRM 智能分析验收测试手册

本文档记录 CRM 智能分析一阶段通过企业微信机器人提问验收的标准流程。后续测试时按本文执行，避免重复摸索启动方式、会话确认和判定口径。

## 一、测试目标

验证「渠道CRM系统机器人」能通过企业微信长连接收到用户提问，并调用 CRM OpenAPI 与 AI 分析链路返回阶段性可验收结果。

一阶段重点不验证敏感数据和写入动作，只验证以下能力：

- 企业微信机器人长连接已连通，能收到消息并回传结果。
- CRM OpenAPI 鉴权可用，能读取当前账号权限范围内的真实统计数据。
- AI 入口和路由可用，经营总览、渠道贡献、转化漏斗类问题能进入正确分析链路。
- 回复内容应简洁、结构化、可读，不能只返回字段缺口或统一失败提示。

## 二、前置条件

执行前先确认以下条件：

- 前端已启动，默认访问地址为 `http://127.0.0.1:5173/`。
- 后端已启动，默认监听端口为 `3001`。
- 后端使用企业微信 SDK 长连接模式，运行配置中 `WECOM_ENABLE_SDK_TRANSPORT=true`。
- CRM OpenAPI 配置已注入运行环境，且能调用 `/auth/token` 获取访问令牌。
- AI 模型配置已注入运行环境。若原始模型不可用，应使用已验证可用的模型名，不要在代码里硬编码密钥。
- 企业微信客户端已登录，并打开「渠道CRM系统机器人」会话。

注意：不要把 `AppSecret`、企业微信 `Secret`、AI `APIKey` 写入文档或提交到仓库。测试时通过本机环境变量、临时终端命令或安全配置文件注入。

## 三、启动方式

### 1. 启动前端

在项目根目录执行：

```bash
pnpm --dir frontend dev --host 127.0.0.1
```

启动后确认：

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

应看到 `127.0.0.1:5173` 正在监听。

### 2. 启动后端

在 `backend` 目录执行后端启动命令。以下只展示变量名，不展示密钥值：

```bash
PORT=3001 \
CRM_ANALYSIS_ROUTE=OPENAPI \
CRM_STANDARD_OPEN_API_BASE_URL='http://10.20.3.250:3000/api/open/v1' \
CRM_STANDARD_OPEN_API_APP_KEY='<CRM_APP_KEY>' \
CRM_STANDARD_OPEN_API_APP_SECRET='<CRM_APP_SECRET>' \
CRM_STANDARD_OPEN_API_ACCESS_MODE='service-client-with-local-scope' \
WECOM_ENABLE_SDK_TRANSPORT=true \
WECOM_BOT_ID='<WECOM_BOT_ID>' \
WECOM_BOT_SECRET='<WECOM_BOT_SECRET>' \
OPENAI_API_KEY='<AI_API_KEY>' \
ANALYSIS_AI_BASE_URL='<AI_BASE_URL>' \
ANALYSIS_AI_MODEL='<已验证可用模型>' \
ANALYSIS_AI_MODEL_PROVIDER='<模型供应商>' \
ANALYSIS_AI_WIRE_API='chat_completions' \
ANALYSIS_AI_STRUCTURED_OUTPUT_MODE='json_object' \
node -r ts-node/register src/main.ts
```

启动后确认：

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

后端日志应出现以下关键字：

```text
Authentication successful
企业微信机器人入站监听已启用
Nest application successfully started
```

## 四、CRM OpenAPI 自检

在不输出令牌明文的前提下，验证 CRM OpenAPI 是否可用：

```bash
TOKEN=$(curl -sS -m 8 -X POST 'http://10.20.3.250:3000/api/open/v1/auth/token' \
  -H 'Content-Type: application/json' \
  --data '{"appKey":"<CRM_APP_KEY>","appSecret":"<CRM_APP_SECRET>"}' \
  | jq -r '.data.accessToken // .data.token // .accessToken // .token // empty')

for path in \
  '/auth/me' \
  '/analytics/business-overview' \
  '/analytics/partners/contribution?page=1&pageSize=3' \
  '/analytics/funnel/registration-opportunity-order'
do
  printf '\n### %s\n' "$path"
  curl -sS -m 12 "http://10.20.3.250:3000/api/open/v1${path}" \
    -H "Authorization: Bearer $TOKEN" \
    | jq '{code,message,dataType:(.data|type),dataKeys:(.data|if type=="object" then keys else null end)}'
done
```

通过标准：

- `/auth/me` 返回 `code=0`。
- `/analytics/business-overview` 返回 `summaries`、`funnel`、`dimensions` 等结构。
- `/analytics/partners/contribution` 返回数组。
- `/analytics/funnel/registration-opportunity-order` 返回漏斗阶段数据。

## 五、企业微信会话确认

发送任何验收问题前，必须先确认会话正确：

- 企业微信左侧当前会话名称为「渠道CRM系统机器人」。
- 会话标题旁有 `BOT` 标识。
- 输入框处于该 BOT 会话内。
- 不要在普通群聊、个人聊天或其它机器人会话中发送验收问题。

如果无法确认会话，请先停止测试，避免误发。

## 六、推荐验收问题

每轮测试建议只发 2 到 3 条，不要在失败时连续刷屏。

### 1. 经营总览

```text
本月经营总览情况
```

期望：

- 应进入看板直连或经营总览分析链路。
- 回复应包含核心指标、范围说明、经营摘要或报告链接。
- 不应返回“当前联软标准 OpenAPI 字段能力暂不支持订单的客户分类”。
- 不应返回“统一业务语义解析未返回可执行 CRM 分析意图”。

### 2. 渠道贡献

```text
本月渠道贡献排名
```

期望：

- 应返回渠道商或服务商贡献排名摘要。
- 可包含报备数、商机数、商机金额、报价数、订单数、订单金额等字段。
- 若远端某些金额为空，应清楚说明数据口径，不应整体失败。

### 3. 转化漏斗

```text
报备到订单转化漏斗
```

期望：

- 应返回报备、商机、报价、订单漏斗阶段。
- 应返回阶段数量和转化率。
- 若订单金额为空，应仍能返回数量漏斗和可解释说明。

## 七、后端日志观察点

发送问题后，观察后端日志。

经营总览类问题应看到：

```text
看板桥接检测
shouldBridgeToDashboard: true
企微看板分析请求已识别，桥接到 DashboardReportComposer
DashboardReportComposer 返回结果
```

常规分析问题应看到：

```text
统一入口已决定调用受控分析链路
意图解析命中AI主链
```

如果出现以下日志或回复，说明一阶段验收未通过，需要继续定位：

```text
当前统一业务语义解析未返回可执行的 CRM 分析意图
当前联软标准 OpenAPI 字段能力暂不支持本次分析所需的 ...
CRM 标准开放接口调用失败
AI 服务暂时不可用或尚未配置完成
```

## 八、判定标准

本轮验收通过需要同时满足：

- 企业微信 BOT 收到问题后能在合理时间内返回。
- 三类问题至少两类能返回真实结构化业务结果。
- `本月经营总览情况` 必须不再误判为字段缺口阻断。
- 后端日志能证明请求进入正确链路。
- 回复不暴露密钥、令牌、内部异常堆栈或 SQL。

## 九、常见问题处理

### 1. 企业微信没有回复

检查后端是否启动并监听 `3001`：

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

检查日志是否有：

```text
Authentication successful
企业微信机器人入站监听已启用
```

如果没有，优先检查 `WECOM_ENABLE_SDK_TRANSPORT`、`WECOM_BOT_ID`、`WECOM_BOT_SECRET`。

### 2. AI 调用失败或超时

检查模型是否真实可用。若用户提供的模型不可用，应先查询供应商模型列表或使用已验证可用模型。

同时确认：

```text
ANALYSIS_AI_WIRE_API=chat_completions
ANALYSIS_AI_STRUCTURED_OUTPUT_MODE=json_object
```

### 3. CRM 返回 HTML 或 JSON 解析失败

通常表示接口地址、鉴权、白名单或路径不正确。先执行本文「CRM OpenAPI 自检」，确认 `/auth/token` 和统计端点均返回 JSON。

### 4. 经营总览被误判为字段缺口

应检查企微看板桥接判定。`本月经营总览情况` 应命中：

```text
经营总览
经营情况
总览
情况
```

并进入 `DashboardReportComposer`，而不是普通宽意图字段能力校验阻断。

## 十、测试记录模板

每次验收可按以下格式记录：

````markdown
## 验收记录

- 日期：
- 测试人：
- 前端地址：
- 后端端口：
- 企微会话：渠道CRM系统机器人（BOT）
- CRM OpenAPI 自检：通过 / 不通过
- AI 模型：仅记录模型名，不记录密钥

| 问题 | 结果 | 是否通过 | 备注 |
| --- | --- | --- | --- |
| 本月经营总览情况 |  |  |  |
| 本月渠道贡献排名 |  |  |  |
| 报备到订单转化漏斗 |  |  |  |

### 后端关键日志

```text
粘贴不含密钥和 token 的关键日志
```

### 结论

- 通过：
- 待修复：
````
