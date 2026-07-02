import { OrganizationScopeService } from '../../../src/modules/governance/organization-scope.service';
import { FollowUpAuthorizationService } from '../../../src/modules/opportunities/follow-up-authorization.service';
import type {
  AppStorageState,
  CrmUser,
  WecomSyncedUserRecord,
} from '../../../src/shared/types/domain';
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';

describe('FollowUpAuthorizationService', () => {
  const now = '2026-04-27T10:00:00.000Z';

  function buildSyncedUser(params: {
    wxUserid: string;
    userName: string;
    directLeaderUserids?: string[];
  }): WecomSyncedUserRecord {
    return {
      id: `sync_${params.wxUserid}`,
      wxUserid: params.wxUserid,
      originUserid: params.wxUserid,
      userName: params.userName,
      organizationExternalId: 'wx_org_mock',
      primaryDepartmentId: 'dept_sales',
      departmentIds: ['dept_sales'],
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
      id: 'crm_actor',
      name: '当前用户',
      roleIds: ['role_sales'],
      roleNames: ['销售'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_sales'],
      ownerIds: [],
      isAdmin: false,
      exportAllowed: false,
      channels: ['wecom-bot'],
      ...overrides,
    };
  }

  function buildService(params?: {
    users?: WecomSyncedUserRecord[];
    crmWxUsers?: AppStorageState['crmWxUsers'];
    crmWxUserMaps?: AppStorageState['crmWxUserMaps'];
  }): FollowUpAuthorizationService {
    const state: AppStorageState = {
      ...createDefaultAppStorageState(),
      wecomSyncedUsers: params?.users ?? [],
      crmWxUsers: params?.crmWxUsers ?? [],
      crmWxUserMaps: params?.crmWxUserMaps ?? [],
    };

    const organizationScopeService = new OrganizationScopeService({ state } as never);
    return new FollowUpAuthorizationService(organizationScopeService);
  }

  it('负责人本人应被允许', () => {
    const service = buildService();
    const result = service.evaluate({
      actor: buildUser({ id: 'crm_owner', name: '张琳' }),
      target: {
        objectType: 'Customer',
        objectId: 'cus_001',
        objectTitle: '中国银行江西省分行',
        ownerId: 'crm_owner',
        ownerName: '张琳',
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.relation).toBe('OWNER_SELF');
  });

  it('协作人本人应被允许', () => {
    const service = buildService({
      users: [
        buildSyncedUser({ wxUserid: 'wx_leader', userName: '王冬' }),
        buildSyncedUser({
          wxUserid: 'wx_actor',
          userName: '李浩',
          directLeaderUserids: ['wx_leader'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_owner',
          userName: '张琳',
          directLeaderUserids: ['wx_leader'],
        }),
      ],
      crmWxUsers: [
        {
          id: 'wx_record_actor',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_actor',
          name: '李浩',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'wx_record_owner',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_owner',
          name: '张琳',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      crmWxUserMaps: [
        {
          id: 'map_actor',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_actor',
          crmUserId: 'crm_actor',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'map_owner',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_owner',
          crmUserId: 'crm_owner',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const result = service.evaluate({
      actor: buildUser({ id: 'crm_actor', name: '李浩', wecomSenderId: 'wx_actor' }),
      target: {
        objectType: 'Opportunity',
        objectId: 'opp_001',
        objectTitle: '中国银行续约',
        ownerId: 'crm_owner',
        ownerName: '张琳',
        assistUserIds: ['crm_actor'],
        assistUserNames: ['李浩'],
      } as never,
    });

    expect(result.allowed).toBe(true);
    expect(result.relation).toBe('COLLABORATOR_SELF');
  });

  it('递归上级应被允许', () => {
    const service = buildService({
      users: [
        buildSyncedUser({ wxUserid: 'wx_vp', userName: '销售副总' }),
        buildSyncedUser({
          wxUserid: 'wx_leader',
          userName: '王冬',
          directLeaderUserids: ['wx_vp'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_owner',
          userName: '张琳',
          directLeaderUserids: ['wx_leader'],
        }),
      ],
      crmWxUsers: [
        {
          id: 'wx_record_vp',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_vp',
          name: '销售副总',
          departmentIds: ['dept_sales_management'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'wx_record_owner',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_owner',
          name: '张琳',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      crmWxUserMaps: [
        {
          id: 'map_vp',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_vp',
          crmUserId: 'crm_vp',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'map_owner',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_owner',
          crmUserId: 'crm_owner',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const result = service.evaluate({
      actor: buildUser({ id: 'crm_vp', name: '销售副总', wecomSenderId: 'wx_vp' }),
      target: {
        objectType: 'Customer',
        objectId: 'cus_001',
        objectTitle: '中国银行江西省分行',
        ownerId: 'crm_owner',
        ownerName: '张琳',
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.relation).toBe('OWNER_GROUP_LEADER');
  });

  it('协作人的递归上级应被允许', () => {
    const service = buildService({
      users: [
        buildSyncedUser({ wxUserid: 'wx_vp', userName: '销售副总' }),
        buildSyncedUser({
          wxUserid: 'wx_actor',
          userName: '李浩',
          directLeaderUserids: ['wx_vp'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_owner',
          userName: '张琳',
          directLeaderUserids: ['wx_leader'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_leader',
          userName: '王冬',
        }),
      ],
      crmWxUsers: [
        {
          id: 'wx_record_vp',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_vp',
          name: '销售副总',
          departmentIds: ['dept_sales_management'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'wx_record_actor',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_actor',
          name: '李浩',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'wx_record_owner',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_owner',
          name: '张琳',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      crmWxUserMaps: [
        {
          id: 'map_vp',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_vp',
          crmUserId: 'crm_vp',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'map_actor',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_actor',
          crmUserId: 'crm_actor',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'map_owner',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_owner',
          crmUserId: 'crm_owner',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const result = service.evaluate({
      actor: buildUser({ id: 'crm_vp', name: '销售副总', wecomSenderId: 'wx_vp' }),
      target: {
        objectType: 'Customer',
        objectId: 'cus_001',
        objectTitle: '中国银行江西省分行',
        ownerId: 'crm_owner',
        ownerName: '张琳',
        assistUserIds: ['crm_actor'],
        assistUserNames: ['李浩'],
      } as never,
    });

    expect(result.allowed).toBe(true);
    expect(result.relation).toBe('COLLABORATOR_LEADER');
  });

  it('同直属小组但不是负责人或协作人的成员应被拒绝', () => {
    const service = buildService({
      users: [
        buildSyncedUser({ wxUserid: 'wx_leader', userName: '王冬' }),
        buildSyncedUser({
          wxUserid: 'wx_actor',
          userName: '李浩',
          directLeaderUserids: ['wx_leader'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_owner',
          userName: '张琳',
          directLeaderUserids: ['wx_leader'],
        }),
      ],
      crmWxUsers: [
        {
          id: 'wx_record_actor',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_actor',
          name: '李浩',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'wx_record_owner',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_owner',
          name: '张琳',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      crmWxUserMaps: [
        {
          id: 'map_actor',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_actor',
          crmUserId: 'crm_actor',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'map_owner',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_owner',
          crmUserId: 'crm_owner',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const result = service.evaluate({
      actor: buildUser({ id: 'crm_actor', name: '李浩', wecomSenderId: 'wx_actor' }),
      target: {
        objectType: 'Opportunity',
        objectId: 'opp_001',
        objectTitle: '中国银行续约',
        ownerId: 'crm_owner',
        ownerName: '张琳',
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.relation).toBe('DENIED');
  });

  it('无关平级成员应被拒绝', () => {
    const service = buildService({
      users: [
        buildSyncedUser({ wxUserid: 'wx_leader_a', userName: '王冬' }),
        buildSyncedUser({ wxUserid: 'wx_leader_b', userName: '李总' }),
        buildSyncedUser({
          wxUserid: 'wx_actor',
          userName: '王敏',
          directLeaderUserids: ['wx_leader_a'],
        }),
        buildSyncedUser({
          wxUserid: 'wx_owner',
          userName: '张琳',
          directLeaderUserids: ['wx_leader_b'],
        }),
      ],
      crmWxUsers: [
        {
          id: 'wx_record_actor',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_actor',
          name: '王敏',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'wx_record_owner',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_owner',
          name: '张琳',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      crmWxUserMaps: [
        {
          id: 'map_actor',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_actor',
          crmUserId: 'crm_actor',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'map_owner',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_owner',
          crmUserId: 'crm_owner',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const result = service.evaluate({
      actor: buildUser({ id: 'crm_actor', name: '王敏', wecomSenderId: 'wx_actor' }),
      target: {
        objectType: 'Opportunity',
        objectId: 'opp_001',
        objectTitle: '中国银行续约',
        ownerId: 'crm_owner',
        ownerName: '张琳',
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.relation).toBe('DENIED');
  });

  it('负责人映射缺失时应被拒绝', () => {
    const service = buildService({
      users: [buildSyncedUser({ wxUserid: 'wx_actor', userName: '李浩' })],
      crmWxUsers: [
        {
          id: 'wx_record_actor',
          wxOrganizationId: 'wx_org_mock',
          userid: 'wx_actor',
          name: '李浩',
          departmentIds: ['dept_sales'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      crmWxUserMaps: [
        {
          id: 'map_actor',
          wxOrganizationId: 'wx_org_mock',
          wxUserId: 'wx_record_actor',
          crmUserId: 'crm_actor',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const result = service.evaluate({
      actor: buildUser({ id: 'crm_actor', name: '李浩', wecomSenderId: 'wx_actor' }),
      target: {
        objectType: 'Customer',
        objectId: 'cus_001',
        objectTitle: '中国银行江西省分行',
        ownerId: 'crm_owner',
        ownerName: '张琳',
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.relation).toBe('OWNER_MAPPING_MISSING');
  });
});
