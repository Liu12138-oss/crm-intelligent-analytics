import { CrmSqliteReadonlyAnalysisExecutorService } from '../../../src/modules/analysis/crm-sqlite-readonly-analysis-executor.service';

describe('CrmSqliteReadonlyAnalysisExecutorService', () => {
  it('组合经营分析应优先使用 mirror 视图汇总，并保留 fact/dim 真实明细', async () => {
    const readResource = jest.fn(async (resource: string) => {
      const recordsByResource: Record<string, Array<Record<string, unknown>>> = {
        partners: [
          {
            partner_id: 'partner_001',
            partner_name: '真实渠道商A',
            partner_level_name: '金牌渠道商',
            region: '华南',
          },
        ],
        registrations: [
          {
            registration_id: 'reg_001',
            customer_name: '真实客户A',
            status_name: '已通过',
            partner_id: 'partner_001',
            partner_name: '真实渠道商A',
            opportunity_id: 'opp_001',
            opportunity_name: '真实商机A',
            estimated_amount: 50000,
            created_at: '2026-06-01',
          },
        ],
        opportunities: [
          {
            opportunity_id: 'opp_001',
            opportunity_name: '真实商机A',
            customer_name: '真实客户A',
            stage_name: '方案报价',
            partner_id: 'partner_001',
            partner_name: '真实渠道商A',
            owner_name: '销售A',
            amount: 120000,
            created_at: '2026-06-02',
          },
        ],
        orders: [
          {
            order_id: 'order_001',
            order_no: 'SO-001',
            order_name: '真实订单A',
            customer_name: '真实客户A',
            opportunity_id: 'opp_001',
            opportunity_name: '真实商机A',
            partner_id: 'partner_001',
            partner_name: '真实渠道商A',
            status_name: '已下单',
            total_amount: 88000,
            created_at: '2026-06-10',
          },
        ],
      };
      return recordsByResource[resource] ?? [];
    });
    const readAnalysisView = jest.fn(async (viewName: string) => {
      const rowsByView: Record<string, Array<Record<string, unknown>>> = {
        v_business_overview: [
          { metric: 'registrations', count_value: 2, amount_value: 60070 },
          { metric: 'opportunities', count_value: 44, amount_value: 298771 },
          { metric: 'orders', count_value: 3, amount_value: 88000 },
        ],
        v_sales_funnel: [
          { stage: 'registrations', count_value: 2, conversion_from_previous: 1 },
          { stage: 'opportunities', count_value: 1, conversion_from_previous: 0.5 },
        ],
        v_partner_contribution: [
          {
            partner_id: 'partner_001',
            partner_name: '真实渠道商A',
            partner_level_name: '金牌渠道商',
            region: '华南',
            registration_count: 2,
            opportunity_count: 44,
            opportunity_amount: 298771,
            order_count: 3,
            order_amount: 88000,
          },
        ],
        v_customer_lifecycle: [
          {
            customer_id: 'customer_001',
            customer_name: '真实客户A',
            lifecycle_stage: '已成单',
            partner_names_json: '["真实渠道商A"]',
            owner_names_json: '["销售A"]',
            registration_count: 1,
            opportunity_count: 1,
            order_count: 1,
          },
        ],
        v_open_risks: [
          {
            risk_type: 'stale_opportunity',
            object_id: 'opp_001',
            object_name: '真实商机A',
            customer_name: '真实客户A',
            partner_name: '真实渠道商A',
            owner_name: '销售A',
            amount: 120000,
            risk_days: 90,
            risk_message: '商机长时间未更新',
          },
        ],
      };
      return rowsByView[viewName] ?? [];
    });
    const executor = new CrmSqliteReadonlyAnalysisExecutorService({
      readResource,
      readAnalysisView,
    } as never);

    const result = await executor.executeBusinessAnalysis({
      questionText: '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
      user: { id: 'A030', roleIds: ['role_superadmin'] } as never,
      scopeSummary: '当前权限范围',
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '当前权限范围',
      } as never,
      resources: ['partners', 'registrations', 'opportunities', 'orders'],
    });

    expect(result.summary).toContain('商机 44 条');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '商机数', value: 44 }),
        expect.objectContaining({ name: '订单数', value: 3 }),
      ]),
    );
    expect(result.tableRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          businessSection: '客户商机报备及商机情况',
          count: 44,
        }),
      ]),
    );

    const partnerView = result.secondaryViews.find(
      (view) => view.title === '渠道商经营贡献汇总',
    );
    expect(partnerView?.rows).toEqual([
      expect.objectContaining({
        partnerName: '真实渠道商A',
        opportunityCount: 44,
        orderCount: 3,
      }),
    ]);

    const opportunityView = result.secondaryViews.find(
      (view) => view.title === '商机明细',
    );
    expect(opportunityView?.rows).toEqual([
      expect.objectContaining({
        opportunityName: '真实商机A',
        customerName: '真实客户A',
        partnerName: '真实渠道商A',
      }),
    ]);
    expect(result.sql).toContain('v_business_overview');
    expect(result.sql).toContain('fact_opportunities');
  });
});
