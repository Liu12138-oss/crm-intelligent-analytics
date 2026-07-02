import { Injectable, Optional } from '@nestjs/common';
import type {
  AnalysisReportPayload,
  AnalysisResultRecord,
  ChannelType,
  CrmAnalysisPresentationTemplateType,
  MetricCard,
} from '../../shared/types/domain';
import {
  buildAnalysisMarkdownOutline,
  buildAnalysisWecomMarkdown,
} from './analysis-markdown.util';
import { CrmAnalysisPresentationTemplateService } from './crm-analysis-presentation-template.service';

@Injectable()
export class AnalysisChannelPresenterService {
  private readonly maxWecomRankingRows = 20;

  constructor(
    @Optional()
    private readonly crmAnalysisPresentationTemplateService =
      new CrmAnalysisPresentationTemplateService(),
  ) {}

  presentResult(
    result: AnalysisResultRecord,
    channel: ChannelType,
  ): AnalysisResultRecord {
    if (channel === 'web-console') {
      return result;
    }

    const compactedReport = this.compactReportForWecom(result.report);
    const compactedKeyFindings = result.keyFindings.slice(0, 4);
    const compactedMetricCards = result.metricCards.slice(0, 6);
    const compactedTableRows = this.compactRowsForWecom(result.tableRows);
    const compactedPayload = {
      title: compactedReport.reportTitle,
      summary: compactedReport.executiveSummary,
      groundedExplanation: compactedReport.groundedExplanation,
      metricCards: compactedMetricCards,
      keyFindings: compactedKeyFindings,
      nextBestQuestions: compactedReport.nextBestQuestions,
      scopeSummary: compactedReport.scopeSummary,
      temporalScope: compactedReport.temporalScope,
      rows: compactedTableRows,
      appliedFilters: result.appliedFilters,
      sourceNotes: compactedReport.sourceNotes,
      footnotes: compactedReport.footnotes,
      secondaryViewSummaries: result.secondaryViews.slice(0, 6).map((item) => ({
        title: item.title,
        rowCount: item.rows?.length ?? 0,
        renderType: this.formatViewRenderType(item.viewType),
      })),
      variant: compactedReport.variant,
    };
    const templateResult = this.crmAnalysisPresentationTemplateService.attachTemplate({
      questionText: result.questionText,
      result: {
        ...result,
        report: compactedReport,
        metricCards: compactedMetricCards,
        keyFindings: compactedKeyFindings,
        tableRows: compactedTableRows,
      },
    });
    const presentationTemplate = templateResult.report.presentationTemplate;
    const compactedMarkdown =
      compactedReport.wecomMarkdown?.trim() ||
      buildAnalysisWecomMarkdown(compactedPayload);
    const templatedMarkdown = this.prependPresentationTemplateSummary(
      compactedMarkdown,
      {
        questionText: result.questionText,
        templateType: presentationTemplate?.templateType,
        templateName: presentationTemplate?.templateName,
        replySections: presentationTemplate?.replySections,
        recommendedActions: presentationTemplate?.recommendedActions,
        metricCards: compactedMetricCards,
        rowCount: result.rowCount,
        secondaryViewSummaries: compactedPayload.secondaryViewSummaries,
      },
    );
    const compactedOutline = buildAnalysisMarkdownOutline(compactedPayload);

    return {
      ...result,
      report: {
        ...compactedReport,
        presentationTemplate,
        groundedMarkdown: templatedMarkdown,
        wecomMarkdown: templatedMarkdown,
        markdownOutline: compactedOutline,
      },
      keyFindings: compactedKeyFindings,
      metricCards: compactedMetricCards,
      tableRows: compactedTableRows,
      secondaryViews: result.secondaryViews.slice(0, 2),
      streamBlocks: result.streamBlocks.slice(0, 6),
      explanation: result.explanation,
      groundedMarkdown: templatedMarkdown,
      wecomMarkdown: templatedMarkdown,
      markdownOutline: compactedOutline,
    };
  }

  /**
   * 在企微 Markdown 顶部补充命中的展示模板与固定回复段落。
   *
   * 参数说明：`markdown` 是原始企微摘要，`template` 是模板匹配结果。
   * 返回值说明：有模板时返回模板化回复骨架；无模板时保持原文。
   * 调用注意事项：只补充展示结构，不改变事实结论和明细数据。
   */
  private prependPresentationTemplateSummary(
    markdown: string,
    template?: {
      questionText?: string;
      templateType?: CrmAnalysisPresentationTemplateType;
      templateName?: string;
      replySections?: string[];
      recommendedActions?: string[];
      metricCards?: MetricCard[];
      rowCount?: number;
      secondaryViewSummaries?: Array<{
        title: string;
        rowCount: number;
        renderType?: string;
      }>;
    },
  ): string {
    if (!template?.templateName) {
      return markdown;
    }

    const sections = template.replySections?.length
      ? template.replySections.join(' / ')
      : '问题复述 / 数据口径 / 核心指标 / 关键发现 / 建议动作';
    const actions = template.recommendedActions?.slice(0, 3).join('；');
    const actionLine = actions ? `\n【建议追问】${actions}` : '';

    return [
      `【展示模板】${template.templateName}`,
      `【回复结构】${sections}${actionLine}`,
      ...this.buildTemplateAcceptanceSummaryLines(template),
      markdown,
    ].join('\n');
  }

  /**
   * 生成企微验收需要的专题回答段落。
   *
   * 参数说明：`template` 为已命中的标准展示模板和当前结果摘要。
   * 返回值说明：返回问题复述、数据口径、维度判断、明细摘要、缺口说明和风险建议。
   * 可能抛出的异常：无。
   * 调用注意事项：这里只引用已执行结果和模板口径，不补造不存在的 CRM 字段事实。
   */
  private buildTemplateAcceptanceSummaryLines(template: {
    questionText?: string;
    templateType?: CrmAnalysisPresentationTemplateType;
    metricCards?: MetricCard[];
    rowCount?: number;
    secondaryViewSummaries?: Array<{
      title: string;
      rowCount: number;
      renderType?: string;
    }>;
  }): string[] {
    const questionText = template.questionText?.trim();
    const metricText = this.formatMetricSummary(template.metricCards ?? []);
    const viewText = this.formatViewSummary(template.secondaryViewSummaries ?? []);
    const directAnswer = this.resolveTemplateDirectAnswer(template.templateType);
    const gapNote = this.resolveTemplateGapNote(template.templateType);
    const advice = this.resolveTemplateAdvice(template.templateType);
    const expectedViewNote = this.resolveTemplateExpectedViewNote(template.templateType);
    const detailSummary = [
      expectedViewNote ? `核心视图应包含：${expectedViewNote}` : '',
      (template.rowCount ?? 0) <= 0
        ? '当前数据范围未命中明细，已按空态口径展示；建议放宽时间范围或等待数据同步后复核。'
        : '',
      viewText || `已命中 ${template.rowCount ?? 0} 条明细，企微仅展示前若干条，完整明细请进入结果页查看。`,
    ].filter(Boolean).join('；');

    return [
      questionText ? `【问题复述】${questionText}` : '【问题复述】本次问题已按 CRM 智能分析标准模板处理。',
      '【数据口径】使用当前用户可见范围内的 CRM 标准业务数据；金额按元读取并以万元展示，统计对象只包含当前结果中真实返回的报备、商机、报价、订单和渠道商记录。',
      '【权限口径】本次结论只代表当前登录用户可见数据；涉及全平台、全国或跨角色判断时，需先确认是否已获得对应授权。',
      `【维度判断】${directAnswer}`,
      `【核心指标】${metricText || '当前结果未形成可展示指标，需先等待数据同步或放宽筛选条件。'}`,
      `【明细摘要】${detailSummary}`,
      `【缺口说明】${gapNote}`,
      `【风险建议】${advice}`,
    ];
  }

  /**
   * 格式化企微顶部核心指标摘要。
   *
   * 参数说明：`metricCards` 为当前结果前置指标卡。
   * 返回值说明：返回最多 5 个中文指标的行内摘要。
   * 可能抛出的异常：无。
   */
  private formatMetricSummary(metricCards: MetricCard[]): string {
    return metricCards
      .slice(0, 5)
      .map((item) => `${item.name} ${item.value}`)
      .join('；');
  }

  /**
   * 格式化企微顶部明细区块摘要。
   *
   * 参数说明：`viewSummaries` 为压缩后的图表和表格区块。
   * 返回值说明：返回最多 4 个区块名称、数量和呈现方式。
   * 可能抛出的异常：无。
   */
  private formatViewSummary(viewSummaries: Array<{
    title: string;
    rowCount: number;
    renderType?: string;
  }>): string {
    return viewSummaries
      .slice(0, 4)
      .map((item) => `${item.title} ${item.rowCount} 条${item.renderType ? `（${item.renderType}）` : ''}`)
      .join('；');
  }

  /**
   * 按模板输出直接回答口径。
   *
   * 参数说明：`templateType` 为标准展示模板类型。
   * 返回值说明：返回当前模板必须覆盖的分析维度说明。
   * 可能抛出的异常：无。
   */
  private resolveTemplateDirectAnswer(
    templateType?: CrmAnalysisPresentationTemplateType,
  ): string {
    const answerMap: Record<CrmAnalysisPresentationTemplateType, string> = {
      BUSINESS_OVERVIEW: '围绕报备、商机、报价、订单四段主链路判断经营是否健康，不能只看单一订单或单一渠道排行。',
      FUNNEL_DIAGNOSIS: '重点判断报备到商机、商机到报价、报价到订单哪一段流失最大，并用订单样本不足风险解释结论边界。',
      REGION_COMPARISON: '重点按区域或大区比较报备、商机、报价、订单贡献，识别高贡献、低活跃和贡献集中区域。',
      CHANNEL_RANKING: '重点按渠道商维度比较贡献，至少同时观察报备、商机、报价、订单中的多个指标。',
      CHANNEL_PROFILE: '重点把渠道分为活跃、高潜力、沉睡、低贡献等层级，并给出激活、升级或淘汰对象。',
      DISTRIBUTION_HIERARCHY: '重点区分一级渠道、二级渠道和无层级渠道，核对父级归属、协同关系和订单归属风险。',
      TECH_SERVICE_ECOSYSTEM: '重点比较签约技术服务商、提名技术服务商、普通渠道在覆盖、项目贡献和转化效率上的差异。',
      REGISTRATION_PROTECTION: '重点核对报备审批、通过驳回、保护期、重复报备和到期客户，输出待处理优先级。',
      OPPORTUNITY_RISK: '重点列出高金额、预计签约、未报价、停滞或字段不完整商机，并说明负责人和风险原因。',
      QUOTE_ORDER_CONVERSION: '重点比较报价数量、报价金额、订单数量、订单金额和状态变化，判断报价是否真正带来成交。',
      DATA_SCOPE_QUALITY: '重点先说明权限、时间、字段和关联完整性，避免局部可见数据被误解为全局结论。',
      OPERATING_CADENCE: '重点把结果转成日报、周报、月报或季度复盘可用的指标、风险待办和下一步动作。',
      PRODUCT_SOLUTION_STRUCTURE: '重点围绕产品大类、模块、套餐、硬件、价格和工作量口径判断方案结构是否健康。',
      CUSTOMER_SUCCESS_RENEWAL: '重点从客户行业、区域、生命周期、已报价未订单和复购扩容线索判断客户质量。',
      OWNER_ORG_COLLABORATION: '重点按角色、负责人、创建人、指派人和团队协同关系判断责任边界与交接风险。',
      ALERT_AUDIT_GOVERNANCE: '重点区分业务预警、通知处理、审计证据和治理闭环，说明哪些事项仍待人工复核。',
    };
    return templateType ? answerMap[templateType] : '当前问题已按命中的 CRM 分析模板进行专题判断。';
  }

  /**
   * 按模板输出字段缺口说明。
   *
   * 参数说明：`templateType` 为标准展示模板类型。
   * 返回值说明：返回不编造字段时应提示的业务缺口。
   * 可能抛出的异常：无。
   */
  private resolveTemplateGapNote(
    templateType?: CrmAnalysisPresentationTemplateType,
  ): string {
    const gapMap: Record<CrmAnalysisPresentationTemplateType, string> = {
      BUSINESS_OVERVIEW: '若缺少目标值、历史同期或真实订单样本，只给当前数据口径结论，不推断未返回的数据。',
      FUNNEL_DIAGNOSIS: '若某环节样本过少，以可见前置环节解释断点，不能把无订单等同于无商机质量。',
      REGION_COMPARISON: '若区域管理员响应时效、连续周期或区域目标字段缺失，只输出区域经营差异和需补字段清单。',
      CHANNEL_RANKING: '若员工数量、渠道等级目标或真实跟进记录缺失，只按当前业务链贡献分层，不做因果断言。',
      CHANNEL_PROFILE: '若首次动作时间、员工数量或拜访记录缺失，只能输出沉睡/低贡献线索和补数建议。',
      DISTRIBUTION_HIERARCHY: '当前结果有父级渠道、父级渠道链和订单父级渠道字段；若待一级确认、多上级绑定审批流缺失，需要补流程字段后复核。',
      TECH_SERVICE_ECOSYSTEM: '当前结果有是否技术服务商和技术服务商类型；若技术交流、测试、交付能力字段缺失，不能断言阶段推进因果。',
      REGISTRATION_PROTECTION: '若保护期到期处理、重复报备冲突原因或审批耗时字段缺失，只列风险口径，不判断流程已闭环。',
      OPPORTUNITY_RISK: '若跟进记录、阶段日志或预计签约准确性字段缺失，只按金额、阶段、预计时间和报价关联做规则风险判断。',
      QUOTE_ORDER_CONVERSION: '若报价调整原因、失败原因、折扣率或友商参考价缺失，只比较报价与订单关联和金额状态，不编造价格归因。',
      DATA_SCOPE_QUALITY: '若字段、权限或关联链路不完整，结论必须标注“当前可见范围”，不能写成全国或全平台绝对事实。',
      OPERATING_CADENCE: '若目标管理、拜访记录或主动推送尚未启用，只生成问询版复盘和人工待办，不声明已自动闭环。',
      PRODUCT_SOLUTION_STRUCTURE: '若工作量规则、产品映射、发布状态或模块成交明细缺失，只使用报价/订单中的产品线索作替代口径。',
      CUSTOMER_SUCCESS_RENEWAL: '若复购、扩容、客户规模或行业标准字段缺失，只按报备、商机、报价、订单生命周期做线索判断。',
      OWNER_ORG_COLLABORATION: '若组织映射、离职交接、操作日志或员工活跃字段缺失，只输出责任风险和补字段建议。',
      ALERT_AUDIT_GOVERNANCE: '若通知处理记录或审计变更前后明细缺失，只能提示待复核，不能声称提醒已处理或治理已闭环。',
    };
    return templateType ? gapMap[templateType] : '未识别到专项缺口，按当前可见数据和标准模板说明结论边界。';
  }

  /**
   * 按模板输出下一步建议。
   *
   * 参数说明：`templateType` 为标准展示模板类型。
   * 返回值说明：返回面向业务用户的行动建议。
   * 可能抛出的异常：无。
   */
  private resolveTemplateAdvice(
    templateType?: CrmAnalysisPresentationTemplateType,
  ): string {
    const adviceMap: Record<CrmAnalysisPresentationTemplateType, string> = {
      BUSINESS_OVERVIEW: '优先跟进漏斗断点、高金额未转化对象和贡献集中对象，并按区域或渠道下钻复核。',
      FUNNEL_DIAGNOSIS: '优先处理最大断点，再查看对应区域、渠道和负责人明细。',
      REGION_COMPARISON: '优先复盘高商机低订单区域、渠道多产出低区域和连续下滑区域。',
      CHANNEL_RANKING: '优先复盘头部渠道打法，同时把低贡献和高潜力渠道拆成激活清单。',
      CHANNEL_PROFILE: '优先处理长期无新增动作渠道，再评估升级、降级或淘汰动作。',
      DISTRIBUTION_HIERARCHY: '优先补齐父级绑定和一级确认字段，再处理二级协同和无层级渠道归口。',
      TECH_SERVICE_ECOSYSTEM: '优先看技术服务商覆盖薄弱区域和长期无贡献提名技术服务商。',
      REGISTRATION_PROTECTION: '优先处理待审批、即将到期和重复报备对象，避免保护资源空占。',
      OPPORTUNITY_RISK: '优先通知负责人处理预计签约未报价、高金额停滞和字段不完整商机。',
      QUOTE_ORDER_CONVERSION: '优先推进大额未转订单报价、已转化链路核对和价格字段补齐。',
      DATA_SCOPE_QUALITY: '优先确认本次是否需要全国口径、角色口径或字段补齐，再下结论。',
      OPERATING_CADENCE: '优先输出本周期结论、核心风险、下周期动作和需要支持四段式摘要。',
      PRODUCT_SOLUTION_STRUCTURE: '优先核对高频低成交模块、套餐与单模块转化差异和价格/工作量缺口。',
      CUSTOMER_SUCCESS_RENEWAL: '优先下钻已报备有商机未报价、已报价无订单和高价值客户画像。',
      OWNER_ORG_COLLABORATION: '优先核对负责人责任边界、跨角色可见性和需要交接的客户/商机。',
      ALERT_AUDIT_GOVERNANCE: '优先把未处理预警、缺审计证据和字段质量问题登记成治理待办。',
    };
    return templateType ? adviceMap[templateType] : '建议继续按模板追问明细、风险和下一步动作。';
  }

  /**
   * 按模板输出验收期望的核心视图名称。
   *
   * 参数说明：`templateType` 为标准展示模板类型。
   * 返回值说明：返回用户可理解的核心图表或明细区块名称。
   * 可能抛出的异常：无。
   */
  private resolveTemplateExpectedViewNote(
    templateType?: CrmAnalysisPresentationTemplateType,
  ): string {
    const viewMap: Record<CrmAnalysisPresentationTemplateType, string> = {
      BUSINESS_OVERVIEW: '经营区块、渠道商经营贡献汇总、区域经营对比',
      FUNNEL_DIAGNOSIS: '经营区块、商机阶段分布、报价明细、订单明细',
      REGION_COMPARISON: '区域经营对比',
      CHANNEL_RANKING: '渠道商经营贡献汇总、合作伙伴明细',
      CHANNEL_PROFILE: '渠道商经营贡献汇总、合作伙伴明细',
      DISTRIBUTION_HIERARCHY: '分销层级健康汇总',
      TECH_SERVICE_ECOSYSTEM: '技术服务商生态对比',
      REGISTRATION_PROTECTION: '客户报备明细',
      OPPORTUNITY_RISK: '商机明细、商机阶段分布',
      QUOTE_ORDER_CONVERSION: '报价明细、订单明细',
      DATA_SCOPE_QUALITY: '经营区块、渠道商经营贡献汇总',
      OPERATING_CADENCE: '经营区块、渠道商经营贡献汇总',
      PRODUCT_SOLUTION_STRUCTURE: '报价明细、订单明细',
      CUSTOMER_SUCCESS_RENEWAL: '客户报备明细、商机明细、报价明细、订单明细',
      OWNER_ORG_COLLABORATION: '商机明细、报价明细、订单明细',
      ALERT_AUDIT_GOVERNANCE: '经营区块、客户报备明细、商机明细',
    };
    return templateType ? viewMap[templateType] : '';
  }

  private compactReportForWecom(report: AnalysisReportPayload): AnalysisReportPayload {
    return {
      ...report,
      keyFindings: report.keyFindings.slice(0, 4),
      chartBlocks: report.chartBlocks.slice(0, 2),
      sections: (report.sections ?? []).filter((item) =>
        ['summary', 'metric-strip', 'risk', 'focus-list', 'actions', 'detail-table'].includes(
          item.sectionType,
        ),
      ).map((item, index) => {
        if (item.sectionType !== 'detail-table') {
          return item;
        }

        return index === 0
          ? {
              ...item,
              rows: this.compactRowsForWecom(item.rows ?? []),
            }
          : item;
      }).slice(0, 5),
      tableBlocks: report.tableBlocks.map((item, index) =>
        index === 0
          ? {
              ...item,
              rows: this.compactRowsForWecom(item.rows),
            }
          : item,
      ).slice(0, 2),
      datasetReferences: report.datasetReferences.slice(0, 4),
    };
  }

  private compactRowsForWecom(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.slice(0, this.maxWecomRankingRows);
  }

  private formatViewRenderType(viewType: AnalysisResultRecord['secondaryViews'][number]['viewType']): string {
    if (['LINE_CHART', 'BAR_CHART', 'PIE_CHART'].includes(viewType)) {
      return '图表区块';
    }

    if (['DETAIL_TABLE', 'RANKING_TABLE'].includes(viewType)) {
      return '表格';
    }

    return '指标卡';
  }
}
