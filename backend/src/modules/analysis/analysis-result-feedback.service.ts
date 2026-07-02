import { Inject, Injectable, Optional } from '@nestjs/common';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { QueryUsageProfileRepository } from '../query-assets/query-usage-profile.repository';
import { buildEntityId } from '../../shared/utils/id.util';
import type { ChannelType, RiskLevel, ScopeSnapshot } from '../../shared/types/domain';

/**
 * 分析结果反馈类型。
 *
 * - USEFUL：结果有用（正面反馈）
 * - NOT_USEFUL：结果没用（负面反馈）
 * - CALIBRATION_ISSUE：口径不对（负面反馈，附带用户描述）
 * - DIMENSION_REQUEST：想要更多维度（中性反馈，附带用户期望维度）
 */
export type AnalysisResultFeedbackType =
  | 'USEFUL'
  | 'NOT_USEFUL'
  | 'CALIBRATION_ISSUE'
  | 'DIMENSION_REQUEST';

/**
 * 反馈来源渠道。
 *
 * - WEB：Web 端自建反馈入口
 * - WECOM_FEEDBACK_EVENT：企微原生 feedback_event 回调
 */
export type AnalysisResultFeedbackSource = 'WEB' | 'WECOM_FEEDBACK_EVENT';

export interface AnalysisResultFeedbackParams {
  queryId: string;
  feedbackType: AnalysisResultFeedbackType;
  feedbackText?: string;
  requestedDimensions?: string[];
  feedbackSource?: AnalysisResultFeedbackSource;
  actorId: string;
  actorDisplayName?: string;
  actorExternalId?: string;
  channel?: ChannelType;
  scopeSnapshot: ScopeSnapshot;
  relatedTemplateId?: string;
}

export interface AnalysisResultFeedbackResult {
  feedbackEventId: string;
  queryId: string;
  feedbackType: AnalysisResultFeedbackType;
  accepted: boolean;
}

/**
 * 分析结果反馈服务（学习闭环第 2 层）。
 *
 * 设计原因：
 * 1. 统一接收 Web 端自建反馈和企微原生 feedback_event 回调，写入审计 ANALYSIS_RESULT_FEEDBACK
 * 2. 同步更新使用画像反馈维度（positiveFeedbackCount30d / negativeFeedbackCount30d）
 * 3. 口径纠错反馈（CALIBRATION_ISSUE）不立即改动任何知识资产，只作为第 3 层自动沉淀的输入信号
 * 4. 反馈不阻塞主链路，写入失败只记日志不抛异常
 *
 * 调用注意事项：
 * - 企微端由 WecomFeedbackEventService 解析回调后调用本服务
 * - Web 端通过 AnalysisResultFeedbackController 调用本服务
 */
@Injectable()
export class AnalysisResultFeedbackService {
  constructor(
    private readonly auditEventRepository: AuditEventRepository,
    private readonly logger: AnalysisLoggerService,
    @Optional()
    @Inject(QueryUsageProfileRepository)
    private readonly queryUsageProfileRepository?: QueryUsageProfileRepository,
  ) {}

  /**
   * 提交分析结果反馈。
   *
   * 参数说明：`params` 包含查询 ID、反馈类型、可选文本/期望维度、来源渠道和审计所需字段。
   * 返回值说明：返回反馈事件 ID 和受理状态。
   * 调用注意事项：反馈写入失败只记日志不抛异常，避免影响用户主操作。
   */
  submitFeedback(
    params: AnalysisResultFeedbackParams,
  ): AnalysisResultFeedbackResult {
    const feedbackEventId = buildEntityId('feedback');

    try {
      this.auditEventRepository.create({
        id: feedbackEventId,
        eventType: 'ANALYSIS_RESULT_FEEDBACK',
        actorId: params.actorId,
        actorRoleIds: [],
        actorType: params.feedbackSource === 'WECOM_FEEDBACK_EVENT' ? 'wecom-user' : 'crm-user',
        actorDisplayName: params.actorDisplayName,
        actorExternalId: params.actorExternalId,
        channel: params.channel ?? 'web-console',
        resourceType: 'analysis-result',
        resourceId: params.queryId,
        relatedRequestId: params.queryId,
        relatedTemplateId: params.relatedTemplateId,
        scopeSnapshot: params.scopeSnapshot,
        riskLevel: 'LOW' as RiskLevel,
        reviewStatus: 'IGNORED',
        outcome: this.resolveFeedbackOutcome(params.feedbackType),
        actionSummary: this.buildFeedbackSummary(params),
        sessionSnapshot: {
          queryId: params.queryId,
          feedbackType: params.feedbackType,
          feedbackText: params.feedbackText,
          requestedDimensions: params.requestedDimensions,
          feedbackSource: params.feedbackSource ?? 'WEB',
          submittedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      });

      // 同步更新使用画像反馈维度（不阻塞，失败只记日志）
      this.tryUpdateUsageProfileFeedback(params);

      this.logger.logStep('分析结果反馈已记录', {
        queryId: params.queryId,
        feedbackType: params.feedbackType,
        source: params.feedbackSource ?? 'WEB',
      });
    } catch (error) {
      this.logger.logError('分析结果反馈写入失败', {
        queryId: params.queryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      feedbackEventId,
      queryId: params.queryId,
      feedbackType: params.feedbackType,
      accepted: true,
    };
  }

  /**
   * 将反馈类型映射为审计 outcome 文案。
   */
  private resolveFeedbackOutcome(
    feedbackType: AnalysisResultFeedbackType,
  ): string {
    switch (feedbackType) {
      case 'USEFUL':
        return '用户反馈结果有用';
      case 'NOT_USEFUL':
        return '用户反馈结果没用';
      case 'CALIBRATION_ISSUE':
        return '用户反馈口径不对';
      case 'DIMENSION_REQUEST':
        return '用户希望增加维度';
      default:
        return '用户已反馈';
    }
  }

  /**
   * 构建反馈摘要文案。
   */
  private buildFeedbackSummary(params: AnalysisResultFeedbackParams): string {
    const parts: string[] = [this.resolveFeedbackOutcome(params.feedbackType)];
    if (params.feedbackText) {
      parts.push(`反馈内容：${params.feedbackText}`);
    }
    if (params.requestedDimensions?.length) {
      parts.push(`期望维度：${params.requestedDimensions.join('、')}`);
    }
    return parts.join('；');
  }

  /**
   * 尝试更新使用画像反馈维度。
   *
   * 设计原因：使用画像按 userId+templateId 维度维护，反馈可能没有 templateId
   *（自由查询场景），此时跳过画像更新，只保留审计记录。
   */
  private tryUpdateUsageProfileFeedback(params: AnalysisResultFeedbackParams): void {
    if (!this.queryUsageProfileRepository || !params.relatedTemplateId) {
      return;
    }

    try {
      const profiles = this.queryUsageProfileRepository.listByUser(params.actorId);
      const existing = profiles.find(
        (item) => item.templateId === params.relatedTemplateId,
      );

      if (!existing) {
        // 画像不存在时不自动创建（画像由点击行为创建，反馈只更新已有画像）
        return;
      }

      const isPositive = params.feedbackType === 'USEFUL';
      const isNegative =
        params.feedbackType === 'NOT_USEFUL' ||
        params.feedbackType === 'CALIBRATION_ISSUE';

      const updated = {
        ...existing,
        positiveFeedbackCount30d:
          (existing.positiveFeedbackCount30d ?? 0) + (isPositive ? 1 : 0),
        negativeFeedbackCount30d:
          (existing.negativeFeedbackCount30d ?? 0) + (isNegative ? 1 : 0),
        lastFeedbackAt: new Date().toISOString(),
      };

      this.queryUsageProfileRepository.save(updated);
    } catch (error) {
      this.logger.logWarn('使用画像反馈维度更新失败', {
        queryId: params.queryId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
