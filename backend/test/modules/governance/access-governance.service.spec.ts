import { ForbiddenException } from '@nestjs/common';
import { AccessGovernanceService } from '../../../src/modules/governance/access-governance.service';
import type { CrmUser } from '../../../src/shared/types/domain';

const adminUser: CrmUser = {
  id: 'user_admin',
  name: '系统管理员',
  roleIds: ['role_admin'],
  roleNames: ['系统管理员'],
  organizationIds: ['org_north'],
  departmentIds: ['dept_admin'],
  ownerIds: [],
  isAdmin: true,
  exportAllowed: true,
  channels: ['web-console'],
};

const normalUser: CrmUser = {
  ...adminUser,
  id: 'user_normal',
  name: '普通用户',
  isAdmin: false,
  roleIds: ['role_normal'],
  roleNames: ['普通用户'],
};

function createServiceFixture() {
  const accessDecisionService = {
    hasAction: jest.fn(() => false),
  };
  const crmReadonlyService = {
    listAccessGovernanceUsers: jest.fn(async () => [
      { value: 'user_region_manager', label: '区域经理（区域经理）' },
    ]),
    listAccessGovernanceDepartments: jest.fn(async () => [
      { value: 'dept_region_east', label: '华东销售部', parentDepartmentId: 'dept_sales' },
    ]),
  };
  const appStorageService = {
    state: {
      wecomSyncedDepartments: [
        {
          id: 'sync_dept_region_east',
          wxDepartmentId: 'dept_region_east',
          departmentName: '华东销售部',
          parentDepartmentId: 'dept_sales',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: '2026-05-20T10:01:00.000Z',
        },
        {
          id: 'sync_dept_unmapped',
          wxDepartmentId: 'wx_dept_unmapped',
          departmentName: '未映射部门',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: '2026-05-20T10:02:00.000Z',
        },
        {
          id: 'sync_dept_deleted',
          wxDepartmentId: 'wx_dept_deleted',
          departmentName: '已删除部门',
          rawPayload: {},
          syncStatus: 'DELETED',
          lastSyncedAt: '2026-05-20T10:03:00.000Z',
        },
      ],
      wecomSyncedUsers: [
        {
          id: 'sync_user_region_manager',
          wxUserid: 'wx_region_manager',
          userName: '区域经理',
          primaryDepartmentId: 'dept_region_east',
          departmentIds: ['dept_region_east'],
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: '2026-05-20T10:04:00.000Z',
        },
        {
          id: 'sync_user_unmapped',
          wxUserid: 'wx_unmapped_member',
          userName: '未映射成员',
          primaryDepartmentId: 'dept_region_east',
          departmentIds: ['dept_region_east'],
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: '2026-05-20T10:05:00.000Z',
        },
        {
          id: 'sync_user_conflicted',
          wxUserid: 'wx_conflicted_member',
          userName: '冲突成员',
          primaryDepartmentId: 'dept_region_east',
          departmentIds: ['dept_region_east'],
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: '2026-05-20T10:06:00.000Z',
        },
        {
          id: 'sync_user_deleted',
          wxUserid: 'wx_deleted_member',
          userName: '已删除成员',
          primaryDepartmentId: 'dept_region_east',
          departmentIds: ['dept_region_east'],
          rawPayload: {},
          syncStatus: 'DELETED',
          lastSyncedAt: '2026-05-20T10:07:00.000Z',
        },
      ],
      crmWxUsers: [
        {
          id: 'crm_wx_user_region_manager',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_region_manager',
          name: '区域经理',
          departmentIds: ['dept_region_east'],
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
        {
          id: 'crm_wx_user_conflicted',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_conflicted_member',
          name: '冲突成员',
          departmentIds: ['dept_region_east'],
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
      ],
      crmWxUserMaps: [
        {
          id: 'map_region_manager',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'crm_wx_user_region_manager',
          crmUserId: 'user_region_manager',
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
        {
          id: 'map_conflict_one',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'crm_wx_user_conflicted',
          crmUserId: 'user_region_manager',
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
        {
          id: 'map_conflict_two',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'crm_wx_user_conflicted',
          crmUserId: 'user_other',
          createdAt: '2026-05-20T10:00:00.000Z',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
      ],
    },
  };
  const service = new AccessGovernanceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    accessDecisionService as never,
    crmReadonlyService as never,
    {} as never,
    appStorageService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, accessDecisionService };
}

describe('AccessGovernanceService.getWecomOrganizationSubjects', () => {
  it('应返回企业微信组织对象的 CRM 映射状态和不可选原因', async () => {
    const { service } = createServiceFixture();

    const result = await service.getWecomOrganizationSubjects(adminUser);

    expect(result.lastSyncedAt).toBe('2026-05-20T10:07:00.000Z');
    expect(result.departments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          departmentId: 'dept_region_east',
          crmDepartmentId: 'dept_region_east',
          mappingStatus: 'MAPPED',
        }),
        expect.objectContaining({
          departmentId: 'wx_dept_unmapped',
          mappingStatus: 'UNMAPPED',
          disabledReason: '未绑定 CRM 部门，不能保存为授权部门。',
        }),
        expect.objectContaining({
          departmentId: 'wx_dept_deleted',
          mappingStatus: 'DELETED',
          disabledReason: '该部门已从企业微信通讯录删除。',
        }),
      ]),
    );
    expect(result.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          wecomUserId: 'wx_region_manager',
          crmUserId: 'user_region_manager',
          crmUserName: '区域经理',
          mappingStatus: 'MAPPED',
        }),
        expect.objectContaining({
          wecomUserId: 'wx_unmapped_member',
          mappingStatus: 'UNMAPPED',
          disabledReason: '未绑定 CRM 用户，不能保存为授权人员。',
        }),
        expect.objectContaining({
          wecomUserId: 'wx_conflicted_member',
          mappingStatus: 'CONFLICTED',
          disabledReason: '企业微信成员存在多个 CRM 映射，请先修复身份映射。',
        }),
        expect.objectContaining({
          wecomUserId: 'wx_deleted_member',
          mappingStatus: 'DELETED',
          disabledReason: '该成员已从企业微信通讯录删除。',
        }),
      ]),
    );
  });

  it('无治理权限的用户不能读取组织对象清单', async () => {
    const { service } = createServiceFixture();

    await expect(service.getWecomOrganizationSubjects(normalUser)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
