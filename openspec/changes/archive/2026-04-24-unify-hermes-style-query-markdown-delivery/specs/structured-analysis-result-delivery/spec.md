## MODIFIED Requirements

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

## ADDED Requirements

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
