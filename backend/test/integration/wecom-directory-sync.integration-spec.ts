import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { WecomAuthService } from '../../src/modules/wecom/wecom-auth.service';
import { WecomDirectorySyncService } from '../../src/modules/wecom/wecom-directory-sync.service';
import { WecomOfficialDirectoryClient } from '../../src/modules/wecom/wecom-official-directory.client';
import { createTestApp } from '../test-app';

describe('wecom directory sync integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let wecomAuthService: WecomAuthService;
  let wecomOfficialDirectoryClient: WecomOfficialDirectoryClient;
  let wecomDirectorySyncService: WecomDirectorySyncService;
  const originalWecomWebLoginAppId = process.env.WECOM_WEB_LOGIN_APP_ID;
  const originalWecomDirectoryAgentId = process.env.WECOM_DIRECTORY_AGENT_ID;
  const originalWecomDirectorySecret = process.env.WECOM_DIRECTORY_SECRET;

  beforeAll(async () => {
    process.env.WECOM_WEB_LOGIN_APP_ID =
      process.env.WECOM_WEB_LOGIN_APP_ID ?? 'mock-corpid';
    process.env.WECOM_DIRECTORY_AGENT_ID =
      process.env.WECOM_DIRECTORY_AGENT_ID ?? '1000043';
    process.env.WECOM_DIRECTORY_SECRET =
      process.env.WECOM_DIRECTORY_SECRET ?? 'mock-directory-secret';
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    wecomAuthService = app.get(WecomAuthService);
    wecomOfficialDirectoryClient = app.get(WecomOfficialDirectoryClient);
    wecomDirectorySyncService = app.get(WecomDirectorySyncService);
  });

  afterAll(async () => {
    await app.close();
    if (originalWecomWebLoginAppId === undefined) {
      delete process.env.WECOM_WEB_LOGIN_APP_ID;
    } else {
      process.env.WECOM_WEB_LOGIN_APP_ID = originalWecomWebLoginAppId;
    }
    if (originalWecomDirectoryAgentId === undefined) {
      delete process.env.WECOM_DIRECTORY_AGENT_ID;
    } else {
      process.env.WECOM_DIRECTORY_AGENT_ID = originalWecomDirectoryAgentId;
    }
    if (originalWecomDirectorySecret === undefined) {
      delete process.env.WECOM_DIRECTORY_SECRET;
    } else {
      process.env.WECOM_DIRECTORY_SECRET = originalWecomDirectorySecret;
    }
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('应提供企业微信目录同步状态查询入口', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/internal/wecom-directory-sync/status')
      .expect(200);

    expect(response.body).toHaveProperty('checkpoints');
    expect(response.body).toHaveProperty('runs');
  });

  it('手动触发用户同步时应写入 CRM 原生 wx_users 与 wx_user_maps', async () => {
    jest
      .spyOn(wecomOfficialDirectoryClient, 'getAccessToken')
      .mockResolvedValue('mock-token');
    jest.spyOn(wecomOfficialDirectoryClient, 'listDepartments').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      department: [
        { id: 100, name: '联软科技集团', parentid: 1, order: 1 },
        { id: 101, name: '产品线', parentid: 100, order: 2 },
      ],
    });
    jest
      .spyOn(wecomOfficialDirectoryClient, 'listDepartmentSimpleIds')
      .mockResolvedValue({
        errcode: 0,
        errmsg: 'ok',
        department_id: [
          { id: 100, parentid: 1, order: 1 },
          { id: 101, parentid: 100, order: 2 },
        ],
      });
    jest.spyOn(wecomOfficialDirectoryClient, 'listUsersByDepartment')
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: 'ok',
        userlist: [],
      })
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: 'ok',
        userlist: [
          {
            userid: 'sync_user_sales_director',
            name: '销售总监同步账号',
            department: [101],
            mobile: 'wx_sales_director',
          },
          {
            userid: 'sync_user_region_manager',
            name: '区域经理同步账号',
            department: [101],
            email: 'wx_region_manager',
          },
        ],
      });
    jest.spyOn(wecomOfficialDirectoryClient, 'getUserDetail').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      userid: 'unused',
      name: 'unused',
      department: [],
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/internal/wecom-directory-sync/run')
      .send({
        resourceType: 'user',
      });

    expect(response.status).toBe(202);
    expect(
      appStorageService.state.crmWxUsers.some(
        (item) => item.userid === 'sync_user_sales_director',
      ),
    ).toBe(true);
    expect(
      appStorageService.state.crmWxUsers.some(
        (item) => item.userid === 'sync_user_region_manager',
      ),
    ).toBe(true);
    expect(
      appStorageService.state.crmWxUserMaps.some(
        (item) => item.crmUserId === 'user_sales_director',
      ),
    ).toBe(true);
    expect(
      appStorageService.state.crmWxUserMaps.some(
        (item) => item.crmUserId === 'user_region_manager',
      ),
    ).toBe(true);
  });

  it('同步组织事实时应标准化部门负责人、成员部门和直属上级链', async () => {
    jest
      .spyOn(wecomOfficialDirectoryClient, 'getAccessToken')
      .mockResolvedValue('mock-token');
    jest.spyOn(wecomOfficialDirectoryClient, 'listDepartments').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      department: [
        {
          id: 100,
          name: '联软科技集团',
          parentid: 1,
          order: 1,
          department_leader: ['wx_wangdong'],
        },
        {
          id: 101,
          name: '大北区',
          parentid: 100,
          order: 2,
          department_leader: ['wx_yangang', 'wx_guanjundong'],
        },
      ],
    });
    jest
      .spyOn(wecomOfficialDirectoryClient, 'listDepartmentSimpleIds')
      .mockResolvedValue({
        errcode: 0,
        errmsg: 'ok',
        department_id: [
          { id: 100, parentid: 1, order: 1 },
          { id: 101, parentid: 100, order: 2 },
        ],
      });
    jest.spyOn(wecomOfficialDirectoryClient, 'listUsersByDepartment')
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: 'ok',
        userlist: [],
      })
      .mockResolvedValueOnce({
        errcode: 0,
        errmsg: 'ok',
        userlist: [
          {
            userid: 'wx_yangang',
            name: '严刚',
            department: [101],
            main_department: 101,
            direct_leader: ['wx_wangdong'],
          },
        ],
      });
    jest.spyOn(wecomOfficialDirectoryClient, 'getUserDetail').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      userid: 'wx_yangang',
      name: '严刚',
      department: [101],
      main_department: 101,
      direct_leader: ['wx_wangdong'],
    });

    await wecomDirectorySyncService.runSync('user');

    const department = appStorageService.state.wecomSyncedDepartments.find(
      (item) => item.wxDepartmentId === '101',
    );
    const user = appStorageService.state.wecomSyncedUsers.find(
      (item) => item.wxUserid === 'wx_yangang',
    );

    expect(department?.leaderUserids).toEqual(['wx_yangang', 'wx_guanjundong']);
    expect(user?.departmentIds).toEqual(['101']);
    expect(user?.directLeaderUserids).toEqual(['wx_wangdong']);
    expect(user?.rawPayload).toMatchObject({
      direct_leader: ['wx_wangdong'],
    });
  });

  it('CRM 原生 wx_users 和 wx_user_maps 写入后应可直接识别企业微信发送者', async () => {
    appStorageService.state.crmWxUsers.unshift({
      id: 'crm_wx_user_test_001',
      wxOrganizationId: 'wx_org_mock',
      userid: 'wx_bound_user_001',
      originUserid: 'wx_bound_user_001',
      name: '销售总监原生映射',
      mobile: 'wx_sales_director',
      departmentIds: ['dept_sales'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    appStorageService.state.crmWxUserMaps.unshift({
      id: 'crm_wx_user_map_test_001',
      wxOrganizationId: 'wx_org_mock',
      wxUserId: 'crm_wx_user_test_001',
      crmUserId: 'user_sales_director',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const user = await wecomAuthService.resolveSender('wx_bound_user_001');

    expect(user.id).toBe('user_sales_director');
    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'WECOM_IDENTITY_RESOLVED',
      ),
    ).toBe(true);
  });

  it('缺少手机号和邮箱时应写入 wx_users 但不生成 wx_user_maps', async () => {
    jest
      .spyOn(wecomOfficialDirectoryClient, 'getAccessToken')
      .mockResolvedValue('mock-token');
    jest.spyOn(wecomOfficialDirectoryClient, 'listDepartments').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      department: [{ id: 100, name: '联软科技集团', parentid: 1, order: 1 }],
    });
    jest
      .spyOn(wecomOfficialDirectoryClient, 'listDepartmentSimpleIds')
      .mockResolvedValue({
        errcode: 0,
        errmsg: 'ok',
        department_id: [{ id: 100, parentid: 1, order: 1 }],
      });
    jest.spyOn(wecomOfficialDirectoryClient, 'listUsersByDepartment').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      userlist: [
        {
          userid: 'sync_user_missing_contact',
          name: '缺少手机号邮箱',
          department: [100],
        },
      ],
    });
    jest.spyOn(wecomOfficialDirectoryClient, 'getUserDetail').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      userid: 'sync_user_missing_contact',
      name: '缺少手机号邮箱',
      department: [100],
    });

    const run = await wecomDirectorySyncService.runSync('user');
    const syncedUser = appStorageService.state.crmWxUsers.find(
      (item) => item.userid === 'sync_user_missing_contact',
    );

    expect(run.missingContactCount).toBe(1);
    expect(syncedUser).toBeDefined();
    expect(
      appStorageService.state.crmWxUserMaps.some((item) => item.wxUserId === syncedUser?.id),
    ).toBe(false);
  });

  it('指定 userid 的状态查询应返回未绑定原因', async () => {
    appStorageService.state.crmWxUsers.unshift({
      id: 'crm_wx_user_test_002',
      wxOrganizationId: 'wx_org_mock',
      userid: 'wx_unmatched_user_001',
      originUserid: 'wx_unmatched_user_001',
      name: '未命中 CRM 的企微用户',
      mobile: 'no_crm_match_phone',
      departmentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/internal/wecom-directory-sync/status')
      .query({ userid: 'wx_unmatched_user_001' })
      .expect(200);

    expect(response.body.userDiagnostic.userid).toBe('wx_unmatched_user_001');
    expect(response.body.userDiagnostic.status).toBe('UNBOUND');
  });

  it('无增量数据时应标记为成功但无增量', async () => {
    jest
      .spyOn(wecomOfficialDirectoryClient, 'getAccessToken')
      .mockResolvedValue('mock-token');
    jest.spyOn(wecomOfficialDirectoryClient, 'listDepartments').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      department: [{ id: 100, name: '联软科技集团', parentid: 1, order: 1 }],
    });
    jest
      .spyOn(wecomOfficialDirectoryClient, 'listDepartmentSimpleIds')
      .mockResolvedValue({
        errcode: 0,
        errmsg: 'ok',
        department_id: [{ id: 100, parentid: 1, order: 1 }],
      });
    jest.spyOn(wecomOfficialDirectoryClient, 'listUsersByDepartment').mockResolvedValue({
      errcode: 0,
      errmsg: 'ok',
      userlist: [],
    });

    const run = await wecomDirectorySyncService.runSync('user');

    expect(run.status).toBe('SUCCEEDED_WITHOUT_CHANGES');
  });
});
