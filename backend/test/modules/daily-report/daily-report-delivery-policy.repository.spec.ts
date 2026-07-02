import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { DailyReportDeliveryPolicyRepository } from '../../../src/modules/daily-report/daily-report-delivery-policy.repository';

describe('DailyReportDeliveryPolicyRepository', () => {
  it('保存并更新部门日报策略与收件人覆盖', () => {
    const appStorage = {
      state: createDefaultAppStorageState(),
      persist: jest.fn(),
    };
    const repository = new DailyReportDeliveryPolicyRepository(appStorage as never);

    repository.saveDepartmentPolicy({
      departmentId: 'dept_sd_sales',
      departmentName: '山东销售',
      status: 'ENABLED',
      departmentType: 'SALES',
      applyToChildren: false,
      updatedBy: 'user_admin',
      updatedAt: '2026-04-28T10:00:00.000Z',
      reason: '销售团队默认启用日报',
    });

    repository.saveRecipientOverride({
      departmentId: 'dept_sd_region',
      departmentName: '山东区',
      scopeType: 'REGION',
      crmUserId: '2224755',
      recipientName: '牛劲',
      updatedBy: 'user_admin',
      updatedAt: '2026-04-28T10:05:00.000Z',
      reason: '区域负责人承接销售组汇总',
    });

    expect(repository.listDepartmentPolicies()).toEqual([
      expect.objectContaining({
        departmentId: 'dept_sd_sales',
        status: 'ENABLED',
      }),
    ]);
    expect(repository.listRecipientOverrides()).toEqual([
      expect.objectContaining({
        departmentId: 'dept_sd_region',
        crmUserId: '2224755',
      }),
    ]);
    expect(appStorage.persist).toHaveBeenCalledTimes(2);
  });

  it('保存并更新日报销售小组配置', () => {
    const appStorage = {
      state: createDefaultAppStorageState(),
      persist: jest.fn(),
    };
    const repository = new DailyReportDeliveryPolicyRepository(appStorage as never);

    repository.saveSalesGroupConfig({
      groupId: 'manual_henan_sales',
      groupName: '河南销售',
      source: 'MANUAL',
      status: 'ENABLED',
      regionDepartmentName: '河南区',
      recipientCrmUserId: '2224755',
      memberCrmUserIds: ['2224701', '2224702'],
      memberOverrideEnabled: true,
      updatedBy: 'user_admin',
      updatedAt: '2026-05-14T10:00:00.000Z',
      reason: '补充自动识别遗漏的小组',
    });

    repository.saveSalesGroupConfig({
      groupId: 'manual_henan_sales',
      groupName: '河南销售一组',
      source: 'MANUAL',
      status: 'DISABLED',
      regionDepartmentName: '河南区',
      recipientCrmUserId: '2224755',
      memberCrmUserIds: ['2224701'],
      memberOverrideEnabled: true,
      updatedBy: 'user_admin',
      updatedAt: '2026-05-14T10:10:00.000Z',
      reason: '临时停用重复小组',
    });

    expect(repository.listSalesGroupConfigs()).toEqual([
      expect.objectContaining({
        groupId: 'manual_henan_sales',
        groupName: '河南销售一组',
        status: 'DISABLED',
        memberCrmUserIds: ['2224701'],
      }),
    ]);
    expect(appStorage.persist).toHaveBeenCalledTimes(2);
  });
});
