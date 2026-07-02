import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { buildEntityId } from '../../shared/utils/id.util';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { AnalysisRequestRepository } from '../analysis/analysis-request.repository';
import { AuditEventRepository } from './audit-event.repository';
import { SqlAuditContextService } from './sql-audit-context.service';
import { SqlAuditRepository } from './sql-audit.repository';
import { SqlAuditService } from './sql-audit.service';

type AuthenticatedRequest = Request & {
  crmUser: any;
};

@Controller('audit-events/sql')
@UseGuards(SessionAuthGuard)
export class SqlAuditController {
  constructor(
    private readonly sqlAuditRepository: SqlAuditRepository,
    private readonly sqlAuditService: SqlAuditService,
    private readonly sqlAuditContextService: SqlAuditContextService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly analysisRequestRepository: AnalysisRequestRepository,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly crmReadonlyService: CrmReadonlyService,
  ) {}

  @Get('summary')
  async getSummary(
    @Req() request: AuthenticatedRequest,
    @Query('actorId') actorId?: string,
    @Query('moduleKey') moduleKey?: string,
    @Query('databaseRole') databaseRole?: string,
    @Query('stage') stage?: string,
    @Query('operationType') operationType?: string,
    @Query('status') status?: string,
    @Query('tableName') tableName?: string,
    @Query('requestId') requestId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('includeInternal') includeInternal?: string,
  ) {
    return this.sqlAuditContextService.run(
      {
        actorId: request.crmUser.id,
        actorRoleIds: request.crmUser.roleIds,
        channel: 'web-console',
        requestId: buildEntityId('audit_sql_summary_request'),
        moduleKey: 'audit-center',
        programName: 'SqlAuditController.getSummary',
      },
      async () => {
        this.ensureViewAccess(request.crmUser);
        const records = await this.filterRecords(request.crmUser, {
          actorId,
          moduleKey,
          databaseRole,
          stage,
          operationType,
          status,
          tableName,
          requestId,
          sessionId,
          startAt,
          endAt,
          includeInternal,
        });

        return this.buildSummary(records, request.crmUser);
      },
    );
  }

  @Get()
  async listSqlAudits(
    @Req() request: AuthenticatedRequest,
    @Query('actorId') actorId?: string,
    @Query('moduleKey') moduleKey?: string,
    @Query('databaseRole') databaseRole?: string,
    @Query('stage') stage?: string,
    @Query('operationType') operationType?: string,
    @Query('status') status?: string,
    @Query('tableName') tableName?: string,
    @Query('requestId') requestId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('includeInternal') includeInternal?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.sqlAuditContextService.run(
      {
        actorId: request.crmUser.id,
        actorRoleIds: request.crmUser.roleIds,
        channel: 'web-console',
        requestId: buildEntityId('audit_sql_list_request'),
        moduleKey: 'audit-center',
        programName: 'SqlAuditController.listSqlAudits',
      },
      async () => {
        this.ensureViewAccess(request.crmUser);
        const records = await this.filterRecords(request.crmUser, {
          actorId,
          moduleKey,
          databaseRole,
          stage,
          operationType,
          status,
          tableName,
          requestId,
          sessionId,
          startAt,
          endAt,
          includeInternal,
        });
        const currentPage = Math.max(Number(page) || 1, 1);
        const currentPageSize = Math.max(Math.min(Number(pageSize) || 20, 100), 1);
        const start = (currentPage - 1) * currentPageSize;
        const pageRecords = records.slice(start, start + currentPageSize);
        const actorNameCache = new Map<string, string | undefined>();
        await this.preloadPageActorDisplayNames(pageRecords, request.crmUser, actorNameCache);
        const items = await Promise.all(
          pageRecords.map((item) => this.mapRecordToListItem(item, request.crmUser, actorNameCache)),
        );

        return {
          summary: this.buildSummary(records, request.crmUser),
          items,
          page: currentPage,
          pageSize: currentPageSize,
          total: records.length,
        };
      },
    );
  }

  @Get(':sqlAuditId')
  async getSqlAuditDetail(
    @Req() request: AuthenticatedRequest,
    @Param('sqlAuditId') sqlAuditId: string,
  ) {
    return this.sqlAuditContextService.run(
      {
        actorId: request.crmUser.id,
        actorRoleIds: request.crmUser.roleIds,
        channel: 'web-console',
        requestId: buildEntityId('audit_sql_detail_request'),
        moduleKey: 'audit-center',
        programName: 'SqlAuditController.getSqlAuditDetail',
      },
      async () => {
        this.ensureViewAccess(request.crmUser);
        const record = await this.findVisibleRecord(sqlAuditId, request.crmUser);
        const actorName = await this.resolveRecordActorName(record, request.crmUser);
        const canRevealSensitive = this.permissionEnforcementService.hasAction(
          request.crmUser,
          'audit.sql.view_sensitive',
        );
        const behaviorContext = this.buildBehaviorContext(record);

        return {
          auditId: record.id,
          actorId: record.actorId,
          actorName,
          channel: record.channel,
          requestId: record.requestId,
          sessionId: record.sessionId,
          moduleKey: record.moduleKey,
          programName: record.programName,
          databaseRole: record.databaseRole,
          operationType: record.operationType,
          stage: record.stage,
          status: record.status,
          riskLevel: record.riskLevel,
          tables: [...record.tables],
          sqlFingerprint: record.sqlFingerprint,
          sqlSummary: record.sqlSummary,
          paramSummary: record.paramSummary,
          rowCount: record.rowCount,
          affectedRows: record.affectedRows,
          durationMs: record.durationMs,
          timeoutMs: record.timeoutMs,
          executionMode: record.executionMode,
          executionSource: record.executionSource,
          matchedAdapter: record.matchedAdapter,
          fallbackReason: record.fallbackReason,
          blockedReason: record.blockedReason,
          errorSummary: record.errorMessage,
          canRevealSensitive,
          behaviorContext,
          createdAt: record.createdAt,
        };
      },
    );
  }

  @Post(':sqlAuditId/reveal')
  async revealSqlAudit(
    @Req() request: AuthenticatedRequest,
    @Param('sqlAuditId') sqlAuditId: string,
  ) {
    return this.sqlAuditContextService.run(
      {
        actorId: request.crmUser.id,
        actorRoleIds: request.crmUser.roleIds,
        channel: 'web-console',
        requestId: buildEntityId('audit_sql_reveal_request'),
        moduleKey: 'audit-center',
        programName: 'SqlAuditController.revealSqlAudit',
      },
      async () => {
        this.ensureViewAccess(request.crmUser);
        this.permissionEnforcementService.ensureAction(
          request.crmUser,
          'audit.sql.view_sensitive',
          '当前用户无权查看完整 SQL 与参数。',
          {
            channel: 'web-console',
            resourceType: 'audit-events-sql-reveal',
            resourceId: sqlAuditId,
          },
        );

        const record = await this.findVisibleRecord(sqlAuditId, request.crmUser);
        this.auditEventRepository.create({
          id: buildEntityId('audit'),
          eventType: 'SQL_AUDIT_RAW_VIEWED',
          actorId: request.crmUser.id,
          actorRoleIds: request.crmUser.roleIds,
          resourceType: 'sql-audit-record',
          resourceId: record.id,
          channel: 'web-console',
          scopeSnapshot: {
            organizationIds: request.crmUser.organizationIds ?? [],
            departmentIds: request.crmUser.departmentIds ?? [],
            ownerIds: request.crmUser.ownerIds ?? [],
            scopeSummary: `已查看 SQL 审计原始明细：${record.id}`,
          },
          sessionSnapshot: {
            sqlAuditId: record.id,
            sqlFingerprint: record.sqlFingerprint,
            moduleKey: record.moduleKey,
          },
          riskLevel: 'HIGH',
          reviewStatus: 'CONFIRMED',
          outcome: '管理员已查看完整 SQL 审计明细。',
          createdAt: new Date().toISOString(),
        });

        return {
          auditId: record.id,
          sqlText: record.sqlText,
          params: this.sqlAuditService.parseParams(record),
          errorMessage: record.errorMessage,
          revealedAt: new Date().toISOString(),
        };
      },
    );
  }

  /**
   * 统一校验 SQL 审计基础查看权限，避免普通审计权限被误认为已放开 SQL 明细。
   */
  private ensureViewAccess(user: any): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'audit.sql.view',
      '当前用户无权查看 SQL 审计。',
      {
        channel: 'web-console',
        resourceType: 'audit-events-sql',
      },
    );
  }

  /**
   * 在当前用户可见范围内查找单条 SQL 审计记录；未命中则抛出 404。
   */
  private async findVisibleRecord(sqlAuditId: string, currentUser: any) {
    const records = await this.filterRecords(currentUser, {
      includeInternal: 'true',
    });
    const record = records.find((item) => item.id === sqlAuditId);
    if (!record) {
      throw new NotFoundException('SQL 审计记录不存在。');
    }
    return record;
  }

  /**
   * 统一执行列表筛选与越权收敛，非管理员默认只能看到自己触发的 SQL 审计。
   */
  private async filterRecords(
    currentUser: any,
    filters: {
      actorId?: string;
      moduleKey?: string;
      databaseRole?: string;
      stage?: string;
      operationType?: string;
      status?: string;
      tableName?: string;
      requestId?: string;
      sessionId?: string;
      startAt?: string;
      endAt?: string;
      includeInternal?: string;
    },
  ) {
    const includeInternalRecords = this.shouldIncludeInternalRecords(filters);
    const actorNameCache = new Map<string, string | undefined>();
    const records = this.sqlAuditRepository
      .list()
      .filter((item) =>
        includeInternalRecords ? true : !this.isDefaultHiddenInternalRecord(item),
      )
      .filter((item) => (currentUser.isAdmin ? true : item.actorId === currentUser.id))
      .filter((item) => (filters.moduleKey ? item.moduleKey === filters.moduleKey : true))
      .filter((item) =>
        filters.databaseRole ? item.databaseRole === filters.databaseRole : true,
      )
      .filter((item) => (filters.stage ? item.stage === filters.stage : true))
      .filter((item) =>
        filters.operationType ? item.operationType === filters.operationType : true,
      )
      .filter((item) => (filters.status ? item.status === filters.status : true))
      .filter((item) =>
        filters.tableName
          ? item.tables.some((table) => table.includes(filters.tableName as string))
          : true,
      )
      .filter((item) => (filters.requestId ? item.requestId === filters.requestId : true))
      .filter((item) => (filters.sessionId ? item.sessionId === filters.sessionId : true))
      .filter((item) => (filters.startAt ? item.createdAt >= filters.startAt : true))
      .filter((item) => (filters.endAt ? item.createdAt <= filters.endAt : true));
    const filteredByActor: typeof records = [];

    for (const item of records) {
      if (
        await this.matchesActorFilter(
          item,
          filters.actorId,
          currentUser,
          actorNameCache,
        )
      ) {
        filteredByActor.push(item);
      }
    }

    return filteredByActor;
  }

  /**
   * 判断本次查询是否显式要求查看内部 SQL 记录。
   *
   * 设计原因：默认 SQL 审计页要回答“谁查询了什么业务数据”，不应被登录态身份解析、
   * 审计中心查名等内部辅助 SQL 淹没；但治理排障时仍可按模块、请求或会话精确查回。
   */
  private shouldIncludeInternalRecords(filters: {
    moduleKey?: string;
    requestId?: string;
    sessionId?: string;
    includeInternal?: string;
  }): boolean {
    if (filters.includeInternal === 'true') {
      return true;
    }

    return Boolean(filters.moduleKey || filters.requestId || filters.sessionId);
  }

  /**
   * 默认列表隐藏内部辅助 SQL，避免用户误以为“审计中心查看”或“身份解析”就是业务查询人。
   */
  private isDefaultHiddenInternalRecord(
    record: ReturnType<SqlAuditRepository['list']>[number],
  ): boolean {
    if (record.moduleKey === 'crm-identity' || record.moduleKey === 'audit-center') {
      return true;
    }

    if (record.actorId !== 'system:crm-intelligent-analytics') {
      return false;
    }

    return record.moduleKey === 'crm-readonly';
  }

  /**
   * 将 SQL 审计实体映射为列表项视图，补齐行为人中文名和前端直接可用的脱敏字段。
   */
  private async mapRecordToListItem(
    record: ReturnType<SqlAuditRepository['list']>[number],
    currentUser: any,
    actorNameCache = new Map<string, string | undefined>(),
  ) {
    return {
      auditId: record.id,
      actorId: record.actorId,
      actorName: await this.resolveRecordActorName(record, currentUser, actorNameCache, {
        allowLiveLookup: false,
      }),
      channel: record.channel,
      requestId: record.requestId,
      sessionId: record.sessionId,
      moduleKey: record.moduleKey,
      programName: record.programName,
      databaseRole: record.databaseRole,
      operationType: record.operationType,
      stage: record.stage,
      status: record.status,
      riskLevel: record.riskLevel,
      tables: [...record.tables],
      sqlFingerprint: record.sqlFingerprint,
      sqlSummary: record.sqlSummary,
      paramSummary: record.paramSummary,
      rowCount: record.rowCount,
      affectedRows: record.affectedRows,
      durationMs: record.durationMs,
      executionMode: record.executionMode,
      executionSource: record.executionSource,
      matchedAdapter: record.matchedAdapter,
      fallbackReason: record.fallbackReason,
      blockedReason: record.blockedReason,
      errorSummary: record.errorMessage,
      canRevealSensitive: this.permissionEnforcementService.hasAction(
        currentUser,
        'audit.sql.view_sensitive',
      ),
      createdAt: record.createdAt,
    };
  }

  /**
   * 统计摘要卡需要的核心指标，避免前端重复计算写 SQL、失败数和平均耗时。
   */
  private buildSummary(records: ReturnType<SqlAuditRepository['list']>, currentUser: any) {
    const durationValues = records
      .map((item) => item.durationMs)
      .filter((item): item is number => typeof item === 'number' && item >= 0);
    const averageDurationMs =
      durationValues.length > 0
        ? Math.round(
            durationValues.reduce((sum, item) => sum + item, 0) /
              durationValues.length,
          )
        : 0;

    return {
      totalCount: records.length,
      writeCount: records.filter((item) => item.databaseRole === 'CRM_WRITEBACK').length,
      failedCount: records.filter((item) => item.status === 'FAILED').length,
      blockedCount: records.filter((item) => item.status === 'BLOCKED').length,
      highRiskCount: records.filter((item) => item.riskLevel === 'HIGH').length,
      averageDurationMs,
      canRevealSensitive: this.permissionEnforcementService.hasAction(
        currentUser,
        'audit.sql.view_sensitive',
      ),
    };
  }

  /**
   * 兼容按用户 ID 或用户名模糊检索 SQL 审计行为人。
   */
  private async matchesActorFilter(
    record: ReturnType<SqlAuditRepository['list']>[number],
    actorQuery: string | undefined,
    currentUser: any,
    actorNameCache: Map<string, string | undefined>,
  ): Promise<boolean> {
    const query = actorQuery?.trim();
    if (!query) {
      return true;
    }

    if (record.actorId === query) {
      return true;
    }

    const identityActorIds = this.extractIdentityActorIdentifiers(record);
    if (identityActorIds.includes(query)) {
      return true;
    }

    const actorName = await this.resolveRecordActorName(record, currentUser, actorNameCache, {
      allowLiveLookup: true,
    });
    return actorName === query || Boolean(actorName?.includes(query));
  }

  /**
   * 为当前页 SQL 审计批量预加载行为人展示名。
   *
   * @param records 当前页 SQL 审计记录。
   * @param currentUser 当前登录用户。
   * @param actorNameCache 同一次请求内的行为人姓名缓存。
   * @returns 无返回值，解析结果写入 `actorNameCache`。
   *
   * 设计原因：SQL 审计列表可能一次展示多条 CRM 用户触发的查询，只需要姓名展示。
   * 这里使用轻量批量查名，避免逐行调用完整身份上下文导致列表慢和连接池异常。
   */
  private async preloadPageActorDisplayNames(
    records: ReturnType<SqlAuditRepository['list']>,
    currentUser: any,
    actorNameCache: Map<string, string | undefined>,
  ): Promise<void> {
    const lookupActorIds = new Set<string>();
    const identityRecordLookupKeys = new Map<string, string[]>();
    const lookupIdentifiers = new Set<string>();

    for (const record of records) {
      const cacheKey = this.buildRecordActorNameCacheKey(record);
      const currentUserName = this.resolveCurrentUserActorName(record.actorId, currentUser);
      if (currentUserName !== undefined) {
        actorNameCache.set(cacheKey, currentUserName);
        continue;
      }

      const identityActorIds = this.extractIdentityActorIdentifiers(record);
      if (identityActorIds.length > 0) {
        identityRecordLookupKeys.set(cacheKey, identityActorIds);
        for (const identityActorId of identityActorIds) {
          lookupIdentifiers.add(identityActorId);
        }
        continue;
      }

      const staticName = this.resolveSystemActorLabel(record.actorId);
      if (staticName !== undefined) {
        actorNameCache.set(cacheKey, staticName);
        continue;
      }

      lookupActorIds.add(record.actorId);
      lookupIdentifiers.add(record.actorId);
    }

    if (lookupIdentifiers.size === 0) {
      return;
    }

    try {
      const displayNameMap = await this.crmReadonlyService.listUserDisplayNamesByIdentifiers(
        Array.from(lookupIdentifiers),
        { audit: false },
      );
      for (const actorId of lookupActorIds) {
        const displayName = displayNameMap.get(actorId);
        if (displayName?.trim()) {
          actorNameCache.set(actorId, displayName);
        }
      }
      for (const [cacheKey, identityActorIds] of identityRecordLookupKeys.entries()) {
        const displayName = identityActorIds
          .map((identityActorId) => displayNameMap.get(identityActorId))
          .find((item): item is string => Boolean(item?.trim()));
        if (displayName) {
          actorNameCache.set(cacheKey, displayName);
        }
      }
    } catch {
      // SQL 审计是治理排障入口，CRM 身份库短暂不可用时仍应返回 SQL 记录主体。
      // 未命中的用户会在 `resolveRecordActorName` 中降级为 actorId 或系统标签。
    }
  }

  /**
   * 按单条 SQL 审计记录解析行为人展示名，兼容旧版系统归因记录。
   */
  private async resolveRecordActorName(
    record: ReturnType<SqlAuditRepository['list']>[number],
    currentUser: any,
    actorNameCache = new Map<string, string | undefined>(),
    options: { allowLiveLookup: boolean } = { allowLiveLookup: true },
  ): Promise<string | undefined> {
    const cacheKey = this.buildRecordActorNameCacheKey(record);
    if (actorNameCache.has(cacheKey)) {
      return actorNameCache.get(cacheKey);
    }

    const currentUserName = this.resolveCurrentUserActorName(record.actorId, currentUser);
    if (currentUserName !== undefined) {
      actorNameCache.set(cacheKey, currentUserName);
      return currentUserName;
    }

    const identityActorIds = this.extractIdentityActorIdentifiers(record);
    if (identityActorIds.length > 0 && options.allowLiveLookup) {
      try {
        const displayNameMap =
          await this.crmReadonlyService.listUserDisplayNamesByIdentifiers(
            identityActorIds,
            { audit: false },
          );
        const displayName = identityActorIds
          .map((identityActorId) => displayNameMap.get(identityActorId))
          .find((item): item is string => Boolean(item?.trim()));
        if (displayName) {
          actorNameCache.set(cacheKey, displayName);
          return displayName;
        }
      } catch {
        // 详情页不能因为历史归因补名失败而无法打开，后续会降级到系统标签。
      }
    }

    const systemActorLabel = this.resolveSystemActorLabel(record.actorId);
    if (systemActorLabel) {
      actorNameCache.set(cacheKey, systemActorLabel);
      return systemActorLabel;
    }

    if (!options.allowLiveLookup) {
      actorNameCache.set(cacheKey, record.actorId);
      return record.actorId;
    }

    try {
      const crmUser = await this.crmReadonlyService.getUserById(record.actorId);
      if (crmUser?.name) {
        actorNameCache.set(cacheKey, crmUser.name);
        return crmUser.name;
      }

      const wecomUser = await this.crmReadonlyService.getUserByWecomSenderId(record.actorId);
      const fallbackName = wecomUser?.name ?? record.actorId;
      actorNameCache.set(cacheKey, fallbackName);
      return fallbackName;
    } catch {
      actorNameCache.set(cacheKey, record.actorId);
      return record.actorId;
    }
  }

  /**
   * 当前登录人发起的 SQL 可以直接使用会话姓名，避免再访问 CRM 身份库。
   */
  private resolveCurrentUserActorName(actorId: string, currentUser: any): string | undefined {
    if (actorId === currentUser.id && typeof currentUser.name === 'string') {
      return currentUser.name;
    }

    return undefined;
  }

  /**
   * 为历史系统归因的身份解析 SQL 提取真实 CRM 用户标识。
   *
   * 设计原因：早期 `crm-identity` 查询在缺少 SQL 审计上下文时会写成系统账号，
   * 但 `getUserById`、角色和部门装载 SQL 的首个参数就是被解析的 CRM 用户 ID。
   * 展示层只在该受控范围内补名，避免把任意业务 SQL 参数误当成行为人。
   */
  private extractIdentityActorIdentifiers(
    record: ReturnType<SqlAuditRepository['list']>[number],
  ): string[] {
    if (
      record.actorId !== 'system:crm-intelligent-analytics' ||
      record.moduleKey !== 'crm-identity'
    ) {
      return [];
    }

    const supportedProgramNames = new Set([
      'CrmReadonlyService.getUserById',
      'CrmReadonlyService.buildLiveUserContext.roles',
      'CrmReadonlyService.buildLiveUserContext.departments',
    ]);
    if (!supportedProgramNames.has(record.programName)) {
      return [];
    }

    const params = this.sqlAuditService.parseParams(record);
    const firstParam = params[0];
    if (typeof firstParam !== 'string' && typeof firstParam !== 'number') {
      return [];
    }

    const normalized = String(firstParam).trim();
    return normalized ? [normalized] : [];
  }

  /**
   * 生成行为人姓名缓存键，系统身份解析记录需要带上 SQL 参数避免互相串名。
   */
  private buildRecordActorNameCacheKey(
    record: ReturnType<SqlAuditRepository['list']>[number],
  ): string {
    const identityActorIds = this.extractIdentityActorIdentifiers(record);
    if (identityActorIds.length === 0) {
      return record.actorId;
    }

    return [
      record.actorId,
      record.moduleKey,
      record.programName,
      identityActorIds.join('|'),
    ].join(':');
  }

  /**
   * 为系统任务保留稳定中文标签，避免 SQL 审计列表直接展示内部系统 actorId。
   */
  private resolveSystemActorLabel(actorId: string): string | undefined {
    const labelMap: Record<string, string> = {
      'system:crm-intelligent-analytics': '系统服务',
      'system:auth-phone-repair': '登录兜底修复',
      system_sync: '企业微信目录同步任务',
    };

    return labelMap[actorId];
  }

  /**
   * 为 SQL 审计详情补齐业务行为上下文，优先描述“这条 SQL 是为哪次业务动作服务的”。
   */
  private buildBehaviorContext(record: ReturnType<SqlAuditRepository['list']>[number]) {
    if (record.moduleKey === 'analysis-workbench' && record.requestId) {
      const requestRecord = this.analysisRequestRepository.findRequestById(record.requestId);
      if (requestRecord) {
        const temporalLabel =
          requestRecord.temporalSlot?.normalizedLabel ??
          (typeof requestRecord.filters.timeRange === 'string'
            ? requestRecord.filters.timeRange
            : undefined);
        const taskTitles =
          requestRecord.executionTraceSummary?.taskSummaries?.map((item) => item.taskTitle) ??
          requestRecord.executionSnapshot?.taskSnapshots?.map((item) => item.taskTitle) ??
          [];

        return {
          title: '智能分析问数',
          summary: requestRecord.questionText?.trim() || '当前问数未记录原始问题。',
          requestStatus: requestRecord.status,
          originalQuestion: requestRecord.questionText,
          temporalLabel,
          taskTitles,
        };
      }
    }

    const labelMap: Record<string, { title: string; summary: string }> = {
      'management-report': {
        title: '经营报表查询',
        summary: '当前 SQL 由经营报表快照、分区明细或导出流程触发。',
      },
      'crm-identity': {
        title: 'CRM 身份解析',
        summary: '当前 SQL 由登录态鉴权、权限装载或候选用户解析触发。',
      },
      'wecom-directory-sync': {
        title: '企业微信目录同步',
        summary: '当前 SQL 由企业微信官方目录同步任务触发。',
      },
      'auth-phone-repair': {
        title: '登录兜底修复',
        summary: '当前 SQL 由 CRM 手机确认时间自动修复链路触发。',
      },
      'audit-center': {
        title: '审计中心查看',
        summary: '当前 SQL 由治理用户在审计中心执行查看动作触发。',
      },
    };

    const fallback = labelMap[record.moduleKey];
    if (fallback) {
      return fallback;
    }

    return {
      title: record.programName,
      summary: '当前 SQL 已记录技术上下文，但暂未补充更细的业务行为摘要。',
    };
  }
}
