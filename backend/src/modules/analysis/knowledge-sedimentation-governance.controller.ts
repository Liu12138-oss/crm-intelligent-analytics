import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { CrmUser } from '../../shared/types/domain';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { KnowledgeSedimentationService } from './knowledge-sedimentation.service';
import { semanticKnowledgeAssetReviewSchema } from '../governance/analysis-semantic-knowledge.schema';
import type { ZodSchema } from 'zod';

/**
 * 知识沉淀治理控制器（学习闭环第 3 层治理入口）。
 *
 * 设计原因：
 * 1. 治理后台"知识沉淀"菜单的后端 API，供候选审核页、口径收敛页、沉淀效果页调用
 * 2. 所有接口需 governance.policy.manage 权限
 * 3. 审核动作全部进审计
 *
 * 路由前缀：/api/v1/governance/sedimentation
 */
@Controller('governance/sedimentation')
@UseGuards(SessionAuthGuard)
export class KnowledgeSedimentationGovernanceController {
  constructor(
    private readonly sedimentationService: KnowledgeSedimentationService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  /**
   * 列出所有候选资产（PROPOSED 状态）。
   *
   * 返回值说明：返回待审核候选列表，按置信度降序排列。
   */
  @Get('candidates')
  listCandidates(@Req() request: Request & { crmUser: CrmUser }) {
    this.ensureManageAccess(request.crmUser);
    const candidates = this.sedimentationService.listProposedCandidates();
    return {
      items: candidates.sort(
        (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
      ),
      total: candidates.length,
    };
  }

  /**
   * 审核候选（通过或驳回）。
   *
   * 参数说明：`assetId` 为候选资产 ID，body 含 action（APPROVE/REJECT）和可选 reason。
   */
  @Post('candidates/:assetId/review')
  @HttpCode(200)
  reviewCandidate(
    @Param('assetId') assetId: string,
    @Body() body: unknown,
    @Req() request: Request & { crmUser: CrmUser },
  ) {
    this.ensureManageAccess(request.crmUser);
    const parsed = this.parseBody(semanticKnowledgeAssetReviewSchema, body);
    if (!parsed) {
      return { accepted: false, reviewStatus: 'INVALID' };
    }

    return this.sedimentationService.reviewCandidate(
      assetId,
      parsed.action,
      request.crmUser.id,
      parsed.reason,
    );
  }

  /**
   * 手动触发沉淀扫描。
   *
   * 参数说明：`sinceHours` 指定扫描最近多少小时的审计事件，默认 24。
   */
  @Post('run')
  @HttpCode(200)
  runSedimentation(
    @Body() body: unknown,
    @Req() request: Request & { crmUser: CrmUser },
  ) {
    this.ensureManageAccess(request.crmUser);
    const sinceHours =
      typeof body === 'object' && body !== null && 'sinceHours' in body
        ? Number((body as Record<string, unknown>).sinceHours) || 24
        : 24;
    return this.sedimentationService.runSedimentation('manual', sinceHours);
  }

  /**
   * 获取沉淀配置。
   */
  @Get('config')
  getConfig(@Req() request: Request & { crmUser: CrmUser }) {
    this.ensureManageAccess(request.crmUser);
    return this.sedimentationService.getConfig();
  }

  /**
   * 获取沉淀效果统计。
   *
   * 返回值说明：返回本周候选生成数、审核通过率、候选类型分布等指标。
   */
  @Get('effect-stats')
  getEffectStats(@Req() request: Request & { crmUser: CrmUser }) {
    this.ensureManageAccess(request.crmUser);
    return this.sedimentationService.getEffectStats();
  }

  /**
   * 列出口径冲突待办。
   *
   * 返回值说明：返回 CALIBRATION_CONFLICT_DETECTED 审计事件列表。
   */
  @Get('calibration-conflicts')
  listCalibrationConflicts(@Req() request: Request & { crmUser: CrmUser }) {
    this.ensureManageAccess(request.crmUser);
    return this.sedimentationService.listCalibrationConflicts();
  }

  /**
   * 收敛口径冲突。
   *
   * 参数说明：`conflictId` 为冲突待办 ID，body 含 resolution（收敛说明）。
   */
  @Post('calibration-conflicts/:conflictId/resolve')
  @HttpCode(200)
  resolveCalibrationConflict(
    @Param('conflictId') conflictId: string,
    @Body() body: unknown,
    @Req() request: Request & { crmUser: CrmUser },
  ) {
    this.ensureManageAccess(request.crmUser);
    const resolution =
      typeof body === 'object' && body !== null && 'resolution' in body
        ? String((body as Record<string, unknown>).resolution)
        : '';
    return this.sedimentationService.resolveCalibrationConflict(
      conflictId,
      resolution,
      request.crmUser.id,
    );
  }

  /**
   * 权限校验：确保用户有治理权限。
   */
  private ensureManageAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'governance.policy.manage',
      '知识沉淀治理需要管理权限',
    );
  }

  /**
   * Zod 校验辅助方法。
   */
  private parseBody<T>(schema: ZodSchema<T>, body: unknown): T | null {
    const result = schema.safeParse(body);
    return result.success ? result.data : null;
  }
}
