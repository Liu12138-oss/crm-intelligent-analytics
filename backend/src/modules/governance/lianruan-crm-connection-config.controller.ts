import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { LianruanCrmOpenApiClient } from '../crm-standard-api/lianruan-crm-openapi.client';
import { LianruanCrmConnectionConfigService } from './lianruan-crm-connection-config.service';

@Controller('governance/lianruan-crm-config')
@UseGuards(SessionAuthGuard)
export class LianruanCrmConnectionConfigController {
  constructor(
    private readonly lianruanCrmConnectionConfigService: LianruanCrmConnectionConfigService,
    private readonly lianruanCrmOpenApiClient: LianruanCrmOpenApiClient,
  ) {}

  /**
   * 读取联软渠道 CRM 连接配置。
   *
   * 参数说明：`request.crmUser` 为当前登录 CRM 用户。
   * 返回值说明：返回脱敏后的 Base URL、凭证配置状态、超时和来源信息。
   * 调用注意事项：不会返回明文 `appSecret`，避免治理页泄露敏感配置。
   */
  @Get()
  getConfig(@Req() request: Request & { crmUser: any }) {
    return this.lianruanCrmConnectionConfigService.getConfigView(request.crmUser);
  }

  /**
   * 保存联软渠道 CRM 连接配置。
   *
   * 参数说明：
   * - `request.crmUser`：当前治理操作者；
   * - `body`：页面提交的配置增量。
   * 返回值说明：返回保存后的脱敏配置视图。
   * 调用注意事项：保存成功后立即清理 OpenAPI token 缓存，避免继续复用旧凭证。
   */
  @Put()
  updateConfig(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    const config = this.lianruanCrmConnectionConfigService.updateConfig(
      request.crmUser,
      body,
    );
    this.lianruanCrmOpenApiClient.clearAccessTokenCache();
    return config;
  }

  /**
   * 测试联软渠道 CRM 连接配置。
   *
   * 参数说明：`body` 可传入草稿配置，未传时测试当前生效配置。
   * 返回值说明：返回 token、身份和权限范围三步测试结果。
   * 调用注意事项：测试不会保存草稿，也不会返回 accessToken 或 Secret。
   */
  @Post('test')
  async testConfig(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    return await this.lianruanCrmConnectionConfigService.testConfig(
      request.crmUser,
      Object.keys(body ?? {}).length > 0 ? body : undefined,
    );
  }
}
