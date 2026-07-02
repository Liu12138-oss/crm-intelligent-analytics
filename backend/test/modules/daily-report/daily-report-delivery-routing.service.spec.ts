import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { DailyReportDeliveryPolicyRepository } from '../../../src/modules/daily-report/daily-report-delivery-policy.repository';
import { DailyReportDeliveryRoutingService } from '../../../src/modules/daily-report/daily-report-delivery-routing.service';

describe('DailyReportDeliveryRoutingService', () => {
  function buildService() {
    const state = createDefaultAppStorageState();
    state.wecomSyncedDepartments = [
      {
        id: 'dept_synced_shandong_region',
        wxDepartmentId: 'dept_sd_region',
        departmentName: '山东区',
        parentDepartmentId: 'dept_big_north',
        leaderUserids: ['NiuJin'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'dept_synced_shandong_sales',
        wxDepartmentId: 'dept_sd_sales',
        departmentName: '山东销售',
        parentDepartmentId: 'dept_sd_region',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'dept_synced_shandong_tech',
        wxDepartmentId: 'dept_sd_tech',
        departmentName: '山东技术团队',
        parentDepartmentId: 'dept_sd_region',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'dept_synced_jiangsu_region',
        wxDepartmentId: 'dept_js_region',
        departmentName: '江苏区',
        parentDepartmentId: 'dept_big_north',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'dept_synced_jiangsu_presales',
        wxDepartmentId: 'dept_js_presales',
        departmentName: '江苏售前',
        parentDepartmentId: 'dept_js_region',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
    ];
    state.wecomSyncedUsers = [
      {
        id: 'synced_niujin',
        wxUserid: 'NiuJin',
        userName: '牛劲',
        departmentIds: ['dept_sd_region'],
        directLeaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'synced_sales_a',
        wxUserid: 'sales_a',
        userName: '陈一鸣',
        primaryDepartmentId: 'dept_sd_sales',
        departmentIds: ['dept_sd_sales'],
        directLeaderUserids: ['NiuJin'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'synced_sales_b',
        wxUserid: 'sales_b',
        userName: '王未映射',
        primaryDepartmentId: 'dept_sd_sales',
        departmentIds: ['dept_sd_sales'],
        directLeaderUserids: ['NiuJin'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'synced_presales_leader',
        wxUserid: 'presales_leader',
        userName: '售前组长',
        primaryDepartmentId: 'dept_js_region',
        departmentIds: ['dept_js_region'],
        directLeaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'synced_presales_a',
        wxUserid: 'presales_a',
        userName: '售前成员',
        primaryDepartmentId: 'dept_js_presales',
        departmentIds: ['dept_js_presales'],
        directLeaderUserids: ['presales_leader'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
    ];
    state.crmWxUsers.push({
      id: 'crm_wx_user_niujin',
      wxOrganizationId: 'wx_org_mock',
      userid: 'NiuJin',
      originUserid: 'NiuJin',
      name: '牛劲',
      departmentIds: ['dept_sd_region'],
      createdAt: '2026-04-28T09:00:00.000Z',
      updatedAt: '2026-04-28T09:00:00.000Z',
    });
    state.crmWxUsers.push({
      id: 'crm_wx_user_sales_a',
      wxOrganizationId: 'wx_org_mock',
      userid: 'sales_a',
      originUserid: 'sales_a',
      name: '陈一鸣',
      departmentIds: ['dept_sd_sales'],
      createdAt: '2026-04-28T09:00:00.000Z',
      updatedAt: '2026-04-28T09:00:00.000Z',
    });
    state.crmWxUsers.push({
      id: 'crm_wx_user_presales_leader',
      wxOrganizationId: 'wx_org_mock',
      userid: 'presales_leader',
      originUserid: 'presales_leader',
      name: '售前组长',
      departmentIds: ['dept_js_region'],
      createdAt: '2026-04-28T09:00:00.000Z',
      updatedAt: '2026-04-28T09:00:00.000Z',
    });
    state.crmWxUserMaps.push({
      id: 'crm_wx_user_map_niujin',
      wxOrganizationId: 'wx_org_mock',
      wxUserId: 'crm_wx_user_niujin',
      crmUserId: '2224755',
      createdAt: '2026-04-28T09:00:00.000Z',
      updatedAt: '2026-04-28T09:00:00.000Z',
    });
    state.crmWxUserMaps.push({
      id: 'crm_wx_user_map_sales_a',
      wxOrganizationId: 'wx_org_mock',
      wxUserId: 'crm_wx_user_sales_a',
      crmUserId: '2224701',
      createdAt: '2026-04-28T09:00:00.000Z',
      updatedAt: '2026-04-28T09:00:00.000Z',
    });
    state.crmWxUserMaps.push({
      id: 'crm_wx_user_map_presales_leader',
      wxOrganizationId: 'wx_org_mock',
      wxUserId: 'crm_wx_user_presales_leader',
      crmUserId: '2224799',
      createdAt: '2026-04-28T09:00:00.000Z',
      updatedAt: '2026-04-28T09:00:00.000Z',
    });

    const appStorage = {
      state,
      persist: jest.fn(),
    };
    const repository = new DailyReportDeliveryPolicyRepository(appStorage as never);
    const service = new DailyReportDeliveryRoutingService(
      {
        listDailyReportDepartments: jest.fn(async () => [
          {
            value: 'dept_sd_region',
            label: '山东区',
            parentDepartmentId: 'dept_big_north',
          },
          {
            value: 'dept_sd_sales',
            label: '山东销售',
            parentDepartmentId: 'dept_sd_region',
          },
        ]),
        listDailyReportUsers: jest.fn(async () => [
          {
            id: '2224755',
            name: '牛劲',
            roleIds: ['2619'],
            roleNames: ['区域负责人'],
            organizationIds: ['org_north'],
            departmentIds: ['dept_sd_region'],
            ownerIds: [],
            isAdmin: false,
            exportAllowed: false,
            channels: ['web-console', 'wecom-bot'],
            wecomSenderId: 'NiuJin',
          },
          {
            id: '2224701',
            name: '陈一鸣',
            roleIds: ['2619'],
            roleNames: ['销售'],
            organizationIds: ['org_north'],
            departmentIds: ['dept_sd_sales'],
            ownerIds: ['owner_chen'],
            isAdmin: false,
            exportAllowed: false,
            channels: ['web-console', 'wecom-bot'],
            wecomSenderId: 'sales_a',
            supervisorId: '2224755',
            supervisorName: '牛劲',
          },
        ]),
        getUserById: jest.fn(async (userId: string) => {
          if (userId === '2224755') {
            return {
              id: '2224755',
              name: '牛劲',
              roleIds: ['2619'],
              roleNames: ['超级管理员'],
              organizationIds: ['org_north'],
              departmentIds: ['dept_sd_region'],
              ownerIds: [],
              isAdmin: false,
              exportAllowed: false,
              channels: ['web-console', 'wecom-bot'],
            };
          }

          if (userId === '2224701') {
            return {
              id: '2224701',
              name: '陈一鸣',
              roleIds: ['2619'],
              roleNames: ['销售'],
              organizationIds: ['org_north'],
              departmentIds: ['dept_sd_sales'],
              ownerIds: [],
              isAdmin: false,
              exportAllowed: false,
              channels: ['web-console', 'wecom-bot'],
            };
          }

          if (userId === '2224799') {
            return {
              id: '2224799',
              name: '售前组长',
              roleIds: ['2619'],
              roleNames: ['售前'],
              organizationIds: ['org_north'],
              departmentIds: ['dept_js_region'],
              ownerIds: [],
              isAdmin: false,
              exportAllowed: false,
              channels: ['web-console', 'wecom-bot'],
            };
          }

          return undefined;
        }),
        getWecomSenderIdByUserId: jest.fn(async (userId: string) => {
          if (userId === '2224755') {
            return 'NiuJin';
          }

          return undefined;
        }),
      } as never,
      repository,
      appStorage as never,
    );

    return { service, repository, state };
  }

  it('自动识别销售和售前团队，默认禁用，并排除非销售部门', async () => {
    const { service } = buildService();

    const groups = await service.listResolvedSalesGroups();

    expect(groups).toEqual([
      expect.objectContaining({
        groupDepartmentId: 'dept_sd_sales',
        groupDepartmentName: '山东销售',
        effectivePolicy: 'DISABLED',
        regionDepartmentId: 'dept_sd_region',
        regionDepartmentName: '山东区',
        resolvedRecipient: expect.objectContaining({
          crmUserId: '2224755',
          recipientName: '牛劲',
          wecomUserId: 'NiuJin',
          resolutionStatus: 'READY',
          source: 'AUTO',
        }),
        memberCrmUserIds: ['2224701'],
        members: [
          expect.objectContaining({
            crmUserId: '2224701',
            memberName: '陈一鸣',
            mappingStatus: 'MAPPED',
          }),
          expect.objectContaining({
            memberName: '王未映射',
            wecomUserId: 'sales_b',
            mappingStatus: 'MISSING_CRM_USER',
          }),
        ],
      }),
      expect.objectContaining({
        groupDepartmentId: 'dept_js_presales',
        groupDepartmentName: '江苏售前',
        effectivePolicy: 'DISABLED',
        resolvedRecipient: expect.objectContaining({
          crmUserId: '2224799',
          recipientName: '售前组长',
          wecomUserId: 'presales_leader',
          resolutionStatus: 'READY',
          source: 'AUTO',
        }),
        members: [
          expect.objectContaining({
            memberName: '售前成员',
            wecomUserId: 'presales_a',
          }),
        ],
      }),
    ]);
    expect(
      groups.find((item) => item.groupDepartmentId === 'dept_sd_tech'),
    ).toBeUndefined();
  });

  it('销售容器部门下的小组名称不带销售时，仍应自动识别为日报团队', async () => {
    const { service, state } = buildService();
    state.wecomSyncedDepartments.push(
      {
        id: 'dept_synced_west_region',
        wxDepartmentId: 'dept_west_region',
        departmentName: '西区',
        parentDepartmentId: 'dept_big_north',
        leaderUserids: ['LeiWenliang'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-26T09:00:00.000Z',
      },
      {
        id: 'dept_synced_west_sales',
        wxDepartmentId: 'dept_west_sales',
        departmentName: '西区销售',
        parentDepartmentId: 'dept_west_region',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-26T09:00:00.000Z',
      },
      {
        id: 'dept_synced_west_south_group',
        wxDepartmentId: 'dept_west_south_group',
        departmentName: '西南组',
        parentDepartmentId: 'dept_west_sales',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-26T09:00:00.000Z',
      },
      {
        id: 'dept_synced_west_north_group',
        wxDepartmentId: 'dept_west_north_group',
        departmentName: '西北组',
        parentDepartmentId: 'dept_west_sales',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-26T09:00:00.000Z',
      },
      {
        id: 'dept_synced_west_function',
        wxDepartmentId: 'dept_west_function',
        departmentName: '西区职能',
        parentDepartmentId: 'dept_west_sales',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-26T09:00:00.000Z',
      },
    );
    state.wecomSyncedUsers.push(
      {
        id: 'synced_leiwenliang',
        wxUserid: 'LeiWenliang',
        userName: '雷文亮',
        primaryDepartmentId: 'dept_west_region',
        departmentIds: ['dept_west_region'],
        directLeaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-26T09:00:00.000Z',
      },
      {
        id: 'synced_chennan',
        wxUserid: 'ChenNan',
        userName: '陈丽',
        primaryDepartmentId: 'dept_west_south_group',
        departmentIds: ['dept_west_south_group'],
        directLeaderUserids: ['LeiWenliang'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-26T09:00:00.000Z',
      },
      {
        id: 'synced_chuqiu',
        wxUserid: 'ChuQiu',
        userName: '楚林',
        primaryDepartmentId: 'dept_west_north_group',
        departmentIds: ['dept_west_north_group'],
        directLeaderUserids: ['LeiWenliang'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-26T09:00:00.000Z',
      },
    );
    state.crmWxUsers.push({
      id: 'crm_wx_user_leiwenliang',
      wxOrganizationId: 'wx_org_mock',
      userid: 'LeiWenliang',
      originUserid: 'LeiWenliang',
      name: '雷文亮',
      departmentIds: ['dept_west_region'],
      createdAt: '2026-05-26T09:00:00.000Z',
      updatedAt: '2026-05-26T09:00:00.000Z',
    });
    state.crmWxUserMaps.push({
      id: 'crm_wx_user_map_leiwenliang',
      wxOrganizationId: 'wx_org_mock',
      wxUserId: 'crm_wx_user_leiwenliang',
      crmUserId: '2224888',
      createdAt: '2026-05-26T09:00:00.000Z',
      updatedAt: '2026-05-26T09:00:00.000Z',
    });

    const groups = await service.listResolvedSalesGroups();

    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupDepartmentId: 'dept_west_south_group',
          groupDepartmentName: '西区销售-西南组',
          regionDepartmentId: 'dept_west_sales',
          regionDepartmentName: '西区销售',
          resolvedRecipient: expect.objectContaining({
            crmUserId: '2224888',
            recipientName: '雷文亮',
            wecomUserId: 'LeiWenliang',
            resolutionStatus: 'READY',
            source: 'AUTO',
          }),
          members: [
            expect.objectContaining({
              memberName: '陈丽',
              wecomUserId: 'ChenNan',
            }),
          ],
        }),
        expect.objectContaining({
          groupDepartmentId: 'dept_west_north_group',
          groupDepartmentName: '西区销售-西北组',
          resolvedRecipient: expect.objectContaining({
            recipientName: '雷文亮',
          }),
          members: [
            expect.objectContaining({
              memberName: '楚林',
              wecomUserId: 'ChuQiu',
            }),
          ],
        }),
      ]),
    );
    expect(
      groups.find((item) => item.groupDepartmentId === 'dept_west_sales'),
    ).toBeUndefined();
    expect(
      groups.find((item) => item.groupDepartmentId === 'dept_west_function'),
    ).toBeUndefined();
  });

  it('手工小组配置应进入发送解析，并允许覆盖收件人与成员名单', async () => {
    const { service, repository } = buildService();
    repository.saveSalesGroupConfig({
      groupId: 'manual_henan_sales',
      groupName: '河南销售',
      source: 'MANUAL',
      status: 'ENABLED',
      regionDepartmentName: '河南区',
      recipientCrmUserId: '2224755',
      memberCrmUserIds: ['2224701'],
      memberOverrideEnabled: true,
      updatedBy: 'user_admin',
      updatedAt: '2026-05-14T10:00:00.000Z',
      reason: '生产环境补齐自动识别遗漏的小组',
    });

    const groups = await service.listResolvedSalesGroups();

    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupDepartmentId: 'manual_henan_sales',
          groupDepartmentName: '河南销售',
          regionDepartmentName: '河南区',
          effectivePolicy: 'ENABLED',
          resolvedRecipient: expect.objectContaining({
            crmUserId: '2224755',
            recipientName: '牛劲',
            source: 'MANUAL_GROUP_CONFIG',
          }),
          memberCrmUserIds: ['2224701'],
          members: [
            expect.objectContaining({
              crmUserId: '2224701',
              memberName: '陈一鸣',
            }),
          ],
        }),
      ]),
    );
  });

  it('手工小组配置应支持多个组长共同接收汇总', async () => {
    const { service, repository } = buildService();
    repository.saveSalesGroupConfig({
      groupId: 'manual_multi_leader_sales',
      groupName: '多组长销售',
      source: 'MANUAL',
      status: 'ENABLED',
      recipientCrmUserIds: ['2224755', '2224801'],
      memberCrmUserIds: ['2224701'],
      memberOverrideEnabled: true,
      updatedBy: 'user_admin',
      updatedAt: '2026-05-28T10:00:00.000Z',
      reason: '多个组长共同接收日报汇总',
    });

    const groups = await service.listResolvedSalesGroups();
    const group = groups.find(
      (item) => item.groupDepartmentId === 'manual_multi_leader_sales',
    );

    expect(group?.resolvedRecipients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          crmUserId: '2224755',
          source: 'MANUAL_GROUP_CONFIG',
        }),
        expect.objectContaining({
          crmUserId: '2224801',
          source: 'MANUAL_GROUP_CONFIG',
        }),
      ]),
    );
    expect(group?.resolvedRecipient.crmUserId).toBe('2224755');
  });

  it('CRM 只读连接异常时，应使用企业微信同步数据降级展示日报团队', async () => {
    const { service } = buildService();
    const failingCrmReadonlyService = service[
      'crmReadonlyService'
    ] as unknown as {
      getUserById: jest.Mock;
      getWecomSenderIdByUserId: jest.Mock;
    };
    failingCrmReadonlyService.getUserById.mockRejectedValue(
      new Error('Pool is closed.'),
    );
    failingCrmReadonlyService.getWecomSenderIdByUserId.mockRejectedValue(
      new Error('Pool is closed.'),
    );

    await expect(service.listResolvedSalesGroups()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupDepartmentId: 'dept_sd_sales',
          resolvedRecipient: expect.objectContaining({
            crmUserId: '2224755',
            recipientName: '牛劲',
            wecomUserId: 'NiuJin',
            resolutionStatus: 'READY',
          }),
          members: [
            expect.objectContaining({
              crmUserId: '2224701',
              memberName: '陈一鸣',
              wecomUserId: 'sales_a',
              mappingStatus: 'MAPPED',
            }),
            expect.objectContaining({
              memberName: '王未映射',
              wecomUserId: 'sales_b',
              mappingStatus: 'MISSING_CRM_USER',
            }),
          ],
        }),
      ]),
    );
    expect(failingCrmReadonlyService.getUserById).not.toHaveBeenCalled();
    expect(
      failingCrmReadonlyService.getWecomSenderIdByUserId,
    ).not.toHaveBeenCalled();
  });

  it('区域负责人缺少 CRM 映射时，仍应使用企业微信同步姓名展示组长', async () => {
    const { service, state } = buildService();
    state.wecomSyncedDepartments.push(
      {
        id: 'dept_synced_henan_region',
        wxDepartmentId: 'dept_henan_region',
        departmentName: '河南区',
        parentDepartmentId: 'dept_big_north',
        leaderUserids: ['leader_unmapped'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
      {
        id: 'dept_synced_henan_sales',
        wxDepartmentId: 'dept_henan_sales',
        departmentName: '河南销售',
        parentDepartmentId: 'dept_henan_region',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-28T09:00:00.000Z',
      },
    );
    state.wecomSyncedUsers.push({
      id: 'synced_leader_unmapped',
      wxUserid: 'leader_unmapped',
      userName: '未映射组长',
      primaryDepartmentId: 'dept_henan_region',
      departmentIds: ['dept_henan_region'],
      directLeaderUserids: [],
      rawPayload: {},
      syncStatus: 'ACTIVE',
      lastSyncedAt: '2026-04-28T09:00:00.000Z',
    });

    const groups = await service.listResolvedSalesGroups();

    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupDepartmentId: 'dept_henan_sales',
          resolvedRecipient: expect.objectContaining({
            recipientName: '未映射组长',
            wecomUserId: 'leader_unmapped',
            resolutionStatus: 'MISSING_WECOM_MAPPING',
          }),
        }),
      ]),
    );
  });

  it('缺少企业微信目录快照时，页面启用的 CRM 销售部门仍应直接进入日报发送候选', async () => {
    const { service, repository, state } = buildService();
    state.wecomSyncedDepartments = [];
    state.wecomSyncedUsers = [];
    repository.saveDepartmentPolicy({
      departmentId: 'dept_sd_region',
      departmentName: '山东区',
      status: 'ENABLED',
      departmentType: 'REGION',
      applyToChildren: true,
      updatedBy: 'user_admin',
      updatedAt: '2026-05-15T10:00:00.000Z',
      reason: '区域日报收件规则启用',
    });
    repository.saveRecipientOverride({
      departmentId: 'dept_sd_region',
      departmentName: '山东区',
      scopeType: 'REGION',
      crmUserId: '2224755',
      recipientName: '牛劲',
      updatedBy: 'user_admin',
      updatedAt: '2026-05-15T10:00:00.000Z',
      reason: '区域负责人承接日报汇总',
    });
    repository.saveDepartmentPolicy({
      departmentId: 'dept_sd_sales',
      departmentName: '山东销售',
      status: 'ENABLED',
      departmentType: 'SALES',
      applyToChildren: false,
      updatedBy: 'user_admin',
      updatedAt: '2026-05-15T10:00:00.000Z',
      reason: '页面启用山东销售日报',
    });

    const groups = await service.listResolvedSalesGroups();

    expect(groups).toEqual([
      expect.objectContaining({
        groupDepartmentId: 'dept_sd_sales',
        groupDepartmentName: '山东销售',
        effectivePolicy: 'ENABLED',
        regionDepartmentId: 'dept_sd_region',
        regionDepartmentName: '山东区',
        resolvedRecipient: expect.objectContaining({
          crmUserId: '2224755',
          recipientName: '牛劲',
          wecomUserId: 'NiuJin',
          resolutionStatus: 'READY',
          source: 'REGION_OVERRIDE',
        }),
        memberCrmUserIds: ['2224701'],
        members: [
          expect.objectContaining({
            crmUserId: '2224701',
            memberName: '陈一鸣',
            wecomUserId: 'sales_a',
            mappingStatus: 'MAPPED',
          }),
        ],
      }),
    ]);
  });
});
