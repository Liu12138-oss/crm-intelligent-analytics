import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { CrmUser } from '../../shared/types/domain';
import { PermissionEnforcementService } from './permission-enforcement.service';
import { AnalysisSemanticKnowledgeGovernanceService } from './analysis-semantic-knowledge.service';
import {
  semanticKnowledgeAssetStatusSchema,
  semanticKnowledgeAssetWriteSchema,
  semanticKnowledgePublishSchema,
  semanticKnowledgeRollbackSchema,
} from './analysis-semantic-knowledge.schema';

@Controller('governance/semantic-knowledge')
@UseGuards(SessionAuthGuard)
export class AnalysisSemanticKnowledgeGovernanceController {
  constructor(
    private readonly semanticKnowledgeService: AnalysisSemanticKnowledgeGovernanceService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  @Get()
  list(@Req() request: Request & { crmUser: CrmUser }) {
    this.ensureManageAccess(request.crmUser);
    return this.semanticKnowledgeService.list();
  }

  @Get(':assetId')
  detail(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('assetId') assetId: string,
  ) {
    this.ensureManageAccess(request.crmUser);
    return this.semanticKnowledgeService.getDetail(assetId);
  }

  @Post()
  create(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: unknown,
  ) {
    this.ensureManageAccess(request.crmUser);
    const payload = this.parseBody(semanticKnowledgeAssetWriteSchema, body);
    return this.semanticKnowledgeService.create(request.crmUser, payload);
  }

  @Put(':assetId')
  update(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ) {
    this.ensureManageAccess(request.crmUser);
    const payload = this.parseBody(semanticKnowledgeAssetWriteSchema, body);
    return this.semanticKnowledgeService.update(request.crmUser, assetId, payload);
  }

  @Post(':assetId/status')
  @HttpCode(200)
  setStatus(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('assetId') assetId: string,
    @Body() body: unknown,
  ) {
    this.ensureManageAccess(request.crmUser);
    const payload = this.parseBody(semanticKnowledgeAssetStatusSchema, body);
    return this.semanticKnowledgeService.setStatus(request.crmUser, assetId, payload);
  }

  @Post('publish')
  publish(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: unknown,
  ) {
    this.ensureManageAccess(request.crmUser);
    const payload = this.parseBody(semanticKnowledgePublishSchema, body);
    return this.semanticKnowledgeService.publish(request.crmUser, payload);
  }

  @Post('rollback')
  @HttpCode(200)
  rollback(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: unknown,
  ) {
    this.ensureManageAccess(request.crmUser);
    const payload = this.parseBody(semanticKnowledgeRollbackSchema, body);
    return this.semanticKnowledgeService.rollback(request.crmUser, payload);
  }

  private ensureManageAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'governance.policy.manage',
      '当前用户无权管理问数语义资产。',
      {
        channel: 'web-console',
        resourceType: 'analysis-semantic-knowledge',
      },
    );
  }

  private parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? '请求参数校验失败。',
      );
    }

    return parsed.data;
  }
}
