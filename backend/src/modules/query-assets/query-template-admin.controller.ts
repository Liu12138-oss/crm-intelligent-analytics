import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type { QueryTemplateRecord } from '../../shared/types/domain';
import { QueryTemplateExecutionService } from './query-template-execution.service';
import { QueryTemplateService } from './query-template.service';
import { toQueryTemplateResponse } from './query-template.mapper';

@Controller('governance/query-templates')
@UseGuards(SessionAuthGuard)
export class QueryTemplateAdminController {
  constructor(
    private readonly queryTemplateService: QueryTemplateService,
    private readonly queryTemplateExecutionService: QueryTemplateExecutionService,
    private readonly crmReadonlyService: CrmReadonlyService,
  ) {}

  @Get()
  async listGovernanceTemplates(@Req() request: Request & { crmUser: any }) {
    const templates = this.queryTemplateService.listForGovernance(request.crmUser);
    const ownerNameMap = await this.resolveTemplateOwnerNameMap(templates);
    return {
      items: templates.map((item) => toQueryTemplateResponse(item, {
        ownerName: this.resolveTemplateOwnerName(item, ownerNameMap),
      })),
    };
  }

  @Get('facets')
  listGovernanceTemplateFacets(@Req() request: Request & { crmUser: any }) {
    return this.queryTemplateService.listTemplateTagOptions(request.crmUser);
  }

  @Post()
  async createGovernanceTemplate(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, any>,
  ) {
    const validation = this.queryTemplateExecutionService.validate(
      body.sqlText ?? 'SELECT 1 AS placeholder_value',
    );
    const template = this.queryTemplateService.create(request.crmUser, {
      name: body.name,
      description: body.description,
      tags: body.tags,
      defaultQuestionText: body.defaultQuestionText,
      defaultFilters: body.defaultFilters,
      defaultViewType: body.defaultViewType,
      queryMode: 'FIXED_SQL',
      sqlText: body.sqlText ?? 'SELECT 1 AS placeholder_value',
      sqlVersion: body.sqlVersion ?? '2026.05.11',
      scopeMode: validation.scopeAnalysis?.scopeMode,
      scopeGovernanceSnapshot: validation.scopeAnalysis
        ? {
            ...validation.scopeAnalysis,
            generatedAt: new Date().toISOString(),
            governanceVersion: '2026.05.19-template-scope-governance',
          }
        : undefined,
      parameterSchema: body.parameterSchema ?? [],
      renderConfig: body.renderConfig ?? {
        primaryViewType: body.defaultViewType ?? 'TABLE',
        primaryTitle: body.name ?? '新增模板结果',
      },
      visibleRoleIds: body.visibleRoleIds,
      ownerUserId: body.ownerUserId ?? request.crmUser.id,
      visibilityType: body.visibilityType ?? 'SHARED',
      displayOrder: body.displayOrder,
      clickCount7d: 0,
      usageCountTotal: 0,
      hitRatePercent: 0,
      optimizationStatus: 'HEALTHY',
      status: body.status,
      sourceType: body.sourceType ?? 'GOVERNANCE_CREATED',
      sourceQueryId: body.sourceQueryId,
      sourceTemplateId: body.sourceTemplateId,
      sourceSnapshot: body.sourceSnapshot,
      validationSnapshot: validation,
      lastValidatedAt: new Date().toISOString(),
    });
    const ownerNameMap = await this.resolveTemplateOwnerNameMap([template]);
    return toQueryTemplateResponse(template, {
      ownerName: this.resolveTemplateOwnerName(template, ownerNameMap),
    });
  }

  @Put(':templateId')
  async updateGovernanceTemplate(
    @Req() request: Request & { crmUser: any },
    @Param('templateId') templateId: string,
    @Body() body: Record<string, any>,
  ) {
    const validation = this.queryTemplateExecutionService.validate(
      body.sqlText ?? 'SELECT 1 AS placeholder_value',
    );
    const template = this.queryTemplateService.update(request.crmUser, templateId, {
      name: body.name,
      description: body.description,
      tags: body.tags,
      defaultQuestionText: body.defaultQuestionText,
      defaultFilters: body.defaultFilters,
      defaultViewType: body.defaultViewType,
      queryMode: 'FIXED_SQL',
      sqlText: body.sqlText ?? 'SELECT 1 AS placeholder_value',
      sqlVersion: body.sqlVersion ?? '2026.05.11',
      scopeMode: validation.scopeAnalysis?.scopeMode,
      scopeGovernanceSnapshot: validation.scopeAnalysis
        ? {
            ...validation.scopeAnalysis,
            generatedAt: new Date().toISOString(),
            governanceVersion: '2026.05.19-template-scope-governance',
          }
        : undefined,
      parameterSchema: body.parameterSchema ?? [],
      renderConfig: body.renderConfig ?? {
        primaryViewType: body.defaultViewType ?? 'TABLE',
        primaryTitle: body.name ?? '模板结果',
      },
      visibleRoleIds: body.visibleRoleIds,
      ownerUserId: body.ownerUserId ?? request.crmUser.id,
      visibilityType: body.visibilityType ?? 'SHARED',
      displayOrder: body.displayOrder,
      clickCount7d: body.clickCount7d ?? 0,
      usageCountTotal: body.usageCountTotal ?? body.clickCount7d ?? 0,
      lastUsedAt: body.lastUsedAt,
      hitRatePercent: body.hitRatePercent ?? 0,
      optimizationStatus: body.optimizationStatus ?? 'HEALTHY',
      status: body.status,
      sourceType: body.sourceType ?? 'GOVERNANCE_CREATED',
      sourceQueryId: body.sourceQueryId,
      sourceTemplateId: body.sourceTemplateId,
      sourceSnapshot: body.sourceSnapshot,
      validationSnapshot: validation,
      lastValidatedAt: new Date().toISOString(),
    });
    const ownerNameMap = await this.resolveTemplateOwnerNameMap([template]);
    return toQueryTemplateResponse(template, {
      ownerName: this.resolveTemplateOwnerName(template, ownerNameMap),
    });
  }

  @Delete(':templateId')
  removeGovernanceTemplate(
    @Req() request: Request & { crmUser: any },
    @Param('templateId') templateId: string,
  ) {
    return this.queryTemplateService.remove(request.crmUser, templateId);
  }

  @Post(':templateId/validate')
  validateGovernanceTemplate(
    @Req() request: Request & { crmUser: any },
    @Param('templateId') templateId: string,
    @Body() body: Record<string, any>,
  ) {
    this.queryTemplateService.ensureTemplateSqlWriteAccess(request.crmUser);
    const result = this.queryTemplateExecutionService.validate(body.sqlText);
    return {
      templateId,
      ...result,
    };
  }

  @Post(':templateId/preview')
  previewGovernanceTemplate(
    @Req() request: Request & { crmUser: any },
    @Param('templateId') templateId: string,
    @Body() body: Record<string, any>,
  ) {
    this.queryTemplateService.ensureTemplateSqlWriteAccess(request.crmUser);
    return this.queryTemplateExecutionService.preview(request.crmUser, templateId, {
      parameters: body.parameters ?? {},
    });
  }

  /**
   * 批量解析模板归属用户姓名，治理列表也必须展示业务姓名，避免维护人员误读内部用户 ID。
   *
   * @param templates 当前响应涉及的模板集合。
   * @returns 以 CRM 用户 ID 为 key 的姓名映射。
   */
  private async resolveTemplateOwnerNameMap(
    templates: QueryTemplateRecord[],
  ): Promise<Map<string, string>> {
    const ownerIds = templates
      .map((item) => item.ownerUserId ?? item.ownedBy)
      .filter((item): item is string => Boolean(item));

    return this.crmReadonlyService.listUserDisplayNamesByIdentifiers(ownerIds, { audit: false });
  }

  /**
   * 返回模板归属用户姓名；历史用户无法解析时保留 ID，便于治理后台继续定位数据来源。
   *
   * @param template 查询模板记录。
   * @param ownerNameMap 归属用户 ID 到姓名的映射。
   * @returns 面向治理用户展示的归属用户名称。
   */
  private resolveTemplateOwnerName(
    template: QueryTemplateRecord,
    ownerNameMap: Map<string, string>,
  ): string | undefined {
    const ownerId = template.ownerUserId ?? template.ownedBy;
    if (!ownerId) {
      return undefined;
    }
    return ownerNameMap.get(ownerId) ?? ownerId;
  }
}
