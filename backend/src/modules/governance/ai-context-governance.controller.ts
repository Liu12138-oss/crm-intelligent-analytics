import {
  BadRequestException,
  Controller,
  Get,
  Put,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ZodSchema } from 'zod';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { CrmUser } from '../../shared/types/domain';
import { AiContextPolicyService } from '../ai-models/ai-context-policy.service';
import { AiModelAuditService } from '../ai-models/ai-model-audit.service';
import { PermissionEnforcementService } from './permission-enforcement.service';
import { aiContextPolicyWriteSchema } from './ai-context-governance.schema';

@Controller('governance/ai-models/context-policy')
@UseGuards(SessionAuthGuard)
export class AiContextGovernanceController {
  constructor(
    private readonly aiContextPolicyService: AiContextPolicyService,
    private readonly aiModelAuditService: AiModelAuditService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  @Get()
  getCurrent(@Req() request: Request & { crmUser: CrmUser }) {
    this.ensureManageAccess(request.crmUser);
    const policy = this.aiContextPolicyService.getCurrent();
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_CONTEXT_POLICY_READ',
      outcome: '读取 AI 上下文治理策略。',
      sessionSnapshot: {
        policyId: policy.id,
      },
    });
    return policy;
  }

  @Put()
  update(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: unknown,
  ) {
    this.ensureManageAccess(request.crmUser);
    try {
      const payload = this.parseBody(aiContextPolicyWriteSchema, body);
      const policy = this.aiContextPolicyService.update(request.crmUser.id, payload);
      this.aiModelAuditService.createEvent({
        actor: request.crmUser,
        eventType: 'AI_CONTEXT_POLICY_UPDATED',
        outcome: '更新 AI 上下文治理策略。',
        sessionSnapshot: {
          policyId: policy.id,
          strategy: {
            turnRetentionLimit: policy.turnRetentionLimit,
            historySummaryMaxLength: policy.historySummaryMaxLength,
            latestQuestionMaxLength: policy.latestQuestionMaxLength,
            latestSummaryMaxLength: policy.latestSummaryMaxLength,
            analysisSessionIdleTimeoutSeconds: policy.analysisSessionIdleTimeoutSeconds,
            taskSessionIdleTimeoutSeconds: policy.taskSessionIdleTimeoutSeconds,
          },
        },
      });
      return policy;
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : 'AI 上下文治理策略更新失败。';
      this.aiModelAuditService.createEvent({
        actor: request.crmUser,
        eventType: 'AI_CONTEXT_POLICY_UPDATE_FAILED',
        outcome: '更新 AI 上下文治理策略失败。',
        failureReason,
      });
      throw error;
    }
  }

  private ensureManageAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'ai_profile.manage',
      '当前用户无权管理 AI 配置。',
      {
        channel: 'web-console',
        resourceType: 'ai-context-policy',
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
