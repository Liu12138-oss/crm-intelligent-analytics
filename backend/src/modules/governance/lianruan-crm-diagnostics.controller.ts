import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { LianruanCrmDiagnosticsService } from '../crm-standard-api/lianruan-crm-diagnostics.service';

@Controller('governance/crm-standard-api')
@UseGuards(SessionAuthGuard)
export class LianruanCrmDiagnosticsController {
  constructor(
    private readonly lianruanCrmDiagnosticsService: LianruanCrmDiagnosticsService,
  ) {}

  /**
   * 读取联软标准 OpenAPI 联调诊断摘要。
   *
   * 参数说明：`request.crmUser` 为当前登录 CRM 用户。
   * 返回值说明：返回联调配置、绑定身份、权限范围和字典完整度摘要。
   * 调用注意事项：仅用于治理入口排障与联调核对，不面向普通业务查询。
   */
  @Get('diagnostics')
  async getDiagnostics(@Req() request: Request & { crmUser: any }) {
    return await this.lianruanCrmDiagnosticsService.getDiagnostics(
      request.crmUser,
    );
  }

  /**
   * 读取指定标准资源的分页列表。
   *
   * 参数说明：
   * - `request.crmUser`：当前登录 CRM 用户。
   * - `resource`：联软标准资源名。
   * - 其他 `Query` 参数：列表分页与筛选条件。
   * 返回值说明：返回对应资源的标准分页结果。
   * 调用注意事项：该入口只供联调与字段核对使用，避免替代正式业务编排。
   */
  @Get('resources/:resource')
  async listResource(
    @Req() request: Request & { crmUser: any },
    @Param('resource') resource: string,
    @Query('pageNo') pageNo?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('region') region?: string,
    @Query('partnerId') partnerId?: string,
    @Query('createdAfter') createdAfter?: string,
    @Query('createdBefore') createdBefore?: string,
    @Query('updatedAfter') updatedAfter?: string,
    @Query('updatedBefore') updatedBefore?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return await this.lianruanCrmDiagnosticsService.listResource(
      request.crmUser,
      resource,
      {
        pageNo: pageNo ? Number(pageNo) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        keyword,
        status,
        region,
        partnerId,
        createdAfter,
        createdBefore,
        updatedAfter,
        updatedBefore,
        sortBy,
        sortOrder,
      },
    );
  }

  /**
   * 读取指定标准资源的详情对象。
   *
   * 参数说明：
   * - `request.crmUser`：当前登录 CRM 用户。
   * - `resource`：联软标准资源名。
   * - `id`：远端对象主键。
   * 返回值说明：返回对应资源的详情对象。
   * 调用注意事项：当前保持远端原始字段，供联调期核对字段契约使用。
   */
  @Get('resources/:resource/:id')
  async getResourceDetail(
    @Req() request: Request & { crmUser: any },
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return await this.lianruanCrmDiagnosticsService.getResourceDetail(
      request.crmUser,
      resource,
      id,
    );
  }
}
