import {
  Body,
  BadRequestException,
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
import type { ZodSchema } from 'zod';
import { AiModelProfileService } from '../ai-models/ai-model-profile.service';
import { AiHealthCheckService } from '../ai-models/ai-health-check.service';
import { AiProfileActivationService } from '../ai-models/ai-profile-activation.service';
import { AiModelAuditService } from '../ai-models/ai-model-audit.service';
import { AiModelEnvBootstrapService } from '../ai-models/ai-model-env-bootstrap.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { CrmUser } from '../../shared/types/domain';
import { aiModelProfileWriteSchema } from './ai-model-governance.schema';
import { aiModelProfileDraftHealthCheckSchema } from './ai-model-governance.schema';
import { aiModelProfileStatusSchema } from './ai-model-governance.schema';
import { PermissionEnforcementService } from './permission-enforcement.service';

/**
 * 提供管理员可用的 AI Profile 治理接口。
 */
@Controller('governance/ai-models')
@UseGuards(SessionAuthGuard)
export class AiModelGovernanceController {
  constructor(
    private readonly aiModelProfileService: AiModelProfileService,
    private readonly aiHealthCheckService: AiHealthCheckService,
    private readonly aiProfileActivationService: AiProfileActivationService,
    private readonly aiModelAuditService: AiModelAuditService,
    private readonly aiModelEnvBootstrapService: AiModelEnvBootstrapService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  /**
   * 返回当前 AI Profile 列表与激活快照。
   */
  @Get()
  list(@Req() request: Request & { crmUser: CrmUser }) {
    this.ensureAdmin(request.crmUser);
    this.aiModelEnvBootstrapService.ensureBootstrapped();
    return {
      items: this.aiModelProfileService.list(),
      activation: this.aiProfileActivationService.getCurrentActivation(),
    };
  }

  /**
   * 返回指定 AI Profile 的脱敏详情。
   */
  @Get(':profileId')
  detail(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('profileId') profileId: string,
  ) {
    this.ensureAdmin(request.crmUser);
    return this.aiModelProfileService.getViewById(profileId);
  }

  /**
   * 创建新的 AI Profile。
   */
  @Post()
  create(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: unknown,
  ) {
    this.ensureAdmin(request.crmUser);
    const payload = this.parseBody(aiModelProfileWriteSchema, body);
    const createdProfile = this.aiModelProfileService.create(request.crmUser.id, {
      ...payload,
      sdkOptions: payload.sdkOptions ?? {},
    });
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_MODEL_PROFILE_CREATED',
      outcome: `创建 AI Profile：${createdProfile.name}`,
      sessionSnapshot: {
        profileId: createdProfile.id,
        providerCode: createdProfile.providerCode,
        sdkType: createdProfile.sdkType,
      },
    });
    return createdProfile;
  }

  /**
   * 对尚未保存的草稿配置执行一次临时测试。
   */
  @Post('draft-health-check')
  @HttpCode(200)
  async draftHealthCheck(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: unknown,
  ) {
    this.ensureAdmin(request.crmUser);
    const payload = this.parseBody(aiModelProfileDraftHealthCheckSchema, body);
    const result = await this.aiHealthCheckService.runDraftHealthCheck({
      ...payload,
      sdkOptions: payload.sdkOptions ?? {},
    });
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_MODEL_PROFILE_HEALTH_CHECKED',
      outcome: `AI 草稿配置健康检查完成：${result.status}`,
      failureReason: result.failureReason,
      sessionSnapshot: {
        profileId: payload.profileId,
        draft: {
          providerCode: payload.providerCode,
          sdkType: payload.sdkType,
          model: payload.model,
        },
        result,
      },
    });
    return result;
  }

  /**
   * 激活指定 Profile 作为全局当前配置。
   */
  @Post(':profileId/activate')
  @HttpCode(200)
  activate(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('profileId') profileId: string,
  ) {
    this.ensureAdmin(request.crmUser);
    return this.aiProfileActivationService.activateWithVerification(
      request.crmUser,
      profileId,
      async () => await this.aiHealthCheckService.runHealthCheck(profileId),
    );
  }

  /**
   * 更新指定 AI Profile。
   */
  @Put(':profileId')
  update(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('profileId') profileId: string,
    @Body() body: unknown,
  ) {
    this.ensureAdmin(request.crmUser);
    const payload = this.parseBody(aiModelProfileWriteSchema, body);
    const updatedProfile = this.aiModelProfileService.update(
      request.crmUser.id,
      profileId,
      {
        ...payload,
        sdkOptions: payload.sdkOptions ?? {},
      },
    );
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_MODEL_PROFILE_UPDATED',
      outcome: `更新 AI Profile：${updatedProfile.name}`,
      sessionSnapshot: {
        profileId: updatedProfile.id,
        providerCode: updatedProfile.providerCode,
        sdkType: updatedProfile.sdkType,
      },
    });
    return updatedProfile;
  }

  /**
   * 复制指定 AI Profile 为新的可编辑配置。
   */
  @Post(':profileId/copy')
  copy(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('profileId') profileId: string,
  ) {
    this.ensureAdmin(request.crmUser);
    const copiedProfile = this.aiModelProfileService.copy(request.crmUser.id, profileId);
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_MODEL_PROFILE_CREATED',
      outcome: `复制 AI Profile：${copiedProfile.name}`,
      sessionSnapshot: {
        profileId: copiedProfile.id,
        sourceProfileId: profileId,
        providerCode: copiedProfile.providerCode,
        sdkType: copiedProfile.sdkType,
      },
    });
    return copiedProfile;
  }

  /**
   * 对指定 Profile 执行一次健康检查，并返回最近测试结果。
   */
  @Post(':profileId/health-check')
  @HttpCode(200)
  async healthCheck(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('profileId') profileId: string,
  ) {
    this.ensureAdmin(request.crmUser);
    const result = await this.aiHealthCheckService.runHealthCheck(profileId);
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_MODEL_PROFILE_HEALTH_CHECKED',
      outcome: `AI Profile ${profileId} 健康检查完成：${result.status}`,
      failureReason: result.failureReason,
      sessionSnapshot: {
        profileId,
        result,
      },
    });
    return result;
  }

  /**
   * 显式清空指定 Profile 的密钥。
   */
  @Post(':profileId/clear-secret')
  @HttpCode(200)
  clearSecret(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('profileId') profileId: string,
  ) {
    this.ensureAdmin(request.crmUser);
    const clearedProfile = this.aiModelProfileService.clearSecret(
      request.crmUser.id,
      profileId,
    );
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_MODEL_PROFILE_SECRET_CLEARED',
      outcome: `清空 AI Profile 密钥：${clearedProfile.name}`,
      sessionSnapshot: {
        profileId: clearedProfile.id,
      },
    });
    return clearedProfile;
  }

  /**
   * 删除指定的手工维护 AI Profile。
   */
  @Delete(':profileId')
  deleteProfile(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('profileId') profileId: string,
  ) {
    this.ensureAdmin(request.crmUser);
    const deletedProfile = this.aiModelProfileService.delete(profileId);
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_MODEL_PROFILE_UPDATED',
      outcome: `删除 AI Profile：${deletedProfile.name}`,
      sessionSnapshot: {
        profileId: deletedProfile.id,
        providerCode: deletedProfile.providerCode,
        sdkType: deletedProfile.sdkType,
      },
    });
    return {
      id: deletedProfile.id,
      deleted: true,
    };
  }

  /**
   * 更新指定 Profile 的启停状态。
   */
  @Post(':profileId/status')
  @HttpCode(200)
  setStatus(
    @Req() request: Request & { crmUser: CrmUser },
    @Param('profileId') profileId: string,
    @Body() body: unknown,
  ) {
    this.ensureAdmin(request.crmUser);
    const payload = this.parseBody(aiModelProfileStatusSchema, body);
    const updatedProfile = this.aiModelProfileService.setStatus(
      request.crmUser.id,
      profileId,
      payload.status,
    );
    this.aiModelAuditService.createEvent({
      actor: request.crmUser,
      eventType: 'AI_MODEL_PROFILE_UPDATED',
      outcome: `AI Profile ${updatedProfile.name} 状态变更为 ${updatedProfile.status}`,
      sessionSnapshot: {
        profileId: updatedProfile.id,
        status: updatedProfile.status,
      },
    });
    return updatedProfile;
  }

  /**
   * 拦截非管理员访问，保持治理边界与现有后台一致。
   */
  private ensureAdmin(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'ai_profile.manage',
      '当前用户无权管理 AI 配置。',
      {
        channel: 'web-console',
        resourceType: 'ai-model-profile',
      },
    );
  }

  /**
   * 统一把 Zod 校验错误转换成 400，避免未处理异常落成 500。
   */
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
