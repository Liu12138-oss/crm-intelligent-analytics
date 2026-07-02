import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { buildEntityId } from '../../shared/utils/id.util';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { SqlAuditContextService } from '../audit/sql-audit-context.service';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { UserScopeService } from '../auth/user-scope.service';
import { ManagementReportComposerService } from './management-report-composer.service';
import { ManagementReportQueryService } from './management-report-query.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import {
  MANAGEMENT_REPORT_DEPARTMENTS,
  type ManagementReportDepartmentDefinition,
} from './management-report.mock-data';
import {
  MANAGEMENT_REPORT_PRESETS,
  MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID,
  MANAGEMENT_REPORT_SECTION_DEFINITIONS,
  type ManagementReportContext,
  type ManagementReportDepartmentNode,
  type ManagementReportExportRequest,
  type ManagementReportFilterInput,
  type ManagementReportNormalizedFilter,
  type ManagementReportOptionsPayload,
  type ManagementReportSectionKey,
  type ManagementReportSectionRequest,
  type ManagementReportSnapshotPayload,
} from './management-report.types';

interface DepartmentCatalog {
  root: ManagementReportDepartmentNode;
  labelMap: Map<string, string>;
  childMap: Map<string, string[]>;
  allowedDepartmentIds: string[];
}

interface CachedSnapshotRecord {
  expiresAt: number;
  snapshot: ManagementReportSnapshotPayload;
}

interface CachedSectionRecord {
  expiresAt: number;
  section: ReturnType<ManagementReportComposerService['composeSection']>;
}

/**
 * 经营报表应用服务统一负责权限、范围、上下文缓存、懒加载保护与导出编排。
 */
@Injectable()
export class ManagementReportService {
  private readonly cacheTtlMs = 5 * 60 * 1000;
  private readonly sectionTimeoutMs = 1200;
  private readonly maxConcurrentSectionLoads = 3;
  private readonly contextCache = new Map<string, ManagementReportContext & { expiresAt: number }>();
  private readonly filterCache = new Map<string, string>();
  private readonly snapshotCache = new Map<string, CachedSnapshotRecord>();
  private readonly sectionCache = new Map<string, CachedSectionRecord>();
  private readonly pendingSectionLoads = new Map<string, Promise<ReturnType<ManagementReportComposerService['composeSection']>>>();

  constructor(
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly userScopeService: UserScopeService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly sqlAuditContextService: SqlAuditContextService,
    private readonly managementReportQueryService: ManagementReportQueryService,
    private readonly managementReportComposerService: ManagementReportComposerService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  /**
   * 返回经营报表初始化选项，参数为当前登录用户，返回部门树、快捷时间和默认筛选值。
   */
  async getOptions(user: any): Promise<ManagementReportOptionsPayload> {
    this.ensureViewAccess(user);
    return this.runWithSqlAuditContext(
      user,
      'ManagementReportService.getOptions',
      async () => {
        const startedAt = Date.now();
        this.cleanupExpiredCaches();

        const departmentCatalog = await this.buildDepartmentCatalog(user);
        const defaultRange = this.resolvePresetDateRange('q1');
        const defaultFilter: ManagementReportOptionsPayload['defaultFilter'] = {
          departmentId: MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID,
          presetKey: 'q1',
          startDate: defaultRange.startDate,
          endDate: defaultRange.endDate,
        };

        const payload = {
          scopeSummary: this.userScopeService.resolveScope(user).scopeSummary,
          presets: MANAGEMENT_REPORT_PRESETS.map((item) => ({ ...item })),
          departments: [departmentCatalog.root],
          defaultFilter,
        };
        this.analysisLoggerService.logStep('经营报表首屏选项已返回。', {
          userId: user.id,
          departmentOptionCount: departmentCatalog.allowedDepartmentIds.length,
          durationMs: Date.now() - startedAt,
        });
        return payload;
      },
    );
  }

  /**
   * 创建或命中经营报表快照，参数为当前用户与筛选入参，返回核心摘要快照。
   */
  async createSnapshot(user: any, filterInput: ManagementReportFilterInput) {
    this.ensureViewAccess(user);
    return this.runWithSqlAuditContext(
      user,
      'ManagementReportService.createSnapshot',
      async () => {
        const startedAt = Date.now();
        this.cleanupExpiredCaches();

        const departmentCatalog = await this.buildDepartmentCatalog(user);
        const normalizedFilter = this.normalizeFilter(user, filterInput, departmentCatalog);
        const context = this.getOrCreateContext(user, normalizedFilter);
        const cachedSnapshot = this.snapshotCache.get(context.reportId);

        if (cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
          this.auditViewed(user, context);
          this.analysisLoggerService.logStep('经营报表首屏快照命中缓存。', {
            userId: user.id,
            reportId: context.reportId,
            departmentId: context.filter.departmentId,
            durationMs: Date.now() - startedAt,
          });
          return cachedSnapshot.snapshot;
        }

        await this.managementReportQueryService.prepareContextData(context);
        const snapshot = this.managementReportComposerService.composeSnapshot(context);
        this.snapshotCache.set(context.reportId, {
          expiresAt: Date.now() + this.cacheTtlMs,
          snapshot,
        });
        this.auditViewed(user, context);
        this.analysisLoggerService.logStep('经营报表首屏快照已生成。', {
          userId: user.id,
          reportId: context.reportId,
          departmentId: context.filter.departmentId,
          sectionCount: snapshot.sections.length,
          durationMs: Date.now() - startedAt,
        });
        return snapshot;
      },
    );
  }

  /**
   * 按专题键返回懒加载详情，参数为当前用户、专题键与 reportId / filter。
   */
  async getSectionDetail(
    user: any,
    sectionKey: ManagementReportSectionKey,
    payload: ManagementReportSectionRequest,
  ) {
    this.ensureViewAccess(user);
    return this.runWithSqlAuditContext(
      user,
      'ManagementReportService.getSectionDetail',
      async () => {
        this.cleanupExpiredCaches();
        const context = await this.resolveContext(user, payload);
        return this.loadSection(context, sectionKey);
      },
    );
  }

  /**
   * 导出当前报表上下文，参数为当前用户与 reportId / filter，返回 CSV 文本负载。
   */
  async exportReport(user: any, payload: ManagementReportExportRequest) {
    this.ensureExportAccess(user);
    return this.runWithSqlAuditContext(
      user,
      'ManagementReportService.exportReport',
      async () => {
        this.cleanupExpiredCaches();
        const context = await this.resolveContext(user, payload);
        const snapshot = await this.createSnapshot(user, context.filter);
        const sections = await Promise.all(
          MANAGEMENT_REPORT_SECTION_DEFINITIONS.filter((item) => item.available).map(
            async (item) => this.loadSection(context, item.sectionKey),
          ),
        );
        const exportPayload = this.managementReportComposerService.composeExport(
          snapshot,
          sections,
        );

        this.auditEventRepository.create({
          id: buildEntityId('audit'),
          eventType: 'MANAGEMENT_REPORT_EXPORTED',
          actorId: user.id,
          actorRoleIds: user.roleIds,
          resourceType: 'management-report',
          resourceId: context.reportId,
          scopeSnapshot: this.userScopeService.resolveScope(user),
          sessionSnapshot: {
            reportId: context.reportId,
            departmentId: context.filter.departmentId,
            startDate: context.filter.startDate,
            endDate: context.filter.endDate,
            format: exportPayload.format,
          },
          riskLevel: 'LOW',
          reviewStatus: 'CONFIRMED',
          outcome: '经营报表导出成功。',
          createdAt: new Date().toISOString(),
        });

        return exportPayload;
      },
    );
  }

  /**
   * 确保当前用户具备菜单与查看动作权限。
   */
  private ensureViewAccess(user: any): void {
    this.permissionEnforcementService.ensureVisibleMenu(
      user,
      'management-report',
      '当前用户无权访问经营报表页面。',
      {
        resourceType: 'management-report',
      },
    );
    this.permissionEnforcementService.ensureAction(
      user,
      'management.report.view',
      '当前用户无权查看经营报表。',
      {
        resourceType: 'management-report',
      },
    );
  }

  /**
   * 确保当前用户具备导出动作权限。
   */
  private ensureExportAccess(user: any): void {
    this.ensureViewAccess(user);
    this.permissionEnforcementService.ensureAction(
      user,
      'management.report.export',
      '当前用户无权导出经营报表。',
      {
        resourceType: 'management-report',
      },
    );
  }

  /**
   * 根据请求载荷解析经营报表上下文，优先使用 reportId 命中缓存，必要时回退到筛选参数重建。
   */
  private async resolveContext(
    user: any,
    payload: { reportId?: string; filter?: ManagementReportFilterInput },
  ) {
    if (payload.reportId?.trim()) {
      const cachedContext = this.contextCache.get(payload.reportId.trim());
      if (cachedContext && cachedContext.expiresAt > Date.now()) {
        return cachedContext;
      }
    }

    if (!payload.filter) {
      throw new BadRequestException('请先提供经营报表上下文或筛选条件。');
    }

    const departmentCatalog = await this.buildDepartmentCatalog(user);
    const normalizedFilter = this.normalizeFilter(user, payload.filter, departmentCatalog);
    return this.getOrCreateContext(user, normalizedFilter);
  }

  /**
   * 创建或命中过滤条件对应的缓存上下文，避免同一筛选条件重复生成不同 reportId。
   */
  private getOrCreateContext(
    user: any,
    normalizedFilter: ManagementReportNormalizedFilter,
  ) {
    const filterKey = this.buildFilterKey(user.id, normalizedFilter);
    const cachedReportId = this.filterCache.get(filterKey);
    if (cachedReportId) {
      const cachedContext = this.contextCache.get(cachedReportId);
      if (cachedContext && cachedContext.expiresAt > Date.now()) {
        return cachedContext;
      }
    }

    const scope = this.userScopeService.resolveScope(user);
    const context: ManagementReportContext & { expiresAt: number } = {
      reportId: buildEntityId('management_report'),
      userId: user.id,
      roleNames: [...user.roleNames],
      scopeSummary: scope.scopeSummary,
      organizationIds: [...(scope.organizationIds ?? user.organizationIds ?? [])],
      ownerIds: [...(scope.ownerIds ?? [])],
      scopeSource: scope.scopeSource,
      isFullAccess: scope.isFullAccess,
      generatedAt: new Date().toISOString(),
      filter: normalizedFilter,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    this.contextCache.set(context.reportId, context);
    this.filterCache.set(filterKey, context.reportId);
    return context;
  }

  /**
   * 规范化筛选参数并执行部门越权阻断。
   */
  private normalizeFilter(
    user: any,
    filterInput: ManagementReportFilterInput,
    departmentCatalog: DepartmentCatalog,
  ): ManagementReportNormalizedFilter {
    const presetKey = (filterInput.presetKey ?? 'q1') as ManagementReportNormalizedFilter['presetKey'];
    const dateRange = this.resolvePresetDateRange(
      presetKey,
      filterInput.startDate,
      filterInput.endDate,
    );
    const targetDepartmentId =
      filterInput.departmentId?.trim() || MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID;

    if (
      targetDepartmentId !== MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID &&
      !departmentCatalog.allowedDepartmentIds.includes(targetDepartmentId)
    ) {
      this.auditScopeBlocked(user, targetDepartmentId, dateRange.startDate, dateRange.endDate);
      throw new ForbiddenException(
        '你当前只能查看自己权限范围内的经营报表。请切换到已授权范围，或联系管理员调整权限后再试。',
      );
    }

    const includedDepartmentIds =
      targetDepartmentId === MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID
        ? [...departmentCatalog.allowedDepartmentIds]
        : this.expandDepartmentIds(targetDepartmentId, departmentCatalog.childMap).filter((item) =>
            departmentCatalog.allowedDepartmentIds.includes(item),
          );

    if (includedDepartmentIds.length === 0) {
      this.auditScopeBlocked(user, targetDepartmentId, dateRange.startDate, dateRange.endDate);
      throw new ForbiddenException(
        '当前筛选范围内暂时没有可统计数据。请切换其它授权范围，或稍后重试。',
      );
    }

    return {
      departmentId: targetDepartmentId,
      departmentLabel:
        targetDepartmentId === MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID
          ? '全公司'
          : departmentCatalog.labelMap.get(targetDepartmentId) ?? targetDepartmentId,
      presetKey,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      includedDepartmentIds,
    };
  }

  /**
   * 构造部门目录与允许范围，优先复用 CRM 只读服务的部门选项，缺失时回退到本地定义。
   */
  private async buildDepartmentCatalog(user: any): Promise<DepartmentCatalog> {
    const scope = this.userScopeService.resolveScope(user);
    const departmentOptions = await this.crmReadonlyService.listAccessGovernanceDepartments(user);
    const fallbackDefinitions = MANAGEMENT_REPORT_DEPARTMENTS;
    const definitionMap = new Map<string, ManagementReportDepartmentDefinition>();

    for (const definition of fallbackDefinitions) {
      definitionMap.set(definition.id, definition);
    }

    for (const option of departmentOptions) {
      const current = definitionMap.get(option.value);
      definitionMap.set(option.value, {
        id: option.value,
        label: option.label,
        parentId: option.parentDepartmentId ?? current?.parentId,
      });
    }

    const allDefinitions = Array.from(definitionMap.values());
    const childMap = this.buildChildMap(allDefinitions);
    const allowedBaseIds = user.isAdmin
      ? allDefinitions.map((item) => item.id)
      : scope.departmentIds.length > 0
        ? [...scope.departmentIds]
        : user.departmentIds.length > 0
          ? [...user.departmentIds]
          : allDefinitions.map((item) => item.id);
    const allowedDepartmentIds = Array.from(
      new Set(
        allowedBaseIds.flatMap((item) =>
          this.expandDepartmentIds(item, childMap),
        ),
      ),
    ).filter((item) => definitionMap.has(item));
    const labelMap = new Map<string, string>();

    for (const definition of allDefinitions) {
      labelMap.set(definition.id, definition.label);
    }

    const tree = this.buildDepartmentTree(
      MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID,
      allDefinitions,
      allowedDepartmentIds,
    );

    return {
      root: {
        id: MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID,
        label: '全公司',
        selectable: true,
        children: tree,
      },
      labelMap,
      childMap,
      allowedDepartmentIds,
    };
  }

  /**
   * 把平铺部门定义构造成树结构，只保留当前允许范围内的节点。
   */
  private buildDepartmentTree(
    parentId: string,
    definitions: ManagementReportDepartmentDefinition[],
    allowedDepartmentIds: string[],
  ): ManagementReportDepartmentNode[] {
    const childDefinitions = definitions.filter((item) =>
      (item.parentId ?? MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID) === parentId &&
      allowedDepartmentIds.includes(item.id),
    );

    return childDefinitions.map((item) => ({
      id: item.id,
      label: item.label,
      parentId: item.parentId,
      selectable: true,
      children: this.buildDepartmentTree(item.id, definitions, allowedDepartmentIds),
    }));
  }

  /**
   * 基于平铺部门定义构造 parent -> children 索引，供递归扩展子部门使用。
   */
  private buildChildMap(definitions: ManagementReportDepartmentDefinition[]) {
    const childMap = new Map<string, string[]>();
    for (const definition of definitions) {
      const parentId = definition.parentId ?? MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID;
      childMap.set(parentId, [...(childMap.get(parentId) ?? []), definition.id]);
    }
    return childMap;
  }

  /**
   * 递归展开某个部门节点的全部子部门，确保“默认包含子部门”的规则稳定生效。
   */
  private expandDepartmentIds(
    departmentId: string,
    childMap: Map<string, string[]>,
  ): string[] {
    const visited = new Set<string>();
    const queue = [departmentId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);
      for (const childId of childMap.get(current) ?? []) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }

    return [...visited];
  }

  /**
   * 解析快捷时间或自定义时间范围，并统一输出 YYYY-MM-DD。
   */
  private resolvePresetDateRange(
    presetKey: ManagementReportNormalizedFilter['presetKey'],
    rawStartDate?: string,
    rawEndDate?: string,
  ) {
    if (presetKey === 'custom') {
      const startDate = rawStartDate?.trim();
      const endDate = rawEndDate?.trim();
      if (!startDate || !endDate) {
        throw new BadRequestException('自定义时间范围必须同时提供开始日期和结束日期。');
      }
      if (startDate > endDate) {
        throw new BadRequestException('开始日期不能晚于结束日期。');
      }
      return { startDate, endDate };
    }

    const referenceDate = new Date();
    const year = referenceDate.getUTCFullYear();
    const month = referenceDate.getUTCMonth() + 1;

    if (presetKey === 'q1') {
      return { startDate: `${year}-01-01`, endDate: `${year}-03-31` };
    }
    if (presetKey === 'q2') {
      return { startDate: `${year}-04-01`, endDate: `${year}-06-30` };
    }
    if (presetKey === 'q3') {
      return { startDate: `${year}-07-01`, endDate: `${year}-09-30` };
    }
    if (presetKey === 'q4') {
      return { startDate: `${year}-10-01`, endDate: `${year}-12-31` };
    }
    if (presetKey === 'this-year') {
      return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
    }
    if (presetKey === 'this-month') {
      const paddedMonth = String(month).padStart(2, '0');
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return {
        startDate: `${year}-${paddedMonth}-01`,
        endDate: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    if (presetKey === 'last-30-days') {
      return this.buildRelativeDateRange(29);
    }
    return this.buildRelativeDateRange(89);
  }

  /**
   * 构造近 N 天的日期范围。
   */
  private buildRelativeDateRange(offsetDays: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setUTCDate(endDate.getUTCDate() - offsetDays);

    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    };
  }

  /**
   * 基于报表上下文与专题键加载专题详情，并补齐缓存、并发限制和超时退化。
   */
  private async loadSection(
    context: ManagementReportContext & { expiresAt?: number },
    sectionKey: ManagementReportSectionKey,
  ) {
    const definition = MANAGEMENT_REPORT_SECTION_DEFINITIONS.find(
      (item) => item.sectionKey === sectionKey,
    );
    if (!definition) {
      throw new BadRequestException(`未知专题：${sectionKey}`);
    }

    if (!definition.available) {
      await this.managementReportQueryService.prepareContextData(context);
      return this.managementReportComposerService.composeSection(context, sectionKey);
    }

    const cacheKey = `${context.reportId}:${sectionKey}`;
    const cachedSection = this.sectionCache.get(cacheKey);
    if (cachedSection && cachedSection.expiresAt > Date.now()) {
      return cachedSection.section;
    }

    try {
      await this.managementReportQueryService.prepareContextData(context);
    } catch (error) {
      return this.buildDegradedSectionPayload(
        context,
        sectionKey,
        error instanceof Error ? error.message : '专题基础数据准备失败，已临时降级。',
      );
    }

    const pendingKeys = Array.from(this.pendingSectionLoads.keys()).filter((item) =>
      item.startsWith(`${context.reportId}:`),
    );
    if (
      pendingKeys.length >= this.maxConcurrentSectionLoads &&
      !this.pendingSectionLoads.has(cacheKey)
    ) {
      return this.buildDegradedSectionPayload(
        context,
        sectionKey,
        '当前专题请求过多，系统已临时降级，请稍后重试。',
      );
    }

    const currentPending = this.pendingSectionLoads.get(cacheKey);
    if (currentPending) {
      return currentPending;
    }

    const loadingPromise = this.withTimeout(
      Promise.resolve().then(() =>
        this.managementReportComposerService.composeSection(context, sectionKey),
      ),
      this.sectionTimeoutMs,
    );
    this.pendingSectionLoads.set(cacheKey, loadingPromise);

    try {
      const section = await loadingPromise;
      this.sectionCache.set(cacheKey, {
        expiresAt: Date.now() + this.cacheTtlMs,
        section,
      });
      return section;
    } catch (error) {
      return this.buildDegradedSectionPayload(
        context,
        sectionKey,
        error instanceof Error ? error.message : '专题查询失败，已临时降级。',
      );
    } finally {
      this.pendingSectionLoads.delete(cacheKey);
    }
  }

  /**
   * 为专题加载增加受控超时，超时后回退到退化结果而不是拖垮整页。
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(new Error('专题查询超时'));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : '专题查询失败',
      );
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * 为超时或并发受限的专题构造降级结果，保证单专题失败不会拖垮整页。
   */
  private buildDegradedSectionPayload(
    context: ManagementReportContext,
    sectionKey: ManagementReportSectionKey,
    reason: string,
  ) {
    const definition = MANAGEMENT_REPORT_SECTION_DEFINITIONS.find(
      (item) => item.sectionKey === sectionKey,
    );

    return {
      reportId: context.reportId,
      sectionKey,
      generatedAt: context.generatedAt,
      timeBasis: definition?.timeBasis ?? '当前专题时间口径未配置。',
      scopeBasis: context.scopeSummary,
      section: {
        sectionKey,
        title: definition?.title ?? sectionKey,
        summary: definition?.summary ?? '当前专题暂不可用。',
        state: 'degraded' as const,
        blocks: [
          {
            blockId: `${sectionKey}-degraded`,
            blockType: 'insight-table' as const,
            title: '专题已降级',
            size: 'wide' as const,
            rows: [
              {
                label: '当前状态',
                value: reason,
              },
            ],
          },
        ],
        footnotes: ['当前结果为局部降级态，可稍后重试专题加载。'],
        emptyReason: reason,
      },
    };
  }

  /**
   * 记录经营报表查看审计，确保查看与导出拥有独立事件。
   */
  private auditViewed(user: any, context: ManagementReportContext): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'MANAGEMENT_REPORT_VIEWED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      resourceType: 'management-report',
      resourceId: context.reportId,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        departmentId: context.filter.departmentId,
        startDate: context.filter.startDate,
        endDate: context.filter.endDate,
        generatedAt: context.generatedAt,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '经营报表已生成快照。',
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 记录部门越权阻断审计，便于排查用户是否传入了超出授权范围的部门。
   */
  private auditScopeBlocked(
    user: any,
    departmentId: string,
    startDate: string,
    endDate: string,
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'MANAGEMENT_REPORT_SCOPE_BLOCKED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      resourceType: 'management-report',
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        departmentId,
        startDate,
        endDate,
      },
      riskLevel: 'MEDIUM',
      reviewStatus: 'CONFIRMED',
      outcome: '经营报表部门范围已阻断。',
      failureReason: `当前部门 ${departmentId} 不在经营报表授权范围内。`,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 构造筛选缓存键，保证同一用户同一筛选条件命中同一 reportId。
   */
  private buildFilterKey(userId: string, filter: ManagementReportNormalizedFilter): string {
    return [
      userId,
      filter.departmentId,
      filter.startDate,
      filter.endDate,
      filter.presetKey,
      filter.includedDepartmentIds.join('|'),
    ].join('::');
  }

  /**
   * 清理过期缓存，避免长时间堆积过期上下文和专题详情。
   */
  private cleanupExpiredCaches(): void {
    const now = Date.now();

    for (const [cacheKey, value] of this.contextCache.entries()) {
      if (value.expiresAt <= now) {
        this.contextCache.delete(cacheKey);
      }
    }

    for (const [cacheKey, value] of this.snapshotCache.entries()) {
      if (value.expiresAt <= now) {
        this.snapshotCache.delete(cacheKey);
      }
    }

    for (const [cacheKey, value] of this.sectionCache.entries()) {
      if (value.expiresAt <= now) {
        this.sectionCache.delete(cacheKey);
      }
    }
  }

  /**
   * 为经营报表链路注入统一 SQL 审计上下文，避免部门树、快照与懒加载查询丢失责任人。
   */
  private runWithSqlAuditContext<T>(
    user: any,
    programName: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    return this.sqlAuditContextService.run(
      {
        actorId: user.id,
        actorRoleIds: user.roleIds ?? [],
        channel: 'web-console',
        requestId: buildEntityId('management_report_request'),
        moduleKey: 'management-report',
        programName,
      },
      handler,
    );
  }
}
