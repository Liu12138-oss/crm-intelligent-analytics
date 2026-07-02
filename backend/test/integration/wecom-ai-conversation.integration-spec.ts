import request from 'supertest';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';
import { SalesLeaderMappingService } from '../../src/modules/daily-report/sales-leader-mapping.service';
import { CrmCustomerApiService } from '../../src/modules/opportunities/crm-customer-api.service';
import { CrmOpportunityApiService } from '../../src/modules/opportunities/crm-opportunity-api.service';
import { CrmBuiltinAccountTokenService } from '../../src/modules/opportunities/crm-builtin-account-token.service';
import { LocalRuntimeConfigService } from '../../src/shared/config/local-runtime-config.service';
import { WecomDailyReportIntakeService } from '../../src/modules/wecom/wecom-daily-report-intake.service';
import { AiGatewayService } from '../../src/modules/analysis/ai-gateway.service';
import {
  createDefaultAppStorageState,
  CRM_CUSTOMERS,
  CRM_OPPORTUNITIES,
} from '../../src/shared/mock/sample-data';
import { createTestApp } from '../test-app';

const WECOM_CRM_CREATE_ENV_KEYS = [
  'CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY',
  'CRM_CUSTOMER_CREATE_DEFAULT_SOURCE',
  'CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD',
  'CRM_CUSTOMER_CREATE_UNIFIED_SOCIAL_CREDIT_CODE_FIELD',
  'CRM_OPPORTUNITY_CREATE_DEFAULT_STAGE',
  'CRM_OPPORTUNITY_CREATE_DEFAULT_SOURCE',
  'CRM_OPPORTUNITY_CREATE_DEFAULT_KIND',
  'CRM_OPPORTUNITY_CREATE_LEAD_CODE_FIELD',
  'CRM_OPPORTUNITY_CREATE_RENEWAL_CONTRACT_CODE_FIELD',
  'CRM_OPPORTUNITY_CREATE_AGENT_FULL_NAME_FIELD',
  'CRM_OPPORTUNITY_CREATE_PROJECT_STATUS_FIELD',
  'CRM_OPPORTUNITY_CREATE_PRE_SALES_FIELD',
  'CRM_OPPORTUNITY_CREATE_PRODUCT_ALIAS_MAP',
] as const;

describe('wecom ai conversation integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let customerLookupService: CrmCustomerApiService;
  let opportunityLookupService: CrmOpportunityApiService;
  let crmBuiltinAccountTokenService: CrmBuiltinAccountTokenService;
  let aiGatewayService: AiGatewayService;
  let localRuntimeConfigService: LocalRuntimeConfigService;
  let crmReadonlyService: CrmReadonlyService;
  let salesLeaderMappingService: SalesLeaderMappingService;
  const originalEnv = new Map<string, string | undefined>();
  const originalWecomAiEntryIntentEnabled =
    process.env.WECOM_AI_ENTRY_INTENT_ENABLED;
  const originalCustomers = JSON.parse(JSON.stringify(CRM_CUSTOMERS));
  const originalOpportunities = JSON.parse(JSON.stringify(CRM_OPPORTUNITIES));

  beforeAll(async () => {
    for (const key of WECOM_CRM_CREATE_ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }

    process.env.CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY = '201';
    process.env.CRM_CUSTOMER_CREATE_DEFAULT_SOURCE = '400';
    process.env.CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD =
      'text_asset_it_decision_location';
    process.env.CRM_CUSTOMER_CREATE_UNIFIED_SOCIAL_CREDIT_CODE_FIELD =
      'text_asset_uscc';
    process.env.CRM_OPPORTUNITY_CREATE_DEFAULT_STAGE = '250839';
    process.env.CRM_OPPORTUNITY_CREATE_DEFAULT_SOURCE = '400';
    process.env.CRM_OPPORTUNITY_CREATE_DEFAULT_KIND = 'normal';
    process.env.CRM_OPPORTUNITY_CREATE_LEAD_CODE_FIELD = 'text_asset_lead_code';
    process.env.CRM_OPPORTUNITY_CREATE_RENEWAL_CONTRACT_CODE_FIELD =
      'text_asset_renewal_contract_code';
    process.env.CRM_OPPORTUNITY_CREATE_AGENT_FULL_NAME_FIELD =
      'text_asset_agent_full_name';
    process.env.CRM_OPPORTUNITY_CREATE_PROJECT_STATUS_FIELD =
      'text_asset_project_status';
    process.env.CRM_OPPORTUNITY_CREATE_PRE_SALES_FIELD = 'text_asset_pre_sales';
    process.env.CRM_OPPORTUNITY_CREATE_PRODUCT_ALIAS_MAP = JSON.stringify({
      云平台标准版: 'prod_saas_standard',
    });

    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    customerLookupService = app.get(CrmCustomerApiService);
    opportunityLookupService = app.get(CrmOpportunityApiService);
    crmBuiltinAccountTokenService = app.get(CrmBuiltinAccountTokenService);
    aiGatewayService = app.get(AiGatewayService);
    localRuntimeConfigService = app.get(LocalRuntimeConfigService);
    crmReadonlyService = app.get(CrmReadonlyService);
    salesLeaderMappingService = app.get(SalesLeaderMappingService);
  });

  afterAll(async () => {
    await app.close();

    for (const key of WECOM_CRM_CREATE_ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.assign(appStorageService.state, createDefaultAppStorageState());
    seedFollowUpOwnerOrganizationFacts();
    if (originalWecomAiEntryIntentEnabled === undefined) {
      delete process.env.WECOM_AI_ENTRY_INTENT_ENABLED;
    } else {
      process.env.WECOM_AI_ENTRY_INTENT_ENABLED = originalWecomAiEntryIntentEnabled;
    }
    resetCrmCreateConfigCache();
    CRM_CUSTOMERS.splice(0, CRM_CUSTOMERS.length, ...JSON.parse(JSON.stringify(originalCustomers)));
    CRM_OPPORTUNITIES.splice(
      0,
      CRM_OPPORTUNITIES.length,
      ...JSON.parse(JSON.stringify(originalOpportunities)),
    );
  });

  function resetCrmCreateConfigCache(): void {
    (localRuntimeConfigService as unknown as {
      crmCustomerCreateConfigCache?: unknown;
      crmOpportunityCreateConfigCache?: unknown;
    }).crmCustomerCreateConfigCache = undefined;
    (localRuntimeConfigService as unknown as {
      crmCustomerCreateConfigCache?: unknown;
      crmOpportunityCreateConfigCache?: unknown;
    }).crmOpportunityCreateConfigCache = undefined;
  }

  function seedFollowUpOwnerOrganizationFacts(): void {
    appStorageService.state.crmWxUsers.push(
      {
        id: 'crm_wx_user_owner_li',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_owner_li',
        originUserid: 'wx_owner_li',
        name: '李浩',
        departmentIds: ['dept_sales'],
        createdAt: '2026-04-27T10:00:00.000Z',
        updatedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'crm_wx_user_owner_zhang',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_owner_zhang',
        originUserid: 'wx_owner_zhang',
        name: '张琳',
        departmentIds: ['dept_sales'],
        createdAt: '2026-04-27T10:00:00.000Z',
        updatedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'crm_wx_user_owner_wang',
        wxOrganizationId: 'wx_org_mock',
        userid: 'wx_owner_wang',
        originUserid: 'wx_owner_wang',
        name: '王敏',
        departmentIds: ['dept_sales'],
        createdAt: '2026-04-27T10:00:00.000Z',
        updatedAt: '2026-04-27T10:00:00.000Z',
      },
    );
    appStorageService.state.crmWxUserMaps.push({
      id: 'crm_wx_user_map_owner_li',
      wxOrganizationId: 'wx_org_mock',
      wxUserId: 'crm_wx_user_owner_li',
      crmUserId: 'owner_li',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
    });
    appStorageService.state.crmWxUserMaps.push(
      {
        id: 'crm_wx_user_map_owner_zhang',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_owner_zhang',
        crmUserId: 'owner_zhang',
        createdAt: '2026-04-27T10:00:00.000Z',
        updatedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'crm_wx_user_map_owner_wang',
        wxOrganizationId: 'wx_org_mock',
        wxUserId: 'crm_wx_user_owner_wang',
        crmUserId: 'owner_wang',
        createdAt: '2026-04-27T10:00:00.000Z',
        updatedAt: '2026-04-27T10:00:00.000Z',
      },
    );
    appStorageService.state.wecomSyncedUsers = [
      {
        id: 'sync_sales_director',
        wxUserid: 'wx_sales_director',
        originUserid: 'wx_sales_director',
        userName: '销售总监',
        organizationExternalId: 'wx_org_mock',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        directLeaderUserids: [],
        rawPayload: {
          userid: 'wx_sales_director',
          name: '销售总监',
          direct_leader: [],
        },
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'sync_region_manager',
        wxUserid: 'wx_region_manager',
        originUserid: 'wx_region_manager',
        userName: '区域经理',
        organizationExternalId: 'wx_org_mock',
        primaryDepartmentId: 'dept_region_east',
        departmentIds: ['dept_region_east'],
        directLeaderUserids: ['wx_sales_director'],
        rawPayload: {
          userid: 'wx_region_manager',
          name: '区域经理',
          direct_leader: ['wx_sales_director'],
        },
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'sync_product_director',
        wxUserid: 'wx_product_director',
        originUserid: 'wx_product_director',
        userName: '产品总监',
        organizationExternalId: 'wx_org_mock',
        primaryDepartmentId: 'dept_product',
        departmentIds: ['dept_product'],
        directLeaderUserids: [],
        rawPayload: {
          userid: 'wx_product_director',
          name: '产品总监',
          direct_leader: [],
        },
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'sync_product_manager',
        wxUserid: 'wx_product_li_si',
        originUserid: 'wx_product_li_si',
        userName: '李四',
        organizationExternalId: 'wx_org_mock',
        primaryDepartmentId: 'dept_product',
        departmentIds: ['dept_product'],
        directLeaderUserids: ['wx_product_director'],
        rawPayload: {
          userid: 'wx_product_li_si',
          name: '李四',
          direct_leader: ['wx_product_director'],
        },
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'sync_owner_li',
        wxUserid: 'wx_owner_li',
        originUserid: 'wx_owner_li',
        userName: '李浩',
        organizationExternalId: 'wx_org_mock',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        directLeaderUserids: ['wx_sales_director'],
        rawPayload: {
          userid: 'wx_owner_li',
          name: '李浩',
          direct_leader: ['wx_sales_director'],
        },
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'sync_owner_zhang',
        wxUserid: 'wx_owner_zhang',
        originUserid: 'wx_owner_zhang',
        userName: '张琳',
        organizationExternalId: 'wx_org_mock',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        directLeaderUserids: ['wx_sales_director'],
        rawPayload: {
          userid: 'wx_owner_zhang',
          name: '张琳',
          direct_leader: ['wx_sales_director'],
        },
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-27T10:00:00.000Z',
      },
      {
        id: 'sync_owner_wang',
        wxUserid: 'wx_owner_wang',
        originUserid: 'wx_owner_wang',
        userName: '王敏',
        organizationExternalId: 'wx_org_mock',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        directLeaderUserids: ['wx_sales_director'],
        rawPayload: {
          userid: 'wx_owner_wang',
          name: '王敏',
          direct_leader: ['wx_sales_director'],
        },
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-27T10:00:00.000Z',
      },
    ];
  }

  function grantWecomFollowUpWritebackToProductManager(): void {
    appStorageService.state.rolePermissions = [
      {
        roleId: 'role_product_manager',
        roleNameSnapshot: '产品经理',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['wecom.followup.writeback'],
        webConsoleEnabled: false,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        updatedBy: 'user_admin',
        updatedAt: '2026-04-27T10:00:00.000Z',
        changeReason: '用于验证对象级跟进权限阻断',
      },
    ];
  }

  function grantWecomFollowUpWritebackToRegionManager(): void {
    appStorageService.state.rolePermissions = appStorageService.state.rolePermissions.map(
      (item) =>
        item.roleId === 'role_region_manager'
          ? {
              ...item,
              actionKeys: Array.from(
                new Set([...item.actionKeys, 'wecom.followup.writeback']),
              ),
              updatedAt: '2026-04-27T10:00:00.000Z',
              changeReason: '用于验证协作人对象级跟进权限放行',
            }
          : item,
    );
  }

  it('无活跃任务时发送“你好”应直接返回帮助提示和能力清单', async () => {
    const conversationId = 'conv_wecom_help_greeting_001';

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_greeting_001_01',
        messageText: '你好',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    expect(appStorageService.state.analysisRequests).toHaveLength(0);
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('CRM 智能小助手');
    expect(lastAssistantTurn?.content).toContain('经营分析问数');
    expect(lastAssistantTurn?.content).toContain('跟进整理与受控写回');
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });
  });

  it('同一会话同一用户连续发送消息时，不应重复执行企业微信身份映射查询', async () => {
    const conversationId = 'conv_wecom_identity_cache_001';
    const senderLookupSpy = jest.spyOn(crmReadonlyService, 'getUserByWecomSenderId');
    const userByIdSpy = jest.spyOn(crmReadonlyService, 'getUserById');

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_identity_cache_001_01',
        messageText: '你能做什么',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_identity_cache_001_02',
        messageText: 'help',
      })
      .expect(202);

    expect(senderLookupSpy).toHaveBeenCalledTimes(1);
    expect(userByIdSpy).toHaveBeenCalledTimes(1);
  });

  it('无活跃任务时发送“你能做什么”应直接返回能力清单', async () => {
    const conversationId = 'conv_wecom_help_capability_001';

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_capability_001_01',
        messageText: '你能做什么',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('CRM 智能小助手');
    expect(lastAssistantTurn?.content).toContain('受控新增客户');
    expect(lastAssistantTurn?.content).toContain('今日日报查看');
  });

  it('无活跃任务时发送英文 help 也应返回帮助提示', async () => {
    const conversationId = 'conv_wecom_help_en_001';

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_en_001_01',
        messageText: 'help',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      language: 'en',
    });
  });

  it('空闲态帮助短句在 AI idle lane 返回空结果时，也应直接回帮助兜底且不再触发问数意图解析', async () => {
    const conversationId = 'conv_wecom_help_timeout_fallback_001';
    const parseStructuredIntentSpy = jest.spyOn(aiGatewayService, 'parseStructuredIntent');
    jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomIdleConversationIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomIdleConversationIntent',
    ).mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_timeout_fallback_001_01',
        messageText: '你好',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    expect(parseStructuredIntentSpy).not.toHaveBeenCalled();
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: true,
      fallbackReason: 'idle-unrecognized-help-fallback',
    });
  });

  it('无活跃任务时发送取消短句也应先过 AI 并回到帮助提示', async () => {
    const conversationId = 'conv_wecom_idle_cancel_help_001';

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_idle_cancel_help_001_01',
        messageText: '先不做了',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
    });
  });

  it('空闲态非固定关键词创建表达也应按 AI idle semantic lane 进入新增客户流程', async () => {
    const conversationId = 'conv_wecom_idle_ai_customer_create_001';
    jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomIdleConversationIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomIdleConversationIntent',
    ).mockResolvedValue({
      intent: 'CRM_CREATE_CUSTOMER',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_idle_ai_customer_create_001_01',
        messageText: '帮我录一个新客户',
      })
      .expect(202);

    expect(response.body.status).toBe('WECOM_CRM_CREATE_COLLECTING');
  });

  it('标准新增客户入口命中后应留下非 fallback 的统一 AI 理解快照', async () => {
    const conversationId = 'conv_wecom_idle_ai_customer_create_snapshot_001';

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_idle_ai_customer_create_snapshot_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    expect(response.body.status).toBe('WECOM_CRM_CREATE_COLLECTING');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );

    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_CRM_CREATE_CUSTOMER',
      usedFallback: false,
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });
  });

  it('关闭 AI 入口开关后，新增客户短句应回到帮助兜底而不是恢复旧规则主链', async () => {
    process.env.WECOM_AI_ENTRY_INTENT_ENABLED = 'false';
    const conversationId = 'conv_wecom_ai_entry_disabled_customer_create_001';

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_ai_entry_disabled_customer_create_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('经营分析问数');
    expect(conversationContext?.workMemory.crmCreateStatus).toBeUndefined();
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: true,
    });
  });

  it('AI idle lane 返回 NONE 时，新增客户短句应回到帮助兜底而不是恢复旧规则主链', async () => {
    const conversationId = 'conv_wecom_idle_none_customer_create_001';
    jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomIdleConversationIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomIdleConversationIntent',
    ).mockResolvedValue({
      intent: 'NONE',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_idle_none_customer_create_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(conversationContext?.workMemory.crmCreateStatus).toBeUndefined();
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: true,
      fallbackReason: 'idle-unrecognized-help-fallback',
    });
  });

  it('空闲态非固定关键词小组日报表达也应按 AI idle semantic lane 进入小组日报预览', async () => {
    const conversationId = 'conv_wecom_idle_ai_team_report_001';
    const member = crmReadonlyService.listUsers().find(
      (item) => item.id === 'user_sales_director',
    );
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_vp');
    expect(member).toBeDefined();
    expect(actor).toBeDefined();
    jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomIdleConversationIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomIdleConversationIntent',
    ).mockResolvedValue({
      intent: 'TEAM_DAILY_REPORT_QUERY',
      leaderNameQuery: '王文定',
    });
    jest.spyOn(salesLeaderMappingService, 'listMappedSalesGroups').mockResolvedValue([
      {
        area: '北区金融部',
        region: '北区金融部-王文定',
        leaderName: '王文定',
        leader: {
          ...(actor as NonNullable<typeof actor>),
          id: 'leader_wang',
          name: '王文定',
          supervisorId: 'user_sales_vp',
          supervisorName: '销售副总',
        },
        members: [member as NonNullable<typeof member>],
      },
    ]);

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_vp',
        messageId: 'msg_wecom_idle_ai_team_report_001_01',
        messageText: '我想看看王文定团队今天情况',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('王文定小组');
  });

  it('空闲态非固定关键词项目查询表达也应按 AI idle semantic lane 进入项目查询', async () => {
    const conversationId = 'conv_wecom_idle_ai_lookup_001';
    jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomIdleConversationIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomIdleConversationIntent',
    ).mockResolvedValue({
      intent: 'OPPORTUNITY_LOOKUP',
      lookupText: '安恒信息',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_idle_ai_lookup_001_01',
        messageText: '安恒信息那个项目帮我查下',
      })
      .expect(202);

    expect(['RETURNED', 'CLARIFICATION_REQUIRED', 'OPPORTUNITY_LOOKUP_RETURNED']).toContain(
      response.body.status,
    );
  });

  it('AI idle lane 返回 NONE 时，明显跟进叙述应回到帮助兜底而不是再靠规则进入跟进整理', async () => {
    const conversationId = 'conv_wecom_idle_none_follow_up_001';
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;
    jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomIdleConversationIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomIdleConversationIntent',
    ).mockResolvedValue({
      intent: 'NONE',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_idle_none_follow_up_001_01',
        messageText:
          '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeUndefined();
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: true,
      fallbackReason: 'idle-unrecognized-help-fallback',
    });
  });

  it('AI idle lane 未命中时，显式“跟进客户”入口仍应兜底进入跟进模板收集', async () => {
    const conversationId = 'conv_wecom_idle_none_follow_up_theme_001';
    jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomIdleConversationIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomIdleConversationIntent',
    ).mockResolvedValue({
      intent: 'NONE',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_idle_none_follow_up_theme_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PROMPTED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeDefined();
    expect(conversationContext?.workMemory.dailyReportFlowStatus).toBe('COLLECTING');
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_DAILY_REPORT_ENTRY',
      usedFallback: true,
      fallbackReason: 'idle-follow-up-theme-entry-fallback',
      structuredSlots: {
        entryMode: 'FIXED_WORKFLOW',
        fixedWorkflow: 'DAILY_REPORT',
        dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
      },
    });
    expect(lastAssistantTurn?.content).toContain('收到，本次跟进由我来统一整理。');
    expect(lastAssistantTurn?.content).toContain('跟进内容：');
  });

  it('语义不明确短句应直接返回友好帮助提示且不创建分析请求', async () => {
    const conversationId = 'conv_wecom_help_low_confidence_001';
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_low_confidence_001_01',
        messageText: '看看',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('经营分析问数');
    expect(lastAssistantTurn?.content).not.toContain(
      '请补充 CRM 对象、时间范围或分析指标后重试',
    );
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: true,
    });
  });

  it('统一 AI 理解层返回低置信时应直接走帮助兜底，不创建分析请求', async () => {
    const conversationId = 'conv_wecom_help_ai_low_confidence_001';
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    jest.spyOn(aiGatewayService, 'parseStructuredIntent').mockResolvedValue({
      domain: 'opportunity-analysis',
      metrics: ['新增商机金额'],
      dimensions: [],
      filters: {},
      missingConditions: ['时间范围'],
      normalizedQuestion: '看看',
      requestedAction: 'BLOCK',
      confidence: 'LOW',
      blockReason: '当前问题语义不够明确，请补充 CRM 对象、时间范围或分析指标后重试。',
      orderBy: [
        {
          field: '新增商机金额',
          direction: 'DESC',
        },
      ],
      resultKindHint: 'owner-ranking',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_ai_low_confidence_001_01',
        messageText: '看看',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('经营分析问数');
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: true,
    });
  });

  it('空闲状态发送未识别裸短句时应返回帮助，不误入商机直查', async () => {
    const conversationId = 'conv_wecom_help_unrecognized_bare_text_001';
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;
    const pendingWritebackCountBefore =
      appStorageService.state.pendingFollowUpWritebacks.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_unrecognized_bare_text_001_01',
        messageText: '相关内',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
    expect(appStorageService.state.pendingFollowUpWritebacks.length).toBe(
      pendingWritebackCountBefore,
    );

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('CRM 智能小助手');
    expect(lastAssistantTurn?.content).toContain('经营分析问数');
    expect(lastAssistantTurn?.content).not.toContain('未按');
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: true,
    });
  });

  it('空闲状态发送非入口的小组日报文本时应返回帮助，不进入日报采集', async () => {
    const conversationId = 'conv_wecom_help_unrecognized_team_daily_001';
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_unrecognized_team_daily_001_01',
        messageText: '王文定小组日报',
      })
      .expect(202);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.queryId).toBeUndefined();
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('经营分析问数');
    expect(lastAssistantTurn?.content).not.toContain('主要跟进了哪些项目');
    expect(conversationContext?.workMemory.dailyReportFlowStatus).toBeUndefined();
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeUndefined();
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_IDLE_MESSAGE',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: true,
    });
  });

  it('超出范围请求应返回友好帮助提示和能力清单', async () => {
    const conversationId = 'conv_wecom_help_out_of_scope_001';

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_out_of_scope_001_01',
        messageText: '帮我查一下今天的天气',
      })
      .expect(202);

    expect(response.body.status).toBe('BLOCKED');
    expect(String(response.body.clarificationPrompt)).toContain('暂时还帮不上');
    expect(String(response.body.clarificationPrompt)).toContain('经营分析问数');
  });

  it('写入型请求应返回友好帮助提示和能力清单', async () => {
    const conversationId = 'conv_wecom_help_write_blocked_001';

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_write_blocked_001_01',
        messageText: '提醒我明天下午开会',
      })
      .expect(202);

    expect(response.body.status).toBe('BLOCKED');
    expect(String(response.body.clarificationPrompt)).toContain('还不能直接帮你写入或修改');
    expect(String(response.body.clarificationPrompt)).toContain('经营分析问数');
  });

  it('进行中的任务里发送“你好”应返回帮助提示但保留原任务上下文', async () => {
    const conversationId = 'conv_wecom_help_active_task_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_active_task_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const helpResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_active_task_001_02',
        messageText: '你好',
      })
      .expect(202);

    expect(helpResponse.body.status).toBe('RETURNED');
    const conversationContextAfterHelp =
      appStorageService.state.wecomConversationContexts.find(
        (item) => item.externalConversationId === conversationId,
      );
    const helpAssistantTurn = [...(conversationContextAfterHelp?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(helpAssistantTurn?.content).toContain('当前跟进整理我先替你留着');
    expect(conversationContextAfterHelp?.workMemory.followUpTemplateDraft).toBeTruthy();

    const continueResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_active_task_001_03',
        messageText: [
          '跟进内容：今天拜访了苏州制造，确认续签方案和预算范围，当前进入商务评审阶段。',
          '遇到与协助：客户希望下周拿到报价测算，需要产品同事李四协助补充实施排期。',
          '信息共享：友商本周主推打包折扣方案，客户对交付周期比价格更敏感。',
          '拜访计划：计划周四上午和李四一起再次拜访苏州制造，确认报价口径并推进到方案评审。',
        ].join('\n'),
      })
      .expect(202);

    expect(continueResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
  });

  it('活跃任务中的非关键词帮助表达应优先按 AI 判断返回帮助提示', async () => {
    const conversationId = 'conv_wecom_help_active_task_ai_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockResolvedValue({
      intent: 'HELP_GUIDANCE',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_active_task_ai_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const helpResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_help_active_task_ai_001_02',
        messageText: '你先说说现在能怎么帮我',
      })
      .expect(202);

    expect(helpResponse.body.status).toBe('RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('当前跟进整理我先替你留着');
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_ACTIVE_TASK_REPLY',
      targetWorkflow: 'WECOM_HELP_GUIDANCE',
      usedFallback: false,
    });
  });

  it('活跃任务中的非关键词取消表达应优先按 AI 判断结束当前任务', async () => {
    const conversationId = 'conv_wecom_cancel_active_task_ai_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockResolvedValue({
      intent: 'TASK_CANCEL',
      packCode: 'wecom-active-task-reply-pack',
      packVersion: 'test-fixture',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_cancel_active_task_ai_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const cancelResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_cancel_active_task_ai_001_02',
        messageText: '这块我先放一下吧',
      })
      .expect(202);

    expect(cancelResponse.body.status).toBe('RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeUndefined();
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_ACTIVE_TASK_REPLY',
      packCode: 'wecom-active-task-reply-pack',
      packVersion: 'test-fixture',
    });
  });

  it('活跃任务中的非关键词切换表达应优先按 AI 判断切到新任务', async () => {
    const conversationId = 'conv_wecom_switch_active_task_ai_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockResolvedValue({
      intent: 'TASK_SWITCH',
      target: 'DAILY_REPORT_QUERY',
      packCode: 'wecom-active-task-reply-pack',
      packVersion: 'test-fixture',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_switch_active_task_ai_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const switchResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_switch_active_task_ai_001_02',
        messageText: '我想先看看今天的日报',
      })
      .expect(202);

    expect(switchResponse.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_ACTIVE_TASK_REPLY',
      packCode: 'wecom-active-task-reply-pack',
      packVersion: 'test-fixture',
    });
  });

  it('关闭 AI 入口开关后，活跃任务里的新任务入口短句不应再按旧规则直接切换', async () => {
    const conversationId = 'conv_wecom_switch_active_task_disabled_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_switch_active_task_disabled_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    process.env.WECOM_AI_ENTRY_INTENT_ENABLED = 'false';

    const switchResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_switch_active_task_disabled_001_02',
        messageText: '我想先看看今天的日报',
      })
      .expect(202);

    expect(switchResponse.body.status).toBe('RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('当前跟进整理我先替你留着');
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeTruthy();
  });

  it('应在企业微信中完成受控新建客户', async () => {
    const conversationId = 'conv_wecom_customer_create_001';

    const entryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    expect(entryResponse.body.status).toBe('WECOM_CRM_CREATE_COLLECTING');

    const summaryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_001_02',
        messageText: [
          '名称：华东机器人样例客户',
          '电话：021-12345678',
          'IT决策权所在地：上海',
          '统一社会信用代码：91310000123456789A',
        ].join('\n'),
      })
      .expect(202);

    expect(summaryResponse.body.status).toBe(
      'WECOM_CRM_CREATE_AWAITING_CONFIRMATION',
    );
    expect(summaryResponse.body.crmCreate.entityType).toBe('Customer');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('WECOM_CRM_CREATE_SUCCEEDED');
    expect(confirmResponse.body.crmCreate.resultId).toBeTruthy();
    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'WECOM_CRM_CREATE_SUCCEEDED',
      ),
    ).toBe(true);
  });

  it('新增客户最终确认时若用户 CRM token 过期，应自动回退内置账号继续创建', async () => {
    const conversationId = 'conv_wecom_customer_create_expired_token_retry_001';
    const requesterUser = crmReadonlyService
      .listUsers()
      .find((item) => item.id === 'user_sales_director');

    expect(requesterUser).toBeDefined();

    const createCustomerSpy = jest.spyOn(customerLookupService, 'createCustomer');
    createCustomerSpy
      .mockRejectedValueOnce(new UnauthorizedException('您的登录已经过期，请重新登录！'))
      .mockResolvedValueOnce({
        id: 'cus_customer_create_retry_001',
        name: '华东自动续期样例客户',
        ownerId: 'user_sales_director',
        ownerName: '销售总监',
        category: '201',
      } as never);

    appStorageService.state.authSessions.unshift({
      id: 'auth_session_customer_create_expired_retry_001',
      requesterId: 'user_sales_director',
      source: 'wecom-scan',
      sessionStatus: 'ACTIVE',
      crmCorpId: 'corp_mock',
      crmAccessToken: 'expired-user-token',
      userSnapshot: requesterUser as NonNullable<typeof requesterUser>,
      lastAccessAt: '2026-04-17T08:40:00.000Z',
      expiresAt: '2026-04-18T08:40:00.000Z',
      createdAt: '2026-04-17T08:40:00.000Z',
      updatedAt: '2026-04-17T08:40:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_expired_token_retry_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_expired_token_retry_001_02',
        messageText: [
          '名称：华东自动续期样例客户',
          '电话：021-12345678',
          'IT决策权所在地：上海',
          '统一社会信用代码：91310000123456789A',
        ].join('\n'),
      })
      .expect(202);

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_expired_token_retry_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('WECOM_CRM_CREATE_SUCCEEDED');
    expect(createCustomerSpy).toHaveBeenCalledTimes(2);
    expect(createCustomerSpy.mock.calls[0]?.[2]?.accessToken).toBe('expired-user-token');
    expect(createCustomerSpy.mock.calls[1]?.[2]?.accessToken).not.toBe(
      'expired-user-token',
    );
  });

  it('客户创建确认阶段回复“是的”也应继续创建', async () => {
    const conversationId = 'conv_wecom_customer_create_affirmative_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_affirmative_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_affirmative_001_02',
        messageText: [
          '名称：华北确认样例客户',
          '电话：021-88886666',
          'IT决策权所在地：上海',
          '统一社会信用代码：91310000999999999X',
        ].join('\n'),
      })
      .expect(202);

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_affirmative_001_03',
        messageText: '是的',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('WECOM_CRM_CREATE_SUCCEEDED');
    expect(confirmResponse.body.crmCreate.resultId).toBeTruthy();
  });

  it('客户创建确认阶段的非关键词表达也应按 AI 判断继续创建', async () => {
    const conversationId = 'conv_wecom_customer_create_ai_confirm_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockImplementation(async (params) => {
      if (params.messageText === '可以，就按这个建') {
        return {
          intent: 'CONTINUE_EXECUTION',
        };
      }

      return null;
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_ai_confirm_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_ai_confirm_001_02',
        messageText: [
          '名称：华东AI确认客户',
          '电话：021-88881111',
          'IT决策权所在地：上海',
          '统一社会信用代码：91310000111111111X',
        ].join('\n'),
      })
      .expect(202);

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_ai_confirm_001_03',
        messageText: '可以，就按这个建',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('WECOM_CRM_CREATE_SUCCEEDED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_ACTIVE_TASK_REPLY',
      targetWorkflow: 'WECOM_CRM_CREATE_CUSTOMER',
      usedFallback: false,
    });
  });

  it('客户创建阶段的非关键词取消表达也应按 AI 判断结束当前任务', async () => {
    const conversationId = 'conv_wecom_customer_create_ai_cancel_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockImplementation(async (params) => {
      if (params.messageText === '这单先放一下') {
        return {
          intent: 'TASK_CANCEL',
        };
      }

      return null;
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_ai_cancel_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    const cancelResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_ai_cancel_001_02',
        messageText: '这单先放一下',
      })
      .expect(202);

    expect(cancelResponse.body.status).toBe('WECOM_CRM_CREATE_CANCELLED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(conversationContext?.workMemory.crmCreateStatus).toBeUndefined();
  });

  it('客户创建中回复“先不做了”应结束当前任务并返回能力清单', async () => {
    const conversationId = 'conv_wecom_customer_create_cancel_guidance_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_cancel_guidance_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    const cancelResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_customer_create_cancel_guidance_001_02',
        messageText: '先不做了',
      })
      .expect(202);

    expect(cancelResponse.body.status).toBe('WECOM_CRM_CREATE_CANCELLED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('经营分析问数');
    expect(lastAssistantTurn?.content).toContain('跟进整理与受控写回');
    expect(conversationContext?.workMemory.crmCreateStatus).toBeUndefined();
  });

  it('客户默认值缺失时应继续补问客户类型和客户来源，并在摘要中展示', async () => {
    const conversationId = 'conv_wecom_customer_create_002';
    const originalCategory = process.env.CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY;
    const originalSource = process.env.CRM_CUSTOMER_CREATE_DEFAULT_SOURCE;
    delete process.env.CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY;
    delete process.env.CRM_CUSTOMER_CREATE_DEFAULT_SOURCE;
    resetCrmCreateConfigCache();

    try {
      await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set('x-wecom-signature', 'test-signature')
        .set('x-wecom-source', 'wecom-bot')
        .send({
          externalConversationId: conversationId,
          senderId: 'wx_sales_director',
          messageId: 'msg_wecom_customer_create_002_01',
          messageText: '新增客户',
        })
        .expect(202);

      const collectResponse = await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set('x-wecom-signature', 'test-signature')
        .set('x-wecom-source', 'wecom-bot')
        .send({
          externalConversationId: conversationId,
          senderId: 'wx_sales_director',
          messageId: 'msg_wecom_customer_create_002_02',
          messageText: [
            '名称：王亮集团',
            '电话：19899009900',
            'IT决策权所在地：武汉',
            '统一社会信用代码：234234234234234234',
          ].join('\n'),
        })
        .expect(202);

      expect(collectResponse.body.status).toBe('WECOM_CRM_CREATE_COLLECTING');
      const conversationContextAfterCollect =
        appStorageService.state.wecomConversationContexts.find(
          (item) => item.externalConversationId === conversationId,
        );
      const collectAssistantTurn = [...(conversationContextAfterCollect?.turns ?? [])]
        .reverse()
        .find((item) => item.role === 'assistant');

      expect(collectAssistantTurn?.content).toContain('客户类型');
      expect(collectAssistantTurn?.content).toContain('客户来源');

      const summaryResponse = await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set('x-wecom-signature', 'test-signature')
        .set('x-wecom-source', 'wecom-bot')
        .send({
          externalConversationId: conversationId,
          senderId: 'wx_sales_director',
          messageId: 'msg_wecom_customer_create_002_03',
          messageText: ['客户类型：测试', '客户来源：测试啊'].join('\n'),
        })
        .expect(202);

      expect(summaryResponse.body.status).toBe(
        'WECOM_CRM_CREATE_AWAITING_CONFIRMATION',
      );
      const conversationContextAfterSummary =
        appStorageService.state.wecomConversationContexts.find(
          (item) => item.externalConversationId === conversationId,
        );
      const summaryAssistantTurn = [...(conversationContextAfterSummary?.turns ?? [])]
        .reverse()
        .find((item) => item.role === 'assistant');

      expect(summaryAssistantTurn?.content).toContain('客户类型：测试');
      expect(summaryAssistantTurn?.content).toContain('客户来源：测试啊');
    } finally {
      if (originalCategory === undefined) {
        delete process.env.CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY;
      } else {
        process.env.CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY = originalCategory;
      }
      if (originalSource === undefined) {
        delete process.env.CRM_CUSTOMER_CREATE_DEFAULT_SOURCE;
      } else {
        process.env.CRM_CUSTOMER_CREATE_DEFAULT_SOURCE = originalSource;
      }
      resetCrmCreateConfigCache();
    }
  });

  it('客户字段映射配置缺失时应在确认前直接提示配置问题', async () => {
    const conversationId = 'conv_wecom_customer_create_003';
    const originalConfig = localRuntimeConfigService.getCrmCustomerCreateConfig();
    jest
      .spyOn(localRuntimeConfigService, 'getCrmCustomerCreateConfig')
      .mockReturnValue({
        ...originalConfig,
        itDecisionLocationField: '',
      });
    resetCrmCreateConfigCache();

    try {
      await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set('x-wecom-signature', 'test-signature')
        .set('x-wecom-source', 'wecom-bot')
        .send({
          externalConversationId: conversationId,
          senderId: 'wx_sales_director',
          messageId: 'msg_wecom_customer_create_003_01',
          messageText: '新增客户',
        })
        .expect(202);

      const failedResponse = await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set('x-wecom-signature', 'test-signature')
        .set('x-wecom-source', 'wecom-bot')
        .send({
          externalConversationId: conversationId,
          senderId: 'wx_sales_director',
          messageId: 'msg_wecom_customer_create_003_02',
          messageText: [
            '名称：王亮集团',
            '电话：19899009900',
            'IT决策权所在地：武汉',
            '统一社会信用代码：234234234234234234',
          ].join('\n'),
        })
        .expect(202);

      expect(failedResponse.body.status).toBe('WECOM_CRM_CREATE_FAILED');
      const conversationContext = appStorageService.state.wecomConversationContexts.find(
        (item) => item.externalConversationId === conversationId,
      );
      const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
        .reverse()
        .find((item) => item.role === 'assistant');

      expect(lastAssistantTurn?.content).toContain(
        'CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD',
      );
      expect(lastAssistantTurn?.content).toContain('系统配置问题');
    } finally {
      resetCrmCreateConfigCache();
    }
  });

  it('应在企业微信中完成受控新建商机', async () => {
    const conversationId = 'conv_wecom_opportunity_create_001';

    const entryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_001_01',
        messageText: '新增商机',
      })
      .expect(202);

    expect(entryResponse.body.status).toBe('WECOM_CRM_CREATE_COLLECTING');

    const summaryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_001_02',
        messageText: [
          '项目名称：苏州制造云平台续约',
          '最终客户：苏州制造',
          '线索编号：LEAD-001',
          '关联产品：云平台标准版',
          '预计有效收入：560000',
          '预计签单日期：2026-05-20',
          '被续签合同号：HT-2025-001',
          '代理商全称：苏州代理商有限公司',
          '项目现状及关键点：客户已经认可续约方案，等待商务审批。',
          '售前：赵工',
        ].join('\n'),
      })
      .expect(202);

    expect(summaryResponse.body.status).toBe(
      'WECOM_CRM_CREATE_AWAITING_CONFIRMATION',
    );
    expect(summaryResponse.body.crmCreate.entityType).toBe('Opportunity');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('WECOM_CRM_CREATE_SUCCEEDED');
    expect(confirmResponse.body.crmCreate.resultId).toBeTruthy();
  });

  it('商机创建确认阶段的非关键词表达也应按 AI 判断继续创建', async () => {
    const conversationId = 'conv_wecom_opportunity_create_ai_confirm_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockImplementation(async (params) => {
      if (params.messageText === '可以，继续创建') {
        return {
          intent: 'CONTINUE_EXECUTION',
        };
      }

      return null;
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_ai_confirm_001_01',
        messageText: '新增商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_ai_confirm_001_02',
        messageText: [
          '项目名称：华东AI确认商机',
          '最终客户：苏州制造',
          '线索编号：LEAD-AI-001',
          '关联产品：云平台标准版',
          '预计有效收入：660000',
          '预计签单日期：2026-05-22',
          '被续签合同号：HT-2025-009',
          '代理商全称：华东代理有限公司',
          '项目现状及关键点：客户已经认可续约范围，等待商务审批。',
          '售前：赵工',
        ].join('\n'),
      })
      .expect(202);

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_ai_confirm_001_03',
        messageText: '可以，继续创建',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('WECOM_CRM_CREATE_SUCCEEDED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(
      conversationContext?.workMemory.latestEntryInterpretationSnapshot,
    ).toMatchObject({
      scene: 'WECOM_ACTIVE_TASK_REPLY',
      targetWorkflow: 'WECOM_CRM_CREATE_OPPORTUNITY',
      usedFallback: false,
    });
  });

  it('商机创建缺少可识别产品时应继续追问，不得进入确认', async () => {
    const conversationId = 'conv_wecom_opportunity_create_002';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_002_01',
        messageText: '新增商机',
      })
      .expect(202);

    const collectResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_002_02',
        messageText: [
          '项目名称：苏州制造云平台续约',
          '最终客户：苏州制造',
          '线索编号：LEAD-002',
          '关联产品：未知产品',
          '预计有效收入：560000',
          '预计签单日期：2026-05-20',
          '被续签合同号：HT-2025-002',
          '代理商全称：苏州代理商有限公司',
          '项目现状及关键点：客户已经认可续约方案，等待商务审批。',
          '售前：赵工',
        ].join('\n'),
      })
      .expect(202);

    expect(collectResponse.body.status).toBe('WECOM_CRM_CREATE_COLLECTING');
    expect(String(collectResponse.body.crmCreate.title)).toContain('苏州制造云平台续约');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('未知产品');
    expect(lastAssistantTurn?.content).toContain('关联产品');
  });

  it('商机创建最终客户多候选时应支持用宽松序号选择', async () => {
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '苏州纳芯微电子',
      totalCount: 2,
      limit: 5,
      records: [
        {
          id: 'cus_create_multi_001',
          name: '苏州纳芯微电子股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
        {
          id: 'cus_create_multi_002',
          name: '苏州纳芯微电子股份有限公司-上海分公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '分公司客户',
        },
      ],
      summary: '测试客户多候选',
    });

    const conversationId = 'conv_wecom_opportunity_create_customer_candidate_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_customer_candidate_001_01',
        messageText: '新增商机',
      })
      .expect(202);

    const candidateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_customer_candidate_001_02',
        messageText: [
          '项目名称：苏州纳芯微电子续约',
          '最终客户：苏州纳芯微电子',
          '线索编号：LEAD-003',
          '关联产品：云平台标准版',
          '预计有效收入：560000',
          '预计签单日期：2026-05-20',
          '被续签合同号：HT-2025-003',
          '代理商全称：苏州代理商有限公司',
          '项目现状及关键点：客户已经认可续约方案，等待商务审批。',
          '售前：赵工',
        ].join('\n'),
      })
      .expect(202);

    expect(candidateResponse.body.status).toBe('WECOM_CRM_CREATE_COLLECTING');
    const contextAfterCandidate = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurnAfterCandidate = [...(contextAfterCandidate?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurnAfterCandidate?.content).toContain('候选1：苏州纳芯微电子股份有限公司');
    expect(lastAssistantTurnAfterCandidate?.content).toContain('候选2：苏州纳芯微电子股份有限公司-上海分公司');

    const chooseResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_wecom_opportunity_create_customer_candidate_001_03',
        messageText: '一',
      })
      .expect(202);

    expect(chooseResponse.body.status).toBe('WECOM_CRM_CREATE_AWAITING_CONFIRMATION');
    const contextAfterChoose = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurnAfterChoose = [...(contextAfterChoose?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurnAfterChoose?.content).toContain('最终客户：苏州纳芯微电子股份有限公司');
  });

  it('应基于上一轮结果直接生成解释，而不是再次执行查询', async () => {
    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_ai_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_ai_001',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    const explanationResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_ai_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_ai_002',
        messageText: '这说明什么',
      })
      .expect(202);

    expect(firstResponse.body.queryId).toBeTruthy();
    expect(explanationResponse.body.status).toBe('EXPLAINED');
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
    const explainedAudit = appStorageService.state.auditEvents.find(
      (item) => item.eventType === 'AI_RESULT_EXPLAINED',
    );
    expect(explainedAudit).toBeDefined();
    expect(explainedAudit?.sessionSnapshot).toMatchObject({
      entryInterpretationSnapshot: {
        scene: 'WECOM_IDLE_MESSAGE',
        targetWorkflow: 'ANALYSIS_RESULT_EXPLANATION',
      },
      workflowRoutingSnapshot: {
        targetWorkflow: 'ANALYSIS_RESULT_EXPLANATION',
      },
    });
  });

  it('生成日报请求应直接返回日报预览，不进入日报采集链路', async () => {
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_001',
        messageText: '生成日报',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(response.body.deliveryStatus).toBe('SENT');
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.contentPreview.includes('日报预览'),
      ),
    ).toBe(true);
  });

  it('今天日报这类更短说法也应直接返回日报预览', async () => {
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_short_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_short_001',
        messageText: '今天日报',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(response.body.deliveryStatus).toBe('SENT');
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
  });

  it('跟进任务中直接发送“生成日报”时应放弃旧任务并切到日报预览', async () => {
    const conversationId = 'conv_task_switch_followup_to_report_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_task_switch_followup_to_report_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const switchResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_task_switch_followup_to_report_001_02',
        messageText: '生成日报',
      })
      .expect(202);

    expect(switchResponse.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('接下来处理你刚发的新任务');
    expect(lastAssistantTurn?.content).toContain('日报预览');
    expect(lastAssistantTurn?.content).not.toContain('还差一步：请在“跟进内容”里');
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeUndefined();
  });

  it('跟进任务中直接发送小组日报请求且未写今天时，应放弃旧任务并切到当天小组日报预览', async () => {
    const conversationId = 'conv_task_switch_followup_to_team_report_001';
    const businessDate = new Date(Date.now() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const member = crmReadonlyService.listUsers().find(
      (item) => item.id === 'user_sales_director',
    );
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_vp');
    expect(member).toBeDefined();
    expect(actor).toBeDefined();

    jest.spyOn(salesLeaderMappingService, 'listMappedSalesGroups').mockResolvedValue([
      {
        area: '北区金融部',
        region: '北区金融部-王文定',
        leaderName: '王文定',
        leader: {
          ...(actor as NonNullable<typeof actor>),
          id: 'leader_wang',
          name: '王文定',
          supervisorId: 'user_sales_vp',
          supervisorName: '销售副总',
        },
        members: [member as NonNullable<typeof member>],
      },
    ]);

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_team_switch_001',
      sessionId: 'session_team_switch_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_team_switch_001',
      sourceMessageId: 'msg_team_switch_001',
      sourceQueryText: '王文定小组日报预览',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '推进了续约商务条款确认，客户倾向本周内完成审批。',
      structuredHelpNeeded: '需要区域经理协助确认最终折扣底线。',
      structuredInformationShare: '客户对交付周期比价格更敏感。',
      structuredVisitPlan: '明天下午继续约客户采购负责人沟通签约节奏。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：推进了续约商务条款确认，客户倾向本周内完成审批。\n遇到与协助：需要区域经理协助确认最终折扣底线。\n信息共享：客户对交付周期比价格更敏感。\n拜访计划：明天下午继续约客户采购负责人沟通签约节奏。',
      status: 'COMPLETED',
      idempotencyKey: 'team-switch-follow-up-001',
      confirmedWriteIntentAt: `${businessDate}T10:00:00.000Z`,
      confirmedContentAt: `${businessDate}T10:01:00.000Z`,
      writtenAt: `${businessDate}T10:02:00.000Z`,
      externalRevisitLogId: 'revisit_team_switch_001',
      createdAt: `${businessDate}T10:00:00.000Z`,
      updatedAt: `${businessDate}T10:02:00.000Z`,
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_vp',
        messageId: 'msg_task_switch_followup_to_team_report_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const switchResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_vp',
        messageId: 'msg_task_switch_followup_to_team_report_001_02',
        messageText: '把王文定小组日报发给我',
      })
      .expect(202);

    expect(switchResponse.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('接下来处理你刚发的新任务');
    expect(lastAssistantTurn?.content).toContain('王文定小组');
    expect(lastAssistantTurn?.content).toContain('日报预览');
    expect(lastAssistantTurn?.content).not.toContain('还差一步：请在“跟进内容”里');
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeUndefined();
  });

  it('唯一 Opportunity 查询后应生成待写回草稿并询问是否现在写入 CRM', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_follow_up_writeback_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_001',
        messageText: '查苏州制造',
      })
      .expect(202);

    expect(response.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
    expect(response.body.followUpWriteback.objectType).toBe('Opportunity');
    expect(response.body.followUpWriteback.objectId).toBe('opp_002');
    expect(appStorageService.state.pendingFollowUpWritebacks).toHaveLength(1);
    expect(appStorageService.state.pendingFollowUpWritebacks[0].status).toBe('DRAFTED');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].opportunityId).toBe('opp_002');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].draftContent).toContain(
      '销售总监：',
    );
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.receiptId === response.body.receiptId &&
        item.contentPreview.includes('我先根据你的记录识别到这些信息'),
      ),
    ).toBe(true);
  });

  it('跟进写回确认阶段回复“好的”也应进入内容确认', async () => {
    const conversationId = 'conv_follow_up_writeback_affirmative_001';

    const entryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_affirmative_001_01',
        messageText: '查苏州制造',
      })
      .expect(202);

    expect(entryResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_affirmative_001_02',
        messageText: '好的',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe(
      'FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION',
    );
    expect(confirmResponse.body.followUpWriteback.status).toBe(
      'AWAITING_CONTENT_CONFIRMATION',
    );
  });

  it('跟进写回确认阶段的非关键词表达也应按 AI 判断继续执行', async () => {
    const conversationId = 'conv_follow_up_writeback_ai_continue_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockResolvedValue({
      intent: 'CONTINUE_EXECUTION',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_ai_continue_001_01',
        messageText: '查苏州制造',
      })
      .expect(202);

    const continueResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_ai_continue_001_02',
        messageText: '可以，就按这个继续',
      })
      .expect(202);

    expect(continueResponse.body.status).toBe(
      'FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION',
    );
    expect(continueResponse.body.followUpWriteback.status).toBe(
      'AWAITING_CONTENT_CONFIRMATION',
    );
  });

  it('待写回内容确认阶段回复“我改一下”时，应按 AI 判断返回修改提示', async () => {
    const conversationId = 'conv_follow_up_writeback_ai_modify_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockResolvedValue({
      intent: 'MODIFY_CONTENT',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_ai_modify_001_01',
        messageText: '查苏州制造',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_ai_modify_001_02',
        messageText: '确认',
      })
      .expect(202);

    const modifyResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_ai_modify_001_03',
        messageText: '我改一下',
      })
      .expect(202);

    expect(modifyResponse.body.status).toBe(
      'FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION',
    );
    const updatedContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(updatedContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('请直接发送新的跟进内容');
  });

  it('待写回草稿应支持修改后确认写入 CRM，单聊场景下提示暂不支持群共享', async () => {
    const conversationId = 'conv_follow_up_writeback_002';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_002_01',
        messageText: '查苏州制造',
      })
      .expect(202);

    const intentResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_002_02',
        messageText: '确认',
      })
      .expect(202);

    expect(intentResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION');
    expect(intentResponse.body.followUpWriteback.status).toBe(
      'AWAITING_CONTENT_CONFIRMATION',
    );

    const modifyResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_002_03',
        messageText: '今天已完成需求澄清，客户认可当前方案，下周进入商务评审。',
      })
      .expect(202);

    expect(modifyResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION');
    expect(modifyResponse.body.followUpWriteback.draftContent).toContain('销售总监：');
    expect(modifyResponse.body.followUpWriteback.draftContent).toContain('商务评审');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].draftContent).toContain('商务评审');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_002_04',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].status).toBe('COMPLETED');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].externalRevisitLogId).toBeTruthy();
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.receiptId === confirmResponse.body.receiptId &&
        item.contentPreview.includes('CRM'),
      ),
    ).toBe(true);
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.receiptId === confirmResponse.body.receiptId &&
        item.contentPreview.includes('当前会话不是群聊'),
      ),
    ).toBe(false);
    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'FOLLOW_UP_WRITEBACK_SUCCEEDED',
      ),
    ).toBe(true);
  });

  it('群聊写回成功后应询问是否分享到当前群，并在确认后转发', async () => {
    const conversationId = 'group_follow_up_writeback_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_group_follow_up_writeback_001_01',
        chattype: 'group',
        chatid: conversationId,
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '查苏州制造',
        },
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_group_follow_up_writeback_001_02',
        chattype: 'group',
        chatid: conversationId,
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '确认',
        },
      })
      .expect(202);

    const confirmWriteResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_group_follow_up_writeback_001_03',
        chattype: 'group',
        chatid: conversationId,
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '确认',
        },
      })
      .expect(202);

    expect(confirmWriteResponse.body.status).toBe('FOLLOW_UP_SHARE_PENDING_CONFIRMATION');

    const shareResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_group_follow_up_writeback_001_04',
        chattype: 'group',
        chatid: conversationId,
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '确认',
        },
      })
      .expect(202);

    expect(shareResponse.body.status).toBe('FOLLOW_UP_SHARE_SUCCEEDED');
    const shareAudit = appStorageService.state.auditEvents.find(
      (item) => item.eventType === 'FOLLOW_UP_SHARE_SUCCEEDED',
    );
    expect(shareAudit).toBeDefined();
    expect(shareAudit?.sessionSnapshot).toMatchObject({
      entryInterpretationSnapshot: {
        scene: 'WECOM_IDLE_MESSAGE',
      },
      workflowRoutingSnapshot: {
        finalProgram: 'wecom-ai-conversation-orchestration.decideNextAction',
      },
    });
  });

  it('群聊写回成功后应支持取消群共享', async () => {
    const conversationId = 'group_follow_up_writeback_002';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_group_follow_up_writeback_002_01',
        chattype: 'group',
        chatid: conversationId,
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '查苏州制造',
        },
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_group_follow_up_writeback_002_02',
        chattype: 'group',
        chatid: conversationId,
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '确认',
        },
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_group_follow_up_writeback_002_03',
        chattype: 'group',
        chatid: conversationId,
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '确认',
        },
      })
      .expect(202);

    const cancelShareResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_group_follow_up_writeback_002_04',
        chattype: 'group',
        chatid: conversationId,
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '取消',
        },
      })
      .expect(202);

    expect(cancelShareResponse.body.status).toBe('FOLLOW_UP_SHARE_CANCELLED');
    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'FOLLOW_UP_SHARE_CANCELLED',
      ),
    ).toBe(true);
  });

  it('待写回草稿应支持取消，不得写入 CRM', async () => {
    const conversationId = 'conv_follow_up_writeback_003';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_003_01',
        messageText: '查苏州制造',
      })
      .expect(202);

    const cancelResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_003_02',
        messageText: '取消',
      })
      .expect(202);

    expect(cancelResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_CANCELLED');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].status).toBe('CANCELLED');
    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'FOLLOW_UP_WRITEBACK_CANCELLED',
      ),
    ).toBe(true);
  });

  it('跟进写回确认阶段的修改文本包含“日报”字样时不应误切到日报任务', async () => {
    const conversationId = 'conv_follow_up_writeback_no_switch_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_no_switch_001_01',
        messageText: '查苏州制造',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_no_switch_001_02',
        messageText: '确认',
      })
      .expect(202);

    const reviseResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_no_switch_001_03',
        messageText: '改成今天已推进到商务评审，日报里再同步一次。',
      })
      .expect(202);

    expect(reviseResponse.body.status).toBe(
      'FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION',
    );
    expect(reviseResponse.body.followUpWriteback?.draftContent).toContain('日报里再同步一次');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('请确认内容是否正确');
    expect(lastAssistantTurn?.content).not.toContain('主要跟进了哪些项目');
  });

  it('跟进写回失败后应保留草稿并允许修改后再次确认', async () => {
    const conversationId = 'conv_follow_up_writeback_004';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_004_01',
        messageText: '查苏州制造',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_004_02',
        messageText: '确认',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_004_03',
        messageText: '模拟失败：先记录一条失败内容。',
      })
      .expect(202);

    const failedResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_004_04',
        messageText: '确认',
      })
      .expect(202);

    expect(failedResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_FAILED');
    expect(failedResponse.body.followUpWriteback.status).toBe('FAILED');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].status).toBe('FAILED');
    expect(failedResponse.body.followUpWriteback.draftContent).toContain('销售总监：');

    const retryDraftResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_004_05',
        messageText: '今天已推进到商务评审，客户要求下周给最终报价。',
      })
      .expect(202);

    expect(retryDraftResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION');

    const retryConfirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_004_06',
        messageText: '确认',
      })
      .expect(202);

    expect(retryConfirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].status).toBe('COMPLETED');
  });

  it('跟进客户最终确认写回时若用户 CRM token 过期，应自动回退内置账号继续执行', async () => {
    const conversationId = 'conv_follow_up_writeback_expired_token_retry_001';
    const requesterUser = crmReadonlyService
      .listUsers()
      .find((item) => item.id === 'user_sales_director');

    expect(requesterUser).toBeDefined();

    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '海航集团有限公司',
      totalCount: 1,
      limit: 5,
      records: [
        {
          id: 'cus_follow_up_expired_retry_001',
          name: '海航集团有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          category: '战略客户',
        },
      ],
      summary: '唯一命中海航集团有限公司',
    });

    const getCustomerByIdSpy = jest.spyOn(customerLookupService, 'getById');
    getCustomerByIdSpy
      .mockRejectedValueOnce(new UnauthorizedException('您的登录已经过期，请重新登录！'))
      .mockResolvedValueOnce({
        id: 'cus_follow_up_expired_retry_001',
        name: '海航集团有限公司',
        ownerId: 'user_sales_director',
        ownerName: '销售总监',
        category: '战略客户',
      });

    const getAssistUsersByIdSpy = jest
      .spyOn(customerLookupService, 'getAssistUsersById')
      .mockResolvedValue([]);

    appStorageService.state.authSessions.unshift({
      id: 'auth_session_follow_up_writeback_expired_retry_001',
      requesterId: 'user_sales_director',
      source: 'wecom-scan',
      sessionStatus: 'ACTIVE',
      crmCorpId: 'corp_mock',
      crmAccessToken: 'expired-user-token',
      userSnapshot: requesterUser as NonNullable<typeof requesterUser>,
      lastAccessAt: '2026-04-17T08:40:00.000Z',
      expiresAt: '2026-04-18T08:40:00.000Z',
      createdAt: '2026-04-17T08:40:00.000Z',
      updatedAt: '2026-04-17T08:40:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_expired_token_retry_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const draftedResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_expired_token_retry_001_02',
        messageText: [
          '跟进内容：今天拜访了海航集团有限公司，确认续签范围与预算口径。',
          '遇到与协助：无',
          '信息共享：无',
          '拜访计划：下周继续推进商务评审。',
        ].join('\n'),
      })
      .expect(202);

    expect(draftedResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_expired_token_retry_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(getCustomerByIdSpy).toHaveBeenCalledTimes(2);
    expect(getCustomerByIdSpy.mock.calls[0]?.[2]?.accessToken).toBe('expired-user-token');
    expect(getCustomerByIdSpy.mock.calls[1]?.[2]?.accessToken).not.toBe(
      'expired-user-token',
    );
    expect(
      getAssistUsersByIdSpy.mock.calls.some(
        (call) => call[2]?.accessToken && call[2].accessToken !== 'expired-user-token',
      ),
    ).toBe(true);
    expect(appStorageService.state.pendingFollowUpWritebacks[0].status).toBe('COMPLETED');
  });

  it('未命中唯一 Opportunity 时不应生成待写回草稿', async () => {
    const pendingBefore = appStorageService.state.pendingFollowUpWritebacks.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_follow_up_writeback_005',
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_writeback_005_01',
        messageText: '查年度样本',
      })
      .expect(202);

    expect(response.body.status).toBe('OPPORTUNITY_LOOKUP_RETURNED');
    expect(appStorageService.state.pendingFollowUpWritebacks.length).toBe(pendingBefore);
  });

  it('直接查商机详情且多命中时，应退回列表而不是默认选第一项', async () => {
    jest.spyOn(aiGatewayService, 'classifyWecomIdleConversationIntent').mockResolvedValue({
      intent: 'ENTITY_LOOKUP',
      entityLookupAction: 'DETAIL',
      entityType: 'Opportunity',
      queryText: '安恒信息详情',
      confidence: 'HIGH',
      referenceTarget: 'NONE',
    } as never);
    jest.spyOn(opportunityLookupService, 'lookupByCompanyName').mockResolvedValue({
      companyName: '安恒信息',
      customFieldName: 'title',
      totalCount: 2,
      limit: 10,
      matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
      records: [
        {
          id: 'opp_anheng_001',
          title: '安恒信息-AH001',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 100000,
          stage: '方案',
          createdAt: '2026-04-01T10:00:00.000Z',
        },
        {
          id: 'opp_anheng_002',
          title: '安恒信息-AH002',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 150000,
          stage: '谈判',
          createdAt: '2026-04-02T10:00:00.000Z',
        },
      ],
      summary: '命中 2 条安恒信息商机',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_entity_lookup_opp_detail_multi_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_entity_lookup_opp_detail_multi_001',
        messageText: '安恒信息这个商机详情',
      })
      .expect(202);

    expect(response.body.status).toBe('ENTITY_LOOKUP_LIST_RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === 'conv_entity_lookup_opp_detail_multi_001',
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('先给你前 2 条');
    expect(lastAssistantTurn?.content).toContain('候选2：安恒信息-AH002');
  });

  it('客户列表返回后，回复第2个详情应读取上一轮列表并返回详情', async () => {
    const classificationSpy = jest
      .spyOn(aiGatewayService, 'classifyWecomIdleConversationIntent')
      .mockResolvedValueOnce({
        intent: 'ENTITY_LOOKUP',
        entityLookupAction: 'LIST',
        entityType: 'Customer',
        queryText: '中国银行客户列表',
        confidence: 'HIGH',
        referenceTarget: 'NONE',
      } as never)
      .mockResolvedValueOnce({
        intent: 'ENTITY_LOOKUP',
        entityLookupAction: 'SELECT_FROM_LAST_LIST',
        entityType: 'Customer',
        selectionIndex: 2,
        referenceTarget: 'LAST_LIST',
        confidence: 'HIGH',
      } as never);
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '中国银行',
      totalCount: 2,
      limit: 10,
      records: [
        {
          id: 'cus_bank_001',
          name: '中国银行股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          category: '战略客户',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          createdAt: '2026-04-01T10:00:00.000Z',
        },
        {
          id: 'cus_bank_002',
          name: '中国银行股份有限公司江西省分行',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          category: '分行客户',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          createdAt: '2026-04-02T10:00:00.000Z',
        },
      ],
      summary: '命中 2 条客户',
    });
    jest.spyOn(customerLookupService, 'getById').mockImplementation(async (_user, id) => {
      if (id === 'cus_bank_002') {
        return {
          id: 'cus_bank_002',
          name: '中国银行股份有限公司江西省分行',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          category: '分行客户',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          createdAt: '2026-04-02T10:00:00.000Z',
        };
      }
      return undefined;
    });

    const conversationId = 'conv_entity_lookup_customer_list_then_detail_001';
    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_entity_lookup_customer_list_001',
        messageText: '查中国银行客户列表',
      })
      .expect(202);

    expect(firstResponse.body.status).toBe('ENTITY_LOOKUP_LIST_RETURNED');

    const detailResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_entity_lookup_customer_detail_001',
        messageText: '看第2个详情',
      })
      .expect(202);

    expect(detailResponse.body.status).toBe('ENTITY_LOOKUP_DETAIL_RETURNED');
    expect(classificationSpy).toHaveBeenCalledTimes(2);
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('客户详情：中国银行股份有限公司江西省分行');
  });

  it('列表与详情只读查询在无用户 CRM 会话时不应回退写回内置账号', async () => {
    const conversationId = 'conv_entity_lookup_builtin_token_retry_001';
    appStorageService.state.authSessions = appStorageService.state.authSessions.filter(
      (item) => item.requesterId !== 'user_sales_director',
    );

    const builtinTokenSpy = jest.spyOn(
      crmBuiltinAccountTokenService,
      'getBuiltinWriteAccessToken',
    );
    jest.spyOn(aiGatewayService, 'classifyWecomIdleConversationIntent').mockResolvedValue({
      intent: 'ENTITY_LOOKUP',
      entityLookupAction: 'LIST',
      entityType: 'Customer',
      queryText: '中国银行客户列表',
      confidence: 'HIGH',
      referenceTarget: 'NONE',
    } as never);
    const lookupByNameSpy = jest.spyOn(customerLookupService, 'lookupByName');
    lookupByNameSpy
      .mockRejectedValueOnce(new UnauthorizedException('CRM access token 已失效，请重新登录。'))
      .mockResolvedValueOnce({
        customerName: '中国银行',
        totalCount: 2,
        limit: 10,
        records: [
          {
            id: 'cus_bank_retry_001',
            name: '中国银行股份有限公司',
            ownerId: 'user_sales_director',
            ownerName: '销售总监',
            category: '战略客户',
          },
          {
            id: 'cus_bank_retry_002',
            name: '中国银行股份有限公司江西省分行',
            ownerId: 'user_sales_director',
            ownerName: '销售总监',
            category: '分行客户',
          },
        ],
        summary: '命中 2 条客户',
      });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_entity_lookup_builtin_token_retry_001_01',
        messageText: '查中国银行客户列表',
      })
      .expect(401);

    expect(response.body.message).toContain('只读查询不会使用企业微信写回内置账号');
    expect(lookupByNameSpy).toHaveBeenCalledTimes(1);
    expect(builtinTokenSpy).not.toHaveBeenCalled();
  });

  it('日报自由文本应自动拆分并匹配后台主数据', async () => {
    const conversationId = 'conv_daily_report_002';
    const senderId = 'wx_sales_director';
    const dailyReportCountBefore = appStorageService.state.dailyReports.length;

    const inputResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_002_01',
        messageText:
          '帮我写今天的跟进：上午10:00 拜访了“苏州制造”项目，推进 SaaS 续签，对方认可；希望折扣降低5%，需要申请折扣审批。',
      })
      .expect(202);

    expect(inputResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(appStorageService.state.dailyReports.length).toBe(dailyReportCountBefore);
    const conversationContextAfterInput = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurnAfterInput = [...(conversationContextAfterInput?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurnAfterInput?.content).toContain(
      '回复“确认”后我会直接写入 CRM 跟进记录',
    );
    expect(lastAssistantTurnAfterInput?.content).toContain('需要申请折扣');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_002_02',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(appStorageService.state.dailyReports.length).toBe(dailyReportCountBefore);
    expect(appStorageService.state.pendingFollowUpWritebacks[0]?.status).toBe(
      'COMPLETED',
    );
  });

  it('日报自由文本应在查不到公司时提示修改并允许再次查询', async () => {
    const conversationId = 'conv_daily_report_002_retry';
    const senderId = 'wx_sales_director';

    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_002_retry_01',
        messageText:
          '帮我写今天的跟进：上午拜访了“未知公司”项目，推进 SaaS 续签，需要申请折扣审批。',
      })
      .expect(202);

    expect(firstResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.contentPreview.includes('我还没有从这段记录里识别出明确的项目或客户名称') ||
        item.contentPreview.includes('回复“确认”后我会直接写入 CRM 跟进记录'),
      ),
    ).toBe(true);

    const retryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_002_retry_02',
        messageText: '改成苏州制造',
      })
      .expect(202);

    expect(retryResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.contentPreview.includes('回复“确认”后我会直接写入 CRM 跟进记录'),
      ),
    ).toBe(true);

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_002_retry_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(appStorageService.state.pendingFollowUpWritebacks[0]?.status).toBe(
      'COMPLETED',
    );
  });

  it('日报确认后如果只命中客户，应在首次确认后直接写入 Customer 跟进', async () => {
    const conversationId = 'conv_daily_report_customer_writeback_001';
    const senderId = 'wx_sales_director';

    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_writeback_001_01',
        messageText:
          '帮我写今天的跟进，并写入CRM跟进记录：上午拜访了“联软科技集团”，继续推进年度合作方案。',
      })
      .expect(202);

    expect(firstResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.receiptId === firstResponse.body.receiptId &&
        item.contentPreview.includes('客户：联软科技集团'),
      ),
    ).toBe(true);

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_writeback_001_02',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(appStorageService.state.pendingFollowUpWritebacks[0]?.objectType).toBe(
      'Customer',
    );
    expect(appStorageService.state.pendingFollowUpWritebacks[0]?.objectTitle).toBe(
      '联软科技集团',
    );
    expect(appStorageService.state.pendingFollowUpWritebacks[0]?.status).toBe(
      'COMPLETED',
    );
  });

  it('模板跟进里客户名未加引号时，应按裁剪后的客户名查询 CRM', async () => {
    const lookupSpy = jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '海航集团有限公司',
      totalCount: 1,
      limit: 5,
      records: [
        {
          id: 'cus_hainan_001',
          name: '海航集团有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
      ],
      summary: '唯一命中海航集团有限公司',
    });
    const conversationId = 'conv_follow_up_template_unquoted_customer_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_unquoted_customer_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const templateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_unquoted_customer_001_02',
        messageText: [
          '跟进内容：今天拜访了海航集团有限公司，简单聊聊。',
          '遇到与协助：无',
          '信息共享：有太多要分享了',
          '拜访计划：明天继续拜访海航集团有限公司。',
        ].join('\n'),
      })
      .expect(202);

    expect(templateResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');

    const conversationContextAfterTemplateFill =
      appStorageService.state.wecomConversationContexts.find(
        (item) => item.externalConversationId === conversationId,
      );
    const assistantTurnAfterTemplateFill = [
      ...(conversationContextAfterTemplateFill?.turns ?? []),
    ]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(assistantTurnAfterTemplateFill?.content).toContain('客户：海航集团有限公司');
    expect(assistantTurnAfterTemplateFill?.content).not.toContain(
      '客户：今天拜访了海航集团有限公司',
    );

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_unquoted_customer_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(lookupSpy.mock.calls.map((call) => call[1])).toContain('海航集团有限公司');
    expect(lookupSpy.mock.calls.map((call) => call[1])).not.toContain(
      '今天拜访了海航集团有限公司',
    );

    const latestWriteback = [...appStorageService.state.pendingFollowUpWritebacks]
      .reverse()
      .find((item) => item.sessionId === confirmResponse.body.sessionId);
    expect(latestWriteback?.objectType).toBe('Customer');
    expect(latestWriteback?.objectTitle).toBe('海航集团有限公司');
  });

  it('实体识别确认阶段回复“是的”也应继续写入 CRM 跟进', async () => {
    const lookupSpy = jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '海航集团有限公司',
      totalCount: 1,
      limit: 5,
      records: [
        {
          id: 'cus_hainan_affirm_001',
          name: '海航集团有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
      ],
      summary: '唯一命中海航集团有限公司',
    });
    const conversationId = 'conv_follow_up_template_affirmative_confirm_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_affirmative_confirm_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_affirmative_confirm_001_02',
        messageText: [
          '跟进内容：今天拜访了海航集团有限公司，简单聊聊。',
          '遇到与协助：无',
          '信息共享：无',
          '拜访计划：明天继续拜访海航集团有限公司。',
        ].join('\n'),
      })
      .expect(202);

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_affirmative_confirm_001_03',
        messageText: '是的',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(lookupSpy.mock.calls.map((call) => call[1])).toContain('海航集团有限公司');
  });

  it('日报确认多个对象且均唯一命中后，应在首次确认时直接批量写入 CRM 跟进记录', async () => {
    const conversationId = 'conv_daily_report_multi_entity_writeback_001';
    const senderId = 'wx_sales_director';
    const dailyReportCountBefore = appStorageService.state.dailyReports.length;
    const writebackCountBefore = appStorageService.state.pendingFollowUpWritebacks.length;

    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_multi_entity_writeback_001_01',
        messageText:
          '帮我写今天的跟进，并写入CRM跟进记录：上午10:00 跟进了“苏州制造升级”项目，沟通需求细节；下午14:00 拜访了“联软科技集团”，继续推进年度合作方案。',
      })
      .expect(202);

    expect(firstResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const confirmLookupResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_multi_entity_writeback_001_02',
        messageText: '确认',
      })
      .expect(202);

    const contextAfterLookup = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lookupAssistantTurn = [...(contextAfterLookup?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(confirmLookupResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(lookupAssistantTurn?.content).toContain('已将以下跟进记录写入 CRM：');
    expect(lookupAssistantTurn?.content).toContain('项目「苏州制造升级」已写入 CRM');
    expect(lookupAssistantTurn?.content).toContain('客户「联软科技集团」已写入 CRM');
    expect(appStorageService.state.dailyReports).toHaveLength(dailyReportCountBefore);
    expect(appStorageService.state.pendingFollowUpWritebacks.length).toBe(
      writebackCountBefore + 2,
    );
    expect(
      appStorageService.state.pendingFollowUpWritebacks
        .slice(0, 2)
        .every((item) => item.status === 'COMPLETED'),
    ).toBe(true);
  });

  it('客户存在多个候选时，应明确提示回复候选中的完整客户名称', async () => {
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '苏州纳芯微电子股份有限公司',
      totalCount: 2,
      limit: 5,
      records: [
        {
          id: 'cus_multi_001',
          name: '苏州纳芯微电子股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
        {
          id: 'cus_multi_002',
          name: '苏州纳芯微电子股份有限公司-上海分公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '分公司客户',
        },
      ],
      summary: '测试客户多候选',
    });

    const conversationId = 'conv_daily_report_customer_multi_candidate_001';
    const senderId = 'wx_sales_director';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_001_01',
        messageText:
          '帮我写今天的跟进，并写入CRM跟进记录：上午10:00 跟进了“苏州制造升级”项目，沟通需求细节；下午14:00 去了一下“苏州纳芯微电子股份有限公司”，交谈了一下。',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_001_02',
        messageText: '确认',
      })
      .expect(202);

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('客户「苏州纳芯微电子股份有限公司」信息较模糊，找到 2 条客户候选');
    expect(lastAssistantTurn?.content).toContain('候选1：苏州纳芯微电子股份有限公司');
    expect(lastAssistantTurn?.content).toContain('候选2：苏州纳芯微电子股份有限公司-上海分公司');
    expect(lastAssistantTurn?.content).toContain('请直接回复候选序号或更准确的名称');
    expect(
      appStorageService.state.auditEvents.some(
        (item) =>
          item.eventType === 'WECOM_CANDIDATE_RERANKED' &&
          item.sessionSnapshot?.candidateRerankSnapshot &&
          item.sessionSnapshot?.entryInterpretationSnapshot &&
          (item.sessionSnapshot.candidateRerankSnapshot as Record<string, unknown>)
            .fallbackReason === 'ai-unavailable-or-invalid',
      ),
    ).toBe(true);

    const chooseCandidateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_001_03',
        messageText: '候选2',
      })
      .expect(202);

    const conversationContextAfterChoose = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const assistantTurnAfterChoose = [...(conversationContextAfterChoose?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(chooseCandidateResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(assistantTurnAfterChoose?.content).toContain('客户：苏州纳芯微电子股份有限公司-上海分公司');
  });

  it('候选重排在 AI 可用时应优先采用 AI 结果', async () => {
    const conversationId = 'conv_daily_report_customer_ai_rerank_001';
    const senderId = 'wx_sales_director';
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '苏州纳芯微电子股份有限公司',
      totalCount: 2,
      limit: 5,
      records: [
        {
          id: 'cus_multi_ai_001',
          name: '苏州纳芯微电子股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
        {
          id: 'cus_multi_ai_002',
          name: '苏州纳芯微电子股份有限公司-上海分公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '分公司客户',
        },
      ],
      summary: '测试客户多候选 AI 重排',
    });
    const aiRerankSpy = jest.spyOn(
      aiGatewayService as unknown as {
        rerankWecomCandidates: (params: {
          queryText: string;
          candidates: Array<{
            id?: string;
            name: string;
            details?: Array<string | undefined>;
          }>;
        }) => Promise<Record<string, unknown> | null>;
      },
      'rerankWecomCandidates',
    );
    aiRerankSpy.mockResolvedValue({
      candidates: [
        {
          id: 'cus_multi_ai_002',
          name: '苏州纳芯微电子股份有限公司-上海分公司',
          confidence: 'HIGH',
          recommendationReason: '用户当前上下文与上海分公司更匹配。',
        },
        {
          id: 'cus_multi_ai_001',
          name: '苏州纳芯微电子股份有限公司',
          confidence: 'MEDIUM',
          recommendationReason: '主公司仍存在部分匹配。',
        },
      ],
      recommendedCandidate: {
        id: 'cus_multi_ai_002',
        name: '苏州纳芯微电子股份有限公司-上海分公司',
        confidence: 'HIGH',
        recommendationReason: '用户当前上下文与上海分公司更匹配。',
      },
      auditSnapshot: {
        boundary: 'RECALLED_CANDIDATES_ONLY',
        source: 'ai-rerank',
        inputCandidateCount: 2,
        recommendedCandidateId: 'cus_multi_ai_002',
        recommendedCandidateName: '苏州纳芯微电子股份有限公司-上海分公司',
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_ai_rerank_001_01',
        messageText:
          '帮我写今天的跟进，并写入CRM跟进记录：上午10:00 跟进了“苏州制造升级”项目，沟通需求细节；下午14:00 去了一下“苏州纳芯微电子股份有限公司”，交谈了一下。',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_ai_rerank_001_02',
        messageText: '确认',
      })
      .expect(202);

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain(
      '候选1：苏州纳芯微电子股份有限公司-上海分公司',
    );
    expect(lastAssistantTurn?.content).toContain(
      '候选2：苏州纳芯微电子股份有限公司',
    );
    expect(
      appStorageService.state.auditEvents.some(
        (item) => {
          const rerankSnapshot = item.sessionSnapshot
            ?.candidateRerankSnapshot as Record<string, unknown> | undefined;
          return (
            item.eventType === 'WECOM_CANDIDATE_RERANKED' &&
            rerankSnapshot?.source === 'ai-rerank'
          );
        },
      ),
    ).toBe(true);
  });

  it('客户多候选时应支持用中文序号选择候选', async () => {
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '苏州纳芯微电子股份有限公司',
      totalCount: 2,
      limit: 5,
      records: [
        {
          id: 'cus_multi_cn_001',
          name: '苏州纳芯微电子股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
        {
          id: 'cus_multi_cn_002',
          name: '苏州纳芯微电子股份有限公司-上海分公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '分公司客户',
        },
      ],
      summary: '测试客户多候选',
    });

    const conversationId = 'conv_daily_report_customer_multi_candidate_cn_001';
    const senderId = 'wx_sales_director';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_cn_001_01',
        messageText:
          '帮我写今天的跟进，并写入CRM跟进记录：下午去了一下“苏州纳芯微电子股份有限公司”，交谈了一下。',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_cn_001_02',
        messageText: '确认',
      })
      .expect(202);

    const chooseCandidateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_cn_001_03',
        messageText: '一',
      })
      .expect(202);

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(chooseCandidateResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(lastAssistantTurn?.content).toContain('客户：苏州纳芯微电子股份有限公司');
  });

  it('客户多候选时回复超出范围的序号应提示重新选择', async () => {
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '苏州纳芯微电子股份有限公司',
      totalCount: 2,
      limit: 5,
      records: [
        {
          id: 'cus_multi_invalid_001',
          name: '苏州纳芯微电子股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
        {
          id: 'cus_multi_invalid_002',
          name: '苏州纳芯微电子股份有限公司-上海分公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '分公司客户',
        },
      ],
      summary: '测试客户多候选',
    });

    const conversationId = 'conv_daily_report_customer_multi_candidate_invalid_001';
    const senderId = 'wx_sales_director';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_invalid_001_01',
        messageText:
          '帮我写今天的跟进，并写入CRM跟进记录：下午去了一下“苏州纳芯微电子股份有限公司”，交谈了一下。',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_invalid_001_02',
        messageText: '确认',
      })
      .expect(202);

    const invalidReplyResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_customer_multi_candidate_invalid_001_03',
        messageText: '3',
      })
      .expect(202);

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(invalidReplyResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(lastAssistantTurn?.content).toContain('没有识别到有效候选');
    expect(lastAssistantTurn?.content).toContain('候选1：苏州纳芯微电子股份有限公司');
  });

  it('日报确认摘要中的客户/商机跟进应支持多条记录逐条展示', async () => {
    const intake = app.get(WecomDailyReportIntakeService);
    const summary = intake.inspect(
      '上午10:00 拜访了“苏州纳芯微电子股份有限公司”，推进了SaaS项目。下午14:00 去了一下“佛山电器照明股份”，继续跟进客户。',
    );

    expect(summary.confirmationSummaryLines.some((item) => item.includes('1）'))).toBe(true);
    expect(summary.confirmationSummaryLines.some((item) => item.includes('2）'))).toBe(true);
    expect(summary.confirmationSummaryLines.some((item) => item.includes('苏州纳芯微电子股份有限公司'))).toBe(true);
    expect(summary.confirmationSummaryLines.some((item) => item.includes('佛山电器照明股份'))).toBe(true);
  });

  it('公司名不应同时被识别为项目和客户', async () => {
    const intake = app.get(WecomDailyReportIntakeService);
    const summary = intake.inspect(
      '1.上午10:00 拜访了“苏州纳芯微电子股份有限公司”。2.下午14:00 去了一下“佛山电器照明股份”。',
    );

    expect(summary.companyCandidates).toEqual(
      expect.arrayContaining(['苏州纳芯微电子股份有限公司', '佛山电器照明股份']),
    );
    expect(summary.projectCandidates).toEqual([]);
  });

  it('带项目后缀的名称应优先识别为项目，不应误归到客户', async () => {
    const intake = app.get(WecomDailyReportIntakeService);
    const summary = intake.inspect(
      '跟进了“海南-海航-NSPM项目”的这个客户，预计下周二POC，售前A配合测试。',
    );

    expect(summary.projectCandidates).toContain('海南-海航-NSPM项目');
    expect(summary.companyCandidates).not.toContain('海南-海航-NSPM项目');
  });

  it('只有明确主题入口才进入今天跟进任务', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_theme_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_theme_001',
        messageText: '帮我写今天的跟进',
      })
      .expect(202);

    expect(['DAILY_REPORT_COLLECTED', 'DAILY_REPORT_AWAITING_CONFIRMATION', 'DAILY_REPORT_PROMPTED']).toContain(
      response.body.status,
    );
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.contentPreview.includes('本次跟进由我来统一整理'),
      ),
    ).toBe(true);
  });

  it('更短的今日跟进说法也应进入今天跟进任务', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_theme_short_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_theme_short_001',
        messageText: '跟进今日商机',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.receiptId === response.body.receiptId &&
        item.contentPreview.includes('本次跟进由我来统一整理'),
      ),
    ).toBe(true);
  });

  it('主题入口型首轮提示后应保留跟进模板状态，下一条自由文本不得误掉回分析链路', async () => {
    const conversationId = 'conv_follow_up_theme_entry_stateful_001';
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    const themeEntryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_theme_entry_stateful_001_01',
        messageText: '帮我写今日跟进',
      })
      .expect(202);

    expect(themeEntryResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    let conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(conversationContext?.workMemory.dailyReportFlowStatus).toBe('COLLECTING');
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeTruthy();

    const followUpResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_theme_entry_stateful_001_02',
        messageText:
          '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    expect(followUpResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
    conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('跟进内容');
  });

  it('空闲状态下的明显跟进叙述应直接进入跟进草稿整理，不得误走问数分析', async () => {
    const conversationId = 'conv_follow_up_idle_freeform_001';
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_idle_freeform_001_01',
        messageText:
          '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeTruthy();
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('跟进内容');
  });

  it('带前缀的“今日跟进：...”也应进入今天跟进任务', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_theme_prefixed_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_theme_prefixed_001',
        messageText: '今日跟进：去了下项目现场',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PROMPTED');
  });

  it('主题入口追问后，下一条自由跟进口述应先补齐模板剩余字段，不得掉回分析补问', async () => {
    const conversationId = 'conv_daily_report_theme_followup_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_theme_followup_001_01',
        messageText: '写今日跟进',
      })
      .expect(202);

    const followUpResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_theme_followup_001_02',
        messageText:
          '跟进了“海南-海航-NSPM项目”的这个客户，可能有多个项目要持续跟进，客户规模5000点，目前明确准入项目，预计下周二POC，售前A配合测试',
      })
      .expect(202);

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(followUpResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(lastAssistantTurn?.content).toContain('我先帮你整理到这里');
    expect(lastAssistantTurn?.content).toContain('跟进内容：');
    expect(lastAssistantTurn?.content).toContain('遇到与协助');
    expect(lastAssistantTurn?.content).toContain('信息共享');
    expect(lastAssistantTurn?.content).toContain('拜访计划');
  });

  it('跟进模板缺少非必填字段时应允许自然语言直接提交当前草稿', async () => {
    const conversationId = 'conv_follow_up_template_direct_submit_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_direct_submit_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const draftResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_direct_submit_001_02',
        messageText: '今天拜访了山东农信续约项目，客户倾向本周内完成审批。',
      })
      .expect(202);

    expect(draftResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const draftContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const draftAssistantTurn = [...(draftContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(
      draftAssistantTurn?.content,
    ).toContain('也可以直接提交');
    expect(
      appStorageService.state.auditEvents.some(
        (item) =>
          item.eventType === 'WECOM_AI_DRAFT_STRUCTURED' &&
          item.sessionSnapshot?.structuredDraftSnapshot &&
          item.sessionSnapshot?.source === 'rule-fallback-structured-draft' &&
          item.sessionSnapshot?.fallbackReason === 'ai-unavailable-or-invalid',
      ),
    ).toBe(true);

    const directSubmitResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_direct_submit_001_03',
        messageText: '直接提交',
      })
      .expect(202);

    expect(directSubmitResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const updatedContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const directSubmitAssistantTurn = [...(updatedContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(directSubmitAssistantTurn?.content).toContain(
      '我会继续帮你整理成 CRM 跟进',
    );
    expect(directSubmitAssistantTurn?.content).not.toContain('也可以直接提交');
    expect(updatedContext?.workMemory.followUpTemplateDraft?.directSubmitSource).toBe(
      'NATURAL_LANGUAGE',
    );
  });

  it('跟进模板缺少非必填字段时，点击“提交”也应按直接提交处理，不得把提交当成候选名称', async () => {
    const conversationId = 'conv_follow_up_template_submit_button_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_submit_button_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_submit_button_001_02',
        messageText: '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    const submitResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_submit_button_001_03',
        messageText: '提交',
      })
      .expect(202);

    expect(submitResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const updatedContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(updatedContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).not.toContain('项目「提交」');
    expect(lastAssistantTurn?.content).not.toContain('客户「提交」');
    expect(updatedContext?.workMemory.followUpTemplateDraft?.directSubmitSource).toBe(
      'NATURAL_LANGUAGE',
    );
  });

  it('跟进模板缺少非必填字段时，回复“可以”也应按当前草稿确认，不得把可以当成候选名称', async () => {
    const conversationId = 'conv_follow_up_template_affirm_direct_submit_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_affirm_direct_submit_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_affirm_direct_submit_001_02',
        messageText: '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_affirm_direct_submit_001_03',
        messageText: '可以',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const updatedContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(updatedContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).not.toContain('项目「可以」');
    expect(lastAssistantTurn?.content).not.toContain('客户「可以」');
    expect(updatedContext?.workMemory.followUpTemplateDraft?.directSubmitSource).toBe(
      'NATURAL_LANGUAGE',
    );
  });

  it('跟进模板缺少非必填字段时，AI 超时后回复“可以，提交把”也应按直接提交处理', async () => {
    const conversationId = 'conv_follow_up_template_submit_variant_001';
    jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    ).mockResolvedValue(null);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_submit_variant_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_submit_variant_001_02',
        messageText: '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    const submitResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_submit_variant_001_03',
        messageText: '可以，提交把',
      })
      .expect(202);

    expect(submitResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const updatedContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(updatedContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).not.toContain('项目「可以」');
    expect(lastAssistantTurn?.content).not.toContain('客户「可以」');
  });

  it('跟进模板缺少非必填字段时，非关键词表达也应按 AI 判断为直接提交', async () => {
    const conversationId = 'conv_follow_up_template_ai_direct_submit_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy.mockResolvedValue({
      intent: 'DIRECT_SUBMIT',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_direct_submit_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_direct_submit_001_02',
        messageText: '今天拜访了山东农信续约项目，客户倾向本周内完成审批。',
      })
      .expect(202);

    const directSubmitResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_direct_submit_001_03',
        messageText: '先按现在这个走吧',
      })
      .expect(202);

    expect(directSubmitResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const updatedContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(updatedContext?.workMemory.followUpTemplateDraft?.directSubmitSource).toBe(
      'NATURAL_LANGUAGE',
    );
  });

  it('跟进模板缺少非必填字段时，回复“不补充”不应结束流程，而应按当前草稿继续', async () => {
    const conversationId = 'conv_follow_up_template_skip_optional_001';
    const replyIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyWecomTaskReplyIntent: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'classifyWecomTaskReplyIntent',
    );
    replyIntentSpy
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        intent: 'TASK_CANCEL',
        packCode: 'wecom-active-task-reply-pack',
        packVersion: 'test-fixture',
      });
    jest.spyOn(opportunityLookupService, 'lookupByCompanyName').mockResolvedValue({
      companyName: '安恒信息',
      customFieldName: 'title',
      totalCount: 1,
      limit: 5,
      matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
      records: [
        {
          id: 'opp_skip_optional_001',
          title: '安恒信息-AH202603124',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 2233429,
          stage: '商务洽谈',
          createdAt: '2026-03-01T08:00:00.000Z',
        },
      ],
      summary: '唯一命中安恒信息项目',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_skip_optional_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_skip_optional_001_02',
        messageText:
          '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    const continueResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_skip_optional_001_03',
        messageText: '不补充',
      })
      .expect(202);

    expect(continueResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
    const updatedContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(updatedContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('需要现在写入吗');
    expect(lastAssistantTurn?.content).not.toContain('当前跟进整理我先帮你结束');
    expect(updatedContext?.workMemory.followUpTemplateDraft).toBeUndefined();
    expect(updatedContext?.workMemory.activeFollowUpWritebackId).toBeTruthy();
  });

  it('自由文本同时包含进展、问题和计划时，展示草稿不应出现跟进内容与拜访计划重复', async () => {
    const conversationId = 'conv_follow_up_template_semantic_split_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_semantic_split_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const draftResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_semantic_split_001_02',
        messageText:
          '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    expect(draftResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain(
      '跟进内容：今天跟进了安恒信息；尬聊了一天；无进度更新',
    );
    expect(lastAssistantTurn?.content).toContain('遇到与协助：客户不好沟通；推进缓慢');
    expect(lastAssistantTurn?.content).toContain('拜访计划：明天继续跟进');
    expect(lastAssistantTurn?.content).not.toContain(
      '拜访计划：今天跟进了安恒信息',
    );
  });

  it('自由文本四段草稿在 AI 可用时应优先采用 AI 结构化结果', async () => {
    const conversationId = 'conv_follow_up_template_ai_first_001';
    const aiDraftSpy = jest.spyOn(
      aiGatewayService as unknown as {
        parseWecomFollowUpStructuredDraft: (params: {
          requesterName: string;
          messageText?: string;
        }) => Promise<Record<string, unknown> | null>;
      },
      'parseWecomFollowUpStructuredDraft',
    );
    aiDraftSpy.mockResolvedValue({
      requesterName: '销售总监',
      followUpContent: '今天拜访了安恒信息，已确认续签方案范围。',
      helpNeeded: '需要区域经理确认折扣底线。',
      informationShare: '',
      visitPlan: '明天下午继续确认 POC 时间。',
      missingLabels: ['信息共享'],
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_first_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const draftResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_first_001_02',
        messageText:
          '今天拜访了安恒信息，客户认可续签方向，但需要确认折扣底线，明天下午继续确认 POC 时间。',
      })
      .expect(202);

    expect(draftResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain(
      '跟进内容：今天拜访了安恒信息，已确认续签方案范围。',
    );
    expect(lastAssistantTurn?.content).toContain(
      '遇到与协助：需要区域经理确认折扣底线。',
    );
    expect(lastAssistantTurn?.content).toContain(
      '拜访计划：明天下午继续确认 POC 时间。',
    );
    expect(lastAssistantTurn?.content).toContain('也可以直接提交');
    expect(
      appStorageService.state.auditEvents.some(
        (item) =>
          item.eventType === 'WECOM_AI_DRAFT_STRUCTURED' &&
          item.sessionSnapshot?.source === 'ai-structured-draft',
      ),
    ).toBe(true);
  });

  it('AI 四段草稿在候选确认后仍应保留四段式，而不是退回单段摘要', async () => {
    const conversationId = 'conv_follow_up_template_ai_candidate_keep_sections_001';
    const aiDraftSpy = jest.spyOn(
      aiGatewayService as unknown as {
        parseWecomFollowUpStructuredDraft: (params: {
          requesterName: string;
          messageText?: string;
        }) => Promise<Record<string, unknown> | null>;
      },
      'parseWecomFollowUpStructuredDraft',
    );
    aiDraftSpy.mockResolvedValue({
      requesterName: '销售总监',
      followUpContent: '今天跟进了安恒信息，尬聊了一天，无进度更新。',
      helpNeeded: '客户不好沟通，推进缓慢。',
      informationShare: '暂无信息共享。',
      visitPlan: '明天继续跟进。',
    });
    jest.spyOn(opportunityLookupService, 'lookupByCompanyName').mockResolvedValue({
      companyName: '安恒信息',
      customFieldName: 'title',
      totalCount: 3,
      limit: 5,
      matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
      records: [
        {
          id: 'opp_anheng_001',
          title: '安恒信息-AH202603124',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 2233429,
          stage: '商务洽谈',
          createdAt: '2026-03-01T08:00:00.000Z',
        },
        {
          id: 'opp_anheng_002',
          title: '安恒信息-AH202603082',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 2223429,
          stage: '商务洽谈',
          createdAt: '2026-03-02T08:00:00.000Z',
        },
        {
          id: 'opp_anheng_003',
          title: '安恒信息-AH202603078',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 2223429,
          stage: '商务洽谈',
          createdAt: '2026-03-03T08:00:00.000Z',
        },
      ],
      summary: '命中多个安恒信息项目',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_candidate_keep_sections_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_candidate_keep_sections_001_02',
        messageText:
          '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    const chooseCandidateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_candidate_keep_sections_001_03',
        messageText: '3',
      })
      .expect(202);

    expect(chooseCandidateResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('跟进内容：今天跟进了安恒信息，尬聊了一天，无进度更新。');
    expect(lastAssistantTurn?.content).toContain('遇到与协助：客户不好沟通，推进缓慢。');
    expect(lastAssistantTurn?.content).toContain('信息共享：暂无信息共享。');
    expect(lastAssistantTurn?.content).toContain('拜访计划：明天继续跟进。');
  });

  it('AI 草稿缺少问题和计划字段时，候选确认后仍应合并规则拆分结果保留四段式', async () => {
    const conversationId = 'conv_follow_up_template_ai_partial_merge_001';
    const aiDraftSpy = jest.spyOn(
      aiGatewayService as unknown as {
        parseWecomFollowUpStructuredDraft: (params: {
          requesterName: string;
          messageText?: string;
        }) => Promise<Record<string, unknown> | null>;
      },
      'parseWecomFollowUpStructuredDraft',
    );
    aiDraftSpy.mockResolvedValue({
      requesterName: '销售总监',
      followUpContent: '今天跟进了安恒信息，尬聊了一天，无进度更新。',
      helpNeeded: '',
      informationShare: '暂无信息共享。',
      visitPlan: '',
    });
    jest.spyOn(opportunityLookupService, 'lookupByCompanyName').mockResolvedValue({
      companyName: '安恒信息',
      customFieldName: 'title',
      totalCount: 3,
      limit: 5,
      matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
      records: [
        {
          id: 'opp_anheng_merge_001',
          title: '安恒信息-AH202603124',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 2233429,
          stage: '商务洽谈',
          createdAt: '2026-03-01T08:00:00.000Z',
        },
        {
          id: 'opp_anheng_merge_002',
          title: '安恒信息-AH202603082',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 2223429,
          stage: '商务洽谈',
          createdAt: '2026-03-02T08:00:00.000Z',
        },
        {
          id: 'opp_anheng_merge_003',
          title: '安恒信息-AH202603078',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 2223429,
          stage: '商务洽谈',
          createdAt: '2026-03-03T08:00:00.000Z',
        },
      ],
      summary: '唯一命中安恒信息项目',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_partial_merge_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const draftResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_partial_merge_001_02',
        messageText:
          '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    expect(draftResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const chooseCandidateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_ai_partial_merge_001_03',
        messageText: '3',
      })
      .expect(202);

    expect(chooseCandidateResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('跟进内容：今天跟进了安恒信息，尬聊了一天，无进度更新。');
    expect(lastAssistantTurn?.content).toContain('遇到与协助：客户不好沟通；推进缓慢');
    expect(lastAssistantTurn?.content).toContain('信息共享：暂无信息共享。');
    expect(lastAssistantTurn?.content).toContain('拜访计划：明天继续跟进');
  });

  it('按模板补齐后应生成带姓名的草稿，并保留可供日报复用的结构化字段', async () => {
    const conversationId = 'conv_follow_up_template_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const templateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_001_02',
        messageText: [
          '跟进内容：今天拜访了苏州制造，确认续签方案和预算范围，当前进入商务评审阶段。',
          '遇到与协助：客户希望下周拿到报价测算，需要产品同事李四协助补充实施排期。',
          '信息共享：友商本周主推打包折扣方案，客户对交付周期比价格更敏感。',
          '拜访计划：计划周四上午和李四一起再次拜访苏州制造，确认报价口径并推进到方案评审。',
        ].join('\n'),
      })
      .expect(202);

    expect(templateResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    const latestWriteback = [...appStorageService.state.pendingFollowUpWritebacks]
      .reverse()
      .find((item) => item.sessionId === confirmResponse.body.sessionId);

    expect(latestWriteback?.draftContent).toContain('【销售总监】：');
    expect(latestWriteback?.draftContent).toContain(
      '跟进内容：今天拜访了苏州制造，确认续签方案和预算范围，当前进入商务评审阶段。',
    );
    expect(latestWriteback?.draftContent).toContain(
      '遇到与协助：客户希望下周拿到报价测算',
    );
    expect(latestWriteback?.structuredFollowUpContent).toContain('今天拜访了苏州制造');
    expect(latestWriteback?.structuredHelpNeeded).toContain('需要产品同事李四协助');
    expect(latestWriteback?.structuredInformationShare).toContain(
      '友商本周主推打包折扣方案',
    );
    expect(latestWriteback?.structuredVisitPlan).toContain(
      '计划周四上午和李四一起再次拜访苏州制造',
    );
  });

  it('模板内容已完整但名称不明确时，第二次只补具体名称即可继续，不要求重发整份模板', async () => {
    const conversationId = 'conv_follow_up_template_entity_clarify_001';

    jest.spyOn(opportunityLookupService, 'lookupByCompanyName').mockResolvedValue({
      companyName: '安恒信息项目',
      customFieldName: 'title',
      totalCount: 1,
      limit: 5,
      matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
      records: [
        {
          id: 'opp_anheng_001',
          title: '安恒信息-AH202603124',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 30000,
          stage: '50%控标或唯一',
          createdAt: '2026-03-26T08:43:00.000Z',
        },
      ],
      summary: '唯一命中安恒信息-AH202603124',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_clarify_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const firstFillResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_clarify_001_02',
        messageText: [
          '跟进内容：跟进了安恒信息，忙聊了一天，无进度更新。',
          '遇到与协助：客户不好沟通，推进缓慢。',
          '信息共享：这个案例场景可以分享。',
          '拜访计划：明天继续跟进。',
        ].join('\n'),
      })
      .expect(202);

    expect(firstFillResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
    let conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    let lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');
    expect(lastAssistantTurn?.content).toContain('安恒信息-AH202603124');

    const clarifyResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_clarify_001_03',
        messageText: '安恒信息项目',
      })
      .expect(202);

    expect(clarifyResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION');
    conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('请确认内容是否正确');
    expect(lastAssistantTurn?.content).toContain('安恒信息-AH202603124');
  });

  it('模板链路第二次补名称后应立即查询，多候选时直接返回候选列表而不是先让用户确认', async () => {
    const conversationId = 'conv_follow_up_template_entity_clarify_002';

    jest.spyOn(opportunityLookupService, 'lookupByCompanyName').mockResolvedValue({
      companyName: '安恒信息项目',
      customFieldName: 'title',
      totalCount: 2,
      limit: 5,
      matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
      records: [
        {
          id: 'opp_anheng_001',
          title: '安恒信息-AH202603124',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 30000,
          stage: '50%控标或唯一',
          createdAt: '2026-03-26T08:43:00.000Z',
        },
        {
          id: 'opp_anheng_002',
          title: '安恒信息-AH202603082',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 15033.75,
          stage: '赢单',
          createdAt: '2026-03-17T07:49:00.000Z',
        },
      ],
      summary: '命中多个安恒信息项目',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_clarify_002_01',
        messageText: '跟进商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_clarify_002_02',
        messageText: [
          '跟进内容：跟进了安恒信息，忙聊了一天，无进度更新。',
          '遇到与协助：客户不好沟通，推进缓慢。',
          '信息共享：这个案例场景可以分享。',
          '拜访计划：明天继续跟进。',
        ].join('\n'),
      })
      .expect(202);

    const clarifyResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_clarify_002_03',
        messageText: '安恒信息项目',
      })
      .expect(202);

    expect(clarifyResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('安恒信息-AH202603124');
    expect(lastAssistantTurn?.content).toContain('候选1');
    expect(lastAssistantTurn?.content).toContain('候选2');
    expect(lastAssistantTurn?.content).toContain('信息较模糊');
    expect(lastAssistantTurn?.content).not.toContain('跟进记录内容：');
    expect(lastAssistantTurn?.content).not.toContain('回复“确认”后我会直接写入 CRM 跟进记录');
  });

  it('模板链路选中候选后应保留问题与协助、信息共享和拜访计划', async () => {
    const conversationId = 'conv_follow_up_template_entity_candidate_keep_sections_001';

    jest.spyOn(opportunityLookupService, 'lookupByCompanyName').mockResolvedValue({
      companyName: '安恒信息项目',
      customFieldName: 'title',
      totalCount: 2,
      limit: 5,
      matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
      records: [
        {
          id: 'opp_keep_sections_001',
          title: '安恒信息-AH202603124',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 30000,
          stage: '50%控标或唯一',
          createdAt: '2026-03-26T08:43:00.000Z',
        },
        {
          id: 'opp_keep_sections_002',
          title: '安恒信息-AH202603082',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 15033.75,
          stage: '赢单',
          createdAt: '2026-03-17T07:49:00.000Z',
        },
      ],
      summary: '命中多个安恒信息项目',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_candidate_keep_sections_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_candidate_keep_sections_001_02',
        messageText: [
          '跟进内容：跟进了安恒信息，忙聊了一天，无进度更新。',
          '遇到与协助：客户不好沟通，推进缓慢。',
          '信息共享：这个案例场景可以分享。',
          '拜访计划：明天继续跟进。',
        ].join('\n'),
      })
      .expect(202);

    const chooseCandidateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_entity_candidate_keep_sections_001_03',
        messageText: '候选1',
      })
      .expect(202);

    expect(chooseCandidateResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('项目：安恒信息-AH202603124');
    expect(lastAssistantTurn?.content).toContain('遇到与协助：客户不好沟通，推进缓慢。');
    expect(lastAssistantTurn?.content).toContain('信息共享：这个案例场景可以分享。');
    expect(lastAssistantTurn?.content).toContain('拜访计划：明天继续跟进。');
    expect(lastAssistantTurn?.content).not.toContain('本次已在企业微信完成进度确认');
  });

  it('跟进客户模板选中主客户候选后不应再次按名称重查而卡在候选列表', async () => {
    const conversationId = 'conv_follow_up_template_customer_candidate_no_loop_001';
    const customerLookupSpy = jest.spyOn(customerLookupService, 'lookupByName');
    customerLookupSpy.mockResolvedValue({
      customerName: '中国银行股份有限公司',
      totalCount: 3,
      limit: 5,
      records: [
        {
          id: 'cus_bank_001',
          name: '中国银行股份有限公司',
          ownerId: 'owner_wang',
          ownerName: '王冬',
          category: '战略客户',
        },
        {
          id: 'cus_bank_002',
          name: '中国银行股份有限公司江西省分行',
          ownerId: 'owner_zhang',
          ownerName: '张旭2',
          category: '分行客户',
        },
        {
          id: 'cus_bank_003',
          name: '中国银行股份有限公司江苏省分行',
          ownerId: 'owner_shen',
          ownerName: '沈腾云',
          category: '分行客户',
        },
      ],
      summary: '测试客户多候选循环问题',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_candidate_no_loop_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_candidate_no_loop_001_02',
        messageText:
          '今天拜访了中国银行股份有限公司，跟进项目部署，已部署80%，没有遇到什么问题，准备后天接着拜访。',
      })
      .expect(202);

    const directSubmitResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_candidate_no_loop_001_03',
        messageText: '不补充',
      })
      .expect(202);

    expect(directSubmitResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const chooseCandidateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_candidate_no_loop_001_04',
        messageText: '1',
      })
      .expect(202);

    expect(chooseCandidateResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
    expect(customerLookupSpy).toHaveBeenCalledTimes(2);

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('客户：中国银行股份有限公司');
    expect(lastAssistantTurn?.content).toContain('回复“确认”');
    expect(lastAssistantTurn?.content).not.toContain('找到 3 条客户候选');
  });

  it('管理员跟进客户模板时不应被本人负责人筛选误拦截', async () => {
    const conversationId = 'conv_follow_up_template_admin_customer_001';
    const adminUser = {
      id: 'user_admin',
      name: '系统管理员',
      roleIds: ['role_admin'],
      roleNames: ['系统管理员'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_admin'],
      ownerIds: ['owner_zhang', 'owner_li', 'owner_wang'],
      isAdmin: true,
      exportAllowed: true,
      channels: ['web-console', 'wecom-bot'] as Array<'web-console' | 'wecom-bot'>,
      identitySource: 'database' as const,
      wecomSenderId: 'wx_admin',
    };
    const originalGetUserByWecomSenderId =
      crmReadonlyService.getUserByWecomSenderId.bind(crmReadonlyService);
    const originalGetUserById =
      crmReadonlyService.getUserById.bind(crmReadonlyService);

    jest
      .spyOn(crmReadonlyService, 'getUserByWecomSenderId')
      .mockImplementation(async (senderId) => {
        if (senderId === 'wx_admin') {
          return adminUser;
        }

        return await originalGetUserByWecomSenderId(senderId);
      });
    jest.spyOn(crmReadonlyService, 'getUserById').mockImplementation(async (userId) => {
      if (userId === 'user_admin') {
        return adminUser;
      }

      return await originalGetUserById(userId);
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_admin',
        messageId: 'msg_follow_up_template_admin_customer_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_admin',
        messageId: 'msg_follow_up_template_admin_customer_001_02',
        messageText:
          '今天拜访了苏州制造，推进部署细节，客户反馈下周继续沟通商务条款。',
      })
      .expect(202);

    const directSubmitResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_admin',
        messageId: 'msg_follow_up_template_admin_customer_001_03',
        messageText: '不补充',
      })
      .expect(202);

    expect(directSubmitResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('客户：苏州制造');
    expect(lastAssistantTurn?.content).toContain('回复“确认”');
    expect(lastAssistantTurn?.content).not.toContain('暂时找不到可写入的客户');
  });

  it('跟进客户模板未召回任何候选时不应误提示候选项和候选序号', async () => {
    const conversationId = 'conv_follow_up_template_customer_no_candidate_001';
    const customerLookupSpy = jest.spyOn(customerLookupService, 'lookupByName');
    customerLookupSpy.mockResolvedValue({
      customerName: '中国银行股份有限公司',
      totalCount: 0,
      limit: 10,
      records: [],
      summary: '测试客户零候选提示',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_no_candidate_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_no_candidate_001_02',
        messageText:
          '今天拜访了中国银行股份有限公司，跟进项目部署，已部署80%，没有遇到什么问题，准备后天接着拜访。',
      })
      .expect(202);

    const directSubmitResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_no_candidate_001_03',
        messageText: '不补充',
      })
      .expect(202);

    expect(directSubmitResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(customerLookupSpy).toHaveBeenCalled();

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('我先把 CRM 查询结果发你');
    expect(lastAssistantTurn?.content).toContain('请补充更完整的客户名或公司全称');
    expect(lastAssistantTurn?.content).not.toContain('候选项发你');
    expect(lastAssistantTurn?.content).not.toContain('候选序号');
  });

  it('跟进客户模板多候选时应展示前 10 条候选，而不是只展示 3 条', async () => {
    const conversationId = 'conv_follow_up_template_customer_candidate_top10_001';
    const customerLookupSpy = jest.spyOn(customerLookupService, 'lookupByName');
    customerLookupSpy.mockResolvedValue({
      customerName: '中国银行',
      totalCount: 12,
      limit: 10,
      records: Array.from({ length: 12 }, (_, index) => ({
        id: `cus_bank_top10_${index + 1}`,
        name: `中国银行股份有限公司候选${String(index + 1).padStart(2, '0')}`,
        ownerId: 'owner_self',
        ownerName: '销售总监',
        category: '测试客户',
      })),
      summary: '测试客户前十候选展示',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_candidate_top10_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_candidate_top10_001_02',
        messageText:
          '跟进内容：今天拜访了中国银行，推进部署细节。遇到与协助：暂无。信息共享：同步了实施计划。拜访计划：明天继续跟进。',
      })
      .expect(202);

    const directSubmitResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_customer_candidate_top10_001_03',
        messageText: '不补充',
      })
      .expect(202);

    expect(directSubmitResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('找到 12 条客户候选');
    expect(lastAssistantTurn?.content).toContain('前 10 条');
    expect(lastAssistantTurn?.content).toContain('候选10：中国银行股份有限公司候选10');
    expect(lastAssistantTurn?.content).not.toContain('候选11：中国银行股份有限公司候选11');
  });

  it('跟进商机模板首次整理时就应直接按模糊项目名查询并返回候选项', async () => {
    const conversationId = 'conv_follow_up_template_first_pass_fuzzy_project_001';

    jest.spyOn(opportunityLookupService, 'lookupByCompanyName').mockResolvedValue({
      companyName: '安恒信息',
      customFieldName: 'title',
      totalCount: 3,
      limit: 5,
      matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
      records: [
        {
          id: 'opp_anheng_001',
          title: '安恒信息-AH202603124',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 30000,
          stage: '50%控标或唯一',
          createdAt: '2026-03-26T08:43:00.000Z',
        },
        {
          id: 'opp_anheng_002',
          title: '安恒信息-AH202603082',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 15033.75,
          stage: '赢单',
          createdAt: '2026-03-17T07:49:00.000Z',
        },
        {
          id: 'opp_anheng_003',
          title: '安恒信息-AH202603078',
          customerId: 'cus_anheng_001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 30000,
          stage: '50%控标或唯一',
          createdAt: '2026-03-17T02:38:00.000Z',
        },
      ],
      summary: '命中多个安恒信息项目',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_first_pass_fuzzy_project_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const firstFillResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_first_pass_fuzzy_project_001_02',
        messageText: [
          '跟进内容：跟进了安恒信息，忙聊了一天，无进度更新。',
          '遇到与协助：客户不好沟通，推进缓慢。',
          '信息共享：这个案例场景可以分享。',
          '拜访计划：明天继续跟进。',
        ].join('\n'),
      })
      .expect(202);

    expect(firstFillResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('候选1');
    expect(lastAssistantTurn?.content).toContain('安恒信息-AH202603124');
    expect(lastAssistantTurn?.content).toContain('候选2');
    expect(lastAssistantTurn?.content).toContain('信息较模糊');
    expect(lastAssistantTurn?.content).not.toContain('跟进记录内容：');
    expect(lastAssistantTurn?.content).not.toContain('公司名或客户名写清楚');
  });

  it('活跃跟进模板正文续填时不应重复调用任务回复语义分类两次', async () => {
    const conversationId = 'conv_follow_up_template_single_semantic_call_001';
    const replyIntentSpy = jest.spyOn(aiGatewayService, 'classifyWecomTaskReplyIntent');

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_single_semantic_call_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    replyIntentSpy.mockClear();

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_single_semantic_call_001_02',
        messageText:
          '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      })
      .expect(202);

    expect(replyIntentSpy).toHaveBeenCalledTimes(1);
  });

  it('跟进模板实体识别遇到用户登录 token 过期时，应自动回退内置账号重试', async () => {
    const conversationId = 'conv_follow_up_template_expired_token_retry_001';
    const opportunityLookupSpy = jest.spyOn(opportunityLookupService, 'lookupByCompanyName');
    const requesterUser = crmReadonlyService
      .listUsers()
      .find((item) => item.id === 'user_sales_director');

    expect(requesterUser).toBeDefined();

    opportunityLookupSpy
      .mockRejectedValueOnce(new UnauthorizedException('您的登录已经过期，请重新登录！'))
      .mockResolvedValueOnce({
        companyName: '安恒信息',
        customFieldName: 'title',
        totalCount: 1,
        limit: 5,
        matchedCompanyNames: ['杭州安恒信息技术股份有限公司'],
        records: [
          {
            id: 'opp_expired_retry_001',
            title: '安恒信息-AH202603124',
            customerId: 'cus_anheng_001',
            customerName: '杭州安恒信息技术股份有限公司',
            ownerId: 'owner_li',
            ownerName: '李浩',
            organizationId: 'org_north',
            departmentId: 'dept_sales',
            expectAmount: 30000,
            stage: '50%控标或唯一',
            createdAt: '2026-03-26T08:43:00.000Z',
          },
        ],
        summary: '唯一命中安恒信息项目',
      });

    appStorageService.state.authSessions.unshift({
      id: 'auth_session_expired_retry_001',
      requesterId: 'user_sales_director',
      source: 'wecom-scan',
      sessionStatus: 'ACTIVE',
      crmCorpId: 'corp_mock',
      crmAccessToken: 'expired-user-token',
      userSnapshot: requesterUser as NonNullable<typeof requesterUser>,
      lastAccessAt: '2026-04-17T08:40:00.000Z',
      expiresAt: '2026-04-18T08:40:00.000Z',
      createdAt: '2026-04-17T08:40:00.000Z',
      updatedAt: '2026-04-17T08:40:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_expired_token_retry_001_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_expired_token_retry_001_02',
        messageText: [
          '跟进内容：今天跟进了安恒信息，尬聊了一天，无进度更新。',
          '遇到与协助：客户不好沟通，推进缓慢。',
          '信息共享：无。',
          '拜访计划：明天继续跟进。',
        ].join('\n'),
      })
      .expect(202);

    expect(response.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');
    expect(opportunityLookupSpy).toHaveBeenCalledTimes(2);
    expect(opportunityLookupSpy.mock.calls[0]?.[2]?.accessToken).toBe('expired-user-token');
    expect(opportunityLookupSpy.mock.calls[1]?.[2]?.accessToken).not.toBe('expired-user-token');
  });

  it('跟进模板收集中回复“不做了”应直接收口并返回能力清单', async () => {
    const conversationId = 'conv_follow_up_template_cancel_guidance_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_cancel_guidance_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const cancelResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_cancel_guidance_001_02',
        messageText: '不做了',
      })
      .expect(202);

    expect(cancelResponse.body.status).toBe('RETURNED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('经营分析问数');
    expect(lastAssistantTurn?.content).toContain('跟进整理与受控写回');
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeUndefined();
  });

  it('模板中的跟进内容未写清公司名或客户名时，应继续补问而不进入对象识别', async () => {
    const conversationId = 'conv_follow_up_template_002';
    const pendingBefore = appStorageService.state.pendingFollowUpWritebacks.length;

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_002_01',
        messageText: '跟进商机',
      })
      .expect(202);

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_002_02',
        messageText: [
          '跟进内容：今天继续推进客户方案，已经完成需求澄清，准备下周评审。',
          '遇到与协助：无。',
          '信息共享：无。',
          '拜访计划：暂无。',
        ].join('\n'),
      })
      .expect(202);

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(response.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(lastAssistantTurn?.content).toContain('公司名或客户名写清楚');
    expect(appStorageService.state.pendingFollowUpWritebacks.length).toBe(pendingBefore);
  });

  it('客户创建中直接发送“跟进商机”时应放弃旧任务并切到跟进模板', async () => {
    const conversationId = 'conv_task_switch_customer_create_to_followup_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_task_switch_customer_create_to_followup_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    const switchResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_task_switch_customer_create_to_followup_001_02',
        messageText: '跟进商机',
      })
      .expect(202);

    expect(switchResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('接下来处理你刚发的新任务');
    expect(lastAssistantTurn?.content).toContain('本次跟进由我来统一整理');
    expect(conversationContext?.workMemory.crmCreateStatus).toBeUndefined();
    expect(conversationContext?.workMemory.followUpTemplateDraft).toBeTruthy();
  });

  it('跟进模板里的正常续填包含“日报”字样时不应误切到日报任务', async () => {
    const conversationId = 'conv_follow_up_template_no_switch_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_no_switch_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const continueResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_template_no_switch_001_02',
        messageText: [
          '跟进内容：今天拜访了苏州制造，晚上再整理日报同步给主管。',
          '遇到与协助：无',
        ].join('\n'),
      })
      .expect(202);

    expect(continueResponse.body.status).toBe('DAILY_REPORT_PROMPTED');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('我先帮你整理到这里');
    expect(lastAssistantTurn?.content).toContain('信息共享');
    expect(lastAssistantTurn?.content).not.toContain('主要跟进了哪些项目');
  });

  it('客户创建字段续填包含“日报”字样时不应误切换任务', async () => {
    const conversationId = 'conv_customer_create_no_switch_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_customer_create_no_switch_001_01',
        messageText: '新增客户',
      })
      .expect(202);

    const summaryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_customer_create_no_switch_001_02',
        messageText: [
          '名称：联软科技集团',
          '电话：021-88886666',
          'IT决策权所在地：上海',
          '统一社会信用代码：91310000999999999X',
          '备注：日报里后续再同步预算信息',
        ].join('\n'),
      })
      .expect(202);

    expect(summaryResponse.body.status).toBe('WECOM_CRM_CREATE_AWAITING_CONFIRMATION');
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const lastAssistantTurn = [...(conversationContext?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(lastAssistantTurn?.content).toContain('请确认以下客户创建摘要');
    expect(lastAssistantTurn?.content).not.toContain('本次跟进由我来统一整理');
    expect(lastAssistantTurn?.content).not.toContain('主要跟进了哪些项目');
  });

  it('日报收集中再次输入主题入口时，应重开新一轮收集而不是沿用上一轮待确认内容', async () => {
    const conversationId = 'conv_daily_report_restart_001';
    const senderId = 'wx_sales_director';

    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_restart_001_01',
        messageText:
          '帮我写今天的跟进：上午拜访了“未知公司”项目，推进 SaaS 续签，需要申请折扣审批。',
      })
      .expect(202);

    expect(firstResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const restartResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_restart_001_02',
        messageText: '帮我写今日跟进',
      })
      .expect(202);

    expect(restartResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );

    expect(conversationContext?.workMemory.dailyReportFlowStatus).toBe('COLLECTING');
    expect(conversationContext?.workMemory.dailyReportEntityLookupStatus).toBe('IDLE');
    expect(conversationContext?.workMemory.dailyReportEntityLookupText).toBeUndefined();
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === restartResponse.body.receiptId &&
          item.contentPreview.includes('本次跟进由我来统一整理'),
      ),
    ).toBe(true);
  });

  it('没有显式主题入口时，明显的客户跟进叙述也应直接进入今天跟进任务', async () => {
    const analysisRequestCountBefore = appStorageService.state.analysisRequests.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_theme_002',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_theme_002',
        messageText:
          '上午10:00 拜访了苏州纳芯微电子股份有限公司，推进了SaaS项目，下午14:00 去了一下佛山电器照明股份，继续跟进客户。',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PROMPTED');
    expect(appStorageService.state.analysisRequests.length).toBe(
      analysisRequestCountBefore,
    );
  });

  it('今日跟进写回成功后不应继续补日报字段', async () => {
    const conversationId = 'conv_daily_report_003';
    const senderId = 'wx_sales_director';
    const dailyReportCountBefore = appStorageService.state.dailyReports.length;

    const firstInputResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_003_01',
        messageText: '帮我写今天的跟进：上午拜访了苏州制造，沟通了需求对接，进展顺利。',
      })
      .expect(202);

    expect(firstInputResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_003_01_confirm',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    expect(appStorageService.state.dailyReports.length).toBe(dailyReportCountBefore);
    const conversationContext = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    expect(conversationContext?.workMemory.dailyReportFlowStatus).toBe('IDLE');
  });

  it('日报入口确认项目后应直接写回，成功后不再继续补日报', async () => {
    const conversationId = 'conv_daily_report_writeback_001';
    const senderId = 'wx_sales_director';

    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_writeback_001_01',
        messageText:
          '帮我写今天的跟进，并写入CRM跟进记录：上午10:00拜访了“苏州制造”项目，沟通了需求对接，进展顺利。',
      })
      .expect(202);

    expect(firstResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const confirmProjectResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_daily_report_writeback_001_02',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmProjectResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
    const latestWritebackRecord = appStorageService.state.pendingFollowUpWritebacks.find(
      (item) => item.sourceMessageId === 'msg_daily_report_writeback_001_02',
    );
    expect(latestWritebackRecord?.objectType).toBe('Opportunity');
    expect(latestWritebackRecord?.status).toBe('COMPLETED');
    expect(latestWritebackRecord?.draftContent).toContain('销售总监：');

    const conversationContextAfterWriteback = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const assistantTurnAfterWriteback = [...(conversationContextAfterWriteback?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(assistantTurnAfterWriteback?.content).toContain(
      '为了日报完整，如果还有其它跟进信息，或者新增商机、客户，请及时录入信息哦！',
    );
    expect(assistantTurnAfterWriteback?.content).not.toContain('新增客户或者新建商机');
    expect(assistantTurnAfterWriteback?.content).not.toContain('后续计划');
    expect(conversationContextAfterWriteback?.workMemory.dailyReportFlowStatus).toBe('IDLE');
  });

  it('成功提醒后的“无”应直接收口，不得串入后续跟进客户流程', async () => {
    const conversationId = 'conv_follow_up_post_writeback_close_001';
    const senderId = 'wx_sales_director';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_follow_up_post_writeback_close_001_01',
        messageText:
          '帮我写今天的跟进，并写入CRM跟进记录：上午10:00拜访了“苏州制造”项目，沟通了需求对接，进展顺利。',
      })
      .expect(202);

    const confirmWritebackResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_follow_up_post_writeback_close_001_02',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmWritebackResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');

    const noopResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_follow_up_post_writeback_close_001_03',
        messageText: '无',
      })
      .expect(202);

    expect(noopResponse.body.status).toBe('FOLLOW_UP_POST_WRITEBACK_ACKNOWLEDGED');
    expect(noopResponse.body.queryId).toBeUndefined();

    const contextAfterNoop = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const assistantTurnAfterNoop = [...(contextAfterNoop?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(assistantTurnAfterNoop?.content).toContain('好的，这次就先记到这里');
    expect(assistantTurnAfterNoop?.content).not.toContain(
      '已完成统一数据集组装与关键指标回算',
    );

    const themeEntryResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_follow_up_post_writeback_close_001_04',
        messageText: '跟进客户',
      })
      .expect(202);

    expect(themeEntryResponse.body.status).toBe('DAILY_REPORT_PROMPTED');

    const templateFillResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId,
        messageId: 'msg_follow_up_post_writeback_close_001_05',
        messageText: [
          '跟进内容：今天拜访了苏州制造，确认续签方案和预算范围，当前进入商务评审阶段。',
          '遇到与协助：客户希望下周拿到报价测算，需要产品同事李四协助补充实施排期。',
          '信息共享：友商本周主推打包折扣方案，客户对交付周期比价格更敏感。',
          '拜访计划：计划周四上午和李四一起再次拜访苏州制造，确认报价口径并推进到方案评审。',
        ].join('\n'),
      })
      .expect(202);

    expect(templateFillResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');

    const contextAfterTemplateFill = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === conversationId,
    );
    const assistantTurnAfterTemplateFill = [...(contextAfterTemplateFill?.turns ?? [])]
      .reverse()
      .find((item) => item.role === 'assistant');

    expect(assistantTurnAfterTemplateFill?.content).toContain('回复“确认”');
    expect(assistantTurnAfterTemplateFill?.content).not.toContain(
      '已完成统一数据集组装与关键指标回算',
    );
  });

  it('补问后续消息应按同一会话继续进入分析', async () => {
    const clarificationResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_ai_002',
        senderId: 'wx_sales_director',
        messageId: 'msg_ai_003',
        messageText: '从那段时间开始看一下商机情况',
      })
      .expect(202);

    expect(clarificationResponse.body.status).toBe('CLARIFICATION_REQUIRED');

    const followResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_ai_002',
        senderId: 'wx_sales_director',
        messageId: 'msg_ai_004',
        messageText: '最近30天',
      })
      .expect(202);

    expect(['RETURNED', 'CLARIFICATION_REQUIRED', 'OPPORTUNITY_LOOKUP_RETURNED']).toContain(
      followResponse.body.status,
    );
    const analysisRequestedAudit = appStorageService.state.auditEvents.find(
      (item) => item.eventType === 'AI_ANALYSIS_REQUESTED',
    );
    expect(analysisRequestedAudit).toBeDefined();
    expect(analysisRequestedAudit?.sessionSnapshot).toMatchObject({
      entryInterpretationSnapshot: {
        scene: 'WECOM_IDLE_MESSAGE',
        targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      },
      workflowRoutingSnapshot: {
        targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      },
    });
  });

  it('追问改条件时应继承上一轮主题继续分析', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_ai_003',
        senderId: 'wx_sales_director',
        messageId: 'msg_ai_005',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    const followUpResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_ai_003',
        senderId: 'wx_sales_director',
        messageId: 'msg_ai_006',
        messageText: '换成最近三个月',
      })
      .expect(202);

    expect(['RETURNED', 'CLARIFICATION_REQUIRED', 'OPPORTUNITY_LOOKUP_RETURNED']).toContain(
      followUpResponse.body.status,
    );
  });

  it('长会话应压缩旧消息为系统摘要', async () => {
    for (let index = 0; index < 10; index += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/wecom/messages')
        .set('x-wecom-signature', 'test-signature')
        .set('x-wecom-source', 'wecom-bot')
        .send({
          externalConversationId: 'conv_ai_004',
          senderId: 'wx_sales_director',
          messageId: `msg_ai_summary_${index}`,
          messageText:
            index === 0 ? '本月各销售负责人新增商机金额排名' : '这说明什么',
        })
        .expect(202);
    }

    const context = appStorageService.state.wecomConversationContexts.find(
      (item) => item.externalConversationId === 'conv_ai_004',
    );

    expect(context).toBeTruthy();
    expect(context?.turns.some((item) => item.role === 'system')).toBe(true);
    expect(context?.summaryText).toBeTruthy();
  });

  it('负责人上级命中对象级权限时，跟进客户应允许写回', async () => {
    seedFollowUpOwnerOrganizationFacts();
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '海航集团有限公司',
      totalCount: 1,
      limit: 5,
      records: [
        {
          id: 'cus_follow_up_scope_001',
          name: '海航集团有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
      ],
      summary: '唯一命中海航集团有限公司',
    });

    const conversationId = 'conv_follow_up_owner_scope_allowed_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_owner_scope_allowed_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const templateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_owner_scope_allowed_001_02',
        messageText: [
          '跟进内容：今天拜访了海航集团有限公司，确认续签范围与预算口径。',
          '遇到与协助：无',
          '信息共享：无',
          '拜访计划：下周继续推进商务评审。',
        ].join('\n'),
      })
      .expect(202);

    expect(templateResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_owner_scope_allowed_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
  });

  it('协作人本人命中对象级权限时，跟进客户应允许写回', async () => {
    seedFollowUpOwnerOrganizationFacts();
    grantWecomFollowUpWritebackToRegionManager();
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '海航集团有限公司',
      totalCount: 1,
      limit: 5,
      records: [
        {
          id: 'cus_follow_up_scope_collaborator_001',
          name: '海航集团有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
      ],
      summary: '唯一命中海航集团有限公司',
    });
    jest.spyOn(customerLookupService, 'getAssistUsersById').mockResolvedValue([
      {
        id: 'user_region_manager',
        name: '区域经理',
      },
    ]);

    const conversationId = 'conv_follow_up_collaborator_scope_allowed_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_region_manager',
        messageId: 'msg_follow_up_collaborator_scope_allowed_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const templateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_region_manager',
        messageId: 'msg_follow_up_collaborator_scope_allowed_001_02',
        messageText: [
          '跟进内容：今天拜访了海航集团有限公司，确认续签范围与预算口径。',
          '遇到与协助：无',
          '信息共享：无',
          '拜访计划：下周继续推进商务评审。',
        ].join('\n'),
      })
      .expect(202);

    expect(templateResponse.body.status).toBe(
      'FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION',
    );

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_region_manager',
        messageId: 'msg_follow_up_collaborator_scope_allowed_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_SUCCEEDED');
  });

  it('具备动作权限但不满足对象关系时，跟进客户应在草稿创建前被阻断', async () => {
    seedFollowUpOwnerOrganizationFacts();
    grantWecomFollowUpWritebackToProductManager();
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '海航集团有限公司',
      totalCount: 1,
      limit: 5,
      records: [
        {
          id: 'cus_follow_up_scope_002',
          name: '海航集团有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
      ],
      summary: '唯一命中海航集团有限公司',
    });

    const conversationId = 'conv_follow_up_owner_scope_blocked_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_product_li_si',
        messageId: 'msg_follow_up_owner_scope_blocked_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_product_li_si',
        messageId: 'msg_follow_up_owner_scope_blocked_001_02',
        messageText: [
          '跟进内容：今天拜访了海航集团有限公司，确认续签范围与预算口径。',
          '遇到与协助：无',
          '信息共享：无',
          '拜访计划：下周继续推进商务评审。',
        ].join('\n'),
      })
      .expect(403);
    expect(
      appStorageService.state.pendingFollowUpWritebacks.some(
        (item) => item.sourceMessageId === 'msg_follow_up_owner_scope_blocked_001_02',
      ),
    ).toBe(false);
    const accessDeniedAudit = appStorageService.state.auditEvents.find(
      (item) =>
        item.eventType === 'ACCESS_ACTION_DENIED' &&
        item.permissionKey === 'wecom.followup.writeback' &&
        item.resourceType === 'daily-report-follow-up-writeback-draft-scope',
    );
    expect(accessDeniedAudit?.outcome).toContain('负责人、协作人');
  });

  it('草稿创建后对象关系失效时，最终确认写回应被阻断并保留草稿', async () => {
    seedFollowUpOwnerOrganizationFacts();
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '海航集团有限公司',
      totalCount: 1,
      limit: 5,
      records: [
        {
          id: 'cus_follow_up_scope_003',
          name: '海航集团有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
      ],
      summary: '唯一命中海航集团有限公司',
    });
    jest.spyOn(customerLookupService, 'getById').mockResolvedValue({
      id: 'cus_follow_up_scope_003',
      name: '海航集团有限公司',
      ownerId: 'owner_li',
      ownerName: '李浩',
      category: '战略客户',
    });
    jest.spyOn(customerLookupService, 'getAssistUsersById').mockResolvedValue([]);

    const conversationId = 'conv_follow_up_owner_scope_changed_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_owner_scope_changed_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const templateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_owner_scope_changed_001_02',
        messageText: [
          '跟进内容：今天拜访了海航集团有限公司，确认续签范围与预算口径。',
          '遇到与协助：无',
          '信息共享：无',
          '拜访计划：下周继续推进商务评审。',
        ].join('\n'),
      })
      .expect(202);

    expect(templateResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION');

    const ownerSyncedUser = appStorageService.state.wecomSyncedUsers.find(
      (item) => item.wxUserid === 'wx_owner_li',
    );
    expect(ownerSyncedUser).toBeTruthy();
    ownerSyncedUser!.directLeaderUserids = ['wx_product_director'];

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_sales_director',
        messageId: 'msg_follow_up_owner_scope_changed_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_FAILED');

    const latestWriteback = [...appStorageService.state.pendingFollowUpWritebacks]
      .reverse()
      .find((item) => item.sessionId === confirmResponse.body.sessionId);
    expect(latestWriteback?.status).toBe('FAILED');
    expect(latestWriteback?.failureReason).toContain('负责人、协作人');

    const accessDeniedAudit = appStorageService.state.auditEvents.find(
      (item) =>
        item.eventType === 'ACCESS_ACTION_DENIED' &&
        item.permissionKey === 'wecom.followup.writeback' &&
        item.resourceType === 'follow-up-writeback-execute-scope',
    );
    expect(accessDeniedAudit).toBeTruthy();
  });

  it('草稿创建后协作人被移除时，最终确认写回应被阻断并保留草稿', async () => {
    seedFollowUpOwnerOrganizationFacts();
    grantWecomFollowUpWritebackToRegionManager();
    jest.spyOn(customerLookupService, 'lookupByName').mockResolvedValue({
      customerName: '海航集团有限公司',
      totalCount: 1,
      limit: 5,
      records: [
        {
          id: 'cus_follow_up_scope_collaborator_changed_001',
          name: '海航集团有限公司',
          ownerId: 'owner_li',
          ownerName: '李浩',
          category: '战略客户',
        },
      ],
      summary: '唯一命中海航集团有限公司',
    });
    jest.spyOn(customerLookupService, 'getById').mockResolvedValue({
      id: 'cus_follow_up_scope_collaborator_changed_001',
      name: '海航集团有限公司',
      ownerId: 'owner_li',
      ownerName: '李浩',
      category: '战略客户',
    });

    let currentAssistUsers: Array<{ id: string; name: string }> = [
      {
        id: 'user_region_manager',
        name: '区域经理',
      },
    ];
    jest.spyOn(customerLookupService, 'getAssistUsersById').mockImplementation(
      async () => currentAssistUsers,
    );

    const conversationId = 'conv_follow_up_collaborator_scope_changed_001';

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_region_manager',
        messageId: 'msg_follow_up_collaborator_scope_changed_001_01',
        messageText: '跟进客户',
      })
      .expect(202);

    const templateResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_region_manager',
        messageId: 'msg_follow_up_collaborator_scope_changed_001_02',
        messageText: [
          '跟进内容：今天拜访了海航集团有限公司，确认续签范围与预算口径。',
          '遇到与协助：无',
          '信息共享：无',
          '拜访计划：下周继续推进商务评审。',
        ].join('\n'),
      })
      .expect(202);

    expect(templateResponse.body.status).toBe(
      'FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION',
    );

    currentAssistUsers = [];

    const confirmResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: conversationId,
        senderId: 'wx_region_manager',
        messageId: 'msg_follow_up_collaborator_scope_changed_001_03',
        messageText: '确认',
      })
      .expect(202);

    expect(confirmResponse.body.status).toBe('FOLLOW_UP_WRITEBACK_FAILED');

    const latestWriteback = [...appStorageService.state.pendingFollowUpWritebacks]
      .reverse()
      .find((item) => item.sessionId === confirmResponse.body.sessionId);
    expect(latestWriteback?.status).toBe('FAILED');
    expect(latestWriteback?.failureReason).toContain('协作人');
  });
});
