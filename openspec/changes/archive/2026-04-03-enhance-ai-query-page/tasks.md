## 1. CRM 语义识别与受控查询链路

- [x] 1.1 扩展 `backend/src/modules/analysis/analysis-intent.service.ts`，增加 CRM 域内/域外问题识别、业务同义词映射、低置信度识别和缺失关键条件判断
- [x] 1.2 基于一期白名单、数据模型和 CRM Open API 术语对照，补充受支持对象、指标、维度、排序语义和常见业务说法映射
- [x] 1.3 为分析链路定义标准化查询计划 AST 类型，并把自然语言解析结果先收敛为 AST，再进入 SQL 编译
- [x] 1.4 扩展 `backend/src/modules/analysis/query-compiler.service.ts`，把查询计划 AST 稳定编译为受控只读 SQL，并确保权限条件自动注入

## 2. 准确性保护与流式输出

- [x] 2.1 调整 `backend/src/modules/analysis/query-risk-guard.service.ts` 与 `backend/src/modules/analysis/query-whitelist.service.ts`，明确阻断域外请求、写入型请求和未批准对象字段
- [x] 2.2 新增 SQL 深度校验链路，覆盖 JOIN 路径、字段白名单、聚合函数、`GROUP BY`/`ORDER BY` 合法性、只读 AST 校验和结果行数限制
- [x] 2.3 为真实数据库路径增加执行前预检能力，至少覆盖字段存在性、别名有效性和高风险扫描检查
- [x] 2.4 在分析服务中补齐“先补问、再执行、最后校验”的处理顺序，缺少关键条件、低置信度或校验失败时拒绝直接返回结果
- [x] 2.5 增强结果一致性与关键指标回算校验，确保摘要、指标卡、图表、表格与导出来源于同一份受控查询结果
- [x] 2.6 重写 `backend/src/modules/analysis/result-streamer.service.ts`，细化 AI 流式输出阶段，覆盖语义识别、SQL 编译/校验状态、执行进度、结果整理和完成状态
- [x] 2.7 调整分析响应映射与错误文案，确保域外问题、超范围请求、SQL 校验失败和结果准确性风险都返回明确中文提示

## 3. AI 查询页结果优先改版

- [x] 3.1 重构 `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`，将结果摘要、关键指标、主图表、结果表格和流式输出提升为主视觉区域
- [x] 3.2 调整 `frontend/src/components/analysis/CommonQueryPanel.vue` 与 `frontend/src/components/analysis/RecentQueryPanel.vue` 的布局位置，使其靠近查询输入框
- [x] 3.3 压缩权限摘要、AI 状态和其他辅助卡片的视觉权重，保留必要信息但避免喧宾夺主
- [x] 3.4 调整前端 store 和页面状态，支持结果优先渲染、流式记录回看以及就近复用常用查询和最近查询

## 4. 验证与回归

- [x] 4.1 补充后端测试，覆盖 CRM 域内口语化问题识别、域外友好拒绝、写入型请求阻断、查询计划 AST 生成和只读 SQL 编译场景
- [x] 4.2 补充后端 SQL 校验测试，覆盖非法 JOIN、未批准字段、非法聚合、排序错误、只读 AST 校验失败和执行前预检失败场景
- [x] 4.3 补充后端结果校验测试，覆盖补问优先、关键指标回算失败、结果不一致拒答和详细流式输出场景
- [x] 4.4 更新 `frontend/tests/e2e/analysis-workbench.e2e-spec.ts`，覆盖结果优先布局、流式输出细化展示、常用查询/最近查询近输入区和域外提示场景
- [x] 4.5 对照一期原型与 UI 规范做手工回归，确认固定一级分区未被破坏，但页面主次、流式输出和查询资产位置已按新要求调整
