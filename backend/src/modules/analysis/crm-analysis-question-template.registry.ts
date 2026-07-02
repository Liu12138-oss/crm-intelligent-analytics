import type { CrmAnalysisPresentationTemplateType } from '../../shared/types/domain';

export type CrmAnalysisQuestionImplementationStatus =
  | '已接入模板路由，待真实企微截图验收'
  | '部分实现，需补查询执行器和真实企微截图'
  | '已纳入目录，需补外部字段或接口后验收';

export interface CrmAnalysisQuestionRange {
  start: number;
  end: number;
  label: string;
}

export interface CrmAnalysisQuestionTemplateRule {
  templateType: CrmAnalysisPresentationTemplateType;
  templateName: string;
  priority: 'P0' | 'P1' | 'P2';
  questionRanges: CrmAnalysisQuestionRange[];
  keywords: string[];
  dataSources: string[];
  replySections: string[];
  acceptanceFocus: string[];
  implementationStatus: CrmAnalysisQuestionImplementationStatus;
  evidenceDirectory: string;
}

export const CRM_ANALYSIS_QUESTION_TEMPLATE_RULES: CrmAnalysisQuestionTemplateRule[] = [
  {
    templateType: 'BUSINESS_OVERVIEW',
    templateName: '经营总览卡',
    priority: 'P0',
    questionRanges: [
      { start: 1, end: 10, label: '经营总览与业务健康度' },
      { start: 151, end: 160, label: '增长目标与经营抓手' },
      { start: 271, end: 280, label: '季度复盘与经营决策' },
      { start: 281, end: 290, label: '全局业务分析与渠道商整体汇总' },
    ],
    keywords: [
      '经营总览',
      '业务健康',
      '全平台',
      '核心指标',
      '经营指标',
      '经营看板',
      '同步增长',
      '整体汇总',
      '增长目标',
      '经营抓手',
      '季度复盘',
      '新增渠道质量',
      '有效业务动作',
      '管理动作',
      '投入多但产出低',
      '总量、金额和转化率',
      '经营指标一键下钻',
      '一键下钻',
      '具体区域、渠道、负责人、客户、商机和报价单',
      '商机来源结构',
      '主动运营',
      '偶然报备',
    ],
    dataSources: ['dashboard-stats', 'partners', 'registrations', 'opportunities', 'quotes', 'orders'],
    replySections: ['问题复述', '数据口径', '核心指标', '关键发现', '风险建议', '建议追问'],
    acceptanceFocus: ['必须展示报备、商机、报价、订单主链路', '必须说明权限范围和订单样本不足风险', '必须给出下一步经营动作'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/business-overview',
  },
  {
    templateType: 'FUNNEL_DIAGNOSIS',
    templateName: '业务漏斗诊断卡',
    priority: 'P0',
    questionRanges: [
      { start: 1, end: 10, label: '经营总览中的漏斗问题' },
      { start: 171, end: 180, label: '订单增量与成交转化' },
    ],
    keywords: ['漏斗', '转化率', '流失', '断点', '报备到商机', '商机到报价', '报价到订单', '成交转化'],
    dataSources: ['registrations', 'opportunities', 'quotes', 'orders'],
    replySections: ['问题复述', '数据口径', '漏斗总览', '阶段转化率', '最大断点', '优先动作'],
    acceptanceFocus: ['必须输出报备到商机到报价到订单四段', '必须标注最大流失节点', '无订单时必须按前置口径说明'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/funnel-diagnosis',
  },
  {
    templateType: 'REGION_COMPARISON',
    templateName: '区域经营对比卡',
    priority: 'P0',
    questionRanges: [
      { start: 11, end: 20, label: '区域与大区经营发展' },
      { start: 261, end: 270, label: '月报中的区域经营问题' },
    ],
    keywords: ['区域', '大区', '华东', '华南', '山东', '区域管理员', '覆盖省份', '区域打法', '区域贡献', '区域排名', '给区域排名', '目标完成率', '综合评分'],
    dataSources: ['partners', 'registrations', 'opportunities', 'quotes', 'orders', 'dashboard-stats'],
    replySections: ['问题复述', '数据口径', '区域分层', '重点区域', '异常区域', '管理建议'],
    acceptanceFocus: ['必须按当前权限裁剪区域', '必须识别高贡献和低活跃区域', '区域字段缺失时必须解释'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/region-comparison',
  },
  {
    templateType: 'CHANNEL_RANKING',
    templateName: '渠道贡献排行卡',
    priority: 'P0',
    questionRanges: [
      { start: 21, end: 30, label: '渠道贡献与渠道等级问题' },
      { start: 181, end: 190, label: '渠道发展与渠道运营问题' },
    ],
    keywords: ['渠道贡献', '渠道排名', '渠道排行', '排行', '排名', '前十', 'TOP', '高贡献渠道', '低贡献渠道', '合作级别', '高级别渠道', '渠道质量', '渠道发展策略', '活跃度', '升级', '降级', '过期未处理事项', '升级提醒', '渠道管理员、区管或超管'],
    dataSources: ['partners', 'registrations', 'opportunities', 'quotes', 'orders'],
    replySections: ['问题复述', '数据口径', '排行摘要', '渠道榜单', '集中度', '运营动作'],
    acceptanceFocus: ['必须按渠道商维度排行', '必须展示报备、商机、报价、订单至少三个指标', '不能把经营区块当渠道商排行'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/channel-ranking',
  },
  {
    templateType: 'CHANNEL_PROFILE',
    templateName: '渠道画像诊断卡',
    priority: 'P1',
    questionRanges: [
      { start: 21, end: 30, label: '渠道商画像与渠道发展' },
      { start: 181, end: 190, label: '渠道发展：招募、激活、升级、淘汰' },
    ],
    keywords: ['渠道画像', '沉睡渠道', '活跃渠道', '激活', '淘汰', '招募', '渠道池', '员工数量', '生命周期'],
    dataSources: ['partners', 'registrations', 'opportunities', 'quotes', 'orders', 'channel-visits'],
    replySections: ['问题复述', '数据口径', '渠道分层', '代表渠道', '风险渠道', '激活动作'],
    acceptanceFocus: ['必须给出活跃、沉睡、低贡献等分层', '必须给出可行动对象', '必须说明分层规则'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/channel-profile',
  },
  {
    templateType: 'DISTRIBUTION_HIERARCHY',
    templateName: '分销层级健康卡',
    priority: 'P1',
    questionRanges: [
      { start: 31, end: 40, label: '渠道分销层级与一级二级关系' },
      { start: 281, end: 290, label: '全局汇总中的分销层级问题' },
    ],
    keywords: ['一级渠道', '二级渠道', '分销', '上级', '层级', '归属', '一级确认', '二级'],
    dataSources: ['partners', 'registrations', 'opportunities', 'quotes', 'orders'],
    replySections: ['问题复述', '数据口径', '层级结构', '异常清单', '影响判断', '处理建议'],
    acceptanceFocus: ['必须区分一级、二级、无层级渠道', '必须识别订单归属或待确认风险', '层级字段缺失时必须说明'],
    implementationStatus: '已纳入目录，需补外部字段或接口后验收',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/distribution-hierarchy',
  },
  {
    templateType: 'TECH_SERVICE_ECOSYSTEM',
    templateName: '技术服务商生态卡',
    priority: 'P1',
    questionRanges: [
      { start: 41, end: 50, label: '技术服务商能力与交付生态' },
      { start: 271, end: 280, label: '季度复盘中的技术服务商问题' },
    ],
    keywords: ['技术服务商', '签约技术', '提名技术', '交付生态', '交付能力', '技术服务能力', '转签约'],
    dataSources: ['partners', 'opportunities', 'quotes', 'orders', 'channel-visits'],
    replySections: ['问题复述', '数据口径', '生态覆盖', '贡献对比', '能力风险', '发展建议'],
    acceptanceFocus: ['必须区分签约、提名、非技术服务商', '必须说明证书认证是否纳入口径', '必须给出区域覆盖风险'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/tech-service-ecosystem',
  },
  {
    templateType: 'REGISTRATION_PROTECTION',
    templateName: '客户报备与保护期卡',
    priority: 'P0',
    questionRanges: [
      { start: 51, end: 60, label: '客户报备与保护期' },
      { start: 191, end: 200, label: '经营节奏中的客户保护问题' },
    ],
    keywords: ['客户报备审批', '报备保护', '保护期', '待审批', '驳回', '重复报备', '到期客户报备', '客户保护', '客户报备保护期', '足够审计记录', '即将到期保护客户', '待审批报备', '待确认二级订单', '风险事项'],
    dataSources: ['registrations', 'customers', 'pending-approvals', 'notifications'],
    replySections: ['问题复述', '数据口径', '报备统计', '风险清单', '处理优先级', '处理建议'],
    acceptanceFocus: ['必须输出报备状态和保护期口径', '待审批和到期问题必须给对象清单', '重复报备必须说明冲突原因'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/registration-protection',
  },
  {
    templateType: 'OPPORTUNITY_RISK',
    templateName: '商机风险清单卡',
    priority: 'P0',
    questionRanges: [
      { start: 61, end: 70, label: '商机质量与销售推进' },
      { start: 161, end: 170, label: '商机增量与持续来源' },
    ],
    keywords: ['预计签约', '未报价', '没有报价', '商机停滞', '高金额商机', '风险商机', '推进慢', '赢率', '商机增量', '没有新增商机', '重点唤醒对象', '唤醒对象', '创建商机', '报备后', '说明原因', '管理规则', '预计 30 天内签约', '为什么还没报价', '责任人是谁', '管理层介入'],
    dataSources: ['opportunities', 'quotes', 'customers', 'partners', 'users'],
    replySections: ['问题复述', '数据口径', '核心风险', '商机清单', '负责人', '管理动作'],
    acceptanceFocus: ['必须能筛选预计签约未报价', '必须给出负责人和风险原因', '空结果也必须返回明确口径'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/opportunity-risk',
  },
  {
    templateType: 'QUOTE_ORDER_CONVERSION',
    templateName: '报价与订单转化卡',
    priority: 'P0',
    questionRanges: [
      { start: 71, end: 90, label: '报价、价格与订单管理' },
      { start: 171, end: 180, label: '订单增量：临门一脚与成交转化' },
      { start: 211, end: 220, label: '竞争与价格：如何赢而不是只降价' },
    ],
    keywords: ['报价', '报价单', '报价单被更新', '状态变更', '操作日志', '转订单', '成交', '有机会成交', '没人跟', '成交但没人跟', '对应负责人', '价格', '折扣', 'IPG', '临门一脚', '二级订单', '订单金额', '订单数量', '订单状态', '单笔金额', '平均周期', 'pending', 'completed', '下单', '竞争', '渠道任务清单', '跟进报价', '确认订单', '补齐商机字段'],
    dataSources: ['quotes', 'orders', 'opportunities', 'products', 'workload-rules'],
    replySections: ['问题复述', '数据口径', '转化指标', '待推进清单', '价格风险', '下一步动作'],
    acceptanceFocus: ['必须给出报价转订单规则评分兜底', '必须区分报价金额和真实订单金额', '价格问题必须说明字段或接口缺口'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/quote-order-conversion',
  },
  {
    templateType: 'PRODUCT_SOLUTION_STRUCTURE',
    templateName: '产品与解决方案结构卡',
    priority: 'P1',
    questionRanges: [
      { start: 91, end: 100, label: '产品目录、模块与实施工作量' },
      { start: 211, end: 220, label: '价格竞争中的产品结构问题' },
    ],
    keywords: ['产品', '模块', '实施工作量', '产品目录', '解决方案', '行业方案', '工作量', '功能', '报价项', '终端安全', '终端安全相关'],
    dataSources: ['product-tree', 'product-stats', 'products', 'quotes', 'orders', 'opportunities'],
    replySections: ['问题复述', '数据口径', '产品结构', '贡献分析', '价格与工作量风险', '优化建议'],
    acceptanceFocus: ['必须优先使用产品目录和产品统计接口', '缺少工作量规则时必须说明', '不能用泛化经营指标替代产品问题'],
    implementationStatus: '已纳入目录，需补外部字段或接口后验收',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/product-solution-structure',
  },
  {
    templateType: 'OPERATING_CADENCE',
    templateName: '经营节奏日报/周报/月报卡',
    priority: 'P1',
    questionRanges: [
      { start: 101, end: 110, label: '渠道运营目标与拜访活动' },
      { start: 191, end: 210, label: '经营节奏与定期汇报' },
      { start: 231, end: 280, label: '日报、周报、月报与季度复盘' },
    ],
    keywords: ['日报', '周报', '月报', '晨会', '周会', '经营会', '复盘', '拜访', '目标', '今天是否', '本周', '本月', '明天', '事项', '责任人', '订单状态异常', '一级未确认', '发货', '完成状态未更新'],
    dataSources: ['dashboard-stats', 'channel-targets', 'channel-visits', 'notifications', 'opportunities', 'quotes', 'orders'],
    replySections: ['问题复述', '数据口径', '会议摘要', '目标进度', '风险待办', '下步动作'],
    acceptanceFocus: ['必须能生成管理汇报四段式摘要', '目标和拜访问题必须说明数据源', '主动推送未启用时必须说明边界'],
    implementationStatus: '已纳入目录，需补外部字段或接口后验收',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/operating-cadence',
  },
  {
    templateType: 'OWNER_ORG_COLLABORATION',
    templateName: '人员组织协同卡',
    priority: 'P1',
    questionRanges: [
      { start: 111, end: 120, label: '人员、负责人和组织协同' },
      { start: 251, end: 260, label: '周报中的团队协同问题' },
    ],
    keywords: ['人员', '负责人', '责任人', '组织', '团队', '协同', '销售负责人', '区域管理员', '员工', '创建人', '指派', '职责', '响应时效', '业务链路中的职责', '区管审批', '管理员分配', '员工跟进', '本渠道所有员工', '只看到本人相关数据', '渠道员工商机创建能力', '商机创建能力', '经验复制'],
    dataSources: ['users', 'opportunities', 'registrations', 'quotes', 'orders', 'audit-logs'],
    replySections: ['问题复述', '数据口径', '人员绩效', '协同断点', '重点负责人', '管理动作'],
    acceptanceFocus: ['必须按权限展示负责人或团队', '不得把负责人姓名识别成商机条件', '必须说明人员绩效口径'],
    implementationStatus: '部分实现，需补查询执行器和真实企微截图',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/owner-org-collaboration',
  },
  {
    templateType: 'ALERT_AUDIT_GOVERNANCE',
    templateName: '通知预警与审计治理卡',
    priority: 'P1',
    questionRanges: [
      { start: 121, end: 140, label: '通知中心、提醒、审计、数据质量与合规治理' },
      { start: 221, end: 230, label: '系统作为管理工具还缺什么' },
    ],
    keywords: ['通知', '提醒', '提醒折叠', '最高风险事项', '频繁忽略', '提醒过多', '价值不足', '责任人不清晰', '预警', '审计', '日志', '操作人', '操作时间', '变更前', '变更后', '关键操作', '合规', '数据质量', '字段缺失', '管理工具', '管理闭环', '推动业务动作', '自动发现', '健康度打分', '解释分数', '区管介入', '治理', '商机阶段变更', '及时记录', '真实推进过程'],
    dataSources: ['notifications', 'audit-logs', 'pending-approvals', 'dashboard-stats', 'diagnostics'],
    replySections: ['问题复述', '数据口径', '预警对象', '审计证据', '治理风险', '处理建议'],
    acceptanceFocus: ['必须区分业务风险和系统治理风险', '审计日志只能按权限展示', '字段缺失必须输出替代口径'],
    implementationStatus: '已纳入目录，需补外部字段或接口后验收',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/alert-audit-governance',
  },
  {
    templateType: 'DATA_SCOPE_QUALITY',
    templateName: '数据质量与权限口径卡',
    priority: 'P0',
    questionRanges: [
      { start: 131, end: 150, label: '审计数据质量、OpenAPI 与 AI Agent' },
      { start: 221, end: 230, label: '系统管理闭环与能力缺口' },
      { start: 291, end: 300, label: 'AI Agent 自动生成汇报时应追问的问题' },
    ],
    keywords: [
      '权限',
      '口径',
      '数据口径',
      '角色可见',
      '可见的数据',
      '全平台数据',
      '全国',
      '看不到',
      '不能看',
      '字段',
      '数据源',
      'OpenAPI',
      'AI Agent',
      '可信度',
      '下钻',
      '指标变化',
      '正常波动',
      '重点标红',
      '人工介入',
      '建议动作',
      '数据可见性',
      '看不到客户',
      '看不到客户或商机',
      '按角色视角',
      '权限裁剪',
      '渠道管理员',
      '渠道员工',
      '超管',
      '区管',
    ],
    dataSources: ['identity', 'diagnostics', 'analytics', 'audit-logs', 'dashboard-stats'],
    replySections: ['问题复述', '数据口径', '可见范围', '限制说明', '可信度', '替代问题'],
    acceptanceFocus: ['必须说明当前用户权限范围', '必须说明数据源和字段缺口', '必须拒绝越权或无法验证事实'],
    implementationStatus: '已接入模板路由，待真实企微截图验收',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/data-scope-quality',
  },
  {
    templateType: 'CUSTOMER_SUCCESS_RENEWAL',
    templateName: '客户与市场成功卡',
    priority: 'P2',
    questionRanges: [
      { start: 201, end: 210, label: '客户与市场：是否找到了正确客户' },
    ],
    keywords: ['客户', '市场', '重点客户', '行业', '客户质量', '质量不高', '客户重复', '信息不完整', '报备通过率', '即将到期保护客户', '即将签约商机', '管理者介入', '续费', '存量', '客户成功', '生命周期'],
    dataSources: ['customers', 'registrations', 'opportunities', 'quotes', 'orders'],
    replySections: ['问题复述', '数据口径', '客户结构', '市场质量', '风险客户', '运营建议'],
    acceptanceFocus: ['必须区分新增客户和存量客户', '续费字段不足时必须说明', '必须输出客户质量判断依据'],
    implementationStatus: '已纳入目录，需补外部字段或接口后验收',
    evidenceDirectory: 'docs/testing/300-question-acceptance-screenshots/20260630/customer-success-renewal',
  },
];

export function resolveCrmAnalysisQuestionTemplateRuleByQuestionNumber(
  questionNumber: number,
): CrmAnalysisQuestionTemplateRule | undefined {
  return CRM_ANALYSIS_QUESTION_TEMPLATE_RULES.find((rule) =>
    rule.questionRanges.some((range) =>
      questionNumber >= range.start && questionNumber <= range.end,
    ),
  );
}

export function resolveCrmAnalysisQuestionTemplateRuleByText(
  questionText: string | undefined,
): CrmAnalysisQuestionTemplateRule | undefined {
  const normalizedText = normalizeQuestionText(questionText);
  if (!normalizedText) {
    return undefined;
  }

  return CRM_ANALYSIS_QUESTION_TEMPLATE_RULES
    .map((rule) => ({
      rule,
      score: scoreCrmAnalysisQuestionTemplateRule(rule, normalizedText),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.rule;
}

export function scoreCrmAnalysisQuestionTemplateRule(
  rule: CrmAnalysisQuestionTemplateRule,
  normalizedQuestionText: string,
): number {
  const keywordScore = rule.keywords.reduce(
    (score, keyword) => score + (normalizedQuestionText.includes(keyword.toLowerCase()) ? 5 : 0),
    0,
  );
  const priorityScore = rule.priority === 'P0' ? 3 : rule.priority === 'P1' ? 2 : 1;
  return keywordScore > 0 ? keywordScore + priorityScore : 0;
}

export function buildCrmAnalysisQuestionEvidencePath(
  rule: CrmAnalysisQuestionTemplateRule,
  questionNumber: number,
): string {
  const paddedNumber = String(questionNumber).padStart(3, '0');
  return `${rule.evidenceDirectory}/Q${paddedNumber}.png`;
}

function normalizeQuestionText(questionText: string | undefined): string {
  return (questionText ?? '').trim().toLowerCase();
}
