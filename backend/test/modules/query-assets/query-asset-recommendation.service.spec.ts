import { QueryAssetRecommendationService } from '../../../src/modules/query-assets/query-asset-recommendation.service';
import type { CrmUser, QueryTemplateRecord } from '../../../src/shared/types/domain';

describe('QueryAssetRecommendationService', () => {
  const user: CrmUser = {
    id: '2224755',
    name: '王亮2',
    roleIds: ['2619'],
    roleNames: ['超级管理员'],
    organizationIds: ['10804'],
    departmentIds: ['5434'],
    ownerIds: [],
    isAdmin: true,
    exportAllowed: true,
    channels: ['web-console'],
  };

  function buildTemplate(
    id: string,
    name: string,
    displayOrder: number,
    defaultFilters: Record<string, unknown> = {},
  ): QueryTemplateRecord {
    return {
      id,
      name,
      description: `${name}说明`,
      defaultQuestionText: name,
      defaultFilters,
      defaultViewType: 'BAR_CHART',
      queryMode: 'FIXED_SQL',
      sqlText: 'SELECT 1 AS value',
      sqlVersion: 'test',
      parameterSchema: [],
      renderConfig: {
        primaryViewType: 'BAR_CHART',
        primaryTitle: name,
      },
      visibleRoleIds: [],
      displayOrder,
      clickCount7d: 0,
      hitRatePercent: 0,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      ownedBy: 'user_admin',
      updatedAt: '2026-05-28T00:00:00.000Z',
    };
  }

  it('猜你想查不应推荐短时间窗明细模板，避免首屏点击直接空结果', () => {
    const service = new QueryAssetRecommendationService(
      {
        listByUser: jest.fn(() => []),
      } as never,
      {
        listByTimeSlot: jest.fn(() => [
          {
            templateId: 'tpl_weekly_detail',
            globalClickCount: 200,
          },
        ]),
      } as never,
    );

    const summary = service.buildSummary(
      user,
      [
        buildTemplate('tpl_weekly_detail', '近一周新增商机明细', 1, { days: 7 }),
        buildTemplate('tpl_quarter_health', '季度商机健康度总览', 2),
        buildTemplate('tpl_monthly_distribution', '2026 团队新增商机月度分布', 3, { year: 2026 }),
        buildTemplate('tpl_completion', '2026 各团队完成预测', 4, { year: 2026 }),
      ],
      new Date('2026-05-28T08:00:00.000Z'),
    );

    expect(summary.recommendedTemplates.map((item) => item.templateId)).toEqual([
      'tpl_quarter_health',
      'tpl_monthly_distribution',
      'tpl_completion',
    ]);
  });
});
