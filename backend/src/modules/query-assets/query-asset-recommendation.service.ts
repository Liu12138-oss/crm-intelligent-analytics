import { Injectable } from '@nestjs/common';
import type { CrmUser, QueryAssetSummaryRecord, QueryTemplateRecord } from '../../shared/types/domain';
import { QueryTimeSlotStatsRepository } from './query-time-slot-stats.repository';
import { QueryUsageProfileRepository } from './query-usage-profile.repository';

@Injectable()
export class QueryAssetRecommendationService {
  constructor(
    private readonly queryUsageProfileRepository: QueryUsageProfileRepository,
    private readonly queryTimeSlotStatsRepository: QueryTimeSlotStatsRepository,
  ) {}

  buildSummary(
    user: CrmUser,
    templates: QueryTemplateRecord[],
    now = new Date('2026-05-11T08:00:00.000Z'),
  ): QueryAssetSummaryRecord {
    const timeSlot = this.resolveTimeSlot(now);
    const usageProfiles = this.queryUsageProfileRepository.listByUser(user.id);
    const slotStats = this.queryTimeSlotStatsRepository.listByTimeSlot(timeSlot);

    const recommendedTemplates = templates
      .filter((template) => this.isStableRecommendationCandidate(template))
      .map((template) => {
        const usageProfile = usageProfiles.find((item) => item.templateId === template.id);
        const slotStat = slotStats.find((item) => item.templateId === template.id);
        const score =
          (usageProfile?.favoriteScore ?? 0) +
          (slotStat?.globalClickCount ?? 0) +
          (100 - (template.displayOrder ?? 99));

        return {
          templateId: template.id,
          name: template.name,
          description: template.description,
          recommendationReason: this.buildRecommendationReason(timeSlot, usageProfile, slotStat),
          score,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ templateId, name, description, recommendationReason }) => ({
        templateId,
        name,
        description,
        recommendationReason,
      }));

    return {
      timeSlot,
      recommendedTemplates,
    };
  }

  /**
   * “猜你想查”必须优先推荐稳定能复用的经营看板类模板。
   * 短时间窗明细模板在真实 CRM 数据里经常因为最近几天无新增而返回空结果，
   * 因此仍保留在模板列表中，但不作为首屏推荐项。
   */
  private isStableRecommendationCandidate(template: QueryTemplateRecord): boolean {
    const days = Number(template.defaultFilters?.days ?? 0);
    if (Number.isFinite(days) && days > 0 && days <= 7) {
      return false;
    }

    return true;
  }

  /**
   * 推荐说明改为系统按时间场景和使用热度自动生成，不再依赖模板维护时手工填写提示文案。
   */
  private buildRecommendationReason(
    timeSlot: string,
    usageProfile?: { favoriteScore: number } | undefined,
    slotStat?: { globalClickCount: number } | undefined,
  ): string {
    if (usageProfile && slotStat) {
      return '结合近期点击与当前时间场景';
    }

    if (usageProfile) {
      return '结合你的最近使用偏好';
    }

    if (slotStat) {
      return timeSlot === 'MONTH_END'
        ? '结合当前月底场景推荐'
        : timeSlot === 'MONTH_START'
          ? '结合当前月初场景推荐'
          : '结合当前时间场景推荐';
    }

    return '结合当前时间场景推荐';
  }

  private resolveTimeSlot(now: Date): string {
    const day = now.getUTCDate();
    if (day <= 5) {
      return 'MONTH_START';
    }
    if (day >= 25) {
      return 'MONTH_END';
    }
    return 'MONTH_MIDDLE';
  }
}
