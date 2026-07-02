import { FEATURE_PERMISSION_CATALOG } from '../../../src/modules/governance/feature-permission-catalog';

describe('FEATURE_PERMISSION_CATALOG', () => {
  it('菜单权限目录应覆盖应用壳层当前 7 个一级入口', () => {
    const menuKeys = FEATURE_PERMISSION_CATALOG
      .filter((item) => item.kind === 'menu')
      .map((item) => item.key);

    expect(menuKeys).toEqual([
      'analysis-workbench',
      'contract-review',
      'management-report',
      'permission-center',
      'connection-policy',
      'audit-center',
      'ai-model-governance',
    ]);
    expect(menuKeys).not.toContain('template-governance');
  });
});
