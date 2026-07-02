import { Injectable } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { UserScopeService } from '../auth/user-scope.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type {
  CrmCustomer,
  CrmOpportunity,
  CrmUser,
  ScopeSnapshot,
} from '../../shared/types/domain';

export interface OpportunityLookupRecord {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  ownerId: string;
  ownerName: string;
  organizationId: string;
  departmentId: string;
  expectAmount: number;
  stage: string;
  createdAt: string;
}

export interface OpportunityLookupResult {
  companyName: string;
  customFieldName: OpportunityLookupField;
  totalCount: number;
  limit: number;
  matchedCompanyNames: string[];
  records: OpportunityLookupRecord[];
  summary: string;
}

export type OpportunityLookupField = 'title';

@Injectable()
export class OpportunityLookupService {
  constructor(
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly userScopeService: UserScopeService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  canUseLiveQuery(): boolean {
    return this.crmReadonlyService.canUseLiveQuery();
  }

  async ensureLiveQueryReady(): Promise<boolean> {
    return await this.crmReadonlyService.ensureLiveQueryReady();
  }

  shouldRouteToCompanyLookup(messageText?: string): boolean {
    const normalizedText = this.normalizeSearchText(messageText ?? '');
    if (!normalizedText) {
      return false;
    }

    if (normalizedText.length < 3 || normalizedText.length > 40) {
      return false;
    }

    if (/[?？。.!！；;\n]/.test(normalizedText)) {
      return false;
    }

    if (this.hasAnyKeyword(normalizedText, QUESTION_KEYWORDS)) {
      return false;
    }

    return (
      this.hasAnyKeyword(normalizedText, COMPANY_SUFFIX_KEYWORDS) ||
      this.looksLikeEntityName(normalizedText)
    );
  }

  async lookupByCompanyName(
    user: CrmUser,
    companyName: string,
    options?: {
      limit?: number;
      customFieldName?: string;
      restrictToOwnerOrCollaborator?: boolean;
    },
  ): Promise<OpportunityLookupResult> {
    const normalizedCompanyName = this.normalizeSearchText(companyName);
    const limit = this.normalizeLimit(options?.limit);
    const customFieldName = this.normalizeOpportunityField(options?.customFieldName);
    const restrictToOwnerOrCollaborator =
      options?.restrictToOwnerOrCollaborator === true;
    const scopeSnapshot = this.userScopeService.resolveScope(user);
    this.analysisLoggerService.logStep('商机名称查询开始。', {
      requesterId: user.id,
      requesterName: user.name,
      searchKey: normalizedCompanyName,
      customFieldName,
      limit,
      restrictToOwnerOrCollaborator,
      scopeSummary: scopeSnapshot.scopeSummary,
      identitySource: user.identitySource,
    });
    const sourceRecords = await this.loadOpportunityRecords(
      user,
      normalizedCompanyName,
      customFieldName,
      restrictToOwnerOrCollaborator,
    );
    this.analysisLoggerService.logStep('商机名称查询已取到原始记录。', {
      searchKey: normalizedCompanyName,
      customFieldName,
      restrictToOwnerOrCollaborator,
      sourceCount: sourceRecords.length,
      sourceMode: this.crmoReadonlyModeLabel(),
    });
    const scopedRecords = restrictToOwnerOrCollaborator
      ? this.filterOwnedOrCollaboratedRecords(user, sourceRecords)
      : this.applyScopeFilter(sourceRecords, scopeSnapshot);
    this.analysisLoggerService.logStep('商机名称查询已完成权限过滤。', {
      searchKey: normalizedCompanyName,
      customFieldName,
      restrictToOwnerOrCollaborator,
      filteredCount: scopedRecords.length,
      scopeSummary: scopeSnapshot.scopeSummary,
    });
    const sortedRecords = scopedRecords.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    const limitedRecords = sortedRecords.slice(0, limit);
    const matchedCompanyNames = Array.from(
      new Set(
        sortedRecords
          .map((item) => item.customerName)
          .filter((item): item is string => Boolean(item)),
      ),
    );

    return {
      companyName: normalizedCompanyName,
      customFieldName,
      totalCount: sortedRecords.length,
      limit,
      matchedCompanyNames,
      records: limitedRecords,
      summary: this.buildSummary(
        normalizedCompanyName,
        customFieldName,
        sortedRecords,
        limitedRecords,
        matchedCompanyNames,
      ),
    };
  }

  buildWecomReply(result: OpportunityLookupResult): string {
    if (result.totalCount === 0) {
      return [
        `未按公司名「${result.companyName}」查到商机记录。`,
        '请补充更完整的公司全称、客户简称或商机名称，我再继续帮你查。',
      ].join('\n');
    }

    const topRecords = result.records.slice(0, Math.min(result.records.length, 3));
    const lines = topRecords.map((item, index) => {
      const companyLabel = item.customerName ?? item.title;
      return `${index + 1}. ${companyLabel}｜${item.title}｜${item.stage}｜预计${item.expectAmount.toLocaleString()}｜${item.ownerName}`;
    });
    const extraCount = result.totalCount - topRecords.length;
    const extraLine = extraCount > 0 ? `另外还有 ${extraCount} 条未展开。` : '';

    return [
      `已按公司名「${result.companyName}」查到 ${result.totalCount} 条商机。`,
      `先给你前 ${topRecords.length} 条：`,
      ...lines,
      extraLine,
      '如果这就是你要的公司，请回复“确认”，我再继续整理更完整的信息。',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async loadOpportunityRecords(
    user: CrmUser,
    companyName: string,
    customFieldName: OpportunityLookupField,
    restrictToOwnerOrCollaborator: boolean,
  ): Promise<OpportunityLookupRecord[]> {
    if (!companyName) {
      return [];
    }

    if (process.env.NODE_ENV !== 'test' && (await this.crmReadonlyService.ensureLiveQueryReady())) {
      const liveRecords = await this.loadLiveOpportunityRecords(
        user,
        companyName,
        customFieldName,
        restrictToOwnerOrCollaborator,
      );
      this.analysisLoggerService.logStep('商机名称查询使用真实数据库。', {
        searchKey: companyName,
        customFieldName,
        restrictToOwnerOrCollaborator,
        liveCount: liveRecords.length,
      });
      if (restrictToOwnerOrCollaborator || liveRecords.length > 0) {
        return liveRecords;
      }
    }

    this.analysisLoggerService.logStep('商机名称查询回退到本地样例数据。', {
      searchKey: companyName,
      customFieldName,
      restrictToOwnerOrCollaborator,
    });
    return this.loadMockOpportunityRecords(
      user,
      companyName,
      customFieldName,
      restrictToOwnerOrCollaborator,
    );
  }

  private async loadLiveOpportunityRecords(
    user: CrmUser,
    companyName: string,
    customFieldName: OpportunityLookupField,
    restrictToOwnerOrCollaborator: boolean,
  ): Promise<OpportunityLookupRecord[]> {
    const like = this.buildLikePattern(companyName);
    const normalizedSearchKey = this.normalizeSearchText(companyName);
    const queryParams: unknown[] = [like, like, `%${normalizedSearchKey.replace(/[\\%_]/g, '\\$&')}%`];
    const relationClause = restrictToOwnerOrCollaborator
      ? ' AND (CAST(o.user_id AS CHAR) = ? OR eau.user_id IS NOT NULL)'
      : '';

    if (restrictToOwnerOrCollaborator) {
      queryParams.unshift(user.id, user.id);
    }
    const rows = await this.crmReadonlyService.executeQuery<{
      id: string | number;
      title: string;
      customer_id?: string | number | null;
      customer_name?: string | null;
      user_id: string | number;
      owner_name?: string | null;
      organization_id: string | number;
      department_id: string | number;
      expect_amount: string | number;
      stage: string;
      created_at: string;
    }>(
      `SELECT
         CAST(o.id AS CHAR) AS id,
         o.title AS title,
         o.customer_id AS customer_id,
         c.name AS customer_name,
         o.user_id AS user_id,
         COALESCE(u.name, CAST(o.user_id AS CHAR)) AS owner_name,
         o.organization_id AS organization_id,
         o.department_id AS department_id,
         o.expect_amount AS expect_amount,
         o.stage AS stage,
         o.created_at AS created_at
       FROM opportunities o
       LEFT JOIN customers c ON c.id = o.customer_id
       LEFT JOIN users u ON u.id = o.user_id
       ${
         restrictToOwnerOrCollaborator
           ? "LEFT JOIN entities_assist_users eau ON eau.subject_id = o.id AND eau.subject_type = 'Opportunity' AND CAST(eau.user_id AS CHAR) = ?"
           : ''
       }
       WHERE (
         o.title LIKE ?
         OR c.name LIKE ?
         OR REPLACE(REPLACE(REPLACE(REPLACE(c.name, '股份有限公司', ''), '有限公司', ''), '技术', ''), '科技', '') LIKE ?
       )${relationClause}
       ORDER BY o.created_at DESC`,
      queryParams,
    );

    this.analysisLoggerService.logStep('商机名称查询 SQL 已执行。', {
      searchKey: companyName,
      customFieldName,
      likePattern: like,
      rowCount: rows.length,
    });

    return rows.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      customerId:
        item.customer_id !== null && item.customer_id !== undefined
          ? String(item.customer_id)
          : undefined,
      customerName: item.customer_name ? String(item.customer_name) : undefined,
      ownerId: String(item.user_id),
      ownerName: String(item.owner_name ?? item.user_id),
      organizationId: String(item.organization_id),
      departmentId: String(item.department_id),
      expectAmount: Number(item.expect_amount ?? 0),
      stage: String(item.stage),
      createdAt: String(item.created_at),
    }));
  }

  private loadMockOpportunityRecords(
    user: CrmUser,
    companyName: string,
    customFieldName: OpportunityLookupField,
    restrictToOwnerOrCollaborator: boolean,
  ): OpportunityLookupRecord[] {
    const normalizedCompanyName = this.normalizeSearchText(companyName);
    const customers = this.crmReadonlyService.listCustomers();
    const opportunities = this.crmReadonlyService.listOpportunities();
    const candidateNames = new Set<string>([normalizedCompanyName]);

    const records = opportunities
      .filter((item) =>
        this.matchesText(
          normalizedCompanyName,
          customFieldName === 'title'
            ? [item.title, item.id, this.findMatchedCustomer(item, normalizedCompanyName, customers, candidateNames)?.name]
            : [item.title, item.id, this.findMatchedCustomer(item, normalizedCompanyName, customers, candidateNames)?.name],
        ),
      )
      .map((item) => {
        const matchedCustomer = this.findMatchedCustomer(
          item,
          normalizedCompanyName,
          customers,
          candidateNames,
        );

        return {
          id: item.id,
          title: item.title,
          customerId: matchedCustomer?.id,
          customerName: matchedCustomer?.name,
          ownerId: item.ownerId,
          ownerName: item.ownerName,
          organizationId: item.organizationId,
          departmentId: item.departmentId,
          expectAmount: item.expectAmount,
          stage: item.stage,
          createdAt: item.createdAt,
        };
      });

    return restrictToOwnerOrCollaborator
      ? this.filterOwnedOrCollaboratedRecords(user, records)
      : records;
  }

  private findMatchedCustomer(
    opportunity: CrmOpportunity,
    companyName: string,
    customers: CrmCustomer[],
    candidateNames: Set<string>,
  ): CrmCustomer | undefined {
    return customers.find((item) =>
      this.matchesText(opportunity.title, [item.name]) &&
      this.matchesText(companyName, [item.name, opportunity.title]),
    ) ??
      customers.find((item) => candidateNames.has(item.name)) ??
      customers.find((item) =>
        this.matchesText(companyName, [item.name, opportunity.title]),
      );
  }

  private applyScopeFilter(
    records: OpportunityLookupRecord[],
    scopeSnapshot: ScopeSnapshot,
  ): OpportunityLookupRecord[] {
    return records.filter((item) => {
      if (
        scopeSnapshot.organizationIds.length > 0 &&
        !scopeSnapshot.organizationIds.includes(item.organizationId)
      ) {
        return false;
      }

      if (
        scopeSnapshot.departmentIds.length > 0 &&
        !scopeSnapshot.departmentIds.includes(item.departmentId)
      ) {
        return false;
      }

      if (scopeSnapshot.ownerIds.length > 0 && !scopeSnapshot.ownerIds.includes(item.ownerId)) {
        return false;
      }

      return true;
    });
  }

  private filterOwnedOrCollaboratedRecords(
    user: CrmUser,
    records: OpportunityLookupRecord[],
  ): OpportunityLookupRecord[] {
    return records.filter(
      (item) =>
        this.isActorMatched(item.ownerId, item.ownerName, user) ||
        (MOCK_OPPORTUNITY_ASSIST_USER_IDS[item.id] ?? []).includes(user.id),
    );
  }

  private isActorMatched(
    ownerId: string,
    ownerName: string | undefined,
    user: CrmUser,
  ): boolean {
    return (
      ownerId === user.id ||
      this.normalizeName(ownerName) === this.normalizeName(user.name)
    );
  }

  private buildSummary(
    companyName: string,
    customFieldName: OpportunityLookupField,
    allRecords: OpportunityLookupRecord[],
    limitedRecords: OpportunityLookupRecord[],
    matchedCompanyNames: string[],
  ): string {
    if (allRecords.length === 0) {
      return `未按 ${customFieldName}「${companyName}」查到商机记录，请补充更完整的名称。`;
    }

    const topCount = limitedRecords.length;
    const topLines = limitedRecords.map((item, index) => {
      const companyLabel = item.customerName ?? item.title;
      return `${index + 1}. ${companyLabel}｜${item.title}｜${item.stage}｜预计${item.expectAmount.toLocaleString()}｜${item.ownerName}`;
    });
    const matchedCompanyText = matchedCompanyNames.length
      ? `，命中公司：${matchedCompanyNames.slice(0, 3).join('、')}`
      : '';
    const extraText = allRecords.length > limitedRecords.length ? `，另有 ${allRecords.length - limitedRecords.length} 条未展开` : '';

    return [
      `已按 ${customFieldName}「${companyName}」查到 ${allRecords.length} 条商机${matchedCompanyText}${extraText}。`,
      `先看前 ${topCount} 条：`,
      ...topLines,
      '回复“确认”后我再继续整理更完整的信息。',
    ].join('\n');
  }

  private normalizeSearchText(value: string): string {
    return value
      .replace(/\s+/g, '')
      .replace(/[“"『】』【]/g, '')
      .replace(/(?:项目名称|项目|商机|客户名称|客户|公司名称|公司)$/u, '')
      .trim();
  }

  private normalizeLimit(limit?: number): number {
    const parsed = Number.isFinite(limit ?? NaN) ? Number(limit) : 5;
    return Math.max(1, Math.min(Math.trunc(parsed), 10));
  }

  private normalizeName(value: string | undefined): string {
    return value?.replace(/\s+/gu, '').trim().toLowerCase() ?? '';
  }

  private hasAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private matchesText(text: string, values: Array<string | undefined>): boolean {
    const normalizedText = this.normalizeSearchText(text);
    return values
      .filter((value): value is string => Boolean(value))
      .some((value) => {
        const normalizedValue = this.normalizeSearchText(value);
        return (
          normalizedValue.length > 1 &&
          (normalizedText.includes(normalizedValue) || normalizedValue.includes(normalizedText))
        );
      });
  }

  private looksLikeEntityName(text: string): boolean {
    if (/[\u4e00-\u9fa5A-Za-z0-9]{3,}/.test(text) === false) {
      return false;
    }

    return /^[\u4e00-\u9fa5A-Za-z0-9·（）()\-—_]{3,40}$/.test(text);
  }

  private buildLikePattern(value: string): string {
    return `%${this.normalizeSearchText(value).replace(/[\\%_]/g, '\\$&')}%`;
  }

  private normalizeOpportunityField(field?: string): OpportunityLookupField {
    if (!field || field === 'title') {
      return 'title';
    }

    throw new Error('当前仅支持 custom_field_name=title。');
  }

  private crmoReadonlyModeLabel(): string {
    return this.crmReadonlyService.canUseLiveQuery() ? 'live-db' : 'mock-data';
  }
}

const QUESTION_KEYWORDS = [
  '日报',
  '销售日报',
  '生成日报',
  '提交日报',
  '写日报',
  '收口日报',
  '今天',
  '明天',
  '本周',
  '本月',
  '情况',
  '内容',
  '进展',
  '说明',
  '详情',
  '报表',
  '跟进',
  '分析',
  '统计',
  '查询',
  '明细',
  '怎么',
  '为什么',
  '什么',
  '多少',
  '是否',
  '哪个',
  '哪些',
  '请',
  '帮我',
  '结果',
  '趋势',
  '排名',
  '拜访',
  '申请',
];

const COMPANY_SUFFIX_KEYWORDS = [
  '公司',
  '集团',
  '有限公司',
  '股份',
  '科技',
  '电子',
  '制造',
  '银行',
  '教育',
  '服务',
  '信息',
  '能源',
  '网络',
  '医药',
  '贸易',
  '物流',
];

const MOCK_OPPORTUNITY_ASSIST_USER_IDS: Record<string, string[]> = {
  opp_001: ['user_sales_director'],
  opp_002: ['user_sales_director'],
  opp_003: ['user_sales_director'],
  opp_004: ['user_sales_director'],
  opp_005: ['user_sales_director'],
  opp_006: ['user_sales_director'],
  opp_007: ['user_sales_director'],
  opp_008: ['user_sales_director'],
  opp_009: ['user_sales_director'],
  opp_010: ['user_sales_director'],
};
