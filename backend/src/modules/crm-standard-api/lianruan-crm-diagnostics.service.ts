import { BadRequestException, Injectable } from '@nestjs/common';
import type { CrmUser } from '../../shared/types/domain';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { LianruanCrmConnectionConfigService } from '../governance/lianruan-crm-connection-config.service';
import { LianruanCrmOpenApiAdapterService } from './lianruan-crm-openapi.adapter.service';
import { LianruanCrmQueryAdapterService } from './lianruan-crm-query-adapter.service';
import type {
  LianruanCrmOpenApiListQuery,
  LianruanCrmOpenApiPageResult,
  LianruanCrmOpenApiResource,
  LianruanCrmOpenApiCatalogResource,
  LianruanCrmOpenApiOperationResource,
} from './lianruan-crm-openapi.types';
import { LianruanCrmFieldCapabilityRegistry } from './lianruan-crm-field-capability.registry';

const SUPPORTED_STANDARD_RESOURCES: LianruanCrmOpenApiResource[] = [
  'users',
  'customers',
  'partners',
  'registrations',
  'opportunities',
  'quotes',
  'orders',
];

/**
 * 2026-06-24 联软 OpenAPI 扩展开放的产品目录资源。
 *
 * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节。
 * 诊断时按需拉取样例，判断字段完整性。
 */
const SUPPORTED_CATALOG_RESOURCES: LianruanCrmOpenApiCatalogResource[] = [
  'categories',
  'modules',
  'features',
  'hardware',
  'packages',
  'products',
];

/**
 * 2026-06-24 联软 OpenAPI 扩展开放的运营与提醒资源。
 *
 * 来源：《AI-agent 全量业务 OpenAPI 取数说明》第 3 节。
 * channel-operations-overview / dashboard-stats 为单数聚合端点，不进入列表诊断。
 */
const SUPPORTED_OPERATION_RESOURCES: LianruanCrmOpenApiOperationResource[] = [
  'notifications',
  'pending-approvals',
  'channel-targets',
  'channel-visits',
];

const EXPECTED_DICTIONARY_KEYS = [
  'roles',
  'customerCategories',
  'customerTypes',
  'partnerLevels',
  'partnerTypes',
  'partnerCooperationLevels',
  'registrationStatuses',
  'opportunityStages',
  'quoteStatuses',
  'orderStatuses',
  'regions',
  'bigRegions',
  // 2026-06-24 字典增强（来源：扩展资源说明第 5 节）
  'productStatuses',
  'priceTypes',
  'publishStatuses',
  'approvalTypes',
  'approvalStatuses',
  'notificationTypes',
  'channelVisitTypes',
  'channelVisitStatuses',
  'workloadProductTypes',
  'workloadDeliveryTags',
  'auditModules',
  'auditActions',
  'auditResults',
] as const;

@Injectable()
export class LianruanCrmDiagnosticsService {
  constructor(
    private readonly lianruanCrmConnectionConfigService: LianruanCrmConnectionConfigService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly lianruanCrmOpenApiAdapterService: LianruanCrmOpenApiAdapterService,
    private readonly lianruanCrmQueryAdapterService: LianruanCrmQueryAdapterService,
    private readonly lianruanCrmFieldCapabilityRegistry: LianruanCrmFieldCapabilityRegistry,
  ) {}

  /**
   * 读取联软标准 OpenAPI 联调诊断快照。
   *
   * 参数说明：`user` 为当前登录的本项目用户。
   * 返回值说明：返回配置状态、远端身份、权限范围、资源授权与字典完整度摘要。
   * 调用注意事项：仅治理管理员可访问，用于联调排障与上线前核对，不影响现有业务主链。
   */
  async getDiagnostics(user: CrmUser): Promise<Record<string, unknown>> {
    this.ensureDiagnosticsAccess(user);

    const runtimeConfig =
      this.lianruanCrmConnectionConfigService.getEffectiveRuntimeConfig();
    const enabled = this.lianruanCrmOpenApiAdapterService.isEnabled();

    if (!enabled) {
      return {
        enabled: false,
        config: {
          baseUrl: runtimeConfig.baseUrl,
          baseUrlPresent: Boolean(runtimeConfig.baseUrl),
          appKeyPresent: Boolean(runtimeConfig.appKey),
          appSecretPresent: Boolean(runtimeConfig.appSecret),
          timeoutMs: runtimeConfig.timeoutMs,
          tokenCacheBufferSeconds: runtimeConfig.tokenCacheBufferSeconds,
        },
        message: '当前未启用联软标准 OpenAPI，请先补齐联调环境参数。',
      };
    }

    const snapshot = await this.lianruanCrmOpenApiAdapterService.getBootstrapSnapshot();
    const availableDictionaryKeys = Object.keys(snapshot.dictionaries).filter(
      (key) => Array.isArray(snapshot.dictionaries[key]),
    );
    const missingDictionaryKeys = EXPECTED_DICTIONARY_KEYS.filter(
      (key) => !availableDictionaryKeys.includes(key),
    );
    const resourceSamples = await this.buildResourceSamples();
    const samplesByResource = Object.fromEntries(
      resourceSamples
        .filter((item) => item.status === 'AVAILABLE')
        .map((item) => [item.resource, item.items]),
    ) as Partial<Record<LianruanCrmOpenApiResource, Record<string, unknown>[]>>;
    const fieldCapabilities = this.lianruanCrmFieldCapabilityRegistry.buildDiagnostics(
      samplesByResource,
      snapshot.dictionaries,
    );

    return {
      enabled: true,
      config: {
        baseUrl: runtimeConfig.baseUrl,
        timeoutMs: runtimeConfig.timeoutMs,
        tokenCacheBufferSeconds: runtimeConfig.tokenCacheBufferSeconds,
      },
      context: {
        clientId: snapshot.context.client.id,
        clientName: snapshot.context.client.name,
        boundUserId: snapshot.context.user.id,
        boundUserName: snapshot.context.user.name,
        boundUserRole: snapshot.context.user.role,
        allowedResources: snapshot.context.client.allowedResources,
      },
      permissionScope: snapshot.permissionScope,
      permissionView: {
        crmUserId: snapshot.permissionScope.user.id,
        userName: snapshot.permissionScope.user.name,
        role: snapshot.permissionScope.user.role,
        scopeType: snapshot.permissionScope.scopeType,
        regions: snapshot.permissionScope.regions,
        partnerIds: snapshot.permissionScope.partnerIds,
        userIds: snapshot.permissionScope.userIds,
        clientMode: 'bound-client',
        boundClientUserId: snapshot.context.client.boundUserId,
        currentLoginUserId: user.id,
        boundUserMatchesCurrentLogin:
          String(snapshot.context.client.boundUserId ?? '') === String(user.id ?? ''),
        resources: Object.fromEntries(
          resourceSamples.map((item) => [
            item.resource,
            {
              status: item.status,
              sampleCount: item.sampleCount,
              total: item.total,
              requestId: item.requestId,
              failureReason: item.failureReason,
            },
          ]),
        ),
      },
      dictionaries: {
        availableKeys: availableDictionaryKeys,
        missingKeys: missingDictionaryKeys,
        completeness: Number(
          (
            availableDictionaryKeys.filter((key) =>
              EXPECTED_DICTIONARY_KEYS.includes(
                key as (typeof EXPECTED_DICTIONARY_KEYS)[number],
              ),
            ).length / EXPECTED_DICTIONARY_KEYS.length
          ).toFixed(2),
        ),
      },
      fieldCapabilities,
      supportedResources: SUPPORTED_STANDARD_RESOURCES,
    };
  }

  /**
   * 查询联软标准资源列表，供内部联调与字段核对使用。
   *
   * 参数说明：
   * - `user`：当前登录用户。
   * - `resource`：标准资源名。
   * - `query`：分页与筛选参数。
   * 返回值说明：返回标准资源分页结果。
   * 调用注意事项：该入口只用于内部联调验证，不应替代后续正式业务查询编排。
   */
  async listResource(
    user: CrmUser,
    resource: string,
    query: LianruanCrmOpenApiListQuery,
  ): Promise<LianruanCrmOpenApiPageResult<Record<string, unknown>>> {
    this.ensureDiagnosticsAccess(user);
    const normalizedResource = this.normalizeResource(resource);
    return this.lianruanCrmQueryAdapterService.listByResource(
      normalizedResource,
      query,
    );
  }

  /**
   * 查询联软标准资源详情，供内部联调与字段核对使用。
   *
   * 参数说明：
   * - `user`：当前登录用户。
   * - `resource`：标准资源名。
   * - `id`：对象主键。
   * 返回值说明：返回标准资源详情对象。
   * 调用注意事项：仅治理管理员可访问，避免普通业务用户误把该入口当作正式业务功能。
   */
  async getResourceDetail(
    user: CrmUser,
    resource: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    this.ensureDiagnosticsAccess(user);
    const normalizedResource = this.normalizeResource(resource);
    return this.lianruanCrmQueryAdapterService.getDetailByResource(
      normalizedResource,
      id,
    );
  }

  /**
   * 校验当前用户是否具备联调诊断访问权。
   *
   * 参数说明：`user` 为当前登录用户。
   * 返回值说明：无返回值；校验失败直接抛权限异常。
   * 调用注意事项：当前统一复用 `governance.policy.manage` 权限，避免新增一套临时权限键。
   */
  private ensureDiagnosticsAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'governance.policy.manage',
      '当前用户无权访问联软 CRM 联调诊断能力。',
      {
        channel: 'web-console',
        resourceType: 'lianruan-crm-standard-api',
      },
    );
  }

  /**
   * 拉取六类标准资源的最小样例，形成权限视角和字段完整性诊断输入。
   *
   * 参数说明：无。
   * 返回值说明：返回每类资源样例、总量、请求 ID 和失败原因。
   * 调用注意事项：诊断入口不能因为某一类资源失败导致整页不可用，因此这里逐项降级。
   */
  private async buildResourceSamples(): Promise<Array<{
    resource: LianruanCrmOpenApiResource;
    status: 'AVAILABLE' | 'EMPTY' | 'FAILED';
    items: Record<string, unknown>[];
    sampleCount: number;
    total: number;
    requestId?: string;
    failureReason?: string;
  }>> {
    const sampleResults = await Promise.all(
      SUPPORTED_STANDARD_RESOURCES.map(async (resource) =>
        this.buildSingleResourceSample(resource),
      ),
    );

    return sampleResults;
  }

  /**
   * 拉取单个标准资源的最小样例。
   *
   * 参数说明：`resource` 为联软标准资源名。
   * 返回值说明：返回资源样例诊断；远端失败时返回 `FAILED` 并保留失败原因。
   * 调用注意事项：样例只取前 10 条，避免诊断接口变成重型业务查询。
   */
  private async buildSingleResourceSample(resource: LianruanCrmOpenApiResource): Promise<{
    resource: LianruanCrmOpenApiResource;
    status: 'AVAILABLE' | 'EMPTY' | 'FAILED';
    items: Record<string, unknown>[];
    sampleCount: number;
    total: number;
    requestId?: string;
    failureReason?: string;
  }> {
    try {
      const page = await this.lianruanCrmQueryAdapterService.listByResource(
        resource,
        {
          pageNo: 1,
          pageSize: 10,
        },
      );
      const items = Array.isArray(page.items) ? page.items : [];

      return {
        resource,
        status: items.length > 0 ? 'AVAILABLE' : 'EMPTY',
        items,
        sampleCount: items.length,
        total: Number(page.total ?? 0),
        requestId: page.requestId,
      };
    } catch (error) {
      return {
        resource,
        status: 'FAILED',
        items: [],
        sampleCount: 0,
        total: 0,
        failureReason:
          error instanceof Error ? error.message : '联软标准资源样例读取失败。',
      };
    }
  }

  /**
   * 把外部资源参数标准化为受支持的联软标准资源名。
   *
   * 参数说明：`resource` 为路由或查询参数中的资源名。
   * 返回值说明：返回受支持的标准资源枚举值。
   * 调用注意事项：不在允许列表内时会直接抛出 400，避免继续请求远端未知资源。
   */
  private normalizeResource(resource: string): LianruanCrmOpenApiResource {
    const normalizedValue = resource.trim() as LianruanCrmOpenApiResource;
    if (!SUPPORTED_STANDARD_RESOURCES.includes(normalizedValue)) {
      throw new BadRequestException(
        `当前仅支持以下联软标准资源：${SUPPORTED_STANDARD_RESOURCES.join(', ')}`,
      );
    }
    return normalizedValue;
  }
}
