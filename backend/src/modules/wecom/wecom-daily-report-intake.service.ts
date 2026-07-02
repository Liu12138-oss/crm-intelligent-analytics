import { Injectable } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type {
  DailyReportFragmentType,
  CrmContract,
  CrmCustomer,
  CrmOpportunity,
} from '../../shared/types/domain';
import {
  DAILY_REPORT_SECTION_LABELS,
  DAILY_REPORT_SECTION_ORDER,
} from '../daily-report/daily-report.constants';

interface WecomDailyReportIntakeFragment {
  fragmentType: DailyReportFragmentType;
  content: string;
}

interface WecomDailyReportBackendMatch {
  kind: 'customer' | 'opportunity' | 'contract';
  id: string;
  name: string;
  detail: string;
}

export interface WecomDailyReportIntakeResult {
  normalizedText: string;
  hasMeaningfulContent: boolean;
  fragments: WecomDailyReportIntakeFragment[];
  backendMatches: WecomDailyReportBackendMatch[];
  fallbackCandidates: string[];
  companyCandidates: string[];
  projectCandidates: string[];
  missingSectionLabels: string[];
  confirmationSummaryLines: string[];
}

const FOLLOW_UP_KEYWORDS = [
  '拜访',
  '拜会',
  '走访',
  '跟进',
  '跟进客户',
  '跟进信息',
  '推进',
  '洽谈',
  '沟通',
  '对接',
  '约见',
  '拜访了',
  '拜访客户',
  '去了一下',
  '去了一趟',
  '去了一次',
  '交谈',
  '面谈',
  '会面',
  '回访',
];

const NEW_CUSTOMER_OR_OPPORTUNITY_KEYWORDS = [
  '新增客户',
  '新客户',
  '新增商机',
  '新商机',
  '新增机会',
  '新机会',
  '新增项目',
  '新项目',
  '新单',
  '新线索',
  '新订单',
  '签约',
  '成交',
  '立项',
];

const OPPORTUNITY_KEYWORDS = [
  '新增客户',
  '新客户',
  '新增商机',
  '新商机',
  '新增机会',
  '新机会',
  '项目',
  '商机',
  'POC',
  'SaaS',
  '扩容',
  '续签',
  '签约',
  '成交',
  '意向',
  '升级',
];

const HELP_KEYWORDS = [
  '需要',
  '申请',
  '协助',
  '困难',
  '卡住',
  '支持',
  '审批',
  '请帮',
  '麻烦',
  '折扣',
  '资源',
  '支援',
];

const SHARE_KEYWORDS = [
  '反馈',
  '分享',
  '信息分享',
  '信息共享',
  '需要共享',
  '共享给',
  '同步给',
  '消息',
  '情况',
  '结果',
  '汇报',
  '说明',
];

const TOMORROW_KEYWORDS = [
  '明天',
  '后天',
  '下周',
  '后续',
  '计划',
  '安排',
  '继续跟进',
];

const STANDALONE_NEGATIVE_RESPONSES = [
  '没有',
  '无',
  '不用',
  '不需要',
  '暂无',
  '没了',
  '先这样',
  '暂时没有',
];

const ENTITY_LABEL_PREFIX_PATTERN =
  /^(?:跟进内容|遇到与协助|问题与协助|信息共享|信息分享|拜访计划)[:：\s]*/u;
const ENTITY_SCENE_PREFIX_PATTERN =
  /^(?:(?:今天|今日|昨天|上午|下午|中午|晚上|明天|后天|本周|这周|随后|然后|继续|再次|先|再|又|还在|目前|当前|已经|已|刚刚|刚才)\s*)+/u;
const ENTITY_ACTION_PREFIX_PATTERN =
  /^(?:(?:去了一下|去了一趟|跑了一下|跑了一趟|拜访了|走访了|跟进了|推进了|沟通了|对接了|联系了|约见了|拜会了|回访了|面谈了|洽谈了|讨论了|同步了|拜访|走访|跟进|推进|沟通|对接|联系|约见|拜会|回访|面谈|洽谈|讨论|同步|去|去了|聊了聊|简单聊聊|简单沟通)\s*)+/u;
const ENTITY_CONNECTOR_PREFIX_PATTERN = /^(?:(?:客户|公司|企业|项目|商机|了|过|的|和|与|及|并|并且)\s*)+/u;
const COMPANY_CANDIDATE_PATTERN =
  /([\u4e00-\u9fa5A-Za-z0-9·（）()-]{2,60}(?:股份有限公司|有限公司|分公司|子公司|集团|公司|科技|电子|网络|制造|银行|教育|服务))/gu;
const PROJECT_CANDIDATE_PATTERN =
  /([\u4e00-\u9fa5A-Za-z0-9·（）()-]{3,80}(?:项目|POC|SaaS|续签|扩容|升级))/giu;
const GENERIC_PROJECT_CANDIDATE_PATTERN =
  /^(?:项目|商机|方案|报价|合同|测试|POC|SaaS|续签|扩容|升级|客户方案|项目方案|客户项目|公司项目|客户合同|测试方案)$/iu;
const GENERIC_PROJECT_PREFIX_PATTERN =
  /^(?:客户|公司|企业|这个|该|当前|整体)(?:项目|商机|方案|报价|合同|测试|POC|SaaS|续签|扩容|升级)$/iu;

const GENERIC_COMPANY_REFERENCE_PATTERN =
  /^(?:(?:做了|做了一次|做了一轮|做了一场|进行|进行了一次|完成了|开展了|安排了|推进了)\s*)*(?:全公司|整个公司|本公司|公司内部|内部公司|全集团|整个集团|本集团|全企业|整个企业|公司|集团|企业)$/u;

@Injectable()
export class WecomDailyReportIntakeService {
  constructor(private readonly crmReadonlyService: CrmReadonlyService) {}

  inspect(
    messageText: string,
    expectedFragmentType?: DailyReportFragmentType,
  ): WecomDailyReportIntakeResult {
    const normalizedText = this.normalizeText(messageText);
    if (!normalizedText) {
      return {
        normalizedText,
        hasMeaningfulContent: false,
        fragments: [],
        backendMatches: [],
        fallbackCandidates: [],
        companyCandidates: [],
        projectCandidates: [],
        missingSectionLabels: DAILY_REPORT_SECTION_ORDER.map(
          (sectionType) => DAILY_REPORT_SECTION_LABELS[sectionType],
        ),
        confirmationSummaryLines: this.buildConfirmationSummaryLines(normalizedText, []),
      };
    }

    const fallbackCandidates = this.extractFallbackCandidates(normalizedText);
    const fragmentsPreview = this.detectFragmentTypes(normalizedText);
    const backendMatchesPreview = this.lookupBackendMatches(normalizedText);
    const companyCandidates = this.extractCompanyCandidates(
      normalizedText,
      backendMatchesPreview,
      fallbackCandidates,
    );
    const projectCandidates = this.extractProjectCandidates(
      normalizedText,
      backendMatchesPreview,
      fallbackCandidates,
    );
    const normalizedStandaloneResponse = expectedFragmentType
      ? this.normalizeStandaloneResponse(normalizedText, expectedFragmentType)
      : undefined;
    const hasMeaningfulContent =
      fragmentsPreview.length > 0 ||
      backendMatchesPreview.length > 0 ||
      fallbackCandidates.length > 0 ||
      companyCandidates.length > 0 ||
      projectCandidates.length > 0 ||
      Boolean(normalizedStandaloneResponse) ||
      Boolean(expectedFragmentType);

    if (!hasMeaningfulContent) {
      return {
        normalizedText,
        hasMeaningfulContent: false,
        fragments: [],
        backendMatches: [],
        fallbackCandidates: [],
        companyCandidates: [],
        projectCandidates: [],
        missingSectionLabels: DAILY_REPORT_SECTION_ORDER.map(
          (sectionType) => DAILY_REPORT_SECTION_LABELS[sectionType],
        ),
        confirmationSummaryLines: this.buildConfirmationSummaryLines(
          normalizedText,
          [],
        ),
      };
    }

    const clauses = this.splitClauses(normalizedText);
    const bucketMap = new Map<DailyReportFragmentType, string[]>();
    const defaultFragmentType = expectedFragmentType ?? ('TODAY_FOLLOW_UP' as DailyReportFragmentType);
    for (const clause of clauses.length > 0 ? clauses : [normalizedText]) {
      const fragmentTypes = this.detectFragmentTypes(clause);
      const effectiveTypes =
        fragmentTypes.length > 0 ? fragmentTypes : [defaultFragmentType];
      for (const fragmentType of effectiveTypes) {
        const fragments = bucketMap.get(fragmentType) ?? [];
        fragments.push(
          this.normalizeStandaloneResponse(clause, fragmentType) ?? clause,
        );
        bucketMap.set(fragmentType, fragments);
      }
    }

    if (bucketMap.size === 0) {
      bucketMap.set(defaultFragmentType, [
        normalizedStandaloneResponse ?? normalizedText,
      ]);
    }

    const fragments = DAILY_REPORT_SECTION_ORDER.filter((sectionType) =>
      bucketMap.has(sectionType),
    ).map((sectionType) => ({
      fragmentType: sectionType,
      content: this.compactClauses(bucketMap.get(sectionType) ?? []),
    }));

    const backendMatches = backendMatchesPreview;
    const missingSectionLabels = DAILY_REPORT_SECTION_ORDER.filter(
      (sectionType) => !bucketMap.has(sectionType),
    ).map((sectionType) => DAILY_REPORT_SECTION_LABELS[sectionType]);
    const confirmationSummaryLines = this.buildConfirmationSummaryLines(
      normalizedText,
      backendMatches,
    );

    return {
      normalizedText,
      hasMeaningfulContent,
      fragments,
      backendMatches,
      fallbackCandidates,
      companyCandidates,
      projectCandidates,
      missingSectionLabels,
      confirmationSummaryLines,
    };
  }

  private normalizeText(messageText: string): string {
    return messageText.replace(/\s+/g, ' ').trim();
  }

  private splitClauses(text: string): string[] {
    return text
      .split(/[。！？!?；;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private compactClauses(clauses: string[]): string {
    return Array.from(new Set(clauses))
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('；');
  }

  private detectFragmentTypes(text: string): DailyReportFragmentType[] {
    const fragmentTypes = new Set<DailyReportFragmentType>();
    if (this.hasAnyKeyword(text, FOLLOW_UP_KEYWORDS)) {
      fragmentTypes.add('TODAY_FOLLOW_UP');
    }

    if (this.hasAnyKeyword(text, OPPORTUNITY_KEYWORDS)) {
      fragmentTypes.add('CUSTOMER_OR_OPPORTUNITY_CHANGE');
    }

    if (this.hasAnyKeyword(text, HELP_KEYWORDS)) {
      fragmentTypes.add('HELP_REQUIRED');
    }

    if (this.hasAnyKeyword(text, SHARE_KEYWORDS)) {
      fragmentTypes.add('INFORMATION_SHARE');
    }

    if (this.hasAnyKeyword(text, TOMORROW_KEYWORDS)) {
      fragmentTypes.add('TOMORROW_PLAN');
    }

    return [...fragmentTypes];
  }

  private lookupBackendMatches(text: string): WecomDailyReportBackendMatch[] {
    const candidates: WecomDailyReportBackendMatch[] = [];
    const customerMatches = this.matchCustomers(text, this.crmReadonlyService.listCustomers());
    const opportunityMatches = this.matchOpportunities(
      text,
      this.crmReadonlyService.listOpportunities(),
    );
    const contractMatches = this.matchContracts(text, this.crmReadonlyService.listContracts());

    candidates.push(...customerMatches, ...opportunityMatches, ...contractMatches);
    return candidates;
  }

  private matchCustomers(
    text: string,
    customers: CrmCustomer[],
  ): WecomDailyReportBackendMatch[] {
    return customers
      .filter((item) => this.matchesEntityText(text, [item.name, item.id]))
      .map((item) => ({
        kind: 'customer' as const,
        id: item.id,
        name: item.name,
        detail: item.category ? `客户分类：${item.category}` : '客户主数据已命中',
      }));
  }

  private matchOpportunities(
    text: string,
    opportunities: CrmOpportunity[],
  ): WecomDailyReportBackendMatch[] {
    return opportunities
      .filter((item) => this.matchesEntityText(text, [item.title, item.id]))
      .map((item) => ({
        kind: 'opportunity' as const,
        id: item.id,
        name: item.title,
        detail: `负责人：${item.ownerName}；预计金额：${item.expectAmount.toLocaleString()}；阶段：${item.stage}`,
      }));
  }

  private matchContracts(
    text: string,
    contracts: CrmContract[],
  ): WecomDailyReportBackendMatch[] {
    return contracts
      .filter((item) => this.matchesEntityText(text, [item.title, item.id]))
      .map((item) => ({
        kind: 'contract' as const,
        id: item.id,
        name: item.title,
        detail: `负责人：${item.ownerName}；合同金额：${item.totalAmount.toLocaleString()}；状态：${item.status}`,
      }));
  }

  private matchesEntityText(text: string, values: Array<string | undefined>): boolean {
    return values
      .filter((value): value is string => Boolean(value))
      .some((value) => {
        const normalizedValue = value.trim();
        return normalizedValue.length > 1 && text.includes(normalizedValue);
      });
  }

  private extractFallbackCandidates(text: string): string[] {
    const quotedCandidates = Array.from(
      text.matchAll(/[“"『【](.+?)[”"』】]/g),
      (match) => match[1]?.trim() ?? '',
    ).filter(Boolean);

    return this.uniqueStrings([
      ...quotedCandidates,
      ...this.extractUnquotedCompanyCandidates(text),
      ...this.extractUnquotedProjectCandidates(text),
    ]);
  }

  private extractCompanyCandidates(
    text: string,
    backendMatches: WecomDailyReportBackendMatch[],
    fallbackCandidates: string[],
  ): string[] {
    const customerNames = backendMatches
      .filter((item) => item.kind === 'customer')
      .map((item) => item.name);
    const quotedCandidates = this.extractQuotedCandidates(text);
    return this.uniqueStrings([
      ...customerNames,
      ...fallbackCandidates.filter((item) => this.looksLikeCompanyName(item)),
      ...quotedCandidates.filter((item) => this.looksLikeCompanyName(item)),
    ]);
  }

  private extractProjectCandidates(
    text: string,
    backendMatches: WecomDailyReportBackendMatch[],
    fallbackCandidates: string[],
  ): string[] {
    const opportunityNames = backendMatches
      .filter((item) => item.kind === 'opportunity')
      .map((item) => item.name);
    const quotedCandidates = this.extractQuotedCandidates(text);
    return this.uniqueStrings([
      ...opportunityNames,
      ...quotedCandidates.filter((item) => this.looksLikeProjectName(item)),
      ...fallbackCandidates.filter((item) => this.looksLikeProjectName(item)),
    ]);
  }

  private extractQuotedCandidates(text: string): string[] {
    return Array.from(
      text.matchAll(/[“"『【](.+?)[”"』】]/g),
      (match) => match[1]?.trim() ?? '',
    ).filter(Boolean);
  }

  /** 兜底提取未加引号的客户名，并剔除“今天拜访了”“继续跟进”这类动作前缀。 */
  private extractUnquotedCompanyCandidates(text: string): string[] {
    const rawCandidates = Array.from(
      text.matchAll(COMPANY_CANDIDATE_PATTERN),
      (match) => match[1]?.trim() ?? '',
    ).filter(Boolean);

    return this.uniqueStrings(
      rawCandidates
        .map((item) => this.normalizeEntityCandidate(item, 'company'))
        .filter((item): item is string => Boolean(item)),
    );
  }

  /** 兜底提取未加引号的项目名，避免把“推进了”“继续”这类上下文一起当成项目名称。 */
  private extractUnquotedProjectCandidates(text: string): string[] {
    const rawCandidates = Array.from(
      text.matchAll(PROJECT_CANDIDATE_PATTERN),
      (match) => match[1]?.trim() ?? '',
    ).filter(Boolean);

    return this.uniqueStrings(
      rawCandidates
        .map((item) => this.normalizeEntityCandidate(item, 'project'))
        .filter((item): item is string => Boolean(item)),
    );
  }

  /** 统一裁剪实体名前后的语义噪声，避免把时间词、动作词和连接词误当成客户或项目名。 */
  private normalizeEntityCandidate(
    candidate: string,
    kind: 'company' | 'project',
  ): string | undefined {
    let normalized = candidate
      .replace(/[“"『】』【「」]/gu, '')
      .replace(ENTITY_LABEL_PREFIX_PATTERN, '')
      .trim();

    while (normalized) {
      const nextValue = normalized
        .replace(ENTITY_SCENE_PREFIX_PATTERN, '')
        .replace(ENTITY_ACTION_PREFIX_PATTERN, '')
        .replace(ENTITY_CONNECTOR_PREFIX_PATTERN, '')
        .trim();

      if (nextValue === normalized) {
        break;
      }

      normalized = nextValue;
    }

    normalized = normalized.replace(/[，,。！？!?；;:：]+$/gu, '').trim();
    if (!normalized) {
      return undefined;
    }

    if (kind === 'company') {
      if (GENERIC_COMPANY_REFERENCE_PATTERN.test(normalized)) {
        return undefined;
      }

      return this.looksLikeCompanyName(normalized) ? normalized : undefined;
    }

    if (
      GENERIC_PROJECT_CANDIDATE_PATTERN.test(normalized) ||
      GENERIC_PROJECT_PREFIX_PATTERN.test(normalized)
    ) {
      return undefined;
    }

    return this.looksLikeProjectName(normalized) ? normalized : undefined;
  }

  private looksLikeCompanyName(text: string): boolean {
    return /(?:股份有限公司|有限公司|分公司|子公司|集团|公司|股份|科技|电子|网络|制造|银行|教育|服务)$/u.test(text);
  }

  private looksLikeProjectName(text: string): boolean {
    if (!text.trim()) {
      return false;
    }

    if (this.looksLikeCompanyName(text)) {
      return false;
    }

    return /(?:项目|POC|SaaS|续签|扩容|升级)/iu.test(text);
  }

  private hasAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private buildConfirmationSummaryLines(
    normalizedText: string,
    backendMatches: WecomDailyReportBackendMatch[],
  ): string[] {
    const clauses = this.splitClauses(normalizedText);
    const followUpRecords = this.collectClauseRecords(clauses, FOLLOW_UP_KEYWORDS);
    const newChangeText = this.collectClauseSummary(
      clauses,
      NEW_CUSTOMER_OR_OPPORTUNITY_KEYWORDS,
    );
    const shareText = this.collectClauseSummary(clauses, SHARE_KEYWORDS);
    const helpText = this.collectClauseSummary(clauses, HELP_KEYWORDS);
    const planText = this.collectClauseSummary(clauses, TOMORROW_KEYWORDS);

    const opportunityNames = backendMatches
      .filter((item) => item.kind === 'opportunity')
      .map((item) => item.name);
    const customerNames = backendMatches
      .filter((item) => item.kind === 'customer')
      .map((item) => item.name);

    return [
      '1. 客户/商机跟进：',
      ...(followUpRecords.length > 0
        ? followUpRecords.map((record) => `   ${record}`)
        : ['   未提及']),
      ...(opportunityNames.length > 0
        ? [`   命中项目：${this.uniqueStrings(opportunityNames).join('、')}`]
        : []),
      ...(customerNames.length > 0
        ? [`   命中客户：${this.uniqueStrings(customerNames).join('、')}`]
        : []),
      `2. 客户/商机变化：${newChangeText}`,
      `3. 信息共享：${shareText}`,
      `4. 问题与协助：${helpText}`,
      `5. 拜访计划：${planText}`,
    ];
  }

  private collectClauseSummary(clauses: string[], keywords: string[]): string {
    const matchedClauses = clauses.filter((clause) => this.hasAnyKeyword(clause, keywords));
    if (matchedClauses.length === 0) {
      return '未提及';
    }

    return this.compactClauses(matchedClauses);
  }

  private collectClauseRecords(clauses: string[], keywords: string[]): string[] {
    const matchedClauses = clauses.filter((clause) => this.hasAnyKeyword(clause, keywords));
    if (matchedClauses.length === 0) {
      return [];
    }

    return this.uniqueStrings(matchedClauses).map(
      (clause, index) => `${index + 1}）${clause}`,
    );
  }

  private joinSummaryParts(parts: Array<string | undefined>): string {
    const filtered = parts.filter((item): item is string => Boolean(item && item.trim()));
    if (filtered.length === 0) {
      return '未提及';
    }

    return filtered.join('；');
  }

  private uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  }

  private normalizeStandaloneResponse(
    text: string,
    fragmentType: DailyReportFragmentType,
  ): string | undefined {
    if (!this.isStandaloneNegativeResponse(text)) {
      return undefined;
    }

    switch (fragmentType) {
      case 'TODAY_FOLLOW_UP':
        return '今日暂无跟进';
      case 'CUSTOMER_OR_OPPORTUNITY_CHANGE':
        return '暂无新增客户/商机';
      case 'INFORMATION_SHARE':
        return '无需信息共享';
      case 'HELP_REQUIRED':
        return '暂无困难或协助需求';
      case 'TOMORROW_PLAN':
        return '暂未补充计划';
      default:
        return text;
    }
  }

  private isStandaloneNegativeResponse(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }

    return STANDALONE_NEGATIVE_RESPONSES.some((keyword) =>
      trimmed === keyword ||
      trimmed.startsWith(`${keyword}，`) ||
      trimmed.startsWith(`${keyword}。`),
    );
  }
}
