## Why

当前系统已经同时提供企业微信机器人、Web 智能分析工作台和 Web 合同审核入口，但各入口对用户输入的理解方式仍然分裂：有的依赖关键词和状态机，有的依赖规则补问，有的尚未建立统一的 AI 理解层。这会导致同一句话在不同入口命中不同链路，规则越堆越多，仍然无法覆盖多语种、口语、省略、错别字和跨句指代等真实输入。

现在需要建立一条统一的“AI 优先理解，固定程序受控执行”总编排，让所有业务自然语言输入先经过同一个 AI 理解层，再路由到各自稳定的只读分析、跟进写回、日报、创建或合同审核程序，同时保留现有签名校验、鉴权、权限、白名单、确认和审计边界。

## What Changes

- 新增统一的 AI 入口编排层，覆盖企业微信机器人和 Web 入口中的业务自然语言输入，先做场景识别、意图识别、回复语义识别和结构化槽位抽取，再路由到固定受控程序。
- 明确区分“自然语言理解前置”和“安全前置检查”：企业微信签名校验、Web 会话鉴权、文件类型与大小校验、权限判定、白名单校验、写入确认和审计留痕仍必须先由固定程序执行，不能交给 AI 决定。
- 将企业微信中的帮助、取消、切换任务、直接提交、修改、候选确认、跟进四段草稿抽取、日报补全和候选重排统一收敛到 AI 理解层；规则逻辑只保留为低风险 fallback。
- 将 Web 智能分析入口改为 AI-first：先由 AI 判断是问数、解释型追问、改条件追问还是越界请求，再决定进入受控分析编排、结果复用或阻断提示。
- 将受控分析链路中的 `GUARDED_DIRECT_QUERY` 收敛为真正的 AI 驱动模式：由 AI 生成受控读取意图或受控查询，再进入固定安全栈和 API-first 路由执行，而不是仅由静态编排切换模式标签。
- 将 grounded explanation、建议下一步问题、企业微信日报摘要和主管建议统一改为“AI 基于已验证事实结果生成”，固定模板文案退回为 fallback，不再作为默认主链路。
- 将合同审核入口明确纳入统一边界说明：文件上传、格式校验、权限校验和任务创建属于固定程序前置步骤；如后续存在用户自然语言补充说明、解释追问或审核动作意图，必须同样先经过统一 AI 理解层。
- 补充统一审计快照，至少覆盖：原始输入、AI 识别场景、结构化槽位、路由结果、fallback 原因、最终执行程序、确认状态和阻断原因。

## Capabilities

### New Capabilities
- `ai-entry-intent-orchestration`: 定义跨企业微信与 Web 的统一 AI 入口理解层、路由 schema、fallback 规则和安全边界。

### Modified Capabilities
- `wecom-follow-up-guided-template`: 跟进自由文本整理从“规则过渡版优先”升级为“AI 结构化抽取优先，规则仅作 fallback 与校验”。
- `wecom-fuzzy-entity-selection`: 候选实体排序与推荐从规则评分升级为 AI 重排优先，保留受控召回与用户最终确认边界。
- `wecom-daily-report-reminder-summary`: 个人日报摘要、团队预览和主管建议从模板拼装升级为 grounded AI 生成优先，模板文案退为 fallback。
- `wecom-task-cancel-guidance`: 企业微信中的取消、切换、帮助、直接提交和继续当前任务等回复语义改由统一 AI 理解层优先判定。
- `contract-review-orchestration`: 合同审核相关用户自然语言说明、解释追问和后续交互需接入统一 AI 理解层，同时保留文件上传和任务执行的固定前置校验。
- `crm-api-first-integration`: 受控分析读取从“静态计划路由”升级为“AI 先理解读取意图，再进入 API-first 与受控只读执行边界”。

## Impact

- 影响后端 `backend/src/modules/wecom`、`backend/src/modules/analysis`、`backend/src/modules/daily-report`、`backend/src/modules/contract-review`、`backend/src/modules/audit` 的入口编排、AI 网关调用、结构化 schema、执行路由和审计快照。
- 影响前端 Web 工作台与合同审核详情页对解释、追问、建议下一步问题和执行快照的展示逻辑，但不改变既有认证与路由路径。
- 影响企业微信会话上下文与应用库存储模型，需要新增统一 AI 识别结果、fallback 原因和路由结果快照。
- 影响现有 `enhance-wecom-ai-structured-assistant`、`enhance-controlled-analysis-orchestration`、`fix-wecom-unrecognized-input-help-guidance` 三个变更的口径，需要把“规则过渡能力已完成”的描述回收为 fallback，并与本提案建立依赖或吸收关系。
