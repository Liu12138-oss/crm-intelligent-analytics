import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { CrmUser } from '../../shared/types/domain';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { QueryTemplateExecutionService } from './query-template-execution.service';
import { QueryTemplateService } from './query-template.service';
import { toQueryTemplateResponse } from './query-template.mapper';

@Controller('analysis/templates')
@UseGuards(SessionAuthGuard)
export class QueryTemplateController {
  constructor(
    private readonly queryTemplateService: QueryTemplateService,
    private readonly queryTemplateExecutionService: QueryTemplateExecutionService,
    private readonly crmReadonlyService: CrmReadonlyService,
  ) {}

  @Get()
  async listVisibleTemplates(
    @Req() request: Request & { crmUser: any },
    @Query() query: Record<string, string | undefined>,
  ) {
    const result = this.queryTemplateService.listVisible(request.crmUser, {
      scope: query.scope === 'mine' || query.scope === 'others' || query.scope === 'all'
        ? query.scope
        : undefined,
      keyword: query.keyword,
      tag: query.tag,
      ownerUserId: query.ownerUserId,
      page: Number(query.page ?? 1),
      pageSize: Number(query.pageSize ?? 20),
      sort: query.sort === 'usage_desc' ? 'usage_desc' : 'display_order',
    });

    const ownerNameMap = await this.resolveTemplateOwnerNameMap(result.items);
    return {
      ...result,
      items: result.items.map((item) => toQueryTemplateResponse(item, {
        ownerName: this.resolveTemplateOwnerName(item, ownerNameMap),
      })),
    };
  }

  @Get('facets')
  listTemplateFacets(@Req() request: Request & { crmUser: CrmUser }) {
    return this.queryTemplateService.listTemplateTagOptions(request.crmUser);
  }

  @Get(':templateId')
  async getVisibleTemplate(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('templateId') templateId: string,
  ) {
    const template = this.queryTemplateService.getVisibleTemplate(request.crmUser, templateId);
    const ownerNameMap = await this.resolveTemplateOwnerNameMap([template]);
    return toQueryTemplateResponse(
      template,
      { ownerName: this.resolveTemplateOwnerName(template, ownerNameMap) },
    );
  }

  @Post(':templateId/copy-to-mine')
  async copyToMine(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('templateId') templateId: string,
  ) {
    const template = this.queryTemplateService.copyToMine(request.crmUser, templateId);
    const ownerNameMap = await this.resolveTemplateOwnerNameMap([template]);
    return toQueryTemplateResponse(
      template,
      { ownerName: this.resolveTemplateOwnerName(template, ownerNameMap) },
    );
  }

  @Delete(':templateId')
  removeMyTemplate(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('templateId') templateId: string,
  ) {
    return this.queryTemplateService.removeMine(request.crmUser, templateId);
  }

  @Put(':templateId')
  async updateMyTemplate(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('templateId') templateId: string,
    @Body() body: {
      name?: string;
      description?: string;
      defaultQuestionText?: string;
      defaultViewType?: string;
      tags?: string[];
    },
  ) {
    const template = this.queryTemplateService.updateMine(request.crmUser, templateId, body);
    const ownerNameMap = await this.resolveTemplateOwnerNameMap([template]);
    return toQueryTemplateResponse(
      template,
      { ownerName: this.resolveTemplateOwnerName(template, ownerNameMap) },
    );
  }

  @Post(':templateId/execute')
  executeTemplate(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('templateId') templateId: string,
    @Body() body: {
      parameters?: Record<string, unknown>;
      includeAiReport?: boolean;
      scopeRewriteConfirmed?: boolean;
    },
  ) {
    return this.queryTemplateExecutionService.execute(request.crmUser, templateId, body);
  }

  /**
   * 批量解析模板归属用户姓名，避免工作台和详情抽屉把 CRM 用户 ID 直接暴露给业务用户。
   *
   * @param templates 当前响应涉及的模板集合。
   * @returns 以 CRM 用户 ID 为 key 的姓名映射；解析失败时调用方会按系统模板或 ID 降级。
   */
  private async resolveTemplateOwnerNameMap(
    templates: Array<{ ownerUserId?: string; ownedBy?: string }>,
  ): Promise<Map<string, string>> {
    const ownerIds = templates
      .map((item) => item.ownerUserId ?? item.ownedBy)
      .filter((item): item is string => Boolean(item));

    return this.crmReadonlyService.listUserDisplayNamesByIdentifiers(ownerIds, { audit: false });
  }

  /**
   * 优先返回归属用户姓名，只有历史数据无法解析姓名时才保留 ID 作为排障兜底。
   *
   * @param template 查询模板记录。
   * @param ownerNameMap 归属用户 ID 到中文姓名的映射。
   * @returns 面向业务用户展示的归属用户名称。
   */
  private resolveTemplateOwnerName(
    template: { ownerUserId?: string; ownedBy?: string },
    ownerNameMap: Map<string, string>,
  ): string | undefined {
    const ownerId = template.ownerUserId ?? template.ownedBy;
    if (!ownerId) {
      return undefined;
    }
    return ownerNameMap.get(ownerId) ?? ownerId;
  }
}
