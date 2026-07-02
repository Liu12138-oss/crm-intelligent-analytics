import request from 'supertest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { ContractReviewService } from '../../src/modules/contract-review/contract-review.service';
import { WecomAuthService } from '../../src/modules/wecom/wecom-auth.service';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';
import { QueryExecutionTimeoutError } from '../../src/modules/analysis/analysis.errors';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('access governance integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let wecomAuthService: WecomAuthService;
  let contractReviewService: ContractReviewService;
  let crmReadonlyService: CrmReadonlyService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    wecomAuthService = app.get(WecomAuthService);
    contractReviewService = app.get(ContractReviewService);
    crmReadonlyService = app.get(CrmReadonlyService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    delete (appStorageService.state as any).rolePermissions;
    delete (appStorageService.state as any).wecomPilotPolicy;
    appStorageService.state.contractReviewTasks = [];
    appStorageService.state.contractReviewIssues = [];
    appStorageService.state.contractReviewArtifacts = [];
    appStorageService.state.auditEvents = [];
    appStorageService.state.dailyReportDepartmentPolicies = [];
    appStorageService.state.dailyReportRecipientOverrides = [];
    appStorageService.state.wecomSyncedDepartments = [];
    appStorageService.state.wecomSyncedUsers = [];
    jest.restoreAllMocks();
  });

  it('管理员维护角色权限后，能力快照应立即返回菜单、动作和合同审核权限摘要', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const managerCookies = await loginAs(app, 'user_region_manager');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_region_manager')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '区域经理',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench', 'contract-review'],
        actionKeys: ['analysis.use', 'analysis.follow_up', 'contract.review.upload'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: true,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '开放区域经理智能分析与合同上传',
      })
      .expect(200);

    const capabilityResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', managerCookies)
      .expect(200);

    expect(capabilityResponse.body.visibleMenus).toContain('analysis-workbench');
    expect(capabilityResponse.body.visibleMenus).toContain('contract-review');
    expect(capabilityResponse.body.actionKeys).toContain('analysis.use');
    expect(capabilityResponse.body.actionKeys).toContain('contract.review.upload');
    expect(capabilityResponse.body.contractPermissions).toEqual({
      uploadAllowed: true,
      crossViewAllowed: false,
      crossDownloadAllowed: false,
    });
  });

  it('角色权限更新后，能力快照缓存必须立即失效并返回新菜单结果', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const managerCookies = await loginAs(app, 'user_region_manager');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_region_manager')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '区域经理',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '先缓存只有分析菜单的能力快照',
      })
      .expect(200);

    const firstCapabilityResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', managerCookies)
      .expect(200);

    expect(firstCapabilityResponse.body.visibleMenus).toContain('analysis-workbench');
    expect(firstCapabilityResponse.body.visibleMenus).not.toContain('contract-review');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_region_manager')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '区域经理',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench', 'contract-review'],
        actionKeys: ['analysis.use', 'contract.review.upload'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: true,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '验证角色权限更新后能力快照立即失效',
      })
      .expect(200);

    const secondCapabilityResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', managerCookies)
      .expect(200);

    expect(secondCapabilityResponse.body.visibleMenus).toContain('contract-review');
    expect(secondCapabilityResponse.body.actionKeys).toContain('contract.review.upload');
  });

  it('历史管理员权限快照应兼容回填连接策略菜单，非管理员不应被自动扩大', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const managerCookies = await loginAs(app, 'user_region_manager');

    appStorageService.state.rolePermissions = [
      {
        roleId: 'role_admin',
        roleNameSnapshot: '系统管理员',
        status: 'ACTIVE',
        visibleMenus: ['permission-center'],
        actionKeys: ['governance.policy.manage'],
        webConsoleEnabled: true,
        wecomBotEligible: false,
        exportAllowed: false,
        templateManageAllowed: true,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        updatedBy: 'system',
        updatedAt: '2026-05-15T00:00:00.000Z',
        changeReason: '历史管理员快照',
      },
      {
        roleId: 'role_region_manager',
        roleNameSnapshot: '区域经理',
        status: 'ACTIVE',
        visibleMenus: ['permission-center'],
        actionKeys: ['governance.policy.manage'],
        webConsoleEnabled: true,
        wecomBotEligible: false,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        updatedBy: 'system',
        updatedAt: '2026-05-15T00:00:00.000Z',
        changeReason: '人工委派治理动作但未开连接策略菜单',
      },
    ];

    const adminCapabilityResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', adminCookies)
      .expect(200);
    expect(adminCapabilityResponse.body.visibleMenus).toContain('connection-policy');

    const managerCapabilityResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', managerCookies)
      .expect(200);
    expect(managerCapabilityResponse.body.visibleMenus).not.toContain('connection-policy');
  });

  it('角色权限列表应包含 CRM 全量角色，而不只是已配置的默认角色', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const response = await request(app.getHttpServer())
      .get('/api/v1/governance/role-permissions')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(response.body.items.some((item: { roleId?: string }) => item.roleId === 'role_product_manager')).toBe(true);
    expect(response.body.items.some((item: { roleId?: string }) => item.roleId === 'role_product_director')).toBe(true);
  });

  it('角色权限列表应返回简化菜单权限树并标记历史半配置角色', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    appStorageService.state.rolePermissions = [
      {
        roleId: 'role_product_manager',
        roleNameSnapshot: '产品经理',
        status: 'ACTIVE',
        visibleMenus: [],
        actionKeys: [],
        webConsoleEnabled: true,
        wecomBotEligible: false,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        updatedBy: 'system',
        updatedAt: '2026-05-22T00:00:00.000Z',
        changeReason: '历史半配置角色',
      },
    ];

    const response = await request(app.getHttpServer())
      .get('/api/v1/governance/role-permissions')
      .set('Cookie', adminCookies)
      .query({ keyword: '产品经理' })
      .expect(200);

    expect(response.body.items[0].simplifiedPermissionProfile).toMatchObject({
      menus: {
        analysis: false,
        managementReport: false,
        contractReview: false,
      },
      legacyWarnings: ['WEB_CONSOLE_WITHOUT_MENU'],
    });
  });

  it('保存简化菜单权限树时应生成旧运行时字段供现有执行链路消费', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const response = await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_product_manager')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '产品经理',
        status: 'ACTIVE',
        simplifiedPermissionProfile: {
          menus: {
            analysis: true,
            managementReport: true,
            contractReview: true,
            wecomBot: true,
            permissionCenter: false,
            templateGovernance: false,
            connectionPolicy: false,
            aiModelGovernance: false,
            auditCenter: false,
          },
          risks: {
            analysisExport: true,
            managementReportExport: false,
            contractCrossView: true,
            contractCrossDownload: false,
          },
        },
        changeReason: '按新菜单包保存角色权限',
      })
      .expect(200);

    expect(response.body.visibleMenus).toEqual([
      'analysis-workbench',
      'management-report',
      'contract-review',
    ]);
    expect(response.body.actionKeys).toEqual([
      'analysis.use',
      'analysis.follow_up',
      'template.view',
      'analysis.export',
      'management.report.view',
      'contract.review.upload',
      'contract.review.cross_view',
      'wecom.analysis.use',
      'wecom.customer.create',
      'wecom.opportunity.create',
      'wecom.followup.writeback',
      'wecom.daily_report.preview',
    ]);
    expect(response.body.webConsoleEnabled).toBe(true);
    expect(response.body.wecomBotEligible).toBe(true);
    expect(response.body.exportAllowed).toBe(true);
    expect(response.body.contractReviewUploadAllowed).toBe(true);
    expect(response.body.contractReviewCrossViewAllowed).toBe(true);
    expect(response.body.contractReviewCrossDownloadAllowed).toBe(false);
  });

  it('角色权限列表应支持按关键词搜索与分页返回', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const response = await request(app.getHttpServer())
      .get('/api/v1/governance/role-permissions')
      .set('Cookie', adminCookies)
      .query({
        keyword: '产品',
        page: '1',
        pageSize: '1',
      })
      .expect(200);

    expect(response.body.page).toBe(1);
    expect(response.body.pageSize).toBe(1);
    expect(response.body.total).toBeGreaterThanOrEqual(2);
    expect(response.body.items).toHaveLength(1);
    expect(String(response.body.items[0].roleNameSnapshot)).toContain('产品');
  });

  it('角色权限列表应支持按状态过滤', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_product_manager')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '产品经理',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use'],
        webConsoleEnabled: true,
        wecomBotEligible: false,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '用于验证启用状态过滤',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/governance/role-permissions')
      .set('Cookie', adminCookies)
      .query({
        status: 'ACTIVE',
      })
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);
    expect(
      response.body.items.every((item: { status?: string }) => item.status === 'ACTIVE'),
    ).toBe(true);
  });

  it('权限中心应返回用户、角色和部门可选项，供前端选择器使用', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const response = await request(app.getHttpServer())
      .get('/api/v1/governance/access-options')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(response.body.users.length).toBeGreaterThan(0);
    expect(response.body.roles.length).toBeGreaterThan(0);
    expect(response.body.departments.length).toBeGreaterThan(0);
    expect(response.body.users[0]).toMatchObject({
      value: expect.any(String),
      label: expect.any(String),
    });
    expect(response.body.roles[0]).toMatchObject({
      value: expect.any(String),
      label: expect.any(String),
    });
    expect(response.body.departments[0]).toMatchObject({
      value: expect.any(String),
      label: expect.any(String),
    });
    expect(response.body.departments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'dept_region_east',
          label: '华东销售部',
          parentDepartmentId: 'dept_sales',
        }),
      ]),
    );
  });

  it('权限中心应返回企业微信组织对象、CRM 映射状态和不可选原因', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const originalCrmWxUsers = appStorageService.state.crmWxUsers;
    const originalCrmWxUserMaps = appStorageService.state.crmWxUserMaps;

    appStorageService.state.wecomSyncedDepartments = [
      {
        id: 'sync_dept_sales',
        wxDepartmentId: 'dept_sales',
        departmentName: '销售部',
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-20T10:00:00.000Z',
      },
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
        id: 'sync_dept_external',
        wxDepartmentId: 'wx_dept_external',
        departmentName: '外部企微部门',
        parentDepartmentId: 'dept_sales',
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
        deletedAt: '2026-05-21T10:03:00.000Z',
      },
    ];
    appStorageService.state.wecomSyncedUsers = [
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
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-20T10:05:00.000Z',
      },
      {
        id: 'sync_user_conflicted',
        wxUserid: 'wx_conflicted_member',
        userName: '映射冲突成员',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-05-20T10:06:00.000Z',
      },
      {
        id: 'sync_user_deleted',
        wxUserid: 'wx_deleted_member',
        userName: '已删除成员',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        rawPayload: {},
        syncStatus: 'DELETED',
        lastSyncedAt: '2026-05-20T10:07:00.000Z',
        deletedAt: '2026-05-21T10:07:00.000Z',
      },
    ];
    appStorageService.state.crmWxUsers = [
      ...originalCrmWxUsers,
      {
        id: 'crm_wx_user_conflicted',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_conflicted_member',
        name: '映射冲突成员',
        departmentIds: ['dept_sales'],
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    ];
    appStorageService.state.crmWxUserMaps = [
      ...originalCrmWxUserMaps,
      {
        id: 'crm_wx_user_map_conflict_one',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_conflicted',
        crmUserId: 'user_region_manager',
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
      {
        id: 'crm_wx_user_map_conflict_two',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_conflicted',
        crmUserId: 'user_sales_director',
        createdAt: '2026-05-20T10:00:00.000Z',
        updatedAt: '2026-05-20T10:00:00.000Z',
      },
    ];

    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/governance/wecom-organization-subjects')
        .set('Cookie', adminCookies)
        .expect(200);

      expect(response.body.lastSyncedAt).toBe('2026-05-20T10:07:00.000Z');
      expect(response.body.departments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            departmentId: 'dept_region_east',
            name: '华东销售部',
            parentDepartmentId: 'dept_sales',
            crmDepartmentId: 'dept_region_east',
            crmDepartmentName: '华东销售部',
            mappingStatus: 'MAPPED',
          }),
          expect.objectContaining({
            departmentId: 'wx_dept_external',
            name: '外部企微部门',
            mappingStatus: 'UNMAPPED',
            disabledReason: '未绑定 CRM 部门，不能保存为授权部门。',
          }),
          expect.objectContaining({
            departmentId: 'wx_dept_deleted',
            name: '已删除部门',
            syncStatus: 'DELETED',
            mappingStatus: 'DELETED',
            disabledReason: '该部门已从企业微信通讯录删除。',
          }),
        ]),
      );
      expect(response.body.users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            wecomUserId: 'wx_region_manager',
            name: '区域经理',
            departmentIds: ['dept_region_east'],
            crmUserId: 'user_region_manager',
            crmUserName: '区域经理',
            mappingStatus: 'MAPPED',
          }),
          expect.objectContaining({
            wecomUserId: 'wx_unmapped_member',
            name: '未映射成员',
            mappingStatus: 'UNMAPPED',
            disabledReason: '未绑定 CRM 用户，不能保存为授权人员。',
          }),
          expect.objectContaining({
            wecomUserId: 'wx_conflicted_member',
            name: '映射冲突成员',
            mappingStatus: 'CONFLICTED',
            disabledReason: '企业微信成员存在多个 CRM 映射，请先修复身份映射。',
          }),
          expect.objectContaining({
            wecomUserId: 'wx_deleted_member',
            name: '已删除成员',
            syncStatus: 'DELETED',
            mappingStatus: 'DELETED',
            disabledReason: '该成员已从企业微信通讯录删除。',
          }),
        ]),
      );
    } finally {
      appStorageService.state.crmWxUsers = originalCrmWxUsers;
      appStorageService.state.crmWxUserMaps = originalCrmWxUserMaps;
    }
  });

  it('无权限用户不能读取企业微信组织对象清单', async () => {
    const managerCookies = await loginAs(app, 'user_region_manager');

    await request(app.getHttpServer())
      .get('/api/v1/governance/wecom-organization-subjects')
      .set('Cookie', managerCookies)
      .expect(403);
  });

  it('权限中心应支持数据范围白名单保存、列表和预览', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .put('/api/v1/governance/data-scope-grants/grant_region_manager')
      .set('Cookie', adminCookies)
      .send({
        subjectType: 'ROLE',
        subjectId: 'role_region_manager',
        departmentIds: ['dept_product'],
        includeSubDepartments: true,
        reason: '允许区域经理临时查看产品部协作数据',
        status: 'ACTIVE',
      })
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/governance/data-scope-grants')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'grant_region_manager',
          subjectType: 'ROLE',
          subjectId: 'role_region_manager',
          departmentIds: ['dept_product'],
          includeSubDepartments: true,
        }),
      ]),
    );

    const previewResponse = await request(app.getHttpServer())
      .post('/api/v1/governance/data-scope-preview')
      .set('Cookie', adminCookies)
      .send({
        crmUserId: 'user_region_manager',
      })
      .expect(200);

    expect(previewResponse.body.departmentIds).toContain('dept_product');
    expect(previewResponse.body.grantSummaries.join('')).toContain('role_region_manager');
  });

  it('管理员应可配置日报部门启停并预览发送结果', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    appStorageService.state.wecomSyncedDepartments = [
      {
        id: 'dept_synced_region_east',
        wxDepartmentId: 'dept_region_east',
        departmentName: '华东区',
        parentDepartmentId: 'dept_sales_management',
        leaderUserids: ['wx_region_manager'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'dept_synced_sales_east',
        wxDepartmentId: 'dept_sales',
        departmentName: '华东销售',
        parentDepartmentId: 'dept_region_east',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'dept_synced_tech_east',
        wxDepartmentId: 'dept_sd_tech',
        departmentName: '华东技术团队',
        parentDepartmentId: 'dept_region_east',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
    ];
    appStorageService.state.wecomSyncedUsers = [
      {
        id: 'synced_region_manager',
        wxUserid: 'wx_region_manager',
        userName: '区域经理',
        primaryDepartmentId: 'dept_region_east',
        departmentIds: ['dept_region_east'],
        directLeaderUserids: ['wx_sales_vp'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'synced_sales_director',
        wxUserid: 'wx_sales_director',
        userName: '销售总监',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        directLeaderUserids: ['wx_region_manager'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
    ];

    await request(app.getHttpServer())
      .put('/api/v1/governance/daily-report-delivery/departments/dept_sales')
      .set('Cookie', adminCookies)
      .send({
        status: 'ENABLED',
        departmentType: 'SALES',
        applyToChildren: false,
        reason: '华东销售参与日报汇总',
      })
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/v1/governance/daily-report-delivery/departments/dept_region_east')
      .set('Cookie', adminCookies)
      .send({
        status: 'ENABLED',
        departmentType: 'REGION',
        applyToChildren: true,
        overrideRecipientCrmUserId: 'user_region_manager',
        reason: '区域负责人承接销售组汇总',
      })
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/governance/daily-report-delivery/departments')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          departmentId: '__GLOBAL_ALL__',
          departmentName: '全公司',
        }),
        expect.objectContaining({
          departmentId: 'dept_sales',
          status: 'ENABLED',
          departmentType: 'SALES',
        }),
        expect.objectContaining({
          departmentId: 'dept_region_east',
          status: 'ENABLED',
          departmentType: 'REGION',
        }),
      ]),
    );
    expect(listResponse.body.strategies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          departmentId: 'dept_sales',
          status: 'ENABLED',
          departmentType: 'SALES',
        }),
        expect.objectContaining({
          departmentId: 'dept_region_east',
          status: 'ENABLED',
          departmentType: 'REGION',
          resolvedRecipientCrmUserId: 'user_region_manager',
        }),
      ]),
    );

    const previewResponse = await request(app.getHttpServer())
      .post('/api/v1/governance/daily-report-delivery/preview')
      .set('Cookie', adminCookies)
      .send({
        businessDate: '2026-04-07',
      })
      .expect(200);

    expect(previewResponse.body.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupDepartmentId: 'dept_sales',
          groupDepartmentName: '华东销售',
          recipientCrmUserId: 'user_region_manager',
          recipientName: '区域经理',
          ruleSource: 'REGION_OVERRIDE',
          deliveryStatus: 'READY',
        }),
      ]),
    );
    expect(
      previewResponse.body.groups.find(
        (item: { groupDepartmentId: string }) =>
          item.groupDepartmentId === 'dept_sd_tech',
      ),
    ).toBeUndefined();
  });

  it('仅切换部门启用状态时，不应清空已有收件覆盖规则', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    appStorageService.state.wecomSyncedDepartments = [
      {
        id: 'dept_synced_region_east',
        wxDepartmentId: 'dept_region_east',
        departmentName: '华东区',
        parentDepartmentId: 'dept_sales_management',
        leaderUserids: ['wx_region_manager'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'dept_synced_sales_east',
        wxDepartmentId: 'dept_sales',
        departmentName: '华东销售',
        parentDepartmentId: 'dept_region_east',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
    ];
    appStorageService.state.wecomSyncedUsers = [
      {
        id: 'synced_region_manager',
        wxUserid: 'wx_region_manager',
        userName: '区域经理',
        primaryDepartmentId: 'dept_region_east',
        departmentIds: ['dept_region_east'],
        directLeaderUserids: ['wx_sales_vp'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'synced_sales_director',
        wxUserid: 'wx_sales_director',
        userName: '销售总监',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        directLeaderUserids: ['wx_region_manager'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
    ];

    await request(app.getHttpServer())
      .put('/api/v1/governance/daily-report-delivery/departments/dept_region_east')
      .set('Cookie', adminCookies)
      .send({
        status: 'ENABLED',
        departmentType: 'REGION',
        applyToChildren: true,
        overrideRecipientCrmUserId: 'user_region_manager',
        reason: '区域负责人承接销售组汇总',
      })
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/v1/governance/daily-report-delivery/departments/dept_sales')
      .set('Cookie', adminCookies)
      .send({
        status: 'DISABLED',
        departmentType: 'SALES',
        applyToChildren: false,
        reason: '临时停用华东销售日报',
      })
      .expect(200);

    const previewResponse = await request(app.getHttpServer())
      .post('/api/v1/governance/daily-report-delivery/preview')
      .set('Cookie', adminCookies)
      .send({
        businessDate: '2026-04-07',
      })
      .expect(200);

    expect(previewResponse.body.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupDepartmentId: 'dept_sales',
          effectivePolicy: 'DISABLED',
          deliveryStatus: 'BLOCKED',
          deliveryStatusLabel: '已停用',
          recipientCrmUserId: 'user_region_manager',
          recipientName: '区域经理',
          ruleSource: 'REGION_OVERRIDE',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .put('/api/v1/governance/daily-report-delivery/departments/dept_sales')
      .set('Cookie', adminCookies)
      .send({
        status: 'ENABLED',
        departmentType: 'SALES',
        applyToChildren: false,
        reason: '重新启用华东销售日报',
      })
      .expect(200);

    const enabledPreviewResponse = await request(app.getHttpServer())
      .post('/api/v1/governance/daily-report-delivery/preview')
      .set('Cookie', adminCookies)
      .send({
        businessDate: '2026-04-07',
      })
      .expect(200);

    expect(enabledPreviewResponse.body.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupDepartmentId: 'dept_sales',
          recipientCrmUserId: 'user_region_manager',
          recipientName: '区域经理',
          ruleSource: 'REGION_OVERRIDE',
        }),
      ]),
    );
  });

  it('日报策略原因为空时，应返回 400 而不是 500', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .put('/api/v1/governance/daily-report-delivery/departments/__GLOBAL_ALL__')
      .set('Cookie', adminCookies)
      .send({
        status: 'DISABLED',
        departmentType: 'UNCLASSIFIED',
        applyToChildren: true,
        reason: '   ',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('请填写策略原因。');
      });
  });

  it('删除日报策略后，应同时清理部门策略和收件覆盖规则', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    appStorageService.state.wecomSyncedDepartments = [
      {
        id: 'dept_synced_region_east',
        wxDepartmentId: 'dept_region_east',
        departmentName: '华东区',
        parentDepartmentId: 'dept_sales_management',
        leaderUserids: ['wx_region_manager'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'dept_synced_sales_east',
        wxDepartmentId: 'dept_sales',
        departmentName: '华东销售',
        parentDepartmentId: 'dept_region_east',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
    ];
    appStorageService.state.wecomSyncedUsers = [
      {
        id: 'synced_region_manager',
        wxUserid: 'wx_region_manager',
        userName: '区域经理',
        primaryDepartmentId: 'dept_region_east',
        departmentIds: ['dept_region_east'],
        directLeaderUserids: ['wx_sales_vp'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
    ];

    await request(app.getHttpServer())
      .put('/api/v1/governance/daily-report-delivery/departments/dept_region_east')
      .set('Cookie', adminCookies)
      .send({
        status: 'ENABLED',
        departmentType: 'REGION',
        applyToChildren: true,
        overrideRecipientCrmUserId: 'user_region_manager',
        reason: '区域负责人承接销售组汇总',
      })
      .expect(200);

    await request(app.getHttpServer())
      .delete('/api/v1/governance/daily-report-delivery/departments/dept_region_east')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(appStorageService.state.dailyReportDepartmentPolicies).toEqual([]);
    expect(appStorageService.state.dailyReportRecipientOverrides).toEqual([]);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/governance/daily-report-delivery/departments')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(
      listResponse.body.strategies.find(
        (item: { departmentId: string }) => item.departmentId === 'dept_region_east',
      ),
    ).toBeUndefined();
  });

  it('企业微信灰度为试点模式且未命中白名单时，应阻断企业微信入口', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use', 'wecom.analysis.use'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: true,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '为销售总监打开企业微信入口资格',
      })
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/v1/governance/channels/wecom-bot/pilot-policy')
      .set('Cookie', adminCookies)
      .send({
        mode: 'PILOT_ONLY',
        allowUserIds: [],
        allowRoleIds: [],
        allowDepartmentIds: [],
        denyUserIds: [],
        note: '只允许首批试点成员使用',
      })
      .expect(200);

    await expect(
      wecomAuthService.resolveSender('wx_sales_director', 'wecom-bot'),
    ).rejects.toThrow('当前企业微信机器人仍在灰度开放中');
  });

  it('企业微信灰度命中用户白名单时，应允许企业微信入口通过', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use', 'wecom.analysis.use'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: true,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '为销售总监打开企业微信入口资格',
      })
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/v1/governance/channels/wecom-bot/pilot-policy')
      .set('Cookie', adminCookies)
      .send({
        mode: 'PILOT_ONLY',
        allowUserIds: ['user_sales_director'],
        allowRoleIds: [],
        allowDepartmentIds: [],
        denyUserIds: [],
        note: '首批试点用户',
      })
      .expect(200);

    const resolvedUser = await wecomAuthService.resolveSender('wx_sales_director', 'wecom-bot');
    expect(resolvedUser.id).toBe('user_sales_director');
  });

  it('权限预览与身份映射诊断应返回企业微信入口状态和失败原因', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use', 'wecom.analysis.use'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: true,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '为销售总监打开企业微信入口资格',
      })
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/v1/governance/channels/wecom-bot/pilot-policy')
      .set('Cookie', adminCookies)
      .send({
        mode: 'PILOT_ONLY',
        allowUserIds: [],
        allowRoleIds: [],
        allowDepartmentIds: [],
        denyUserIds: [],
        note: '尚未放开白名单',
      })
      .expect(200);

    const previewResponse = await request(app.getHttpServer())
      .post('/api/v1/governance/access-preview')
      .set('Cookie', adminCookies)
      .send({
        wecomUserId: 'wx_sales_director',
      })
      .expect(200);

    expect(previewResponse.body.wecomBotAccessState).toBe('PILOT_REQUIRED');
    expect(String(previewResponse.body.wecomBotAccessReason)).toContain('灰度开放');

    const diagnosticResponse = await request(app.getHttpServer())
      .get('/api/v1/governance/identity-mappings')
      .set('Cookie', adminCookies)
      .query({
        wecomUserId: 'wx_sales_director',
      })
      .expect(200);

    expect(diagnosticResponse.body.items[0]).toMatchObject({
      wecomUserId: 'wx_sales_director',
      crmUserId: 'user_sales_director',
      mappingStatus: 'MAPPED',
      wecomBotAccessState: 'PILOT_REQUIRED',
    });
  });

  it('身份映射诊断在实时 CRM 身份装载超时时，应返回降级结果而不是 500', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    jest
      .spyOn(crmReadonlyService, 'getUserById')
      .mockRejectedValue(new QueryExecutionTimeoutError());

    const diagnosticResponse = await request(app.getHttpServer())
      .get('/api/v1/governance/identity-mappings')
      .set('Cookie', adminCookies)
      .query({
        wecomUserId: 'wx_sales_director',
      })
      .expect(200);

    expect(diagnosticResponse.body.items[0]).toMatchObject({
      wecomUserId: 'wx_sales_director',
      crmUserId: 'user_sales_director',
      mappingStatus: 'MAPPED',
      wecomBotAccessState: 'RESOURCE_FORBIDDEN',
    });
    expect(String(diagnosticResponse.body.items[0].failedReason)).toContain(
      '实时权限快照加载超时',
    );
  });

  it('合同审核跨任务查看与下载应由统一角色动作矩阵控制', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const managerCookies = await loginAs(app, 'user_region_manager');

    const downloadFilePath = join(process.cwd(), '.runtime', 'contract-review', 'test-report.md');
    mkdirSync(join(process.cwd(), '.runtime', 'contract-review'), { recursive: true });
    writeFileSync(downloadFilePath, '# mock report', 'utf8');

    appStorageService.state.contractReviewTasks = [
      {
        id: 'task_shared_review',
        requesterId: 'user_sales_director',
        requesterName: '销售总监',
        originalFileName: '共享合同.docx',
        storedFilePath: 'c:/tmp/shared.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 1024,
        status: 'COMPLETED',
        latestStageMessage: '审核完成',
        ruleSetCode: 'company-commercial-v1',
        ruleSetVersion: '1.0.0',
        overallDecision: 'REVISE',
        summary: '审核完成',
        latestResultSummary: '建议修改后再签署',
        vetoCount: 0,
        highRiskCount: 1,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        totalIssueCount: 1,
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:10:00.000Z',
        completedAt: '2026-04-22T00:10:00.000Z',
      },
    ];
    appStorageService.state.contractReviewArtifacts = [
      {
        id: 'artifact_shared_report',
        taskId: 'task_shared_review',
        artifactType: 'REPORT',
        fileName: '审核报告.md',
        filePath: downloadFilePath,
        mimeType: 'text/markdown',
        status: 'AVAILABLE',
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:10:00.000Z',
      },
    ];

    await request(app.getHttpServer())
      .get('/api/v1/contract-reviews/tasks/task_shared_review')
      .set('Cookie', managerCookies)
      .expect(403);

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_region_manager')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '区域经理',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench', 'contract-review'],
        actionKeys: ['analysis.use', 'contract.review.cross_view', 'contract.review.cross_download'],
        webConsoleEnabled: true,
        wecomBotEligible: false,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: true,
        contractReviewCrossDownloadAllowed: true,
        changeReason: '授权区域经理查看和下载共享审核任务',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/contract-reviews/tasks/task_shared_review')
      .set('Cookie', managerCookies)
      .expect(200);

    const artifact = contractReviewService.getArtifactDownload(
      {
        id: 'user_region_manager',
        name: '区域经理',
        roleIds: ['role_region_manager'],
        roleNames: ['区域经理'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_region_east'],
        ownerIds: ['owner_zhang'],
        isAdmin: false,
        exportAllowed: false,
        channels: ['web-console', 'wecom-bot'],
      },
      'task_shared_review',
      'artifact_shared_report',
    );

    expect(artifact.fileName).toBe('审核报告.md');
  });

  it('撤销 contract-review 菜单后，本人历史合同任务详情也应被阻断', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const userCookies = await loginAs(app, 'user_sales_director');

    appStorageService.state.contractReviewTasks = [
      {
        id: 'task_self_review',
        requesterId: 'user_sales_director',
        requesterName: '销售总监',
        originalFileName: '本人合同.docx',
        storedFilePath: 'c:/tmp/self.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 1024,
        status: 'COMPLETED',
        latestStageMessage: '审核完成',
        ruleSetCode: 'company-commercial-v1',
        ruleSetVersion: '1.0.0',
        overallDecision: 'REVISE',
        summary: '审核完成',
        latestResultSummary: '建议修改后再签署',
        vetoCount: 0,
        highRiskCount: 1,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        totalIssueCount: 1,
        createdAt: '2026-04-22T00:00:00.000Z',
        updatedAt: '2026-04-22T00:10:00.000Z',
        completedAt: '2026-04-22T00:10:00.000Z',
      },
    ];

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use', 'contract.review.upload'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: true,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '用于验证撤销合同工作台基础访问后本人历史任务同步失效',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/contract-reviews/tasks/task_self_review')
      .set('Cookie', userCookies)
      .expect(403);
  });

  it('撤销 analysis.follow_up 后，结果详情继续追问应被拒绝', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const userCookies = await loginAs(app, 'user_sales_director');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '用于验证继续追问动作撤销',
      })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', userCookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', userCookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '把时间范围改成近三个月',
        followUpQueryId: created.body.queryId,
      })
      .expect(403);
  });
});
