/**
 * 企微 14 类动态看板 Markdown 正文渲染器。
 *
 * 设计目的：
 * - 与动态模板卡片共用同一个模板识别结果，避免卡片和正文展示不一致。
 * - P1 阶段按 14 类模板输出不同分析段落，公共口径段保持统一。
 * - 只渲染已有 DashboardComposeResult，不重新查询、不扩大权限范围。
 */

import { Injectable } from '@nestjs/common';
import type {
  DashboardBlock,
  DashboardComposeResult,
} from '../crm-standard-api/dashboard-report-composer.service';
import type { DashboardCardKpiItem } from './wecom-dashboard-card-builder.service';
import type {
  WecomDashboardTemplateCode,
  WecomDashboardTemplateDefinition,
} from './wecom-dashboard-template.registry';

/**
 * 动态 Markdown 渲染参数。
 */
export interface RenderWecomDashboardMarkdownParams {
  dashboardResult: DashboardComposeResult;
  questionText: string;
  template: WecomDashboardTemplateDefinition;
  cardKpiItems: DashboardCardKpiItem[];
  webDashboardUrl?: string;
}

@Injectable()
export class WecomDashboardMarkdownRendererService {
  /**
   * 渲染企微看板 Markdown 正文。
   *
   * 参数说明：`params` 为看板结果、原问题、模板定义和卡片指标。
   * 返回值说明：返回可直接通过企微长连接发送的 Markdown 文本。
   * 调用注意事项：正文必须独立可读，不能依赖卡片或 HTML 才能理解结论。
   */
  render(params: RenderWecomDashboardMarkdownParams): string {
    const context = this.buildContext(params.dashboardResult);
    const lines: string[] = [];
    const sectionNames = this.resolveSectionNames(params.template.code);

    lines.push(`【展示模板】${params.template.displayName}`);
    lines.push(`【回复结构】问题复述 / 数据口径 / 权限口径 / 核心指标 / 分析结论 / 分维度分析 / ${sectionNames.join(' / ')} / 明细摘要 / 风险建议 / 建议追问`);
    lines.push(`## ${params.template.cardTitle}`);
    lines.push(`【问题复述】${params.questionText.trim() || '经营看板查询'}`);
    lines.push('【数据口径】');
    lines.push(`- 数据范围：${params.dashboardResult.scopeSummary || '当前用户权限范围'}`);
    lines.push(`- 数据来源：${params.dashboardResult.dataSource === 'OPENAPI_REALTIME' ? 'CRM OpenAPI 实时数据' : 'CRM 同步数据'}`);
    lines.push('- 金额单位：人民币；金额类指标按 CRM 统计口径展示。');
    lines.push(`- 口径说明：${context.hasOrderData ? '当前包含订单口径，可结合订单、报价、商机分层判断；所有对比只在同一对象和同一指标内进行。' : '当前真实订单数据不足，优先使用商机或报价作为前置经营口径，不能等同真实成交；所有对比只在同一对象和同一指标内进行。'}`);
    lines.push('');
    lines.push('【权限口径】');
    lines.push(`- 当前可见范围：${params.dashboardResult.scopeSummary || '当前用户权限范围'}`);
    lines.push('- 本次只基于当前企微用户绑定 CRM 账号可访问的数据生成结论；无权限数据不会被补齐或推断。');
    lines.push('');
    lines.push('【核心指标】');
    for (const item of params.cardKpiItems.slice(0, 7)) {
      lines.push(`- ${item.label}：${item.value}`);
    }
    lines.push('');
    lines.push('【分析结论】');
    for (const line of this.renderAnalysisConclusionLines(params.template.code, context)) {
      lines.push(`- ${line}`);
    }
    lines.push('');
    lines.push('【分维度分析】');
    for (const line of this.renderDimensionAnalysisLines(params.template.code, context)) {
      lines.push(`- ${line}`);
    }
    lines.push('');
    lines.push(...this.renderTemplateSections(params.template.code, context));
    lines.push('【明细摘要】');
    for (const line of this.renderDetailLines(context)) {
      lines.push(`- ${line}`);
    }
    lines.push('');
    lines.push('【风险建议】');
    for (const line of this.renderRiskLines(context, params.template.code)) {
      lines.push(`- ${line}`);
    }
    lines.push('');
    lines.push('【建议追问】');
    for (const line of this.resolveFollowUpQuestions(params.template.code)) {
      lines.push(`- ${line}`);
    }
    lines.push(
      params.webDashboardUrl
        ? `【企微展示说明】已通过卡片、正文和图片看板在企微内完成交付；备查报告：${params.webDashboardUrl}`
        : '【企微展示说明】已通过卡片、正文和图片看板在企微内完成交付；当前未配置外部备查报告入口。',
    );

    return lines.join('\n');
  }

  /**
   * 构造渲染上下文。
   *
   * 参数说明：`dashboardResult` 为看板组装结果。
   * 返回值说明：返回按区块类型整理后的上下文对象。
   */
  private buildContext(dashboardResult: DashboardComposeResult): {
    result: DashboardComposeResult;
    kpiBlock?: Extract<DashboardBlock, { blockType: 'kpi-matrix' }>;
    funnelBlock?: Extract<DashboardBlock, { blockType: 'funnel' }>;
    concentrationBlock?: Extract<DashboardBlock, { blockType: 'concentration' }>;
    geoBlock?: Extract<DashboardBlock, { blockType: 'geo-map' }>;
    groupedBarBlock?: Extract<DashboardBlock, { blockType: 'grouped-bar' }>;
    pieBlocks: Array<Extract<DashboardBlock, { blockType: 'pie-distribution' }>>;
    tableBlocks: Array<Extract<DashboardBlock, { blockType: 'sortable-table' }>>;
    hasOrderData: boolean;
  } {
    const funnelBlock = this.findBlock(dashboardResult.blocks, 'funnel');
    const tableBlocks = this.filterBlocks(dashboardResult.blocks, 'sortable-table');
    return {
      result: dashboardResult,
      kpiBlock: this.findBlock(dashboardResult.blocks, 'kpi-matrix'),
      funnelBlock,
      concentrationBlock: this.findBlock(dashboardResult.blocks, 'concentration'),
      geoBlock: this.findBlock(dashboardResult.blocks, 'geo-map'),
      groupedBarBlock: this.findBlock(dashboardResult.blocks, 'grouped-bar'),
      pieBlocks: this.filterBlocks(dashboardResult.blocks, 'pie-distribution'),
      tableBlocks,
      hasOrderData: this.hasOrderData(funnelBlock, tableBlocks),
    };
  }

  /**
   * 渲染模板特有段落。
   *
   * 参数说明：`templateCode` 为 14 类模板编码，`context` 为看板上下文。
   * 返回值说明：返回已经带标题和空行的 Markdown 行数组。
   */
  private renderTemplateSections(
    templateCode: WecomDashboardTemplateCode,
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    switch (templateCode) {
      case 'FUNNEL_DIAGNOSIS':
        return this.renderFunnelDiagnosisSections(context);
      case 'CHANNEL_RANKING':
        return this.renderChannelRankingSections(context);
      case 'REGION_COMPARISON':
        return this.renderRegionComparisonSections(context);
      case 'CHANNEL_PROFILE':
        return this.renderChannelProfileSections(context);
      case 'REGISTRATION_PROTECTION':
        return this.renderRegistrationProtectionSections(context);
      case 'OPPORTUNITY_RISK':
        return this.renderOpportunityRiskSections(context);
      case 'QUOTE_TO_ORDER':
        return this.renderQuoteToOrderSections(context);
      case 'RENEWAL_SUCCESS':
        return this.renderRenewalSuccessSections(context);
      case 'PRODUCT_SOLUTION':
        return this.renderProductSolutionSections(context);
      case 'SERVICE_ECOSYSTEM':
        return this.renderServiceEcosystemSections(context);
      case 'DISTRIBUTION_HEALTH':
        return this.renderDistributionHealthSections(context);
      case 'CADENCE_REPORT':
        return this.renderCadenceReportSections(context);
      case 'DATA_SCOPE_QUALITY':
        return this.renderDataScopeQualitySections(context);
      case 'BUSINESS_OVERVIEW':
      default:
        return this.renderBusinessOverviewSections(context);
    }
  }

  /**
   * 渲染经营总览段落。
   */
  private renderBusinessOverviewSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【核心经营判断】',
      `- ${context.result.executiveSummary || '已生成 CRM 经营看板，请结合指标和明细判断。'}`,
      `- ${context.hasOrderData ? '当前可结合订单口径判断成交贡献。' : '当前订单沉淀不足，经营判断以商机和报价等前置指标为主。'}`,
      '',
      '【业务漏斗与趋势】',
      ...this.prefix(this.renderFunnelLines(context), '- '),
      '',
      '【渠道集中度】',
      ...this.prefix(this.renderConcentrationLines(context), '- '),
      '',
      '【区域覆盖与业务分布】',
      ...this.prefix(this.renderRegionLines(context), '- '),
      '',
      '【渠道贡献排行】',
      ...this.prefix(this.renderRankingLines(context), '- '),
      '',
      '【渠道结构与状态分布】',
      ...this.prefix(this.renderStructureLines(context), '- '),
      '',
    ];
  }

  /**
   * 渲染漏斗诊断段落。
   */
  private renderFunnelDiagnosisSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【漏斗总览】',
      ...this.prefix(this.renderFunnelStageLines(context), '- '),
      '',
      '【三段转化率】',
      ...this.prefix(this.renderFunnelRateLines(context), '- '),
      '',
      '【最大断点】',
      `- ${this.resolveWeakestFunnelStep(context)}`,
      '',
      '【优先动作】',
      '- 优先核对最大断点阶段的责任人、跟进动作和下一步转化条件。',
      '',
    ];
  }

  /**
   * 渲染渠道排行段落。
   */
  private renderChannelRankingSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【排行摘要】',
      ...this.prefix(this.renderRankingLines(context), '- '),
      '',
      '【多口径榜单】',
      ...this.prefix(this.renderTableTopLines(context, /渠道|排行|服务商/u), '- '),
      '',
      '【集中度判断】',
      ...this.prefix(this.renderConcentrationLines(context), '- '),
      '',
      '【头部长尾动作】',
      '- 头部渠道建议维持资源和项目节奏；长尾渠道建议筛选低频高潜对象做激活。',
      '',
    ];
  }

  /**
   * 渲染区域对比段落。
   */
  private renderRegionComparisonSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【区域分层】',
      ...this.prefix(this.renderRegionLines(context), '- '),
      '',
      '【重点区域】',
      ...this.prefix(this.renderTableTopLines(context, /区域|大区/u), '- '),
      '',
      '【异常区域】',
      '- 若区域商机高但订单低，优先复核报价推进、合同节点和区域负责人动作。',
      '',
      '【负责人动作】',
      '- 建议按区域负责人继续下钻，拆分报备、商机、报价和订单四段指标。',
      '',
    ];
  }

  /**
   * 渲染渠道画像段落。
   */
  private renderChannelProfileSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【渠道分层】',
      ...this.prefix(this.renderStructureLines(context), '- '),
      '',
      '【代表渠道】',
      ...this.prefix(this.renderTableTopLines(context, /渠道|服务商/u), '- '),
      '',
      '【高潜低转化判断】',
      '- 优先关注报备或商机较多但报价、订单偏低的渠道。',
      '',
      '【激活动作】',
      '- 对沉睡渠道输出激活名单，对高潜低转化渠道安排售前、培训或商机复盘。',
      '',
    ];
  }

  /**
   * 渲染报备保护段落。
   */
  private renderRegistrationProtectionSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【到期统计】',
      ...this.prefix(this.renderKpiMatchLines(context, /报备|待审批|驳回|到期/u), '- '),
      '',
      '【冲突清单】',
      ...this.prefix(this.renderTableTopLines(context, /报备|客户|冲突|归属/u), '- '),
      '',
      '【归属风险】',
      '- 若出现重复报备或归属不清，建议先确认客户主体、保护期和负责渠道。',
      '',
      '【处理建议】',
      '- 处理顺序建议为即将到期、重复报备、待审批、驳回原因复核。',
      '',
    ];
  }

  /**
   * 渲染商机风险段落。
   */
  private renderOpportunityRiskSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【核心风险】',
      '- 优先关注高金额、预计签约临近、长期未报价或阶段停滞的商机。',
      '',
      '【风险分层】',
      ...this.prefix(this.renderKpiMatchLines(context, /商机|风险|停滞|未报价/u), '- '),
      '',
      '【商机清单】',
      ...this.prefix(this.renderTableTopLines(context, /商机|风险|渠道/u), '- '),
      '',
      '【负责人动作】',
      '- 建议按负责人输出跟进动作：确认客户意向、补报价、推进合同节点。',
      '',
    ];
  }

  /**
   * 渲染报价转订单段落。
   */
  private renderQuoteToOrderSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【预测声明】',
      '- 报价转订单属于经营判断，不承诺一定成交；需结合客户预算、决策人、合同节点复核。',
      '',
      '【转化指标】',
      ...this.prefix(this.renderFunnelLines(context), '- '),
      '',
      '【优先级清单】',
      ...this.prefix(this.renderTableTopLines(context, /报价|订单|渠道/u), '- '),
      '',
      '【评分解释】',
      '- 优先级通常由报价金额、阶段进度、跟进活跃度和预计签约窗口共同决定。',
      '',
    ];
  }

  /**
   * 渲染续费与客户成功段落。
   */
  private renderRenewalSuccessSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【续费概览】',
      ...this.prefix(this.renderKpiMatchLines(context, /客户|订单|金额|续费/u), '- '),
      '',
      '【风险客户】',
      ...this.prefix(this.renderTableTopLines(context, /客户|订单|风险/u), '- '),
      '',
      '【客户成功动作】',
      '- 建议按到期窗口安排回访、健康检查、续费报价和风险升级。',
      '',
    ];
  }

  /**
   * 渲染产品与解决方案段落。
   */
  private renderProductSolutionSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【产品结构】',
      ...this.prefix(this.renderKpiMatchLines(context, /产品|方案|商机|报价|订单/u), '- '),
      '',
      '【高潜方案】',
      ...this.prefix(this.renderTableTopLines(context, /产品|方案|商机/u), '- '),
      '',
      '【转化断点】',
      ...this.prefix(this.renderFunnelLines(context), '- '),
      '',
      '【经营建议】',
      '- 建议优先推进商机金额高、报价断点明显或行业场景清晰的解决方案。',
      '',
    ];
  }

  /**
   * 渲染技术服务商生态段落。
   */
  private renderServiceEcosystemSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【生态覆盖】',
      ...this.prefix(this.renderStructureLines(context), '- '),
      '',
      '【贡献对比】',
      ...this.prefix(this.renderTableTopLines(context, /技术|服务商|渠道/u), '- '),
      '',
      '【覆盖缺口】',
      ...this.prefix(this.renderRegionLines(context), '- '),
      '',
      '【发展建议】',
      '- 建议优先补齐覆盖不足区域，并筛选提名技术服务商进入转签约候选。',
      '',
    ];
  }

  /**
   * 渲染分销层级健康段落。
   */
  private renderDistributionHealthSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【层级结构】',
      ...this.prefix(this.renderKpiMatchLines(context, /一级|二级|渠道|分销/u), '- '),
      '',
      '【链路健康】',
      ...this.prefix(this.renderFunnelLines(context), '- '),
      '',
      '【异常清单】',
      ...this.prefix(this.renderTableTopLines(context, /渠道|订单|归属|层级/u), '- '),
      '',
      '【处理建议】',
      '- 建议复核上级渠道确认、订单归属和跨区协同边界。',
      '',
    ];
  }

  /**
   * 渲染经营节奏段落。
   */
  private renderCadenceReportSections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【会议摘要】',
      `- ${context.result.executiveSummary || '本周期经营摘要已生成。'}`,
      '',
      '【本期变化】',
      ...this.prefix(this.renderTrendOrKpiLines(context), '- '),
      '',
      '【风险待办】',
      ...this.prefix(this.renderRiskLines(context, 'CADENCE_REPORT'), '- '),
      '',
      '【负责人动作】',
      '- 建议会前确认每个风险项的负责人、截止时间和需要支持事项。',
      '',
    ];
  }

  /**
   * 渲染数据质量和权限口径段落。
   */
  private renderDataScopeQualitySections(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    return [
      '【可见范围】',
      `- ${context.result.scopeSummary || '当前用户权限范围'}`,
      '',
      '【限制说明】',
      `- 数据源：${context.result.dataSource === 'OPENAPI_REALTIME' ? 'CRM OpenAPI 实时数据' : 'CRM 同步数据'}；异常接口 ${context.result.errors.length} 项。`,
      '',
      '【影响分析】',
      '- 权限裁剪、字段缺失或接口异常会影响全局判断，不能把局部可见数据直接解释为全公司结论。',
      '',
      '【替代问题】',
      '- 建议改问“当前可见范围内的经营情况”或联系管理员确认全国权限。',
      '',
    ];
  }

  /**
   * 解析动态正文段落名称。
   */
  private resolveSectionNames(templateCode: WecomDashboardTemplateCode): string[] {
    const sectionsByCode: Record<WecomDashboardTemplateCode, string[]> = {
      BUSINESS_OVERVIEW: ['核心经营判断', '业务漏斗与趋势', '区域渠道'],
      FUNNEL_DIAGNOSIS: ['漏斗总览', '三段转化率', '最大断点', '优先动作'],
      CHANNEL_RANKING: ['排行摘要', '多口径榜单', '集中度判断', '头部长尾动作'],
      REGION_COMPARISON: ['区域分层', '重点区域', '异常区域', '负责人动作'],
      CHANNEL_PROFILE: ['渠道分层', '代表渠道', '高潜低转化判断', '激活动作'],
      REGISTRATION_PROTECTION: ['到期统计', '冲突清单', '归属风险', '处理建议'],
      OPPORTUNITY_RISK: ['核心风险', '风险分层', '商机清单', '负责人动作'],
      QUOTE_TO_ORDER: ['预测声明', '转化指标', '优先级清单', '评分解释'],
      RENEWAL_SUCCESS: ['续费概览', '风险客户', '客户成功动作'],
      PRODUCT_SOLUTION: ['产品结构', '高潜方案', '转化断点', '经营建议'],
      SERVICE_ECOSYSTEM: ['生态覆盖', '贡献对比', '覆盖缺口', '发展建议'],
      DISTRIBUTION_HEALTH: ['层级结构', '链路健康', '异常清单', '处理建议'],
      CADENCE_REPORT: ['会议摘要', '本期变化', '风险待办', '负责人动作'],
      DATA_SCOPE_QUALITY: ['可见范围', '限制说明', '影响分析', '替代问题'],
    };
    return sectionsByCode[templateCode];
  }

  /**
   * 渲染经营分析结论。
   *
   * 参数说明：`templateCode` 为当前模板，`context` 为看板上下文。
   * 返回值说明：返回面向经营动作的判断、原因假设和建议，不只复述数据。
   */
  private renderAnalysisConclusionLines(
    templateCode: WecomDashboardTemplateCode,
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    const mainContradiction = this.resolveMainContradiction(context);
    const actionAdvice = this.resolveTemplateActionAdvice(templateCode, context);
    const orderJudgement = context.hasOrderData
      ? '已有订单数据，可把订单贡献作为结果指标，并用报价和商机解释前置原因。'
      : '订单结果样本不足，当前应把商机、报价和阶段推进作为经营前置指标，不能直接判断真实成交能力。';

    const conclusionByTemplate: Record<WecomDashboardTemplateCode, string[]> = {
      BUSINESS_OVERVIEW: [
        `经营判断：${context.result.executiveSummary || '当前看板已生成，需结合漏斗、区域、渠道和数据质量综合判断。'}`,
        `主要矛盾：${mainContradiction}`,
        `建议动作：${actionAdvice}`,
      ],
      FUNNEL_DIAGNOSIS: [
        `转化判断：${this.resolveFunnelJudgement(context)}`,
        `经营影响：断点阶段会直接影响后续报价、订单和收入确认节奏。`,
        `建议动作：${actionAdvice}`,
      ],
      CHANNEL_RANKING: [
        `贡献判断：${this.resolveConcentrationJudgement(context)}`,
        `结构影响：头部过高会带来依赖风险，长尾过散会拉低运营效率。`,
        `建议动作：${actionAdvice}`,
      ],
      REGION_COMPARISON: [
        `区域判断：${this.resolveRegionCoverageJudgement(context)}`,
        `差异影响：区域覆盖和产出不均衡时，需要区分资源缺口、渠道能力和负责人推进效率。`,
        `建议动作：${actionAdvice}`,
      ],
      CHANNEL_PROFILE: [
        `画像判断：需要把渠道按新增、活跃、沉睡、高潜低转化分层，而不是只看渠道总数。`,
        `运营影响：高潜低转化渠道通常卡在售前支持、报价能力或项目推进节奏。`,
        `建议动作：${actionAdvice}`,
      ],
      REGISTRATION_PROTECTION: [
        `保护判断：报备保护问题优先看即将到期、重复报备、待审批和驳回原因。`,
        `经营影响：保护期占用但未转商机会造成客户资源低效沉淀。`,
        `建议动作：${actionAdvice}`,
      ],
      OPPORTUNITY_RISK: [
        `风险判断：商机风险应优先识别高金额、预计签约临近、停滞和未报价对象。`,
        `经营影响：高金额商机长期不推进，会放大预测收入和真实成交之间的偏差。`,
        `建议动作：${actionAdvice}`,
      ],
      QUOTE_TO_ORDER: [
        `成交判断：报价只能代表成交前置动作，必须结合订单结果、合同节点和客户决策状态。`,
        `口径影响：${orderJudgement}`,
        `建议动作：${actionAdvice}`,
      ],
      RENEWAL_SUCCESS: [
        `续费判断：续费类问题应先看到期窗口，再看报价、回访和风险客户。`,
        `客户影响：存量客户如果缺少回访和健康度记录，续费风险会被延后暴露。`,
        `建议动作：${actionAdvice}`,
      ],
      PRODUCT_SOLUTION: [
        `产品判断：产品和方案问题不能只看总商机金额，要拆到产品线、报价项和转化断点。`,
        `经营影响：高商机低报价通常意味着方案包装、价格口径或售前支撑不足。`,
        `建议动作：${actionAdvice}`,
      ],
      SERVICE_ECOSYSTEM: [
        `生态判断：技术服务商要同时看签约覆盖、提名转签约和项目贡献。`,
        `能力影响：覆盖不足区域即使有商机，也可能因为交付和售前能力不足导致转化变慢。`,
        `建议动作：${actionAdvice}`,
      ],
      DISTRIBUTION_HEALTH: [
        `层级判断：分销健康度重点看一级二级关系、订单归属和待确认链路。`,
        `协同影响：层级归属不清会影响价格口径、业绩归属和负责人动作。`,
        `建议动作：${actionAdvice}`,
      ],
      CADENCE_REPORT: [
        `节奏判断：经营节奏类问题应把新增、推进、成交、风险和待办放在同一会议视图。`,
        `管理影响：没有负责人和截止时间的风险项，很难形成闭环。`,
        `建议动作：${actionAdvice}`,
      ],
      DATA_SCOPE_QUALITY: [
        `可信判断：${this.resolveDataQualityJudgement(context)}`,
        `权限影响：当前结论只代表当前可见范围，不能自动外推到无权限数据。`,
        `建议动作：${actionAdvice}`,
      ],
    };

    return conclusionByTemplate[templateCode];
  }

  /**
   * 渲染分维度分析。
   *
   * 参数说明：`templateCode` 为当前模板，`context` 为看板上下文。
   * 返回值说明：返回随模板变化的展示维度，确保不同问题不是同一套数据列表。
   */
  private renderDimensionAnalysisLines(
    templateCode: WecomDashboardTemplateCode,
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string[] {
    const topObject = this.resolveTopObject(context, /渠道|排行|服务商|区域|大区/u);
    const dimensionLinesByTemplate: Record<WecomDashboardTemplateCode, string[]> = {
      BUSINESS_OVERVIEW: [
        `漏斗维度：${this.resolveFunnelJudgement(context)}`,
        `区域维度：${this.resolveRegionCoverageJudgement(context)}`,
        `渠道维度：${this.resolveConcentrationJudgement(context)}`,
        `治理维度：${this.resolveDataQualityJudgement(context)}`,
      ],
      FUNNEL_DIAGNOSIS: [
        `阶段量维度：先看报备、商机、报价、订单四段是否连续。`,
        `转化率维度：${this.resolveFunnelJudgement(context)}`,
        `金额质量维度：订单不足时只把商机和报价作为前置信号。`,
        `动作维度：优先处理最低转化阶段，而不是平均分配运营资源。`,
      ],
      CHANNEL_RANKING: [
        `排序口径维度：榜单需要明确按商机、报价还是订单排序。`,
        `头部集中维度：${this.resolveConcentrationJudgement(context)}`,
        `代表渠道维度：当前可优先关注 ${topObject}。`,
        `长尾运营维度：低频但有商机的渠道适合做激活，不应直接淘汰。`,
      ],
      REGION_COMPARISON: [
        `覆盖广度维度：${this.resolveRegionCoverageJudgement(context)}`,
        `产出强弱维度：区域之间只按同一指标对比，例如区域订单金额对区域订单金额、区域商机数对区域商机数。`,
        `异常区域维度：商机高但订单低的区域优先检查报价和合同节点。`,
        `负责人维度：区域问题需要下钻到负责人动作和截止时间。`,
      ],
      CHANNEL_PROFILE: [
        `生命周期维度：区分新增、活跃、沉睡、待激活和高潜低转化。`,
        `产出效率维度：不要只看渠道数量，要看每家渠道带来的报备、商机和报价。`,
        `能力短板维度：低转化通常指向售前、报价、跟进频率或客户质量问题。`,
        `运营动作维度：高潜渠道给资源，沉睡渠道给唤醒期限，低质量渠道进入复盘。`,
      ],
      REGISTRATION_PROTECTION: [
        `时间窗口维度：优先看 30 天内到期和已经超期对象。`,
        `冲突维度：重复报备要按客户主体、渠道归属和保护期判断。`,
        `审批维度：待审批和驳回堆积会拖慢后续商机创建。`,
        `动作维度：先处理到期和冲突，再处理字段补齐。`,
      ],
      OPPORTUNITY_RISK: [
        `金额维度：高金额商机优先级高于普通停滞商机。`,
        `阶段维度：停在早期、长期未报价、预计签约临近分别对应不同动作。`,
        `时间维度：预计签约临近但无报价应进入管理层提醒。`,
        `负责人维度：每条风险都应落到负责人、下一动作和截止时间。`,
      ],
      QUOTE_TO_ORDER: [
        `报价质量维度：看报价金额、状态、超期和是否关联商机。`,
        `成交概率维度：不能只看报价数量，要看报价后是否形成订单。`,
        `价格风险维度：折扣、区域价格和分销层级会影响成交解释。`,
        `推进动作维度：优先推动高金额、临近成交、缺少合同节点的报价。`,
      ],
      RENEWAL_SUCCESS: [
        `到期窗口维度：先看 30 天、60 天、90 天到期客户。`,
        `风险客户维度：无回访、无报价、低活跃客户优先预警。`,
        `客户成功维度：续费不只是订单动作，还要看健康检查和价值确认。`,
        `动作维度：输出回访、报价、风险升级和责任人。`,
      ],
      PRODUCT_SOLUTION: [
        `产品结构维度：按产品线、模块和方案拆解，不用总金额替代。`,
        `转化断点维度：看产品相关商机是否能进入报价和订单。`,
        `价格工作量维度：缺少工作量或报价项时需要标注口径限制。`,
        `方案动作维度：优先包装高潜行业方案，并补齐售前支持。`,
      ],
      SERVICE_ECOSYSTEM: [
        `覆盖维度：看签约技术服务商覆盖了哪些区域。`,
        `成长维度：提名技术服务商要看是否具备转签约条件。`,
        `贡献维度：按商机、报价、订单分别比较技术服务商参与项目的贡献，不把不同对象混成一个名次。`,
        `能力缺口维度：高商机低技术覆盖区域优先补生态能力。`,
      ],
      DISTRIBUTION_HEALTH: [
        `层级结构维度：区分一级、二级和无层级渠道。`,
        `归属维度：看订单是否存在待一级确认或归属不清。`,
        `价格维度：一级价、二级价和最终折扣需要保持可解释。`,
        `协同维度：跨层级问题要明确上级渠道、下级渠道和处理人。`,
      ],
      CADENCE_REPORT: [
        `周期变化维度：日报看今日变化，周报看推进和风险，月报看趋势和结构。`,
        `待办闭环维度：每个风险项必须有负责人和截止时间。`,
        `会议呈现维度：先讲新增变化，再讲风险，最后讲需要管理层拍板的事项。`,
        `复盘维度：本期未闭环事项要进入下期跟踪。`,
      ],
      DATA_SCOPE_QUALITY: [
        `权限维度：先说明当前用户能看什么、不能看什么。`,
        `字段维度：字段缺失会影响分层、排行和转化判断。`,
        `接口维度：接口异常时必须给出替代口径，不能静默输出结论。`,
        `可信度维度：全国、全平台类问题必须确认是否具备全局权限。`,
      ],
    };

    return dimensionLinesByTemplate[templateCode];
  }

  /**
   * 解析当前主要经营矛盾。
   */
  private resolveMainContradiction(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string {
    if (!context.hasOrderData) {
      return '订单结果数据不足，当前更像“前置机会沉淀”而不是“成交结果充分验证”。';
    }

    const weakestStep = this.resolveWeakestFunnelStep(context);
    if (!/暂无/u.test(weakestStep)) {
      return weakestStep;
    }

    const concentrationJudgement = this.resolveConcentrationJudgement(context);
    if (!/暂无/u.test(concentrationJudgement)) {
      return concentrationJudgement;
    }

    return this.resolveDataQualityJudgement(context);
  }

  /**
   * 解析模板动作建议。
   */
  private resolveTemplateActionAdvice(
    templateCode: WecomDashboardTemplateCode,
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string {
    const adviceByTemplate: Record<WecomDashboardTemplateCode, string> = {
      BUSINESS_OVERVIEW: '先按漏斗断点、头部渠道、重点区域三条线拆解，再给每条线指定负责人和截止时间。',
      FUNNEL_DIAGNOSIS: '把最低转化阶段拉成清单，逐条补负责人、客户状态、下一步动作和预计完成时间。',
      CHANNEL_RANKING: '头部渠道做项目节奏维护，腰部渠道做资源扶持，长尾渠道设置激活期限和淘汰规则。',
      REGION_COMPARISON: '把强区域经验沉淀成打法，把弱区域拆成渠道不足、负责人推进慢或报价断点三类处理。',
      CHANNEL_PROFILE: '按活跃度和转化率分层运营，高潜低转化优先补售前和报价能力。',
      REGISTRATION_PROTECTION: '优先处理即将到期和重复报备，再治理待审批、驳回和字段缺失。',
      OPPORTUNITY_RISK: '优先推进高金额且预计签约临近的未报价商机，并形成负责人待办。',
      QUOTE_TO_ORDER: '先筛高金额、高阶段、临近成交报价，再核合同节点、客户决策人和价格风险。',
      RENEWAL_SUCCESS: '按到期窗口输出客户成功回访清单，先处理高价值和高风险客户。',
      PRODUCT_SOLUTION: '按产品线找高潜低转化方案，补齐售前材料、报价项和行业案例。',
      SERVICE_ECOSYSTEM: '对技术覆盖不足区域补签约服务商，对提名服务商设置转签约标准。',
      DISTRIBUTION_HEALTH: '优先清理待确认订单和归属不清链路，再复核一级二级价格口径。',
      CADENCE_REPORT: '把风险项变成会议待办，明确负责人、截止日期和需要管理层协调的问题。',
      DATA_SCOPE_QUALITY: '先确认权限范围和字段完整度，再决定是否能回答全国或全平台问题。',
    };

    if (!context.hasOrderData && ['BUSINESS_OVERVIEW', 'FUNNEL_DIAGNOSIS', 'QUOTE_TO_ORDER'].includes(templateCode)) {
      return `${adviceByTemplate[templateCode]} 当前还要额外标注订单不足，避免把报价或商机误读为成交。`;
    }

    return adviceByTemplate[templateCode];
  }

  /**
   * 解析漏斗判断。
   */
  private resolveFunnelJudgement(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string {
    const stages = context.funnelBlock?.stages ?? [];
    if (stages.length === 0) {
      return '暂无完整漏斗阶段，无法判断哪个环节真正拖慢转化。';
    }

    return this.resolveWeakestFunnelStep(context);
  }

  /**
   * 解析集中度判断。
   */
  private resolveConcentrationJudgement(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string {
    const topTier = context.concentrationBlock?.tiers?.[0];
    if (!topTier) {
      return '暂无可计算集中度，当前不能判断头部依赖或长尾分散程度。';
    }

    if (topTier.percentage >= 80) {
      return `${topTier.label} 占比 ${topTier.percentage}%，头部依赖偏高，需要同时维护头部和激活腰尾。`;
    }

    if (topTier.percentage >= 50) {
      return `${topTier.label} 占比 ${topTier.percentage}%，贡献有一定集中度，可继续观察腰部渠道承接能力。`;
    }

    return `${topTier.label} 占比 ${topTier.percentage}%，贡献较分散，建议优先筛选可复制的高质量渠道样本。`;
  }

  /**
   * 解析区域覆盖判断。
   */
  private resolveRegionCoverageJudgement(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string {
    const block = context.geoBlock;
    if (!block) {
      return '暂无区域覆盖数据，不能判断区域强弱和空白市场。';
    }

    const coveredCount = block.coveredRegionCount ?? block.regions.length;
    const totalCount = block.totalRegionCount ?? 31;
    const coverageRate = totalCount > 0 ? coveredCount / totalCount : 0;
    const rateText = `${(coverageRate * 100).toFixed(1)}%`;
    if (coverageRate < 0.3) {
      return `当前覆盖 ${coveredCount}/${totalCount}，覆盖率 ${rateText}，区域覆盖偏低，应优先补齐空白区域和重点区域渠道。`;
    }

    if (coverageRate < 0.7) {
      return `当前覆盖 ${coveredCount}/${totalCount}，覆盖率 ${rateText}，区域覆盖中等，应继续比较各区域产出效率。`;
    }

    return `当前覆盖 ${coveredCount}/${totalCount}，覆盖率 ${rateText}，覆盖较广，应重点看区域产出差异和资源效率。`;
  }

  /**
   * 解析数据质量判断。
   */
  private resolveDataQualityJudgement(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
  ): string {
    if (context.result.errors.length > 0) {
      return `存在 ${context.result.errors.length} 个接口或数据异常，结论需要带异常口径使用。`;
    }

    const hasUnsetSegment = context.pieBlocks.some((block) =>
      block.segments.some((segment) => /未设置|未知|unknown/i.test(segment.name)),
    );
    if (hasUnsetSegment) {
      return '存在未设置或未知分布项，分层、排行和结构判断会被稀释。';
    }

    return '未发现明显接口异常，但仍需以当前权限范围和已返回字段为准。';
  }

  /**
   * 解析代表对象。
   */
  private resolveTopObject(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
    titlePattern: RegExp,
  ): string {
    const table = context.tableBlocks.find((block) => titlePattern.test(block.title)) ?? context.tableBlocks[0];
    const row = table?.rows?.[0];
    return String(row?.name ?? row?.partnerName ?? row?.region ?? row?.bigRegion ?? row?.ownerName ?? '当前榜单首位对象');
  }

  /**
   * 渲染漏斗阶段和转化率摘要。
   */
  private renderFunnelLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    return [...this.renderFunnelStageLines(context), ...this.renderFunnelRateLines(context)];
  }

  /**
   * 渲染漏斗阶段数量。
   */
  private renderFunnelStageLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    const stages = context.funnelBlock?.stages ?? [];
    if (stages.length === 0) {
      return ['暂无漏斗阶段数据，建议检查报备、商机、报价、订单统计接口。'];
    }

    return [`阶段量：${stages.map((stage) => `${stage.name}${stage.value}`).join(' -> ')}`];
  }

  /**
   * 渲染漏斗转化率。
   */
  private renderFunnelRateLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    const stages = context.funnelBlock?.stages ?? [];
    const lines = stages.flatMap((stage, index) => {
      if (index === 0 || typeof stage.rate !== 'number') {
        return [];
      }

      return [`${stages[index - 1].name}到${stage.name}：${(stage.rate * 100).toFixed(1)}%`];
    });
    return lines.length > 0 ? lines : ['暂无可计算转化率。'];
  }

  /**
   * 解析最大漏斗断点。
   */
  private resolveWeakestFunnelStep(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string {
    const stages = context.funnelBlock?.stages ?? [];
    const weakest = stages
      .map((stage, index) => ({ stage, index }))
      .filter((item) => item.index > 0 && typeof item.stage.rate === 'number')
      .sort((left, right) => (left.stage.rate ?? 1) - (right.stage.rate ?? 1))[0];
    if (!weakest) {
      return '暂无可计算断点，建议补齐阶段转化率。';
    }

    return `${stages[weakest.index - 1].name}到${weakest.stage.name}转化率最低，为 ${((weakest.stage.rate ?? 0) * 100).toFixed(1)}%。`;
  }

  /**
   * 渲染集中度摘要。
   */
  private renderConcentrationLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    const block = context.concentrationBlock;
    if (!block || block.tiers.length === 0) {
      return ['暂无可计算集中度。'];
    }

    return [
      ...block.tiers.slice(0, 3).map((tier) => `${tier.label} 占比 ${tier.percentage}%`),
      ...(typeof block.oneTimeCount === 'number' ? [`长尾渠道 ${block.oneTimeCount} 家`] : []),
    ];
  }

  /**
   * 渲染区域摘要。
   */
  private renderRegionLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    const block = context.geoBlock;
    if (!block) {
      return ['暂无区域覆盖数据。'];
    }

    const topRegions = [...block.regions].sort((left, right) => right.value - left.value).slice(0, 5);
    return [
      `覆盖范围：${block.coveredRegionCount ?? topRegions.length}/${block.totalRegionCount ?? 31}`,
      `重点区域：${topRegions.map((region) => `${region.name}${region.value}`).join('，') || '暂无'}`,
    ];
  }

  /**
   * 渲染排行摘要。
   */
  private renderRankingLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    const table = context.tableBlocks.find((block) => /渠道|排行|服务商/u.test(block.title)) ?? context.tableBlocks[0];
    if (!table || table.rows.length === 0) {
      return ['暂无渠道排行数据。'];
    }

    return [
      this.renderAmountRankingLine(table.rows, 'quoteAmount', '报价金额前3'),
      this.renderAmountRankingLine(table.rows, 'orderAmount', '订单金额前3', '暂无真实订单金额沉淀，当前不输出下单排行结论。'),
      ...this.renderTableTopLines(context, /渠道|排行|服务商/u),
    ];
  }

  /**
   * 渲染结构分布摘要。
   */
  private renderStructureLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    const lines = context.pieBlocks.flatMap((block) => {
      const topSegments = block.segments.slice(0, 5).map((segment) => `${segment.name}${segment.value}${block.unitLabel ?? ''}`);
      return topSegments.length > 0 ? [`${block.title}：${topSegments.join('，')}`] : [];
    });
    return lines.length > 0 ? lines : ['暂无结构分布数据。'];
  }

  /**
   * 按关键词渲染 KPI 指标。
   */
  private renderKpiMatchLines(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
    pattern: RegExp,
  ): string[] {
    const metrics = context.kpiBlock?.metrics ?? [];
    const lines = metrics
      .filter((metric) => pattern.test(metric.label))
      .map((metric) => `${metric.label}：${metric.value}${metric.unit ?? ''}`);
    return lines.length > 0 ? lines : ['当前看板未返回该类专项指标，已按现有指标兜底分析。'];
  }

  /**
   * 渲染趋势或 KPI 摘要。
   */
  private renderTrendOrKpiLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    const trendBlock = this.findBlock(context.result.blocks, 'composite-trend');
    if (trendBlock) {
      return trendBlock.barSeries.slice(0, 3).map((series) => `${series.name}近${series.values.length}期：${series.values.join('、')}`);
    }

    return this.renderKpiMatchLines(context, /渠道|报备|商机|报价|订单|金额/u);
  }

  /**
   * 渲染表格 TOP 摘要。
   */
  private renderTableTopLines(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
    titlePattern: RegExp,
  ): string[] {
    const table = context.tableBlocks.find((block) => titlePattern.test(block.title)) ?? context.tableBlocks[0];
    if (!table || table.rows.length === 0) {
      return ['暂无可摘要明细。'];
    }

    return table.rows.slice(0, 3).map((row, index) => {
      const name = String(row.name ?? row.region ?? row.bigRegion ?? row.ownerName ?? row.customerName ?? `第${index + 1}项`);
      const metricLabel = this.resolveComparisonMetricLabel(table.title);
      const metricValue = this.resolveRowMetricValue(row, metricLabel);
      const amount = metricValue === undefined ? row.amount ?? row.quoteAmount ?? row.opportunityAmount ?? row.orderAmount : undefined;
      const count = metricValue === undefined ? row.count ?? row.registrationCount ?? row.opportunityCount ?? row.quoteCount ?? row.orderCount : undefined;
      const parts = [`${index + 1}. ${name}`];
      if (metricLabel && metricValue !== undefined) {
        parts.push(`${metricLabel}${this.formatMetricValue(metricLabel, metricValue)}`);
      }
      if (amount !== undefined) {
        parts.push(`金额${amount}`);
      }
      if (count !== undefined) {
        parts.push(`数量${count}`);
      }
      return parts.join('，');
    });
  }

  /**
   * 渲染明细摘要。
   */
  private renderDetailLines(context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>): string[] {
    const lines = context.tableBlocks.slice(0, 3).map((block) => `${block.title}：共 ${block.rows.length} 条，已摘要前 ${Math.min(3, block.rows.length)} 条。`);
    return lines.length > 0 ? lines : ['当前未返回可摘要明细，建议继续追问具体区域、渠道或风险清单。'];
  }

  /**
   * 渲染风险建议。
   */
  private renderRiskLines(
    context: ReturnType<WecomDashboardMarkdownRendererService['buildContext']>,
    templateCode: WecomDashboardTemplateCode,
  ): string[] {
    const lines: string[] = [];
    if (!context.hasOrderData) {
      lines.push('问题：订单数据不足；影响：不能把商机金额或报价金额直接解释为真实成交；建议：继续跟进报价转订单节点。');
    }
    if (context.result.errors.length > 0) {
      lines.push(`存在 ${context.result.errors.length} 个接口或数据异常，建议复核数据源状态。`);
    }
    if (templateCode === 'DATA_SCOPE_QUALITY') {
      lines.push('需要持续保留权限口径和替代口径，避免局部数据被误读为全局结论。');
    }
    lines.push(...context.pieBlocks.flatMap((block) =>
      block.segments.some((segment) => /未设置|未知|unknown/i.test(segment.name))
        ? [`问题：${block.title}存在未设置项；影响：结构判断会被稀释；建议：补齐字段后再做精细分层。`]
        : [],
    ));
    return lines.length > 0 ? lines : ['暂无明显数据风险，建议按模板继续下钻明细和负责人动作。'];
  }

  /**
   * 渲染指定金额字段的排行摘要。
   *
   * 参数说明：`rows` 为明细行，`amountField` 为金额字段，`label` 为输出标题。
   * 返回值说明：返回前 3 名金额排行；没有有效金额时返回明确兜底说明。
   */
  private renderAmountRankingLine(
    rows: Array<Record<string, unknown>>,
    amountField: 'quoteAmount' | 'orderAmount' | 'opportunityAmount',
    label: string,
    emptyText = '暂无可计算金额排行。',
  ): string {
    const rankedRows = rows
      .map((row) => ({
        name: String(row.name ?? row.partnerName ?? row.region ?? row.bigRegion ?? row.ownerName ?? '未命名对象'),
        amount: Number(row[amountField] ?? 0),
      }))
      .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 3);

    if (rankedRows.length === 0) {
      return `${label}：${emptyText}`;
    }

    return `${label}：${rankedRows.map((row) => `${row.name}${this.formatWan(row.amount)}`).join('；')}`;
  }

  /**
   * 格式化万元金额。
   */
  private formatWan(amount: number): string {
    return `${(amount / 10000).toFixed(2)}万`;
  }

  /**
   * 从标题解析同类对比指标。
   */
  private resolveComparisonMetricLabel(title: string): string | undefined {
    const byMetric = title.match(/按(.+?)）/u)?.[1];
    if (byMetric) {
      return byMetric;
    }

    return title.match(/(?:区域|大区|渠道|负责人|团队)(.+?)(?:排行|对比|明细)/u)?.[1];
  }

  /**
   * 读取同一指标对应的行值。
   */
  private resolveRowMetricValue(row: Record<string, unknown>, metricLabel?: string): number | undefined {
    if (!metricLabel) {
      return undefined;
    }

    const fieldByMetric: Array<[RegExp, string[]]> = [
      [/订单金额/u, ['orderAmount', 'amount']],
      [/报价金额/u, ['quoteAmount', 'amount']],
      [/商机金额/u, ['opportunityAmount', 'oppAmount', 'amount']],
      [/订单数|下单数/u, ['orderCount', 'count']],
      [/报价数/u, ['quoteCount', 'count']],
      [/商机数/u, ['opportunityCount', 'oppCount', 'count']],
      [/报备数/u, ['registrationCount', 'count']],
    ];
    const fields = fieldByMetric.find(([pattern]) => pattern.test(metricLabel))?.[1] ?? [];
    for (const field of fields) {
      const value = Number(row[field] ?? 0);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * 格式化同类对比指标值。
   */
  private formatMetricValue(metricLabel: string, value: number): string {
    if (/金额/u.test(metricLabel)) {
      const normalizedValue = Math.abs(value) >= 10000 ? value / 10000 : value;
      return `${normalizedValue.toFixed(2)}万`;
    }

    if (/订单|下单/u.test(metricLabel)) {
      return `${Number(value.toFixed(2))}单`;
    }

    return `${Number(value.toFixed(2))}个`;
  }

  /**
   * 解析建议追问。
   */
  private resolveFollowUpQuestions(templateCode: WecomDashboardTemplateCode): string[] {
    const questionsByCode: Record<WecomDashboardTemplateCode, string[]> = {
      BUSINESS_OVERVIEW: ['按区域拆分经营贡献。', '查看报价转订单风险清单。', '生成经营会摘要。'],
      FUNNEL_DIAGNOSIS: ['查看最大断点明细。', '按区域比较转化率。', '列出报价未转订单清单。'],
      CHANNEL_RANKING: ['查看 TOP10 渠道明细。', '分析长尾渠道激活动作。', '按商机金额重新排序。'],
      REGION_COMPARISON: ['查看山东区明细。', '按负责人拆分区域表现。', '找出低活跃区域。'],
      CHANNEL_PROFILE: ['列出沉睡渠道。', '找出高潜低转化渠道。', '生成渠道激活清单。'],
      REGISTRATION_PROTECTION: ['列出即将到期报备。', '查看重复报备客户。', '按负责人拆分待审批。'],
      OPPORTUNITY_RISK: ['列出高金额风险商机。', '查看预计签约但未报价商机。', '按负责人生成待办。'],
      QUOTE_TO_ORDER: ['查看本周高优先级报价。', '解释评分原因。', '列出超期报价。'],
      RENEWAL_SUCCESS: ['查看 30 天到期客户。', '列出续费风险原因。', '生成客户成功回访清单。'],
      PRODUCT_SOLUTION: ['按产品线拆分商机。', '查看高潜方案。', '分析产品转化断点。'],
      SERVICE_ECOSYSTEM: ['查看签约技术服务商贡献。', '列出转签约候选。', '按区域看覆盖缺口。'],
      DISTRIBUTION_HEALTH: ['查看一级二级渠道链路。', '列出待确认订单。', '分析异常归属。'],
      CADENCE_REPORT: ['生成晨会摘要。', '列出本周风险待办。', '输出下周期动作。'],
      DATA_SCOPE_QUALITY: ['查看当前权限口径。', '列出字段缺失影响。', '改为当前可见范围分析。'],
    };
    return questionsByCode[templateCode];
  }

  /**
   * 判断是否存在真实订单数据。
   */
  private hasOrderData(
    funnelBlock: Extract<DashboardBlock, { blockType: 'funnel' }> | undefined,
    tableBlocks: Array<Extract<DashboardBlock, { blockType: 'sortable-table' }>>,
  ): boolean {
    const funnelHasOrder = (funnelBlock?.stages ?? []).some((stage) => /订单/u.test(stage.name) && stage.value > 0 && (stage.amount ?? 0) > 0);
    const tableHasOrder = tableBlocks.some((block) => block.rows.some((row) => Number(row.orderAmount ?? 0) > 0 || Number(row.orderCount ?? 0) > 0));
    return funnelHasOrder || tableHasOrder;
  }

  /**
   * 查找指定类型区块。
   */
  private findBlock<T extends DashboardBlock['blockType']>(
    blocks: DashboardBlock[],
    blockType: T,
  ): Extract<DashboardBlock, { blockType: T }> | undefined {
    return blocks.find((block) => block.blockType === blockType) as Extract<DashboardBlock, { blockType: T }> | undefined;
  }

  /**
   * 过滤指定类型区块。
   */
  private filterBlocks<T extends DashboardBlock['blockType']>(
    blocks: DashboardBlock[],
    blockType: T,
  ): Array<Extract<DashboardBlock, { blockType: T }>> {
    return blocks.filter((block) => block.blockType === blockType) as Array<Extract<DashboardBlock, { blockType: T }>>;
  }

  /**
   * 给多行内容统一加前缀。
   */
  private prefix(lines: string[], prefix: string): string[] {
    return lines.map((line) => `${prefix}${line}`);
  }
}
