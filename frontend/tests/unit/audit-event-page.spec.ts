import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import AuditEventPage from '@/pages/audit/AuditEventPage.vue';
import { analysisService } from '@/services/analysis.service';
import { useAuthStore } from '@/stores/auth.store';
import type { AuditEventList } from '@/types/analysis';
import { ElMessage, ElMessageBox } from 'element-plus';

vi.mock('@/services/analysis.service', () => ({
  analysisService: {
    listAuditEvents: vi.fn(),
    listSqlAudits: vi.fn(),
    getSqlAuditDetail: vi.fn(),
    revealSqlAudit: vi.fn(),
  },
}));

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>();
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
    ElMessageBox: {
      confirm: vi.fn(),
    },
  };
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

describe('audit event page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(analysisService.listAuditEvents).mockReset();
    vi.mocked(analysisService.listSqlAudits).mockReset();
    vi.mocked(analysisService.getSqlAuditDetail).mockReset();
    vi.mocked(analysisService.revealSqlAudit).mockReset();
  });

  it('应提交入口理解筛选参数并展示展开后的入口快照字段', async () => {
    const authStore = useAuthStore();
    authStore.session = {
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-04-18T10:00:00.000Z',
      user: {
        id: '2224755',
        name: '王尧',
        roleNames: ['超级管理员'],
        channels: ['web-console'],
        organizationIds: ['org_all'],
        departmentIds: ['dept_all'],
      },
    };
    authStore.hydrated = true;

    const buildAuditList = (page: number, pageSize: number): AuditEventList => ({
      summary: {
        todayQueryCount: 3,
        wecomQueryRatioPercent: 50,
        todayBlockedCount: 1,
        todaySensitiveInterceptCount: 0,
        todayExportCount: 0,
        todayExportBlockedCount: 0,
        pendingHighRiskReviewCount: 0,
        todayAiEntryCount: 8,
        todayAiFallbackCount: 2,
        todayAiFallbackRatePercent: 25,
        todayWecomEntryCount: 5,
        entrySceneBreakdown: [
          {
            scene: 'WEB_ANALYSIS_QUERY',
            count: 4,
            fallbackCount: 1,
            fallbackRatePercent: 25,
          },
          {
            scene: 'WECOM_IDLE_MESSAGE',
            count: 4,
            fallbackCount: 1,
            fallbackRatePercent: 25,
          },
        ],
        entryTargetWorkflowBreakdown: [
          {
            targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
            count: 5,
            fallbackCount: 2,
            fallbackRatePercent: 40,
          },
        ],
        entryFallbackReasonBreakdown: [
          {
            fallbackReason: 'ai-unavailable-or-invalid',
            count: 2,
          },
          {
            fallbackReason: 'active-conversation-flow-continue',
            count: 1,
          },
        ],
        entryDailyTrend: [
          {
            date: '2026-04-15',
            aiEntryCount: 3,
            aiFallbackCount: 1,
            aiFallbackRatePercent: 33,
            wecomEntryCount: 2,
          },
          {
            date: '2026-04-16',
            aiEntryCount: 5,
            aiFallbackCount: 1,
            aiFallbackRatePercent: 20,
            wecomEntryCount: 3,
          },
        ],
        entrySceneDailyTrend: [
          {
            date: '2026-04-16',
            scene: 'WECOM_IDLE_MESSAGE',
            count: 3,
            fallbackCount: 1,
            fallbackRatePercent: 33,
          },
        ],
        entryFallbackReasonDailyTrend: [
          {
            date: '2026-04-16',
            fallbackReason: 'active-conversation-flow-continue',
            count: 1,
          },
        ],
        aiGovernanceSuggestions: [
          {
            level: 'critical',
            title: 'AI fallback 比例偏高',
            detail: '当前 AI fallback 比例达到 25%，说明部分入口已开始回退到安全兜底。',
            action: '优先检查 idle semantic lane / semantic reply lane 的超时与排队耗时。',
          },
          {
            level: 'warning',
            title: 'Web 分析入口波动明显',
            detail: 'WEB_ANALYSIS_QUERY 入口存在 fallback，建议重点核查问数意图解析与治理阻断原因。',
            action: '检查 ANALYSIS_QUERY_EXECUTION 对应入口的 timeout、权限字段白名单和 fallback 原因分布。',
          },
        ],
        aiGovernanceAlerts: [
          {
            level: 'warning',
            title: 'AI fallback 比例达到预警阈值',
            detail: '当前 AI fallback 比例达到 25%，已超过预设预警阈值。',
          },
          {
            level: 'warning',
            title: 'WEB_ANALYSIS_QUERY 入口达到预警阈值',
            detail: 'WEB_ANALYSIS_QUERY 入口 fallback 比例达到 25%，建议尽快排查入口稳定性。',
          },
        ],
      },
      items: [
        {
          eventId: `audit_${page}_001`,
          eventType: 'QUERY_BLOCKED',
          actorId: '2224755',
          actorName: '王尧',
          actorDisplayName: '王尧',
          actorBindingStatus: 'BOUND_CRM',
          channel: 'web-console',
          originalQuestion: '本月各销售负责人新增商机金额排名',
          actionSummary: '智能问数请求被阻断。',
          targetType: 'analysis-query',
          targetId: `query_${page}`,
          targetSummary: '本月各销售负责人新增商机金额排名',
          scopeSummary: '当前为管理员视角，可查看已授权的全组织结果。',
          riskLevel: 'HIGH',
          reviewStatus: 'PENDING',
          outcome: `第${page}页审计结果`,
          sessionId: `session_${page}`,
          entryScene: 'WEB_ANALYSIS_QUERY',
          entryTargetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          entryUsedFallback: true,
          entryFallbackReason: 'ai-unavailable-or-invalid',
          workflowFinalProgram: 'analysis-service.blockRequest',
          workflowTargetWorkflow: 'ANALYSIS_BLOCKED',
          sessionSnapshot: {},
          createdAt: '2026-04-16T11:00:00.000Z',
        },
      ],
      page,
      pageSize,
      total: 21,
    });

    vi.mocked(analysisService.listAuditEvents).mockImplementation(async (params) => {
      const page = Number(params.get('page') ?? '1');
      const pageSize = Number(params.get('pageSize') ?? '10');

      return buildAuditList(page, pageSize);
    });

    const wrapper = mount(AuditEventPage);
    await flushPromises();

    expect(analysisService.listAuditEvents).toHaveBeenCalledTimes(1);
    expect(vi.mocked(analysisService.listAuditEvents).mock.calls.at(0)?.[0]?.get('page')).toBe('1');
    expect(vi.mocked(analysisService.listAuditEvents).mock.calls.at(0)?.[0]?.get('pageSize')).toBe('10');
    expect(wrapper.find('.page-header--compact').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('刷新数据');
    expect(wrapper.text()).not.toContain('当前视角：AI 治理与行为审计');
    expect(wrapper.find('.business-visual-anchor').exists()).toBe(false);
    expect(wrapper.text()).toContain('AI 审计');
    expect(wrapper.text()).toContain('AI 审计');
    expect(wrapper.text()).toContain('用户行为审计');
    expect(wrapper.text()).toContain('统计口径：今日 AI 入口理解链路');
    expect(wrapper.text()).toContain('数据更新时间：');
    expect(wrapper.text()).toContain('AI 入口请求数');
    expect(wrapper.text()).toContain('8');
    expect(wrapper.text()).toContain('AI 兜底率');
    expect(wrapper.text()).toContain('25%');
    expect(wrapper.text()).toContain('待处理风险');
    expect(wrapper.text()).toContain('受影响入口');
    expect(wrapper.text()).toContain('AI 健康拆解');
    expect(wrapper.text()).toContain('按入口');
    expect(wrapper.text()).toContain('按工作流');
    expect(wrapper.text()).toContain('按兜底原因');
    expect(wrapper.text()).toContain('趋势');
    expect(wrapper.text()).toContain('2026-04-16 最新审计汇总');
    expect(wrapper.text()).toContain('企业微信空闲消息');
    expect(wrapper.text()).toContain('AI 不可用或返回无效');
    expect(wrapper.text()).toContain('活跃会话流程继续');
    expect(wrapper.text()).not.toContain('WECOM_IDLE_MESSAGE');
    expect(wrapper.text()).not.toContain('active-conversation-flow-continue');
    expect(wrapper.text()).not.toContain('AI fallback');
    expect(wrapper.text()).not.toContain('AI 阈值预警');
    expect(wrapper.text()).not.toContain('AI 治理建议');
    expect(wrapper.text()).toContain('AI 兜底比例偏高');
    expect(wrapper.text()).toContain('Web 分析入口波动明显');
    expect(wrapper.text()).toContain('AI 兜底比例达到预警阈值');
    expect(wrapper.text()).toContain('Web 分析问数 入口达到预警阈值');
    expect(wrapper.text()).toContain('严重');
    expect(wrapper.text()).toContain('预警');
    expect(wrapper.find('input[placeholder="按用户名筛选"]').exists()).toBe(false);

    await wrapper.get('[data-test="audit-tab-user"]').trigger('click');
    await flushPromises();

    expect(analysisService.listAuditEvents).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('用户行为审计');
    expect(wrapper.text()).toContain('当日查询量');
    expect(wrapper.text()).toContain('企业微信占比');
    expect(wrapper.text()).toContain('事件明细');
    expect(wrapper.text()).not.toContain('AI 入口命中');
    expect(wrapper.text()).toContain('查询');
    expect(wrapper.text()).not.toContain('刷新数据');
    expect(wrapper.text()).not.toContain('应用筛选');
    expect(wrapper.findComponent({ name: 'ElPagination' }).exists()).toBe(true);
    expect(wrapper.find('.el-pagination__total').text()).toContain('21');
    expect(wrapper.text()).toContain('第1页审计结果');

    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2);
    await flushPromises();

    expect(analysisService.listAuditEvents).toHaveBeenCalledTimes(3);
    expect(vi.mocked(analysisService.listAuditEvents).mock.calls.at(2)?.[0]?.get('page')).toBe('2');
    expect(vi.mocked(analysisService.listAuditEvents).mock.calls.at(2)?.[0]?.get('pageSize')).toBe('10');
    expect(wrapper.text()).toContain('第2页审计结果');

    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('size-change', 20);
    await flushPromises();

    expect(analysisService.listAuditEvents).toHaveBeenCalledTimes(4);
    expect(vi.mocked(analysisService.listAuditEvents).mock.calls.at(3)?.[0]?.get('page')).toBe('1');
    expect(vi.mocked(analysisService.listAuditEvents).mock.calls.at(3)?.[0]?.get('pageSize')).toBe('20');

    await wrapper.get('input[placeholder="按用户名筛选"]').setValue('王尧');
    wrapper.findAllComponents({ name: 'ElSelect' }).at(0)?.vm.$emit('update:modelValue', 'QUERY_BLOCKED');
    await wrapper.get('input[placeholder="按入口场景筛选"]').setValue('WEB_ANALYSIS_QUERY');
    await wrapper.get('input[placeholder="按入口目标工作流筛选"]').setValue('ANALYSIS_QUERY_EXECUTION');
    await wrapper.get('input[placeholder="按最终程序工作流筛选"]').setValue('ANALYSIS_BLOCKED');
    wrapper.findAllComponents({ name: 'ElSelect' }).at(1)?.vm.$emit('update:modelValue', 'true');
    await nextTick();
    await wrapper.get('button.button-primary').trigger('click');

    expect(analysisService.listAuditEvents).toHaveBeenCalledTimes(5);
    const lastCall = vi.mocked(analysisService.listAuditEvents).mock.calls.at(-1)?.[0];
    expect(lastCall).toBeInstanceOf(URLSearchParams);
    expect(lastCall?.get('actorId')).toBe('王尧');
    expect(lastCall?.get('eventType')).toBe('QUERY_BLOCKED');
    expect(lastCall?.get('entryScene')).toBe('WEB_ANALYSIS_QUERY');
    expect(lastCall?.get('entryTargetWorkflow')).toBe('ANALYSIS_QUERY_EXECUTION');
    expect(lastCall?.get('workflowTargetWorkflow')).toBe('ANALYSIS_BLOCKED');
    expect(lastCall?.get('entryUsedFallback')).toBe('true');
    expect(lastCall?.get('page')).toBe('1');
    expect(lastCall?.get('pageSize')).toBe('20');

    expect(wrapper.text()).toContain('高风险');
    expect(wrapper.text()).toContain('查询被阻断');
    expect(wrapper.text()).toContain('用户');
    expect(wrapper.text()).toContain('王尧');
    expect(wrapper.text()).toContain('第1页审计结果');
    expect(wrapper.text()).toContain('已绑定 CRM');
    expect(wrapper.text()).toContain('Web 工作台');
    expect(wrapper.text()).toContain('智能问数请求被阻断。');
    expect(wrapper.text()).toContain('本月各销售负责人新增商机金额排名');
    expect(wrapper.text()).not.toContain('行为人');
    expect(wrapper.text()).not.toContain('2224755');
    expect(wrapper.find('[data-test="audit-panel-user"]').text()).not.toContain('fallback 原因');
  });

  it('用户行为审计应把未绑定企业微信用户显示为业务可懂名称', async () => {
    const authStore = useAuthStore();
    authStore.session = {
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-04-18T10:00:00.000Z',
      user: {
        id: 'user_admin',
        name: '系统管理员',
        roleNames: ['系统管理员'],
        channels: ['web-console'],
        organizationIds: ['org_all'],
        departmentIds: ['dept_all'],
      },
    };
    authStore.hydrated = true;

    vi.mocked(analysisService.listAuditEvents).mockResolvedValue({
      summary: {
        todayQueryCount: 0,
        wecomQueryRatioPercent: 0,
        todayBlockedCount: 1,
        todaySensitiveInterceptCount: 0,
        todayExportCount: 0,
        todayExportBlockedCount: 0,
        pendingHighRiskReviewCount: 0,
        todayAiEntryCount: 0,
        todayAiFallbackCount: 0,
        todayAiFallbackRatePercent: 0,
        todayWecomEntryCount: 0,
        entrySceneBreakdown: [],
        entryTargetWorkflowBreakdown: [],
        entryFallbackReasonBreakdown: [],
        entryDailyTrend: [],
        entrySceneDailyTrend: [],
        entryFallbackReasonDailyTrend: [],
        aiGovernanceSuggestions: [],
        aiGovernanceAlerts: [],
      },
      items: [
        {
          eventId: 'audit_unbound_001',
          eventType: 'WECOM_AUTH_FAILED',
          actorId: 'wecom:wx_unbound_user',
          actorExternalId: 'wx_unbound_user',
          actorBindingStatus: 'UNBOUND_WECOM',
          actorDisplayName: '未绑定 CRM 用户（企业微信：wx_unbound_user）',
          channel: 'wecom-bot',
          scopeSummary: '企业微信入口认证失败。',
          riskLevel: 'HIGH',
          reviewStatus: 'PENDING',
          outcome: '企业微信入口处理失败。',
          actionSummary: '企业微信入口认证失败。',
          targetSummary: '企业微信入口请求',
          sessionSnapshot: {},
          createdAt: '2026-04-16T11:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });

    const wrapper = mount(AuditEventPage);
    await flushPromises();

    await wrapper.get('[data-test="audit-tab-user"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('未绑定 CRM 用户（企业微信：wx_unbound_user）');
    expect(wrapper.text()).toContain('企业微信机器人');
    expect(wrapper.text()).not.toContain('bot_crm_assistant');
  });

  it('用户行为审计应把企业微信频率限制错误显示为中文业务原因', async () => {
    const authStore = useAuthStore();
    authStore.session = {
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-04-18T10:00:00.000Z',
      user: {
        id: 'user_admin',
        name: '系统管理员',
        roleNames: ['系统管理员'],
        channels: ['web-console'],
        organizationIds: ['org_all'],
        departmentIds: ['dept_all'],
      },
    };
    authStore.hydrated = true;

    vi.mocked(analysisService.listAuditEvents).mockResolvedValue({
      summary: {
        todayQueryCount: 0,
        wecomQueryRatioPercent: 0,
        todayBlockedCount: 0,
        todaySensitiveInterceptCount: 0,
        todayExportCount: 0,
        todayExportBlockedCount: 0,
        pendingHighRiskReviewCount: 0,
        todayAiEntryCount: 0,
        todayAiFallbackCount: 0,
        todayAiFallbackRatePercent: 0,
        todayWecomEntryCount: 0,
        entrySceneBreakdown: [],
        entryTargetWorkflowBreakdown: [],
        entryFallbackReasonBreakdown: [],
        entryDailyTrend: [],
        entrySceneDailyTrend: [],
        entryFallbackReasonDailyTrend: [],
        aiGovernanceSuggestions: [],
        aiGovernanceAlerts: [],
      },
      items: [
        {
          eventId: 'audit_rate_limit_001',
          eventType: 'PROACTIVE_NOTIFICATION_FAILED',
          actorId: 'user_admin',
          actorName: '系统管理员',
          actorDisplayName: '系统管理员',
          actorBindingStatus: 'SYSTEM',
          channel: 'wecom-bot',
          scopeSummary: '系统任务。',
          riskLevel: 'LOW',
          reviewStatus: 'CONFIRMED',
          outcome: 'errcode=846607 aibot send msg frequency limit exceeded',
          failureReason: 'errcode=846607',
          actionSummary: 'PROACTIVE_NOTIFICATION_FAILED errcode=846607',
          targetSummary: '日报提醒',
          sessionSnapshot: {
            externalErrorCode: '846607',
          },
          createdAt: '2026-05-18T14:41:00.000Z',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });

    const wrapper = mount(AuditEventPage);
    await flushPromises();

    await wrapper.get('[data-test="audit-tab-user"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('企业微信机器人发送频率超限');
    expect(wrapper.text()).not.toContain('846607');
    expect(wrapper.text()).not.toContain('aibot send msg frequency limit exceeded');
  });

  it('具备 SQL 审计权限时应展示 SQL Tab，并支持详情和 reveal', async () => {
    const authStore = useAuthStore();
    authStore.session = {
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-04-18T10:00:00.000Z',
      user: {
        id: 'user_admin',
        name: '系统管理员',
        roleNames: ['系统管理员'],
        channels: ['web-console'],
        organizationIds: ['org_all'],
        departmentIds: ['dept_all'],
      },
    };
    authStore.capabilities = {
      actionKeys: ['audit.sql.view', 'audit.sql.view_sensitive'],
      visibleMenus: ['audit-center'],
    } as never;
    authStore.hydrated = true;

    vi.mocked(analysisService.listAuditEvents).mockResolvedValue({
      summary: {
        todayQueryCount: 0,
        wecomQueryRatioPercent: 0,
        todayBlockedCount: 0,
        todaySensitiveInterceptCount: 0,
        todayExportCount: 0,
        todayExportBlockedCount: 0,
        pendingHighRiskReviewCount: 0,
        todayAiEntryCount: 0,
        todayAiFallbackCount: 0,
        todayAiFallbackRatePercent: 0,
        todayWecomEntryCount: 0,
        entrySceneBreakdown: [],
        entryTargetWorkflowBreakdown: [],
        entryFallbackReasonBreakdown: [],
        entryDailyTrend: [],
        entrySceneDailyTrend: [],
        entryFallbackReasonDailyTrend: [],
        aiGovernanceSuggestions: [],
        aiGovernanceAlerts: [],
      },
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    vi.mocked(analysisService.listSqlAudits).mockResolvedValue({
      summary: {
        totalCount: 12,
        writeCount: 2,
        failedCount: 1,
        blockedCount: 3,
        highRiskCount: 2,
        averageDurationMs: 48,
        canRevealSensitive: true,
      },
      items: [
        {
          auditId: 'sql_audit_001',
          actorId: 'system_sync',
          actorName: '企业微信目录同步任务',
          moduleKey: 'wecom-directory-sync',
          programName: 'WecomDirectorySyncService.runSync',
          databaseRole: 'CRM_WRITEBACK',
          operationType: 'UPDATE',
          stage: 'EXECUTED',
          status: 'SUCCEEDED',
          riskLevel: 'HIGH',
          tables: ['wx_users'],
          sqlFingerprint: 'abc123',
          sqlSummary: 'UPDATE wx_users SET name = \'***\' WHERE id = ?',
          paramSummary: '参数1:string(4)',
          canRevealSensitive: true,
          createdAt: '2026-05-08T10:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });
    vi.mocked(analysisService.getSqlAuditDetail).mockResolvedValue({
      auditId: 'sql_audit_001',
      actorId: 'system_sync',
      actorName: '企业微信目录同步任务',
      moduleKey: 'wecom-directory-sync',
      programName: 'WecomDirectorySyncService.runSync',
      databaseRole: 'CRM_WRITEBACK',
      operationType: 'UPDATE',
      stage: 'EXECUTED',
      status: 'SUCCEEDED',
      riskLevel: 'HIGH',
      tables: ['wx_users'],
      sqlFingerprint: 'abc123',
      sqlSummary: 'UPDATE wx_users SET name = \'***\' WHERE id = ?',
      paramSummary: '参数1:string(4)',
      canRevealSensitive: true,
      createdAt: '2026-05-08T10:00:00.000Z',
    });
    vi.mocked(analysisService.revealSqlAudit).mockResolvedValue({
      auditId: 'sql_audit_001',
      sqlText: 'UPDATE wx_users SET name = ? WHERE id = ?',
      params: ['张三', 1001],
      revealedAt: '2026-05-08T10:02:00.000Z',
    });
    vi.mocked(ElMessageBox.confirm).mockResolvedValue('confirm' as never);

    const wrapper = mount(AuditEventPage, {
      global: {
        stubs: {
          teleport: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('SQL 审计');

    await wrapper.get('[data-test="audit-tab-sql"]').trigger('click');
    await flushPromises();

    expect(analysisService.listSqlAudits).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('总 SQL 数');
    expect(wrapper.text()).toContain('企业微信目录同步');
    expect(wrapper.text()).toContain('CRM 写库');

    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('size-change', 20);
    await flushPromises();

    expect(analysisService.listSqlAudits).toHaveBeenCalledTimes(2);
    expect(vi.mocked(analysisService.listSqlAudits).mock.calls.at(1)?.[0]?.get('page')).toBe('1');
    expect(vi.mocked(analysisService.listSqlAudits).mock.calls.at(1)?.[0]?.get('pageSize')).toBe('20');

    const detailButton = wrapper
      .findAll('button')
      .find((item) => item.text().includes('查看详情'));
    expect(detailButton).toBeTruthy();

    await detailButton!.trigger('click');
    await flushPromises();

    const pageVm = wrapper.vm as unknown as {
      selectedSqlAudit: { auditId: string } | null;
      revealedSqlAudit: { sqlText: string } | null;
      revealCurrentSqlAudit: () => Promise<void>;
    };

    expect(analysisService.getSqlAuditDetail).toHaveBeenCalledWith('sql_audit_001');
    expect(pageVm.selectedSqlAudit?.auditId).toBe('sql_audit_001');

    await pageVm.revealCurrentSqlAudit();
    await flushPromises();

    expect(analysisService.revealSqlAudit).toHaveBeenCalledWith('sql_audit_001');
    expect(ElMessage.success).toHaveBeenCalled();
    expect(pageVm.revealedSqlAudit?.sqlText).toBe(
      'UPDATE wx_users SET name = ? WHERE id = ?',
    );
  });
});
