## Purpose
定义统一结果包、grounded 洞察、阶段反馈和跨渠道一致交付的主规范，确保 Web 与企业微信都围绕同一份受控结果事实展示，而不是各自生成不同口径的解释与摘要。
## Requirements
### Requirement: 系统必须生成统一结果包并绑定一致性标识

系统 MUST 将一次分析执行产生的摘要、关键指标、主视图、表格、口径说明、数据新鲜度、可用动作和 AI grounded 洞察组装为同一个 `ResultBundle`。`ResultBundle` MUST 绑定唯一 `consistencyToken`，并要求摘要、图表、表格、最近查询预览、导出、解释和建议下一步问题均引用同一份受控结果事实；发现内容引用批次不一致时，系统 MUST 阻止正式结果交付。

#### Scenario: 结构化结果与洞察共享同一一致性标识
- **WHEN** 一次分析执行成功返回摘要、图表、表格和解释
- **THEN** 系统必须让这些结果块共享同一个 `consistencyToken`

#### Scenario: 结果块来源不一致时阻止交付
- **WHEN** 系统发现摘要、图表、表格、导出或 AI 洞察引用了不同批次或不同口径的执行结果
- **THEN** 系统必须阻止正式结果交付并提示重新执行或重新确认条件

### Requirement: AI 洞察必须 grounded 于当前结果包

系统 MUST 只基于当前 `ResultBundle` 中的事实结果、权限摘要和执行快照生成解释、原因提示、建议下一步问题以及 Markdown 总结，不得在洞察生成阶段再次读取新数据，也不得引入结果包中不存在的数值、排行、趋势或业务事实。系统 MUST 优先通过 AI 主链生成这些 grounded 洞察与 Markdown 章节；仅当 AI 主链不可用、超时、结构非法或低置信时，系统才 MAY 回退到既有模板 explanation、固定建议问题或固定 Markdown 骨架，并且必须显式记录当前内容来自 fallback。

#### Scenario: Markdown 总结基于当前结果包生成
- **WHEN** 用户查看一条已经成功返回的分析结果，且系统需要生成 Markdown 形式的总结
- **THEN** 系统必须基于当前结果包生成 Markdown 内容
- **THEN** 系统不得为了生成 Markdown 总结重新发起数据读取

#### Scenario: AI 不得在 Markdown 里编造未命中事实
- **WHEN** 当前结果包未命中某个客户、负责人、组织口径或异常原因
- **THEN** 系统不得在 Markdown 总结、解释或建议中把该对象当作已验证事实输出
- **THEN** 系统必须明确说明当前结果可支持的结论边界

#### Scenario: AI 主链不可用时回退到固定 Markdown 骨架
- **WHEN** grounded explanation、建议下一步问题或 Markdown 总结的 AI 主链不可用、超时或返回非法结构
- **THEN** 系统可以回退到既有模板 explanation、固定建议问题或固定 Markdown 骨架
- **THEN** 系统必须显式记录并暴露当前结果来自 fallback，而不是继续描述为 grounded AI 主链成功

### Requirement: 系统必须提供阶段化执行反馈

系统 MUST 向用户暴露与执行计划和直查执行状态一致的阶段化反馈，至少覆盖接收请求、补问、规划 / 直查准备、执行、纠错、结果组装、洞察生成、完成、失败和降级状态。阶段反馈 MUST 可被 Web 工作台和企业微信共同消费，但允许根据渠道展示能力裁剪字数和展示形式。

#### Scenario: Web 工作台展示完整阶段反馈
- **WHEN** Web 用户发起一次新的分析请求
- **THEN** 系统必须按时间顺序展示本次请求的关键阶段、补问提示、纠错信息、洞察生成和完成状态

#### Scenario: 企业微信展示摘要化阶段反馈
- **WHEN** 企业微信用户发起一次新的分析请求
- **THEN** 系统必须先返回处理中提示，并在后续按块返回摘要化阶段反馈和结果摘要

### Requirement: 系统必须按渠道裁剪同源结果而不改变数据口径

系统 MUST 基于同一个 `ResultBundle` 为 Web 工作台和企业微信生成渠道化展示片段。Web 工作台 MUST 可获取完整结构化结果、grounded 洞察与完整 Markdown 总结；企业微信 MUST 优先收到摘要化 markdown、关键指标块、结论块、必要的表格摘要块和简短解释。当完整结果不适合会话展示时，系统 MUST 提示用户到 Web 查看完整结果，但不得重新生成另一套分析逻辑。渠道裁剪 MUST 只发生在展示层，底层事实、执行快照、一致性标识和审计记录必须保持同源。

#### Scenario: Web 工作台展示完整 Markdown 与结构化明细
- **WHEN** 用户在 Web 工作台查看一条成功的分析结果
- **THEN** 系统必须提供完整标题、Markdown 总结、关键指标、主视图、表格、口径说明、解释和建议下一步问题
- **THEN** Web 展示不得因为启用 Markdown 而丢失明细数据、重跑、导出或审计入口

#### Scenario: 企业微信只展示裁剪后的 Markdown 与必要摘要块
- **WHEN** 同一条成功结果通过企业微信分发
- **THEN** 系统必须基于同源结果生成符合企业微信 markdown 子集限制的裁剪版内容
- **THEN** 系统在必要时提示到 Web 查看完整结果，不得改写事实口径或重新生成另一套总结逻辑

### Requirement: 系统必须为结果交付全过程留痕

系统 MUST 为规划、数据执行、自动纠错、结果组装、洞察生成和渠道分发全过程创建可检索审计快照。审计快照 MUST 至少包含执行来源、权限快照、纠错摘要、结果包标识、洞察生成状态、分发状态和失败原因；即使结果未成功交付，也必须留下完整的阻断或失败记录。

#### Scenario: 成功结果交付生成完整审计快照
- **WHEN** 一条分析请求成功完成并已向用户交付结果
- **THEN** 系统必须记录执行、结果包、洞察和分发状态对应的审计快照

#### Scenario: 失败或阻断结果同样留痕
- **WHEN** 一条分析请求在补问、执行、纠错、洞察或分发阶段失败或被阻断
- **THEN** 系统必须记录失败阶段、失败原因和当前快照，并允许治理端检索

### Requirement: grounded 洞察生成必须通过 capability pack 运行时执行
系统生成 grounded explanation、建议下一步问题或等价结果说明时 MUST 通过 `grounded-explanation-pack` 或等价 capability pack 运行时执行。该 capability pack MUST 提供版本化提示词、provider tuning、最小输出 contract 和 fallback 语义；结果交付链路 MUST 记录本次 grounded 生成使用的 `packCode`、`packVersion` 与失败原因。

#### Scenario: grounded explanation 通过 capability pack 生成
- **WHEN** 一条分析结果需要生成 grounded explanation 或建议下一步问题
- **THEN** 系统必须通过 grounded capability pack 运行时生成相应文案
- **THEN** 业务服务不得继续在结果交付服务中直接维护完整 grounded prompt

#### Scenario: grounded fallback 保留 pack 元信息
- **WHEN** grounded capability pack 因 provider 错误、超时、校验失败或显式禁用而进入模板 fallback
- **THEN** 系统必须记录对应的 `packCode`、`packVersion`、`fallbackReason` 和失败类别
- **THEN** 结果交付侧不得把该场景描述为 grounded AI 主链成功

### Requirement: 结果包必须记录统一时间口径
系统 MUST 在统一结果包中记录本次分析实际使用的时间口径 `temporalScope` 或等价结构。该结构 MUST 至少包含原始时间表达、归一化标签、起止边界、粒度、时区和来源。摘要、图表、表格、Markdown、最近查询、重跑和追问复用 MUST 引用同一份时间口径。

#### Scenario: Markdown 与结构化结果展示同一时间范围
- **WHEN** 一次“最近四个月商机情况”分析成功返回
- **THEN** 结构化结果包必须记录同一份最近四个月时间口径
- **THEN** Web Markdown、企业微信 Markdown、图表标题和明细表说明不得展示不同时间范围

#### Scenario: 重跑历史查询复用时间槽而不是重新猜测文本
- **WHEN** 用户从最近查询中重跑一条包含相对时间的历史问题
- **THEN** 系统必须按产品定义复用或重新计算该历史记录保存的时间槽策略
- **THEN** 系统不得仅凭历史自然语言文本再次走本地词表生成不可审计时间范围

### Requirement: 时间口径不一致时必须阻止交付
系统 MUST 在结果交付前校验摘要、图表、表格、导出、Markdown 和建议问题引用的时间口径是否一致。若任一展示块引用了不同时间槽、不同边界或无法追溯的时间范围，系统 MUST 阻止正式交付并记录失败原因。

#### Scenario: 图表和明细时间口径不一致时被阻断
- **WHEN** 图表数据来自一个时间槽，但明细表数据来自另一个时间槽
- **THEN** 结果一致性校验必须阻止交付
- **THEN** 用户可见失败原因必须说明结果口径不一致，而不是返回不可信分析结果

#### Scenario: AI grounded 总结不得引入结果包外时间事实
- **WHEN** grounded 总结生成阶段引用了结果包中不存在的时间范围或历史月份
- **THEN** 系统必须判定该总结与结构化结果不一致
- **THEN** 系统必须回退或阻断该 Markdown 交付

### Requirement: 系统必须在统一结果包中提供 Markdown 展示载荷

系统 MUST 在统一结果包中额外生成 Markdown 展示载荷，用于机器人和 Web 共用同一份 grounded 总结源。结果包 MUST 至少包含完整 Markdown 总结、企业微信裁剪版 Markdown 和可选的 Markdown 章节大纲或等价索引结构。Markdown 展示载荷 MUST 绑定同一个 `consistencyToken`，并与结构化结果、最近查询预览、导出、解释和建议下一步问题保持同源一致；系统不得把 Markdown 作为唯一事实源替代结构化结果后端。

#### Scenario: 统一结果包同时包含结构化事实与 Markdown 载荷
- **WHEN** 一次分析执行成功并生成最终结果
- **THEN** 系统必须在结果包中同时保留结构化事实结果和 Markdown 展示载荷
- **THEN** Markdown 载荷必须与结构化结果共享同一个一致性标识

#### Scenario: Markdown 与结构化事实不一致时阻止正式交付
- **WHEN** 系统发现 Markdown 总结引用的指标、排行、趋势或结论与结构化结果包不一致
- **THEN** 系统必须阻止正式结果交付并提示重新执行或重新确认条件
- **THEN** 系统不得继续把存在事实冲突的 Markdown 内容发往企业微信或 Web

### Requirement: Web Markdown 预览必须安全渲染并保留结构化细节入口

Web 工作台与结果详情页 MUST 支持统一结果包中的 Markdown 预览，但渲染过程 MUST 经过安全清洗和受控语法限制，禁止原样渲染模型返回的 HTML 或脚本片段。Web 页面在展示 Markdown 的同时 MUST 保留结构化细节入口，包括明细表、执行信息、重跑、导出和审计摘要；系统不得因为启用 Markdown 预览而把工作台降级成只有自由文本的只读页面。

#### Scenario: Web 安全渲染 Markdown 预览
- **WHEN** Web 页面渲染一条由模型生成的 grounded Markdown 总结
- **THEN** 系统必须先对 Markdown 做安全清洗和受控渲染
- **THEN** 页面不得直接插入未清洗的 HTML 或脚本内容

#### Scenario: Markdown 预览与结构化详情共存
- **WHEN** 用户在 Web 中查看 Markdown 预览结果
- **THEN** 系统必须仍然提供明细数据、执行信息、重跑、导出和审计入口
- **THEN** 系统不得因为 Markdown 预览存在就隐藏全部结构化细节能力

### Requirement: 统一结果交付必须采用共享 section contract
系统 MUST 将智能分析结果交付收敛为共享的 section contract，并允许该 contract 与经营报表区块体系复用。共享 section contract MUST 至少覆盖 `metric-strip`、`trend`、`distribution`、`risk`、`detail-table`、`actions` 和等价的来源说明结构；系统 MUST 不得继续让智能分析结果页与经营报表页长期维持两套完全独立、无法映射的区块协议。

#### Scenario: 智能分析结果可按共享区块协议交付
- **WHEN** 一次智能分析成功生成结构化结果
- **THEN** 结果包必须能够按共享 section contract 输出主要区块
- **THEN** 前端不得只能依赖私有页面字段才能渲染这些区块

#### Scenario: 经营报表可复用同类区块语义
- **WHEN** 智能分析结果与经营报表都需要展示趋势、分布、风险或明细区块
- **THEN** 两者必须能够映射到同一套区块语义 contract
- **THEN** 系统不得为同类信息长期维护彼此无法对齐的两套区块定义

### Requirement: 统一结果包必须提供来源说明、口径说明和执行依据摘要
系统 MUST 在统一结果包中显式提供区块级或结果级的来源说明、口径说明和执行依据摘要。结果包 MUST 至少包含 `sourceNotes`、`footnotes` 和 `executionTraceSummary` 或等价字段，用于说明指标来源、边界说明、缺失区块说明、降级说明以及本次分析的执行依据。Web 结果页和后续经营报表复用视图 MUST 从统一结果包读取这些说明，不得继续依赖页面本地拼装说明文案。

#### Scenario: 结果包包含可展示的来源说明与口径说明
- **WHEN** Web 用户查看一条成功的分析结果
- **THEN** 结果包必须为对应区块提供来源说明或口径说明
- **THEN** 页面不得只能通过静态帮助文案猜测该指标或区块的来源

#### Scenario: 缺失区块或降级结果必须进入统一说明字段
- **WHEN** 某个可选区块缺失、某段解释走了 fallback 或结果存在降级边界
- **THEN** 系统必须通过 `footnotes` 或等价统一说明字段暴露原因
- **THEN** 页面不得只在局部组件里临时硬编码这类说明，导致不同入口口径不一致

### Requirement: Web 结果详情必须展示统一执行依据摘要
系统 MUST 在 Web 结果详情或等价结果查看入口中展示统一执行依据摘要，并允许用户查看本次结果对应的执行轨迹、命中语义资产摘要、主要执行来源和 fallback 信息。该展示 MUST 基于统一结果包中的 `executionTraceSummary` 或等价结构生成；系统 MUST 不得要求前端分别拼接多个底层 snapshot 字段才能解释当前结果。

#### Scenario: 结果详情可查看本次执行依据
- **WHEN** 用户在 Web 中打开一条分析结果详情
- **THEN** 页面必须能够查看本次结果的执行依据摘要
- **THEN** 用户不得只能看到最终数字而无法理解本次结果依据了哪些执行路径和知识资产

#### Scenario: 执行依据摘要与结果块同源
- **WHEN** 结果详情同时展示结构化结果区块和执行依据摘要
- **THEN** 二者必须来自同一份统一结果包
- **THEN** 系统不得让执行依据摘要引用另一套与当前结果不一致的快照或上下文
