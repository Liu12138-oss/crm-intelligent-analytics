import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LianruanCrmOpenApiAdapterService } from '../crm-standard-api/lianruan-crm-openapi.adapter.service';
import { LianruanCrmQueryAdapterService } from '../crm-standard-api/lianruan-crm-query-adapter.service';
import type {
  LianruanCrmOpenApiDictionaries,
  LianruanCrmOpenApiPageResult,
  LianruanCrmOpenApiCatalogResource,
  LianruanCrmOpenApiResource,
} from '../crm-standard-api/lianruan-crm-openapi.types';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { formatWanAmount } from '../../shared/utils/business-amount.util';

type CoreSnapshotResource = Extract<
  LianruanCrmOpenApiResource,
  | 'users'
  | 'customers'
  | 'partners'
  | 'registrations'
  | 'opportunities'
  | 'quotes'
  | 'orders'
>;

type SnapshotResource = CoreSnapshotResource | LianruanCrmOpenApiCatalogResource;

type SnapshotRecord = Record<string, unknown>;
export type OpenApiMarkdownBusinessChainResource =
  | 'partners'
  | 'registrations'
  | 'opportunities'
  | 'quotes'
  | 'orders';

export interface OpenApiMarkdownBusinessChainSnapshot {
  generatedAt?: string;
  scopeSummary: string;
  partners: SnapshotRecord[];
  registrations: SnapshotRecord[];
  opportunities: SnapshotRecord[];
  quotes: SnapshotRecord[];
  orders: SnapshotRecord[];
}

interface SnapshotData {
  generatedAt: string;
  bootstrap?: {
    clientName?: string;
    userId?: string;
    userName?: string;
    scopeType?: string;
    regions?: string[];
    partnerIds?: string[];
    userIds?: string[];
    dictionaries?: LianruanCrmOpenApiDictionaries;
  };
  resources: Record<SnapshotResource, SnapshotRecord[]>;
  resourceMeta: Record<SnapshotResource, SnapshotResourceMeta>;
  diagnostics?: SnapshotRecord;
  analytics: {
    businessOverview?: SnapshotRecord;
    resourceSummaries: Partial<Record<BusinessSummaryResource, SnapshotRecord>>;
    partnerContributions: SnapshotRecord[];
    partnerProfile?: SnapshotRecord;
    funnel?: SnapshotRecord;
    regionContributions: SnapshotRecord[];
    ownerContributions: SnapshotRecord[];
  };
  warnings: string[];
  dataQualityIssues: SnapshotDataQualityIssue[];
}

type BusinessSummaryResource =
  | 'partners'
  | 'registrations'
  | 'opportunities'
  | 'quotes'
  | 'orders';

interface SnapshotResourceMeta {
  total: number;
  returnedCount: number;
  requestIds: string[];
  complete: boolean;
  capped: boolean;
  required: boolean;
}

interface SnapshotDataQualityIssue {
  severity: 'fatal' | 'warning';
  resource?: SnapshotResource;
  message: string;
}

interface RequiredFieldCheck {
  label: string;
  fields: string[];
  buildMessage?: (params: { resource: SnapshotResource; missingCount: number; totalCount: number }) => string;
}

export interface OpenApiMarkdownSnapshotManifest {
  generatedAt: string;
  outputDir: string;
  files: string[];
  counts: Record<SnapshotResource, number>;
  resourceMeta: Record<SnapshotResource, SnapshotResourceMeta>;
  dataQualityIssues: SnapshotDataQualityIssue[];
  warnings: string[];
}

@Injectable()
export class OpenApiMarkdownSnapshotService {
  private readonly resourceOrder: SnapshotResource[] = [
    'users',
    'partners',
    'customers',
    'registrations',
    'opportunities',
    'quotes',
    'orders',
    'categories',
    'modules',
    'features',
    'hardware',
    'packages',
    'products',
  ];

  private readonly requiredResourceSet = new Set<SnapshotResource>([
    'partners',
    'registrations',
    'opportunities',
    'quotes',
    'orders',
  ]);

  private readonly businessSummaryResources: BusinessSummaryResource[] = [
    'partners',
    'registrations',
    'opportunities',
    'quotes',
    'orders',
  ];

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly lianruanCrmQueryAdapterService: LianruanCrmQueryAdapterService,
    private readonly lianruanCrmOpenApiAdapterService: LianruanCrmOpenApiAdapterService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  /**
   * 从联软标准 OpenAPI 生成 Markdown 分析快照。
   *
   * 参数说明：无。
   * 返回值说明：返回本次生成的文件清单、记录数和非阻断告警。
   * 可能抛出的异常：OpenAPI 未配置或核心列表接口整体不可用时抛出。
   * 调用注意事项：该方法只读取 OpenAPI，不写 CRM；本地只写入分析快照 Markdown 文件。
   */
  async generateSnapshot(): Promise<OpenApiMarkdownSnapshotManifest> {
    if (!this.lianruanCrmQueryAdapterService.isEnabled()) {
      throw new Error('联软标准 OpenAPI 尚未启用，无法生成 Markdown 分析快照。');
    }

    const config = this.localRuntimeConfigService.getCrmOpenApiMarkdownSnapshotConfig();
    const latestDir = this.resolveLatestDir();
    mkdirSync(join(latestDir, 'details'), { recursive: true });

    const generatedAt = new Date().toISOString();
    const warnings: string[] = [];
    const { resources, resourceMeta } = await this.fetchResourceSnapshot(
      config.maxRowsPerResource,
      warnings,
    );
    const [bootstrap, diagnostics, analytics] = await Promise.all([
      this.fetchBootstrapSnapshot(warnings),
      this.fetchDiagnosticsSnapshot(warnings),
      this.fetchAnalyticsSnapshot(warnings),
    ]);
    const dataQualityIssues = this.buildDataQualityIssues(resources, resourceMeta);
    const data: SnapshotData = {
      generatedAt,
      bootstrap,
      resources,
      resourceMeta,
      diagnostics,
      analytics,
      warnings,
      dataQualityIssues,
    };
    const files = this.buildSnapshotFiles(data, config.detailRowsPerSection);

    for (const file of files) {
      writeFileSync(join(latestDir, file.name), file.content, 'utf8');
    }

    const manifest: OpenApiMarkdownSnapshotManifest = {
      generatedAt,
      outputDir: latestDir,
      files: files.map((file) => file.name),
      counts: Object.fromEntries(
        this.resourceOrder.map((resource) => [resource, resources[resource].length]),
      ) as Record<SnapshotResource, number>,
      resourceMeta,
      dataQualityIssues,
      warnings,
    };
    writeFileSync(
      join(latestDir, 'snapshot-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );

    this.analysisLoggerService.logStep('OpenAPI Markdown 分析快照已生成。', {
      outputDir: latestDir,
      counts: manifest.counts,
      warningCount: warnings.length,
    });

    return manifest;
  }

  /**
   * 按用户问题读取相关 Markdown 快照片段。
   *
   * 参数说明：`questionText` 为用户问题或报告标题。
   * 返回值说明：返回裁剪后的 Markdown 材料；未启用或未生成快照时返回空字符串。
   * 调用注意事项：该方法不触发 OpenAPI 请求，只读取本地 latest 快照，避免问答链路被定时刷新拖慢。
   */
  readRelevantSnapshotContext(questionText: string): string {
    const config = this.localRuntimeConfigService.getCrmOpenApiMarkdownSnapshotConfig();
    if (!config.enabled) {
      return '';
    }

    const latestDir = this.resolveLatestDir();
    if (!existsSync(latestDir)) {
      return '';
    }

    const selectedFiles = this.resolveRelevantFiles(questionText);
    const sections = selectedFiles
      .map((fileName) => this.readMarkdownFile(latestDir, fileName))
      .filter(Boolean);
    const scopeNotice = this.hasExplicitRegionScope(questionText)
      ? '> 当前问题包含明确区域/大区范围，正式分析会先按问题筛选本地 Markdown 快照明细；报告不得引用未命中区域的全量记录。'
      : '';
    const content = [scopeNotice, ...sections].filter(Boolean).join('\n\n---\n\n').trim();
    return content.length > config.maxContextChars
      ? `${content.slice(0, config.maxContextChars)}\n\n> 快照材料已按配置截断。`
      : content;
  }

  /**
   * 读取本地 Markdown 快照中的单类资源明细。
   *
   * 参数说明：`resource` 为联软标准 OpenAPI 资源名。
   * 返回值说明：支持的资源返回解析后的记录；快照不存在或资源未生成时返回 `undefined`。
   * 调用注意事项：该方法只读本地 `latest/details/*.md`，不会触发 OpenAPI 请求；正式问数应优先使用它。
   */
  readResourceRecords(resource: LianruanCrmOpenApiResource): SnapshotRecord[] | undefined {
    if (!this.isMarkdownSnapshotResource(resource)) {
      return undefined;
    }

    const latestDir = this.resolveLatestDir();
    this.assertSnapshotUsable(latestDir, resource);
    const filePath = join(latestDir, 'details', `${resource}.md`);
    if (!existsSync(filePath)) {
      return undefined;
    }

    const markdown = readFileSync(filePath, 'utf8');
    return this.parseMarkdownTable(markdown).map((row) =>
      this.mapMarkdownTableRowToRecord(resource, row),
    );
  }

  /**
   * 读取业务链组合分析所需的 Markdown 明细快照。
   *
   * 参数说明：`resources` 为本次问题需要分析的对象集合。
   * 返回值说明：返回合作伙伴、客户报备、商机和订单四类明细，未请求的对象为空数组。
   * 可能抛出：快照未生成或核心明细文件缺失时抛出错误，提示先刷新快照。
   * 调用注意事项：这是正式分析的数据入口，不访问 OpenAPI；OpenAPI 只由 `generateSnapshot` 刷新文件时使用。
   */
  readBusinessChainSnapshot(params?: {
    resources?: OpenApiMarkdownBusinessChainResource[];
  }): OpenApiMarkdownBusinessChainSnapshot {
    const latestDir = this.resolveLatestDir();
    if (!existsSync(latestDir)) {
      throw new Error('OpenAPI Markdown 分析快照尚未生成，请先刷新快照后再分析。');
    }

    const requestedResources = new Set<OpenApiMarkdownBusinessChainResource>(
      params?.resources ?? ['partners', 'registrations', 'opportunities', 'quotes', 'orders'],
    );
    for (const resource of requestedResources) {
      this.assertSnapshotUsable(latestDir, resource);
    }
    const generatedAt = this.readSnapshotGeneratedAt(latestDir);
    const scopeSummary = generatedAt
      ? `CRM 已同步真实明细数据，生成时间：${generatedAt}`
      : 'CRM 已同步真实明细数据';

    return {
      generatedAt,
      scopeSummary,
      partners: requestedResources.has('partners')
        ? this.readRequiredResourceRecords('partners')
        : [],
      registrations: requestedResources.has('registrations')
        ? this.readRequiredResourceRecords('registrations')
        : [],
      opportunities: requestedResources.has('opportunities')
        ? this.readRequiredResourceRecords('opportunities')
        : [],
      quotes: requestedResources.has('quotes')
        ? this.readRequiredResourceRecords('quotes')
        : [],
      orders: requestedResources.has('orders')
        ? this.readRequiredResourceRecords('orders')
        : [],
    };
  }

  /**
   * 批量读取核心业务资源。
   */
  private async fetchResourceSnapshot(
    maxRows: number,
    warnings: string[],
  ): Promise<{
    resources: Record<SnapshotResource, SnapshotRecord[]>;
    resourceMeta: Record<SnapshotResource, SnapshotResourceMeta>;
  }> {
    const entries = await Promise.all(
      this.resourceOrder.map(async (resource) => {
        const snapshot = await this.safeCall(
          `读取 ${resource} 列表`,
          () => this.fetchAllResource(resource, maxRows),
          warnings,
          this.buildEmptyResourceSnapshot(resource),
        );
        return [resource, snapshot] as const;
      }),
    );

    const resources = Object.fromEntries(
      entries.map(([resource, snapshot]) => [resource, snapshot.records]),
    ) as Record<SnapshotResource, SnapshotRecord[]>;
    const resourceMeta = Object.fromEntries(
      entries.map(([resource, snapshot]) => [resource, snapshot.meta]),
    ) as Record<SnapshotResource, SnapshotResourceMeta>;
    return { resources, resourceMeta };
  }

  /**
   * 分页拉取单个 OpenAPI 资源，直到达到远端总数或本地上限。
   */
  private async fetchAllResource(
    resource: SnapshotResource,
    maxRows: number,
  ): Promise<{ records: SnapshotRecord[]; meta: SnapshotResourceMeta }> {
    const pageSize = Math.min(200, Math.max(20, maxRows));
    const rows: SnapshotRecord[] = [];
    const requestIds: string[] = [];
    let remoteTotal: number | undefined;
    let pageNo = 1;
    while (rows.length < maxRows) {
      const page: LianruanCrmOpenApiPageResult<Record<string, unknown>> =
        await this.listSnapshotResource(resource, {
          pageNo,
          pageSize,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        });
      const pageTotal = Number(page.total);
      if (Number.isFinite(pageTotal) && pageTotal >= 0) {
        remoteTotal = pageTotal;
      }
      if (page.requestId) {
        requestIds.push(page.requestId);
      }
      rows.push(...page.items);
      if (
        page.items.length === 0 ||
        (remoteTotal !== undefined && rows.length >= remoteTotal) ||
        page.items.length < pageSize
      ) {
        break;
      }
      pageNo += 1;
    }

    const records = rows.slice(0, maxRows);
    return {
      records,
      meta: {
        total: remoteTotal ?? records.length,
        returnedCount: records.length,
        requestIds,
        complete: remoteTotal === undefined || records.length >= remoteTotal,
        capped: remoteTotal !== undefined && remoteTotal > records.length,
        required: this.requiredResourceSet.has(resource),
      },
    };
  }

  /**
   * 读取单个快照资源分页。
   *
   * 参数说明：`resource` 为核心业务资源或产品目录资源，`query` 为分页筛选参数。
   * 返回值说明：返回统一分页结果。
   * 调用注意事项：产品目录不纳入全局业务资源枚举，避免影响其它正式业务模块。
   */
  private async listSnapshotResource(
    resource: SnapshotResource,
    query: {
      pageNo: number;
      pageSize: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    },
  ): Promise<LianruanCrmOpenApiPageResult<Record<string, unknown>>> {
    if (this.isCatalogSnapshotResource(resource)) {
      return this.lianruanCrmQueryAdapterService.listCatalogResource(resource, query);
    }
    return this.lianruanCrmQueryAdapterService.listByResource(resource, query);
  }

  /**
   * 构造资源读取失败时的空快照。
   *
   * 参数说明：`resource` 为资源名。
   * 返回值说明：返回空记录和不可完整分析的元数据。
   * 调用注意事项：核心资源失败会在数据质量报告中升级为致命问题；产品目录等可选资源只记录告警。
   */
  private buildEmptyResourceSnapshot(
    resource: SnapshotResource,
  ): { records: SnapshotRecord[]; meta: SnapshotResourceMeta } {
    return {
      records: [],
      meta: {
        total: 0,
        returnedCount: 0,
        requestIds: [],
        complete: !this.requiredResourceSet.has(resource),
        capped: false,
        required: this.requiredResourceSet.has(resource),
      },
    };
  }

  /**
   * 生成快照数据质量问题。
   *
   * 参数说明：
   * - `resources`：本次写入快照的各资源明细；
   * - `resourceMeta`：分页总数、返回数和请求 ID 等元数据。
   * 返回值说明：返回致命问题和提示性问题集合。
   * 调用注意事项：核心资源分页不完整必须标 fatal，避免正式分析基于截断数据给出错误结论。
   */
  private buildDataQualityIssues(
    resources: Record<SnapshotResource, SnapshotRecord[]>,
    resourceMeta: Record<SnapshotResource, SnapshotResourceMeta>,
  ): SnapshotDataQualityIssue[] {
    const issues: SnapshotDataQualityIssue[] = [];
    for (const resource of this.resourceOrder) {
      const meta = resourceMeta[resource];
      if (meta.required && !meta.complete) {
        issues.push({
          severity: 'fatal',
          resource,
          message: `${resource} 快照未拉齐：OpenAPI total=${meta.total}，本地 returnedCount=${meta.returnedCount}。请提高 CRM_OPENAPI_MARKDOWN_SNAPSHOT_MAX_ROWS 或检查分页接口后重新刷新。`,
        });
      }
      if (!meta.required && !meta.complete) {
        issues.push({
          severity: 'warning',
          resource,
          message: `${resource} 可选快照未拉齐：OpenAPI total=${meta.total}，本地 returnedCount=${meta.returnedCount}。相关专题分析可能不完整。`,
        });
      }
    }

    issues.push(...this.buildRequiredFieldIssues(resources));
    issues.push(...this.buildRelationshipIssues(resources));
    return issues;
  }

  /**
   * 检查核心展示字段是否缺失。
   *
   * 参数说明：`resources` 为快照资源明细。
   * 返回值说明：返回字段缺失问题集合。
   * 调用注意事项：真实名称缺失会直接影响用户看到的客户、渠道商、商机和订单明细，需要显式暴露。
   */
  private buildRequiredFieldIssues(
    resources: Record<SnapshotResource, SnapshotRecord[]>,
  ): SnapshotDataQualityIssue[] {
    const requiredFields: Partial<Record<SnapshotResource, RequiredFieldCheck[]>> = {
      partners: [
        { label: '渠道商名称', fields: ['partnerName', 'displayName', 'name'] },
        { label: '渠道商类型', fields: ['partnerTypeName', 'partnerType'] },
        {
          label: '所在城市',
          fields: [
            'city',
            'cityName',
            'city_name',
            '所在城市',
            '城市',
            '地市',
            'partnerCityName',
            'partnerCity',
            'partner_city_name',
            'partner_city',
            'prefectureCityName',
            'prefectureCity',
            'prefecture_city_name',
            'prefecture_city',
          ],
          buildMessage: ({ resource, missingCount, totalCount }) =>
            `${resource} 有 ${missingCount}/${totalCount} 条记录缺少所在城市，地图地市覆盖率只能根据渠道商名称、地址或区域文本保守兜底；若 CRM 页面已维护所在城市，请检查 OpenAPI 是否返回 city 字段。`,
        },
      ],
      registrations: [
        { label: '客户名称', fields: ['customerName', 'customer'] },
        { label: '渠道商名称', fields: ['partnerName', 'assignedPartnerName'] },
      ],
      opportunities: [
        { label: '商机名称', fields: ['opportunityName', 'name'] },
        { label: '客户名称', fields: ['customerName', 'customer'] },
        { label: '商机阶段', fields: ['stageName', 'stage', 'statusName', 'status'] },
      ],
      quotes: [
        { label: '报价标识', fields: ['quoteName', 'quoteId', 'id'] },
        { label: '客户名称', fields: ['customerName', 'customer'] },
      ],
      orders: [
        { label: '订单标识', fields: ['orderName', 'orderNo', 'orderId', 'id'] },
        { label: '客户名称', fields: ['customerName', 'customer'] },
        { label: '渠道商名称', fields: ['partnerName', 'assignedPartnerName'] },
      ],
    };
    const issues: SnapshotDataQualityIssue[] = [];
    for (const [resource, checks] of Object.entries(requiredFields) as Array<
      [SnapshotResource, RequiredFieldCheck[]]
    >) {
      const records = resources[resource] ?? [];
      for (const check of checks) {
        const missingCount = records.filter((record) => !this.pickValue(record, check.fields)).length;
        if (missingCount > 0) {
          issues.push({
            severity: missingCount === records.length && this.requiredResourceSet.has(resource) ? 'fatal' : 'warning',
            resource,
            message: check.buildMessage
              ? check.buildMessage({ resource, missingCount, totalCount: records.length })
              : `${resource} 有 ${missingCount}/${records.length} 条记录缺少${check.label}，结果明细可能无法显示真实业务名称。`,
          });
        }
      }
    }
    return issues;
  }

  /**
   * 检查关键业务链路是否断链。
   *
   * 参数说明：`resources` 为快照资源明细。
   * 返回值说明：返回关系断链问题集合。
   * 调用注意事项：这里不阻断分析，只提示报备、商机、报价、订单之间可能无法完整串联。
   */
  private buildRelationshipIssues(
    resources: Record<SnapshotResource, SnapshotRecord[]>,
  ): SnapshotDataQualityIssue[] {
    const registrationIds = new Set(
      resources.registrations
        .map((record) => this.readText(this.pickValue(record, ['registrationId', 'id', 'regId'])))
        .filter(Boolean),
    );
    const opportunityIds = new Set(
      resources.opportunities
        .map((record) => this.readText(this.pickValue(record, ['opportunityId', 'id', 'oppId'])))
        .filter(Boolean),
    );
    const quoteIds = new Set(
      resources.quotes
        .map((record) => this.readText(this.pickValue(record, ['quoteId', 'id'])))
        .filter(Boolean),
    );
    const issues: SnapshotDataQualityIssue[] = [];
    const opportunityWithoutRegistration = resources.opportunities.filter((record) => {
      const registrationId = this.readText(this.pickValue(record, ['registrationId', 'regId']));
      return registrationId && !registrationIds.has(registrationId);
    }).length;
    if (opportunityWithoutRegistration > 0) {
      issues.push({
        severity: 'warning',
        resource: 'opportunities',
        message: `${opportunityWithoutRegistration} 条商机的 registrationId/regId 未在客户报备快照中命中。`,
      });
    }

    const quoteWithoutOpportunity = resources.quotes.filter((record) => {
      const ids = this.normalizeRelationIds(this.pickValue(record, ['opportunityId', 'opportunityIds', 'oppId', 'oppIds']));
      return ids.length > 0 && !ids.some((id) => opportunityIds.has(id));
    }).length;
    if (quoteWithoutOpportunity > 0) {
      issues.push({
        severity: 'warning',
        resource: 'quotes',
        message: `${quoteWithoutOpportunity} 条报价的 opportunityId/oppId 未在商机快照中命中。`,
      });
    }

    const orderWithoutUpstream = resources.orders.filter((record) => {
      const opportunityId = this.readText(this.pickValue(record, ['opportunityId', 'oppId']));
      const quoteId = this.readText(this.pickValue(record, ['quoteId']));
      return (opportunityId && !opportunityIds.has(opportunityId)) || (quoteId && !quoteIds.has(quoteId));
    }).length;
    if (orderWithoutUpstream > 0) {
      issues.push({
        severity: 'warning',
        resource: 'orders',
        message: `${orderWithoutUpstream} 条订单的商机或报价链路未在快照中完整命中。`,
      });
    }
    return issues;
  }

  /**
   * 读取 OpenAPI 启动上下文、权限和字典。
   */
  private async fetchBootstrapSnapshot(warnings: string[]): Promise<SnapshotData['bootstrap']> {
    return this.safeCall(
      '读取 OpenAPI 启动上下文',
      async () => {
        const bootstrap = await this.lianruanCrmOpenApiAdapterService.getBootstrapSnapshot();
        return {
          clientName: bootstrap.context.client.name,
          userId: bootstrap.context.user.id,
          userName: bootstrap.context.user.name,
          scopeType: bootstrap.permissionScope.scopeType,
          regions: bootstrap.permissionScope.regions,
          partnerIds: bootstrap.permissionScope.partnerIds,
          userIds: bootstrap.permissionScope.userIds,
          dictionaries: bootstrap.dictionaries,
        };
      },
      warnings,
      undefined,
    );
  }

  /**
   * 读取 OpenAPI 联调诊断信息。
   *
   * 参数说明：`warnings` 为快照生成告警集合。
   * 返回值说明：成功返回诊断载荷，失败返回 `undefined` 并记录告警。
   * 调用注意事项：诊断接口只服务刷新链，用于后续判断权限范围和可见数量。
   */
  private async fetchDiagnosticsSnapshot(warnings: string[]): Promise<SnapshotData['diagnostics']> {
    return this.safeCall(
      '读取 OpenAPI 联调诊断',
      () => this.lianruanCrmQueryAdapterService.getDiagnosticsSelfCheck(),
      warnings,
      undefined,
    );
  }

  /**
   * 读取 OpenAPI 统计类接口。
   */
  private async fetchAnalyticsSnapshot(warnings: string[]): Promise<SnapshotData['analytics']> {
    const [
      businessOverview,
      resourceSummaryEntries,
      partnerContributions,
      partnerProfile,
      funnel,
      regionContributions,
      ownerContributions,
    ] = await Promise.all([
      this.safeCall('读取经营总览统计', () => this.lianruanCrmQueryAdapterService.getBusinessOverviewAnalytics(), warnings, undefined),
      Promise.all(
        this.businessSummaryResources.map(async (resource) => {
          const summary = await this.safeCall(
            `读取 ${resource} 摘要统计`,
            () => this.lianruanCrmQueryAdapterService.getResourceSummaryAnalytics(resource),
            warnings,
            undefined,
          );
          return [resource, summary] as const;
        }),
      ),
      this.safeCall('读取渠道贡献统计', () => this.lianruanCrmQueryAdapterService.listPartnerContributions(), warnings, []),
      this.safeCall('读取服务商画像统计', () => this.lianruanCrmQueryAdapterService.getPartnerProfileAnalytics(), warnings, undefined),
      this.safeCall('读取销售漏斗统计', () => this.lianruanCrmQueryAdapterService.getFunnelAnalytics(), warnings, undefined),
      this.safeCall('读取区域贡献统计', () => this.lianruanCrmQueryAdapterService.listRegionContributions(), warnings, []),
      this.safeCall('读取负责人贡献统计', () => this.lianruanCrmQueryAdapterService.listOwnerContributions(), warnings, []),
    ]);

    return {
      businessOverview,
      resourceSummaries: Object.fromEntries(
        resourceSummaryEntries.filter(([, summary]) => Boolean(summary)),
      ) as Partial<Record<BusinessSummaryResource, SnapshotRecord>>,
      partnerContributions,
      partnerProfile,
      funnel,
      regionContributions,
      ownerContributions,
    };
  }

  /**
   * 执行可失败的 OpenAPI 读取步骤。
   */
  private async safeCall<T>(
    label: string,
    action: () => Promise<T>,
    warnings: string[],
    fallback: T,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      warnings.push(`${label}失败：${reason}`);
      this.analysisLoggerService.logWarn('OpenAPI Markdown 快照局部读取失败。', {
        label,
        reason,
      });
      return fallback;
    }
  }

  /**
   * 构造全部 Markdown 文件。
   */
  private buildSnapshotFiles(
    data: SnapshotData,
    detailLimit: number,
  ): Array<{ name: string; content: string }> {
    const productMarkdown = this.buildProductCatalogMarkdown(data, detailLimit);
    const dataQualityMarkdown = this.buildDataQualityMarkdown(data);
    const files: Array<{ name: string; content: string }> = [
      { name: '00-快照说明.md', content: this.buildIntroMarkdown(data) },
      { name: '01-经营总览.md', content: this.buildOverviewMarkdown(data, detailLimit) },
      { name: '02-合作伙伴开拓.md', content: this.buildPartnerMarkdown(data, detailLimit) },
      { name: '03-客户报备.md', content: this.buildRegistrationMarkdown(data, detailLimit) },
      { name: '04-商机分析.md', content: this.buildOpportunityMarkdown(data, detailLimit) },
      { name: '05-订单分析.md', content: this.buildOrderMarkdown(data, detailLimit) },
      { name: '06-风险与停滞.md', content: this.buildRiskMarkdown(data, detailLimit) },
      { name: '07-字段口径与枚举.md', content: this.buildDictionaryMarkdown(data) },
      { name: '08-产品目录.md', content: productMarkdown },
      { name: '09-数据质量.md', content: dataQualityMarkdown },
      { name: '12-index.md', content: this.buildIndexMarkdown(data) },
      { name: '00-snapshot-meta.md', content: this.buildIntroMarkdown(data) },
      { name: '01-auth-scope.md', content: this.buildAuthScopeMarkdown(data) },
      { name: '02-dictionaries.md', content: this.buildDictionaryMarkdown(data) },
      { name: '03-users.md', content: this.buildDetailMarkdown('用户明细', data.resources.users, data.resources.users.length, 'users', data) },
      { name: '04-partners.md', content: this.buildPartnerMarkdown(data, detailLimit) },
      { name: '05-registrations.md', content: this.buildRegistrationMarkdown(data, detailLimit) },
      { name: '06-opportunities.md', content: this.buildOpportunityMarkdown(data, detailLimit) },
      { name: '07-quotes.md', content: this.buildQuoteMarkdown(data, detailLimit) },
      { name: '08-orders.md', content: this.buildOrderMarkdown(data, detailLimit) },
      { name: '09-products.md', content: productMarkdown },
      { name: '10-analytics-overview.md', content: this.buildOverviewMarkdown(data, detailLimit) },
      { name: '11-data-quality.md', content: dataQualityMarkdown },
    ];

    for (const resource of this.resourceOrder) {
      files.push({
        name: `details/${resource}.md`,
        content: this.buildDetailMarkdown(
          this.resolveDetailTitle(resource),
          data.resources[resource],
          data.resources[resource].length,
          resource,
          data,
        ),
      });
    }

    return files;
  }

  /**
   * 构造快照说明。
   */
  private buildIntroMarkdown(data: SnapshotData): string {
    return [
      '# OpenAPI Markdown 分析快照说明',
      '',
      `生成时间：${data.generatedAt}`,
      `OpenAPI client：${data.bootstrap?.clientName ?? '未获取'}`,
      `绑定用户ID：${data.bootstrap?.userId ?? '未获取'}`,
      `绑定用户：${data.bootstrap?.userName ?? '未获取'}`,
      `权限类型：${data.bootstrap?.scopeType ?? '未获取'}`,
      `权限区域：${this.formatListText(data.bootstrap?.regions) || '未声明'}`,
      `权限渠道：${this.formatListText(data.bootstrap?.partnerIds) || '未声明'}`,
      '',
      '## 数据来源',
      '- 联软标准 OpenAPI 只读接口。',
      '- 本地文件仅作为 AI 分析材料，不写回 CRM。',
      '- 用户可见结论必须基于本快照筛选后的结果包，不允许编造不存在的对象、金额或状态。',
      '- 如果权限类型不是 all，所有统计只代表当前 OpenAPI 绑定用户可见范围。',
      '',
      '## 记录数',
      this.buildSimpleList([
        ['用户', data.resources.users.length],
        ['合作伙伴', data.resources.partners.length],
        ['客户', data.resources.customers.length],
        ['客户报备', data.resources.registrations.length],
        ['商机', data.resources.opportunities.length],
        ['报价', data.resources.quotes.length],
        ['订单', data.resources.orders.length],
        ['产品分类', data.resources.categories.length],
        ['产品模块', data.resources.modules.length],
        ['产品功能', data.resources.features.length],
        ['硬件产品', data.resources.hardware.length],
        ['套餐', data.resources.packages.length],
        ['产品', data.resources.products.length],
      ]),
      '',
      '## 分页完整性',
      this.buildResourceMetaTable(data),
      '',
      data.warnings.length
        ? ['## 生成告警', this.buildSimpleList(data.warnings.map((item) => [item, '']))].join('\n')
        : '## 生成告警\n- 无',
      '',
      data.dataQualityIssues.length
        ? [
            '## 数据质量问题',
            this.buildRecordsTable(
              data.dataQualityIssues.map((issue) => ({ ...issue })),
              [
                ['级别', ['severity']],
                ['资源', ['resource']],
                ['说明', ['message']],
              ],
            ),
          ].join('\n')
        : '## 数据质量问题\n- 未发现阻断项。',
      '',
    ].join('\n');
  }

  /**
   * 构造经营总览。
   */
  private buildOverviewMarkdown(data: SnapshotData, detailLimit: number): string {
    const opportunityAmount = this.sumAmount(data.resources.opportunities, [
      'amount',
      'opportunityAmount',
      'expectedAmount',
      'totalAmount',
    ]);
    const orderAmount = this.sumAmount(data.resources.orders, [
      'amount',
      'orderAmount',
      'totalAmount',
      'contractAmount',
    ]);
    return [
      '# 经营总览',
      '',
      '## 核心指标',
      this.buildSimpleList([
        ['合作伙伴数', data.resources.partners.length],
        ['客户报备数', data.resources.registrations.length],
        ['商机数', data.resources.opportunities.length],
        ['商机金额', formatWanAmount(opportunityAmount)],
        ['订单数', data.resources.orders.length],
        ['订单金额', formatWanAmount(orderAmount)],
      ]),
      '',
      '## OpenAPI 经营总览',
      this.buildJsonBlock(data.analytics.businessOverview ?? {}),
      '',
      '## 单对象摘要统计',
      this.buildRecordsTable(
        Object.entries(data.analytics.resourceSummaries).map(([resource, summary]) => ({
          resource,
          summary,
        })),
        [
          ['对象', ['resource']],
          ['统计载荷', ['summary']],
        ],
      ),
      '',
      '## 销售漏斗',
      this.buildKeyValueTable(data.analytics.funnel ?? {}, [
        ['客户报备数', 'registrationCount'],
        ['商机数', 'opportunityCount'],
        ['报价数', 'quoteCount'],
        ['订单数', 'orderCount'],
        ['报备转商机率', 'registrationToOpportunityRate'],
        ['商机转报价率', 'opportunityToQuoteRate'],
        ['报价转订单率', 'quoteToOrderRate'],
      ]),
      '',
      '## 渠道贡献 Top',
      this.buildRecordsTable(
        data.analytics.partnerContributions.slice(0, detailLimit),
        [
          ['渠道商', ['partnerName']],
          ['报备数', ['registrationCount']],
          ['商机数', ['opportunityCount']],
          ['商机金额', ['opportunityAmount']],
          ['订单数', ['orderCount']],
          ['订单金额', ['orderAmount']],
        ],
      ),
      '',
    ].join('\n');
  }

  /**
   * 构造合作伙伴开拓快照。
   */
  private buildPartnerMarkdown(data: SnapshotData, detailLimit: number): string {
    return [
      '# 合作伙伴开拓与运营',
      '',
      '## 服务商画像',
      this.buildKeyValueTable(data.analytics.partnerProfile ?? {}, [
        ['服务商总数', 'totalCount'],
        ['活跃服务商数', 'activeCount'],
        ['技术服务商数', 'technicalServiceProviderCount'],
      ]),
      '',
      '## 渠道经营贡献',
      this.buildRecordsTable(
        data.analytics.partnerContributions.slice(0, detailLimit),
        [
          ['渠道商', ['partnerName']],
          ['等级', ['partnerLevel', 'partnerLevelName']],
          ['区域', ['region', 'bigRegion']],
          ['报备数', ['registrationCount']],
          ['商机数', ['opportunityCount']],
          ['商机金额', ['opportunityAmount']],
          ['订单数', ['orderCount']],
          ['订单金额', ['orderAmount']],
        ],
      ),
      '',
      '## 合作伙伴明细',
      this.buildRecordsTable(
        data.resources.partners.slice(0, detailLimit),
        [
          ['渠道商', ['partnerName', 'name']],
          ['等级', ['partnerLevelName', 'partnerLevel', 'levelName']],
          ['类型', ['partnerTypeName', 'partnerType']],
          ['所在城市', [
            'city',
            'cityName',
            'city_name',
            '所在城市',
            '城市',
            '地市',
            'partnerCityName',
            'partnerCity',
            'partner_city_name',
            'partner_city',
            'prefectureCityName',
            'prefectureCity',
            'prefecture_city_name',
            'prefecture_city',
          ]],
          ['区域', ['region', 'bigRegion']],
          ['状态', ['statusName', 'status']],
        ],
      ),
      '',
    ].join('\n');
  }

  /**
   * 构造客户报备快照。
   */
  private buildRegistrationMarkdown(data: SnapshotData, detailLimit: number): string {
    return [
      '# 客户报备分析',
      '',
      `客户报备总数：${data.resources.registrations.length}`,
      '',
      '## 报备状态分布',
      this.buildBucketTable(this.groupBy(data.resources.registrations, ['statusName', 'status'])),
      '',
      '## 重点报备明细',
      this.buildRecordsTable(
        data.resources.registrations.slice(0, detailLimit),
        [
          ['客户', ['customerName', 'customer']],
          ['渠道商', ['partnerName', 'assignedPartnerName']],
          ['状态', ['statusName', 'status']],
          ['关联商机', ['opportunityName']],
          ['负责人', ['assignedStaffName', 'ownerName', 'createdByName']],
          ['预计金额', ['estimatedAmount', 'amount']],
          ['更新时间', ['updatedAt', 'createdAt']],
        ],
      ),
      '',
    ].join('\n');
  }

  /**
   * 构造商机分析快照。
   */
  private buildOpportunityMarkdown(data: SnapshotData, detailLimit: number): string {
    const opportunities = [...data.resources.opportunities].sort(
      (left, right) => this.toNumber(this.pickValue(right, ['amount', 'opportunityAmount', 'expectedAmount'])) -
        this.toNumber(this.pickValue(left, ['amount', 'opportunityAmount', 'expectedAmount'])),
    );
    return [
      '# 商机分析',
      '',
      `商机总数：${opportunities.length}`,
      `商机金额：${formatWanAmount(this.sumAmount(opportunities, ['amount', 'opportunityAmount', 'expectedAmount', 'totalAmount']))}`,
      '',
      '## 阶段分布',
      this.buildBucketTable(this.groupBy(opportunities, ['stageName', 'stage', 'statusName', 'status'])),
      '',
      '## 渠道商维度',
      this.buildBucketTable(this.groupBy(opportunities, ['partnerName', 'assignedPartnerName'])),
      '',
      '## 重点商机明细',
      this.buildRecordsTable(
        opportunities.slice(0, detailLimit),
        [
          ['商机', ['opportunityName', 'name', 'title']],
          ['客户', ['customerName', 'customer']],
          ['渠道商', ['partnerName', 'assignedPartnerName']],
          ['阶段', ['stageName', 'stage', 'statusName', 'status']],
          ['金额', ['amount', 'opportunityAmount', 'expectedAmount']],
          ['负责人', ['ownerName', 'assignedStaffName']],
          ['更新时间', ['updatedAt', 'lastFollowUpAt', 'createdAt']],
        ],
      ),
      '',
    ].join('\n');
  }

  /**
   * 构造订单分析快照。
   */
  private buildOrderMarkdown(data: SnapshotData, detailLimit: number): string {
    const orders = [...data.resources.orders].sort(
      (left, right) => this.toNumber(this.pickValue(right, ['amount', 'orderAmount', 'totalAmount'])) -
        this.toNumber(this.pickValue(left, ['amount', 'orderAmount', 'totalAmount'])),
    );
    return [
      '# 订单分析',
      '',
      `订单总数：${orders.length}`,
      `订单金额：${formatWanAmount(this.sumAmount(orders, ['amount', 'orderAmount', 'totalAmount', 'contractAmount']))}`,
      '',
      '## 订单状态分布',
      this.buildBucketTable(this.groupBy(orders, ['statusName', 'status'])),
      '',
      '## 渠道商贡献',
      this.buildBucketTable(this.groupBy(orders, ['partnerName', 'assignedPartnerName'])),
      '',
      '## 重点订单明细',
      this.buildRecordsTable(
        orders.slice(0, detailLimit),
        [
          ['订单', ['orderName', 'orderNo', 'name']],
          ['客户', ['customerName', 'customer']],
          ['渠道商', ['partnerName', 'assignedPartnerName']],
          ['商机', ['opportunityName']],
          ['状态', ['statusName', 'status']],
          ['金额', ['amount', 'orderAmount', 'totalAmount']],
          ['更新时间', ['updatedAt', 'createdAt', 'dealAt', 'signDate']],
        ],
      ),
      '',
    ].join('\n');
  }

  /**
   * 构造报价分析快照。
   *
   * 参数说明：`data` 为快照数据，`detailLimit` 为摘要区块展示行数。
   * 返回值说明：返回报价专题 Markdown。
   * 调用注意事项：报价明细会完整写入 `details/quotes.md`，本文件只展示摘要。
   */
  private buildQuoteMarkdown(data: SnapshotData, detailLimit: number): string {
    const quotes = [...data.resources.quotes].sort(
      (left, right) => this.toNumber(this.pickValue(right, ['amount', 'total', 'totalAmount'])) -
        this.toNumber(this.pickValue(left, ['amount', 'total', 'totalAmount'])),
    );
    return [
      '# 报价分析',
      '',
      `报价总数：${quotes.length}`,
      `报价金额：${formatWanAmount(this.sumAmount(quotes, ['amount', 'total', 'totalAmount', 'originalTotal']))}`,
      '',
      '## 报价状态分布',
      this.buildBucketTable(this.groupBy(quotes, ['statusName', 'status'])),
      '',
      '## 重点报价明细',
      this.buildRecordsTable(
        quotes.slice(0, detailLimit),
        [
          ['报价', ['quoteName', 'quoteId', 'id']],
          ['客户', ['customerName', 'customer']],
          ['渠道商', ['partnerName', 'assignedPartnerName']],
          ['商机', ['opportunityName', 'opportunityId', 'oppId']],
          ['状态', ['statusName', 'status']],
          ['金额', ['amount', 'total', 'totalAmount']],
          ['负责人', ['ownerName', 'assignedStaffName', 'createdByName']],
          ['更新时间', ['updatedAt', 'createdAt']],
        ],
      ),
      '',
    ].join('\n');
  }

  /**
   * 构造产品目录快照。
   *
   * 参数说明：`data` 为快照数据，`detailLimit` 为每类产品目录摘要行数。
   * 返回值说明：返回产品目录 Markdown。
   * 调用注意事项：产品目录属于可选能力，接口不可用时只展示空状态和生成告警。
   */
  private buildProductCatalogMarkdown(data: SnapshotData, detailLimit: number): string {
    const catalogResources: SnapshotResource[] = [
      'categories',
      'modules',
      'features',
      'hardware',
      'packages',
      'products',
    ];
    const sections = catalogResources.map((resource) =>
      [
        `## ${this.resolveDetailTitle(resource)}`,
        `记录数：${data.resources[resource].length}`,
        this.buildRecordsTable(
          data.resources[resource].slice(0, detailLimit),
          this.resolveGenericColumns(data.resources[resource], resource),
        ),
      ].join('\n'),
    );
    return [
      '# 产品目录',
      '',
      '本文件来自联软 OpenAPI 产品/套餐/模块/硬件目录，只用于产品构成、报价构成和套餐问题分析。',
      '',
      sections.join('\n\n'),
      '',
    ].join('\n');
  }

  /**
   * 构造风险与停滞快照。
   */
  private buildRiskMarkdown(data: SnapshotData, detailLimit: number): string {
    const staleOpportunities = data.resources.opportunities
      .map((record) => ({
        ...record,
        staleDays: this.diffDays(this.readText(this.pickValue(record, ['updatedAt', 'lastFollowUpAt', 'createdAt']))),
      }))
      .filter((record) => Number(record.staleDays ?? 0) >= 90)
      .sort((left, right) => Number(right.staleDays ?? 0) - Number(left.staleDays ?? 0));
    return [
      '# 风险与停滞',
      '',
      `90 天以上未更新商机数：${staleOpportunities.length}`,
      '',
      '## 停滞商机明细',
      this.buildRecordsTable(
        staleOpportunities.slice(0, detailLimit),
        [
          ['商机', ['opportunityName', 'name', 'title']],
          ['客户', ['customerName', 'customer']],
          ['渠道商', ['partnerName', 'assignedPartnerName']],
          ['阶段', ['stageName', 'stage', 'statusName', 'status']],
          ['金额', ['amount', 'opportunityAmount', 'expectedAmount']],
          ['停滞天数', ['staleDays']],
          ['更新时间', ['updatedAt', 'lastFollowUpAt', 'createdAt']],
        ],
      ),
      '',
      '## 客户生命周期说明',
      '联软当前最新 OpenAPI 契约未确认客户生命周期和客户反关联统计接口，快照刷新链不再主动探测这两个路径；相关问题由正式分析主链读取客户、报备、商机、报价和订单 Markdown 明细后本地聚合。',
      '',
    ].join('\n');
  }

  /**
   * 构造字段口径和枚举快照。
   */
  private buildDictionaryMarkdown(data: SnapshotData): string {
    const dictionaries = data.bootstrap?.dictionaries ?? {};
    const sections = Object.entries(dictionaries)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => {
        const rows = (value as unknown as Array<Record<string, unknown>>).slice(0, 80);
        return [`## ${key}`, this.buildRecordsTable(rows, [['值', ['value']], ['中文', ['label']]])].join('\n');
      });

    return [
      '# 字段口径与枚举',
      '',
      '本文件来自联软 OpenAPI 字典接口，用于帮助 AI 把阶段、状态、区域等内部值转成业务可读中文。',
      '',
      sections.join('\n\n') || '未获取到字典数据。',
      '',
    ].join('\n');
  }

  /**
   * 构造权限范围快照。
   *
   * 参数说明：`data` 为快照数据。
   * 返回值说明：返回当前 OpenAPI 绑定身份、权限范围和诊断载荷 Markdown。
   * 调用注意事项：不写入 token、appSecret 等敏感凭证，只写业务侧可见的权限摘要。
   */
  private buildAuthScopeMarkdown(data: SnapshotData): string {
    return [
      '# 认证与权限范围',
      '',
      `快照时间：${data.generatedAt}`,
      `OpenAPI client：${data.bootstrap?.clientName ?? '未获取'}`,
      `绑定用户ID：${data.bootstrap?.userId ?? '未获取'}`,
      `绑定用户：${data.bootstrap?.userName ?? '未获取'}`,
      `权限类型：${data.bootstrap?.scopeType ?? '未获取'}`,
      `权限区域：${this.formatListText(data.bootstrap?.regions) || '未声明'}`,
      `权限渠道：${this.formatListText(data.bootstrap?.partnerIds) || '未声明'}`,
      `权限用户：${this.formatListText(data.bootstrap?.userIds) || '未声明'}`,
      '',
      '## 联调诊断',
      this.buildJsonBlock(data.diagnostics ?? {}),
      '',
    ].join('\n');
  }

  /**
   * 构造数据质量报告。
   *
   * 参数说明：`data` 为快照数据。
   * 返回值说明：返回分页完整性、字段完整性和关系断链问题。
   * 调用注意事项：核心资源存在 fatal 时，正式分析读取快照会被阻断。
   */
  private buildDataQualityMarkdown(data: SnapshotData): string {
    return [
      '# 数据质量报告',
      '',
      `快照时间：${data.generatedAt}`,
      '',
      '## 分页完整性',
      this.buildResourceMetaTable(data),
      '',
      '## 问题清单',
      data.dataQualityIssues.length
        ? this.buildRecordsTable(
            data.dataQualityIssues.map((issue) => ({ ...issue })),
            [
              ['级别', ['severity']],
              ['资源', ['resource']],
              ['说明', ['message']],
            ],
          )
        : '未发现阻断项。',
      '',
      '## 生成告警',
      data.warnings.length
        ? this.buildSimpleList(data.warnings.map((item) => [item, '']))
        : '- 无',
      '',
    ].join('\n');
  }

  /**
   * 构造快照索引文件。
   *
   * 参数说明：`data` 为快照数据。
   * 返回值说明：返回 AI 和人工都能快速定位材料的 Markdown 索引。
   * 调用注意事项：索引只描述文件用途，不包含敏感凭证。
   */
  private buildIndexMarkdown(data: SnapshotData): string {
    return [
      '# OpenAPI Markdown 快照索引',
      '',
      `快照时间：${data.generatedAt}`,
      '',
      '| 文件 | 用途 |',
      '| --- | --- |',
      '| 00-snapshot-meta.md | 快照元信息、记录数、分页完整性和数据质量问题 |',
      '| 01-auth-scope.md | 当前 OpenAPI client、绑定 CRM 用户和权限范围 |',
      '| 02-dictionaries.md | 阶段、状态、区域、渠道等级等中文枚举 |',
      '| 03-users.md | 用户明细 |',
      '| 04-partners.md | 合作伙伴开拓与运营摘要 |',
      '| 05-registrations.md | 客户报备摘要 |',
      '| 06-opportunities.md | 商机摘要和阶段分布 |',
      '| 07-quotes.md | 报价摘要 |',
      '| 08-orders.md | 订单摘要 |',
      '| 09-products.md | 产品、模块、硬件和套餐目录 |',
      '| 10-analytics-overview.md | 经营总览和统计接口摘要 |',
      '| 11-data-quality.md | 分页、字段和链路质量报告 |',
      '| details/*.md | 全量明细表，正式分析主链读取这些真实明细 |',
      '',
    ].join('\n');
  }

  /**
   * 构造原始明细文件。
   */
  private buildDetailMarkdown(
    title: string,
    records: SnapshotRecord[],
    detailLimit: number,
    resource: SnapshotResource,
    data?: SnapshotData,
  ): string {
    const meta = data?.resourceMeta[resource];
    return [
      `# ${title}`,
      '',
      ...(data
        ? this.buildMarkdownMetaHeader(data, resource, meta)
        : [`记录数：${records.length}`]),
      '',
      this.buildRecordsTable(records.slice(0, detailLimit), this.resolveGenericColumns(records, resource)),
      '',
    ].join('\n');
  }

  /**
   * 根据问题选择要喂给 AI 的快照文件。
   */
  private resolveRelevantFiles(questionText: string): string[] {
    const normalized = questionText.replace(/\s+/gu, '');
    const files = new Set<string>(['00-快照说明.md', '01-经营总览.md']);
    if (this.hasExplicitRegionScope(normalized)) {
      return ['00-快照说明.md', '07-字段口径与枚举.md', '09-数据质量.md'];
    }
    if (/(合作伙伴|服务商|渠道商|渠道|代理商|经销商|开拓|运营)/u.test(normalized)) {
      files.add('02-合作伙伴开拓.md');
      files.add('details/partners.md');
    }
    if (/(客户报备|报备)/u.test(normalized)) {
      files.add('03-客户报备.md');
      files.add('details/registrations.md');
    }
    if (/(商机|机会|阶段|漏斗)/u.test(normalized)) {
      files.add('04-商机分析.md');
      files.add('details/opportunities.md');
    }
    if (/(订单|下单|成单|签单|成交)/u.test(normalized)) {
      files.add('05-订单分析.md');
      files.add('details/orders.md');
    }
    if (/(报价|报价单|折扣|折扣率)/u.test(normalized)) {
      files.add('07-quotes.md');
      files.add('details/quotes.md');
    }
    if (/(产品|套餐|模块|功能|硬件|报价构成)/u.test(normalized)) {
      files.add('08-产品目录.md');
      files.add('details/products.md');
      files.add('details/packages.md');
    }
    if (/(风险|停滞|未进展|没进展|沉睡|流失|超期)/u.test(normalized)) {
      files.add('06-风险与停滞.md');
    }
    files.add('07-字段口径与枚举.md');
    files.add('09-数据质量.md');
    return [...files];
  }

  /**
   * 判断问题是否包含明确区域范围。
   *
   * 参数说明：`questionText` 为用户问题或已去空白文本。
   * 返回值说明：包含区域/大区/省份/办事处等范围词时返回 `true`。
   * 调用注意事项：命中后只给 AI 字段口径，不给全量明细，避免区域问题混入全国快照。
   * 正式分析阶段仍会读取 details 明细文件，并在程序侧执行区域过滤。
   */
  private hasExplicitRegionScope(questionText: string): boolean {
    const normalized = questionText.replace(/\s+/gu, '');
    return /(区域|大区|北京|天津|河北|山西|内蒙古|辽宁|吉林|黑龙江|上海|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|广西|海南|重庆|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆|台湾|香港|澳门|华东|华南|华北|华中|西南|西北|东北|办事处|广州办|分公司)/u.test(normalized);
  }

  /**
   * 判断资源是否有 Markdown 明细快照。
   *
   * 参数说明：`resource` 为联软标准资源名。
   * 返回值说明：本地 details 目录支持该资源时返回 `true`。
   */
  private isMarkdownSnapshotResource(
    resource: LianruanCrmOpenApiResource,
  ): resource is CoreSnapshotResource {
    return this.resourceOrder.includes(resource as SnapshotResource);
  }

  /**
   * 判断资源是否为产品目录快照资源。
   *
   * 参数说明：`resource` 为快照资源名。
   * 返回值说明：产品目录资源返回 `true`。
   */
  private isCatalogSnapshotResource(
    resource: SnapshotResource,
  ): resource is LianruanCrmOpenApiCatalogResource {
    return ['categories', 'modules', 'features', 'hardware', 'packages', 'products'].includes(resource);
  }

  /**
   * 读取必须存在的资源快照。
   *
   * 参数说明：`resource` 为业务链核心资源。
   * 返回值说明：返回解析后的 Markdown 表格记录。
   * 可能抛出：明细文件缺失时抛出，避免正式分析静默改走 OpenAPI。
   */
  private readRequiredResourceRecords(resource: CoreSnapshotResource): SnapshotRecord[] {
    const records = this.readResourceRecords(resource);
    if (!records) {
      throw new Error(`OpenAPI Markdown 快照缺少 ${resource} 明细文件，请先刷新快照。`);
    }
    return records;
  }

  /**
   * 读取快照生成时间。
   *
   * 参数说明：`latestDir` 为 latest 快照目录。
   * 返回值说明：读取 manifest 中的生成时间，缺失时返回 `undefined`。
   */
  private readSnapshotGeneratedAt(latestDir: string): string | undefined {
    const manifestPath = join(latestDir, 'snapshot-manifest.json');
    if (!existsSync(manifestPath)) {
      return undefined;
    }

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        generatedAt?: string;
      };
      return manifest.generatedAt;
    } catch {
      return undefined;
    }
  }

  /**
   * 解析 Markdown 表格。
   *
   * 参数说明：`markdown` 为 details 明细文件全文。
   * 返回值说明：返回按表头映射出的行对象。
   * 调用注意事项：仅解析首个标准 Markdown 表格；没有表格或“暂无数据”时返回空数组。
   */
  private parseMarkdownTable(markdown: string): Array<Record<string, string>> {
    const lines = markdown.split(/\r?\n/gu);
    const tableStartIndex = lines.findIndex((line, index) =>
      line.trim().startsWith('|') &&
      (lines[index + 1]?.trim().startsWith('| ---') ?? false),
    );
    if (tableStartIndex < 0) {
      return [];
    }

    const headers = this.splitMarkdownTableRow(lines[tableStartIndex]);
    const rows: Array<Record<string, string>> = [];
    for (let index = tableStartIndex + 2; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.trim().startsWith('|')) {
        break;
      }

      const cells = this.splitMarkdownTableRow(line);
      const row: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        row[header] = cells[headerIndex] ?? '';
      });
      rows.push(row);
    }

    return rows;
  }

  /**
   * 拆分 Markdown 表格行。
   *
   * 参数说明：`line` 为单行 Markdown 表格文本。
   * 返回值说明：返回已去空白和反转义的单元格。
   */
  private splitMarkdownTableRow(line: string): string[] {
    const trimmedLine = line.trim().replace(/^\|/u, '').replace(/\|$/u, '');
    const cells: string[] = [];
    let current = '';
    let escaping = false;
    for (const char of trimmedLine) {
      if (escaping) {
        current += char;
        escaping = false;
        continue;
      }

      if (char === '\\') {
        escaping = true;
        continue;
      }

      if (char === '|') {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }
    cells.push(current.trim());
    return cells;
  }

  /**
   * 将 Markdown 表格行映射回分析执行器可消费的标准记录。
   *
   * 参数说明：`resource` 为资源名，`row` 为中文表头行对象。
   * 返回值说明：返回兼容 OpenAPI 执行器字段名的记录对象。
   */
  private mapMarkdownTableRowToRecord(
    resource: SnapshotResource,
    row: Record<string, string>,
  ): SnapshotRecord {
    const id = this.readRowText(row, ['ID']);
    const name = this.readRowText(row, ['名称', '商机', '订单', '报价', '渠道商', '客户', '姓名']);
    const customerId = this.readRowText(row, ['客户ID']);
    const customerName = this.readRowText(row, ['客户']);
    const partnerId = this.readRowText(row, ['渠道商ID']);
    const partnerName = this.readRowText(row, ['渠道商']);
    const assignedPartnerId = this.readRowText(row, ['指派渠道商ID']);
    const assignedPartnerName = this.readRowText(row, ['指派渠道商']);
    const registrationId = this.readRowText(row, ['报备ID']);
    const opportunityId = this.readRowText(row, ['商机ID', '关联商机ID']);
    const opportunityName = this.readRowText(row, ['商机', '关联商机']);
    const quoteId = this.readRowText(row, ['报价ID']);
    const orderId = this.readRowText(row, ['订单ID']);
    const orderNo = this.readRowText(row, ['订单编号']);
    const status = this.readRowText(row, ['状态']);
    const stage = this.readRowText(row, ['阶段']);
    const amount = this.readRowNumber(row, ['金额']);
    const ownerId = this.readRowText(row, ['负责人ID']);
    const ownerName = this.readRowText(row, ['负责人']);
    const createdAt = this.readRowText(row, ['创建时间']);
    const updatedAt = this.readRowText(row, ['更新时间']);
    const region = this.readRowText(row, ['区域']) || this.inferRegionFromMarkdownRow(row);
    const bigRegion = this.readRowText(row, ['大区']);
    const city = this.readRowText(row, ['所在城市', '城市', '地市']);

    if (resource === 'users') {
      return {
        id: this.readRowText(row, ['用户ID']) || id,
        username: this.readRowText(row, ['账号']),
        name,
        role: this.readRowText(row, ['角色']),
        roleName: this.readRowText(row, ['角色']),
        partnerId,
        partnerName,
        departmentName: this.readRowText(row, ['部门']),
        status,
        region,
        bigRegion,
      };
    }

    if (resource === 'partners') {
      const partnerLevel = this.readText(row['合作等级'] ?? row['等级']);
      const partnerType = this.readText(row['渠道类型'] ?? row['类型']);
      const technicalServiceProviderType = this.readText(row['技术服务商类型']);
      const isTechnicalServiceProvider =
        this.resolveBooleanText(row['是否技术服务商']) ??
        (/技术服务商/u.test(partnerType) ||
          Boolean(
            technicalServiceProviderType &&
              !/^(none|false|0|否|非技术服务商)$/iu.test(technicalServiceProviderType),
          ));
      return {
        id,
        partnerId: partnerId || id,
        name: name || partnerName,
        partnerName: partnerName || name,
        displayName: this.readRowText(row, ['展示名']),
        partnerLevel,
        partnerLevelName: partnerLevel,
        level: partnerLevel,
        partnerType,
        partnerTypeName: partnerType,
        isTechnicalServiceProvider,
        isTechService: isTechnicalServiceProvider,
        technicalServiceProvider: isTechnicalServiceProvider ? '是' : '否',
        technicalServiceProviderType,
        techServiceType: technicalServiceProviderType,
        status,
        amount,
        totalAmount: amount,
        totalAmt: amount,
        city,
        cityName: city,
        parentPartnerId: this.readRowText(row, ['父级渠道ID']),
        parentPartnerIds: this.readRowText(row, ['父级渠道链']),
        contact: this.readRowText(row, ['联系人']),
        phone: this.readRowText(row, ['手机号']),
        email: this.readRowText(row, ['邮箱']),
        updatedAt,
        region,
        bigRegion,
      };
    }

    if (resource === 'opportunities') {
      return {
        id,
        opportunityId: opportunityId || id,
        name,
        opportunityName: name,
        customerId,
        customerName,
        customer: customerName,
        registrationId,
        regId: registrationId,
        quoteId,
        partnerId,
        partnerName,
        assignedPartnerId,
        assignedPartnerName,
        status,
        statusName: status,
        stage: stage || status,
        stageName: stage || status,
        amount,
        ownerId,
        ownerName,
        assignedStaffId: ownerId,
        assignedStaffName: ownerName,
        expectedClose: this.readRowText(row, ['预计成交']),
        createdAt,
        updatedAt,
        region,
        bigRegion,
      };
    }

    if (resource === 'orders') {
      return {
        id,
        orderId: orderId || id,
        orderNo,
        name,
        orderName: name,
        customerId,
        customerName,
        customer: customerName,
        registrationId,
        regId: registrationId,
        opportunityId,
        opportunityName,
        quoteId,
        partnerId,
        partnerName,
        assignedPartnerId,
        assignedPartnerName,
        parentPartnerId: this.readRowText(row, ['父级渠道ID']),
        status,
        statusName: status,
        amount,
        orderAmount: amount,
        totalAmount: amount,
        total: amount,
        ownerId,
        ownerName,
        assignedStaffId: ownerId,
        assignedStaffName: ownerName,
        dealAt: this.readRowText(row, ['成交时间']),
        createdAt,
        updatedAt,
        region,
        bigRegion,
      };
    }

    if (resource === 'registrations') {
      return {
        id,
        registrationId: registrationId || id,
        name,
        registrationName: name,
        customerId,
        customerName,
        customer: customerName,
        creditCode: this.readRowText(row, ['统一社会信用代码']),
        industry: this.readRowText(row, ['行业']),
        partnerId,
        partnerName,
        assignedPartnerId,
        assignedPartnerName,
        opportunityId,
        opportunityName,
        status,
        statusName: status,
        ownerId,
        ownerName,
        assignedStaffId: ownerId,
        assignedStaffName: ownerName,
        approvedAt: this.readRowText(row, ['通过时间']),
        expireAt: this.readRowText(row, ['失效时间']),
        createdAt,
        updatedAt,
        region,
        bigRegion,
      };
    }

    if (resource === 'quotes') {
      return {
        id,
        quoteId: quoteId || id,
        quoteName: name || quoteId || id,
        customerId,
        customerName,
        customer: customerName,
        registrationId,
        regId: registrationId,
        opportunityId,
        opportunityIds: opportunityId ? [opportunityId] : [],
        opportunityName,
        oppId: opportunityId,
        partnerId,
        partnerName,
        assignedPartnerId,
        assignedPartnerName,
        status,
        statusName: status,
        amount,
        total: amount,
        totalAmount: amount,
        originalTotal: amount,
        discountAmount: this.readRowNumber(row, ['折扣金额']),
        endpoints: this.readRowText(row, ['端点数']),
        products: this.readRowText(row, ['产品']),
        quoteMode: this.readRowText(row, ['报价模式']),
        ownerId,
        ownerName,
        assignedStaffId: ownerId,
        assignedStaffName: ownerName,
        createdAt,
        updatedAt,
        region,
        bigRegion,
      };
    }

    return {
      id,
      name,
      customerName: customerName || name,
      customer: customerName || name,
      customerId,
      partnerId,
      partnerName,
      status,
      stage,
      amount,
      ownerId,
      ownerName,
      createdAt,
      updatedAt,
      region,
      bigRegion,
    };
  }

  /**
   * 从 Markdown 行文本推断区域词。
   *
   * 参数说明：`row` 为中文表头行对象。
   * 返回值说明：命中省份、城市或大区线索时返回对应文本；否则返回空字符串。
   * 调用注意事项：这是快照缺少结构化区域字段时的保守补充，只服务本地过滤。
   */
  private inferRegionFromMarkdownRow(row: Record<string, string>): string {
    const text = Object.values(row).join(' ');
    const matched = text.match(
      /北京|天津|河北|山西|内蒙古|辽宁|吉林|黑龙江|上海|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|广西|海南|重庆|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆|台湾|香港|澳门|广州|青岛|济南|烟台|潍坊|临沂|华东|华南|华北|华中|西南|西北|东北/u,
    );
    return matched?.[0] ?? '';
  }

  /**
   * 读取单个 Markdown 文件。
   */
  private readMarkdownFile(baseDir: string, fileName: string): string {
    const filePath = join(baseDir, fileName);
    if (!existsSync(filePath)) {
      return '';
    }
    return readFileSync(filePath, 'utf8').trim();
  }

  /**
   * 输出 latest 目录绝对路径。
   */
  private resolveLatestDir(): string {
    const config = this.localRuntimeConfigService.getCrmOpenApiMarkdownSnapshotConfig();
    return resolve(config.snapshotDir, 'latest');
  }

  /**
   * 校验快照是否可用于正式分析。
   *
   * 参数说明：
   * - `latestDir`：latest 快照目录；
   * - `resource`：本次需要读取的资源。
   * 返回值说明：校验通过无返回值。
   * 可能抛出：manifest 缺失、版本过旧、核心资源分页不完整或存在 fatal 问题时抛出。
   * 调用注意事项：正式问答阶段必须先校验，避免基于截断 Markdown 给出错误结论。
   */
  private assertSnapshotUsable(latestDir: string, resource: SnapshotResource): void {
    const manifestPath = join(latestDir, 'snapshot-manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error('OpenAPI Markdown 快照缺少 manifest，请先刷新快照后再分析。');
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Partial<OpenApiMarkdownSnapshotManifest>;
    const meta = manifest.resourceMeta?.[resource];
    if (!meta && this.requiredResourceSet.has(resource)) {
      throw new Error('OpenAPI Markdown 快照版本过旧，缺少分页完整性元数据，请先刷新快照后再分析。');
    }

    if (meta?.required && !meta.complete) {
      throw new Error(
        `OpenAPI Markdown 快照中 ${resource} 明细未拉齐：OpenAPI total=${meta.total}，本地 returnedCount=${meta.returnedCount}。请先刷新完整快照后再分析。`,
      );
    }

    const fatalIssue = (manifest.dataQualityIssues ?? []).find(
      (issue) => issue.severity === 'fatal' && (!issue.resource || issue.resource === resource),
    );
    if (fatalIssue) {
      throw new Error(`OpenAPI Markdown 快照数据质量校验未通过：${fatalIssue.message}`);
    }
  }

  /**
   * 构造 Markdown 文件头元信息。
   *
   * 参数说明：`data` 为快照数据，`resource` 为当前资源，`meta` 为分页元数据。
   * 返回值说明：返回用于文件头的多行文本数组。
   * 调用注意事项：文件头不使用表格，确保明细反读仍解析第一张业务表。
   */
  private buildMarkdownMetaHeader(
    data: SnapshotData,
    resource: SnapshotResource,
    meta?: SnapshotResourceMeta,
  ): string[] {
    return [
      `snapshotAt：${data.generatedAt}`,
      'baseUrl：由运行时配置提供，快照不写入凭证或密钥',
      `clientName：${data.bootstrap?.clientName ?? '未获取'}`,
      `boundUser：${data.bootstrap?.userName ?? '未获取'}（${data.bootstrap?.userId ?? '未获取'}）`,
      `scopeType：${data.bootstrap?.scopeType ?? '未获取'}`,
      `filters：当前权限范围 + 快照生成时未追加业务筛选`,
      `resource：${resource}`,
      `记录数：${meta?.returnedCount ?? 0}`,
      `total：${meta?.total ?? 0}`,
      `returnedCount：${meta?.returnedCount ?? 0}`,
      `requestIds：${this.formatListText(meta?.requestIds) || '未记录'}`,
      'piiMasking：沿用联软 OpenAPI 返回口径；快照不额外写入 token/password/secret',
    ];
  }

  /**
   * 构造资源分页完整性表。
   *
   * 参数说明：`data` 为快照数据。
   * 返回值说明：返回 Markdown 表格。
   * 调用注意事项：核心资源未完整拉取时会同时写入 fatal 数据质量问题。
   */
  private buildResourceMetaTable(data: SnapshotData): string {
    const rows = this.resourceOrder.map((resource) => {
      const meta = data.resourceMeta[resource];
      return {
        resource,
        total: meta.total,
        returnedCount: meta.returnedCount,
        required: meta.required ? '是' : '否',
        complete: meta.complete ? '完整' : '未拉齐',
        requestIds: this.formatListText(meta.requestIds),
      };
    });
    return this.buildRecordsTable(rows, [
      ['资源', ['resource']],
      ['OpenAPI total', ['total']],
      ['本地 returnedCount', ['returnedCount']],
      ['核心资源', ['required']],
      ['状态', ['complete']],
      ['requestIds', ['requestIds']],
    ]);
  }

  /**
   * 构造 JSON 代码块。
   *
   * 参数说明：`value` 为任意可序列化载荷。
   * 返回值说明：返回格式化 JSON Markdown 代码块；空对象返回“暂无数据”。
   */
  private buildJsonBlock(value: unknown): string {
    if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
      return '暂无数据。';
    }
    return ['```json', JSON.stringify(value, null, 2), '```'].join('\n');
  }

  /**
   * 输出列表文本。
   *
   * 参数说明：`items` 为待展示数组。
   * 返回值说明：返回中文顿号分隔文本。
   */
  private formatListText(items?: unknown[]): string {
    return (items ?? []).map((item) => this.readText(item)).filter(Boolean).join('、');
  }

  /**
   * 读取资源中文标题。
   *
   * 参数说明：`resource` 为 OpenAPI 资源名。
   * 返回值说明：返回用于文件标题的中文名称。
   */
  private resolveDetailTitle(resource: SnapshotResource): string {
    const labels: Record<SnapshotResource, string> = {
      users: '用户明细',
      customers: '客户明细',
      partners: '合作伙伴明细',
      registrations: '客户报备明细',
      opportunities: '商机明细',
      quotes: '报价明细',
      orders: '订单明细',
      categories: '产品分类明细',
      modules: '产品模块明细',
      features: '产品功能明细',
      hardware: '硬件产品明细',
      packages: '套餐明细',
      products: '产品明细',
    };
    return labels[resource];
  }

  /**
   * 构造简单列表。
   */
  private buildSimpleList(items: Array<[string, string | number]>): string {
    return items.map(([label, value]) => `- ${label}${value === '' ? '' : `：${value}`}`).join('\n');
  }

  /**
   * 构造键值表格。
   */
  private buildKeyValueTable(
    record: SnapshotRecord,
    fields: Array<[string, string]>,
  ): string {
    const rows = fields.map(([label, field]) => ({
      label,
      value: this.formatCell(record[field]),
    }));
    return this.buildRecordsTable(rows, [['指标', ['label']], ['值', ['value']]]);
  }

  /**
   * 构造通用 Markdown 表格。
   */
  private buildRecordsTable(
    records: SnapshotRecord[],
    columns: Array<[string, string[]]>,
  ): string {
    if (!records.length) {
      return '暂无数据。';
    }

    const header = `| ${columns.map(([label]) => label).join(' | ')} |`;
    const separator = `| ${columns.map(() => '---').join(' | ')} |`;
    const body = records
      .map((record) =>
        `| ${columns
          .map(([, fields]) => this.escapeTableCell(this.formatCell(this.pickValue(record, fields))))
          .join(' | ')} |`,
      )
      .join('\n');
    return [header, separator, body].join('\n');
  }

  /**
   * 构造分组计数表。
   */
  private buildBucketTable(rows: Array<{ label: string; count: number }>): string {
    return this.buildRecordsTable(rows, [['分组', ['label']], ['数量', ['count']]]);
  }

  /**
   * 按候选字段分组计数。
   */
  private groupBy(records: SnapshotRecord[], fields: string[]): Array<{ label: string; count: number }> {
    const counts = new Map<string, number>();
    for (const record of records) {
      const label = this.readText(this.pickValue(record, fields)) || '未填写';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count);
  }

  /**
   * 从记录中推导泛用明细列。
   */
  private resolveGenericColumns(
    records: SnapshotRecord[],
    resource?: SnapshotResource,
  ): Array<[string, string[]]> {
    const sampleKeys = new Set(records.flatMap((record) => Object.keys(record)));
    if (resource === 'users') {
      return this.filterAvailableColumns([
        ['用户ID', ['id', 'userId']],
        ['账号', ['username']],
        ['姓名', ['name', 'userName']],
        ['角色', ['roleName', 'role']],
        ['区域', ['region', 'regionName']],
        ['大区', ['bigRegion', 'bigRegionName']],
        ['渠道商ID', ['partnerId']],
        ['渠道商', ['partnerName']],
        ['部门', ['departmentName', 'departmentId']],
        ['状态', ['statusName', 'status']],
      ], sampleKeys);
    }
    if (resource === 'partners') {
      return this.filterAvailableColumns([
        ['ID', ['id']],
        ['渠道商ID', ['partnerId', 'id']],
        ['渠道商', ['partnerName', 'shortName', 'name']],
        ['展示名', ['displayName']],
        ['合作等级', ['partnerLevelName', 'partnerLevel', 'levelName', 'level']],
        ['渠道类型', ['partnerTypeName', 'partnerType', 'typeName', 'type']],
        ['是否技术服务商', ['isTechnicalServiceProvider', 'isTechService', 'technicalServiceProvider']],
        ['技术服务商类型', ['technicalServiceProviderType', 'techServiceType']],
        ['父级渠道ID', ['parentPartnerId']],
        ['父级渠道链', ['parentPartnerIds']],
        ['所在城市', [
          'city',
          'cityName',
          'city_name',
          '所在城市',
          '城市',
          '地市',
          'partnerCityName',
          'partnerCity',
          'partner_city_name',
          'partner_city',
          'prefectureCityName',
          'prefectureCity',
          'prefecture_city_name',
          'prefecture_city',
        ]],
        ['区域', ['region', 'regionName', 'bigRegion', 'bigRegionName', 'area', 'province']],
        ['大区', ['bigRegion', 'bigRegionName']],
        ['状态', ['statusName', 'status']],
        ['联系人', ['contact']],
        ['手机号', ['phone']],
        ['邮箱', ['email']],
        ['更新时间', ['updatedAt', 'createdAt', 'joinDate']],
      ], sampleKeys);
    }
    if (resource === 'registrations') {
      return this.filterAvailableColumns([
        ['ID', ['id']],
        ['报备ID', ['registrationId', 'regId', 'id']],
        ['客户ID', ['customerId', 'creditCode']],
        ['客户', ['customerName', 'customer']],
        ['统一社会信用代码', ['creditCode']],
        ['行业', ['industry']],
        ['渠道商ID', ['partnerId', 'assignedPartnerId']],
        ['渠道商', ['partnerName', 'assignedPartnerName']],
        ['指派渠道商ID', ['assignedPartnerId']],
        ['指派渠道商', ['assignedPartnerName']],
        ['关联商机ID', ['opportunityId']],
        ['关联商机', ['opportunityName']],
        ['状态', ['statusName', 'status']],
        ['负责人ID', ['ownerId', 'assignedStaffId', 'createdBy']],
        ['负责人', ['ownerName', 'assignedStaffName', 'createdByName']],
        ['区域', ['region', 'regionName']],
        ['大区', ['bigRegion', 'bigRegionName']],
        ['通过时间', ['approvedAt']],
        ['失效时间', ['expireAt']],
        ['创建时间', ['createdAt']],
        ['更新时间', ['updatedAt']],
      ], sampleKeys);
    }
    if (resource === 'opportunities') {
      return this.filterAvailableColumns([
        ['ID', ['id']],
        ['商机ID', ['opportunityId', 'oppId', 'id']],
        ['商机', ['opportunityName', 'name', 'title']],
        ['客户ID', ['customerId']],
        ['客户', ['customerName', 'customer']],
        ['报备ID', ['registrationId', 'regId']],
        ['报价ID', ['quoteId']],
        ['渠道商ID', ['partnerId', 'assignedPartnerId']],
        ['渠道商', ['partnerName', 'assignedPartnerName']],
        ['指派渠道商ID', ['assignedPartnerId']],
        ['指派渠道商', ['assignedPartnerName']],
        ['阶段', ['stageName', 'stage', 'statusName', 'status']],
        ['状态', ['statusName', 'status']],
        ['金额', ['amount', 'opportunityAmount', 'expectedAmount', 'expectAmount', 'totalAmount']],
        ['负责人ID', ['ownerId', 'assignedStaffId', 'createdBy']],
        ['负责人', ['ownerName', 'assignedStaffName', 'createdByName']],
        ['区域', ['region', 'regionName']],
        ['大区', ['bigRegion', 'bigRegionName']],
        ['预计成交', ['expectedClose']],
        ['创建时间', ['createdAt']],
        ['更新时间', ['updatedAt', 'lastFollowUpAt']],
      ], sampleKeys);
    }
    if (resource === 'quotes') {
      return this.filterAvailableColumns([
        ['ID', ['id']],
        ['报价ID', ['quoteId', 'id']],
        ['报价', ['quoteName', 'name']],
        ['客户ID', ['customerId']],
        ['客户', ['customerName', 'customer']],
        ['报备ID', ['registrationId', 'regId']],
        ['商机ID', ['opportunityId', 'opportunityIds', 'oppId', 'oppIds']],
        ['商机', ['opportunityName']],
        ['渠道商ID', ['partnerId', 'assignedPartnerId']],
        ['渠道商', ['partnerName', 'assignedPartnerName']],
        ['金额', ['amount', 'total', 'totalAmount', 'originalTotal']],
        ['折扣金额', ['discountAmount']],
        ['状态', ['statusName', 'status']],
        ['端点数', ['endpoints']],
        ['产品', ['products']],
        ['报价模式', ['quoteMode']],
        ['负责人ID', ['ownerId', 'assignedStaffId', 'createdBy']],
        ['负责人', ['ownerName', 'assignedStaffName', 'createdByName']],
        ['区域', ['region', 'regionName']],
        ['大区', ['bigRegion', 'bigRegionName']],
        ['创建时间', ['createdAt']],
        ['更新时间', ['updatedAt']],
      ], sampleKeys);
    }
    if (resource === 'orders') {
      return this.filterAvailableColumns([
        ['ID', ['id']],
        ['订单ID', ['orderId', 'id']],
        ['订单编号', ['orderNo']],
        ['订单', ['orderName', 'orderNo', 'name']],
        ['客户ID', ['customerId']],
        ['客户', ['customerName', 'customer']],
        ['报备ID', ['registrationId', 'regId']],
        ['商机ID', ['opportunityId']],
        ['商机', ['opportunityName']],
        ['报价ID', ['quoteId']],
        ['渠道商ID', ['partnerId', 'assignedPartnerId', 'parentPartnerId']],
        ['渠道商', ['partnerName', 'assignedPartnerName']],
        ['父级渠道ID', ['parentPartnerId']],
        ['状态', ['statusName', 'status']],
        ['金额', ['amount', 'orderAmount', 'total', 'totalAmount']],
        ['负责人ID', ['ownerId', 'assignedStaffId', 'createdBy']],
        ['负责人', ['ownerName', 'assignedStaffName', 'createdByName']],
        ['区域', ['region', 'regionName']],
        ['大区', ['bigRegion', 'bigRegionName']],
        ['成交时间', ['dealAt']],
        ['创建时间', ['createdAt']],
        ['更新时间', ['updatedAt']],
      ], sampleKeys);
    }
    const candidates: Array<[string, string[]]> = [
      ['ID', ['id']],
      ['名称', ['opportunityName', 'orderName', 'customerName', 'partnerName', 'name', 'orderNo']],
      ['客户', ['customerName', 'customer']],
      ['渠道商', ['partnerName', 'assignedPartnerName']],
      ['状态', ['statusName', 'status']],
      ['阶段', ['stageName', 'stage']],
      ['金额', ['amount', 'totalAmount', 'opportunityAmount', 'orderAmount', 'expectedAmount']],
      ['负责人', ['ownerName', 'assignedStaffName', 'createdByName']],
      ['区域', ['region', 'regionName']],
      ['大区', ['bigRegion', 'bigRegionName']],
      ['更新时间', ['updatedAt', 'createdAt']],
    ];
    return candidates.filter(([, fields]) => fields.some((field) => sampleKeys.has(field))).slice(0, 12);
  }

  /**
   * 按记录实际字段过滤 Markdown 表格列。
   *
   * 参数说明：`columns` 为候选列，`sampleKeys` 为当前资源出现过的字段集合。
   * 返回值说明：仅保留至少命中一个字段的列。
   */
  private filterAvailableColumns(
    columns: Array<[string, string[]]>,
    sampleKeys: Set<string>,
  ): Array<[string, string[]]> {
    return columns.filter(([, fields]) => fields.some((field) => sampleKeys.has(field)));
  }

  /**
   * 将 Markdown 中的中文布尔值转成稳定布尔。
   */
  private resolveBooleanText(value: unknown): boolean | undefined {
    const text = this.readText(value).toLowerCase();
    if (!text) {
      return undefined;
    }
    if (['true', '1', 'yes', '是', '技术服务商'].includes(text)) {
      return true;
    }
    if (['false', '0', 'no', '否', '非技术服务商'].includes(text)) {
      return false;
    }
    return undefined;
  }

  /**
   * 从 Markdown 行中读取候选中文列文本。
   *
   * 参数说明：`row` 为中文表头行对象，`labels` 为候选列名。
   * 返回值说明：返回第一个非空列值。
   */
  private readRowText(row: Record<string, string>, labels: string[]): string {
    for (const label of labels) {
      const value = this.readText(row[label]);
      if (value) {
        return value;
      }
    }
    return '';
  }

  /**
   * 从 Markdown 行中读取候选中文列数字。
   *
   * 参数说明：`row` 为中文表头行对象，`labels` 为候选列名。
   * 返回值说明：返回第一个可解析数字；没有命中时返回 0。
   */
  private readRowNumber(row: Record<string, string>, labels: string[]): number {
    for (const label of labels) {
      const value = this.readText(row[label]);
      if (value) {
        return this.toNumber(value);
      }
    }
    return 0;
  }

  /**
   * 归一化链路 ID 字段。
   *
   * 参数说明：`value` 可为数组、逗号分隔字符串或普通文本。
   * 返回值说明：返回去空白后的 ID 列表。
   */
  private normalizeRelationIds(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.readText(item)).filter(Boolean);
    }
    return this.readText(value)
      .split(/[、,，;；\s]+/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /**
   * 读取候选字段值。
   */
  private pickValue(record: SnapshotRecord, fields: string[]): unknown {
    for (const field of fields) {
      const value = record[field];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return '';
  }

  /**
   * 汇总金额字段。
   */
  private sumAmount(records: SnapshotRecord[], fields: string[]): number {
    return records.reduce(
      (sum, record) => sum + this.toNumber(this.pickValue(record, fields)),
      0,
    );
  }

  /**
   * 格式化表格单元格。
   */
  private formatCell(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.readText(item)).filter(Boolean).join('、');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return this.readText(value);
  }

  /**
   * 转义 Markdown 表格单元格。
   */
  private escapeTableCell(value: string): string {
    return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ').trim();
  }

  /**
   * 读取文本。
   */
  private readText(value: unknown): string {
    return String(value ?? '').replace(/\s+/gu, ' ').trim();
  }

  /**
   * 转成数字。
   */
  private toNumber(value: unknown): number {
    const numberValue = Number(String(value ?? '0').replace(/,/gu, ''));
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  /**
   * 计算日期距今天数。
   */
  private diffDays(dateText: string): number {
    const time = new Date(dateText).getTime();
    if (!Number.isFinite(time)) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - time) / 86400000));
  }
}
