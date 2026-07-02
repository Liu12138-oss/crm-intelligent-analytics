import { Injectable } from '@nestjs/common';
import type {
  AnalysisResultRecord,
  CrmAnalysisPresentationTemplate,
  CrmAnalysisPresentationTemplateType,
} from '../../shared/types/domain';
import {
  resolveCrmAnalysisQuestionTemplateRuleByText,
  type CrmAnalysisQuestionTemplateRule,
} from './crm-analysis-question-template.registry';

interface PresentationTemplateDefinition {
  templateType: CrmAnalysisPresentationTemplateType;
  templateName: string;
  priority: CrmAnalysisPresentationTemplate['priority'];
  keywords: string[];
  matchedQuestionGroups: string[];
  displayMode: CrmAnalysisPresentationTemplate['displayMode'];
  replySections: string[];
  recommendedActions: string[];
  imageCardRequired: boolean;
  renderHints: CrmAnalysisPresentationTemplate['renderHints'];
}

@Injectable()
export class CrmAnalysisPresentationTemplateService {
  private readonly templates: PresentationTemplateDefinition[] = [
    {
      templateType: 'DATA_SCOPE_QUALITY',
      templateName: '数据质量与权限口径卡',
      priority: 'P0',
      keywords: ['权限', '口径', '全平台', '全国', '看不到', '不能看', '字段', '数据质量'],
      matchedQuestionGroups: ['问题 7', '问题 131-140', '问题 143-147'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'TEMPLATE_CARD'],
      replySections: ['问题复述', '数据口径', '可见范围', '限制说明', '替代问题'],
      recommendedActions: ['查看当前权限口径', '改为当前可见范围分析', '联系管理员确认授权'],
      imageCardRequired: true,
      renderHints: {
        layout: 'SCOPE_NOTICE',
        maxMetricCount: 4,
        maxRowCount: 6,
        tone: 'GOVERNANCE',
      },
    },
    {
      templateType: 'OPPORTUNITY_RISK',
      templateName: '商机风险清单卡',
      priority: 'P0',
      keywords: [
        '商机',
        '预计签约',
        '30 天内签约',
        '30天内签约',
        '未报价',
        '没有报价',
        '还没有报价',
        '过期',
        '停滞',
        '长期',
        '高金额',
        '风险',
        '推进慢',
      ],
      matchedQuestionGroups: ['问题 61-70', '问题 153-154', '问题 162-170'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'TEMPLATE_CARD'],
      replySections: ['问题复述', '数据口径', '核心风险', '商机清单', '管理动作'],
      recommendedActions: ['通知负责人', '按区域筛选', '导出风险清单'],
      imageCardRequired: true,
      renderHints: {
        layout: 'RISK_LIST',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'RISK',
      },
    },
    {
      templateType: 'QUOTE_ORDER_CONVERSION',
      templateName: '报价与订单转化卡',
      priority: 'P0',
      keywords: ['报价', '订单', '转订单', '成交', '待确认', '二级订单', '订单金额', '临门一脚'],
      matchedQuestionGroups: ['问题 71-90', '问题 171-180'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'TEMPLATE_CARD'],
      replySections: ['问题复述', '数据口径', '转化指标', '待推进清单', '下一步动作'],
      recommendedActions: ['查看本周可成交报价', '排查失败原因', '提醒一级渠道确认'],
      imageCardRequired: true,
      renderHints: {
        layout: 'RISK_LIST',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'RISK',
      },
    },
    {
      templateType: 'REGISTRATION_PROTECTION',
      templateName: '客户报备与保护期卡',
      priority: 'P1',
      keywords: ['报备', '保护期', '待审批', '驳回', '重复报备', '到期', '客户保护'],
      matchedQuestionGroups: ['问题 51-60', '问题 121', '问题 123', '问题 191'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'TEMPLATE_CARD'],
      replySections: ['问题复述', '数据口径', '到期统计', '客户清单', '处理建议'],
      recommendedActions: ['查看 7 天内到期客户', '按负责人拆分', '提醒负责人跟进'],
      imageCardRequired: false,
      renderHints: {
        layout: 'RISK_LIST',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'RISK',
      },
    },
    {
      templateType: 'FUNNEL_DIAGNOSIS',
      templateName: '业务漏斗诊断卡',
      priority: 'P0',
      keywords: ['漏斗', '转化率', '流失', '断点', '报备到商机', '商机到报价', '报价到订单'],
      matchedQuestionGroups: ['问题 1', '问题 4-6', '问题 71', '问题 81', '问题 152', '问题 180'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'TEMPLATE_CARD'],
      replySections: ['问题复述', '数据口径', '漏斗指标', '最大断点', '优先动作'],
      recommendedActions: ['查看断点明细', '按区域拆分漏斗', '生成漏斗看板'],
      imageCardRequired: true,
      renderHints: {
        layout: 'FUNNEL',
        maxMetricCount: 4,
        maxRowCount: 8,
        tone: 'RISK',
      },
    },
    {
      templateType: 'CHANNEL_RANKING',
      templateName: '渠道贡献排行卡',
      priority: 'P0',
      keywords: ['渠道', '渠道商', '排行', '排名', '贡献', '贡献占比', 'TOP', '前十', '前 10', '合作级别', '升级'],
      matchedQuestionGroups: ['问题 21-30', '问题 145', '问题 173', '问题 184-185'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'TEMPLATE_CARD', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '排行摘要', '渠道榜单', '运营动作'],
      recommendedActions: ['查看完整排行', '生成渠道看板', '筛选低活跃渠道'],
      imageCardRequired: true,
      renderHints: {
        layout: 'RANKING',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GROWTH',
      },
    },
    {
      templateType: 'REGION_COMPARISON',
      templateName: '区域经营对比卡',
      priority: 'P2',
      keywords: ['区域', '大区', '大北', '大东', '大南', '大西', '华南', '华东', '山东', '目标缺口', '可追回', '区域贡献'],
      matchedQuestionGroups: ['问题 3', '问题 11-20', '问题 146', '问题 159-160'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '区域分层', '重点区域', '管理建议'],
      recommendedActions: ['按区域拆分', '查看缺口最大区域', '生成区域看板'],
      imageCardRequired: false,
      renderHints: {
        layout: 'RANKING',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GROWTH',
      },
    },
    {
      templateType: 'OPERATING_CADENCE',
      templateName: '经营节奏日报/周报/月报卡',
      priority: 'P1',
      keywords: ['日报', '周报', '月报', '晨会', '周会', '经营会', '复盘', '今天早上', '本周'],
      matchedQuestionGroups: ['问题 130', '问题 191-204'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'TEMPLATE_CARD', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '会议摘要', '风险待办', '下步动作'],
      recommendedActions: ['生成周会摘要', '查看今日风险', '订阅后续推送'],
      imageCardRequired: false,
      renderHints: {
        layout: 'MEETING_BRIEF',
        maxMetricCount: 5,
        maxRowCount: 8,
        tone: 'SUMMARY',
      },
    },
    {
      templateType: 'PRODUCT_SOLUTION_STRUCTURE',
      templateName: '产品与解决方案结构卡',
      priority: 'P1',
      keywords: ['产品', '模块', '实施工作量', '产品目录', '解决方案', '行业方案', '工作量', '功能', '报价项'],
      matchedQuestionGroups: ['问题 91-100', '问题 211-220'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '产品结构', '贡献分析', '价格与工作量风险', '优化建议'],
      recommendedActions: ['查看产品结构看板', '按产品线拆分', '核对工作量规则'],
      imageCardRequired: false,
      renderHints: {
        layout: 'RANKING',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GROWTH',
      },
    },
    {
      templateType: 'CUSTOMER_SUCCESS_RENEWAL',
      templateName: '客户与市场成功卡',
      priority: 'P2',
      keywords: ['客户', '市场', '重点客户', '行业', '客户质量', '续费', '存量', '客户成功', '生命周期'],
      matchedQuestionGroups: ['问题 201-210'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '客户结构', '市场质量', '风险客户', '运营建议'],
      recommendedActions: ['查看重点客户', '按行业拆分客户', '排查沉睡客户'],
      imageCardRequired: false,
      renderHints: {
        layout: 'RISK_LIST',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GROWTH',
      },
    },
    {
      templateType: 'OWNER_ORG_COLLABORATION',
      templateName: '人员组织协同卡',
      priority: 'P1',
      keywords: ['人员', '负责人', '组织', '团队', '协同', '销售负责人', '区域管理员', '渠道员工', '响应时效'],
      matchedQuestionGroups: ['问题 111-120', '问题 251-260'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '人员绩效', '协同断点', '重点负责人', '管理动作'],
      recommendedActions: ['查看负责人排名', '按团队拆分', '排查协同断点'],
      imageCardRequired: false,
      renderHints: {
        layout: 'RANKING',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GOVERNANCE',
      },
    },
    {
      templateType: 'ALERT_AUDIT_GOVERNANCE',
      templateName: '通知预警与审计治理卡',
      priority: 'P1',
      keywords: ['通知', '提醒', '预警', '审计', '日志', '合规', '数据质量', '字段缺失', '管理工具', '治理'],
      matchedQuestionGroups: ['问题 121-140', '问题 221-230'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '预警对象', '审计证据', '治理风险', '处理建议'],
      recommendedActions: ['查看预警清单', '查看审计证据', '排查数据质量'],
      imageCardRequired: false,
      renderHints: {
        layout: 'SCOPE_NOTICE',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GOVERNANCE',
      },
    },
    {
      templateType: 'TECH_SERVICE_ECOSYSTEM',
      templateName: '技术服务商生态卡',
      priority: 'P2',
      keywords: ['技术服务商', '签约技术', '提名技术', '交付生态', '转签约', '技术服务能力'],
      matchedQuestionGroups: ['问题 41-50', '问题 156', '问题 188-189'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '生态覆盖', '贡献对比', '发展建议'],
      recommendedActions: ['查看转签约候选', '按区域看覆盖', '生成生态看板'],
      imageCardRequired: false,
      renderHints: {
        layout: 'RANKING',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GROWTH',
      },
    },
    {
      templateType: 'DISTRIBUTION_HIERARCHY',
      templateName: '分销层级健康卡',
      priority: 'P2',
      keywords: ['一级渠道', '二级渠道', '分销', '上级', '层级', '订单归属', '一级确认'],
      matchedQuestionGroups: ['问题 31-40', '问题 177-178', '问题 186-187'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '层级结构', '异常清单', '处理建议'],
      recommendedActions: ['查看待确认订单', '按一级渠道拆分', '生成层级看板'],
      imageCardRequired: false,
      renderHints: {
        layout: 'RISK_LIST',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GOVERNANCE',
      },
    },
    {
      templateType: 'CHANNEL_PROFILE',
      templateName: '渠道画像诊断卡',
      priority: 'P2',
      keywords: ['渠道画像', '沉睡渠道', '活跃但', '激活', '淘汰', '低贡献', '渠道池', '员工多'],
      matchedQuestionGroups: ['问题 23-29', '问题 181-183', '问题 190'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'MARKDOWN_TABLE', 'REPORT_LINK'],
      replySections: ['问题复述', '数据口径', '渠道分层', '代表渠道', '激活动作'],
      recommendedActions: ['查看待激活渠道', '查看建议淘汰渠道', '生成渠道画像'],
      imageCardRequired: false,
      renderHints: {
        layout: 'RISK_LIST',
        maxMetricCount: 4,
        maxRowCount: 10,
        tone: 'GOVERNANCE',
      },
    },
    {
      templateType: 'BUSINESS_OVERVIEW',
      templateName: '经营总览卡',
      priority: 'P0',
      keywords: ['经营总览', '经营情况', '核心指标', '健康度', '报备', '商机', '报价', '订单', '目标', '缺口'],
      matchedQuestionGroups: ['问题 1-10', '问题 151', '问题 192'],
      displayMode: ['TEXT_SUMMARY', 'IMAGE_CARD', 'TEMPLATE_CARD'],
      replySections: ['问题复述', '数据口径', '核心指标', '关键发现', '今日建议'],
      recommendedActions: ['生成日报', '按区域拆分', '查看风险清单'],
      imageCardRequired: true,
      renderHints: {
        layout: 'METRIC_CARD',
        maxMetricCount: 5,
        maxRowCount: 8,
        tone: 'SUMMARY',
      },
    },
  ];

  /**
   * 根据用户问题和分析结果选择最适合的企微展示模板。
   *
   * 参数说明：`questionText` 是用户原始问题，`result` 是已生成的分析结果。
   * 返回值说明：返回模板元数据，供企微文本、图片卡片和模板卡片统一使用。
   * 调用注意事项：这里只做展示匹配，不参与事实计算，也不改变查询权限。
   */
  resolveTemplate(params: {
    questionText?: string;
    result: AnalysisResultRecord;
  }): CrmAnalysisPresentationTemplate {
    const searchableText = this.buildSearchableText(params.questionText, params.result);
    const catalogRule = resolveCrmAnalysisQuestionTemplateRuleByText(
      params.questionText ?? params.result.questionText,
    );
    const rawQuestionText = `${params.questionText ?? params.result.questionText ?? ''}`;
    if (
      !catalogRule &&
      /(渠道|渠道商|服务商|代理商|经销商|伙伴)/u.test(rawQuestionText) &&
      /(贡献|贡献占比|排行|排名|top|业绩|产出)/iu.test(rawQuestionText)
    ) {
      return this.toPresentationTemplate(this.getTemplate('CHANNEL_RANKING'));
    }

    const matched =
      this.templates
        .map((template) => ({
          template,
          score: this.scoreTemplate(template, searchableText, params.result, catalogRule),
        }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)[0]?.template ??
      this.resolveFallbackTemplate(params.result);

    return this.toPresentationTemplate(matched);
  }

  /**
   * 把模板信息附加到分析结果中。
   *
   * 参数说明：`result` 为现有结果对象，`questionText` 用于辅助匹配模板。
   * 返回值说明：返回新结果对象，避免直接修改调用方传入对象。
   */
  attachTemplate(params: {
    questionText?: string;
    result: AnalysisResultRecord;
  }): AnalysisResultRecord {
    const presentationTemplate = this.resolveTemplate(params);

    return {
      ...params.result,
      report: {
        ...params.result.report,
        presentationTemplate,
        nextBestQuestions:
          params.result.report.nextBestQuestions?.length
            ? params.result.report.nextBestQuestions
            : presentationTemplate.recommendedActions,
      },
    };
  }

  /**
   * 聚合可用于模板匹配的文本，尽量利用已有标题、摘要和表格字段。
   *
   * 参数说明：`questionText` 为原始问题，`result` 为分析结果。
   * 返回值说明：返回统一小写文本，便于关键词命中。
   */
  private buildSearchableText(
    questionText: string | undefined,
    result: AnalysisResultRecord,
  ): string {
    const tableKeys = Object.keys(result.tableRows[0] ?? {}).join(' ');
    return [
      questionText,
      result.questionText,
      result.title,
      result.summary,
      result.report.reportTitle,
      result.report.executiveSummary,
      result.report.variant,
      tableKeys,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  /**
   * 计算模板匹配分值。
   *
   * 参数说明：`template` 是候选模板，`searchableText` 是聚合文本，`result` 是分析结果。
   * 返回值说明：分值越高越优先。
   */
  private scoreTemplate(
    template: PresentationTemplateDefinition,
    searchableText: string,
    result: AnalysisResultRecord,
    catalogRule?: CrmAnalysisQuestionTemplateRule,
  ): number {
    const catalogScore = catalogRule?.templateType === template.templateType ? 50 : 0;
    const keywordScore = template.keywords.reduce(
      (score, keyword) => score + (searchableText.includes(keyword.toLowerCase()) ? 3 : 0),
      0,
    );
    const variantScore =
      template.renderHints.layout === 'RANKING' && result.report.variant === 'ranking'
        ? 2
        : template.renderHints.layout === 'METRIC_CARD' && result.report.variant === 'summary'
          ? 2
          : 0;
    const regionComparisonBoost =
      template.templateType === 'REGION_COMPARISON' &&
      /(区域|大区|大北|大东|大南|大西|华东|华南|华北|山东)/u.test(searchableText) &&
      /(对比|比较|差异|季度|按季|一季度|二季度|三季度|四季度|q[1-4])/iu.test(searchableText)
        ? 12
        : 0;
    const priorityScore = template.priority === 'P0' ? 2 : template.priority === 'P1' ? 1 : 0;

    return catalogScore + keywordScore + variantScore + priorityScore + regionComparisonBoost;
  }

  /**
   * 当没有明显关键词命中时，根据结果形态选择安全兜底模板。
   *
   * 参数说明：`result` 是分析结果。
   * 返回值说明：返回兜底模板定义。
   */
  private resolveFallbackTemplate(result: AnalysisResultRecord): PresentationTemplateDefinition {
    if (result.report.variant === 'ranking') {
      return this.getTemplate('CHANNEL_RANKING');
    }

    if (result.keyFindings.some((item) => item.tone === 'risk')) {
      return this.getTemplate('OPPORTUNITY_RISK');
    }

    return this.getTemplate('BUSINESS_OVERVIEW');
  }

  /**
   * 按模板类型读取定义。
   *
   * 参数说明：`templateType` 是标准展示模板类型。
   * 返回值说明：返回模板定义；如果配置缺失则抛出错误，便于开发期发现。
   */
  private getTemplate(templateType: CrmAnalysisPresentationTemplateType): PresentationTemplateDefinition {
    const template = this.templates.find((item) => item.templateType === templateType);
    if (!template) {
      throw new Error(`缺少 CRM 智能分析展示模板配置：${templateType}`);
    }

    return template;
  }

  /**
   * 将内部定义转换为对外可挂载的展示模板对象。
   *
   * 参数说明：`definition` 为内部模板定义。
   * 返回值说明：返回不包含关键词等内部匹配细节的模板对象。
   */
  private toPresentationTemplate(
    definition: PresentationTemplateDefinition,
  ): CrmAnalysisPresentationTemplate {
    return {
      templateType: definition.templateType,
      templateName: definition.templateName,
      priority: definition.priority,
      matchedQuestionGroups: definition.matchedQuestionGroups,
      displayMode: definition.displayMode,
      replySections: definition.replySections,
      recommendedActions: definition.recommendedActions,
      imageCardRequired: definition.imageCardRequired,
      renderHints: definition.renderHints,
    };
  }
}
