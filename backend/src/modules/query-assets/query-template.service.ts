import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { buildEntityId } from '../../shared/utils/id.util';
import type { CrmUser, QueryTemplateRecord } from '../../shared/types/domain';
import { AnalysisRequestRepository } from '../analysis/analysis-request.repository';
import { QueryRiskGuardService } from '../analysis/query-risk-guard.service';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { AccessDecisionService } from '../governance/access-decision.service';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { QueryTemplateRepository } from './query-template.repository';
import { QueryTemplateScopeAnalyzerService } from './query-template-scope-analyzer.service';
import { QueryTemplateSqlGuardService } from './query-template-sql-guard.service';
import { normalizeGeneratedQueryTemplateSql } from './query-template-sql.runtime';

const SYSTEM_SOURCE_TAGS = new Set(['内置模板', '常用查询', '猜你想查']);

export interface QueryTemplateListOptions {
  scope?: 'mine' | 'others' | 'all';
  keyword?: string;
  tag?: string;
  ownerUserId?: string;
  page?: number;
  pageSize?: number;
  sort?: 'usage_desc' | 'display_order';
}

export interface QueryTemplateListResult {
  items: QueryTemplateRecord[];
  page: number;
  pageSize: number;
  total: number;
  tags: string[];
}

export interface UpdateMyQueryTemplatePayload {
  name?: string;
  description?: string;
  defaultQuestionText?: string;
  defaultViewType?: string;
  tags?: string[];
}

@Injectable()
export class QueryTemplateService {
  constructor(
    private readonly queryTemplateRepository: QueryTemplateRepository,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly analysisRequestRepository: AnalysisRequestRepository,
    private readonly queryTemplateSqlGuardService: QueryTemplateSqlGuardService,
    private readonly queryTemplateScopeAnalyzerService: QueryTemplateScopeAnalyzerService,
    private readonly queryRiskGuardService: QueryRiskGuardService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
  ) {}

  /**
   * 读取当前用户在工作台可执行的常用查询模板。
   *
   * @param user 当前登录 CRM 用户，必须已完成会话鉴权并带有实时角色与管理员标识。
   * @returns 只要用户具备智能分析菜单可见资格，就返回全部启用模板。
   * @throws 当前方法不抛权限异常，避免工作台首屏因模板入口缺失阻断主页面加载。
   */
  listVisible(user: CrmUser, options: QueryTemplateListOptions = {}): QueryTemplateListResult {
    if (
      !this.accessDecisionService.hasVisibleMenu(user, 'analysis-workbench') ||
      !this.accessDecisionService.hasAction(user, 'template.view')
    ) {
      return this.paginate([], options);
    }

    const visibleTemplates = this.queryTemplateRepository
      .listAll()
      .filter((item) => item.status === 'ACTIVE')
      .filter((item) => this.canReadTemplate(user, item));

    return this.paginate(this.filterTemplates(user, visibleTemplates, options), options);
  }

  /**
   * 统计当前用户可见的启用模板数量。
   *
   * @param user 当前登录 CRM 用户，权限口径与 `listVisible` 完全一致。
   * @returns 当前用户可见模板总数，用于能力快照和前端状态展示。
   * @throws 当前方法不抛权限异常，保持能力快照接口稳定返回。
   */
  countVisible(user: CrmUser): number {
    return this.listVisible(user).total;
  }

  /**
   * 读取当前用户可见的单个模板详情。
   *
   * @param user 当前登录 CRM 用户，权限口径与工作台模板列表保持一致。
   * @param templateId 待查看模板编号，必须存在且当前用户可读。
   * @returns 包含 SQL、默认问题和展示配置的完整模板记录。
   * @throws NotFoundException 当模板不存在、未启用或当前用户不可读时抛出。
   */
  getVisibleTemplate(user: CrmUser, templateId: string): QueryTemplateRecord {
    const template = this.queryTemplateRepository.findById(templateId);
    if (!template || template.status !== 'ACTIVE' || !this.canReadTemplate(user, template)) {
      throw new NotFoundException('查询模板不存在。');
    }

    return template;
  }

  /**
   * 读取治理后台模板清单。
   *
   * @param user 当前登录 CRM 用户，必须具备模板治理动作权限。
   * @returns 全量模板记录，包含停用和已替代模板，供治理后台审计与调整。
   * @throws ForbiddenException 当用户不具备 `template.manage` 时抛出。
   */
  listForGovernance(user: CrmUser): QueryTemplateRecord[] {
    this.ensureTemplateManageAccess(user);
    return this.queryTemplateRepository.listAll();
  }

  /**
   * 新建查询模板并归属到当前治理操作者。
   *
   * @param user 当前登录 CRM 用户，必须具备 `template.manage` 动作权限。
   * @param payload 前端提交的模板主体信息，不包含系统生成的编号、归属人和更新时间。
   * @returns 已持久化的新模板记录。
   * @throws ForbiddenException 当用户不具备模板治理权限时抛出。
   */
  create(user: CrmUser, payload: Omit<QueryTemplateRecord, 'id' | 'ownedBy' | 'updatedAt'>): QueryTemplateRecord {
    this.ensureTemplateWriteAccess(user);
    return this.queryTemplateRepository.save({
      ...payload,
      id: buildEntityId('tpl'),
      ownedBy: user.id,
      ownerUserId: payload.ownerUserId ?? user.id,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 更新既有查询模板的治理配置。
   *
   * @param user 当前登录 CRM 用户，必须具备 `template.manage` 动作权限。
   * @param templateId 待更新模板编号，必须对应已存在的模板记录。
   * @param payload 前端提交的模板主体信息，不允许覆盖模板编号、归属人和更新时间。
   * @returns 已更新的模板记录。
   * @throws ForbiddenException 当用户不具备模板治理权限时抛出。
   * @throws NotFoundException 当模板编号不存在时抛出。
   */
  update(
    user: CrmUser,
    templateId: string,
    payload: Omit<QueryTemplateRecord, 'id' | 'ownedBy' | 'updatedAt'>,
  ): QueryTemplateRecord {
    this.ensureTemplateWriteAccess(user);
    const currentTemplate = this.queryTemplateRepository.findById(templateId);
    if (!currentTemplate) {
      throw new NotFoundException('查询模板不存在。');
    }

    return this.queryTemplateRepository.save({
      ...currentTemplate,
      ...payload,
      ownerUserId: payload.ownerUserId ?? currentTemplate.ownerUserId,
      updatedAt: new Date().toISOString(),
    });
  }

  copyToMine(user: CrmUser, templateId: string): QueryTemplateRecord {
    const currentTemplate = this.queryTemplateRepository.findById(templateId);
    if (!currentTemplate || currentTemplate.status !== 'ACTIVE') {
      throw new NotFoundException('查询模板不存在。');
    }
    if (!this.canReadTemplate(user, currentTemplate)) {
      throw new NotFoundException('查询模板不存在。');
    }

    const copiedAt = new Date().toISOString();
    const copiedTemplate = this.queryTemplateRepository.save({
      ...currentTemplate,
      id: buildEntityId('tpl'),
      sourceType: 'COPIED_FROM_TEMPLATE',
      sourceTemplateId: currentTemplate.id,
      sourceSnapshot: {
        sourceTemplateId: currentTemplate.id,
        sourceTemplateName: currentTemplate.name,
        sourceSqlVersion: currentTemplate.sqlVersion,
        copiedAt,
      },
      ownerUserId: user.id,
      ownedBy: user.id,
      visibilityType: 'PRIVATE',
      usageCountTotal: 0,
      clickCount7d: 0,
      lastUsedAt: undefined,
      updatedAt: copiedAt,
    });

    this.auditTemplateEvent(user, 'QUERY_TEMPLATE_COPIED', copiedTemplate, '已添加到我的模板。');
    return copiedTemplate;
  }

  saveQueryAsTemplate(
    user: CrmUser,
    queryId: string,
    payload: {
      name?: string;
      description?: string;
      tags?: string[];
      visibilityType?: 'PRIVATE' | 'SHARED';
      renderConfig?: QueryTemplateRecord['renderConfig'];
    },
  ): QueryTemplateRecord {
    const request = this.analysisRequestRepository.findRequestById(queryId);
    const result = this.analysisRequestRepository.findResultByRequestId(queryId);
    const now = new Date().toISOString();

    if (!request || !result || request.requesterId !== user.id || request.status !== 'RETURNED') {
      this.auditTemplateSaveFailure(user, queryId, '只能保存当前用户已成功返回的问数结果。');
      throw new BadRequestException('只能保存你本人已成功返回的问数结果。');
    }

    const rawSqlText = request.generatedQuery?.trim();
    if (!rawSqlText) {
      this.auditTemplateSaveFailure(user, queryId, '当前问数结果缺少可复现 SQL。');
      throw new BadRequestException(
        '当前问数结果暂时不能保存为模板，因为系统没有保留可复现的受控查询。请重新发起一次分析后再试。',
      );
    }

    const normalizedTemplateSource = rawSqlText.includes('?')
      ? normalizeGeneratedQueryTemplateSql({
          sqlText: rawSqlText,
          defaultFilters: request.filters ?? {},
        })
      : {
          sqlText: rawSqlText,
          defaultFilters: request.filters ?? {},
        };
    const sqlText = normalizedTemplateSource.sqlText;

    try {
      this.queryTemplateSqlGuardService.validateReadonlyTemplateSql(sqlText);
      this.queryRiskGuardService.ensureQuerySafe(sqlText);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '模板 SQL 未通过安全校验。';
      this.auditTemplateSaveFailure(user, queryId, reason);
      throw error;
    }

    const scopeAnalysis = this.queryTemplateScopeAnalyzerService.analyze(sqlText);
    const name = payload.name?.trim() || result.title || request.questionText || '我的查询模板';
    const description =
      payload.description?.trim() ||
      result.summary ||
      '由自由问数结果保存生成，可按当前用户权限重新执行。';
    const savedTemplate = this.queryTemplateRepository.save({
      id: buildEntityId('tpl'),
      name,
      description,
      tags: this.normalizeTags(payload.tags),
      defaultQuestionText: request.questionText ?? name,
      defaultFilters: normalizedTemplateSource.defaultFilters,
      defaultViewType: result.primaryView?.viewType ?? 'DETAIL_TABLE',
      queryMode: 'FIXED_SQL',
      sqlText,
      sqlVersion: `saved-${queryId}`,
      sourceType: 'FREE_QUERY_SAVED',
      sourceQueryId: queryId,
      sourceSnapshot: {
        sourceQueryId: queryId,
        sourceQuestionText: request.questionText,
        savedAt: now,
      },
      scopeMode: scopeAnalysis.scopeMode,
      scopeGovernanceSnapshot: {
        ...scopeAnalysis,
        generatedAt: now,
        governanceVersion: '2026.05.28-common-query-template-library',
      },
      parameterSchema: [],
      renderConfig: payload.renderConfig ?? {
        primaryViewType: this.resolveRenderPrimaryViewType(result.primaryView?.viewType),
        primaryTitle: result.primaryView?.title ?? name,
        tableColumns: result.primaryView?.columns,
      },
      visibleRoleIds: [],
      ownerUserId: user.id,
      visibilityType: payload.visibilityType ?? 'SHARED',
      displayOrder: 99,
      clickCount7d: 0,
      usageCountTotal: 0,
      hitRatePercent: 0,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      ownedBy: user.id,
      updatedAt: now,
      validationSnapshot: {
        status: scopeAnalysis.scopeClassification === 'UNSAFE_SCOPE' ? 'FAILED' : 'PASSED',
        message: scopeAnalysis.friendlyMessage,
        scopeAnalysis,
      },
      lastValidatedAt: now,
    });

    this.auditTemplateEvent(user, 'QUERY_TEMPLATE_SAVE_SUCCEEDED', savedTemplate, '自由问数已保存为模板。');
    return savedTemplate;
  }

  listTemplateTagOptions(user: CrmUser): { tags: string[] } {
    const visibleTemplates = this.listVisible(user, {
      scope: 'all',
      page: 1,
      pageSize: 5000,
    });

    return {
      tags: visibleTemplates.tags,
    };
  }

  /**
   * 删除治理后台中的查询模板。
   *
   * @param user 当前登录 CRM 用户，必须具备 `template.manage` 动作权限。
   * @param templateId 待删除模板编号，必须对应已存在模板。
   * @returns 删除成功后的确认结果，供前端列表即时收敛状态。
   * @throws ForbiddenException 当用户不具备模板治理权限时抛出。
   * @throws NotFoundException 当模板编号不存在时抛出。
   */
  remove(
    user: CrmUser,
    templateId: string,
  ): { success: true; templateId: string } {
    this.ensureTemplateManageAccess(user);
    const removed = this.queryTemplateRepository.remove(templateId);

    if (!removed) {
      throw new NotFoundException('查询模板不存在。');
    }

    return {
      success: true,
      templateId,
    };
  }

  /**
   * 删除工作台“我的模板”中的个人模板。
   *
   * @param user 当前登录 CRM 用户，必须是模板 owner，且模板仍按实时权限可读取。
   * @param templateId 待删除模板编号，只允许删除当前用户自己的副本或自建模板。
   * @returns 删除成功后的确认结果，供前端刷新“我的模板”列表。
   * @throws NotFoundException 当模板不存在或当前用户不可见时抛出，避免泄露其它用户模板存在性。
   * @throws ForbiddenException 当模板可见但不归属当前用户时抛出。
   */
  removeMine(
    user: CrmUser,
    templateId: string,
  ): { success: true; templateId: string } {
    const currentTemplate = this.queryTemplateRepository.findById(templateId);
    if (!currentTemplate || !this.canReadTemplate(user, currentTemplate)) {
      throw new NotFoundException('查询模板不存在。');
    }

    const ownerId = currentTemplate.ownerUserId ?? currentTemplate.ownedBy;
    if (ownerId !== user.id) {
      throw new ForbiddenException('只能删除你自己的查询模板。');
    }

    const removed = this.queryTemplateRepository.remove(templateId);
    if (!removed) {
      throw new NotFoundException('查询模板不存在。');
    }

    return {
      success: true,
      templateId,
    };
  }

  /**
   * 更新工作台“我的模板”详情抽屉中的基础展示信息。
   *
   * @param user 当前登录 CRM 用户，只允许编辑归属于自己的模板。
   * @param templateId 待更新模板编号，必须仍按实时权限可读取。
   * @param payload 仅包含名称、说明、默认问题、默认视图和标签，不能覆盖 SQL、权限、归属和白名单边界。
   * @returns 已更新的模板记录。
   * @throws NotFoundException 当模板不存在或当前用户不可读时抛出。
   * @throws ForbiddenException 当模板可读但不归属当前用户时抛出。
   * @throws BadRequestException 当必填展示字段为空时抛出。
   */
  updateMine(
    user: CrmUser,
    templateId: string,
    payload: UpdateMyQueryTemplatePayload,
  ): QueryTemplateRecord {
    const currentTemplate = this.queryTemplateRepository.findById(templateId);
    if (!currentTemplate || !this.canReadTemplate(user, currentTemplate)) {
      throw new NotFoundException('查询模板不存在。');
    }

    const ownerId = currentTemplate.ownerUserId ?? currentTemplate.ownedBy;
    if (ownerId !== user.id) {
      throw new ForbiddenException('只能编辑你自己的查询模板。');
    }

    const name = String(payload.name ?? currentTemplate.name).trim();
    const description = String(payload.description ?? currentTemplate.description).trim();
    const defaultQuestionText = String(
      payload.defaultQuestionText ?? currentTemplate.defaultQuestionText ?? name,
    ).trim();
    if (!name) {
      throw new BadRequestException('模板名称不能为空。');
    }
    if (!description) {
      throw new BadRequestException('模板说明不能为空。');
    }
    if (!defaultQuestionText) {
      throw new BadRequestException('默认问题不能为空。');
    }

    const defaultViewType = this.resolveEditableDefaultViewType(
      payload.defaultViewType,
      currentTemplate.defaultViewType,
    );
    const primaryViewType = this.resolveRenderPrimaryViewType(defaultViewType);
    const updatedTemplate = this.queryTemplateRepository.save({
      ...currentTemplate,
      name,
      description,
      defaultQuestionText,
      defaultViewType,
      tags: Array.isArray(payload.tags)
        ? this.normalizeTags(payload.tags)
        : currentTemplate.tags,
      renderConfig: {
        ...currentTemplate.renderConfig,
        primaryViewType,
        primaryTitle: name,
      },
      updatedAt: new Date().toISOString(),
    });

    this.auditTemplateEvent(user, 'QUERY_TEMPLATE_TAGS_UPDATED', updatedTemplate, '我的模板基础信息已更新。');
    return updatedTemplate;
  }

  /**
   * 校验模板治理动作权限。
   *
   * @param user 当前登录 CRM 用户，需携带实时角色权限快照。
   * @returns 无返回值，校验通过后允许调用方继续执行治理写操作。
   * @throws ForbiddenException 当用户缺少 `template.manage` 时抛出，并记录权限拒绝审计上下文。
   */
  private ensureTemplateManageAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'template.manage',
      '当前用户无权管理查询模板。',
      {
        channel: 'web-console',
        resourceType: 'query-template',
      },
    );
  }

  ensureTemplateSqlWriteAccess(user: CrmUser): void {
    this.ensureTemplateWriteAccess(user);
  }

  private ensureTemplateWriteAccess(user: CrmUser): void {
    if (
      this.accessDecisionService.hasAction(user, 'template.manage') ||
      this.accessDecisionService.hasAction(user, 'template.sql.write')
    ) {
      return;
    }

    this.permissionEnforcementService.ensureAction(
      user,
      'template.sql.write',
      '当前用户无权编写查询模板 SQL。',
      {
        channel: 'web-console',
        resourceType: 'query-template',
      },
    );
  }

  private filterTemplates(
    user: CrmUser,
    templates: QueryTemplateRecord[],
    options: QueryTemplateListOptions,
  ): QueryTemplateRecord[] {
    const keyword = options.keyword?.trim().toLowerCase();
    return templates
      .filter((item) => {
        if (options.scope === 'mine') {
          return item.ownerUserId === user.id;
        }
        if (options.scope === 'others') {
          return item.ownerUserId !== user.id && item.visibilityType === 'SHARED';
        }
        return true;
      })
      .filter((item) => !options.tag || (item.tags ?? []).includes(options.tag))
      .filter((item) => !options.ownerUserId || item.ownerUserId === options.ownerUserId)
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        return [item.name, item.description, ...(item.tags ?? [])]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      });
  }

  private paginate(
    templates: QueryTemplateRecord[],
    options: QueryTemplateListOptions,
  ): QueryTemplateListResult {
    const page = Math.max(1, Number(options.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(options.pageSize ?? 20)));
    const sortedTemplates = [...templates].sort((left, right) => {
      if (options.sort === 'usage_desc') {
        return (
          (right.usageCountTotal ?? 0) - (left.usageCountTotal ?? 0) ||
          right.clickCount7d - left.clickCount7d ||
          left.displayOrder - right.displayOrder
        );
      }
      return left.displayOrder - right.displayOrder;
    });
    const tags = Array.from(
      new Set(
        templates
          .flatMap((item) => item.tags ?? [])
          .filter(
            (item): item is string =>
              Boolean(item) && !SYSTEM_SOURCE_TAGS.has(item),
          ),
      ),
    ).sort();
    const startIndex = (page - 1) * pageSize;

    return {
      items: sortedTemplates.slice(startIndex, startIndex + pageSize),
      page,
      pageSize,
      total: templates.length,
      tags,
    };
  }

  private canReadTemplate(user: CrmUser, template: QueryTemplateRecord): boolean {
    if ((template.ownerUserId ?? template.ownedBy) === user.id) {
      return true;
    }
    if ((template.visibilityType ?? 'SHARED') !== 'SHARED') {
      return false;
    }
    if (user.isAdmin || template.visibleRoleIds.length === 0) {
      return true;
    }
    return template.visibleRoleIds.some((roleId) => user.roleIds.includes(roleId));
  }

  private normalizeTags(tags: unknown): string[] {
    if (!Array.isArray(tags)) {
      return [];
    }
    return Array.from(new Set(tags.map((item) => String(item).trim()).filter(Boolean)));
  }

  private resolveEditableDefaultViewType(
    nextViewType: unknown,
    currentViewType?: QueryTemplateRecord['defaultViewType'],
  ): QueryTemplateRecord['defaultViewType'] {
    if (
      nextViewType === 'DETAIL_TABLE' ||
      nextViewType === 'RANKING_TABLE' ||
      nextViewType === 'BAR_CHART' ||
      nextViewType === 'LINE_CHART' ||
      nextViewType === 'METRIC_CARDS'
    ) {
      return nextViewType;
    }

    return currentViewType;
  }

  private resolveRenderPrimaryViewType(
    viewType?: string,
  ): QueryTemplateRecord['renderConfig']['primaryViewType'] {
    if (viewType === 'BAR_CHART' || viewType === 'LINE_CHART' || viewType === 'RANKING_TABLE') {
      return viewType;
    }
    if (viewType === 'METRIC_CARDS') {
      return 'STAT_ONLY';
    }
    return 'TABLE';
  }

  private auditTemplateSaveFailure(user: CrmUser, queryId: string, reason: string): void {
    if (!this.auditEventRepository || !this.userScopeService) {
      return;
    }
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'QUERY_TEMPLATE_SAVE_FAILED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      channel: 'web-console',
      relatedRequestId: queryId,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: reason,
      failureReason: reason,
      createdAt: new Date().toISOString(),
    });
  }

  private auditTemplateEvent(
    user: CrmUser,
    eventType:
      | 'QUERY_TEMPLATE_COPIED'
      | 'QUERY_TEMPLATE_SAVE_SUCCEEDED'
      | 'QUERY_TEMPLATE_TAGS_UPDATED',
    template: QueryTemplateRecord,
    outcome: string,
  ): void {
    if (!this.auditEventRepository || !this.userScopeService) {
      return;
    }
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType,
      actorId: user.id,
      actorRoleIds: user.roleIds,
      channel: 'web-console',
      relatedTemplateId: template.id,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        tags: template.tags,
        sourceType: template.sourceType,
        sourceTemplateId: template.sourceTemplateId,
        sourceQueryId: template.sourceQueryId,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome,
      createdAt: new Date().toISOString(),
    });
  }
}
