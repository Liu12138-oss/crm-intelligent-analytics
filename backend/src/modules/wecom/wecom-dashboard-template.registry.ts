/**
 * 企微 CRM 看板展示模板注册表。
 *
 * 设计目的：
 * - 集中维护 14 类企微动态看板卡片的识别规则、标题和指标优先级。
 * - 避免模板规则散落在 `WecomBotService` 中，导致卡片展示和正文分析再次分叉。
 * - P0 阶段先服务模板卡片，P1 阶段继续复用同一注册表渲染 Markdown 正文。
 */

/**
 * 企微看板展示模板编码。
 */
export type WecomDashboardTemplateCode =
  | 'BUSINESS_OVERVIEW'
  | 'FUNNEL_DIAGNOSIS'
  | 'CHANNEL_RANKING'
  | 'REGION_COMPARISON'
  | 'CHANNEL_PROFILE'
  | 'REGISTRATION_PROTECTION'
  | 'OPPORTUNITY_RISK'
  | 'QUOTE_TO_ORDER'
  | 'RENEWAL_SUCCESS'
  | 'PRODUCT_SOLUTION'
  | 'SERVICE_ECOSYSTEM'
  | 'DISTRIBUTION_HEALTH'
  | 'CADENCE_REPORT'
  | 'DATA_SCOPE_QUALITY';

/**
 * 企微看板展示模板定义。
 */
export interface WecomDashboardTemplateDefinition {
  /** 模板编码，用于测试、审计和后续正文渲染 */
  code: WecomDashboardTemplateCode;
  /** 展示模板名称，对应企微正文中的【展示模板】 */
  displayName: string;
  /** 企微模板卡片主标题 */
  cardTitle: string;
  /** 用户问题识别规则 */
  questionPatterns: RegExp[];
  /** 报告标题兜底识别规则 */
  reportTitlePatterns: RegExp[];
  /** 主指标优先级，命中后放入 emphasis_content */
  primaryMetricPriority: RegExp[];
  /** 辅助指标优先级，命中后放入 horizontal_content_list */
  secondaryMetricPriority: RegExp[];
  /** 指标不足时的业务兜底指标，避免企微卡片出现空白 */
  fallbackSecondaryMetrics: Array<{ label: string; value: string }>;
  /** P0 验收重点 */
  acceptancePoints: string[];
}

/**
 * 14 类企微动态看板展示模板。
 *
 * 调用注意事项：
 * - 顺序只用于同分兜底；模板解析服务会先按命中分数排序。
 * - 正则只承担展示模板选择，不扩大查询范围，不替代 AI 语义理解和权限判断。
 */
export const WECOM_DASHBOARD_TEMPLATE_DEFINITIONS: WecomDashboardTemplateDefinition[] = [
  {
    code: 'BUSINESS_OVERVIEW',
    displayName: '经营总览看板卡',
    cardTitle: '经营总览看板',
    questionPatterns: [
      /经营总览|整体经营|发展运营|运营情况|整体情况|全国渠道|渠道商发展|当前经营|经营情况/u,
    ],
    reportTitlePatterns: [/经营|运营|发展|总览|看板/u],
    primaryMetricPriority: [/商机金额|渠道商总数|合作渠道数|综合经营|下单总额|订单金额/u],
    secondaryMetricPriority: [/渠道|活跃|报备|商机|报价|订单|覆盖|风险/u],
    fallbackSecondaryMetrics: [
      { label: '分析状态', value: '已生成' },
      { label: '完整看板', value: '可查看' },
      { label: '建议追问', value: '可继续' },
    ],
    acceptancePoints: ['先给经营判断', '展示核心指标', '订单不足时说明替代口径'],
  },
  {
    code: 'FUNNEL_DIAGNOSIS',
    displayName: '业务漏斗诊断卡',
    cardTitle: '业务漏斗诊断',
    questionPatterns: [/漏斗|转化|报备到订单|商机到报价|报价到订单|断点|掉点|转化率/u],
    reportTitlePatterns: [/漏斗|转化|断点/u],
    primaryMetricPriority: [/最大断点|关键转化率|报价转订单率|商机转报价率|报备转商机率/u],
    secondaryMetricPriority: [/客户报备/u, /^商机\s/u, /^报价\s/u, /^订单\s/u, /断点/u, /转.*率/u, /报备数|商机数|报价数|订单数/u],
    fallbackSecondaryMetrics: [
      { label: '漏斗阶段', value: '四段' },
      { label: '分析状态', value: '已生成' },
      { label: '建议动作', value: '看断点' },
    ],
    acceptancePoints: ['必须展示四段漏斗', '必须标注最大断点', '订单为 0 时不能解释为成交'],
  },
  {
    code: 'CHANNEL_RANKING',
    displayName: '渠道贡献排行卡',
    cardTitle: '渠道贡献排行',
    questionPatterns: [/排行|排名|贡献最大|前十|TOP\s*10|top\s*10|TOP|top|集中度|头部渠道|长尾/u],
    reportTitlePatterns: [/排行|排名|贡献|集中度/u],
    primaryMetricPriority: [/TOP3占比|TOP3|头部渠道金额|渠道集中度|TOP1/u],
    secondaryMetricPriority: [/TOP1|TOP3|商机金额|报价金额|订单金额|长尾|集中度/u],
    fallbackSecondaryMetrics: [
      { label: '排序口径', value: '已标注' },
      { label: '榜单范围', value: 'TOP 明细' },
      { label: '运营动作', value: '头部长尾' },
    ],
    acceptancePoints: ['说明排序口径', '区分商机报价订单', '输出头部维护和长尾激活动作'],
  },
  {
    code: 'REGION_COMPARISON',
    displayName: '区域经营对比卡',
    cardTitle: '区域经营对比',
    questionPatterns: [/各区域|区域对比|区域经营|地区|大区|省份|覆盖省份|空白区域|山东区|北京区|华东|华北|华南|华中|西南|西北|东北/u],
    reportTitlePatterns: [/区域|大区|省份|覆盖/u],
    primaryMetricPriority: [/领先区域|异常区域|覆盖省份|区域数/u],
    secondaryMetricPriority: [/覆盖省份|活跃渠道|商机金额|报价金额|订单金额|报备|区域/u],
    fallbackSecondaryMetrics: [
      { label: '区域分层', value: '已生成' },
      { label: '异常区域', value: '待复核' },
      { label: '负责人', value: '可下钻' },
    ],
    acceptancePoints: ['展示区域归集口径', '指出强弱区域', '支持区域负责人下钻'],
  },
  {
    code: 'CHANNEL_PROFILE',
    displayName: '渠道画像诊断卡',
    cardTitle: '渠道画像诊断',
    questionPatterns: [/渠道画像|生命周期|活跃渠道|沉睡|休眠|激活|淘汰|高潜低转化|渠道分层/u],
    reportTitlePatterns: [/画像|生命周期|活跃|沉睡|激活/u],
    primaryMetricPriority: [/活跃渠道|沉睡渠道|待激活|高潜低转化/u],
    secondaryMetricPriority: [/新增|活跃|沉睡|待激活|高潜低转化|最近业务/u],
    fallbackSecondaryMetrics: [
      { label: '渠道分层', value: '已生成' },
      { label: '代表渠道', value: '可查看' },
      { label: '激活动作', value: '可执行' },
    ],
    acceptancePoints: ['展示渠道分层', '给出代表渠道', '激活动作落到负责人和下一步'],
  },
  {
    code: 'REGISTRATION_PROTECTION',
    displayName: '客户报备与保护期卡',
    cardTitle: '报备保护与渠道冲突',
    questionPatterns: [/报备保护|保护期|快到期|即将到期|重复报备|客户归属|归属冲突|渠道冲突|待审批|驳回/u],
    reportTitlePatterns: [/报备|保护期|冲突|归属/u],
    primaryMetricPriority: [/即将到期|重复报备|归属风险/u],
    secondaryMetricPriority: [/即将到期|重复报备|待审批|驳回|归属风险|报备/u],
    fallbackSecondaryMetrics: [
      { label: '到期窗口', value: '已检查' },
      { label: '冲突清单', value: '可查看' },
      { label: '处理顺序', value: '已建议' },
    ],
    acceptancePoints: ['展示到期窗口', '标注冲突对象', '给出处理顺序'],
  },
  {
    code: 'OPPORTUNITY_RISK',
    displayName: '商机风险清单卡',
    cardTitle: '商机风险清单',
    questionPatterns: [/商机风险|未报价商机|预计签约|推进慢|停滞|高金额风险|风险商机|商机清单/u],
    reportTitlePatterns: [/商机|风险|停滞|预计签约/u],
    primaryMetricPriority: [/高风险商机|风险金额|未报价数|停滞数/u],
    secondaryMetricPriority: [/未报价|停滞|30 天|30天|预计签约|负责人|商机金额/u],
    fallbackSecondaryMetrics: [
      { label: '风险原因', value: '已列出' },
      { label: '优先级', value: '已排序' },
      { label: '负责人', value: '需跟进' },
    ],
    acceptancePoints: ['列出风险原因', '按优先级排序', '给出负责人动作'],
  },
  {
    code: 'QUOTE_TO_ORDER',
    displayName: '报价与订单转化卡',
    cardTitle: '报价转订单预测',
    questionPatterns: [/报价转订单|报价.*转单|转订单|最可能转订单|报价优先级|本周.*报价|报价.*推进|超期报价/u],
    reportTitlePatterns: [/报价|订单转化|转订单|预测/u],
    primaryMetricPriority: [/高优先级报价|报价金额|本周预计|平均评分/u],
    secondaryMetricPriority: [/平均评分|超期报价|本周预计|负责人|报价金额|订单/u],
    fallbackSecondaryMetrics: [
      { label: '预测口径', value: '已声明' },
      { label: '优先级', value: '已生成' },
      { label: '下一动作', value: '需确认' },
    ],
    acceptancePoints: ['声明预测口径', '不能承诺一定成交', '输出逐条推进动作'],
  },
  {
    code: 'RENEWAL_SUCCESS',
    displayName: '续费与客户成功卡',
    cardTitle: '续费与客户成功',
    questionPatterns: [/续费|客户成功|存量客户|快到期客户|到期客户|续费风险|续费报价/u],
    reportTitlePatterns: [/续费|客户成功|存量/u],
    primaryMetricPriority: [/30 天到期|30天到期|预计续费金额|高风险客户/u],
    secondaryMetricPriority: [/高风险客户|已报价续费|已续费订单|负责人|到期客户|续费金额/u],
    fallbackSecondaryMetrics: [
      { label: '到期窗口', value: '已生成' },
      { label: '风险客户', value: '可查看' },
      { label: '回访动作', value: '已建议' },
    ],
    acceptancePoints: ['按到期窗口展示', '标明风险原因', '动作落到回访和报价'],
  },
  {
    code: 'PRODUCT_SOLUTION',
    displayName: '产品与解决方案结构卡',
    cardTitle: '产品与解决方案结构',
    questionPatterns: [/产品线|解决方案|产品结构|终端安全|方案推进|高潜方案|行业场景/u],
    reportTitlePatterns: [/产品|解决方案|行业场景/u],
    primaryMetricPriority: [/高潜产品线|商机金额|产品线数/u],
    secondaryMetricPriority: [/产品线数|商机金额|报价金额|订单金额|转化率|行业/u],
    fallbackSecondaryMetrics: [
      { label: '产品结构', value: '已生成' },
      { label: '高潜方案', value: '可查看' },
      { label: '转化断点', value: '已识别' },
    ],
    acceptancePoints: ['区分产品线口径', '展示商机到报价转化', '给出高潜和薄弱方案'],
  },
  {
    code: 'SERVICE_ECOSYSTEM',
    displayName: '技术服务商生态卡',
    cardTitle: '技术服务商生态',
    questionPatterns: [/技术服务商|服务商生态|签约技术|提名技术|交付生态|服务能力|转签约/u],
    reportTitlePatterns: [/技术服务商|服务商生态|交付生态/u],
    primaryMetricPriority: [/签约技术服务商|签约技术|候选数|提名/u],
    secondaryMetricPriority: [/签约|提名|未参与|覆盖区域|贡献金额|服务能力/u],
    fallbackSecondaryMetrics: [
      { label: '生态分层', value: '已生成' },
      { label: '覆盖缺口', value: '可查看' },
      { label: '转签约', value: '有建议' },
    ],
    acceptancePoints: ['展示生态分层', '指出覆盖缺口', '给出转签约候选'],
  },
  {
    code: 'DISTRIBUTION_HEALTH',
    displayName: '分销层级健康卡',
    cardTitle: '分销层级健康',
    questionPatterns: [/一级渠道|二级渠道|分销层级|上级渠道|层级协同|订单归属|待确认订单|跨区协同/u],
    reportTitlePatterns: [/分销|层级|上级渠道|订单归属/u],
    primaryMetricPriority: [/异常归属|待确认订单|跨区协同/u],
    secondaryMetricPriority: [/一级渠道|二级渠道|跨区协同|待确认订单|异常归属/u],
    fallbackSecondaryMetrics: [
      { label: '层级链路', value: '已生成' },
      { label: '异常类型', value: '已标注' },
      { label: '处理建议', value: '可执行' },
    ],
    acceptancePoints: ['展示层级链路', '标注异常类型', '给出归属处理动作'],
  },
  {
    code: 'CADENCE_REPORT',
    displayName: '经营节奏日报/周报/月报卡',
    cardTitle: '经营节奏报告',
    questionPatterns: [/经营复盘|周报|月报|日报|晨会|会议摘要|经营会议|本周经营|本月经营|下期动作/u],
    reportTitlePatterns: [/复盘|周报|月报|日报|晨会|会议/u],
    primaryMetricPriority: [/新增风险|完成待办|本期成交|本期推进/u],
    secondaryMetricPriority: [/本期新增|本期推进|本期成交|新增风险|完成待办|负责人/u],
    fallbackSecondaryMetrics: [
      { label: '会议摘要', value: '已生成' },
      { label: '风险待办', value: '可查看' },
      { label: '下步动作', value: '已明确' },
    ],
    acceptancePoints: ['能直接用于会议', '待办必须有负责人', '下期动作明确'],
  },
  {
    code: 'DATA_SCOPE_QUALITY',
    displayName: '数据质量与权限口径卡',
    cardTitle: '数据质量与权限口径',
    questionPatterns: [/权限口径|数据口径|权限影响|受.*权限|看不到|数据准|准不准|字段缺失|数据质量|可见范围|接口异常|分页完整|替代口径|越权/u],
    reportTitlePatterns: [/数据质量|权限|口径|字段|接口/u],
    primaryMetricPriority: [/字段完整率|接口成功率|可见范围|缺失字段/u],
    secondaryMetricPriority: [/可见范围|缺失字段|异常接口|替代口径|数据来源|权限/u],
    fallbackSecondaryMetrics: [
      { label: '可见范围', value: '当前权限' },
      { label: '替代口径', value: '已说明' },
      { label: '越权保护', value: '已启用' },
    ],
    acceptancePoints: ['说明看不到数据原因', '不能越权推断', '给出替代问题'],
  },
];

export const DEFAULT_WECOM_DASHBOARD_TEMPLATE = WECOM_DASHBOARD_TEMPLATE_DEFINITIONS[0];

/**
 * 根据模板编码查找模板定义。
 *
 * 参数说明：`code` 为 14 类模板编码。
 * 返回值说明：命中时返回模板定义，未命中时返回经营总览兜底模板。
 */
export function resolveWecomDashboardTemplateDefinition(
  code: WecomDashboardTemplateCode,
): WecomDashboardTemplateDefinition {
  return (
    WECOM_DASHBOARD_TEMPLATE_DEFINITIONS.find((template) => template.code === code) ??
    DEFAULT_WECOM_DASHBOARD_TEMPLATE
  );
}
