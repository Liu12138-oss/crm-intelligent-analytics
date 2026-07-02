import type {
  AnalysisDepth,
  AnalysisFacetProfile,
  AnalysisFocus,
  AnalysisOutputPreference,
  AnalysisReportSectionType,
  AnalysisTaskPurpose,
  ChannelType,
  QueryPlanResultKind,
} from '../../shared/types/domain';

export interface AnalysisTopicTaskTemplate {
  code: string;
  title: string;
  description: string;
  resultKind: QueryPlanResultKind;
  purpose: AnalysisTaskPurpose;
  reportSection: AnalysisReportSectionType;
  required: boolean;
  order: number;
  focus?: AnalysisFocus;
}

export interface AnalysisTopicReportProfile {
  facetProfile: AnalysisFacetProfile;
  label: string;
  recommendedDimensions: string[];
  recommendedSections: AnalysisReportSectionType[];
  validatedExamples: string[];
  taskTemplates: AnalysisTopicTaskTemplate[];
  channelTaskLimit: Record<
    ChannelType,
    Record<AnalysisDepth, number>
  >;
}

const TOPIC_REPORT_PROFILES: Record<AnalysisFacetProfile, AnalysisTopicReportProfile> = {
  'owner-performance-ranking': {
    facetProfile: 'owner-performance-ranking',
    label: '负责人经营主题',
    recommendedDimensions: ['销售负责人', '月份', '商机阶段', '区域'],
    recommendedSections: [
      'summary',
      'metric-strip',
      'trend',
      'distribution',
      'risk',
      'focus-list',
      'detail-table',
      'actions',
    ],
    validatedExamples: [
      '最近一年各销售负责人新增商机金额排名',
      '本季度销售负责人经营分析报告',
      '最近一年负责人业绩排名，请做详细分析总结',
    ],
    taskTemplates: [
      {
        code: 'owner-ranking',
        title: '新增商机金额负责人排名',
        description: '输出负责人经营主题的主排名结果。',
        resultKind: 'owner-ranking',
        purpose: 'primary-summary',
        reportSection: 'detail-table',
        required: true,
        order: 1,
        focus: 'ranking',
      },
      {
        code: 'owner-trend',
        title: '新增商机金额月度趋势',
        description: '补充负责人经营主题的时间趋势切片。',
        resultKind: 'time-trend',
        purpose: 'trend-series',
        reportSection: 'trend',
        required: false,
        order: 2,
        focus: 'trend',
      },
      {
        code: 'owner-stage-distribution',
        title: '新增商机金额阶段结构',
        description: '补充负责人经营主题的阶段结构观察。',
        resultKind: 'stage-distribution',
        purpose: 'distribution',
        reportSection: 'distribution',
        required: false,
        order: 3,
        focus: 'structure',
      },
      {
        code: 'owner-department-contribution',
        title: '新增商机金额部门贡献',
        description: '补充负责人经营主题的重点对象贡献观察。',
        resultKind: 'department-contribution',
        purpose: 'focus-contribution',
        reportSection: 'focus-list',
        required: false,
        order: 4,
        focus: 'customer-contribution',
      },
      {
        code: 'owner-risk-overview',
        title: '高风险商机观察',
        description: '补充负责人经营主题的高风险商机观察。',
        resultKind: 'risk-overview',
        purpose: 'risk-observation',
        reportSection: 'risk',
        required: false,
        order: 5,
        focus: 'risk',
      },
    ],
    channelTaskLimit: {
      'web-console': {
        snapshot: 2,
        standard: 5,
        'deep-dive': 5,
      },
      'wecom-bot': {
        snapshot: 2,
        standard: 4,
        'deep-dive': 4,
      },
    },
  },
  'region-operations': {
    facetProfile: 'region-operations',
    label: '区域经营主题',
    recommendedDimensions: ['区域', '月份', '商机阶段', '销售负责人'],
    recommendedSections: [
      'summary',
      'metric-strip',
      'trend',
      'distribution',
      'risk',
      'detail-table',
      'actions',
    ],
    validatedExamples: [
      '本季度各区域经营情况',
      '最近半年华东区域经营分析',
    ],
    taskTemplates: [
      {
        code: 'region-contribution',
        title: '区域经营贡献',
        description: '输出区域经营主题的主结构切片。',
        resultKind: 'department-contribution',
        purpose: 'primary-summary',
        reportSection: 'detail-table',
        required: true,
        order: 1,
        focus: 'region',
      },
      {
        code: 'region-trend',
        title: '区域经营趋势',
        description: '补充区域经营趋势观察。',
        resultKind: 'time-trend',
        purpose: 'trend-series',
        reportSection: 'trend',
        required: false,
        order: 2,
        focus: 'trend',
      },
      {
        code: 'region-risk',
        title: '区域经营风险观察',
        description: '补充区域经营风险摘要。',
        resultKind: 'risk-overview',
        purpose: 'risk-observation',
        reportSection: 'risk',
        required: false,
        order: 3,
        focus: 'risk',
      },
    ],
    channelTaskLimit: {
      'web-console': {
        snapshot: 1,
        standard: 3,
        'deep-dive': 3,
      },
      'wecom-bot': {
        snapshot: 1,
        standard: 2,
        'deep-dive': 2,
      },
    },
  },
  'customer-operations': {
    facetProfile: 'customer-operations',
    label: '客户经营主题',
    recommendedDimensions: ['客户分类', '月份', '销售负责人'],
    recommendedSections: [
      'summary',
      'metric-strip',
      'distribution',
      'trend',
      'focus-list',
      'detail-table',
      'actions',
    ],
    validatedExamples: [
      '最近三个月重点客户经营分析',
      '本月客户经营总结',
    ],
    taskTemplates: [
      {
        code: 'customer-category',
        title: '客户经营结构',
        description: '输出客户经营主题的主结构切片。',
        resultKind: 'category-distribution',
        purpose: 'primary-summary',
        reportSection: 'detail-table',
        required: true,
        order: 1,
      },
      {
        code: 'customer-trend',
        title: '客户经营趋势',
        description: '补充客户经营趋势观察。',
        resultKind: 'time-trend',
        purpose: 'trend-series',
        reportSection: 'trend',
        required: false,
        order: 2,
        focus: 'trend',
      },
    ],
    channelTaskLimit: {
      'web-console': {
        snapshot: 1,
        standard: 2,
        'deep-dive': 2,
      },
      'wecom-bot': {
        snapshot: 1,
        standard: 2,
        'deep-dive': 2,
      },
    },
  },
  'opportunity-risk': {
    facetProfile: 'opportunity-risk',
    label: '商机风险主题',
    recommendedDimensions: ['销售负责人', '商机阶段', '区域'],
    recommendedSections: [
      'summary',
      'metric-strip',
      'risk',
      'trend',
      'detail-table',
      'actions',
    ],
    validatedExamples: [
      '最近三个月有哪些高风险商机',
      '本季度商机风险总结',
    ],
    taskTemplates: [
      {
        code: 'opportunity-risk',
        title: '高风险商机观察',
        description: '输出商机风险主题的主风险切片。',
        resultKind: 'risk-overview',
        purpose: 'primary-summary',
        reportSection: 'risk',
        required: true,
        order: 1,
        focus: 'risk',
      },
      {
        code: 'opportunity-risk-trend',
        title: '高风险商机趋势',
        description: '补充风险趋势观察。',
        resultKind: 'time-trend',
        purpose: 'trend-series',
        reportSection: 'trend',
        required: false,
        order: 2,
        focus: 'trend',
      },
    ],
    channelTaskLimit: {
      'web-console': {
        snapshot: 1,
        standard: 2,
        'deep-dive': 2,
      },
      'wecom-bot': {
        snapshot: 1,
        standard: 2,
        'deep-dive': 2,
      },
    },
  },
  'lead-funnel': {
    facetProfile: 'lead-funnel',
    label: '线索漏斗主题',
    recommendedDimensions: ['商机阶段', '月份', '区域'],
    recommendedSections: [
      'summary',
      'metric-strip',
      'distribution',
      'trend',
      'detail-table',
      'actions',
    ],
    validatedExamples: [
      '本季度线索漏斗分析',
      '最近三个月线索转化情况',
    ],
    taskTemplates: [
      {
        code: 'lead-funnel-distribution',
        title: '线索漏斗结构',
        description: '输出线索漏斗主题的主结构切片。',
        resultKind: 'stage-distribution',
        purpose: 'primary-summary',
        reportSection: 'detail-table',
        required: true,
        order: 1,
      },
      {
        code: 'lead-funnel-trend',
        title: '线索漏斗趋势',
        description: '补充线索漏斗趋势观察。',
        resultKind: 'time-trend',
        purpose: 'trend-series',
        reportSection: 'trend',
        required: false,
        order: 2,
        focus: 'trend',
      },
    ],
    channelTaskLimit: {
      'web-console': {
        snapshot: 1,
        standard: 2,
        'deep-dive': 2,
      },
      'wecom-bot': {
        snapshot: 1,
        standard: 2,
        'deep-dive': 2,
      },
    },
  },
  'generic-analysis': {
    facetProfile: 'generic-analysis',
    label: '通用问数主题',
    recommendedDimensions: ['销售负责人', '月份'],
    recommendedSections: ['summary', 'metric-strip', 'detail-table'],
    validatedExamples: ['本月新增商机金额是多少'],
    taskTemplates: [
      {
        code: 'generic-owner-ranking',
        title: '经营指标结果',
        description: '输出通用问数主题的最小可交付结果。',
        resultKind: 'owner-ranking',
        purpose: 'primary-summary',
        reportSection: 'detail-table',
        required: true,
        order: 1,
      },
    ],
    channelTaskLimit: {
      'web-console': {
        snapshot: 1,
        standard: 1,
        'deep-dive': 1,
      },
      'wecom-bot': {
        snapshot: 1,
        standard: 1,
        'deep-dive': 1,
      },
    },
  },
};

function uniqueFocus(items: AnalysisFocus[]): AnalysisFocus[] {
  return [...new Set(items)];
}

function uniqueOutputPreference(items: AnalysisOutputPreference[]): AnalysisOutputPreference[] {
  return [...new Set(items)];
}

export function getAnalysisTopicReportProfile(
  facetProfile: AnalysisFacetProfile | undefined,
): AnalysisTopicReportProfile | undefined {
  if (!facetProfile) {
    return undefined;
  }

  return TOPIC_REPORT_PROFILES[facetProfile];
}

export function listAnalysisTopicReportProfiles(): AnalysisTopicReportProfile[] {
  return Object.values(TOPIC_REPORT_PROFILES);
}

export function inferAnalysisFacetProfile(questionText: string): AnalysisFacetProfile {
  if (/(高风险|风险商机|风险总结|风险观察)/u.test(questionText)) {
    return 'opportunity-risk';
  }

  if (/(线索|漏斗|转化漏斗)/u.test(questionText)) {
    return 'lead-funnel';
  }

  if (/(客户经营|客户分析|重点客户|战略客户|客户贡献)/u.test(questionText)) {
    return 'customer-operations';
  }

  if (/(区域经营|区域分析|大区经营|团队经营)/u.test(questionText)) {
    return 'region-operations';
  }

  if (/(负责人|销售负责人|业绩排名|经营分析|经营总结|详细分析总结|作战建议|经营报告)/u.test(questionText)) {
    return 'owner-performance-ranking';
  }

  return 'generic-analysis';
}

export function inferAnalysisDepth(questionText: string): AnalysisDepth {
  if (/(详细分析|详细总结|分析报告|经营总结|作战建议|风险总结|全面展开|详细报告)/u.test(questionText)) {
    return 'deep-dive';
  }

  if (/(高风险|风险商机|风险观察|风险分析|有哪些风险)/u.test(questionText)) {
    return 'standard';
  }

  if (/(分析一下|经营分析|经营情况|经营概览|总结|报告|情况|态势)/u.test(questionText)) {
    return 'standard';
  }

  return 'snapshot';
}

export function inferAnalysisFocus(questionText: string): AnalysisFocus[] {
  const focus: AnalysisFocus[] = [];
  if (/(排名|排行|领先|top\s*\d+|前\s*(三|3|五|5|十|10|二|两|2|四|4|六|6|七|7|八|8|九|9))/iu.test(questionText)) {
    focus.push('ranking');
  }
  if (/(趋势|走势|按月|逐月|波动)/u.test(questionText)) {
    focus.push('trend');
  }
  if (/(风险|高风险|预警)/u.test(questionText)) {
    focus.push('risk');
  }
  if (/(区域|大区|团队|部门)/u.test(questionText)) {
    focus.push('region');
  }
  if (/(客户贡献|重点客户|战略客户|重点对象)/u.test(questionText)) {
    focus.push('customer-contribution');
  }
  if (/(结构|分布|阶段|漏斗|集中度|占比|等级|级别|状态)/u.test(questionText)) {
    focus.push('structure');
  }
  if (/(明细|详情|清单|列表|逐条|每条|全部数据|完整数据)/u.test(questionText)) {
    focus.push('detail');
  }
  if (/(摘要|总结|建议|报告|看板|经营分析)/u.test(questionText)) {
    focus.push('summary');
  }

  return uniqueFocus(focus);
}

/**
 * 从自然语言中解析用户希望的结果呈现方式。
 *
 * 参数说明：
 * - `questionText`：用户原始问题或规范化问题。
 * 返回值说明：返回受控展示偏好枚举，不直接影响取数字段和权限。
 * 调用注意事项：企微图片已下线为主交付形态，因此即使命中“图”，也只表达图表区块偏好，不触发发图片。
 */
export function inferAnalysisOutputPreference(questionText: string): AnalysisOutputPreference[] {
  const preferences: AnalysisOutputPreference[] = [];
  if (/(摘要|总结|建议|文字|说明|解读)/u.test(questionText)) {
    preferences.push('text_summary');
  }
  if (/(表格|明细|详情|清单|列表|逐条|每条)/u.test(questionText)) {
    preferences.push('table');
  }
  if (/(图表|图形|趋势图|柱状图|折线图|饼图|看板|可视化)/u.test(questionText)) {
    preferences.push('chart');
  }
  if (/(HTML|网页|页面|链接|完整报告|报告|看板)/iu.test(questionText)) {
    preferences.push('html_report');
  }
  if (/(导出|下载|Excel|xlsx|文件)/iu.test(questionText)) {
    preferences.push('export_file');
  }
  if (/(汇总分析|经营分析|经营报告|分析报告|看板)/u.test(questionText)) {
    preferences.push('text_summary', 'table', 'chart');
  }

  return uniqueOutputPreference(preferences);
}

export function resolveAnalysisOutputPreference(
  questionText: string,
  explicitPreference?: AnalysisOutputPreference[],
): AnalysisOutputPreference[] {
  const normalizedExplicitPreference =
    explicitPreference?.filter((item): item is AnalysisOutputPreference =>
      [
        'text_summary',
        'table',
        'chart',
        'wecom_image',
        'html_report',
        'export_file',
      ].includes(item),
    ) ?? [];
  const inferredPreference = inferAnalysisOutputPreference(questionText);

  return uniqueOutputPreference([...normalizedExplicitPreference, ...inferredPreference]);
}

export function resolveAnalysisFocus(
  questionText: string,
  explicitFocus?: AnalysisFocus[],
): AnalysisFocus[] {
  if (explicitFocus && explicitFocus.length > 0) {
    return uniqueFocus(explicitFocus);
  }

  return inferAnalysisFocus(questionText);
}

export function resolveTopicTaskTemplates(params: {
  facetProfile: AnalysisFacetProfile;
  analysisDepth: AnalysisDepth;
  analysisFocus: AnalysisFocus[];
  channel: ChannelType;
}): AnalysisTopicTaskTemplate[] {
  const profile = getAnalysisTopicReportProfile(params.facetProfile);
  if (!profile) {
    return [];
  }

  const taskLimit = profile.channelTaskLimit[params.channel][params.analysisDepth];
  const requiredTasks = profile.taskTemplates
    .filter((item) => item.required)
    .sort((left, right) => left.order - right.order);
  const optionalTasks = profile.taskTemplates
    .filter((item) => !item.required)
    .sort((left, right) => left.order - right.order);

  if (params.analysisDepth === 'snapshot') {
    const explicitlyRequestedTasks = optionalTasks.filter(
      (item) => item.focus && params.analysisFocus.includes(item.focus),
    );
    return [...requiredTasks, ...explicitlyRequestedTasks].slice(0, taskLimit);
  }

  return [...requiredTasks, ...optionalTasks].slice(0, taskLimit);
}
