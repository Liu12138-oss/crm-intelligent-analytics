import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { buildEntityId } from '../../shared/utils/id.util';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditEventRepository } from './audit-event.repository';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { SqlAuditContextService } from './sql-audit-context.service';

@Controller('audit-events')
@UseGuards(SessionAuthGuard)
export class AuditController {
  constructor(
    private readonly auditEventRepository: AuditEventRepository,
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly sqlAuditContextService: SqlAuditContextService,
  ) {}

  @Get()
  async listAuditEvents(
    @Req() request: Request & { crmUser: any },
    @Query('actorId') actorId?: string,
    @Query('eventType') eventType?: string,
    @Query('entryScene') entryScene?: string,
    @Query('entryLanguage') entryLanguage?: string,
    @Query('entryTargetWorkflow') entryTargetWorkflow?: string,
    @Query('entryUsedFallback') entryUsedFallback?: string,
    @Query('workflowTargetWorkflow') workflowTargetWorkflow?: string,
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.sqlAuditContextService.run(
      {
        actorId: request.crmUser.id,
        actorRoleIds: request.crmUser.roleIds,
        channel: 'web-console',
        requestId: buildEntityId('audit_event_request'),
        moduleKey: 'audit-center',
        programName: 'AuditController.listAuditEvents',
      },
      async () => {
        this.permissionEnforcementService.ensureAction(
          request.crmUser,
          'audit.view',
          '当前用户无权查看审计中心。',
          {
            channel: 'web-console',
            resourceType: 'audit-events',
          },
        );
        const rawEvents = this.auditEventRepository
          .list()
          .filter((item) => (request.crmUser.isAdmin ? true : item.actorId === request.crmUser.id))
          .filter((item) => (eventType ? item.eventType === eventType : true))
          .filter((item) =>
            entryScene
              ? this.resolveEntryInterpretationSnapshot(item.sessionSnapshot)?.scene === entryScene
              : true,
          )
          .filter((item) =>
            entryLanguage
              ? this.resolveEntryInterpretationSnapshot(item.sessionSnapshot)?.language ===
                entryLanguage
              : true,
          )
          .filter((item) =>
            entryTargetWorkflow
              ? this.resolveEntryInterpretationSnapshot(item.sessionSnapshot)?.targetWorkflow ===
                entryTargetWorkflow
              : true,
          )
          .filter((item) => {
            const expectedFallback = this.parseBooleanQuery(entryUsedFallback);
            if (expectedFallback === undefined) {
              return true;
            }

            return (
              this.resolveEntryInterpretationSnapshot(item.sessionSnapshot)?.usedFallback ===
              expectedFallback
            );
          })
          .filter((item) =>
            workflowTargetWorkflow
              ? this.resolveWorkflowRoutingSnapshot(item.sessionSnapshot)?.targetWorkflow ===
                workflowTargetWorkflow
              : true,
          )
          .filter((item) => (startAt ? item.createdAt >= startAt : true))
          .filter((item) => (endAt ? item.createdAt <= endAt : true));
        const actorNameCache = new Map<string, string | undefined>();
        const events: typeof rawEvents = [];

        for (const item of rawEvents) {
          if (await this.matchesActorFilter(item, actorId, request.crmUser, actorNameCache)) {
            events.push(item);
          }
        }

        const currentPage = Number(page);
        const currentPageSize = Number(pageSize);
        const start = (currentPage - 1) * currentPageSize;
        const items = events.slice(start, start + currentPageSize);
        await this.preloadPageActorDisplayNames(items, request.crmUser, actorNameCache);
        const entryRecords = events
          .map((item) => ({
            createdAt: item.createdAt,
            snapshot: this.resolveEntryInterpretationSnapshot(item.sessionSnapshot),
          }))
          .filter(
            (
              item,
            ): item is {
              createdAt: string;
              snapshot: Record<string, unknown>;
            } => Boolean(item.snapshot),
          );
        const entrySnapshots = entryRecords.map((item) => item.snapshot);
        const aiEntryCount = entryRecords.length;
        const aiFallbackCount = entryRecords.filter(
          (item) => item.snapshot.usedFallback === true,
        ).length;
        const wecomEntryCount = entryRecords.filter(
          (item) =>
            item.snapshot.scene === 'WECOM_IDLE_MESSAGE' ||
            item.snapshot.scene === 'WECOM_ACTIVE_TASK_REPLY',
        ).length;
        const entrySceneBreakdown = this.buildBreakdown(
          entrySnapshots,
          'scene',
          'scene',
        );
        const entryLanguageBreakdown = this.buildBreakdown(
          entrySnapshots,
          'language',
          'language',
        );
        const entryTargetWorkflowBreakdown = this.buildBreakdown(
          entrySnapshots,
          'targetWorkflow',
          'targetWorkflow',
        );
        const entryFallbackReasonBreakdown = this.buildReasonBreakdown(entrySnapshots);
        const entryDailyTrend = this.buildEntryDailyTrend(entryRecords);
        const entrySceneDailyTrend = this.buildEntrySceneDailyTrend(entryRecords);
        const entryFallbackReasonDailyTrend =
          this.buildEntryFallbackReasonDailyTrend(entryRecords);
        const aiGovernanceSuggestions = this.buildAiGovernanceSuggestions({
          aiEntryCount,
          aiFallbackCount,
          aiFallbackRatePercent:
            aiEntryCount > 0 ? Math.round((aiFallbackCount / aiEntryCount) * 100) : 0,
          entrySceneBreakdown,
          entryTargetWorkflowBreakdown,
          entryFallbackReasonBreakdown,
        });
        const aiGovernanceAlerts = this.buildAiGovernanceAlerts({
          aiEntryCount,
          aiFallbackCount,
          aiFallbackRatePercent:
            aiEntryCount > 0 ? Math.round((aiFallbackCount / aiEntryCount) * 100) : 0,
          entrySceneBreakdown,
          entryTargetWorkflowBreakdown,
        });
        const analysisExecutionSourceBreakdown = this.buildAnalysisExecutionSourceBreakdown(events);
        const analysisKnowledgeHitBreakdown = this.buildAnalysisKnowledgeHitBreakdown(events);

        return {
          summary: {
            todayQueryCount: events.filter((item) => item.eventType === 'QUERY_SUCCEEDED').length,
            wecomQueryRatioPercent: this.calculateWecomQueryRatioPercent(events),
            todayBlockedCount: events.filter((item) => item.eventType === 'QUERY_BLOCKED').length,
            todaySensitiveInterceptCount: events.filter(
              (item) => item.eventType === 'SECURITY_INTERCEPTED',
            ).length,
            todayExportCount: events.filter((item) => item.eventType === 'EXPORT_SUCCEEDED').length,
            todayExportBlockedCount: events.filter(
              (item) => item.eventType === 'EXPORT_BLOCKED',
            ).length,
            pendingHighRiskReviewCount: events.filter(
              (item) => item.riskLevel === 'HIGH' && item.reviewStatus === 'PENDING',
            ).length,
            todayAiEntryCount: aiEntryCount,
            todayAiFallbackCount: aiFallbackCount,
            todayAiFallbackRatePercent:
              aiEntryCount > 0 ? Math.round((aiFallbackCount / aiEntryCount) * 100) : 0,
            todayWecomEntryCount: wecomEntryCount,
            entrySceneBreakdown,
            entryLanguageBreakdown,
            entryTargetWorkflowBreakdown,
            entryFallbackReasonBreakdown,
            entryDailyTrend,
            entrySceneDailyTrend,
            entryFallbackReasonDailyTrend,
            analysisExecutionSourceBreakdown,
            analysisKnowledgeHitBreakdown,
            aiGovernanceSuggestions,
            aiGovernanceAlerts,
          },
          items: await Promise.all(
            items.map((item) => this.mapAuditEventItem(item, request.crmUser, actorNameCache)),
          ),
          page: currentPage,
          pageSize: currentPageSize,
          total: events.length,
        };
      },
    );
  }

  /**
   * 将审计记录映射为接口返回对象，参数包含原始审计记录、当前用户和姓名缓存。
   */
  private async mapAuditEventItem(
    item: ReturnType<AuditEventRepository['list']>[number],
    currentUser: any,
    actorNameCache: Map<string, string | undefined>,
  ) {
    const sessionSnapshot = item.sessionSnapshot as Record<string, unknown> | undefined;
    const entryInterpretationSnapshot =
      this.resolveEntryInterpretationSnapshot(sessionSnapshot);
    const workflowRoutingSnapshot =
      this.resolveWorkflowRoutingSnapshot(sessionSnapshot);
    const executionTraceSummary =
      this.resolveExecutionTraceSummary(sessionSnapshot);

    return {
      eventId: item.id,
      eventType: item.eventType,
      actorId: item.actorId,
      actorName: await this.resolveActorName(item, currentUser, actorNameCache, {
        allowLiveLookup: false,
      }),
      actorType: item.actorType,
      actorDisplayName: item.actorDisplayName,
      actorExternalId: item.actorExternalId,
      actorBindingStatus: item.actorBindingStatus,
      permissionKey: item.permissionKey,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      channel: item.channel,
      channelAgentId: item.channelAgentId,
      channelAgentType: item.channelAgentType,
      queryId: item.relatedRequestId,
      templateId: item.relatedTemplateId,
      historyId: item.relatedHistoryId,
      originalQuestion: item.originalQuestion,
      scopeSummary: item.scopeSnapshot.scopeSummary,
      resultCount: item.resultCount,
      riskLevel: item.riskLevel,
      reviewStatus: item.reviewStatus,
      outcome: item.outcome,
      failureReason: item.failureReason,
      actionSummary: item.actionSummary,
      targetType: item.targetType ?? item.resourceType,
      targetId: item.targetId ?? item.resourceId,
      targetSummary: item.targetSummary,
      sessionId: String(sessionSnapshot?.sessionId ?? ''),
      entryInterpretationSnapshot,
      workflowRoutingSnapshot,
      entryScene: entryInterpretationSnapshot?.scene,
      entryLanguage: entryInterpretationSnapshot?.language,
      entryTargetWorkflow: entryInterpretationSnapshot?.targetWorkflow,
      entryUsedFallback: entryInterpretationSnapshot?.usedFallback,
      entryFallbackReason: entryInterpretationSnapshot?.fallbackReason,
      workflowFinalProgram: workflowRoutingSnapshot?.finalProgram,
      workflowTargetWorkflow: workflowRoutingSnapshot?.targetWorkflow,
      executionTraceSummary,
      sessionSnapshot,
      createdAt: item.createdAt,
    };
  }

  /**
   * 判断审计记录是否命中用户筛选，参数 `actorQuery` 兼容用户 ID 和用户名。
   */
  private async matchesActorFilter(
    item: ReturnType<AuditEventRepository['list']>[number],
    actorQuery: string | undefined,
    currentUser: any,
    actorNameCache: Map<string, string | undefined>,
  ): Promise<boolean> {
    const query = actorQuery?.trim();
    if (!query) {
      return true;
    }

    if (
      item.actorId === query ||
      item.actorExternalId === query ||
      Boolean(item.actorExternalId?.includes(query))
    ) {
      return true;
    }

    if (item.actorId.startsWith('wecom:') && item.actorId.slice('wecom:'.length) === query) {
      return true;
    }

    const actorName = await this.resolveActorName(item, currentUser, actorNameCache, {
      allowLiveLookup: true,
    });
    return actorName === query || Boolean(actorName?.includes(query));
  }

  /**
   * 为当前分页批量预加载行为人展示名。
   *
   * @param items 当前页审计记录。
   * @param currentUser 当前登录用户。
   * @param actorNameCache 同一次请求内的行为人姓名缓存。
   * @returns 无返回值，解析结果写入 `actorNameCache`。
   *
   * 调用注意：这里只允许使用轻量批量查名接口，不能调用完整身份上下文查询，
   * 避免审计列表分页因为角色/部门补全慢查询再次出现超时和 500。
   */
  private async preloadPageActorDisplayNames(
    items: ReturnType<AuditEventRepository['list']>,
    currentUser: any,
    actorNameCache: Map<string, string | undefined>,
  ): Promise<void> {
    const lookupIdentifiers = new Set<string>();
    const actorLookupKeys = new Map<string, string[]>();

    for (const item of items) {
      const actorId = item.actorId;
      const staticName = this.resolveStaticActorName(item, currentUser);
      if (staticName !== undefined) {
        actorNameCache.set(actorId, staticName);
        continue;
      }

      const identifiers = [actorId, item.actorExternalId]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
      actorLookupKeys.set(actorId, identifiers);

      for (const identifier of identifiers) {
        lookupIdentifiers.add(identifier);
      }
    }

    if (lookupIdentifiers.size === 0) {
      return;
    }

    try {
      const displayNameMap = await this.crmReadonlyService.listUserDisplayNamesByIdentifiers(
        Array.from(lookupIdentifiers),
        { audit: false },
      );

      for (const [actorId, identifiers] of actorLookupKeys.entries()) {
        const displayName = identifiers
          .map((identifier) => displayNameMap.get(identifier))
          .find((value): value is string => Boolean(value?.trim()));
        if (displayName) {
          actorNameCache.set(actorId, displayName);
        }
      }
    } catch {
      // 审计列表是治理入口，CRM 身份库短暂不可用时也必须返回列表主体数据。
      // 未命中的行为人会在 `resolveActorName` 中降级为 actorId，避免把分页请求打成 500。
    }
  }

  /**
   * 解析审计行为人的中文姓名。
   *
   * @param item 原始审计事件记录。
   * @param currentUser 当前登录用户，用于当前用户记录的无查询回显。
   * @param actorNameCache 同一次请求内的行为人姓名缓存。
   * @param options.allowLiveLookup 是否允许访问 CRM 实时身份数据。
   * @returns 可展示的行为人姓名；实时查询失败时返回可解释的兜底标识。
   *
   * 调用注意：列表页批量渲染只允许使用审计记录内已经持久化的归因字段，
   * 避免为了历史记录补姓名而并发访问 CRM 身份库，导致分页请求被慢查询拖垮。
   */
  private async resolveActorName(
    item: ReturnType<AuditEventRepository['list']>[number],
    currentUser: any,
    actorNameCache: Map<string, string | undefined>,
    options: { allowLiveLookup: boolean },
  ): Promise<string | undefined> {
    const actorId = item.actorId;
    if (actorNameCache.has(actorId)) {
      return actorNameCache.get(actorId);
    }

    const staticName = this.resolveStaticActorName(item, currentUser);
    if (staticName !== undefined) {
      actorNameCache.set(actorId, staticName);
      return staticName;
    }

    if (!options.allowLiveLookup) {
      actorNameCache.set(actorId, actorId);
      return actorId;
    }

    try {
      const crmUser = await this.crmReadonlyService.getUserById(actorId);
      if (crmUser?.name) {
        actorNameCache.set(actorId, crmUser.name);
        return crmUser.name;
      }

      const wecomUser = await this.crmReadonlyService.getUserByWecomSenderId(
        item.actorExternalId ?? actorId,
      );
      const fallbackName = wecomUser?.name ?? actorId;
      actorNameCache.set(actorId, fallbackName);
      return fallbackName;
    } catch {
      actorNameCache.set(actorId, actorId);
      return actorId;
    }
  }

  /**
   * 解析无需访问 CRM 的静态行为人展示名。
   *
   * @param item 原始审计事件记录。
   * @param currentUser 当前登录用户。
   * @returns 可直接展示的姓名；返回 `undefined` 表示需要后续轻量查名。
   */
  private resolveStaticActorName(
    item: ReturnType<AuditEventRepository['list']>[number],
    currentUser: any,
  ): string | undefined {
    const actorId = item.actorId;

    if (item.actorDisplayName?.trim()) {
      return item.actorDisplayName;
    }

    if (item.actorBindingStatus === 'UNBOUND_WECOM' && item.actorExternalId?.trim()) {
      return `未绑定 CRM 用户（企业微信：${item.actorExternalId}）`;
    }

    if (actorId.startsWith('wecom:')) {
      const senderId = actorId.slice('wecom:'.length);
      return `未绑定 CRM 用户（企业微信：${senderId}）`;
    }

    if (actorId.startsWith('system:')) {
      return this.resolveSystemActorName(actorId);
    }

    if (actorId === currentUser.id && typeof currentUser.name === 'string') {
      return currentUser.name;
    }

    return undefined;
  }

  private resolveSystemActorName(actorId: string): string {
    const knownSystemActors: Record<string, string> = {
      'system:wecom-bot-ingress': '企业微信机器人入口',
      'system:scheduler': '系统定时任务',
      system: '系统任务',
    };
    return knownSystemActors[actorId] ?? '系统任务';
  }

  private calculateWecomQueryRatioPercent(
    events: ReturnType<AuditEventRepository['list']>,
  ): number {
    const queryEvents = events.filter((item) => this.isQuerySemanticEvent(item.eventType));
    if (queryEvents.length === 0) {
      return 0;
    }

    const wecomQueryEvents = queryEvents.filter((item) => item.channel === 'wecom-bot');
    return Math.round((wecomQueryEvents.length / queryEvents.length) * 100);
  }

  private isQuerySemanticEvent(eventType: string): boolean {
    return (
      eventType === 'QUERY_SUCCEEDED' ||
      eventType === 'QUERY_BLOCKED' ||
      eventType === 'TEMPLATE_EXECUTED' ||
      eventType === 'HISTORY_RERUN'
    );
  }

  private resolveEntryInterpretationSnapshot(
    sessionSnapshot?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    return sessionSnapshot?.entryInterpretationSnapshot as
      | Record<string, unknown>
      | undefined;
  }

  private resolveWorkflowRoutingSnapshot(
    sessionSnapshot?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    return sessionSnapshot?.workflowRoutingSnapshot as
      | Record<string, unknown>
      | undefined;
  }

  private resolveExecutionTraceSummary(
    sessionSnapshot?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    return sessionSnapshot?.executionTraceSummary as
      | Record<string, unknown>
      | undefined;
  }

  private parseBooleanQuery(value?: string): boolean | undefined {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return undefined;
  }

  private buildBreakdown<K extends 'scene' | 'language' | 'targetWorkflow'>(
    entrySnapshots: Array<Record<string, unknown>>,
    field: K,
    resultKey: K,
  ): Array<
    Record<K, string> & {
      count: number;
      fallbackCount: number;
      fallbackRatePercent: number;
    }
  > {
    const counterMap = new Map<
      string,
      { count: number; fallbackCount: number }
    >();

    for (const snapshot of entrySnapshots) {
      const key = String(snapshot[field] ?? '').trim();
      if (!key) {
        continue;
      }

      const current = counterMap.get(key) ?? {
        count: 0,
        fallbackCount: 0,
      };
      current.count += 1;
      if (snapshot.usedFallback === true) {
        current.fallbackCount += 1;
      }
      counterMap.set(key, current);
    }

    return [...counterMap.entries()]
      .sort((left, right) => right[1].count - left[1].count)
      .map(([key, value]) => ({
        [resultKey]: key,
        count: value.count,
        fallbackCount: value.fallbackCount,
        fallbackRatePercent:
          value.count > 0 ? Math.round((value.fallbackCount / value.count) * 100) : 0,
      })) as Array<
        Record<K, string> & {
          count: number;
          fallbackCount: number;
          fallbackRatePercent: number;
        }
      >;
  }

  private buildReasonBreakdown(entrySnapshots: Array<Record<string, unknown>>) {
    const counterMap = new Map<string, number>();

    for (const snapshot of entrySnapshots) {
      if (snapshot.usedFallback !== true) {
        continue;
      }

      const reason = String(snapshot.fallbackReason ?? 'unknown').trim() || 'unknown';
      counterMap.set(reason, (counterMap.get(reason) ?? 0) + 1);
    }

    return [...counterMap.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([fallbackReason, count]) => ({
        fallbackReason,
        count,
      }));
  }

  private buildEntryDailyTrend(
    entryRecords: Array<{ createdAt: string; snapshot: Record<string, unknown> }>,
  ) {
    const counterMap = new Map<
      string,
      { aiEntryCount: number; aiFallbackCount: number; wecomEntryCount: number }
    >();

    for (const record of entryRecords) {
      const date = record.createdAt.slice(0, 10);
      const current = counterMap.get(date) ?? {
        aiEntryCount: 0,
        aiFallbackCount: 0,
        wecomEntryCount: 0,
      };
      current.aiEntryCount += 1;
      if (record.snapshot.usedFallback === true) {
        current.aiFallbackCount += 1;
      }
      if (
        record.snapshot.scene === 'WECOM_IDLE_MESSAGE' ||
        record.snapshot.scene === 'WECOM_ACTIVE_TASK_REPLY'
      ) {
        current.wecomEntryCount += 1;
      }
      counterMap.set(date, current);
    }

    return [...counterMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([date, value]) => ({
        date,
        aiEntryCount: value.aiEntryCount,
        aiFallbackCount: value.aiFallbackCount,
        aiFallbackRatePercent:
          value.aiEntryCount > 0
            ? Math.round((value.aiFallbackCount / value.aiEntryCount) * 100)
            : 0,
        wecomEntryCount: value.wecomEntryCount,
      }));
  }

  private buildEntrySceneDailyTrend(
    entryRecords: Array<{ createdAt: string; snapshot: Record<string, unknown> }>,
  ) {
    const counterMap = new Map<
      string,
      { date: string; scene: string; count: number; fallbackCount: number }
    >();

    for (const record of entryRecords) {
      const date = record.createdAt.slice(0, 10);
      const scene = String(record.snapshot.scene ?? '').trim();
      if (!scene) {
        continue;
      }

      const key = `${date}:${scene}`;
      const current = counterMap.get(key) ?? {
        date,
        scene,
        count: 0,
        fallbackCount: 0,
      };
      current.count += 1;
      if (record.snapshot.usedFallback === true) {
        current.fallbackCount += 1;
      }
      counterMap.set(key, current);
    }

    return [...counterMap.values()]
      .sort((left, right) =>
        left.date === right.date
          ? right.count - left.count
          : left.date.localeCompare(right.date),
      )
      .map((item) => ({
        ...item,
        fallbackRatePercent:
          item.count > 0 ? Math.round((item.fallbackCount / item.count) * 100) : 0,
      }));
  }

  private buildEntryFallbackReasonDailyTrend(
    entryRecords: Array<{ createdAt: string; snapshot: Record<string, unknown> }>,
  ) {
    const counterMap = new Map<
      string,
      { date: string; fallbackReason: string; count: number }
    >();

    for (const record of entryRecords) {
      if (record.snapshot.usedFallback !== true) {
        continue;
      }

      const date = record.createdAt.slice(0, 10);
      const fallbackReason =
        String(record.snapshot.fallbackReason ?? 'unknown').trim() || 'unknown';
      const key = `${date}:${fallbackReason}`;
      const current = counterMap.get(key) ?? {
        date,
        fallbackReason,
        count: 0,
      };
      current.count += 1;
      counterMap.set(key, current);
    }

    return [...counterMap.values()].sort((left, right) =>
      left.date === right.date
        ? right.count - left.count
        : left.date.localeCompare(right.date),
    );
  }

  private buildAiGovernanceSuggestions(params: {
    aiEntryCount: number;
    aiFallbackCount: number;
    aiFallbackRatePercent: number;
    entrySceneBreakdown: Array<{
      scene: string;
      count: number;
      fallbackCount: number;
      fallbackRatePercent: number;
    }>;
    entryTargetWorkflowBreakdown: Array<{
      targetWorkflow: string;
      count: number;
      fallbackCount: number;
      fallbackRatePercent: number;
    }>;
    entryFallbackReasonBreakdown: Array<{
      fallbackReason: string;
      count: number;
    }>;
  }) {
    const suggestions: Array<{
      level: 'info' | 'warning' | 'critical';
      title: string;
      detail: string;
      action: string;
    }> = [];

    if (params.aiEntryCount > 0 && params.aiFallbackRatePercent >= 20) {
      suggestions.push({
        level: params.aiFallbackRatePercent >= 40 ? 'critical' : 'warning',
        title: 'AI fallback 比例偏高',
        detail: `当前 AI fallback 比例达到 ${params.aiFallbackRatePercent}%，说明部分入口已开始回退到安全兜底。`,
        action: '优先检查 idle semantic lane / semantic reply lane 的超时、排队耗时和最近网关可用性。',
      });
    }

    const unstableScene = params.entrySceneBreakdown.find(
      (item) => item.count >= 3 && item.fallbackRatePercent >= 20,
    );
    if (unstableScene) {
      suggestions.push({
        level: unstableScene.fallbackRatePercent >= 40 ? 'critical' : 'warning',
        title: `${unstableScene.scene} 入口波动明显`,
        detail: `${unstableScene.scene} 入口当前共命中 ${unstableScene.count} 次，fallback ${unstableScene.fallbackCount} 次，占比 ${unstableScene.fallbackRatePercent}%。`,
        action: `优先检查 ${unstableScene.scene} 对应入口的 prompt、timeout、lane 排队和 fallback 原因分布。`,
      });
    }

    const unstableWorkflow = params.entryTargetWorkflowBreakdown.find(
      (item) => item.count >= 3 && item.fallbackRatePercent >= 20,
    );
    if (unstableWorkflow) {
      suggestions.push({
        level:
          unstableWorkflow.fallbackRatePercent >= 40 ? 'critical' : 'warning',
        title: `${unstableWorkflow.targetWorkflow} 工作流不稳定`,
        detail: `${unstableWorkflow.targetWorkflow} 入口目标工作流当前共命中 ${unstableWorkflow.count} 次，fallback ${unstableWorkflow.fallbackCount} 次。`,
        action: `检查 ${unstableWorkflow.targetWorkflow} 的输入 schema、治理边界和相关开关配置，确认是否存在误阻断或超时。`,
      });
    }

    const topFallbackReason = params.entryFallbackReasonBreakdown[0];
    if (topFallbackReason && topFallbackReason.count > 0) {
      suggestions.push({
        level: topFallbackReason.count >= 3 ? 'warning' : 'info',
        title: '当前最主要的 fallback 原因',
        detail: `${topFallbackReason.fallbackReason} 目前出现 ${topFallbackReason.count} 次，是当前最主要的 fallback 来源。`,
        action: '优先围绕该 fallback 原因检查配置、网关延迟、模型结构返回是否合法，再决定是否需要临时灰度调整。',
      });
    }

    return suggestions.slice(0, 3);
  }

  private buildAiGovernanceAlerts(params: {
    aiEntryCount: number;
    aiFallbackCount: number;
    aiFallbackRatePercent: number;
    entrySceneBreakdown: Array<{
      scene: string;
      count: number;
      fallbackCount: number;
      fallbackRatePercent: number;
    }>;
    entryTargetWorkflowBreakdown: Array<{
      targetWorkflow: string;
      count: number;
      fallbackCount: number;
      fallbackRatePercent: number;
    }>;
  }) {
    const alerts: Array<{
      level: 'warning' | 'critical';
      title: string;
      detail: string;
    }> = [];

    if (params.aiEntryCount > 0 && params.aiFallbackRatePercent >= 20) {
      alerts.push({
        level: params.aiFallbackRatePercent >= 40 ? 'critical' : 'warning',
        title: 'AI fallback 比例达到预警阈值',
        detail: `当前 AI fallback 比例达到 ${params.aiFallbackRatePercent}%，已超过预设预警阈值。`,
      });
    }

    const sceneAlert = params.entrySceneBreakdown.find(
      (item) => item.count >= 3 && item.fallbackRatePercent >= 20,
    );
    if (sceneAlert) {
      alerts.push({
        level: sceneAlert.fallbackRatePercent >= 40 ? 'critical' : 'warning',
        title: `${sceneAlert.scene} 入口达到预警阈值`,
        detail: `${sceneAlert.scene} 入口 fallback 比例达到 ${sceneAlert.fallbackRatePercent}%，建议尽快排查入口稳定性。`,
      });
    }

    const workflowAlert = params.entryTargetWorkflowBreakdown.find(
      (item) => item.count >= 3 && item.fallbackRatePercent >= 20,
    );
    if (workflowAlert) {
      alerts.push({
        level:
          workflowAlert.fallbackRatePercent >= 40 ? 'critical' : 'warning',
        title: `${workflowAlert.targetWorkflow} 工作流达到预警阈值`,
        detail: `${workflowAlert.targetWorkflow} 入口目标工作流 fallback 比例达到 ${workflowAlert.fallbackRatePercent}%。`,
      });
    }

    return alerts.slice(0, 3);
  }

  private buildAnalysisExecutionSourceBreakdown(
    events: ReturnType<AuditEventRepository['list']>,
  ) {
    const counterMap = new Map<string, number>();

    for (const item of events) {
      const sessionSnapshot = item.sessionSnapshot as Record<string, unknown> | undefined;
      const executionTraceSummary = this.resolveExecutionTraceSummary(sessionSnapshot);
      const taskSummaries = Array.isArray(executionTraceSummary?.taskSummaries)
        ? (executionTraceSummary?.taskSummaries as Array<Record<string, unknown>>)
        : [];

      for (const task of taskSummaries) {
        const executionSource = String(task.executionSource ?? '').trim();
        if (!executionSource) {
          continue;
        }
        counterMap.set(executionSource, (counterMap.get(executionSource) ?? 0) + 1);
      }
    }

    return [...counterMap.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([executionSource, count]) => ({
        executionSource,
        count,
      }));
  }

  private buildAnalysisKnowledgeHitBreakdown(
    events: ReturnType<AuditEventRepository['list']>,
  ) {
    const counterMap = new Map<string, number>();

    for (const item of events) {
      const sessionSnapshot = item.sessionSnapshot as Record<string, unknown> | undefined;
      const executionTraceSummary = this.resolveExecutionTraceSummary(sessionSnapshot);
      const knowledgeHits = Array.isArray(executionTraceSummary?.knowledgeHits)
        ? (executionTraceSummary?.knowledgeHits as Array<Record<string, unknown>>)
        : [];

      for (const hit of knowledgeHits) {
        const key = String(hit.name ?? hit.assetId ?? '').trim();
        if (!key) {
          continue;
        }

        counterMap.set(key, (counterMap.get(key) ?? 0) + 1);
      }
    }

    return [...counterMap.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([knowledgeName, count]) => ({
        knowledgeName,
        count,
      }));
  }
}
