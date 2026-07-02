import { QueryCompilerService } from '../../../src/modules/analysis/query-compiler.service';
import { QueryWhitelistService } from '../../../src/modules/analysis/query-whitelist.service';
import { DEFAULT_ACCESS_POLICY } from '../../../src/shared/mock/sample-data';

describe('QueryWhitelistService', () => {
  it('默认治理白名单应允许联软渠道商贡献官方 API 的兼容字段', () => {
    const service = new QueryWhitelistService();

    expect(() =>
      service.ensureAllowed(
        ['opportunities', 'partners'],
        {
          opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
          partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
        },
        DEFAULT_ACCESS_POLICY,
      ),
    ).not.toThrow();
  });

  it('默认治理白名单应允许订单渠道商贡献所需的合同兼容字段', () => {
    const service = new QueryWhitelistService();

    expect(() =>
      service.ensureAllowed(
        ['contracts', 'partners', 'contract_assets'],
        {
          contracts: [
            'id',
            'partner_id',
            'user_id',
            'organization_id',
            'department_id',
            'created_at',
            'approve_status',
            'pending_step',
            'submit_applying_at',
            'finish_approve_at',
          ],
          partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
          contract_assets: ['entity_id', 'custom_field_name', 'numeric_asset'],
        },
        DEFAULT_ACCESS_POLICY,
      ),
    ).not.toThrow();
  });

  it('默认治理白名单应允许服务商画像维度字段', () => {
    const service = new QueryWhitelistService();

    expect(() =>
      service.ensureAllowed(
        ['partners'],
        {
          partners: [
            'id',
            'name',
            'shortName',
            'partnerLevel',
            'partnerLevelName',
            'isTechnicalServiceProvider',
            'technicalServiceProviderType',
            'region',
            'createdAt',
          ],
        },
        DEFAULT_ACCESS_POLICY,
      ),
    ).not.toThrow();
  });

  it('默认治理白名单应允许标准 OpenAPI 六类对象经营统计字段', () => {
    const service = new QueryWhitelistService();

    expect(() =>
      service.ensureAllowed(
        ['registrations', 'opportunities', 'quotes', 'orders'],
        {
          registrations: ['id', 'customer', 'status', 'partnerId', 'region', 'createdAt'],
          opportunities: ['id', 'name', 'amount', 'partnerId', 'region', 'createdAt'],
          quotes: ['id', 'customerName', 'oppId', 'partnerId', 'amount', 'createdAt'],
          orders: ['id', 'customerName', 'partnerId', 'amount', 'dealAt', 'createdAt'],
        },
        DEFAULT_ACCESS_POLICY,
      ),
    ).not.toThrow();
  });

  it('默认治理白名单应覆盖当前编译器输出的受控查询字段', () => {
    const service = new QueryWhitelistService();
    const compiler = new QueryCompilerService();
    const domains = [
      'opportunity-analysis',
      'contract-conversion',
      'customer-relationship',
    ] as const;
    const resultKinds = [
      'metric-summary',
      'owner-ranking',
      'time-trend',
      'stage-distribution',
      'category-distribution',
      'department-contribution',
      'partner-contribution',
      'risk-overview',
    ] as const;

    for (const domain of domains) {
      for (const resultKind of resultKinds) {
        const compiled = compiler.compile(
          compiler.buildPlanForResultKind(
            {
              domain,
              metrics: ['金额'],
              dimensions: ['渠道商'],
              filters: { organizationIds: ['10804'] },
              confidence: 'HIGH',
            },
            resultKind,
          ),
        );

        expect(() =>
          service.ensureAllowed(
            compiled.tables,
            compiled.fieldMap,
            DEFAULT_ACCESS_POLICY,
          ),
        ).not.toThrow();
      }
    }
  });

  it('字段未纳入治理白名单时应提示白名单缺口而不是误导为角色权限', () => {
    const service = new QueryWhitelistService();

    expect(() =>
      service.ensureAllowed(
        ['contracts'],
        { contracts: ['not_allowed_field'] },
        DEFAULT_ACCESS_POLICY,
      ),
    ).toThrow('尚未纳入治理白名单');
  });
});
