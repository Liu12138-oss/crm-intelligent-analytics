import { AnalysisWarehouseSqlGuardService } from '../../../src/modules/analysis-warehouse/analysis-warehouse-sql-guard.service';
import { QueryRiskGuardService } from '../../../src/modules/analysis/query-risk-guard.service';

/**
 * 构造分析库 SQL 护栏测试夹具。
 *
 * 参数说明：无。
 * 返回值说明：返回待测 SQL 护栏服务。
 * 调用注意事项：只测试 SQL 安全边界，不连接真实 MySQL。
 */
function createService() {
  return new AnalysisWarehouseSqlGuardService(new QueryRiskGuardService());
}

describe('AnalysisWarehouseSqlGuardService', () => {
  it('应允许语义层登记表字段的只读聚合查询，并自动补 LIMIT', () => {
    const service = createService();

    const result = service.validateAndNormalize(`
      SELECT p.partner_name, COUNT(o.opportunity_id) AS opportunity_count
      FROM dim_lianruan_partner p
      LEFT JOIN fact_lianruan_opportunity o ON o.partner_id = p.partner_id
      WHERE p.region = ?
      GROUP BY p.partner_name
      ORDER BY opportunity_count DESC
    `);

    expect(result).toMatchObject({
      tables: ['dim_lianruan_partner', 'fact_lianruan_opportunity'],
      appliedLimit: 100,
    });
    expect(result.normalizedSql).toContain('LIMIT 100');
  });

  it('应允许 ORDER BY 引用聚合结果别名，避免把别名误判为未授权字段', () => {
    const service = createService();

    const result = service.validateAndNormalize(`
      SELECT table_name, COUNT(id) AS field_count
      FROM semantic_field_catalog
      GROUP BY table_name
      ORDER BY field_count DESC
    `);

    expect(result).toMatchObject({
      tables: ['semantic_field_catalog'],
      appliedLimit: 100,
    });
    expect(result.normalizedSql).toContain('LIMIT 100');
  });

  it('应允许客户报备未关联商机的反关联只读查询', () => {
    const service = createService();

    const result = service.validateAndNormalize(`
      SELECT
        r.registration_id,
        r.customer_id,
        r.customer_name,
        r.partner_id,
        p.partner_name,
        r.region,
        r.created_at,
        DATEDIFF(CURRENT_DATE(), DATE(r.created_at)) AS created_days
      FROM fact_lianruan_registration r
      LEFT JOIN fact_lianruan_opportunity o
        ON (
          o.registration_id = r.registration_id
          OR (o.customer_id IS NOT NULL AND o.customer_id = r.customer_id)
        )
      LEFT JOIN dim_lianruan_partner p
        ON p.partner_id = r.partner_id
      WHERE o.opportunity_id IS NULL
      ORDER BY r.created_at ASC, r.registration_id ASC
      LIMIT 1000
    `);

    expect(result).toMatchObject({
      tables: [
        'fact_lianruan_registration',
        'fact_lianruan_opportunity',
        'dim_lianruan_partner',
      ],
      appliedLimit: 1000,
    });
  });

  it('应允许联软补齐后的报价和订单区域字段参与聚合', () => {
    const service = createService();

    const result = service.validateAndNormalize(`
      SELECT
        o.region,
        o.big_region,
        COUNT(o.order_id) AS order_count,
        SUM(o.amount) AS order_amount,
        SUM(q.amount) AS quote_amount
      FROM fact_lianruan_order o
      LEFT JOIN fact_lianruan_quote q
        ON q.customer_id = o.customer_id
      WHERE o.region = ?
        AND o.status NOT IN ('cancelled', 'canceled', 'void', 'rejected', 'deleted')
      GROUP BY o.region, o.big_region
      ORDER BY order_amount DESC
    `);

    expect(result).toMatchObject({
      tables: ['fact_lianruan_order', 'fact_lianruan_quote'],
      appliedLimit: 100,
    });
    expect(result.columns).toEqual(
      expect.arrayContaining(['region', 'big_region', 'order_id', 'amount']),
    );
  });

  it('应允许超两周未更新商机模板使用受控日期函数和状态过滤', () => {
    const service = createService();

    const result = service.validateAndNormalize(`
      SELECT
        o.opportunity_id,
        o.opportunity_name,
        o.customer_name,
        o.partner_name,
        o.owner_name,
        o.stage_name,
        o.region,
        o.big_region,
        o.amount,
        o.source_updated_at,
        DATEDIFF(CURRENT_DATE(), DATE(o.source_updated_at)) AS stale_days
      FROM fact_lianruan_opportunity o
      WHERE o.source_updated_at IS NOT NULL
        AND DATEDIFF(CURRENT_DATE(), DATE(o.source_updated_at)) > 14
        AND COALESCE(o.status, '') NOT IN ('won', 'lost', 'completed', 'cancelled', 'canceled', 'deleted')
        AND COALESCE(o.stage, '') NOT IN ('won', 'lost', 'completed', 'cancelled', 'canceled', 'deleted')
      ORDER BY stale_days DESC, o.amount DESC, o.opportunity_id ASC
      LIMIT 1000
    `);

    expect(result).toMatchObject({
      tables: ['fact_lianruan_opportunity'],
      appliedLimit: 1000,
    });
    expect(result.columns).toEqual(
      expect.arrayContaining(['opportunity_id', 'source_updated_at', 'status', 'stage']),
    );
  });

  it('应允许未活跃客户模板使用 CASE 计算未活跃天数', () => {
    const service = createService();

    const result = service.validateAndNormalize(`
      SELECT
        c.customer_id,
        c.customer_name,
        c.partner_name,
        c.owner_name,
        c.region,
        c.big_region,
        c.category_name,
        c.status_name,
        c.created_at,
        c.latest_activity_at,
        CASE
          WHEN c.latest_activity_at IS NULL THEN DATEDIFF(CURRENT_DATE(), DATE(c.created_at))
          ELSE DATEDIFF(CURRENT_DATE(), DATE(c.latest_activity_at))
        END AS inactive_days
      FROM dim_lianruan_customer c
      WHERE (c.latest_activity_at IS NULL OR DATEDIFF(CURRENT_DATE(), DATE(c.latest_activity_at)) > 30)
      ORDER BY inactive_days DESC, c.created_at ASC, c.customer_id ASC
      LIMIT 1000
    `);

    expect(result).toMatchObject({
      tables: ['dim_lianruan_customer'],
      appliedLimit: 1000,
    });
    expect(result.columns).toEqual(
      expect.arrayContaining(['customer_id', 'latest_activity_at', 'created_at']),
    );
  });

  it('应允许有效订单区域汇总模板使用成交时间兜底表达式', () => {
    const service = createService();

    const result = service.validateAndNormalize(`
      SELECT
        COALESCE(o.region, '未填写') AS region,
        COALESCE(o.big_region, '未填写') AS big_region,
        COUNT(o.order_id) AS order_count,
        SUM(COALESCE(o.amount, 0)) AS order_amount
      FROM fact_lianruan_order o
      WHERE COALESCE(o.status, '') NOT IN ('cancelled', 'canceled', 'void', 'rejected', 'deleted')
        AND COALESCE(o.deal_at, o.created_at) >= ?
        AND COALESCE(o.deal_at, o.created_at) < ?
      GROUP BY COALESCE(o.region, '未填写'), COALESCE(o.big_region, '未填写')
      ORDER BY order_amount DESC, order_count DESC
      LIMIT 1000
    `);

    expect(result).toMatchObject({
      tables: ['fact_lianruan_order'],
      appliedLimit: 1000,
    });
    expect(result.columns).toEqual(
      expect.arrayContaining(['region', 'big_region', 'order_id', 'amount', 'deal_at', 'created_at']),
    );
  });

  it('应允许 P4 漏斗转化模板统计报价和有效订单', () => {
    const service = createService();

    const quoteResult = service.validateAndNormalize(`
      SELECT
        COUNT(q.quote_id) AS quote_count,
        SUM(COALESCE(q.amount, 0)) AS quote_amount
      FROM fact_lianruan_quote q
      WHERE q.region IN (?)
      LIMIT 1000
    `);
    const orderResult = service.validateAndNormalize(`
      SELECT
        COUNT(o.order_id) AS order_count,
        SUM(COALESCE(o.amount, 0)) AS order_amount
      FROM fact_lianruan_order o
      WHERE COALESCE(o.status, '') IN ('confirmed', 'completed')
        AND o.region IN (?)
      LIMIT 1000
    `);

    expect(quoteResult).toMatchObject({
      tables: ['fact_lianruan_quote'],
      appliedLimit: 1000,
    });
    expect(quoteResult.columns).toEqual(expect.arrayContaining(['quote_id', 'amount', 'region']));
    expect(orderResult).toMatchObject({
      tables: ['fact_lianruan_order'],
      appliedLimit: 1000,
    });
    expect(orderResult.columns).toEqual(
      expect.arrayContaining(['order_id', 'amount', 'status', 'region']),
    );
  });

  it('应允许有报价未下单模板使用报价主表左关联有效订单', () => {
    const service = createService();

    const result = service.validateAndNormalize(`
      SELECT
        q.quote_id,
        q.customer_id,
        q.customer_name,
        q.opportunity_id,
        q.partner_id,
        p.partner_name,
        q.owner_name,
        q.assigned_staff_name,
        q.status,
        q.region,
        q.big_region,
        q.amount,
        q.created_at
      FROM fact_lianruan_quote q
      LEFT JOIN fact_lianruan_order o
        ON o.customer_id = q.customer_id
        AND COALESCE(o.status, '') IN ('confirmed', 'completed')
      LEFT JOIN dim_lianruan_partner p
        ON p.partner_id = q.partner_id
      WHERE o.order_id IS NULL
        AND COALESCE(q.status, '') NOT IN ('rejected', 'cancelled', 'canceled', 'deleted')
      ORDER BY q.amount DESC, q.created_at DESC, q.quote_id ASC
      LIMIT 1000
    `);

    expect(result).toMatchObject({
      tables: ['fact_lianruan_quote', 'fact_lianruan_order', 'dim_lianruan_partner'],
      appliedLimit: 1000,
    });
    expect(result.columns).toEqual(
      expect.arrayContaining([
        'quote_id',
        'customer_id',
        'customer_name',
        'opportunity_id',
        'partner_id',
        'partner_name',
        'assigned_staff_name',
        'status',
        'region',
        'big_region',
        'amount',
        'created_at',
        'order_id',
      ]),
    );
  });

  it('应允许渠道商新增和商机增长模板按月份聚合', () => {
    const service = createService();

    const partnerResult = service.validateAndNormalize(`
      SELECT
        DATE_FORMAT(p.created_at, '%Y-%m') AS month_label,
        COUNT(p.partner_id) AS new_partner_count
      FROM dim_lianruan_partner p
      WHERE p.created_at IS NOT NULL
        AND p.created_at >= ?
        AND p.created_at < ?
      GROUP BY DATE_FORMAT(p.created_at, '%Y-%m')
      ORDER BY month_label ASC
      LIMIT 100
    `);
    const opportunityResult = service.validateAndNormalize(`
      SELECT
        DATE_FORMAT(o.created_at, '%Y-%m') AS month_label,
        COUNT(o.opportunity_id) AS new_opportunity_count,
        SUM(COALESCE(o.amount, 0)) AS opportunity_amount
      FROM fact_lianruan_opportunity o
      WHERE o.created_at IS NOT NULL
        AND o.created_at >= ?
        AND o.created_at < ?
      GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
      ORDER BY month_label ASC
      LIMIT 100
    `);

    expect(partnerResult).toMatchObject({
      tables: ['dim_lianruan_partner'],
      appliedLimit: 100,
    });
    expect(partnerResult.columns).toEqual(
      expect.arrayContaining(['created_at', 'partner_id']),
    );
    expect(opportunityResult).toMatchObject({
      tables: ['fact_lianruan_opportunity'],
      appliedLimit: 100,
    });
    expect(opportunityResult.columns).toEqual(
      expect.arrayContaining(['created_at', 'opportunity_id', 'amount']),
    );
  });

  it('应阻断写入语句', () => {
    const service = createService();

    expect(() =>
      service.validateAndNormalize(
        "UPDATE fact_lianruan_order SET amount = 0 WHERE order_id = 'O001'",
      ),
    ).toThrow('当前查询存在高风险写入语句');
  });

  it('应阻断 ODS 原始快照表访问', () => {
    const service = createService();

    expect(() =>
      service.validateAndNormalize(
        'SELECT payload_json FROM ods_lianruan_raw_records LIMIT 10',
      ),
    ).toThrow('未授权的分析表');
  });

  it('应阻断星号查询，避免绕开字段级语义目录', () => {
    const service = createService();

    expect(() =>
      service.validateAndNormalize(
        'SELECT * FROM fact_lianruan_opportunity LIMIT 10',
      ),
    ).toThrow('未授权的字段');
  });
});
