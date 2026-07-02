import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CreateCustomerRequest } from './crm-create.schemas';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { CRM_CUSTOMERS, CRM_OPPORTUNITIES } from '../../shared/mock/sample-data';
import type {
  CrmCustomer,
  CrmEntityAssistUser,
  CrmUser,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { CustomerLookupService } from './customer-lookup.service';
import {
  appendUrlEncodedFormField,
  type FormFieldValue,
} from '../../shared/utils/url-encoded-form.util';

export interface CustomerLookupRecord {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  organizationId?: string;
  departmentId?: string;
  category?: string;
  createdAt?: string;
}

export interface CustomerLookupResult {
  customerName: string;
  totalCount: number;
  limit: number;
  records: CustomerLookupRecord[];
  summary: string;
}

export interface CustomerCreateResult {
  customerId: string;
  customerName: string;
  ownerId: string;
  ownerName: string;
  departmentId?: string;
  departmentName?: string;
  phone?: string;
  createdAt: string;
  message: string;
}

@Injectable()
export class CrmCustomerApiService {
  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly customerLookupService: CustomerLookupService,
  ) {}

  async lookupByName(
    user: CrmUser,
    customerName: string,
    options?: {
      limit?: number;
      accessToken?: string;
      restrictToOwnerOrCollaborator?: boolean;
    },
  ): Promise<CustomerLookupResult> {
    const searchKey = this.normalizeSearchText(customerName).replace(
      /(?:客户名称|客户|公司名称|公司)$/u,
      '',
    );
    const limit = this.normalizeLimit(options?.limit);
    const restrictToOwnerOrCollaborator =
      options?.restrictToOwnerOrCollaborator === true;
    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();

    this.analysisLoggerService.logStep('客户名称查询开始。', {
      requesterId: user.id,
      requesterName: user.name,
      searchKey,
      limit,
      restrictToOwnerOrCollaborator,
      tokenPresent: Boolean(options?.accessToken?.trim()),
      apiBaseUrl: crmAuthConfig.baseUrl,
      routeMode: restrictToOwnerOrCollaborator
        ? 'crm-readonly-preferred-with-api-fallback'
        : 'crm-open-api',
    });

    try {
      if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
        const mockResult = this.lookupFromMock(searchKey, limit, {
          actor: user,
          restrictToOwnerOrCollaborator,
        });
        this.analysisLoggerService.logStep('客户名称查询使用样例数据。', {
          searchKey,
          restrictToOwnerOrCollaborator,
          totalCount: mockResult.totalCount,
          returnedCount: mockResult.records.length,
        });
        return mockResult;
      }

      if (!crmAuthConfig.enabled || !crmAuthConfig.baseUrl) {
        throw new ServiceUnavailableException('当前未配置 CRM Open API 地址。');
      }

      const accessToken = options?.accessToken?.trim();
      if (!accessToken) {
        throw new UnauthorizedException('当前登录态缺少 CRM access token，请先重新登录。');
      }

      if (
        restrictToOwnerOrCollaborator &&
        (process.env.NODE_ENV === 'test' ||
          (await this.customerLookupService.ensureLiveQueryReady()))
      ) {
        return await this.customerLookupService.lookupByName(user, searchKey, {
          limit,
          restrictToOwnerOrCollaborator: true,
        });
      }

      const response = await this.fetchCustomerLookup(
        crmAuthConfig.baseUrl,
        crmAuthConfig.versionCode,
        crmAuthConfig.device,
        crmAuthConfig.timeoutMs,
        accessToken,
        searchKey,
        restrictToOwnerOrCollaborator ? Math.max(limit * 3, 30) : limit,
      );

      const filteredRecords = restrictToOwnerOrCollaborator
        ? await this.filterRecordsOwnedOrCollaboratedByActor({
            user,
            records: response.records,
            accessToken,
          })
        : response.records;
      const limitedRecords = filteredRecords.slice(0, limit);

      return {
        customerName: searchKey,
        totalCount: restrictToOwnerOrCollaborator
          ? filteredRecords.length
          : response.totalCount,
        limit,
        records: limitedRecords,
        summary: this.buildSummary(
          searchKey,
          restrictToOwnerOrCollaborator
            ? filteredRecords.length
            : response.totalCount,
          limitedRecords,
        ),
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('客户名称查询失败。', {
        searchKey,
        limit,
        restrictToOwnerOrCollaborator,
        hasAccessToken: Boolean(options?.accessToken?.trim()),
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      throw error;
    }
  }

  async getById(
    user: CrmUser,
    customerId: string,
    options?: { accessToken?: string },
  ): Promise<CustomerLookupRecord | undefined> {
    const normalizedCustomerId = customerId.trim();
    if (!normalizedCustomerId) {
      throw new BadRequestException('客户 ID 不能为空。');
    }

    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    this.analysisLoggerService.logStep('客户详情查询开始。', {
      requesterId: user.id,
      requesterName: user.name,
      customerId: normalizedCustomerId,
      tokenPresent: Boolean(options?.accessToken?.trim()),
      apiBaseUrl: crmAuthConfig.baseUrl,
      routeMode: 'crm-open-api',
    });

    try {
      if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
        return this.lookupFromMockById(normalizedCustomerId);
      }

      if (!crmAuthConfig.enabled || !crmAuthConfig.baseUrl) {
        throw new ServiceUnavailableException('当前未配置 CRM Open API 地址。');
      }

      const accessToken = options?.accessToken?.trim();
      if (!accessToken) {
        throw new UnauthorizedException('当前登录态缺少 CRM access token，请先重新登录。');
      }

      return await this.fetchCustomerById(
        crmAuthConfig.baseUrl,
        crmAuthConfig.versionCode,
        crmAuthConfig.device,
        crmAuthConfig.timeoutMs,
        accessToken,
        normalizedCustomerId,
      );
    } catch (error) {
      this.analysisLoggerService.logWarn('客户详情查询失败。', {
        customerId: normalizedCustomerId,
        hasAccessToken: Boolean(options?.accessToken?.trim()),
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      throw error;
    }
  }

  async getAssistUsersById(
    user: CrmUser,
    customerId: string,
    options?: { accessToken?: string },
  ): Promise<CrmEntityAssistUser[]> {
    const normalizedCustomerId = customerId.trim();
    if (!normalizedCustomerId) {
      throw new BadRequestException('客户 ID 不能为空。');
    }

    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    this.analysisLoggerService.logStep('客户协作人查询开始。', {
      requesterId: user.id,
      requesterName: user.name,
      customerId: normalizedCustomerId,
      tokenPresent: Boolean(options?.accessToken?.trim()),
      apiBaseUrl: crmAuthConfig.baseUrl,
      routeMode: 'crm-open-api',
    });

    try {
      if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
        return [];
      }

      if (!crmAuthConfig.enabled || !crmAuthConfig.baseUrl) {
        throw new ServiceUnavailableException('当前未配置 CRM Open API 地址。');
      }

      const accessToken = options?.accessToken?.trim();
      if (!accessToken) {
        throw new UnauthorizedException(
          '当前登录态缺少 CRM access token，请先重新登录。',
        );
      }

      return await this.fetchCustomerAssistUsers(
        crmAuthConfig.baseUrl,
        crmAuthConfig.versionCode,
        crmAuthConfig.device,
        crmAuthConfig.timeoutMs,
        accessToken,
        normalizedCustomerId,
      );
    } catch (error) {
      this.analysisLoggerService.logWarn('客户协作人查询失败。', {
        customerId: normalizedCustomerId,
        hasAccessToken: Boolean(options?.accessToken?.trim()),
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      throw error;
    }
  }

  async createCustomer(
    user: CrmUser,
    payload: CreateCustomerRequest,
    options?: { accessToken?: string },
  ): Promise<CustomerCreateResult> {
    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    const customerCreateConfig =
      this.localRuntimeConfigService.getCrmCustomerCreateConfig();
    const ownerId = payload.ownerUserId?.trim() ?? user.id;
    const departmentId =
      payload.wantDepartmentId?.trim() ?? user.departmentIds[0];
    const category =
      payload.category?.trim() ?? customerCreateConfig.defaultCategory?.trim();
    const source =
      payload.source?.trim() ?? customerCreateConfig.defaultSource?.trim();
    const missingCrmRequiredFields: string[] = [];

    if (!departmentId) {
      missingCrmRequiredFields.push('所属部门');
    }
    if (!category) {
      missingCrmRequiredFields.push('客户类型');
    }
    if (!source) {
      missingCrmRequiredFields.push('客户来源');
    }
    if (missingCrmRequiredFields.length > 0) {
      throw new BadRequestException(
        `新增客户缺少 CRM 必填字段：${missingCrmRequiredFields.join('、')}`,
      );
    }

    const customFieldPayload = {
      ...this.normalizeCustomFieldEntries(payload.customFields),
      ...this.buildCustomerRequiredCustomFields(payload),
    };
    const requestPayload: Record<string, FormFieldValue> = {
      user_id: ownerId,
      want_department_id: departmentId,
      name: payload.name,
      category,
      source,
      parent_id: payload.parentCustomerId,
      note: payload.note,
      industry: payload.industry,
      address_attributes: {
        tel: payload.phone,
      },
      ...customFieldPayload,
    };

    this.analysisLoggerService.logStep('新增客户请求开始组装', {
      requesterId: user.id,
      requesterName: user.name,
      ownerId,
      departmentId,
      category,
      source,
      hasAccessToken: Boolean(options?.accessToken?.trim()),
      mockEnabled: crmAuthConfig.mockEnabled,
    });

    if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
      return this.createCustomerFromMock(user, payload, {
        ownerId,
        departmentId,
      });
    }

    if (!crmAuthConfig.enabled || !crmAuthConfig.baseUrl) {
      throw new ServiceUnavailableException('当前未配置 CRM Open API 地址。');
    }

    const accessToken = options?.accessToken?.trim();
    if (!accessToken) {
      throw new UnauthorizedException(
        '当前登录态缺少 CRM access token，请先重新登录。',
      );
    }

    const response = await this.fetchCustomerCreate(
      crmAuthConfig.baseUrl,
      crmAuthConfig.versionCode,
      crmAuthConfig.device,
      crmAuthConfig.timeoutMs,
      accessToken,
      requestPayload,
    );

    const responseUser = (response.data.user ?? {}) as Record<string, unknown>;
    const responseDepartment = (response.data.owned_department ??
      {}) as Record<string, unknown>;
    const responseAddress = (response.data.address ?? {}) as Record<
      string,
      unknown
    >;

    return {
      customerId:
        this.readOptionalText(response.data.id) ?? buildEntityId('customer'),
      customerName:
        this.readOptionalText(response.data.name) ?? payload.name,
      ownerId: this.readOptionalText(responseUser.id) ?? ownerId,
      ownerName:
        this.readOptionalText(responseUser.name) ??
        (ownerId === user.id ? user.name : ownerId),
      departmentId: this.readOptionalText(responseDepartment.id) ?? departmentId,
      departmentName: this.readOptionalText(responseDepartment.name),
      phone:
        this.readOptionalText(responseAddress.tel) ??
        this.readOptionalText(responseAddress.phone) ??
        payload.phone,
      createdAt:
        this.readOptionalText(response.data.created_at) ??
        new Date().toISOString(),
      message: response.message ?? '客户创建成功。',
    };
  }

  private async fetchCustomerLookup(
    baseUrl: string,
    versionCode: string,
    device: string,
    timeoutMs: number,
    accessToken: string,
    searchKey: string,
    limit: number,
  ): Promise<{
    totalCount: number;
    records: CustomerLookupRecord[];
  }> {
    const requestUrl = new URL('/api/v2/customers', baseUrl);
    requestUrl.searchParams.set('query', searchKey);
    requestUrl.searchParams.set('page', '1');
    requestUrl.searchParams.set('per_page', String(limit));

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          Authorization: `Token token=${accessToken}, device=${device}, version_code=${versionCode}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException(
        `当前无法连接 CRM Open API，请确认 ${baseUrl} 可达后重试。`,
      );
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const apiCode = Number(payload.code ?? -1);
    const message = typeof payload.message === 'string' ? payload.message : undefined;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        message ?? `CRM 客户查询失败，HTTP ${response.status}。`,
      );
    }

    if (apiCode !== 0) {
      if (this.isAuthError(apiCode, message)) {
        throw new UnauthorizedException(message ?? 'CRM access token 已失效，请重新登录。');
      }
      throw new ServiceUnavailableException(message ?? 'CRM 客户查询失败。');
    }

    const records = this.normalizeCustomerRecords(data, limit);
    const totalCount = this.normalizeTotalCount(data, records.length);
    return {
      totalCount,
      records,
    };
  }

  private async fetchCustomerById(
    baseUrl: string,
    versionCode: string,
    device: string,
    timeoutMs: number,
    accessToken: string,
    customerId: string,
  ): Promise<CustomerLookupRecord | undefined> {
    const requestUrl = new URL(`/api/v2/customers/${customerId}`, baseUrl);

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          Authorization: `Token token=${accessToken}, device=${device}, version_code=${versionCode}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException(
        `当前无法连接 CRM Open API，请确认 ${baseUrl} 可达后重试。`,
      );
    }

    if (response.status === 404) {
      return undefined;
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const apiCode = Number(payload.code ?? -1);
    const message = typeof payload.message === 'string' ? payload.message : undefined;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        message ?? `CRM 客户详情查询失败，HTTP ${response.status}。`,
      );
    }

    if (apiCode !== 0) {
      if (this.isAuthError(apiCode, message)) {
        throw new UnauthorizedException(
          message ?? 'CRM access token 已失效，请重新登录。',
        );
      }
      if (this.isNotFoundError(message)) {
        return undefined;
      }
      throw new ServiceUnavailableException(message ?? 'CRM 客户详情查询失败。');
    }

    const rawRecord =
      (data.customer as Record<string, unknown> | undefined) ?? data;
    return this.normalizeCustomerRecords({ customers: [rawRecord] }, 1)[0];
  }

  private async fetchCustomerAssistUsers(
    baseUrl: string,
    versionCode: string,
    device: string,
    timeoutMs: number,
    accessToken: string,
    customerId: string,
  ): Promise<CrmEntityAssistUser[]> {
    const requestUrl = new URL(`/api/v2/customers/${customerId}/assist_users`, baseUrl);

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          Authorization: `Token token=${accessToken}, device=${device}, version_code=${versionCode}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException(
        `当前无法连接 CRM Open API，请确认 ${baseUrl} 可达后重试。`,
      );
    }

    if (response.status === 404) {
      return [];
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const apiCode = Number(payload.code ?? -1);
    const message = typeof payload.message === 'string' ? payload.message : undefined;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        message ?? `CRM 客户协作人查询失败，HTTP ${response.status}。`,
      );
    }

    if (apiCode !== 0) {
      if (this.isAuthError(apiCode, message)) {
        throw new UnauthorizedException(
          message ?? 'CRM access token 已失效，请重新登录。',
        );
      }
      if (this.isNotFoundError(message)) {
        return [];
      }
      throw new ServiceUnavailableException(message ?? 'CRM 客户协作人查询失败。');
    }

    return this.normalizeAssistUsers(data);
  }

  private async fetchCustomerCreate(
    baseUrl: string,
    versionCode: string,
    device: string,
    timeoutMs: number,
    accessToken: string,
    requestPayload: Record<string, FormFieldValue>,
  ): Promise<{
    httpStatus: number;
    responseOk: boolean;
    payload: Record<string, unknown>;
    apiCode: number;
    message?: string;
    data: Record<string, unknown>;
  }> {
    const requestUrl = new URL('/api/v2/customers', baseUrl);
    const requestBody = new URLSearchParams();
    appendUrlEncodedFormField(requestBody, 'customer', requestPayload);

    this.analysisLoggerService.logStep('新增客户请求已发送到 CRM Open API', {
      requestUrl: requestUrl.toString(),
      requestBody: requestBody.toString(),
    });

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          Authorization: `Token token=${accessToken}, device=${device}, version_code=${versionCode}`,
        },
        body: requestBody.toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException(
        `当前无法连接 CRM Open API，请确认 ${baseUrl} 可达后重试。`,
      );
    }

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const apiCode = Number(payload.code ?? -1);
    const message =
      typeof payload.message === 'string' ? payload.message : undefined;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    if (!response.ok) {
      if (this.isAuthError(apiCode, message)) {
        throw new UnauthorizedException(
          message ?? 'CRM access token 已失效，请重新登录。',
        );
      }
      throw new ServiceUnavailableException(
        message ?? `CRM 新增客户失败，HTTP ${response.status}。`,
      );
    }

    if (apiCode !== 0) {
      if (this.isAuthError(apiCode, message)) {
        throw new UnauthorizedException(
          message ?? 'CRM access token 已失效，请重新登录。',
        );
      }
      throw new ServiceUnavailableException(message ?? 'CRM 新增客户失败。');
    }

    return {
      httpStatus: response.status,
      responseOk: response.ok,
      payload,
      apiCode,
      message,
      data,
    };
  }

  private normalizeCustomerRecords(
    data: Record<string, unknown>,
    limit: number,
  ): CustomerLookupRecord[] {
    const items = Array.isArray(data.customers) ? data.customers : [];
    return items.slice(0, limit).map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: String(record.id ?? record.customer_id ?? ''),
        name: String(record.name ?? record.title ?? ''),
        ownerId: String(record.user_id ?? record.owner_id ?? ''),
        ownerName:
          this.readOptionalString(record.user_name) ??
          this.readOptionalString(record.owner_name) ??
          String(record.user_id ?? record.owner_id ?? ''),
        organizationId: this.readOptionalString(record.organization_id),
        departmentId: this.readOptionalString(record.department_id),
        category: this.readOptionalString(record.category),
        createdAt: this.readOptionalString(record.created_at),
      };
    });
  }

  private normalizeAssistUsers(data: Record<string, unknown>): CrmEntityAssistUser[] {
    const items = Array.isArray(data.assist_users)
      ? data.assist_users
      : Array.isArray(data.assists)
        ? data.assists
        : [];

    return items
      .map((item) => {
        const record = item as Record<string, unknown>;
        const id =
          this.readOptionalText(record.user_id) ??
          this.readOptionalText(record.id) ??
          this.readOptionalText(
            (record.user as Record<string, unknown> | undefined)?.id,
          );
        if (!id) {
          return undefined;
        }

        return {
          id,
          name:
            this.readOptionalText(record.user_name) ??
            this.readOptionalText(record.name) ??
            this.readOptionalText(
              (record.user as Record<string, unknown> | undefined)?.name,
            ) ??
            id,
        } satisfies CrmEntityAssistUser;
      })
      .filter((item): item is CrmEntityAssistUser => Boolean(item));
  }

  private normalizeTotalCount(data: Record<string, unknown>, fallbackCount: number): number {
    const totalCount = Number(data.total_count ?? data.total ?? fallbackCount);
    return Number.isFinite(totalCount) ? totalCount : fallbackCount;
  }

  private lookupFromMock(
    searchKey: string,
    limit: number,
    options?: {
      actor?: CrmUser;
      restrictToOwnerOrCollaborator?: boolean;
    },
  ): CustomerLookupResult {
    const normalizedSearchKey = this.normalizeComparisonText(searchKey);
    const ownerNameMap = new Map(
      CRM_OPPORTUNITIES.map((item) => [item.ownerId, item.ownerName] as const),
    );
    const allRecords = CRM_CUSTOMERS.filter((item) =>
      this.matchesComparisonText(normalizedSearchKey, [item.name, item.id]),
    )
      .map((item) => this.mapMockRecord(item, ownerNameMap))
      .filter((item) =>
        options?.restrictToOwnerOrCollaborator
          ? this.isActorMatched(item.ownerId, item.ownerName, options.actor) ||
            this.matchesMockCollaborator(item.id, options.actor)
          : true,
      );
    const records = allRecords.slice(0, limit);

    return {
      customerName: searchKey,
      totalCount: allRecords.length,
      limit,
      records,
      summary: this.buildSummary(searchKey, allRecords.length, records),
    };
  }

  private lookupFromMockById(
    customerId: string,
  ): CustomerLookupRecord | undefined {
    const ownerNameMap = new Map(
      CRM_OPPORTUNITIES.map((item) => [item.ownerId, item.ownerName] as const),
    );
    const matched = CRM_CUSTOMERS.find((item) => item.id === customerId);
    return matched ? this.mapMockRecord(matched, ownerNameMap) : undefined;
  }

  private createCustomerFromMock(
    user: CrmUser,
    payload: CreateCustomerRequest,
    options: {
      ownerId: string;
      departmentId: string;
    },
  ): CustomerCreateResult {
    const createdAt = new Date().toISOString();
    const customerId = buildEntityId('customer');

    // 样例模式下也把新建客户写回到内存样本里，便于后续日报和联调直接读取当天新增结果。
    CRM_CUSTOMERS.unshift({
      id: customerId,
      name: payload.name,
      ownerId: options.ownerId,
      organizationId: user.organizationIds[0] ?? 'org_north',
      departmentId: options.departmentId,
      category:
        payload.category?.trim() ??
        this.localRuntimeConfigService.getCrmCustomerCreateConfig().defaultCategory?.trim() ??
        '未分类',
      createdAt,
    });

    return {
      customerId,
      customerName: payload.name,
      ownerId: options.ownerId,
      ownerName: options.ownerId === user.id ? user.name : options.ownerId,
      departmentId: options.departmentId,
      phone: payload.phone,
      createdAt,
      message: '客户已通过 mock 模式创建。',
    };
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
    };
  }

  private buildSummary(
    searchKey: string,
    totalCount: number,
    records: CustomerLookupRecord[],
  ): string {
    if (totalCount === 0) {
      return `未按名称「${searchKey}」查到客户记录。`;
    }

    const topLines = records.map((item, index) =>
      `${index + 1}. ${item.name}｜${item.category ?? '未分类'}｜${item.ownerName}`,
    );

    return [
      `已按名称「${searchKey}」查到 ${totalCount} 条客户。`,
      `先看前 ${records.length} 条：`,
      ...topLines,
    ].join('\n');
  }

  private buildCustomerRequiredCustomFields(
    payload: CreateCustomerRequest,
  ): Record<string, string> {
    const customerCreateConfig =
      this.localRuntimeConfigService.getCrmCustomerCreateConfig();
    const itDecisionLocationField =
      customerCreateConfig.itDecisionLocationField?.trim();
    const unifiedSocialCreditCodeField =
      customerCreateConfig.unifiedSocialCreditCodeField?.trim();

    if (!itDecisionLocationField) {
      throw new BadRequestException(
        '缺少新增客户字段映射配置：CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD',
      );
    }
    if (!unifiedSocialCreditCodeField) {
      throw new BadRequestException(
        '缺少新增客户字段映射配置：CRM_CUSTOMER_CREATE_UNIFIED_SOCIAL_CREDIT_CODE_FIELD',
      );
    }

    return {
      [itDecisionLocationField]: payload.itDecisionLocation,
      [unifiedSocialCreditCodeField]: payload.unifiedSocialCreditCode,
    };
  }

  private normalizeCustomFieldEntries(
    customFields?: Record<string, string | number | boolean>,
  ): Record<string, string | number | boolean> {
    if (!customFields) {
      return {};
    }

    const normalizedEntries: Record<string, string | number | boolean> = {};
    for (const [fieldKey, rawValue] of Object.entries(customFields)) {
      const trimmedFieldKey = fieldKey.trim();
      if (!trimmedFieldKey) {
        continue;
      }

      if (typeof rawValue === 'string') {
        const trimmedValue = rawValue.trim();
        if (!trimmedValue) {
          continue;
        }
        normalizedEntries[trimmedFieldKey] = trimmedValue;
        continue;
      }

      normalizedEntries[trimmedFieldKey] = rawValue;
    }

    return normalizedEntries;
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

  private normalizeLimit(limit?: number): number {
    const parsed = Number.isFinite(limit ?? NaN) ? Number(limit) : 5;
    return Math.max(1, Math.min(Math.trunc(parsed), 10));
  }

  /**
   * Open API 不支持直接按“负责人/协作人=当前用户”过滤时，使用当前页结果补查协作人做兜底裁剪。
   * 参数：当前用户、候选记录与当前 access token。
   * 返回：仅保留负责人或协作人命中当前用户本人的候选。
   */
  private async filterRecordsOwnedOrCollaboratedByActor(params: {
    user: CrmUser;
    records: CustomerLookupRecord[];
    accessToken: string;
  }): Promise<CustomerLookupRecord[]> {
    const filtered = await Promise.all(
      params.records.map(async (record) => {
        if (this.isActorMatched(record.ownerId, record.ownerName, params.user)) {
          return record;
        }

        try {
          const assistUsers = await this.getAssistUsersById(params.user, record.id, {
            accessToken: params.accessToken,
          });
          return assistUsers.some((item) =>
            this.isActorMatched(item.id, item.name, params.user),
          )
            ? record
            : undefined;
        } catch {
          return undefined;
        }
      }),
    );

    return filtered.filter((item): item is CustomerLookupRecord => Boolean(item));
  }

  private isActorMatched(
    ownerId: string | undefined,
    ownerName: string | undefined,
    actor: CrmUser | undefined,
  ): boolean {
    if (!actor) {
      return false;
    }

    return (
      ownerId === actor.id ||
      this.normalizeName(ownerName) === this.normalizeName(actor.name)
    );
  }

  private matchesMockCollaborator(
    customerId: string,
    actor: CrmUser | undefined,
  ): boolean {
    if (!actor) {
      return false;
    }

    return (MOCK_CUSTOMER_ASSIST_USER_IDS[customerId] ?? []).includes(actor.id);
  }

  private normalizeName(value: string | undefined): string {
    return value?.replace(/\s+/gu, '').trim().toLowerCase() ?? '';
  }

  private matchesComparisonText(text: string, values: Array<string | undefined>): boolean {
    const normalizedText = this.normalizeComparisonText(text);
    return values
      .filter((value): value is string => Boolean(value))
      .some((value) => {
        const normalizedValue = this.normalizeComparisonText(value);
        return (
          normalizedValue.length > 1 &&
          (normalizedText.includes(normalizedValue) || normalizedValue.includes(normalizedText))
        );
      });
  }

  private isAuthError(apiCode: number, message?: string): boolean {
    return (
      apiCode === 401 ||
      apiCode === 403 ||
      Boolean(message && /token|登录|授权|认证|权限/i.test(message))
    );
  }

  private isNotFoundError(message?: string): boolean {
    return Boolean(message && /not found|不存在|未找到/i.test(message));
  }

  private readOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private readOptionalText(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return undefined;
  }
}

const MOCK_CUSTOMER_ASSIST_USER_IDS: Record<string, string[]> = {
  cus_001: ['user_sales_director'],
  cus_002: ['user_sales_director'],
  cus_003: ['user_sales_director'],
};
