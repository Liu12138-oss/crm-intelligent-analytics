/**
 * 企微看板展示模板解析服务。
 *
 * 设计目的：
 * - 根据用户问题、报告标题和看板区块，为本次企微回复选择 14 类展示模板。
 * - 解析结果只用于展示编排，不扩大数据查询范围，不替代权限判断。
 */

import { Injectable } from '@nestjs/common';
import {
  resolveCrmAnalysisQuestionTemplateRuleByText,
} from '../analysis/crm-analysis-question-template.registry';
import type { CrmAnalysisPresentationTemplateType } from '../../shared/types/domain';
import type { DashboardBlock } from '../crm-standard-api/dashboard-report-composer.service';
import {
  DEFAULT_WECOM_DASHBOARD_TEMPLATE,
  WECOM_DASHBOARD_TEMPLATE_DEFINITIONS,
  resolveWecomDashboardTemplateDefinition,
  type WecomDashboardTemplateCode,
  type WecomDashboardTemplateDefinition,
} from './wecom-dashboard-template.registry';

const CRM_ANALYSIS_TEMPLATE_TO_WECOM_DASHBOARD_TEMPLATE: Record<
  CrmAnalysisPresentationTemplateType,
  WecomDashboardTemplateCode
> = {
  BUSINESS_OVERVIEW: 'BUSINESS_OVERVIEW',
  FUNNEL_DIAGNOSIS: 'FUNNEL_DIAGNOSIS',
  REGION_COMPARISON: 'REGION_COMPARISON',
  CHANNEL_RANKING: 'CHANNEL_RANKING',
  CHANNEL_PROFILE: 'CHANNEL_PROFILE',
  DISTRIBUTION_HIERARCHY: 'DISTRIBUTION_HEALTH',
  TECH_SERVICE_ECOSYSTEM: 'SERVICE_ECOSYSTEM',
  REGISTRATION_PROTECTION: 'REGISTRATION_PROTECTION',
  OPPORTUNITY_RISK: 'OPPORTUNITY_RISK',
  QUOTE_ORDER_CONVERSION: 'QUOTE_TO_ORDER',
  DATA_SCOPE_QUALITY: 'DATA_SCOPE_QUALITY',
  OPERATING_CADENCE: 'CADENCE_REPORT',
  PRODUCT_SOLUTION_STRUCTURE: 'PRODUCT_SOLUTION',
  CUSTOMER_SUCCESS_RENEWAL: 'RENEWAL_SUCCESS',
  OWNER_ORG_COLLABORATION: 'CADENCE_REPORT',
  ALERT_AUDIT_GOVERNANCE: 'DATA_SCOPE_QUALITY',
};

/**
 * 展示模板解析参数。
 */
export interface ResolveWecomDashboardTemplateParams {
  questionText: string;
  reportTitle: string;
  blocks: DashboardBlock[];
}

@Injectable()
export class WecomDashboardTemplateResolverService {
  /**
   * 解析企微看板展示模板。
   *
   * 参数说明：`params` 包含用户原问题、报告标题和看板区块。
   * 返回值说明：返回命中分数最高的模板定义；没有明确命中时返回经营总览兜底模板。
   * 调用注意事项：用户问题权重最高，报告标题次之，区块标题只做弱兜底。
   */
  resolve(params: ResolveWecomDashboardTemplateParams): WecomDashboardTemplateDefinition {
    const normalizedQuestion = this.normalizeText(params.questionText);
    const catalogTemplate = this.resolveFromCrmAnalysisQuestionCatalog(normalizedQuestion);
    if (catalogTemplate) {
      return catalogTemplate;
    }

    const normalizedReportTitle = this.normalizeText(params.reportTitle);
    const normalizedBlockText = this.normalizeText(
      params.blocks.map((block) => `${block.blockType} ${block.title}`).join(' '),
    );

    const scoredTemplates = WECOM_DASHBOARD_TEMPLATE_DEFINITIONS.map((template, index) => ({
      template,
      index,
      score:
        this.countPatternMatches(template.questionPatterns, normalizedQuestion) * 10 +
        this.countPatternMatches(template.reportTitlePatterns, normalizedReportTitle) * 3 +
        this.countPatternMatches(template.reportTitlePatterns, normalizedBlockText),
    })).sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });

    const best = scoredTemplates[0];
    if (!best || best.score <= 0) {
      return DEFAULT_WECOM_DASHBOARD_TEMPLATE;
    }

    return best.template;
  }

  /**
   * 从 CRM 智能分析 300 问目录解析展示模板。
   *
   * 参数说明：`questionText` 为标准化后的用户问题。
   * 返回值说明：命中目录时返回映射后的 14 类企微看板模板。
   * 调用注意事项：目录命中优先级高于散落关键词，避免 300 问验收口径与企微卡片分叉。
   */
  private resolveFromCrmAnalysisQuestionCatalog(
    questionText: string,
  ): WecomDashboardTemplateDefinition | undefined {
    const catalogRule = resolveCrmAnalysisQuestionTemplateRuleByText(questionText);
    if (!catalogRule) {
      return undefined;
    }
    if (!this.shouldUseCatalogRule(questionText, catalogRule.templateType)) {
      return undefined;
    }

    return resolveWecomDashboardTemplateDefinition(
      CRM_ANALYSIS_TEMPLATE_TO_WECOM_DASHBOARD_TEMPLATE[catalogRule.templateType],
    );
  }

  /**
   * 判断是否采用 300 问目录命中结果。
   *
   * 参数说明：`questionText` 为用户问题，`templateType` 为目录命中的模板类型。
   * 返回值说明：返回 true 时优先使用目录映射，否则回退 14 类看板关键词解析。
   * 调用注意事项：数据质量模板容易被“全国”等宽泛词命中，必须确认问题确实在问权限、口径或质量。
   */
  private shouldUseCatalogRule(
    questionText: string,
    templateType: CrmAnalysisPresentationTemplateType,
  ): boolean {
    if (templateType !== 'DATA_SCOPE_QUALITY') {
      return true;
    }

    return /权限|口径|数据源|数据质量|字段|可见|看不到|不能看|可信|OpenAPI|AI\s*agent|审计|治理|下钻|越权|角色|指标变化|正常波动|重点标红|人工介入|建议动作/iu.test(questionText);
  }

  /**
   * 统计正则命中数量。
   *
   * 参数说明：`patterns` 为模板识别规则，`text` 为待识别文本。
   * 返回值说明：返回命中的规则数量。
   */
  private countPatternMatches(patterns: RegExp[], text: string): number {
    return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
  }

  /**
   * 标准化待识别文本。
   *
   * 参数说明：`text` 为用户问题、报告标题或区块标题拼接结果。
   * 返回值说明：返回去除多余空白后的文本。
   */
  private normalizeText(text: string): string {
    return text.replace(/\s+/gu, ' ').trim();
  }
}
