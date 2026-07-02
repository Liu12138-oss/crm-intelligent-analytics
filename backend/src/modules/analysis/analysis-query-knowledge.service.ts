import { Injectable } from '@nestjs/common';
import { QueryTemplateRepository } from '../query-assets/query-template.repository';
import { AnalysisSemanticKnowledgeRepository } from '../governance/analysis-semantic-knowledge.repository';
import type {
  AnalysisExecutionTraceSummary,
  AnalysisSemanticKnowledgeAssetRecord,
} from '../../shared/types/domain';
import {
  getAnalysisTopicReportProfile,
  inferAnalysisFacetProfile,
} from './analysis-topic-report.registry';

interface AliasRule {
  canonicalLabel: string;
  synonyms: string[];
  hint: string;
}

interface ValidatedQueryExample {
  id: string;
  name: string;
  questionText: string;
  keywords: string[];
  sqlHint: string;
}

export interface AnalysisQueryKnowledgeCandidate {
  source: 'GOVERNED_TEMPLATE' | 'VALIDATED_EXAMPLE';
  templateId?: string;
  name: string;
  questionText: string;
  score: number;
  sqlHint?: string;
}

export interface AnalysisQueryKnowledgeContext {
  aliasHints: string[];
  templateCandidates: AnalysisQueryKnowledgeCandidate[];
  codebookHints: string[];
  normalizationRules: string[];
  temporalFieldHints: string[];
  temporalExampleHints: string[];
  readonlyBoundaryHints: string[];
  topicAssetHints: string[];
  workflowHints: string[];
  knowledgeHits: Array<{
    assetId: string;
    assetType: AnalysisExecutionTraceSummary['knowledgeHits'][number]['assetType'];
    source: 'PUBLISHED_ASSET' | 'STATIC_FALLBACK' | 'GOVERNED_TEMPLATE';
    name: string;
    detail?: string;
  }>;
  blockedReason?: string;
}

const QUERY_ALIAS_RULES: AliasRule[] = [
  {
    canonicalLabel: '转合同金额',
    synonyms: ['签约金额', '合同金额', '成交金额', '签单金额', '赢单金额'],
    hint: '签约金额 -> 转合同金额',
  },
  {
    canonicalLabel: '新增商机金额',
    synonyms: ['商机额', '机会金额', '商机金额'],
    hint: '商机额 -> 新增商机金额',
  },
  {
    canonicalLabel: '赢单率',
    synonyms: ['赢率', '成交率', '转化率'],
    hint: '赢率 -> 赢单率',
  },
  {
    canonicalLabel: '服务商',
    synonyms: ['渠道商', '渠道', '合作伙伴', '代理商', '经销商', '合作渠道'],
    hint: '渠道商/渠道/合作伙伴/代理商 -> 服务商',
  },
  {
    canonicalLabel: '订单金额',
    synonyms: ['下单金额', '成单金额', '成交订单金额', '订单总金额'],
    hint: '下单金额/成单金额 -> 订单金额',
  },
  {
    canonicalLabel: '报价金额',
    synonyms: ['报价总金额', '报价单金额'],
    hint: '报价总金额/报价单金额 -> 报价金额',
  },
  {
    canonicalLabel: '超过两周未更新商机',
    synonyms: ['超两周未更新商机', '超过14天没更新商机', '长期没跟进商机', '停滞商机', '没有进展的商机'],
    hint: '超两周未更新/长期没跟进/停滞商机 -> 超过两周未更新商机',
  },
  {
    canonicalLabel: '未活跃客户',
    synonyms: ['沉默客户', '最近30天没有活跃的客户', '没有活动客户', '长期未跟进客户'],
    hint: '沉默客户/没有活动客户 -> 未活跃客户',
  },
  {
    canonicalLabel: '有报价未下单',
    synonyms: ['有报价但未下单', '有报价但还没下单', '报价未转订单', '报价未下单', '有报价无订单'],
    hint: '有报价但未下单/报价未转订单 -> 报价未匹配有效订单客户',
  },
  {
    canonicalLabel: '漏斗转化',
    synonyms: ['报备到订单', '报备到商机', '商机到订单', '商机转报价', '报价转订单', '转化漏斗'],
    hint: '报备/商机/报价/订单转化 -> 漏斗转化',
  },
  {
    canonicalLabel: '有效订单',
    synonyms: ['成交订单', '确认订单', '已完成订单', '有效成交'],
    hint: '有效订单 -> confirmed/completed 计入，pending/processing 仅作为过程订单',
  },
  {
    canonicalLabel: 'contracts.received_payments_amount',
    synonyms: ['已回款', '回款金额', '到账金额'],
    hint: '已回款 -> contracts.received_payments_amount',
  },
];

const QUERY_CODEBOOK_HINTS = [
  '销售阶段字段使用 field_values 映射，不得直接把 stage 数值当中文标签输出。',
  '合同生效优先看首付款到账，不得只把 contracts.status 当成财务生效口径。',
  '回款按区域统计时必须通过 contract_id 关联 contracts.department_id，不能直接使用 received_payments.organization_id。',
  '联软有效订单默认仅统计 confirmed/completed；pending/processing 作为过程订单展示，rejected/cancelled/deleted 排除。',
  '联软报价状态需中文化展示：draft=草稿、submitted=已提交、approved=已通过、rejected=已驳回、converted=已转订单。',
  '联软订单状态需中文化展示：pending=待处理、processing=处理中、confirmed=已确认、completed=已完成、rejected=已驳回。',
];

const QUERY_NORMALIZATION_RULES = [
  '按部门、区域、团队汇总时必须先应用归一部门规则，不能直接按原始部门名分组。',
  '涉及山东区、团队、大区等组织表达时，必须优先使用已批准的组织别名和归一规则。',
];

const TEMPORAL_FIELD_HINTS = [
  '商机新增默认使用 opportunities.created_at，可选口径需显式说明；不得使用 updated_at、deleted_at 或未白名单字段。',
  '合同签单默认使用 contracts.created_at（CRM 原始数据页的提交日期），并按审批已通过且审批完成时间不晚于统计结束边界收口；回款口径必须先确认是否查询签约、到账或生效，不得混用时间字段。',
  '客户新增默认使用 customers.created_at，客户活跃、跟进或贡献度不得擅自改用最近更新时间。',
  '联软渠道 CRM 中订单区域和报价区域优先使用标准化 region/bigRegion，联软已按对象、商机、渠道和负责人继承规则补齐。',
  '超两周未更新商机使用 opportunities.updatedAt 或分析库 source_updated_at，且阶段不应处于已成交或已失单。',
  '联软未活跃客户默认按最近 30 天无报备/商机/报价/订单更新；若用户要求跟进口径，应先追问或说明当前使用业务对象更新时间替代。',
];

const TEMPORAL_EXAMPLE_HINTS = [
  '正例：最近四个月、近 6 月、过去 12 个月、上季度、去年同期、2026 年一季度、本财年都应进入 temporalSlot，由 AI 输出 startAt/endAt。',
  '反例：不得把“那段时间”“之前那会儿”猜成全量历史；低置信时必须补问或阻断。',
];

const READONLY_BOUNDARY_HINTS = [
  '只读工具边界：AI 只能生成 SELECT 草案，最终仍由字段白名单、权限注入、AST 校验、预检、行数限制和超时限制决定是否执行。',
  '模板优先：若命中治理模板或已验证示例，应优先沿用对象、过滤条件、输出字段和时间字段口径，不从零猜测 schema。',
];

const HERMES_WORKFLOW_HINTS = [
  'Hermes 工作流：模板优先，然后依次明确对象、过滤条件、输出字段和结果组织方式。',
  'Hermes 工作流：命中主题报告包时，优先复用推荐区块和已验证示例，不完全依赖模型自由发挥。',
];

const VALIDATED_QUERY_EXAMPLES: ValidatedQueryExample[] = [
  {
    id: 'validated-opportunity-ranking',
    name: '新增商机金额排行',
    questionText: '本月各销售负责人新增商机金额排名',
    keywords: ['本月', '销售负责人', '新增商机金额', '排名'],
    sqlHint:
      '优先从 opportunities 聚合 expect_amount，并按 users.name 分组后做 owner-ranking。',
  },
  {
    id: 'validated-contract-trend',
    name: '转合同金额趋势',
    questionText: '近三个月各区域转合同金额趋势',
    keywords: ['近三个月', '区域', '转合同金额', '趋势'],
    sqlHint:
      '优先通过 contracts 关联 contract_assets 的 numeric_asset_7ee237 聚合合同有效收入，并按 contracts.created_at 生成 time-trend 结果。',
  },
  {
    id: 'validated-payment-summary',
    name: '已回款汇总',
    questionText: '本月各区域已回款情况',
    keywords: ['本月', '区域', '已回款'],
    sqlHint:
      '已回款相关聚合优先消费 contracts.received_payments_amount，并保留通过合同部门归属做区域汇总的口径约束。',
  },
  {
    id: 'validated-lianruan-region-order-summary',
    name: '联软区域订单金额汇总',
    questionText: '山东区域本月订单金额是多少',
    keywords: ['山东区域', '本月', '订单金额'],
    sqlHint:
      '联软分析库优先使用 fact_lianruan_order.region/big_region 裁剪区域，按 deal_at 或 created_at 落时间口径，金额取 amount。',
  },
  {
    id: 'validated-lianruan-stale-opportunities',
    name: '联软超两周未更新商机',
    questionText: '本区域超两周未更新的商机有哪些',
    keywords: ['本区域', '超过两周未更新商机', '商机'],
    sqlHint:
      '使用 fact_lianruan_opportunity.source_updated_at 判断超过 14 天未更新，并排除 won/lost 或已成交/已失单阶段。',
  },
  {
    id: 'validated-lianruan-funnel',
    name: '联软报备到订单转化漏斗',
    questionText: '报备到订单整体转化率是多少',
    keywords: ['报备', '订单', '转化率', '漏斗'],
    sqlHint:
      '漏斗口径依次统计报备数、商机数、报价数、订单数；关联优先 customer_id，报价看 opportunity_id，订单看 quote_id/customer_id。',
  },
  {
    id: 'validated-lianruan-quote-without-order',
    name: '联软有报价未下单客户',
    questionText: '找出有报价但未下单的客户，并按报价金额排序',
    keywords: ['报价', '未下单', '客户', '报价金额'],
    sqlHint:
      '使用 fact_lianruan_quote 作为主表，左关联 fact_lianruan_order；当前订单缺少 quote_id 时按 customer_id 兜底判断无 confirmed/completed 有效订单。',
  },
  {
    id: 'validated-lianruan-monthly-briefing',
    name: '联软本月经营简报',
    questionText: '生成本月经营简报',
    keywords: ['本月', '经营简报', '报备', '商机', '报价', '订单'],
    sqlHint:
      '拆成订单、报价、商机、报备、渠道贡献、风险项多个子任务，企微输出摘要和重点表格，Web 展示完整报告和审计。',
  },
  {
    id: 'validated-lianruan-partner-activity',
    name: '联软渠道活跃度排行',
    questionText: '渠道活跃度排行',
    keywords: ['渠道', '活跃度', '排行'],
    sqlHint:
      '默认近 30 天，综合报备、商机、报价、订单最近更新时间；时间缺失时必须说明默认周期。',
  },
];

@Injectable()
export class AnalysisQueryKnowledgeService {
  constructor(
    private readonly queryTemplateRepository: QueryTemplateRepository,
    private readonly analysisSemanticKnowledgeRepository?: AnalysisSemanticKnowledgeRepository,
  ) {}

  /**
   * 构造受控直查可消费的统一知识上下文。
   *
   * 这里的目标不是替代权限或 SQL 安全栈，而是把问数别名、已验证模板和口径提示
   * 收敛成稳定输入，减少模型每次从零猜字段和业务口径。
   */
  buildKnowledgeContext(questionText: string): AnalysisQueryKnowledgeContext {
    const normalizedQuestion = this.normalizeQuestionByAliases(questionText.trim());
    const publishedAssets = this.listPublishedAssets();
    const knowledgeHits = this.resolveKnowledgeHits(normalizedQuestion, publishedAssets);
    return {
      aliasHints: this.resolveAliasHints(normalizedQuestion),
      templateCandidates: this.resolveTemplateCandidates(normalizedQuestion),
      codebookHints: this.resolveCodebookHints(normalizedQuestion),
      normalizationRules: this.resolveNormalizationRules(normalizedQuestion),
      temporalFieldHints: this.resolveTemporalFieldHints(normalizedQuestion),
      temporalExampleHints: TEMPORAL_EXAMPLE_HINTS,
      readonlyBoundaryHints: READONLY_BOUNDARY_HINTS,
      topicAssetHints: this.resolveTopicAssetHints(normalizedQuestion),
      workflowHints: HERMES_WORKFLOW_HINTS,
      knowledgeHits,
      blockedReason: this.resolveBlockedReason(normalizedQuestion, publishedAssets),
    };
  }

  formatKnowledgeContext(context: AnalysisQueryKnowledgeContext): string {
    const sections: string[] = [];

    if (context.aliasHints.length > 0) {
      sections.push(`字段别名提示：${context.aliasHints.join('；')}`);
    }

    if (context.normalizationRules.length > 0) {
      sections.push(`归一规则：${context.normalizationRules.join('；')}`);
    }

    if (context.temporalFieldHints.length > 0) {
      sections.push(`时间字段白名单：${context.temporalFieldHints.join('；')}`);
    }

    if (context.temporalExampleHints.length > 0) {
      sections.push(`时间问法示例：${context.temporalExampleHints.join('；')}`);
    }

    if (context.readonlyBoundaryHints.length > 0) {
      sections.push(`只读工具边界：${context.readonlyBoundaryHints.join('；')}`);
    }

    if (context.codebookHints.length > 0) {
      sections.push(`码表与口径提示：${context.codebookHints.join('；')}`);
    }

    if (context.topicAssetHints.length > 0) {
      sections.push(`主题知识资产：${context.topicAssetHints.join('；')}`);
    }

    if (context.workflowHints.length > 0) {
      sections.push(`Hermes 工作流：${context.workflowHints.join('；')}`);
    }

    if (context.templateCandidates.length > 0) {
      sections.push(
        `模板与已验证示例：${context.templateCandidates
          .map((item) =>
            `${item.source === 'GOVERNED_TEMPLATE' ? '模板' : '示例'}《${item.name}》：${item.questionText}${item.sqlHint ? `（${item.sqlHint}）` : ''}`,
          )
          .join('；')}`,
      );
    }

    return sections.join('\n');
  }

  private resolveAliasHints(questionText: string): string[] {
    return this.getAliasRules().filter((rule) =>
      [rule.canonicalLabel, ...rule.synonyms].some((item) => questionText.includes(item)),
    ).map((rule) => rule.hint);
  }

  private resolveCodebookHints(questionText: string): string[] {
    const hints = new Set<string>();

    if (/(阶段|赢单率|赢率|成交率|转化率|漏斗)/u.test(questionText)) {
      hints.add(QUERY_CODEBOOK_HINTS[0]);
    }
    if (/(生效|首付款|签约|合同)/u.test(questionText)) {
      hints.add(QUERY_CODEBOOK_HINTS[1]);
    }
    if (/(回款|到账|区域|团队)/u.test(questionText)) {
      hints.add(QUERY_CODEBOOK_HINTS[2]);
    }
    if (/(联软|报价|订单|下单|成单|有效订单|漏斗)/u.test(questionText)) {
      hints.add(QUERY_CODEBOOK_HINTS[3]);
      hints.add(QUERY_CODEBOOK_HINTS[4]);
      hints.add(QUERY_CODEBOOK_HINTS[5]);
    }

    return [...hints];
  }

  /**
   * 按业务对象返回默认时间字段和禁用字段提示。
   *
   * 参数说明：`questionText` 是已做别名归一的用户问题。
   * 返回值：与问题对象相关的时间字段白名单提示。
   */
  private resolveTemporalFieldHints(questionText: string): string[] {
    const hints = new Set<string>();
    for (const asset of this.listPublishedAssets().filter(
      (item) => item.type === 'TEMPORAL_FIELD_HINT' && this.matchesAsset(questionText, item),
    )) {
      if (asset.hint) {
        hints.add(asset.hint);
      }
    }

    if (/(商机|机会|漏斗|新增商机金额|赢单率)/u.test(questionText)) {
      hints.add(TEMPORAL_FIELD_HINTS[0]);
    }

    if (/(合同|签约|签单|成交|回款|到账)/u.test(questionText)) {
      hints.add(TEMPORAL_FIELD_HINTS[1]);
    }

    if (/(客户|客资|客户贡献度|重点客户|战略客户)/u.test(questionText)) {
      hints.add(TEMPORAL_FIELD_HINTS[2]);
    }

    return hints.size > 0 ? [...hints] : TEMPORAL_FIELD_HINTS;
  }

  private resolveTemplateCandidates(
    questionText: string,
  ): AnalysisQueryKnowledgeCandidate[] {
    const governedTemplates = this.queryTemplateRepository
      .listAll()
      .filter((item) => item.status === 'ACTIVE')
      .map((item) => ({
        source: 'GOVERNED_TEMPLATE' as const,
        templateId: item.id,
        name: item.name,
        questionText: item.defaultQuestionText,
        score: this.scoreQuestionMatch(questionText, item.defaultQuestionText),
      }))
      .filter((item) => item.score > 0);

    const validatedExamples = VALIDATED_QUERY_EXAMPLES.map((item) => ({
      source: 'VALIDATED_EXAMPLE' as const,
      name: item.name,
      questionText: item.questionText,
      score: item.keywords.filter((keyword) =>
        this.normalizeQuestionByAliases(questionText).includes(
          this.normalizeQuestionByAliases(keyword),
        ),
      ).length,
      sqlHint: item.sqlHint,
    })).filter((item) => item.score > 0);

    const governedExamples = this.listPublishedAssets()
      .filter(
        (item) =>
          item.type === 'VALIDATED_EXAMPLE' && this.matchesAsset(questionText, item),
      )
      .map((item) => ({
        source: 'VALIDATED_EXAMPLE' as const,
        name: item.name,
        questionText: item.questionText ?? item.name,
        score: item.matchKeywords.filter((keyword) =>
          this.normalizeQuestionByAliases(questionText).includes(
            this.normalizeQuestionByAliases(keyword),
          ),
        ).length,
        sqlHint: item.sqlHint,
      }));

    return [...governedTemplates, ...governedExamples, ...validatedExamples]
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
  }

  private resolveNormalizationRules(questionText: string): string[] {
    const hints = new Set<string>(QUERY_NORMALIZATION_RULES);
    for (const asset of this.listPublishedAssets().filter(
      (item) =>
        item.type === 'ORGANIZATION_NORMALIZATION' && this.matchesAsset(questionText, item),
    )) {
      if (asset.hint) {
        hints.add(asset.hint);
      }
    }

    return [...hints];
  }

  private resolveTopicAssetHints(questionText: string): string[] {
    const facetProfile = inferAnalysisFacetProfile(questionText);
    const profile = getAnalysisTopicReportProfile(facetProfile);
    if (!profile) {
      return [];
    }

    // 注入优先级：代码基线正例 → 已发布人工正例 → 已发布自动沉淀正例 → 已发布负例
    // 1. 代码基线正例（保底，确保系统始终有最低能力）
    const baselineExamples = profile.validatedExamples;

    // 2-3. 从已发布知识资产动态读取正例（人工 + 自动沉淀，按 confidence 降序取 Top N）
    const publishedAssets = this.listPublishedAssets();
    const publishedValidatedExamples = publishedAssets
      .filter((asset) => asset.type === 'VALIDATED_EXAMPLE')
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 20)
      .map((asset) => asset.questionText ?? asset.name)
      .filter((text) => text.trim().length > 0);

    // 4. 已发布负例（作为 few-shot 负样本，提升拒答准确性）
    const publishedNegativeExamples = publishedAssets
      .filter((asset) => asset.type === 'NEGATIVE_EXAMPLE')
      .slice(0, 10)
      .map((asset) => `${asset.questionText ?? asset.name}（${asset.blockReason ?? '不适用'}）`)
      .filter((text) => text.trim().length > 0);

    // 合并去重（基线在前，已发布在后）
    const mergedExamples = [
      ...baselineExamples,
      ...publishedValidatedExamples.filter(
        (item) => !baselineExamples.includes(item),
      ),
    ];

    const hints = [
      `主题档案：${profile.facetProfile}`,
      `推荐维度：${profile.recommendedDimensions.join('、')}`,
      `推荐区块：${profile.recommendedSections.join('、')}`,
      `已验证示例：${mergedExamples.join('；')}`,
    ];

    if (publishedNegativeExamples.length > 0) {
      hints.push(`不适用示例：${publishedNegativeExamples.join('；')}`);
    }

    return hints;
  }

  private scoreQuestionMatch(questionText: string, templateQuestionText: string): number {
    const normalizedQuestion = this.normalizeQuestionByAliases(questionText);
    const normalizedTemplateQuestion = this.normalizeQuestionByAliases(templateQuestionText);
    const scoringKeywords = [
      '本月',
      '本季度',
      '近三个月',
      '最近30天',
      '销售负责人',
      '区域',
      '团队',
      '新增商机金额',
      '商机金额',
      '签约金额',
      '转合同金额',
      '已回款',
      '排名',
      '排行',
      '趋势',
      '明细',
    ];

    return scoringKeywords.filter(
      (keyword) =>
        normalizedQuestion.includes(keyword) &&
        normalizedTemplateQuestion.includes(keyword),
    ).length;
  }

  private normalizeQuestionByAliases(questionText: string): string {
    return this.getAliasRules().reduce((currentText, rule) => {
      let nextText = currentText;
      for (const synonym of rule.synonyms) {
        nextText = nextText.replaceAll(synonym, rule.canonicalLabel);
      }
      return nextText;
    }, questionText);
  }

  private getAliasRules(): AliasRule[] {
    const publishedRules = this.listPublishedAssets()
      .filter((item) => item.type === 'ALIAS')
      .map((item) => ({
        canonicalLabel: item.canonicalLabel ?? item.name,
        synonyms: item.synonyms ?? [],
        hint: item.hint ?? `${item.name}（已发布）`,
      }));

    return [...publishedRules, ...QUERY_ALIAS_RULES];
  }

  private listPublishedAssets(): AnalysisSemanticKnowledgeAssetRecord[] {
    if (!this.analysisSemanticKnowledgeRepository) {
      return [];
    }

    return this.analysisSemanticKnowledgeRepository.listPublishedActive();
  }

  private matchesAsset(
    questionText: string,
    asset: AnalysisSemanticKnowledgeAssetRecord,
  ): boolean {
    const normalizedQuestion = this.normalizeQuestionByAliases(questionText);
    if (asset.questionText && normalizedQuestion.includes(this.normalizeQuestionByAliases(asset.questionText))) {
      return true;
    }

    return asset.matchKeywords.some((keyword) =>
      normalizedQuestion.includes(this.normalizeQuestionByAliases(keyword)),
    );
  }

  private resolveBlockedReason(
    questionText: string,
    publishedAssets: AnalysisSemanticKnowledgeAssetRecord[],
  ): string | undefined {
    const matchedNegativeExample = publishedAssets.find(
      (item) =>
        item.type === 'NEGATIVE_EXAMPLE' &&
        item.status === 'ACTIVE' &&
        this.matchesAsset(questionText, item),
    );
    return matchedNegativeExample?.blockReason ?? matchedNegativeExample?.hint;
  }

  private resolveKnowledgeHits(
    questionText: string,
    publishedAssets: AnalysisSemanticKnowledgeAssetRecord[],
  ): AnalysisQueryKnowledgeContext['knowledgeHits'] {
    const hits: AnalysisQueryKnowledgeContext['knowledgeHits'] = [];

    for (const asset of publishedAssets) {
      if (!this.matchesAsset(questionText, asset)) {
        continue;
      }

      hits.push({
        assetId: asset.id,
        assetType: asset.type,
        source: 'PUBLISHED_ASSET',
        name: asset.name,
        detail: asset.hint ?? asset.blockReason ?? asset.questionText,
      });
    }

    for (const template of this.queryTemplateRepository
      .listAll()
      .filter((item) => item.status === 'ACTIVE')) {
      if (this.scoreQuestionMatch(questionText, template.defaultQuestionText) <= 0) {
        continue;
      }

      hits.push({
        assetId: template.id,
        assetType: 'GOVERNED_TEMPLATE',
        source: 'GOVERNED_TEMPLATE',
        name: template.name,
        detail: template.defaultQuestionText,
      });
    }

    return hits;
  }
}
