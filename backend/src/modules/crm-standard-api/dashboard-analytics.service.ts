/**
 * 看板统计直连服务
 *
 * 设计目标：
 * - 绕过 Markdown 快照，直接调用联软 OpenAPI 统计接口获取实时数据
 * - 为看板结果组装器提供数据源
 * - 严格遵守 token 绑定的权限范围（联软侧自动裁剪）
 * - 失败时降级到 Markdown 快照，不阻断看板渲染
 *
 * 与现有链路的关系：
 * - 不替代 LianruanCrmAnalysisExecutorService（它仍负责常规问答的快照读取）
 * - 不替代 OpenApiMarkdownSnapshotService（它仍负责定时快照刷新）
 * - 只在看板型意图被识别后，由 DashboardReportComposer 调用
 */

import { Injectable } from '@nestjs/common';
import { LianruanCrmOpenApiClient } from './lianruan-crm-openapi.client';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type {
  LianruanCrmOpenApiAnalyticsQuery,
  LianruanCrmOpenApiFunnelAnalytics,
  LianruanCrmOpenApiOwnerContributionRecord,
  LianruanCrmOpenApiPartnerContributionRecord,
  LianruanCrmOpenApiPartnerProfileAnalytics,
  LianruanCrmOpenApiRegionContributionRecord,
  LianruanCrmOpenApiResourceSummary,
} from './lianruan-crm-openapi.types';

const PARTNER_MASTER_PAGE_SIZE = 500;
const PARTNER_MASTER_MAX_PAGES = 5;

/**
 * 看板统计查询参数
 * 继承联软标准 AnalyticsQuery，补充看板常用维度
 */
export interface DashboardAnalyticsQuery extends LianruanCrmOpenApiAnalyticsQuery {
  // 联软 AnalyticsQuery 已含 region/bigRegion/partnerId 等筛选
  // 看板场景补充：
  limit?: number; // 返回条数上限（用于 TOP N 排行）
}

/**
 * 看板统计聚合结果
 * 包含看板组装所需的全部统计数据
 */
export interface DashboardAnalyticsBundle {
  businessOverview: Record<string, unknown>;
  funnel: LianruanCrmOpenApiFunnelAnalytics | null;
  partnerContributions: LianruanCrmOpenApiPartnerContributionRecord[];
  regionContributions: LianruanCrmOpenApiRegionContributionRecord[];
  ownerContributions: LianruanCrmOpenApiOwnerContributionRecord[];
  partnerProfile: LianruanCrmOpenApiPartnerProfileAnalytics | null;
  /** 渠道商统计摘要（含合作级别/技术服务商/状态/时间序列分布） */
  partnerSummary: LianruanCrmOpenApiResourceSummary | null;
  /** 商机统计摘要（含阶段分布/区域/合作级别/时间序列） */
  opportunitySummary: LianruanCrmOpenApiResourceSummary | null;
  /** 订单统计摘要（含状态分布/区域/合作级别/时间序列） */
  orderSummary: LianruanCrmOpenApiResourceSummary | null;
  /** 客户报备统计摘要 */
  registrationSummary: LianruanCrmOpenApiResourceSummary | null;
  /** 报价统计摘要 */
  quoteSummary: LianruanCrmOpenApiResourceSummary | null;
  dataSource: 'OPENAPI_REALTIME' | 'OPENAPI_SNAPSHOT_FALLBACK';
  fetchedAt: string;
  errors: string[];
}

@Injectable()
export class DashboardAnalyticsService {
  constructor(
    private readonly openApiClient: LianruanCrmOpenApiClient,
    private readonly logger: AnalysisLoggerService,
  ) {}

  /**
   * 判断看板直连是否可用
   * 联软 OpenAPI client 已配置且 enabled 时返回 true
   */
  isAvailable(): boolean {
    return this.openApiClient.isEnabled();
  }

  /**
   * 批量获取看板统计数据
   *
   * 并行调用 11 个统计接口（6 个原有 + 5 个 summary 增强），部分失败不阻断整体。
   * 所有接口都失败时返回空数据 + errors，由调用方决定降级策略。
   * 失败的接口会被兜底逻辑从已成功接口的数据中推导（如从 partnerContributions 聚合分布/漏斗）。
   *
   * @param query 筛选参数（region/bigRegion/时间范围等）
   * @returns 看板统计聚合结果
   */
  async fetchDashboardAnalytics(
    query: DashboardAnalyticsQuery = {},
  ): Promise<DashboardAnalyticsBundle> {
    const fetchedAt = new Date().toISOString();
    const errors: string[] = [];

    // 并行调用全部统计接口，部分失败不阻断整体。
    // 原有 6 个接口：business-overview / funnel / partners/contribution / regions/contribution / owners/contribution / partners/profile
    // 新增 5 个 summary 接口（2026-06-24 增强）：partners/registrations/opportunities/quotes/orders summary
    const analyticsQuery = this.stripDashboardExtras(query);
    const [
      businessOverviewResult,
      funnelResult,
      partnerContributionsResult,
      regionContributionsResult,
      ownerContributionsResult,
      partnerProfileResult,
      partnerSummaryResult,
      opportunitySummaryResult,
      orderSummaryResult,
      registrationSummaryResult,
      quoteSummaryResult,
    ] = await Promise.allSettled([
      this.fetchBusinessOverview(query),
      this.fetchFunnel(query),
      this.fetchPartnerContributions(query),
      this.fetchRegionContributions(query),
      this.fetchOwnerContributions(query),
      this.fetchPartnerProfile(query),
      this.fetchResourceSummary('partners', analyticsQuery),
      this.fetchResourceSummary('opportunities', analyticsQuery),
      this.fetchResourceSummary('orders', analyticsQuery),
      this.fetchResourceSummary('registrations', analyticsQuery),
      this.fetchResourceSummary('quotes', analyticsQuery),
    ]);

    // 解析结果，失败的记录错误信息
    const businessOverview = this.resolveSettled(businessOverviewResult, 'business-overview', errors);
    const funnel = this.resolveSettled(funnelResult, 'funnel', errors);
    const rawPartnerContributions = this.resolveSettled(partnerContributionsResult, 'partners/contribution', errors) ?? [];
    const regionContributions = this.resolveSettled(regionContributionsResult, 'regions/contribution', errors) ?? [];
    const ownerContributions = this.resolveSettled(ownerContributionsResult, 'owners/contribution', errors) ?? [];
    const partnerProfile = this.resolveSettled(partnerProfileResult, 'partners/profile', errors);
    const partnerSummary = this.resolveSettled(partnerSummaryResult, 'partners/summary', errors);
    const opportunitySummary = this.resolveSettled(opportunitySummaryResult, 'opportunities/summary', errors);
    const orderSummary = this.resolveSettled(orderSummaryResult, 'orders/summary', errors);
    const registrationSummary = this.resolveSettled(registrationSummaryResult, 'registrations/summary', errors);
    const quoteSummary = this.resolveSettled(quoteSummaryResult, 'quotes/summary', errors);
    const partnerContributions = await this.enrichPartnerContributionLocations(
      rawPartnerContributions,
      query,
      errors,
    );

    // 全部失败时标记降级
    const allFailed =
      businessOverview === null &&
      funnel === null &&
      partnerContributions.length === 0 &&
      regionContributions.length === 0 &&
      ownerContributions.length === 0 &&
      partnerSummary === null;

    const dataSource: DashboardAnalyticsBundle['dataSource'] = allFailed
      ? 'OPENAPI_SNAPSHOT_FALLBACK'
      : 'OPENAPI_REALTIME';

    if (errors.length > 0) {
      this.logger.logWarn(
        `看板统计直连部分接口失败（${errors.length}个）`,
        {
          errors: errors,
          dataSource,
          succeeded: {
            businessOverview: businessOverview !== null,
            funnel: funnel !== null,
            partnerContributions: partnerContributions.length > 0,
            regionContributions: regionContributions.length > 0,
            ownerContributions: ownerContributions.length > 0,
            partnerProfile: partnerProfile !== null,
            partnerSummary: partnerSummary !== null,
            opportunitySummary: opportunitySummary !== null,
            orderSummary: orderSummary !== null,
            registrationSummary: registrationSummary !== null,
            quoteSummary: quoteSummary !== null,
          },
        },
      );
    } else {
      this.logger.logStep('看板统计直连全部接口成功。', {
        dataSource,
        partnerSummaryFields: partnerSummary ? {
          totalCount: partnerSummary.totalCount,
          byCooperationLevel: partnerSummary.byCooperationLevel?.length ?? 0,
          byTechServiceType: partnerSummary.byTechServiceType?.length ?? 0,
          byStatus: partnerSummary.byStatus?.length ?? 0,
          timeSeries: partnerSummary.timeSeries?.length ?? 0,
          byMonth: partnerSummary.byMonth?.length ?? 0,
        } : null,
      });
    }

    return {
      businessOverview: businessOverview ?? {},
      funnel,
      partnerContributions,
      regionContributions,
      ownerContributions,
      partnerProfile,
      partnerSummary,
      opportunitySummary,
      orderSummary,
      registrationSummary,
      quoteSummary,
      dataSource,
      fetchedAt,
      errors,
    };
  }

  // ===== 私有方法：各统计接口的独立调用 =====

  private async fetchBusinessOverview(
    query: DashboardAnalyticsQuery,
  ): Promise<Record<string, unknown>> {
    return this.openApiClient.getBusinessOverviewAnalytics(this.stripDashboardExtras(query));
  }

  private async fetchFunnel(
    query: DashboardAnalyticsQuery,
  ): Promise<LianruanCrmOpenApiFunnelAnalytics> {
    return this.openApiClient.getFunnelAnalytics(this.stripDashboardExtras(query));
  }

  private async fetchPartnerContributions(
    query: DashboardAnalyticsQuery,
  ): Promise<LianruanCrmOpenApiPartnerContributionRecord[]> {
    const limit = query.limit ?? 50;
    return this.openApiClient.listPartnerContributions({
      ...this.stripDashboardExtras(query),
      pageNo: 1,
      pageSize: limit,
    });
  }

  private async fetchRegionContributions(
    query: DashboardAnalyticsQuery,
  ): Promise<LianruanCrmOpenApiRegionContributionRecord[]> {
    return this.openApiClient.listRegionContributions(this.stripDashboardExtras(query));
  }

  private async fetchOwnerContributions(
    query: DashboardAnalyticsQuery,
  ): Promise<LianruanCrmOpenApiOwnerContributionRecord[]> {
    const limit = query.limit ?? 50;
    return this.openApiClient.listOwnerContributions({
      ...this.stripDashboardExtras(query),
      pageNo: 1,
      pageSize: limit,
    });
  }

  private async fetchPartnerProfile(
    query: DashboardAnalyticsQuery,
  ): Promise<LianruanCrmOpenApiPartnerProfileAnalytics> {
    return this.openApiClient.getPartnerProfileAnalytics(this.stripDashboardExtras(query));
  }

  /**
   * 获取资源统计摘要（2026-06-24 新增端点）
   *
   * 调用 GET /analytics/{resource}/summary，返回 byCooperationLevel/byTechServiceType/byStatus/timeSeries 等维度。
   * 适用于 partners/registrations/opportunities/quotes/orders。
   */
  private async fetchResourceSummary(
    resource: 'partners' | 'registrations' | 'opportunities' | 'quotes' | 'orders',
    query: LianruanCrmOpenApiAnalyticsQuery,
  ): Promise<LianruanCrmOpenApiResourceSummary> {
    return this.openApiClient.getResourceSummaryAnalytics(resource, query);
  }

  /**
   * 用渠道商主数据补齐贡献统计中的省市字段。
   *
   * 参数说明：`contributions` 为统计接口返回的渠道贡献行，`query` 为本次看板筛选条件。
   * 返回值说明：返回补齐了 `provinceName/cityName` 等字段的贡献行。
   * 调用注意事项：补全失败不阻断看板，只记录错误并继续使用原统计结果。
   */
  private async enrichPartnerContributionLocations(
    contributions: LianruanCrmOpenApiPartnerContributionRecord[],
    query: DashboardAnalyticsQuery,
    errors: string[],
  ): Promise<LianruanCrmOpenApiPartnerContributionRecord[]> {
    if (contributions.length === 0) {
      return contributions;
    }

    try {
      const masterRecords = await this.fetchPartnerMasterRecords(query);
      if (masterRecords.length === 0) {
        return contributions;
      }

      const recordIndex = this.buildPartnerMasterRecordIndex(masterRecords);
      return contributions.map((contribution) => {
        const masterRecord = this.findPartnerMasterRecord(contribution, recordIndex);
        return masterRecord
          ? this.mergePartnerLocationFields(contribution, masterRecord)
          : contribution;
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`partners主数据位置补全: ${reason}`);
      return contributions;
    }
  }

  /**
   * 分页读取渠道商主数据。
   *
   * 参数说明：`query` 为看板筛选条件。
   * 返回值说明：返回当前权限和筛选条件内的渠道商主数据。
   * 调用注意事项：限制最多 5 页，避免看板打开时对 CRM 造成过重压力。
   */
  private async fetchPartnerMasterRecords(
    query: DashboardAnalyticsQuery,
  ): Promise<Array<Record<string, unknown>>> {
    const records: Array<Record<string, unknown>> = [];
    const baseQuery = this.stripDashboardExtras(query);

    for (let pageNo = 1; pageNo <= PARTNER_MASTER_MAX_PAGES; pageNo += 1) {
      const page = await this.openApiClient.listResource<Record<string, unknown>>(
        'partners',
        {
          ...baseQuery,
          pageNo,
          pageSize: PARTNER_MASTER_PAGE_SIZE,
        },
      );
      records.push(...page.items);

      const total = Number(page.total ?? 0);
      if (
        page.items.length === 0 ||
        page.returnedCount < page.pageSize ||
        (total > 0 && records.length >= total)
      ) {
        break;
      }
    }

    return records;
  }

  /**
   * 构造渠道商主数据索引。
   *
   * 参数说明：`records` 为渠道商主数据列表。
   * 返回值说明：返回按 ID 和名称索引的映射。
   */
  private buildPartnerMasterRecordIndex(records: Array<Record<string, unknown>>): {
    byId: Map<string, Record<string, unknown>>;
    byName: Map<string, Record<string, unknown>>;
  } {
    const byId = new Map<string, Record<string, unknown>>();
    const byName = new Map<string, Record<string, unknown>>();

    for (const record of records) {
      for (const idValue of [record.id, record.partnerId, record.partner_id]) {
        const id = this.normalizeLookupKey(this.readText(idValue));
        if (id) {
          byId.set(id, record);
        }
      }

      for (const nameValue of [record.partnerName, record.name, record.displayName, record.shortName, record.partner_name]) {
        const name = this.normalizeLookupKey(this.readText(nameValue));
        if (name) {
          byName.set(name, record);
        }
      }
    }

    return { byId, byName };
  }

  /**
   * 查找贡献行对应的渠道商主数据。
   *
   * 参数说明：`contribution` 为渠道贡献行，`index` 为主数据索引。
   * 返回值说明：命中时返回主数据，否则返回空值。
   */
  private findPartnerMasterRecord(
    contribution: LianruanCrmOpenApiPartnerContributionRecord,
    index: {
      byId: Map<string, Record<string, unknown>>;
      byName: Map<string, Record<string, unknown>>;
    },
  ): Record<string, unknown> | null {
    for (const idValue of [contribution.partnerId, contribution.id, contribution.partner_id]) {
      const id = this.normalizeLookupKey(this.readText(idValue));
      const record = id ? index.byId.get(id) : undefined;
      if (record) {
        return record;
      }
    }

    for (const nameValue of [contribution.partnerName, contribution.name, contribution.partner_name]) {
      const name = this.normalizeLookupKey(this.readText(nameValue));
      const record = name ? index.byName.get(name) : undefined;
      if (record) {
        return record;
      }
    }

    return null;
  }

  /**
   * 合并渠道商位置字段。
   *
   * 参数说明：`contribution` 为统计行，`masterRecord` 为主数据行。
   * 返回值说明：返回保留统计指标并补齐省市字段的新对象。
   */
  private mergePartnerLocationFields(
    contribution: LianruanCrmOpenApiPartnerContributionRecord,
    masterRecord: Record<string, unknown>,
  ): LianruanCrmOpenApiPartnerContributionRecord {
    return {
      ...contribution,
      provinceName: this.firstText([
        contribution.provinceName,
        contribution.province,
        contribution.province_name,
        contribution['所在省份'],
        contribution['所在省'],
        contribution['省份'],
        masterRecord['所在省份'],
        masterRecord['所在省'],
        masterRecord['省份'],
        masterRecord.provinceName,
        masterRecord.province,
        masterRecord.province_name,
        masterRecord.partnerProvinceName,
        masterRecord.partnerProvince,
        masterRecord.partner_province_name,
        masterRecord.partner_province,
      ]),
      cityName: this.firstText([
        contribution.city,
        contribution['所在城市'],
        contribution['城市'],
        contribution['地市'],
        contribution.cityName,
        contribution.city_name,
        masterRecord.city,
        masterRecord['所在城市'],
        masterRecord['城市'],
        masterRecord['地市'],
        masterRecord.cityName,
        masterRecord.city_name,
        masterRecord.partnerCityName,
        masterRecord.partnerCity,
        masterRecord.partner_city_name,
        masterRecord.partner_city,
        masterRecord.prefectureCityName,
        masterRecord.prefectureCity,
        masterRecord.prefecture_city_name,
        masterRecord.prefecture_city,
      ]),
      region: contribution.region ?? this.firstText([masterRecord.region, masterRecord.regionName, masterRecord.region_name]),
      bigRegion: contribution.bigRegion ?? this.firstText([masterRecord.bigRegion, masterRecord.big_region]),
      address: contribution.address ?? this.firstText([
        masterRecord.address,
        masterRecord.registeredAddress,
        masterRecord.registered_address,
        masterRecord.officeAddress,
        masterRecord.office_address,
        masterRecord.regionInfo,
        masterRecord.region_info,
      ]),
    };
  }

  /**
   * 读取第一段非空文本。
   */
  private firstText(values: unknown[]): string | undefined {
    for (const value of values) {
      const text = this.readText(value);
      if (text) {
        return text;
      }
    }
    return undefined;
  }

  /**
   * 读取展示文本。
   */
  private readText(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value).trim()
      : '';
  }

  /**
   * 归一索引键。
   */
  private normalizeLookupKey(value: string): string {
    return value.replace(/\s/gu, '').toLowerCase();
  }

  /**
   * 去掉看板专用参数（limit），只保留联软 AnalyticsQuery 认可的字段
   */
  private stripDashboardExtras(query: DashboardAnalyticsQuery): LianruanCrmOpenApiAnalyticsQuery {
    const { limit: _limit, ...rest } = query;
    return rest;
  }

  /**
   * 从 Promise.allSettled 结果中解析成功值，失败时记录错误
   */
  private resolveSettled<T>(
    result: PromiseSettledResult<T>,
    interfaceName: string,
    errors: string[],
  ): T | null {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    errors.push(`${interfaceName}: ${reason}`);
    return null;
  }
}
