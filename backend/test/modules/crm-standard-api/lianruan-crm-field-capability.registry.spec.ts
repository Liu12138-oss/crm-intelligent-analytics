import { LianruanCrmFieldCapabilityRegistry } from '../../../src/modules/crm-standard-api/lianruan-crm-field-capability.registry';
import { buildLianruanOpenApiAccessPolicySupplement } from '../../../src/shared/governance/lianruan-openapi-access-policy-supplement';

describe('LianruanCrmFieldCapabilityRegistry', () => {
  it('应识别服务商类型字段缺失，并保留兼容字段缺失降级说明', () => {
    const registry = new LianruanCrmFieldCapabilityRegistry();

    const diagnostics = registry.buildDiagnostics(
      {
        partners: [
          {
            id: 'P001',
            name: '山东联软服务商',
            partnerLevel: 'L1',
            region: '山东区',
            status: 'active',
            createdAt: '2026-01-10T00:00:00.000Z',
          },
        ],
      },
      {
        partnerLevels: [{ value: 'L1', label: '一级渠道' }],
      },
    );

    const partnerDiagnostics = diagnostics.resources.find(
      (item) => item.resource === 'partners',
    );
    const partnerTypeField = partnerDiagnostics?.fields.find(
      (item) => item.field === 'partnerType',
    );
    const technicalServiceProviderField = partnerDiagnostics?.fields.find(
      (item) => item.field === 'isTechnicalServiceProvider',
    );

    expect(partnerTypeField).toMatchObject({
      label: '服务商类型',
      requiredLevel: 'P0',
      available: false,
      availabilityStatus: 'MISSING',
    });
    expect(technicalServiceProviderField?.missingBehavior).toContain(
      'partnerType/partnerTypeName',
    );
    expect(diagnostics.overall.missingP0Fields).toEqual(
      expect.arrayContaining([
        {
          resource: 'partners',
          field: 'partnerType',
          label: '服务商类型',
        },
      ]),
    );
  });

  it('资源没有样例时应标记为 NO_SAMPLE，而不是误判远端永久缺字段', () => {
    const registry = new LianruanCrmFieldCapabilityRegistry();

    const diagnostics = registry.buildDiagnostics({}, {});
    const partnerDiagnostics = diagnostics.resources.find(
      (item) => item.resource === 'partners',
    );

    expect(partnerDiagnostics?.sampleCount).toBe(0);
    expect(
      partnerDiagnostics?.fields.every(
        (item) => item.availabilityStatus === 'NO_SAMPLE',
      ),
    ).toBe(true);
  });

  it('应识别本轮补齐的服务商类型字段和字典可用', () => {
    const registry = new LianruanCrmFieldCapabilityRegistry();

    const diagnostics = registry.buildDiagnostics(
      {
        partners: [
          {
            id: 'P001',
            name: '山东联软服务商',
            shortName: '山东联软',
            partnerLevel: 'L1',
            partnerLevelName: '一级渠道',
            partnerType: 'technical',
            partnerTypeName: '技术服务商',
            isTechnicalServiceProvider: true,
            technicalServiceProviderType: 'full',
            region: '山东区',
            status: 'active',
            createdAt: '2026-01-10T00:00:00.000Z',
          },
        ],
      },
      {
        partnerLevels: [{ value: 'L1', label: '一级渠道' }],
        partnerTypes: [
          { value: 'technical', label: '技术服务商' },
          { value: 'channel', label: '渠道商' },
        ],
      },
    );

    const partnerDiagnostics = diagnostics.resources.find(
      (item) => item.resource === 'partners',
    );
    const partnerTypeField = partnerDiagnostics?.fields.find(
      (item) => item.field === 'partnerType',
    );
    const partnerTypeNameField = partnerDiagnostics?.fields.find(
      (item) => item.field === 'partnerTypeName',
    );
    const technicalServiceProviderField = partnerDiagnostics?.fields.find(
      (item) => item.field === 'isTechnicalServiceProvider',
    );
    const technicalServiceProviderTypeField = partnerDiagnostics?.fields.find(
      (item) => item.field === 'technicalServiceProviderType',
    );

    expect(partnerTypeField).toMatchObject({
      available: true,
      availabilityStatus: 'AVAILABLE',
      dictionaryAvailable: true,
    });
    expect(partnerTypeNameField).toMatchObject({
      available: true,
      availabilityStatus: 'AVAILABLE',
      dictionaryAvailable: true,
    });
    expect(technicalServiceProviderField).toMatchObject({
      available: true,
      availabilityStatus: 'AVAILABLE',
      dictionaryAvailable: true,
    });
    expect(technicalServiceProviderTypeField).toMatchObject({
      available: true,
      availabilityStatus: 'AVAILABLE',
      dictionaryAvailable: true,
    });
    expect(diagnostics.overall.missingP0Fields).not.toEqual(
      expect.arrayContaining([
        {
          resource: 'partners',
          field: 'partnerType',
          label: '服务商类型',
        },
      ]),
    );
  });

  it('应按资源字段读取能力并校验用途', () => {
    const registry = new LianruanCrmFieldCapabilityRegistry();

    expect(registry.findCapability('orders', 'amount')).toMatchObject({
      label: '订单金额',
      aggregatable: true,
    });
    expect(registry.supportsFieldUsage('orders', 'amount', 'aggregate')).toBe(true);
    expect(registry.supportsFieldUsage('orders', 'amount', 'filter')).toBe(false);
    expect(registry.supportsFieldUsage('orders', 'notExists', 'read')).toBe(false);
  });

  it('应识别联软新增的报价和订单区域字段可用于聚合分析', () => {
    const registry = new LianruanCrmFieldCapabilityRegistry();

    expect(registry.supportsFieldUsage('quotes', 'region', 'aggregate')).toBe(true);
    expect(registry.supportsFieldUsage('quotes', 'bigRegion', 'aggregate')).toBe(true);
    expect(registry.supportsFieldUsage('orders', 'region', 'aggregate')).toBe(true);
    expect(registry.supportsFieldUsage('orders', 'bigRegion', 'aggregate')).toBe(true);
    expect(registry.supportsFieldUsage('orders', 'assignedPartnerId', 'aggregate')).toBe(true);
  });

  it('应认可联软 SQLite 服务商历史字段作为 OpenAPI 字段兼容别名', () => {
    const registry = new LianruanCrmFieldCapabilityRegistry();

    expect(registry.supportsFieldUsage('partners', 'level', 'aggregate')).toBe(true);
    expect(registry.supportsFieldUsage('partners', 'isTechService', 'aggregate')).toBe(true);
    expect(registry.supportsFieldUsage('partners', 'techServiceType', 'aggregate')).toBe(true);
    expect(registry.supportsFieldUsage('partners', 'joinDate', 'filter')).toBe(true);
    expect(registry.supportsFieldUsage('partners', 'totalAmt', 'aggregate')).toBe(true);
  });

  it('非敏感标准字段应同步进入联软 OpenAPI 业务白名单补齐项', () => {
    const registry = new LianruanCrmFieldCapabilityRegistry();
    const supplement = buildLianruanOpenApiAccessPolicySupplement();

    // 白名单补齐项只覆盖主资源，catalog/operation 资源走独立接入路径
    const primaryResources: string[] = [
      'users',
      'customers',
      'partners',
      'registrations',
      'opportunities',
      'quotes',
      'orders',
    ];

    const missingFields = registry
      .listCapabilities()
      .filter((item) => primaryResources.includes(item.resource as string))
      .filter((item) => !item.sensitive)
      .filter((item) => !supplement.allowedFields[item.resource]?.includes(item.field))
      .map((item) => `${item.resource}.${item.field}`);

    expect(missingFields).toEqual([]);
  });
});
