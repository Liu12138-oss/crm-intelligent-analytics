import { OrganizationScopeService } from '../../../src/modules/governance/organization-scope.service';
import type {
  AppStorageState,
  CrmUser,
  DataScopeGrantRecord,
  WecomSyncedUserRecord,
} from '../../../src/shared/types/domain';
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';

describe('OrganizationScopeService', () => {
  const now = '2026-04-23T10:00:00.000Z';

  function buildService(params?: {
    users?: WecomSyncedUserRecord[];
    grants?: DataScopeGrantRecord[];
    departments?: AppStorageState['wecomSyncedDepartments'];
    crmWxUsers?: AppStorageState['crmWxUsers'];
    crmWxUserMaps?: AppStorageState['crmWxUserMaps'];
    superAdminUserIds?: string[];
    superAdminRoleIds?: string[];
  }): OrganizationScopeService {
    const state: AppStorageState = {
      ...createDefaultAppStorageState(),
      wecomSyncedDepartments: params?.departments ?? [],
      wecomSyncedUsers: params?.users ?? [],
      dataScopeGrants: params?.grants ?? [],
      crmWxUsers: params?.crmWxUsers ?? [
        {
          id: 'wx_record_wangdong',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_wangdong',
          name: '王冬',
          departmentIds: ['dept_big_north'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'wx_record_yangang',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_yangang',
          name: '严刚',
          departmentIds: ['dept_big_north'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'wx_record_guanjundong',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_guanjundong',
          name: '官俊东',
          departmentIds: ['dept_big_north'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      crmWxUserMaps: params?.crmWxUserMaps ?? [
        {
          id: 'map_wangdong',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_wangdong',
          crmUserId: 'crm_wangdong',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'map_yangang',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_yangang',
          crmUserId: 'crm_yangang',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'map_guanjundong',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_guanjundong',
          crmUserId: 'crm_guanjundong',
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    return new OrganizationScopeService(
      { state } as never,
      {
        isSuperAdminSubject: jest.fn((user: CrmUser) =>
          (params?.superAdminUserIds ?? []).includes(user.id) ||
          user.roleIds.some((roleId) => (params?.superAdminRoleIds ?? []).includes(roleId)),
        ),
      } as never,
    );
  }

  function buildSyncedUser(params: {
    wxUserid: string;
    userName: string;
    primaryDepartmentId?: string;
    departmentIds?: string[];
    directLeaderUserids?: string[];
  }): WecomSyncedUserRecord {
    return {
      id: `sync_${params.wxUserid}`,
      wxUserid: params.wxUserid,
      originUserid: params.wxUserid,
      userName: params.userName,
      organizationExternalId: 'wx_org_mock',
      primaryDepartmentId: params.primaryDepartmentId ?? 'dept_big_north',
      departmentIds: params.departmentIds ?? ['dept_big_north'],
      directLeaderUserids: params.directLeaderUserids ?? [],
      rawPayload: {
        userid: params.wxUserid,
        name: params.userName,
        direct_leader: params.directLeaderUserids ?? [],
      },
      syncStatus: 'ACTIVE',
      lastSyncedAt: now,
    };
  }

  function buildUser(overrides: Partial<CrmUser>): CrmUser {
    return {
      id: 'crm_wangdong',
      name: '王冬',
      roleIds: ['role_region_director'],
      roleNames: ['大区负责人'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_big_north'],
      ownerIds: [],
      isAdmin: false,
      exportAllowed: false,
      channels: ['web-console', 'wecom-bot'],
      wecomSenderId: 'wx_wangdong',
      ...overrides,
    };
  }

  it('应通过直属上级链把严刚和官俊东归入王冬团队范围', () => {
    const service = buildService({
      users: [
        buildSyncedUser({ wxUserid: 'wx_wangdong', userName: '王冬' }),
        buildSyncedUser({
          wxUserid: 'wx_yangang',
          userName: '严刚',
          directLeaderUserids: ['wx_wangdong'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_guanjundong',
          userName: '官俊东',
          directLeaderUserids: ['wx_wangdong'],
        }),
      ],
    });

    const scope = service.resolveScope(buildUser({}));

    expect(scope.ownerIds).toEqual(
      expect.arrayContaining(['crm_wangdong', 'crm_yangang', 'crm_guanjundong']),
    );
    expect(scope.scopeSummary).toContain('王冬');
    expect(scope.scopeSummary).toContain('团队');
  });

  it('山东区负责人直属链跨区时，分析默认范围应裁剪到默认业务部门及子部门', () => {
    const crmWxUsers = [
      { id: 'wx_niujin', wxOrganizationId: 'wx_org_mock', userid: 'wx_niujin', name: '牛劲', departmentIds: ['dept_shandong'], createdAt: now, updatedAt: now },
      { id: 'wx_sd_a', wxOrganizationId: 'wx_org_mock', userid: 'wx_sd_a', name: '山东销售一', departmentIds: ['dept_shandong_sales'], createdAt: now, updatedAt: now },
      { id: 'wx_sd_b', wxOrganizationId: 'wx_org_mock', userid: 'wx_sd_b', name: '山东销售二', departmentIds: ['dept_shandong_sales'], createdAt: now, updatedAt: now },
      { id: 'wx_sz_a', wxOrganizationId: 'wx_org_mock', userid: 'wx_sz_a', name: '深圳销售一', departmentIds: ['dept_shenzhen'], createdAt: now, updatedAt: now },
      { id: 'wx_tech_a', wxOrganizationId: 'wx_org_mock', userid: 'wx_tech_a', name: '技术服务一', departmentIds: ['dept_tech_service'], createdAt: now, updatedAt: now },
    ];
    const crmWxUserMaps = crmWxUsers.map((item) => ({
      id: `map_${item.id}`,
      wxOrganizationId: 'wx_org_mock',
      wxUserId: item.id,
      crmUserId: item.id.replace('wx_', 'crm_'),
      createdAt: now,
      updatedAt: now,
    }));
    const service = buildService({
      departments: [
        {
          id: 'sync_dept_shandong',
          wxDepartmentId: 'dept_shandong',
          departmentName: '大北区-山东区',
          parentDepartmentId: 'dept_big_north',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: now,
        },
        {
          id: 'sync_dept_shandong_sales',
          wxDepartmentId: 'dept_shandong_sales',
          departmentName: '山东销售一部',
          parentDepartmentId: 'dept_shandong',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: now,
        },
        {
          id: 'sync_dept_shenzhen',
          wxDepartmentId: 'dept_shenzhen',
          departmentName: '大南区-深圳区',
          parentDepartmentId: 'dept_big_south',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: now,
        },
        {
          id: 'sync_dept_tech',
          wxDepartmentId: 'dept_tech_service',
          departmentName: '技术服务线',
          parentDepartmentId: 'dept_headquarters',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: now,
        },
      ],
      users: [
        buildSyncedUser({
          wxUserid: 'wx_niujin',
          userName: '牛劲',
          primaryDepartmentId: 'dept_shandong',
          departmentIds: ['dept_shandong'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_sd_a',
          userName: '山东销售一',
          primaryDepartmentId: 'dept_shandong_sales',
          departmentIds: ['dept_shandong_sales'],
          directLeaderUserids: ['wx_niujin'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_sd_b',
          userName: '山东销售二',
          primaryDepartmentId: 'dept_shandong_sales',
          departmentIds: ['dept_shandong_sales'],
          directLeaderUserids: ['wx_sd_a'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_sz_a',
          userName: '深圳销售一',
          primaryDepartmentId: 'dept_shenzhen',
          departmentIds: ['dept_shenzhen'],
          directLeaderUserids: ['wx_niujin'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_tech_a',
          userName: '技术服务一',
          primaryDepartmentId: 'dept_tech_service',
          departmentIds: ['dept_tech_service'],
          directLeaderUserids: ['wx_niujin'],
        }),
      ],
      crmWxUsers,
      crmWxUserMaps,
    });

    const scope = service.resolveScope(
      buildUser({
        id: 'crm_niujin',
        name: '牛劲',
        departmentIds: ['dept_shandong'],
        wecomSenderId: 'wx_niujin',
      }),
    );

    expect(scope.ownerIds).toEqual(
      expect.arrayContaining(['crm_niujin', 'crm_sd_a', 'crm_sd_b']),
    );
    expect(scope.ownerIds).not.toContain('crm_sz_a');
    expect(scope.ownerIds).not.toContain('crm_tech_a');
    expect(scope.defaultDepartmentIds).toEqual(
      expect.arrayContaining(['dept_shandong', 'dept_shandong_sales']),
    );
    expect(scope.scopeSummary).toContain('已按默认业务部门');
  });

  it('生产 CRM 部门 ID 与企业微信部门 ID 不一致时，不应把山东区下属误裁成仅本人', () => {
    const crmWxUsers = [
      {
        id: 'wx_niujin',
        wxOrganizationId: 'wx_org_mock',
        userid: 'NiuJin',
        name: '牛劲',
        departmentIds: ['101'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'wx_sd_a',
        wxOrganizationId: 'wx_org_mock',
        userid: 'ShanDongA',
        name: '山东销售一',
        departmentIds: ['102'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'wx_sd_b',
        wxOrganizationId: 'wx_org_mock',
        userid: 'ShanDongB',
        name: '山东销售二',
        departmentIds: ['102'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'wx_sz_a',
        wxOrganizationId: 'wx_org_mock',
        userid: 'ShenZhenA',
        name: '深圳销售一',
        departmentIds: ['202'],
        createdAt: now,
        updatedAt: now,
      },
    ];
    const crmWxUserMaps = [
      { wxUserId: 'wx_niujin', crmUserId: '1001' },
      { wxUserId: 'wx_sd_a', crmUserId: '1002' },
      { wxUserId: 'wx_sd_b', crmUserId: '1003' },
      { wxUserId: 'wx_sz_a', crmUserId: '2001' },
    ].map((item) => ({
      id: `map_${item.wxUserId}`,
      wxOrganizationId: 'wx_org_mock',
      wxUserId: item.wxUserId,
      crmUserId: item.crmUserId,
      createdAt: now,
      updatedAt: now,
    }));
    const service = buildService({
      departments: [
        {
          id: 'sync_dept_sd_region',
          wxDepartmentId: '101',
          departmentName: '山东区',
          parentDepartmentId: '10',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: now,
        },
        {
          id: 'sync_dept_sd_sales',
          wxDepartmentId: '102',
          departmentName: '山东销售',
          parentDepartmentId: '101',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: now,
        },
        {
          id: 'sync_dept_sz_sales',
          wxDepartmentId: '202',
          departmentName: '深圳销售',
          parentDepartmentId: '20',
          rawPayload: {},
          syncStatus: 'ACTIVE',
          lastSyncedAt: now,
        },
      ],
      users: [
        buildSyncedUser({
          wxUserid: 'NiuJin',
          userName: '牛劲',
          primaryDepartmentId: '101',
          departmentIds: ['101'],
        }),
        buildSyncedUser({
          wxUserid: 'ShanDongA',
          userName: '山东销售一',
          primaryDepartmentId: '102',
          departmentIds: ['102'],
          directLeaderUserids: ['NiuJin'],
        }),
        buildSyncedUser({
          wxUserid: 'ShanDongB',
          userName: '山东销售二',
          primaryDepartmentId: '102',
          departmentIds: ['102'],
          directLeaderUserids: ['ShanDongA'],
        }),
        buildSyncedUser({
          wxUserid: 'ShenZhenA',
          userName: '深圳销售一',
          primaryDepartmentId: '202',
          departmentIds: ['202'],
          directLeaderUserids: ['NiuJin'],
        }),
      ],
      crmWxUsers,
      crmWxUserMaps,
    });

    const scope = service.resolveScope(
      buildUser({
        id: '1001',
        name: '牛劲',
        departmentIds: ['578'],
        wecomSenderId: 'NiuJin',
      }),
    );

    expect(scope.ownerIds).toEqual(
      expect.arrayContaining(['1001', '1002', '1003']),
    );
    expect(scope.ownerIds).not.toContain('2001');
    expect(scope.defaultDepartmentIds).toEqual(
      expect.arrayContaining(['101', '102']),
    );
  });

  it('应叠加角色数据范围白名单并忽略过期授权', () => {
    const service = buildService({
      users: [buildSyncedUser({ wxUserid: 'wx_wangdong', userName: '王冬' })],
      grants: [
        {
          id: 'grant_active',
          subjectType: 'ROLE',
          subjectId: 'role_region_director',
          departmentIds: ['dept_authorized'],
          includeSubDepartments: true,
          reason: '临时查看授权部门',
          status: 'ACTIVE',
          updatedBy: 'user_admin',
          updatedAt: now,
        },
        {
          id: 'grant_expired',
          subjectType: 'USER',
          subjectId: 'crm_wangdong',
          departmentIds: ['dept_expired'],
          includeSubDepartments: false,
          reason: '已过期授权',
          expiresAt: '2026-04-22T23:59:59.000Z',
          status: 'ACTIVE',
          updatedBy: 'user_admin',
          updatedAt: now,
        },
      ],
    });

    const scope = service.resolveScope(buildUser({}));

    expect(scope.departmentIds).toContain('dept_authorized');
    expect(scope.departmentIds).not.toContain('dept_expired');
    expect(scope.grantSummaries).toEqual(
      expect.arrayContaining(['角色 role_region_director 授权部门：dept_authorized（含子部门）']),
    );
  });

  it('管理员即使登录快照只带单个部门，也不应被 departmentIds 或 ownerIds 收窄', () => {
    const service = buildService({
      users: [buildSyncedUser({ wxUserid: 'wx_wangdong', userName: '王冬' })],
    });

    const scope = service.resolveScope(
      buildUser({
        roleIds: ['2619'],
        roleNames: ['超级管理员'],
        organizationIds: ['10804'],
        departmentIds: ['5434'],
        ownerIds: [],
        isAdmin: true,
      }),
    );

    expect(scope.organizationIds).toEqual(['10804']);
    expect(scope.departmentIds).toEqual([]);
    expect(scope.ownerIds).toEqual([]);
    expect(scope.isFullAccess).toBe(true);
    expect(scope.fullAccessSource).toBe('crm-admin');
    expect(scope.scopeSummary).toContain('管理员视角');
  });

  it('应用超级管理员应返回全量范围标记且不按本人 owner 收口', () => {
    const service = buildService({
      superAdminUserIds: ['crm_assistant'],
      users: [buildSyncedUser({ wxUserid: 'wx_assistant', userName: '总裁办助理' })],
    });

    const scope = service.resolveScope(
      buildUser({
        id: 'crm_assistant',
        name: '总裁办助理',
        departmentIds: ['dept_president_office'],
        ownerIds: ['crm_assistant'],
        wecomSenderId: 'wx_assistant',
      }),
    );

    expect(scope.departmentIds).toEqual([]);
    expect(scope.ownerIds).toEqual([]);
    expect(scope.scopeSource).toBe('application-super-admin');
    expect(scope.isFullAccess).toBe(true);
    expect(scope.fullAccessSource).toBe('application-super-admin');
    expect(scope.scopeSummary).toContain('应用超级管理员授权');
  });

  it('其它用户命中角色超级管理员授权时，普通用户范围不应被扩大', () => {
    const service = buildService({
      superAdminRoleIds: ['role_boss'],
      users: [buildSyncedUser({ wxUserid: 'wx_wangdong', userName: '王冬' })],
    });

    const scope = service.resolveScope(buildUser({
      id: 'crm_wangdong',
      roleIds: ['role_region_director'],
    }));

    expect(scope.scopeSource).not.toBe('application-super-admin');
    expect(scope.isFullAccess).not.toBe(true);
    expect(scope.ownerIds).toContain('crm_wangdong');
  });

  it('应能按 CRM 用户解析同直属上级的小组成员', () => {
    const service = buildService({
      users: [
        buildSyncedUser({ wxUserid: 'wx_wangdong', userName: '王冬' }),
        buildSyncedUser({
          wxUserid: 'wx_yangang',
          userName: '严刚',
          directLeaderUserids: ['wx_wangdong'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_guanjundong',
          userName: '官俊东',
          directLeaderUserids: ['wx_wangdong'],
        }),
      ],
    });

    const memberIds = service.collectSiblingCrmUserIdsByCrmUserId('crm_yangang');

    expect(memberIds).toEqual(expect.arrayContaining(['crm_guanjundong']));
    expect(memberIds).not.toContain('crm_yangang');
  });

  it('应能按 CRM 用户递归解析上级链', () => {
    const service = buildService({
      users: [
        buildSyncedUser({
          wxUserid: 'wx_sales_vp',
          userName: '销售副总',
        }),
        buildSyncedUser({
          wxUserid: 'wx_wangdong',
          userName: '王冬',
          directLeaderUserids: ['wx_sales_vp'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_yangang',
          userName: '严刚',
          directLeaderUserids: ['wx_wangdong'],
        }),
      ],
    });

    const state = (service as unknown as { appStorage: { state: AppStorageState } }).appStorage
      .state;
    state.crmWxUsers.push(
      {
        id: 'wx_record_sales_vp',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_sales_vp',
        name: '销售副总',
        departmentIds: ['dept_big_north'],
        createdAt: now,
        updatedAt: now,
      },
    );
    state.crmWxUserMaps.push({
      id: 'map_sales_vp',
      wxOrganizationId: 'wx_org_mock',
      wxUserId: 'wx_record_sales_vp',
      crmUserId: 'crm_sales_vp',
      createdAt: now,
      updatedAt: now,
    });

    const ancestorIds = service.collectAncestorCrmUserIdsByCrmUserId('crm_yangang');

    expect(ancestorIds).toEqual(
      expect.arrayContaining(['crm_wangdong', 'crm_sales_vp']),
    );
  });
});
