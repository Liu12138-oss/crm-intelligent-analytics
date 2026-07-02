/**
 * 看板问数 Controller
 *
 * 提供看板型问数的 HTTP 接口，绕过常规分析主链路的 Markdown 快照，
 * 直连联软统计接口实时组装看板结果。
 *
 * 与现有 AnalysisController 的关系：
 * - AnalysisController 仍负责常规自然语言问数（走 Markdown 快照主链）
 * - 本 Controller 只处理看板型请求（前端识别看板意图后调用本接口）
 * - 不替代常规问数，是看板场景的专用快车道
 *
 * 接口列表：
 * - GET  /api/dashboard/templates          列出看板模板
 * - POST /api/dashboard/compose            组装看板（直接指定 profile）
 * - POST /api/dashboard/templates/:id/run  按模板组装看板（支持条件改写）
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DashboardReportComposer } from './dashboard-report-composer.service';
import type { DashboardProfile } from './dashboard-report-composer.service';
import type { DashboardAnalyticsQuery } from './dashboard-analytics.service';
import {
  findDashboardTemplate,
  listDashboardTemplates,
  resolveDashboardQuery,
} from './dashboard-templates';
import { DashboardTemplateCrudService, CreateDashboardTemplateDto, UpdateDashboardTemplateDto } from './dashboard-template-crud.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { buildEntityId } from '../../shared/utils/id.util';

interface DashboardComposeDto {
  profile: DashboardProfile;
  query?: DashboardAnalyticsQuery;
  questionText?: string;
}

interface DashboardTemplateRunDto {
  overrides?: Partial<DashboardAnalyticsQuery>;
  questionText?: string;
}

interface AuthedRequest extends Request {
  crmUser?: {
    id: string;
    name: string;
    role: string;
  };
}

@Controller('dashboard')
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardReportComposer: DashboardReportComposer,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly templateCrud: DashboardTemplateCrudService,
  ) {}

  /**
   * 列出看板模板（内置 + 自定义合并）
   * 前端"常用查询-看板"区和看板模板治理页使用
   */
  @Get('templates')
  listTemplates(@Req() req: AuthedRequest) {
    const userRole = req.crmUser?.role ?? '';
    const roles = userRole ? [userRole] : [];
    const builtInTemplates = listDashboardTemplates(roles);
    const customTemplates = this.templateCrud.listAll();
    // 合并：内置在前，自定义在后，统一按 displayOrder 排序
    const merged = [...builtInTemplates, ...customTemplates].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    return {
      code: 0,
      message: 'ok',
      data: merged,
    };
  }

  /**
   * 创建自定义看板模板
   * 仅管理员可用（通过 SessionAuthGuard + 前端路由 adminOnly 双重控制）
   */
  @Post('templates')
  @HttpCode(200)
  createTemplate(@Req() req: AuthedRequest, @Body() dto: CreateDashboardTemplateDto) {
    try {
      const user = req.crmUser ?? { id: 'unknown', name: 'unknown', role: 'unknown' };
      const template = this.templateCrud.create(dto, { id: user.id, name: user.name });

      this.recordDashboardAudit(user, 'DASHBOARD_TEMPLATE_EXECUTED' as never, {
        templateId: template.templateId,
        templateName: template.name,
        profile: template.profile,
        action: 'create',
      });

      return { code: 0, message: '模板创建成功', data: template };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { code: 400, message, data: null };
    }
  }

  /**
   * 更新自定义看板模板
   */
  @Put('templates/:templateId')
  @HttpCode(200)
  updateTemplate(
    @Req() req: AuthedRequest,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateDashboardTemplateDto,
  ) {
    // 不允许修改内置模板（ID 前缀为 tpl_）
    if (templateId.startsWith('tpl_')) {
      return { code: 403, message: '内置模板不可修改', data: null };
    }

    try {
      const user = req.crmUser ?? { id: 'unknown', name: 'unknown', role: 'unknown' };
      const template = this.templateCrud.update(templateId, dto, { id: user.id, name: user.name });
      return { code: 0, message: '模板更新成功', data: template };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return message.includes('不存在') ? { code: 404, message, data: null } : { code: 400, message, data: null };
    }
  }

  /**
   * 删除自定义看板模板
   */
  @Delete('templates/:templateId')
  deleteTemplate(@Req() req: AuthedRequest, @Param('templateId') templateId: string) {
    if (templateId.startsWith('tpl_')) {
      return { code: 403, message: '内置模板不可删除', data: null };
    }

    try {
      const user = req.crmUser ?? { id: 'unknown', name: 'unknown', role: 'unknown' };
      this.templateCrud.delete(templateId, { id: user.id, name: user.name });

      this.recordDashboardAudit(user, 'DASHBOARD_TEMPLATE_EXECUTED' as never, {
        templateId,
        action: 'delete',
      });

      return { code: 0, message: '模板已删除', data: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { code: 404, message, data: null };
    }
  }

  /**
   * 获取可用看板类型选项清单（供新建/编辑表单下拉使用）
   */
  @Get('templates/profile-options')
  getProfileOptions() {
    return {
      code: 0,
      message: 'ok',
      data: this.templateCrud.getProfileOptions(),
    };
  }

  /**
   * 组装看板结果（直接指定 profile）
   *
   * 前端识别看板型意图后调用此接口，后端直连联软统计接口组装看板 block。
   * 部分统计接口失败不阻断整体，返回的 errors 字段会列出失败项。
   */
  @Post('compose')
  @HttpCode(200)
  async compose(
    @Req() req: AuthedRequest,
    @Body() dto: DashboardComposeDto,
  ) {
    const user = req.crmUser ?? { id: 'unknown', name: 'unknown', role: 'unknown' };

    const result = await this.dashboardReportComposer.compose(
      dto.profile ?? 'auto',
      dto.query ?? {},
      dto.questionText,
    );

    // 审计：看板生成
    this.recordDashboardAudit(user, 'DASHBOARD_COMPOSED', {
      profile: dto.profile,
      query: dto.query,
      questionText: dto.questionText,
      reportTitle: result.reportTitle,
      dataSource: result.dataSource,
      blockCount: result.blocks.length,
      errors: result.errors,
    });

    return {
      code: 0,
      message: 'ok',
      data: {
        ...result,
        requestedBy: user.id,
        requestedByName: user.name,
      },
    };
  }

  /**
   * 按模板组装看板（支持条件改写）
   *
   * 用户从看板模板列表选择一个模板，可通过 overrides 改写筛选条件。
   * 后端合并模板默认参数和用户改写参数后调用组装器。
   */
  @Post('templates/:templateId/run')
  @HttpCode(200)
  async runTemplate(
    @Req() req: AuthedRequest,
    @Param('templateId') templateId: string,
    @Body() dto: DashboardTemplateRunDto,
  ) {
    const template = findDashboardTemplate(templateId);
    if (!template) {
      return {
        code: 404,
        message: `看板模板 ${templateId} 不存在`,
        data: null,
      };
    }

    const user = req.crmUser ?? { id: 'unknown', name: 'unknown', role: 'unknown' };
    const query = resolveDashboardQuery(templateId, dto.overrides ?? {});

    const result = await this.dashboardReportComposer.compose(
      template.profile,
      query,
      dto.questionText,
    );

    // 审计：看板模板执行
    this.recordDashboardAudit(user, 'DASHBOARD_TEMPLATE_EXECUTED', {
      templateId: template.templateId,
      templateName: template.name,
      profile: template.profile,
      overrides: dto.overrides,
      questionText: dto.questionText,
      reportTitle: result.reportTitle,
      dataSource: result.dataSource,
      blockCount: result.blocks.length,
      errors: result.errors,
    });

    return {
      code: 0,
      message: 'ok',
      data: {
        ...result,
        templateId: template.templateId,
        templateName: template.name,
        requestedBy: user.id,
        requestedByName: user.name,
      },
    };
  }

  /**
   * 记录看板相关审计事件
   *
   * 看板生成、模板执行、查看行为都需要留痕，便于治理审计追踪。
   */
  private recordDashboardAudit(
    user: { id: string; name: string; role: string },
    eventType: 'DASHBOARD_COMPOSED' | 'DASHBOARD_VIEWED' | 'DASHBOARD_TEMPLATE_EXECUTED',
    detail: Record<string, unknown>,
  ): void {
    try {
      this.auditEventRepository.create({
        id: buildEntityId('audit_event'),
        eventType: eventType as never,
        actorId: user.id,
        actorType: 'crm-user',
        actorRoleIds: user.role ? [user.role] : [],
        scopeSnapshot: {
          source: 'dashboard',
          ...detail,
        },
        riskLevel: 'info',
        reviewStatus: 'auto',
        detail,
        occurredAt: new Date().toISOString(),
      } as never);
    } catch {
      // 审计写入失败不阻断看板生成
    }
  }
}
