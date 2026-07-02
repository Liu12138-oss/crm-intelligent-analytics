import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  QueryTemplateRecord,
  TemplateScopeGovernanceSnapshot,
} from '../../shared/types/domain';

const LEGACY_QUERY_TEMPLATE_SQL_VERSION = '2026.05.28-legacy-left-join';
const LEGACY_QUERY_TEMPLATE_PATCHES: Record<
  string,
  Pick<
    QueryTemplateRecord,
    | 'defaultQuestionText'
    | 'defaultFilters'
    | 'defaultViewType'
    | 'queryMode'
    | 'sqlText'
    | 'sqlVersion'
    | 'parameterSchema'
    | 'renderConfig'
    | 'description'
  >
> = {
  tpl_quarter_health: {
    description: '按团队查看当前季度新增商机金额、数量与赢单率。',
    defaultQuestionText: '本季度各区域新增商机金额、赢单率和环比变化',
    defaultFilters: {
      timeRange: '本季度',
      metricScope: 'quarter_health_overview',
      groupBy: 'team',
    },
    defaultViewType: 'BAR_CHART',
    queryMode: 'FIXED_SQL',
    sqlText: `SELECT
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE d.name
  END AS team_name,
  COUNT(DISTINCT o.id) AS opportunity_count,
  ROUND(SUM(COALESCE(o.expect_amount, 0)) / 10000, 2) AS opportunity_amount,
  ROUND(
    SUM(CASE WHEN fv_stage.VALUE = '赢单' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT o.id), 0) * 100,
    2
  ) AS win_rate
FROM opportunities o
LEFT JOIN customers cu ON o.customer_id = cu.id
LEFT JOIN departments d ON o.department_id = d.id
LEFT JOIN field_values fv_stage ON fv_stage.id = o.stage
WHERE YEAR(o.created_at) = YEAR(CURDATE())
  AND QUARTER(o.created_at) = QUARTER(CURDATE())
  AND o.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
  AND COALESCE(o.pending_step, 0) = 0
  AND (o.submit_applying_at IS NULL OR o.finish_approve_at IS NOT NULL)
GROUP BY
  CASE
    WHEN d.name LIKE '金融系统部%' THEN SUBSTRING(d.name, 1, 8)
    WHEN d.name LIKE '西区%' THEN SUBSTRING(d.name, 1, 2)
    WHEN LOCATE('-', d.name, LOCATE('-', d.name) + 1) > 0 THEN CONCAT(
      SUBSTRING(d.name, 1, LOCATE('-', d.name) - 1),
      '-',
      SUBSTRING(
        d.name,
        LOCATE('-', d.name) + 1,
        LOCATE('-', d.name, LOCATE('-', d.name) + 1) - LOCATE('-', d.name) - 1
      )
    )
    ELSE d.name
  END
ORDER BY opportunity_amount DESC, opportunity_count DESC
LIMIT 20`,
    sqlVersion: LEGACY_QUERY_TEMPLATE_SQL_VERSION,
    parameterSchema: [],
    renderConfig: {
      primaryViewType: 'BAR_CHART',
      primaryTitle: '季度商机健康度总览',
      chartDimensionKey: 'team_name',
      chartMetricKey: 'opportunity_amount',
      tableColumns: [
        { key: 'team_name', label: '团队', width: 180 },
        { key: 'opportunity_count', label: '新增商机数', width: 140 },
        { key: 'opportunity_amount', label: '新增商机金额（万元）', width: 180 },
        { key: 'win_rate', label: '赢单率（%）', width: 140 },
      ],
      metricFields: [
        { key: 'opportunity_amount', label: '新增商机金额' },
        { key: 'opportunity_count', label: '新增商机数' },
      ],
      moduleHeight: 420,
    },
  },
  tpl_owner_ranking: {
    description: '按负责人查看本月新增商机金额与数量排名。',
    defaultQuestionText: '本月各销售负责人新增商机金额排名',
    defaultFilters: {
      timeRange: '本月',
      metricScope: 'owner_new_opportunity_ranking',
      groupBy: 'owner',
    },
    defaultViewType: 'RANKING_TABLE',
    queryMode: 'FIXED_SQL',
    sqlText: `SELECT
  u.name AS owner_name,
  COUNT(DISTINCT o.id) AS opportunity_count,
  ROUND(SUM(COALESCE(o.expect_amount, 0)) / 10000, 2) AS opportunity_amount
FROM opportunities o
LEFT JOIN users u ON u.id = o.user_id
WHERE DATE_FORMAT(o.created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
  AND o.organization_id IN (:scopeOrganizationIds)
  AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
  AND COALESCE(o.pending_step, 0) = 0
  AND (o.submit_applying_at IS NULL OR o.finish_approve_at IS NOT NULL)
GROUP BY o.user_id, u.name
ORDER BY opportunity_amount DESC, opportunity_count DESC
LIMIT 20`,
    sqlVersion: LEGACY_QUERY_TEMPLATE_SQL_VERSION,
    parameterSchema: [],
    renderConfig: {
      primaryViewType: 'RANKING_TABLE',
      primaryTitle: '负责人新增商机排名',
      chartDimensionKey: 'owner_name',
      chartMetricKey: 'opportunity_amount',
      tableColumns: [
        { key: 'owner_name', label: '负责人', width: 160 },
        { key: 'opportunity_amount', label: '新增商机金额（万元）', width: 180 },
        { key: 'opportunity_count', label: '新增商机数', width: 140 },
      ],
      metricFields: [
        { key: 'opportunity_amount', label: '新增商机金额' },
        { key: 'opportunity_count', label: '新增商机数' },
      ],
      moduleHeight: 420,
    },
  },
};

@Injectable()
export class QueryTemplateRepository {
  constructor(private readonly appStorage: AppStorageService) {}

  listAll(): QueryTemplateRecord[] {
    return this.appStorage.state.queryTemplates
      .map((item) => this.normalizeTemplateRecord(item))
      .sort(
      (left, right) => left.displayOrder - right.displayOrder,
    );
  }

  findById(templateId: string): QueryTemplateRecord | undefined {
    const matchedTemplate = this.appStorage.state.queryTemplates.find(
      (item) => item.id === templateId,
    );
    return matchedTemplate ? this.normalizeTemplateRecord(matchedTemplate) : undefined;
  }

  save(template: QueryTemplateRecord): QueryTemplateRecord {
    const normalizedTemplate = this.normalizeTemplateRecord(template);
    const currentIndex = this.appStorage.state.queryTemplates.findIndex(
      (item) => item.id === normalizedTemplate.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.queryTemplates[currentIndex] = normalizedTemplate;
      this.persistIfSupported();
      return normalizedTemplate;
    }

    this.appStorage.state.queryTemplates.push(normalizedTemplate);
    this.persistIfSupported();
    return normalizedTemplate;
  }

  remove(templateId: string): boolean {
    const currentIndex = this.appStorage.state.queryTemplates.findIndex(
      (item) => item.id === templateId,
    );

    if (currentIndex < 0) {
      return false;
    }

    this.appStorage.state.queryTemplates.splice(currentIndex, 1);
    this.persistIfSupported();
    return true;
  }

  incrementUsage(templateId: string, usedAt: string): QueryTemplateRecord | undefined {
    const currentTemplate = this.findById(templateId);
    if (!currentTemplate) {
      return undefined;
    }

    return this.save({
      ...currentTemplate,
      clickCount7d: currentTemplate.clickCount7d + 1,
      usageCountTotal: (currentTemplate.usageCountTotal ?? 0) + 1,
      lastUsedAt: usedAt,
      updatedAt: currentTemplate.updatedAt,
    });
  }

  /**
   * 兼容旧版 `.runtime/app-storage.json` 中只包含基础模板字段的记录。
   *
   * 设计原因：
   * 1. 新版模板执行和展示链路依赖 `queryMode`、`renderConfig` 等扩展字段；
   * 2. 生产机上已有持久化模板记录时，`AppStorageState` 的浅合并会直接保留旧数组结构；
   * 3. 若不在仓储层统一补齐默认值，管理员登录读取 capability 就会因缺字段直接 500。
   */
  private normalizeTemplateRecord(template: Partial<QueryTemplateRecord>): QueryTemplateRecord {
    const migratedTemplate = this.applyLegacyTemplatePatch(template);
    const defaultPrimaryViewType = this.resolvePrimaryViewType(
      migratedTemplate.defaultViewType,
    );
    const normalizedName = migratedTemplate.name?.trim() || '未命名模板';
    const normalizedDescription =
      migratedTemplate.description?.trim() || '历史模板兼容记录';
    const normalizedQuestionText =
      migratedTemplate.defaultQuestionText?.trim() || normalizedName;
    const normalizedSqlText = (
      migratedTemplate.sqlText ?? 'SELECT 1 AS placeholder_value'
    ).trim();

    const scopeGovernanceSnapshot =
      migratedTemplate.scopeGovernanceSnapshot ??
      this.buildDefaultScopeGovernanceSnapshot(
        normalizedSqlText,
        migratedTemplate.updatedAt,
      );
    const validationSnapshot = migratedTemplate.validationSnapshot ?? {
      status: 'PASSED' as const,
      message: '历史模板已补齐范围治理默认校验结果，建议在治理后台重新校验。',
      scopeAnalysis: scopeGovernanceSnapshot,
    };

    return {
      id: String(migratedTemplate.id ?? ''),
      name: normalizedName,
      description: normalizedDescription,
      tags: this.normalizeTags(migratedTemplate.tags),
      defaultQuestionText: normalizedQuestionText,
      defaultFilters: migratedTemplate.defaultFilters ?? {},
      defaultViewType: migratedTemplate.defaultViewType,
      queryMode: migratedTemplate.queryMode ?? 'FIXED_SQL',
      sqlText: normalizedSqlText,
      sqlVersion: migratedTemplate.sqlVersion ?? 'legacy-runtime-migrated',
      sourceType: migratedTemplate.sourceType ?? 'LEGACY_MIGRATED',
      sourceQueryId: migratedTemplate.sourceQueryId,
      sourceTemplateId: migratedTemplate.sourceTemplateId,
      sourceSnapshot: migratedTemplate.sourceSnapshot,
      scopeMode:
        migratedTemplate.scopeMode ??
        this.inferScopeMode(normalizedSqlText),
      scopeGovernanceSnapshot,
      parameterSchema: migratedTemplate.parameterSchema ?? [],
      renderConfig: migratedTemplate.renderConfig ?? {
        primaryViewType: defaultPrimaryViewType,
        primaryTitle: normalizedName,
      },
      visibleRoleIds: migratedTemplate.visibleRoleIds ?? [],
      ownerUserId: migratedTemplate.ownerUserId ?? migratedTemplate.ownedBy ?? 'system',
      visibilityType: migratedTemplate.visibilityType ?? 'SHARED',
      displayOrder: migratedTemplate.displayOrder ?? 99,
      clickCount7d: migratedTemplate.clickCount7d ?? 0,
      usageCountTotal:
        migratedTemplate.usageCountTotal ?? migratedTemplate.clickCount7d ?? 0,
      lastUsedAt: migratedTemplate.lastUsedAt,
      hitRatePercent: migratedTemplate.hitRatePercent ?? 0,
      optimizationStatus: migratedTemplate.optimizationStatus ?? 'HEALTHY',
      status: (migratedTemplate.status as QueryTemplateRecord['status']) ?? 'ACTIVE',
      ownedBy: migratedTemplate.ownedBy ?? 'system',
      updatedAt: migratedTemplate.updatedAt ?? new Date().toISOString(),
      validationSnapshot:
        validationSnapshot.scopeAnalysis
          ? validationSnapshot
          : {
              ...validationSnapshot,
              scopeAnalysis: scopeGovernanceSnapshot,
            },
      lastValidatedAt: migratedTemplate.lastValidatedAt,
    };
  }

  private normalizeTags(tags: unknown): string[] {
    if (!Array.isArray(tags)) {
      return [];
    }

    return Array.from(
      new Set(
        tags
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0),
      ),
    );
  }

  private persistIfSupported(): void {
    const maybeStorage = this.appStorage as AppStorageService & { persist?: () => void };
    if (typeof maybeStorage.persist === 'function') {
      maybeStorage.persist();
    }
  }

  /**
   * 将历史内置模板补齐为真实 SQL 定义，避免治理页继续展示 placeholder。
   *
   * 设计原因：
   * 1. 线上 `.runtime` 里仍保留了早期未带 SQL 的模板记录；
   * 2. 这些模板进入当前治理页时会被补成 `SELECT 1 AS placeholder_value`，无法使用；
   * 3. 这里只在“无 SQL / placeholder / 无版本号”的遗留状态下迁移，避免覆盖后续人工维护过的模板。
   */
  private applyLegacyTemplatePatch(
    template: Partial<QueryTemplateRecord>,
  ): Partial<QueryTemplateRecord> {
    const templateId = String(template.id ?? '');
    const patch = LEGACY_QUERY_TEMPLATE_PATCHES[templateId];
    if (!patch) {
      return template;
    }

    const normalizedSql = template.sqlText?.trim();
    const shouldPatch =
      !normalizedSql ||
      normalizedSql === 'SELECT 1 AS placeholder_value' ||
      template.sqlVersion !== LEGACY_QUERY_TEMPLATE_SQL_VERSION;
    if (!shouldPatch) {
      return template;
    }

    return {
      ...template,
      description: patch.description,
      defaultQuestionText: patch.defaultQuestionText,
      defaultFilters: patch.defaultFilters,
      defaultViewType: patch.defaultViewType,
      queryMode: patch.queryMode,
      sqlText: patch.sqlText,
      sqlVersion: patch.sqlVersion,
      parameterSchema: patch.parameterSchema,
      renderConfig: patch.renderConfig,
    };
  }

  private resolvePrimaryViewType(
    defaultViewType: QueryTemplateRecord['defaultViewType'],
  ): QueryTemplateRecord['renderConfig']['primaryViewType'] {
    if (defaultViewType === 'BAR_CHART') {
      return 'BAR_CHART';
    }
    if (defaultViewType === 'LINE_CHART') {
      return 'LINE_CHART';
    }
    if (defaultViewType === 'RANKING_TABLE') {
      return 'RANKING_TABLE';
    }
    if (defaultViewType === 'DETAIL_TABLE') {
      return 'TABLE';
    }

    return 'TABLE';
  }

  private inferScopeMode(sqlText: string): QueryTemplateRecord['scopeMode'] {
    return /\b(?:organization_id|department_id|user_id)\b/iu.test(sqlText)
      ? 'DECLARED_SCOPE'
      : 'AUTO_SCOPE';
  }

  /**
   * 为历史模板补齐轻量范围治理快照。
   * 参数：模板 SQL 与更新时间。
   * 返回：不重复保存原始 SQL 的治理摘要。
   * 设计原因：旧 `.runtime` 中没有治理字段，必须显式标记待校验，避免被误认作已审核安全模板。
   */
  private buildDefaultScopeGovernanceSnapshot(
    sqlText: string,
    updatedAt?: string,
  ): TemplateScopeGovernanceSnapshot {
    const hasScopeFields = /\b(?:organization_id|department_id|user_id)\b/iu.test(sqlText);
    const hasStaticTeamList = /UNION\s+ALL\s+SELECT\s+'[^']+'/iu.test(sqlText);
    const scopeClassification = hasStaticTeamList
      ? 'COMPLEX_REVIEW_REQUIRED'
      : hasScopeFields
        ? 'DECLARED_DYNAMIC_SCOPE'
        : 'AUTO_SCOPABLE';
    const reviewStatus =
      scopeClassification === 'COMPLEX_REVIEW_REQUIRED'
        ? 'REVIEW_REQUIRED'
        : 'PENDING_VALIDATION';

    return {
      scopeMode: hasScopeFields ? 'DECLARED_SCOPE' : 'AUTO_SCOPE',
      scopeClassification,
      reviewStatus,
      detectedScopeFields: hasScopeFields ? ['organization_id'] : [],
      primaryDataSources: [],
      scopePredicateSources: [],
      displayDimensionSources: [],
      staticDimensionSources: hasStaticTeamList
        ? [
            {
              sourceType: 'UNION_TEAM_LIST',
              values: [],
              detail: '历史模板可能包含静态团队清单，需重新校验。',
            },
          ]
        : [],
      riskFindings: hasStaticTeamList
        ? [
            {
              code: 'STATIC_TEAM_LIST',
              severity: 'HIGH',
              title: '存在静态团队清单',
              description: '历史模板可能内置固定团队目标或团队枚举。',
              suggestion: '请在治理后台重新校验并补充审核说明。',
            },
          ]
        : [],
      friendlyMessage:
        scopeClassification === 'AUTO_SCOPABLE'
          ? '历史模板未检测到显式范围条件，系统将在执行时按当前用户权限自动收口。'
          : '历史模板已补齐范围治理默认快照，建议在治理后台重新校验。',
      fixSuggestions: ['请在治理后台重新校验模板 SQL，确认权限主表和展示口径。'],
      generatedAt: updatedAt ?? new Date().toISOString(),
      governanceVersion: '2026.05.19-template-scope-governance',
    };
  }
}
