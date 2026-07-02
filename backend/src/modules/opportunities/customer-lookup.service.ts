import { Injectable } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { CRM_OPPORTUNITIES } from '../../shared/mock/sample-data';
import type {
  CrmCustomer,
  CrmUser,
  ScopeSnapshot,
} from '../../shared/types/domain';
import { UserScopeService } from '../auth/user-scope.service';
import type {
  CustomerLookupRecord,
  CustomerLookupResult,
} from './crm-customer-api.service';

@Injectable()
export class CustomerLookupService {
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

  /**
   * 在只读库里按客户名查找候选。
   * 参数：当前用户、查询词，以及是否只保留“负责人/协作人=当前用户本人”的候选。
   * 返回：已按当前策略过滤并排序后的客户候选结果。
   */
  async lookupByName(
    user: CrmUser,
    customerName: string,
    options?: {
      limit?: number;
      restrictToOwnerOrCollaborator?: boolean;
    },
  ): Promise<CustomerLookupResult> {
    const normalizedCustomerName = this.normalizeSearchText(customerName).replace(
      /(?:客户名称|客户|公司名称|公司)$/u,
      '',
    );
    const limit = this.normalizeLimit(options?.limit);
    const restrictToOwnerOrCollaborator =
      options?.restrictToOwnerOrCollaborator === true;
    const scopeSnapshot = this.userScopeService.resolveScope(user);

    this.analysisLoggerService.logStep('客户名称只读查询开始。', {
      requesterId: user.id,
      requesterName: user.name,
      searchKey: normalizedCustomerName,
      limit,
      restrictToOwnerOrCollaborator,
      scopeSummary: scopeSnapshot.scopeSummary,
      sourceMode: this.crmReadonlyModeLabel(),
    });

    const sourceRecords = await this.loadCustomerRecords(
      user,
      normalizedCustomerName,
      restrictToOwnerOrCollaborator,
    );
    const filteredRecords = restrictToOwnerOrCollaborator
      ? this.filterOwnedOrCollaboratedRecords(user, sourceRecords)
      : this.applyScopeFilter(sourceRecords, scopeSnapshot);
    const sortedRecords = filteredRecords.sort(
      (left, right) =>
        new Date(right.createdAt ?? '').getTime() -
        new Date(left.createdAt ?? '').getTime(),
    );
    const limitedRecords = sortedRecords.slice(0, limit);

    return {
      customerName: normalizedCustomerName,
      totalCount: sortedRecords.length,
      limit,
      records: limitedRecords,
      summary: this.buildSummary(
        normalizedCustomerName,
        sortedRecords.length,
        limitedRecords,
      ),
    };
  }

  private async loadCustomerRecords(
    user: CrmUser,
    customerName: string,
    restrictToOwnerOrCollaborator: boolean,
  ): Promise<CustomerLookupRecord[]> {
    if (!customerName) {
      return [];
    }

    if (
      process.env.NODE_ENV !== 'test' &&
      (await this.crmReadonlyService.ensureLiveQueryReady())
    ) {
      const liveRecords = await this.loadLiveCustomerRecords(
        user,
        customerName,
        restrictToOwnerOrCollaborator,
      );
      this.analysisLoggerService.logStep('客户名称只读查询使用真实数据库。', {
        searchKey: customerName,
        restrictToOwnerOrCollaborator,
        liveCount: liveRecords.length,
      });
      return liveRecords;
    }

    this.analysisLoggerService.logStep('客户名称只读查询回退到本地样例数据。', {
      searchKey: customerName,
      restrictToOwnerOrCollaborator,
    });
    return this.loadMockCustomerRecords(
      user,
      customerName,
      restrictToOwnerOrCollaborator,
    );
  }

  private async loadLiveCustomerRecords(
    user: CrmUser,
    customerName: string,
    restrictToOwnerOrCollaborator: boolean,
  ): Promise<CustomerLookupRecord[]> {
    const like = this.buildLikePattern(customerName);
    const normalizedSearchKey = this.normalizeSearchText(customerName);
    const queryParams: unknown[] = [like, like, `%${normalizedSearchKey.replace(/[\\%_]/g, '\\$&')}%`];
    const relationClause = restrictToOwnerOrCollaborator
      ? ' AND (CAST(c.user_id AS CHAR) = ? OR eau.user_id IS NOT NULL)'
      : '';

    if (restrictToOwnerOrCollaborator) {
      queryParams.unshift(user.id, user.id);
    }

    const rows = await this.crmReadonlyService.executeQuery<{
      id: string | number;
      name: string;
      user_id: string | number;
      owner_name?: string | null;
      organization_id?: string | number | null;
      department_id?: string | number | null;
      category?: string | null;
      created_at?: string | null;
    }>(
      `SELECT
         CAST(c.id AS CHAR) AS id,
         c.name AS name,
         c.user_id AS user_id,
         COALESCE(u.name, CAST(c.user_id AS CHAR)) AS owner_name,
         c.organization_id AS organization_id,
         c.department_id AS department_id,
         c.category AS category,
         c.created_at AS created_at
       FROM customers c
       LEFT JOIN users u ON u.id = c.user_id
       ${
         restrictToOwnerOrCollaborator
           ? "LEFT JOIN entities_assist_users eau ON eau.subject_id = c.id AND eau.subject_type = 'Customer' AND CAST(eau.user_id AS CHAR) = ?"
           : ''
       }
       WHERE (
         c.name LIKE ?
         OR COALESCE(c.company_name, c.name) LIKE ?
         OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(c.company_name, c.name), '股份有限公司', ''), '有限公司', ''), '技术', ''), '科技', '') LIKE ?
       )${relationClause}
       ORDER BY c.created_at DESC`,
      queryParams,
    );

    return rows.map((item) => ({
      id: String(item.id),
      name: String(item.name),
      ownerId: String(item.user_id),
      ownerName: String(item.owner_name ?? item.user_id),
      organizationId:
        item.organization_id !== null && item.organization_id !== undefined
          ? String(item.organization_id)
          : undefined,
      departmentId:
        item.department_id !== null && item.department_id !== undefined
          ? String(item.department_id)
          : undefined,
      category: item.category ? String(item.category) : undefined,
      createdAt: item.created_at ? String(item.created_at) : undefined,
    }));
  }

  private loadMockCustomerRecords(
    user: CrmUser,
    customerName: string,
    restrictToOwnerOrCollaborator: boolean,
  ): CustomerLookupRecord[] {
    const normalizedSearchKey = this.normalizeComparisonText(customerName);
    const ownerNameMap = new Map(
      CRM_OPPORTUNITIES.map((item) => [item.ownerId, item.ownerName] as const),
    );
    const allRecords = this.crmReadonlyService
      .listCustomers()
      .filter((item) =>
        this.matchesComparisonText(normalizedSearchKey, [item.name, item.id]),
      )
      .map((item) => this.mapMockRecord(item, ownerNameMap));

    return restrictToOwnerOrCollaborator
      ? this.filterOwnedOrCollaboratedRecords(user, allRecords)
      : allRecords;
  }

  private mapMockRecord(
    item: CrmCustomer,
    ownerNameMap: Map<string, string>,
  ): CustomerLookupRecord {
    return {
      id: item.id,
      name: item.name,
      ownerId: item.ownerId,
      ownerName: ownerNameMap.get(item.ownerId) ?? item.ownerId,
      organizationId: item.organizationId,
      departmentId: item.departmentId,
      category: item.category,
      createdAt: item.createdAt,
    };
  }

  private filterOwnedOrCollaboratedRecords(
    user: CrmUser,
    records: CustomerLookupRecord[],
  ): CustomerLookupRecord[] {
    return records.filter(
      (item) =>
        this.isActorMatched(item.ownerId, item.ownerName, user) ||
        (MOCK_CUSTOMER_ASSIST_USER_IDS[item.id] ?? []).includes(user.id),
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

  private applyScopeFilter(
    records: CustomerLookupRecord[],
    scopeSnapshot: ScopeSnapshot,
  ): CustomerLookupRecord[] {
    return records.filter((item) => {
      if (
        scopeSnapshot.organizationIds.length > 0 &&
        item.organizationId &&
        !scopeSnapshot.organizationIds.includes(item.organizationId)
      ) {
        return false;
      }

      if (
        scopeSnapshot.departmentIds.length > 0 &&
        item.departmentId &&
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

  private buildSummary(
    searchKey: string,
    totalCount: number,
    records: CustomerLookupRecord[],
  ): string {
    if (totalCount === 0) {
      return `未按名称「${searchKey}」查到客户记录。`;
    }

    const topLines = records.map(
      (item, index) =>
        `${index + 1}. ${item.name}｜${item.category ?? '未分类'}｜${item.ownerName}`,
    );

    return [
      `已按名称「${searchKey}」查到 ${totalCount} 条客户。`,
      `先看前 ${records.length} 条：`,
      ...topLines,
    ].join('\n');
  }

  private normalizeSearchText(value: string): string {
    return value.replace(/\s+/g, '').replace(/[“"『】』【]/g, '').trim();
  }

  private normalizeComparisonText(value: string): string {
    return value
      .replace(/\s+/g, '')
      .replace(/[“"『】』【]/g, '')
      .replace(/[—–_·•.,，。！？!?；;:：/\\|（）()]/g, '')
      .replace(/-/g, '')
      .trim();
  }

  private normalizeName(value: string | undefined): string {
    return value?.replace(/\s+/gu, '').trim().toLowerCase() ?? '';
  }

  private normalizeLimit(limit?: number): number {
    const parsed = Number.isFinite(limit ?? NaN) ? Number(limit) : 5;
    return Math.max(1, Math.min(Math.trunc(parsed), 10));
  }

  private matchesComparisonText(
    text: string,
    values: Array<string | undefined>,
  ): boolean {
    const normalizedText = this.normalizeComparisonText(text);
    return values
      .filter((value): value is string => Boolean(value))
      .some((value) => {
        const normalizedValue = this.normalizeComparisonText(value);
        return (
          normalizedValue.length > 1 &&
          (normalizedText.includes(normalizedValue) ||
            normalizedValue.includes(normalizedText))
        );
      });
  }

  private buildLikePattern(value: string): string {
    return `%${this.normalizeSearchText(value).replace(/[\\%_]/g, '\\$&')}%`;
  }

  private crmReadonlyModeLabel(): string {
    return this.crmReadonlyService.canUseLiveQuery() ? 'live-db' : 'mock-data';
  }
}

const MOCK_CUSTOMER_ASSIST_USER_IDS: Record<string, string[]> = {
  cus_001: ['user_sales_director'],
  cus_002: ['user_sales_director'],
  cus_003: ['user_sales_director'],
};
