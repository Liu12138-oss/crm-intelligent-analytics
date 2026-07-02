import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import QueryTemplatePage from '@/pages/governance/QueryTemplatePage.vue';
import ConnectionPolicyPage from '@/pages/governance/ConnectionPolicyPage.vue';
import AiModelProfilePage from '@/pages/governance/AiModelProfilePage.vue';
import { analysisService } from '@/services/analysis.service';
import type { AiModelProfileItem } from '@/types/analysis';

const mockLoadCapabilities = vi.fn();

vi.mock('@/services/analysis.service', () => ({
  analysisService: {
    getCurrentPolicy: vi.fn(),
    updateCurrentPolicy: vi.fn(),
    getLianruanCrmConfig: vi.fn(),
    updateLianruanCrmConfig: vi.fn(),
    testLianruanCrmConfig: vi.fn(),
    getLianruanCrmDiagnostics: vi.fn(),
    listGovernanceTemplates: vi.fn(),
    createGovernanceTemplate: vi.fn(),
    listAnalysisSemanticKnowledgeAssets: vi.fn(),
    listAiModelProfiles: vi.fn(),
    getAiContextPolicy: vi.fn(),
  },
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    loadCapabilities: mockLoadCapabilities,
  }),
}));

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

function buildPolicy() {
  return {
    policyId: 'policy_001',
    enabledRoleIds: ['role_sales_director'],
    exportRoleIds: ['role_sales_director'],
    enabledChannels: ['web-console'],
    allowedDomains: ['opportunity-analysis'],
    allowedTables: ['opportunities'],
    allowedFields: {
      opportunities: ['title', 'expect_amount'],
    },
    maskedFields: {},
    exportRowLimit: 1000,
    exportDailyLimit: 3,
    maxOnlineSessions: 200,
    maxConcurrentQueries: 50,
    heartbeatIntervalSeconds: 30,
    idleTimeoutSeconds: 120,
    historyRetentionDays: 30,
    status: 'ACTIVE',
    updatedAt: '2026-04-18T09:00:00.000Z',
  };
}

function buildHttpProfile(): AiModelProfileItem {
  return {
    id: 'profile_http',
    name: '环境默认 OpenAI 兼容 HTTP',
    providerCode: 'anthropic-claude' as const,
    sdkType: 'openai-compatible-http',
    model: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.leagsoft.ai/v1',
    secretConfigured: true,
    secretMask: '已配置',
    status: 'ACTIVE',
    sdkOptions: {
      wireApi: 'chat_completions',
      structuredOutputMode: 'json_object',
    },
    createdBy: 'system_env_bootstrap',
    updatedBy: 'system_env_bootstrap',
    createdAt: '2026-04-21T09:30:00.000Z',
    updatedAt: '2026-04-21T09:30:00.000Z',
    lastHealthCheckStatus: 'SUCCEEDED',
  };
}

function buildContextPolicy() {
  return {
    id: 'ai_context_policy_current',
    turnRetentionLimit: 8,
    historySummaryMaxLength: 600,
    latestQuestionMaxLength: 200,
    latestSummaryMaxLength: 800,
    analysisSessionIdleTimeoutSeconds: 1800,
    taskSessionIdleTimeoutSeconds: 7200,
    updatedBy: 'user_admin',
    updatedAt: '2026-04-27T10:00:00.000Z',
  };
}

describe('governance page layout', () => {
  beforeEach(() => {
    mockLoadCapabilities.mockReset();
    mockLoadCapabilities.mockResolvedValue(null);
    vi.mocked(analysisService.getCurrentPolicy).mockReset();
    vi.mocked(analysisService.updateCurrentPolicy).mockReset();
    vi.mocked(analysisService.getLianruanCrmConfig).mockReset();
    vi.mocked(analysisService.updateLianruanCrmConfig).mockReset();
    vi.mocked(analysisService.testLianruanCrmConfig).mockReset();
    vi.mocked(analysisService.getLianruanCrmDiagnostics).mockReset();
    vi.mocked(analysisService.listGovernanceTemplates).mockReset();
    vi.mocked(analysisService.createGovernanceTemplate).mockReset();
    vi.mocked((analysisService as any).listAnalysisSemanticKnowledgeAssets).mockReset();
    vi.mocked(analysisService.listAiModelProfiles).mockReset();
    vi.mocked(analysisService.getAiContextPolicy).mockReset();
    vi.mocked(analysisService.getLianruanCrmConfig).mockResolvedValue({
      useRuntimeConfig: false,
      enabled: false,
      effectiveEnabled: false,
      source: 'env',
      baseUrl: '',
      appKeyPresent: false,
      appSecretPresent: false,
      timeoutMs: 12000,
      tokenCacheBufferSeconds: 60,
    });
    vi.mocked(analysisService.getLianruanCrmDiagnostics).mockResolvedValue({
      enabled: false,
      message: '联软标准 OpenAPI 尚未启用。',
      config: {
        baseUrlPresent: false,
        appKeyPresent: false,
        appSecretPresent: false,
        timeoutMs: 12000,
        tokenCacheBufferSeconds: 60,
      },
    });
  });

  it('查询模板管理页应移除页头迁移标题和左右辅助区，只保留模板列表主工作区', async () => {
    vi.mocked(analysisService.listGovernanceTemplates).mockResolvedValue({
      items: [],
    });

    const wrapper = mount(QueryTemplatePage);
    await flushPromises();

    expect(wrapper.find('.page-header--compact').exists()).toBe(false);
    expect(wrapper.find('.business-visual-anchor').exists()).toBe(false);
    expect(wrapper.find('.query-template-library__rail').exists()).toBe(false);
    expect(wrapper.find('.query-template-library__detail').exists()).toBe(false);
    expect(wrapper.findAll('.panel')[0].text()).toContain('模板列表');
    expect(wrapper.findAll('.panel')[0].text()).toContain('新增模板');
    expect(wrapper.findAll('.panel')[0].text()).not.toContain('查询模板管理');
    expect(wrapper.text()).not.toContain('业务分类');
    expect(wrapper.text()).not.toContain('方案详情');
    expect(wrapper.text()).not.toContain('当前分类');
    expect(wrapper.text()).not.toContain('语义资产治理');
    expect(wrapper.text()).not.toContain('最近发布版本');
    expect(wrapper.text()).not.toContain('默认条件来源');
  });

  it('连接策略管理页应移除页头迁移标题，只保留阈值面板与保存操作', async () => {
    vi.mocked(analysisService.getCurrentPolicy).mockResolvedValue(buildPolicy());

    const wrapper = mount(ConnectionPolicyPage);
    await flushPromises();

    expect(wrapper.find('.page-header--compact').exists()).toBe(false);
    const thresholdPanel = wrapper.findAll('.panel').find((panel) =>
      panel.text().includes('会话与并发阈值'),
    );
    expect(thresholdPanel?.text()).toContain('保存连接策略');
    expect(thresholdPanel?.text()).not.toContain('连接策略管理');
  });

  it('连接策略保存后应刷新当前会话能力快照', async () => {
    vi.mocked(analysisService.getCurrentPolicy).mockResolvedValue(buildPolicy());
    vi.mocked(analysisService.updateCurrentPolicy).mockResolvedValue(buildPolicy());

    const wrapper = mount(ConnectionPolicyPage);
    await flushPromises();

    const pageVm = wrapper.vm as unknown as {
      savePolicy: () => Promise<void>;
    };
    await pageVm.savePolicy();

    expect(mockLoadCapabilities).toHaveBeenCalledTimes(1);
  });

  it('AI配置页应同时展示 HTTP Profile 与上下文策略分区', async () => {
    vi.mocked(analysisService.listAiModelProfiles).mockResolvedValue({
      items: [buildHttpProfile()],
      activation: {
        activeProfileId: 'profile_http',
        activatedBy: 'user_admin',
        activatedAt: '2026-04-18T10:01:00.000Z',
        lastVerifiedAt: '2026-04-18T10:01:05.000Z',
        lastVerificationStatus: 'SUCCEEDED',
      },
    });
    vi.mocked(analysisService.getAiContextPolicy).mockResolvedValue(buildContextPolicy());

    const wrapper = mount(AiModelProfilePage);
    await flushPromises();

    expect(wrapper.text()).toContain('当前激活配置');
    expect(wrapper.text()).toContain('环境默认 OpenAI 兼容 HTTP');
    expect(wrapper.text()).toContain('claude-sonnet-4-20250514');
    expect(wrapper.text()).toContain('上下文策略');
    expect(wrapper.text()).toContain('普通对话会话失活时长');
    expect(wrapper.text()).not.toContain('Codex SDK');
    expect(wrapper.text()).not.toContain('Claude SDK');
    expect(wrapper.find('.governance-side-column').exists()).toBe(false);
  });
});
