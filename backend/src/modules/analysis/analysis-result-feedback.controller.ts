import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AnalysisResultFeedbackService } from './analysis-result-feedback.service';
import { analysisResultFeedbackSchema } from '../governance/analysis-semantic-knowledge.schema';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { CrmUser, ScopeSnapshot } from '../../shared/types/domain';

/**
 * 分析结果反馈控制器（学习闭环第 2 层 Web 端入口）。
 *
 * 设计原因：
 * 1. Web 端用户在分析结果详情页底部点击"有用/没用/口径不对/想要更多维度"后调用此接口
 * 2. 企微端反馈走 WecomFeedbackEventService → AnalysisResultFeedbackService，不经过此控制器
 * 3. 反馈不阻塞主链路，写入失败返回 200 不报错（前端只提示"已收到"）
 */
@Controller('api/v1/analysis-results/feedback')
@UseGuards(SessionAuthGuard)
export class AnalysisResultFeedbackController {
  constructor(
    private readonly analysisResultFeedbackService: AnalysisResultFeedbackService,
  ) {}

  /**
   * 提交分析结果反馈。
   */
  @Post()
  submitFeedback(
    @Body() body: unknown,
    @Req() req: { crmUser?: CrmUser; scopeSnapshot?: ScopeSnapshot },
  ): { accepted: boolean; feedbackType: string } {
    const parsed = analysisResultFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return { accepted: false, feedbackType: 'INVALID' };
    }

    const user = req.crmUser;
    if (!user) {
      return { accepted: false, feedbackType: 'UNAUTHORIZED' };
    }

    const fallbackScope: ScopeSnapshot = {
      organizationIds: [],
      departmentIds: [],
      ownerIds: [],
      scopeSummary: '当前权限范围',
    };

    const result = this.analysisResultFeedbackService.submitFeedback({
      queryId: parsed.data.queryId,
      feedbackType: parsed.data.feedbackType,
      feedbackText: parsed.data.feedbackText,
      requestedDimensions: parsed.data.requestedDimensions,
      feedbackSource: 'WEB',
      actorId: user.id,
      actorDisplayName: user.name,
      channel: 'web-console',
      scopeSnapshot: req.scopeSnapshot ?? fallbackScope,
    });

    return {
      accepted: result.accepted,
      feedbackType: result.feedbackType,
    };
  }
}
