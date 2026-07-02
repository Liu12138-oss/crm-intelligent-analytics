import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ContractReviewCrmSourceService } from './contract-review.crm-source.service';
import { ContractReviewService } from './contract-review.service';
import type { UploadedContractFile } from './contract-review.types';

@Controller('contract-reviews')
@UseGuards(SessionAuthGuard)
export class ContractReviewController {
  constructor(
    private readonly contractReviewService: ContractReviewService,
    private readonly contractReviewCrmSourceService: ContractReviewCrmSourceService,
  ) {}

  @Get('contracts/pending-approval')
  listPendingApprovalContracts(
    @Req() request: Request & { crmUser: any },
    @Res({ passthrough: true }) response: Response,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '15',
  ) {
    this.applySensitiveNoStoreHeaders(response);
    return this.contractReviewCrmSourceService.listPendingApprovalContracts(
      request.crmUser,
      {
        page: Number(page),
        pageSize: Number(pageSize),
      },
    );
  }

  @Get('contracts/:contractId')
  getPendingApprovalContractDetail(
    @Req() request: Request & { crmUser: any },
    @Res({ passthrough: true }) response: Response,
    @Param('contractId') contractId: string,
  ) {
    this.applySensitiveNoStoreHeaders(response);
    return this.contractReviewCrmSourceService.getPendingApprovalContractDetail(
      request.crmUser,
      contractId,
    );
  }

  @Post('contracts/:contractId/tasks')
  async createTaskFromPendingApprovalContract(
    @Req() request: Request & { crmUser: any },
    @Param('contractId') contractId: string,
  ) {
    const sourceContract =
      await this.contractReviewCrmSourceService.getPendingApprovalContractSnapshot(
        request.crmUser,
        contractId,
      );

    return await this.contractReviewService.createTaskFromCrmContract(
      request.crmUser,
      sourceContract,
    );
  }

  @Get('tasks')
  listRecentTasks(
    @Req() request: Request & { crmUser: any },
    @Res({ passthrough: true }) response: Response,
  ) {
    this.applySensitiveNoStoreHeaders(response);
    return this.contractReviewService.listRecentTasks(request.crmUser);
  }

  @Post('tasks')
  @UseInterceptors(FileInterceptor('file'))
  async createTask(
    @Req() request: Request & { crmUser: any },
    @UploadedFile() file?: UploadedContractFile,
  ) {
    return await this.contractReviewService.createTask(request.crmUser, file);
  }

  @Get('tasks/:taskId')
  getTaskDetail(
    @Req() request: Request & { crmUser: any },
    @Res({ passthrough: true }) response: Response,
    @Param('taskId') taskId: string,
  ) {
    this.applySensitiveNoStoreHeaders(response);
    return this.contractReviewService.getTaskDetail(request.crmUser, taskId);
  }

  @Get('tasks/:taskId/artifacts/:artifactId/download')
  downloadArtifact(
    @Req() request: Request & { crmUser: any },
    @Param('taskId') taskId: string,
    @Param('artifactId') artifactId: string,
    @Res() response: Response,
  ) {
    const artifact = this.contractReviewService.getArtifactDownload(
      request.crmUser,
      taskId,
      artifactId,
    );

    return response.download(artifact.filePath as string, artifact.fileName);
  }

  /**
   * 合同审核页面所有依赖登录态和用户权限的读取接口都禁止浏览器与中间层缓存，
   * 避免同一终端切换账号后继续复用上一个账号的 304/ETag 结果。
   */
  private applySensitiveNoStoreHeaders(response: Response): void {
    response.setHeader(
      'Cache-Control',
      'private, no-store, no-cache, max-age=0, must-revalidate',
    );
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.setHeader('Surrogate-Control', 'no-store');

    const currentVaryHeader = response.getHeader('Vary');
    const varyValues = new Set(
      String(currentVaryHeader ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
    varyValues.add('Origin');
    varyValues.add('Cookie');
    response.setHeader('Vary', Array.from(varyValues).join(', '));
  }
}
