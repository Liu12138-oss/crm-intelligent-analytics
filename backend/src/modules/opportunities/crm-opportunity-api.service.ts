import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CreateOpportunityRequest } from './crm-create.schemas';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { CRM_CUSTOMERS, CRM_OPPORTUNITIES } from '../../shared/mock/sample-data';
import type {
  CrmEntityAssistUser,
  CrmOpportunity,
  CrmUser,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { OpportunityLookupService } from './opportunity-lookup.service';
import {
  appendUrlEncodedFormField,
  type FormFieldValue,
} from '../../shared/utils/url-encoded-form.util';
import { LianruanCrmQueryAdapterService } from '../crm-standard-api/lianruan-crm-query-adapter.service';

export interface OpportunityLookupRecord {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  ownerId: string;
  ownerName: string;
  organizationId?: string;
  departmentId?: string;
  expectAmount: number;
  stage: string;
  createdAt?: string;
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

export interface OpportunityCreateResult {
  opportunityId: string;
  title: string;
  customerId: string;
  customerName?: string;
  ownerId: string;
  ownerName: string;
  departmentId?: string;
  departmentName?: string;
  expectAmount: number;
  expectSignDate?: string;
  createdAt: string;
  message: string;
}

@Injectable()
export class CrmOpportunityApiService {
  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly opportunityLookupService: OpportunityLookupService,
    private readonly lianruanCrmQueryAdapterService: LianruanCrmQueryAdapterService,
  ) {}

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
      accessToken?: string;
      restrictToOwnerOrCollaborator?: boolean;
    },
  ): Promise<OpportunityLookupResult> {
    const searchKey = this.normalizeSearchText(companyName).replace(
      /(?:项目名称|项目|商机|客户名称|客户|公司名称|公司)$/u,
      '',
    );
    const limit = this.normalizeLimit(options?.limit);
    const customFieldName = this.normalizeOpportunityField(options?.customFieldName);
    const restrictToOwnerOrCollaborator =
      options?.restrictToOwnerOrCollaborator === true;
    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();

    this.analysisLoggerService.logStep('商机名称查询开始。', {
      requesterId: user.id,
      requesterName: user.name,
      searchKey,
      customFieldName,
      limit,
      restrictToOwnerOrCollaborator,
      identitySource: user.identitySource,
      tokenPresent: Boolean(options?.accessToken?.trim()),
      apiBaseUrl: crmAuthConfig.baseUrl,
      routeMode: restrictToOwnerOrCollaborator
        ? 'crm-readonly-preferred-with-api-fallback'
        : 'crm-open-api',
    });

    try {
      if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
        const mockResult = this.lookupFromMock(searchKey, limit, customFieldName, {
          actor: user,
          restrictToOwnerOrCollaborator,
        });
        this.analysisLoggerService.logStep('商机名称查询使用样例数据。', {
          searchKey,
          customFieldName,
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
          (await this.opportunityLookupService.ensureLiveQueryReady()))
      ) {
        return await this.opportunityLookupService.lookupByCompanyName(user, searchKey, {
          limit,
          customFieldName,
          restrictToOwnerOrCollaborator: true,
        });
      }

      const queryLimit = restrictToOwnerOrCollaborator ? Math.max(limit * 3, 30) : limit;
      const response =
        (await this.fetchStandardOpportunityLookup(searchKey, queryLimit)) ??
        (await this.fetchOpportunityLookup(
          crmAuthConfig.baseUrl,
          crmAuthConfig.versionCode,
          crmAuthConfig.device,
          crmAuthConfig.timeoutMs,
          accessToken,
          searchKey,
          queryLimit,
        ));

      this.analysisLoggerService.logStep('CRM 商机查询响应已返回。', {
        searchKey,
        customFieldName,
        httpStatus: response.httpStatus,
        apiCode: response.apiCode,
        message: response.message,
        totalCount: response.totalCount,
        returnedCount: response.records.length,
      });

      const matchedCompanyNames = Array.from(
        new Set(
          response.records
            .map((item) => item.customerName)
            .filter((item): item is string => Boolean(item)),
        ),
      );

      if (restrictToOwnerOrCollaborator) {
        const filteredRecords = await this.filterRecordsOwnedOrCollaboratedByActor({
          user,
          records: response.records,
          accessToken,
        });
        const limitedRecords = filteredRecords.slice(0, limit);
        const filteredMatchedCompanyNames = Array.from(
          new Set(
            filteredRecords
              .map((item) => item.customerName)
              .filter((item): item is string => Boolean(item)),
          ),
        );

        return {
          companyName: searchKey,
          customFieldName,
          totalCount: filteredRecords.length,
          limit,
          matchedCompanyNames: filteredMatchedCompanyNames,
          records: limitedRecords,
          summary: this.buildSummary(
            searchKey,
            customFieldName,
            filteredRecords.length,
            limitedRecords,
            filteredMatchedCompanyNames,
          ),
        };
      }

      const mergedResult = await this.mergeReadonlyLookupResults(
        user,
        searchKey,
        limit,
        customFieldName,
        response.records,
        matchedCompanyNames,
      );

      return {
        companyName: searchKey,
        customFieldName,
        totalCount: mergedResult.totalCount,
        limit,
        matchedCompanyNames: mergedResult.matchedCompanyNames,
        records: mergedResult.records,
        summary: this.buildSummary(
          searchKey,
          customFieldName,
          mergedResult.totalCount,
          mergedResult.records,
          mergedResult.matchedCompanyNames,
        ),
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('商机名称查询失败。', {
        searchKey,
        customFieldName,
        limit,
        restrictToOwnerOrCollaborator,
        identitySource: user.identitySource,
        hasAccessToken: Boolean(options?.accessToken?.trim()),
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      throw error;
    }
  }

  private async fetchStandardOpportunityLookup(
    searchKey: string,
    limit: number,
  ): Promise<{
    httpStatus: number;
    apiCode: number;
    message?: string;
    totalCount: number;
    records: OpportunityLookupRecord[];
  } | undefined> {
    if (!this.lianruanCrmQueryAdapterService.isEnabled()) {
      return undefined;
    }

    try {
      // 企业微信商机查询优先复用联软标准 OpenAPI，避免继续访问旧版
      // `/api/v2/opportunities` 路径导致演示环境 404。
      const result = await this.lianruanCrmQueryAdapterService.listOpportunities({
        keyword: searchKey,
        pageNo: 1,
        pageSize: limit,
      });
      const records = this.normalizeOpportunityRecords(
        { opportunities: result.items, total: result.total },
        limit,
      );

      this.analysisLoggerService.logStep('CRM 商机查询已使用联软标准 OpenAPI。', {
        searchKey,
        path: '/opportunities',
        totalCount: result.total,
        returnedCount: records.length,
      });

      return {
        httpStatus: 200,
        apiCode: 0,
        message: 'ok',
        totalCount: result.total,
        records,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error ?? 'unknown');
      this.analysisLoggerService.logWarn('联软标准 OpenAPI 商机查询失败，已停止回退旧接口。', {
        searchKey,
        path: '/opportunities',
        reason,
      });
      throw new ServiceUnavailableException(
        [
          `联软标准 OpenAPI 商机查询暂不可用：${this.normalizeRemoteFailureReason(reason)}。`,
          '请在治理后台执行连接测试，并确认对方已开放 /api/open/v1/opportunities 列表接口。',
        ].join(''),
      );
    }
  }

  async getById(
    user: CrmUser,
    opportunityId: string,
    options?: { accessToken?: string },
  ): Promise<OpportunityLookupRecord | undefined> {
    const normalizedOpportunityId = opportunityId.trim();
    if (!normalizedOpportunityId) {
      throw new BadRequestException('商机 ID 不能为空。');
    }

    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    this.analysisLoggerService.logStep('商机详情查询开始。', {
      requesterId: user.id,
      requesterName: user.name,
      opportunityId: normalizedOpportunityId,
      tokenPresent: Boolean(options?.accessToken?.trim()),
      apiBaseUrl: crmAuthConfig.baseUrl,
      routeMode: 'crm-open-api',
    });

    try {
      if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
        return this.lookupFromMockById(normalizedOpportunityId);
      }

      if (!crmAuthConfig.enabled || !crmAuthConfig.baseUrl) {
        throw new ServiceUnavailableException('当前未配置 CRM Open API 地址。');
      }

      const accessToken = options?.accessToken?.trim();
      if (!accessToken) {
        throw new UnauthorizedException('当前登录态缺少 CRM access token，请先重新登录。');
      }

      return await this.fetchOpportunityById(
        crmAuthConfig.baseUrl,
        crmAuthConfig.versionCode,
        crmAuthConfig.device,
        crmAuthConfig.timeoutMs,
        accessToken,
        normalizedOpportunityId,
      );
    } catch (error) {
      this.analysisLoggerService.logWarn('商机详情查询失败。', {
        opportunityId: normalizedOpportunityId,
        hasAccessToken: Boolean(options?.accessToken?.trim()),
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      throw error;
    }
  }

  async getAssistUsersById(
    user: CrmUser,
    opportunityId: string,
    options?: { accessToken?: string },
  ): Promise<CrmEntityAssistUser[]> {
    const normalizedOpportunityId = opportunityId.trim();
    if (!normalizedOpportunityId) {
      throw new BadRequestException('商机 ID 不能为空。');
    }

    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    this.analysisLoggerService.logStep('商机协作人查询开始。', {
      requesterId: user.id,
      requesterName: user.name,
      opportunityId: normalizedOpportunityId,
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

      return await this.fetchOpportunityAssistUsers(
        crmAuthConfig.baseUrl,
        crmAuthConfig.versionCode,
        crmAuthConfig.device,
        crmAuthConfig.timeoutMs,
        accessToken,
        normalizedOpportunityId,
      );
    } catch (error) {
      this.analysisLoggerService.logWarn('商机协作人查询失败。', {
        opportunityId: normalizedOpportunityId,
        hasAccessToken: Boolean(options?.accessToken?.trim()),
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      throw error;
    }
  }

  async createOpportunity(
    user: CrmUser,
    payload: CreateOpportunityRequest,
    options?: { accessToken?: string },
  ): Promise<OpportunityCreateResult> {
    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    const opportunityCreateConfig =
      this.localRuntimeConfigService.getCrmOpportunityCreateConfig();
    const ownerId = payload.ownerUserId?.trim() ?? user.id;
    const departmentId =
      payload.wantDepartmentId?.trim() ?? user.departmentIds[0];
    const stage =
      payload.stage?.trim() ?? opportunityCreateConfig.defaultStage?.trim();
    const source =
      payload.source?.trim() ?? opportunityCreateConfig.defaultSource?.trim();
    const kind =
      payload.kind?.trim() ?? opportunityCreateConfig.defaultKind?.trim();
    const requestPayload: Record<string, FormFieldValue> = {
      user_id: ownerId,
      title: payload.title,
      customer_id: payload.customerId,
      expect_amount: payload.expectAmount,
      expect_sign_date: payload.expectSignDate,
      want_department_id: departmentId,
      stage,
      source,
      kind,
      note: payload.note,
      customer_requirement: payload.customerRequirement,
      get_time: payload.getTime,
      product_assets_attributes: payload.productAssets.map((item) => ({
        product_id: item.productId,
        recommended_unit_price: item.recommendedUnitPrice,
        quantity: item.quantity,
        remark: item.remark,
      })),
      contact_assetships_attributes: payload.contactIds?.map((contactId) => ({
        contact_id: contactId,
      })),
      ...this.normalizeCustomFieldEntries(payload.customFields),
      ...this.buildOpportunityRequiredCustomFields(payload),
    };

    this.analysisLoggerService.logStep('新增商机请求开始组装', {
      requesterId: user.id,
      requesterName: user.name,
      ownerId,
      departmentId,
      stage,
      source,
      kind,
      productCount: payload.productAssets.length,
      hasAccessToken: Boolean(options?.accessToken?.trim()),
      mockEnabled: crmAuthConfig.mockEnabled,
    });

    if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
      return this.createOpportunityFromMock(user, payload, {
        ownerId,
        departmentId,
        stage,
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

    const response = await this.fetchOpportunityCreate(
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
    const responseCustomer = (response.data.customer ?? {}) as Record<
      string,
      unknown
    >;

    return {
      opportunityId:
        this.readOptionalText(response.data.id) ??
        buildEntityId('opportunity'),
      title: this.readOptionalText(response.data.title) ?? payload.title,
      customerId:
        this.readOptionalText(responseCustomer.id) ?? payload.customerId,
      customerName:
        this.readOptionalText(responseCustomer.name) ?? payload.customerName,
      ownerId: this.readOptionalText(responseUser.id) ?? ownerId,
      ownerName:
        this.readOptionalText(responseUser.name) ??
        (ownerId === user.id ? user.name : ownerId),
      departmentId: this.readOptionalText(responseDepartment.id) ?? departmentId,
      departmentName: this.readOptionalText(responseDepartment.name),
      expectAmount: Number(response.data.expect_amount ?? payload.expectAmount),
      expectSignDate:
        this.readOptionalText(response.data.expect_sign_date) ??
        payload.expectSignDate,
      createdAt:
        this.readOptionalText(response.data.created_at) ??
        new Date().toISOString(),
      message: response.message ?? '商机创建成功。',
    };
  }

  buildWecomReply(result: OpportunityLookupResult): string {
    if (result.totalCount === 0) {
      return [
        `未按「${result.companyName}」查到商机记录。`,
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
      `已按「${result.companyName}」查到 ${result.totalCount} 条商机。`,
      `先给你前 ${topRecords.length} 条：`,
      ...lines,
      extraLine,
      '如果这就是你要的公司，请回复“确认”，我再继续整理更完整的信息。',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async fetchOpportunityLookup(
    baseUrl: string,
    versionCode: string,
    device: string,
    timeoutMs: number,
    accessToken: string,
    searchKey: string,
    limit: number,
  ): Promise<{
    httpStatus: number;
    apiCode: number;
    message?: string;
    totalCount: number;
    records: OpportunityLookupRecord[];
  }> {
    const requestUrl = new URL('/api/v2/opportunities', baseUrl);
    requestUrl.searchParams.set('query', searchKey);
    requestUrl.searchParams.set('page', '1');
    requestUrl.searchParams.set('per_page', String(limit));

    this.analysisLoggerService.logStep('CRM 商机查询请求已发出。', {
      searchKey,
      requestUrl: requestUrl.toString(),
      limit,
      versionCode,
      device,
    });

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
    } catch (error) {
      this.analysisLoggerService.logWarn('CRM 商机查询请求失败，无法连接 Open API。', {
        searchKey,
        requestUrl: requestUrl.toString(),
        timeoutMs,
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      throw new ServiceUnavailableException(
        `当前无法连接 CRM Open API，请确认 ${baseUrl} 可达后重试。`,
      );
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const apiCode = Number(payload.code ?? -1);
    const message = typeof payload.message === 'string' ? payload.message : undefined;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    this.analysisLoggerService.logStep('CRM 商机查询响应原文已收到。', {
      searchKey,
      requestUrl: requestUrl.toString(),
      httpStatus: response.status,
      apiCode,
      message,
      dataKeys: Object.keys(data),
      opportunityCount: Array.isArray(data.opportunities) ? data.opportunities.length : 0,
    });

    if (!response.ok) {
      this.analysisLoggerService.logWarn('CRM 商机查询 HTTP 响应异常。', {
        searchKey,
        requestUrl: requestUrl.toString(),
        httpStatus: response.status,
        apiCode,
        message,
      });
      throw new ServiceUnavailableException(
        message ?? `CRM 商机查询失败，HTTP ${response.status}。`,
      );
    }

    if (apiCode !== 0) {
      this.analysisLoggerService.logWarn('CRM 商机查询业务码异常。', {
        searchKey,
        requestUrl: requestUrl.toString(),
        httpStatus: response.status,
        apiCode,
        message,
      });
      if (this.isAuthError(apiCode, message)) {
        throw new UnauthorizedException(message ?? 'CRM access token 已失效，请重新登录。');
      }
      throw new ServiceUnavailableException(message ?? 'CRM 商机查询失败。');
    }

    const records = this.normalizeOpportunityRecords(data, limit);
    const totalCount = this.normalizeTotalCount(data, records.length);

    return {
      httpStatus: response.status,
      apiCode,
      message,
      totalCount,
      records,
    };
  }

  private async fetchOpportunityById(
    baseUrl: string,
    versionCode: string,
    device: string,
    timeoutMs: number,
    accessToken: string,
    opportunityId: string,
  ): Promise<OpportunityLookupRecord | undefined> {
    const requestUrl = new URL(`/api/v2/opportunities/${opportunityId}`, baseUrl);

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
        message ?? `CRM 商机详情查询失败，HTTP ${response.status}。`,
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
      throw new ServiceUnavailableException(message ?? 'CRM 商机详情查询失败。');
    }

    const rawRecord =
      (data.opportunity as Record<string, unknown> | undefined) ?? data;
    return this.normalizeOpportunityRecords({ opportunities: [rawRecord] }, 1)[0];
  }

  private async fetchOpportunityAssistUsers(
    baseUrl: string,
    versionCode: string,
    device: string,
    timeoutMs: number,
    accessToken: string,
    opportunityId: string,
  ): Promise<CrmEntityAssistUser[]> {
    const requestUrl = new URL(
      `/api/v2/opportunities/${opportunityId}/assist_users`,
      baseUrl,
    );

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
        message ?? `CRM 商机协作人查询失败，HTTP ${response.status}。`,
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
      throw new ServiceUnavailableException(message ?? 'CRM 商机协作人查询失败。');
    }

    return this.normalizeAssistUsers(data);
  }

  private async fetchOpportunityCreate(
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
    const requestUrl = new URL('/api/v2/opportunities', baseUrl);
    const requestBody = new URLSearchParams();
    appendUrlEncodedFormField(requestBody, 'opportunity', requestPayload);

    this.analysisLoggerService.logStep('新增商机请求已发送到 CRM Open API', {
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
        message ?? `CRM 新增商机失败，HTTP ${response.status}。`,
      );
    }

    if (apiCode !== 0) {
      if (this.isAuthError(apiCode, message)) {
        throw new UnauthorizedException(
          message ?? 'CRM access token 已失效，请重新登录。',
        );
      }
      throw new ServiceUnavailableException(message ?? 'CRM 新增商机失败。');
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

  private normalizeOpportunityRecords(
    data: Record<string, unknown>,
    limit: number,
  ): OpportunityLookupRecord[] {
    const items = Array.isArray(data.opportunities) ? data.opportunities : [];
    return items.slice(0, limit).map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: String(record.id ?? record.opportunity_id ?? ''),
        title: String(record.title ?? record.name ?? ''),
        customerId: this.readOptionalString(record.customer_id),
        customerName:
          this.readOptionalString(record.customer_name) ??
          this.readOptionalString((record.customer as Record<string, unknown> | undefined)?.name),
        ownerId: String(record.user_id ?? record.owner_id ?? ''),
        ownerName:
          this.readOptionalString(record.user_name) ??
          this.readOptionalString(record.owner_name) ??
          String(record.user_id ?? record.owner_id ?? ''),
        organizationId: this.readOptionalString(record.organization_id),
        departmentId: this.readOptionalString(record.department_id),
        expectAmount: Number(record.expect_amount ?? record.amount ?? 0),
        stage: String(record.stage_mapped ?? record.stage ?? ''),
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
    customFieldName: OpportunityLookupField,
    options?: {
      actor?: CrmUser;
      restrictToOwnerOrCollaborator?: boolean;
    },
  ): OpportunityLookupResult {
    const normalizedSearchKey = this.normalizeComparisonText(searchKey);
    const allRecords = CRM_OPPORTUNITIES.filter((item) =>
      this.matchesComparisonText(normalizedSearchKey, [
        item.title,
        item.id,
        this.findMockMatchedCustomerName(item, normalizedSearchKey),
      ]),
    )
      .map((item) => this.mapMockRecord(item, normalizedSearchKey))
      .filter((item) =>
        options?.restrictToOwnerOrCollaborator
          ? this.isActorMatched(item.ownerId, item.ownerName, options.actor) ||
            this.matchesMockCollaborator(item.id, options.actor)
          : true,
      );

    const records = allRecords.slice(0, limit);

    const uniqueCompanyNames = Array.from(
      new Set(records.map((item) => item.customerName).filter((item): item is string => Boolean(item))),
    );

    return {
      companyName: searchKey,
      customFieldName,
      totalCount: allRecords.length,
      limit,
      matchedCompanyNames: uniqueCompanyNames,
      records,
      summary: this.buildSummary(
        searchKey,
        customFieldName,
        allRecords.length,
        records,
        uniqueCompanyNames,
      ),
    };
  }

  private lookupFromMockById(
    opportunityId: string,
  ): OpportunityLookupRecord | undefined {
    const matched = CRM_OPPORTUNITIES.find((item) => item.id === opportunityId);
    return matched ? this.mapMockRecord(matched, matched.title) : undefined;
  }

  private createOpportunityFromMock(
    user: CrmUser,
    payload: CreateOpportunityRequest,
    options: {
      ownerId: string;
      departmentId?: string;
      stage?: string;
    },
  ): OpportunityCreateResult {
    const createdAt = new Date().toISOString();
    const opportunityId = buildEntityId('opportunity');

    // 样例模式下同步追加到内存商机样本，确保日报等后续流程能读取当天新增商机。
    CRM_OPPORTUNITIES.unshift({
      id: opportunityId,
      title: payload.title,
      ownerId: options.ownerId,
      ownerName: options.ownerId === user.id ? user.name : options.ownerId,
      organizationId: user.organizationIds[0] ?? 'org_north',
      departmentId: options.departmentId ?? user.departmentIds[0] ?? 'dept_sales',
      expectAmount: payload.expectAmount,
      stage: options.stage ?? '未知阶段',
      createdAt,
    });

    return {
      opportunityId,
      title: payload.title,
      customerId: payload.customerId,
      customerName: payload.customerName,
      ownerId: options.ownerId,
      ownerName: options.ownerId === user.id ? user.name : options.ownerId,
      departmentId: options.departmentId,
      expectAmount: payload.expectAmount,
      expectSignDate: payload.expectSignDate,
      createdAt,
      message: '商机已通过 mock 模式创建。',
    };
  }

  private mapMockRecord(
    item: CrmOpportunity,
    searchKey: string,
  ): OpportunityLookupRecord {
    const matchedCustomerName = this.findMockMatchedCustomerName(item, searchKey);
    const matchedCustomer = matchedCustomerName
      ? CRM_CUSTOMERS.find((customer) => customer.name === matchedCustomerName)
      : undefined;

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
  }

  private findMockMatchedCustomerName(
    item: CrmOpportunity,
    searchKey: string,
  ): string | undefined {
    return CRM_CUSTOMERS.find((customer) =>
      this.matchesComparisonText(item.title, [customer.name]) &&
      this.matchesComparisonText(searchKey, [customer.name, item.title]),
    )?.name;
  }

  private buildSummary(
    searchKey: string,
    customFieldName: OpportunityLookupField,
    totalCount: number,
    limitedRecords: OpportunityLookupRecord[],
    matchedCompanyNames: string[],
  ): string {
    if (totalCount === 0) {
      return `未按 ${customFieldName}「${searchKey}」查到商机记录，请补充更完整的名称。`;
    }

    const topLines = limitedRecords.map((item, index) => {
      const companyLabel = item.customerName ?? item.title;
      return `${index + 1}. ${companyLabel}｜${item.title}｜${item.stage}｜预计${item.expectAmount.toLocaleString()}｜${item.ownerName}`;
    });
    const matchedCompanyText = matchedCompanyNames.length
      ? `，命中公司：${matchedCompanyNames.slice(0, 3).join('、')}`
      : '';
    const extraText = totalCount > limitedRecords.length ? `，另有 ${totalCount - limitedRecords.length} 条未展开` : '';

    return [
      `已按 ${customFieldName}「${searchKey}」查到 ${totalCount} 条商机${matchedCompanyText}${extraText}。`,
      `先看前 ${limitedRecords.length} 条：`,
      ...topLines,
      '回复“确认”后我再继续整理更完整的信息。',
    ].join('\n');
  }

  private async mergeReadonlyLookupResults(
    user: CrmUser,
    searchKey: string,
    limit: number,
    customFieldName: OpportunityLookupField,
    apiRecords: OpportunityLookupRecord[],
    apiMatchedCompanyNames: string[],
  ): Promise<{
    totalCount: number;
    matchedCompanyNames: string[];
    records: OpportunityLookupRecord[];
  }> {
    try {
      const readonlyResult = await this.opportunityLookupService.lookupByCompanyName(
        user,
        searchKey,
        {
          limit: Math.max(limit, 10),
          customFieldName,
        },
      );
      const mergedRecords = this.mergeOpportunityLookupRecords([
        ...apiRecords,
        ...readonlyResult.records,
      ]);
      const mergedCompanyNames = Array.from(
        new Set([...apiMatchedCompanyNames, ...readonlyResult.matchedCompanyNames]),
      );

      return {
        totalCount: Math.max(apiRecords.length, readonlyResult.totalCount),
        matchedCompanyNames: mergedCompanyNames,
        records: mergedRecords.slice(0, limit),
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('商机查询只读库补充召回失败。', {
        searchKey,
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });

      return {
        totalCount: apiRecords.length,
        matchedCompanyNames: apiMatchedCompanyNames,
        records: apiRecords,
      };
    }
  }

  private mergeOpportunityLookupRecords(
    records: OpportunityLookupRecord[],
  ): OpportunityLookupRecord[] {
    const seenIds = new Set<string>();
    const merged: OpportunityLookupRecord[] = [];

    for (const record of records) {
      if (seenIds.has(record.id)) {
        continue;
      }
      seenIds.add(record.id);
      merged.push(record);
    }

    return merged.sort(
      (left, right) =>
        new Date(right.createdAt ?? '').getTime() - new Date(left.createdAt ?? '').getTime(),
    );
  }

  private buildOpportunityRequiredCustomFields(
    payload: CreateOpportunityRequest,
  ): Record<string, string> {
    const opportunityCreateConfig =
      this.localRuntimeConfigService.getCrmOpportunityCreateConfig();
    const fieldMappings = [
      {
        envName: 'CRM_OPPORTUNITY_CREATE_LEAD_CODE_FIELD',
        fieldKey: opportunityCreateConfig.leadCodeField?.trim(),
        value: payload.leadCode,
      },
      {
        envName: 'CRM_OPPORTUNITY_CREATE_RENEWAL_CONTRACT_CODE_FIELD',
        fieldKey: opportunityCreateConfig.renewalContractCodeField?.trim(),
        value: payload.renewalContractCode,
      },
      {
        envName: 'CRM_OPPORTUNITY_CREATE_AGENT_FULL_NAME_FIELD',
        fieldKey: opportunityCreateConfig.agentFullNameField?.trim(),
        value: payload.agentFullName,
      },
      {
        envName: 'CRM_OPPORTUNITY_CREATE_PROJECT_STATUS_FIELD',
        fieldKey: opportunityCreateConfig.projectStatusField?.trim(),
        value: payload.projectStatusSummary,
      },
      {
        envName: 'CRM_OPPORTUNITY_CREATE_PRE_SALES_FIELD',
        fieldKey: opportunityCreateConfig.preSalesField?.trim(),
        value: payload.preSalesName,
      },
    ];

    const result: Record<string, string> = {};
    for (const mapping of fieldMappings) {
      if (!mapping.fieldKey) {
        throw new BadRequestException(
          `缺少新增商机字段映射配置：${mapping.envName}`,
        );
      }

      result[mapping.fieldKey] = mapping.value;
    }

    return result;
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
   * Open API 不能按当前操作者关系过滤时，补查协作人集合，只保留负责人或协作人命中当前用户本人的记录。
   * 参数：当前用户、候选记录与 access token。
   * 返回：收窄后的商机候选。
   */
  private async filterRecordsOwnedOrCollaboratedByActor(params: {
    user: CrmUser;
    records: OpportunityLookupRecord[];
    accessToken: string;
  }): Promise<OpportunityLookupRecord[]> {
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

    return filtered.filter((item): item is OpportunityLookupRecord => Boolean(item));
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
    opportunityId: string,
    actor: CrmUser | undefined,
  ): boolean {
    if (!actor) {
      return false;
    }

    return (MOCK_OPPORTUNITY_ASSIST_USER_IDS[opportunityId] ?? []).includes(actor.id);
  }

  private normalizeName(value: string | undefined): string {
    return value?.replace(/\s+/gu, '').trim().toLowerCase() ?? '';
  }

  private hasAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
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

  private looksLikeEntityName(text: string): boolean {
    if (/[\u4e00-\u9fa5A-Za-z0-9]{3,}/.test(text) === false) {
      return false;
    }

    return /^[\u4e00-\u9fa5A-Za-z0-9·（）()_—-]{3,40}$/.test(text);
  }

  private normalizeOpportunityField(field?: string): OpportunityLookupField {
    if (!field || field === 'title') {
      return 'title';
    }

    throw new BadRequestException('当前仅支持 custom_field_name=title。');
  }

  /**
   * 将远端异常压缩为可展示的中文原因。
   *
   * 参数说明：`reason` 为标准 OpenAPI 客户端抛出的原始错误消息。
   * 返回值说明：返回不包含堆栈和敏感信息的用户可读提示片段。
   * 调用注意事项：该方法只用于查询失败提示，不改变审计日志中的原始排障信息。
   */
  private normalizeRemoteFailureReason(reason: string): string {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      return '未收到明确失败原因';
    }

    return normalizedReason.length > 120
      ? `${normalizedReason.slice(0, 120)}...`
      : normalizedReason;
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
