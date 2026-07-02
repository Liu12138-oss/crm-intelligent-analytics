import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AccessPolicyRepository } from '../governance/access-policy.repository';
import { SessionCapabilitiesService } from '../sessions/session-capabilities.service';

@Controller('analysis')
@UseGuards(SessionAuthGuard)
export class AnalysisController {
  constructor(
    private readonly accessPolicyRepository: AccessPolicyRepository,
    private readonly sessionCapabilitiesService: SessionCapabilitiesService,
  ) {}

  @Get('capabilities')
  getCapabilities(@Req() request: Request & { crmUser: any; authSession?: { id?: string } }) {
    return this.sessionCapabilitiesService.buildCapabilitySnapshot(
      request.crmUser,
      this.accessPolicyRepository.getCurrent(),
      {
        sessionId: request.authSession?.id,
      },
    );
  }

  @Post('queries')
  async createAnalysisQuery(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, any>,
  ) {
    void request;
    void body;
    this.ensureAnalysisWorkbenchDisabled();
  }

  @Get('queries/:queryId')
  getAnalysisQuery(
    @Req() request: Request & { crmUser: any },
    @Param('queryId') queryId: string,
  ) {
    void request;
    void queryId;
    this.ensureAnalysisWorkbenchDisabled();
  }

  @Post('queries/:queryId/report')
  @HttpCode(200)
  async getAnalysisQueryReport(
    @Req() request: Request & { crmUser: any },
    @Param('queryId') queryId: string,
    @Body() body?: { waitMs?: number },
  ) {
    void request;
    void queryId;
    void body;
    this.ensureAnalysisWorkbenchDisabled();
  }

  @Post('queries/:queryId/templates')
  saveQueryAsTemplate(
    @Req() request: Request & { crmUser: any },
    @Param('queryId') queryId: string,
    @Body() body: Record<string, any>,
  ) {
    void request;
    void queryId;
    void body;
    this.ensureAnalysisWorkbenchDisabled();
  }

  /**
   * 固定关闭 CRM 智能分析执行入口。
   *
   * 参数说明：无。
   * 返回值说明：该方法始终抛出未启用异常。
   * 调用注意事项：`/analysis/capabilities` 仍用于前端能力快照，其余查询、结果和模板沉淀接口不应在核心收敛模式下执行。
   */
  private ensureAnalysisWorkbenchDisabled(): never {
    throw new ServiceUnavailableException(
      'CRM 智能分析能力当前未启用，本轮仅保留 AI 配置和企业微信机器人普通 AI 对话。',
    );
  }
}
