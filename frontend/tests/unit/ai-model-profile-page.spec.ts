import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AiProfileFormDrawer from '@/components/governance/AiProfileFormDrawer.vue';
import AiProfileHealthCheckDialog from '@/components/governance/AiProfileHealthCheckDialog.vue';
import AiProfileSummaryCard from '@/components/governance/AiProfileSummaryCard.vue';
import AiProfileTable from '@/components/governance/AiProfileTable.vue';
import AiModelProfilePage from '@/pages/governance/AiModelProfilePage.vue';
import { appRoutes } from '@/router';
import { analysisService } from '@/services/analysis.service';
import type { AiModelProfileItem } from '@/types/analysis';

vi.mock('@/services/analysis.service', () => ({
  analysisService: {
    listAiModelProfiles: vi.fn(),
    getAiContextPolicy: vi.fn(),
    updateAiContextPolicy: vi.fn(),
    createAiModelProfile: vi.fn(),
    updateAiModelProfile: vi.fn(),
    draftHealthCheckAiModelProfile: vi.fn(),
    copyAiModelProfile: vi.fn(),
    deleteAiModelProfile: vi.fn(),
    clearAiModelProfileSecret: vi.fn(),
    setAiModelProfileStatus: vi.fn(),
    healthCheckAiModelProfile: vi.fn(),
    activateAiModelProfile: vi.fn(),
  },
}));

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>();
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
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

function buildHttpProfile(
  overrides: Partial<AiModelProfileItem> = {},
): AiModelProfileItem {
  return {
    id: 'profile_http',
    name: '环境默认 OpenAI 兼容 HTTP',
    providerCode: 'anthropic-claude' as const,
    sourceType: 'ENV_BOOTSTRAPPED',
    sdkType: 'openai-compatible-http',
    model: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.leagsoft.ai/v1',
    secretConfigured: true,
    secretMask: '已配置',
    reasoningEffort: 'low',
    status: 'ACTIVE',
    sdkOptions: {
      platformPreset: 'manual',
      wireApi: 'chat_completions',
      structuredOutputMode: 'json_object',
      disableResponseStorage: true,
    },
    createdBy: 'system_env_bootstrap',
    updatedBy: 'system_env_bootstrap',
    createdAt: '2026-04-21T09:30:00.000Z',
    updatedAt: '2026-04-21T09:30:00.000Z',
    ...overrides,
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

describe('ai model profile page', () => {
  const inlineOverlayStubs = {
    ElDrawer: {
      template: '<div><slot /><slot name="footer" /></div>',
    },
    ElDialog: {
      template: '<div><slot /></div>',
    },
  };

  beforeEach(() => {
    vi.mocked(analysisService.listAiModelProfiles).mockReset();
    vi.mocked(analysisService.getAiContextPolicy).mockReset();
    vi.mocked(analysisService.updateAiContextPolicy).mockReset();
    vi.mocked(analysisService.createAiModelProfile).mockReset();
    vi.mocked(analysisService.updateAiModelProfile).mockReset();
    vi.mocked(analysisService.draftHealthCheckAiModelProfile).mockReset();
    vi.mocked(analysisService.copyAiModelProfile).mockReset();
    vi.mocked(analysisService.deleteAiModelProfile).mockReset();
    vi.mocked(analysisService.clearAiModelProfileSecret).mockReset();
    vi.mocked(analysisService.setAiModelProfileStatus).mockReset();
    vi.mocked(analysisService.healthCheckAiModelProfile).mockReset();
    vi.mocked(analysisService.activateAiModelProfile).mockReset();
  });

  it('AI配置路由应使用核心治理菜单和动作权限', () => {
    const route = appRoutes.find((item) => item.path === '/governance/ai-models');

    expect(route?.meta).toMatchObject({
      requiresAuth: true,
      requiredMenu: 'ai-model-governance',
      requiredAction: 'ai_profile.manage',
      title: 'AI配置',
    });
  });

  it('表单应只展示 OpenAI 兼容 HTTP 配置字段', async () => {
    const wrapper = mount(AiProfileFormDrawer, {
      props: {
        visible: true,
        profile: buildHttpProfile(),
      },
      global: {
        stubs: inlineOverlayStubs,
      },
    });

    await nextTick();

    expect(wrapper.text()).toContain('接入类型');
    expect(wrapper.text()).toContain('平台预设');
    expect(wrapper.text()).toContain('结构化输出模式');
    expect(wrapper.text()).toContain('禁用响应存储');
    expect(wrapper.text()).not.toContain('Codex SDK');
    expect(wrapper.text()).not.toContain('Claude SDK');
    expect(wrapper.text()).not.toContain('Codex 可执行路径');
    expect(wrapper.text()).not.toContain('Claude CLI 路径');
    expect(wrapper.text()).not.toContain('MCP 配置文件路径');
  });

  it('保存与测试都应固定提交 openai-compatible-http', async () => {
    const wrapper = mount(AiProfileFormDrawer, {
      props: {
        visible: true,
        profile: buildHttpProfile(),
      },
      global: {
        stubs: inlineOverlayStubs,
      },
    });

    await nextTick();

    await wrapper.find('button.el-button--primary').trigger('click');
    await wrapper.findAll('button').find((item) => item.text().includes('测试连接'))?.trigger('click');

    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual(
      expect.objectContaining({
        sdkType: 'openai-compatible-http',
        reasoningEffort: 'low',
      }),
    );
    expect(wrapper.emitted('test')?.[0]?.[0]).toEqual(
      expect.objectContaining({
        sdkType: 'openai-compatible-http',
      }),
    );
  });

  it('草稿测试成功后保存应同步最近测试状态', async () => {
    const createdProfile = buildHttpProfile({
      id: 'profile_deepseek',
      name: 'deepseek',
      providerCode: 'deepseek',
      sourceType: 'MANUAL',
      status: 'INACTIVE',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
      lastHealthCheckAt: undefined,
      lastHealthCheckStatus: undefined,
      lastHealthCheckLatencyMs: undefined,
      lastHealthCheckFailureReason: undefined,
    });
    const draftPayload = {
      name: 'deepseek',
      providerCode: 'deepseek',
      sdkType: 'openai-compatible-http',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'secret-key',
      reasoningEffort: 'low',
      sdkOptions: {
        platformPreset: 'deepseek',
        wireApi: 'chat_completions',
        structuredOutputMode: 'json_object',
        requiresOpenaiAuth: true,
        disableResponseStorage: true,
      },
    };

    vi.mocked(analysisService.listAiModelProfiles)
      .mockResolvedValueOnce({
        items: [buildHttpProfile()],
        activation: {
          activeProfileId: 'profile_http',
        },
      })
      .mockResolvedValue({
        items: [
          buildHttpProfile(),
          {
            ...createdProfile,
            lastHealthCheckStatus: 'SUCCEEDED',
            lastHealthCheckLatencyMs: 96,
          },
        ],
        activation: {
          activeProfileId: 'profile_http',
        },
      });
    vi.mocked(analysisService.draftHealthCheckAiModelProfile).mockResolvedValue({
      status: 'SUCCEEDED',
      latencyMs: 96,
      providerSummary: 'deepseek:deepseek-chat',
    });
    vi.mocked(analysisService.createAiModelProfile).mockResolvedValue(createdProfile);
    vi.mocked(analysisService.healthCheckAiModelProfile).mockResolvedValue({
      status: 'SUCCEEDED',
      latencyMs: 96,
      providerSummary: 'deepseek:deepseek-chat',
    });

    const wrapper = mount(AiModelProfilePage);
    await flushPromises();

    wrapper.findComponent(AiProfileFormDrawer).vm.$emit('test', draftPayload);
    await flushPromises();

    wrapper.findComponent(AiProfileFormDrawer).vm.$emit('save', draftPayload);
    await flushPromises();

    expect(analysisService.createAiModelProfile).toHaveBeenCalledWith(draftPayload);
    expect(analysisService.healthCheckAiModelProfile).toHaveBeenCalledWith(
      'profile_deepseek',
    );
  });

  it('新增配置缺少必填项时应阻止保存', async () => {
    const wrapper = mount(AiProfileFormDrawer, {
      props: {
        visible: true,
        profile: null,
      },
      global: {
        stubs: inlineOverlayStubs,
      },
    });

    await nextTick();
    await wrapper.find('button.el-button--primary').trigger('click');
    await nextTick();

    expect(wrapper.emitted('save')).toBeFalsy();
    expect(wrapper.text()).toContain('请填写配置名称');
    expect(wrapper.text()).toContain('请填写提供方标识');
    expect(wrapper.text()).toContain('请输入服务地址');
    expect(wrapper.text()).toContain('请输入密钥');
  });

  it('服务地址填写完整接口路径时应阻止保存并提示改填基础地址', async () => {
    const wrapper = mount(AiProfileFormDrawer, {
      props: {
        visible: true,
        profile: buildHttpProfile({
          providerCode: 'kimi-k2.5' as const,
          model: 'kimi-k2.5',
          baseUrl: 'https://api.lkeap.cloud.tencent.com/plan/v3',
          sdkOptions: {
            platformPreset: 'manual',
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
            disableResponseStorage: true,
          },
        }),
      },
      global: {
        stubs: inlineOverlayStubs,
      },
    });

    await nextTick();
    const baseUrlFormItem = wrapper
      .findAllComponents({ name: 'ElFormItem' })
      .find((item) => item.text().includes('服务地址'));
    await baseUrlFormItem?.find('input').setValue(
      'https://api.lkeap.cloud.tencent.com/plan/v3/chat/completions',
    );
    await wrapper.find('button.el-button--primary').trigger('click');
    await nextTick();

    expect(wrapper.emitted('save')).toBeFalsy();
    expect(wrapper.text()).toContain('服务地址请填写基础地址');
  });

  it('OpenAI 兼容 HTTP 配置填写 anthropic 网关地址时应阻止保存', async () => {
    const wrapper = mount(AiProfileFormDrawer, {
      props: {
        visible: true,
        profile: buildHttpProfile({
          providerCode: 'tencent-token-plan' as const,
          model: 'glm-5.1',
          baseUrl: 'https://api.lkeap.cloud.tencent.com/plan/v3',
          sdkOptions: {
            platformPreset: 'manual',
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
            disableResponseStorage: true,
          },
        }),
      },
      global: {
        stubs: inlineOverlayStubs,
      },
    });

    await nextTick();
    const baseUrlFormItem = wrapper
      .findAllComponents({ name: 'ElFormItem' })
      .find((item) => item.text().includes('服务地址'));
    await baseUrlFormItem?.find('input').setValue(
      'https://api.lkeap.cloud.tencent.com/plan/anthropic',
    );
    await wrapper.find('button.el-button--primary').trigger('click');
    await nextTick();

    expect(wrapper.emitted('save')).toBeFalsy();
    expect(wrapper.text()).toContain('请不要填写 /anthropic 网关');
  });

  it('健康检查弹层不应再展示 MCP 信息', () => {
    const wrapper = mount(AiProfileHealthCheckDialog, {
      props: {
        visible: true,
        result: {
          status: 'FAILED',
          latencyMs: 123,
          failureStage: 'HTTP_STATUS',
          failureReason: '403 forbidden',
          providerSummary: 'anthropic-claude:claude-sonnet-4-20250514',
        },
      },
      global: {
        stubs: inlineOverlayStubs,
      },
    });

    expect(wrapper.text()).toContain('失败原因');
    expect(wrapper.text()).not.toContain('MCP 状态');
    expect(wrapper.text()).not.toContain('legacy-mcp');
  });

  it('当前激活配置摘要应展示 HTTP Profile 信息', () => {
    const wrapper = mount(AiProfileSummaryCard, {
      props: {
        activation: {
          activeProfileId: 'profile_http',
        },
        activeProfile: buildHttpProfile(),
      },
    });

    expect(wrapper.text()).toContain('环境默认 OpenAI 兼容 HTTP');
    expect(wrapper.text()).toContain('claude-sonnet-4-20250514');
    expect(wrapper.text()).toContain('low');
  });

  it('当前激活配置摘要区样式应在桌面端按四列展示', () => {
    const styleText = readFileSync('src/styles/main.css', 'utf8');

    expect(styleText).toMatch(
      /\.ai-model-summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    );
  });

  it('列表应展示 OpenAI 兼容 HTTP 接入方式，不再出现历史 SDK 标签', () => {
    const wrapper = mount(AiProfileTable, {
      props: {
        items: [buildHttpProfile()],
        activation: {
          activeProfileId: 'profile_http',
        },
      },
    });

    const columns = wrapper.findAllComponents({ name: 'ElTableColumn' });
    expect(columns.map((item) => item.props('label'))).toEqual(
      expect.arrayContaining(['接入方式', '推理等级', '最近测试']),
    );
    expect(wrapper.text()).not.toContain('Codex SDK');
    expect(wrapper.text()).not.toContain('Claude SDK');
  });

  it('列表操作列应使用紧凑且不换行的统一按钮容器', () => {
    const sourceText = readFileSync(
      'src/components/governance/AiProfileTable.vue',
      'utf8',
    );
    const styleText = readFileSync('src/styles/main.css', 'utf8');

    expect(sourceText).toContain('class="ai-profile-table__actions table-action-buttons"');
    expect(sourceText).toContain('class-name="table-action-column"');
    expect(styleText).toMatch(
      /\.ai-profile-table__actions\s*\{[\s\S]*flex-wrap:\s*nowrap;[\s\S]*white-space:\s*nowrap;/,
    );
    expect(styleText).toMatch(
      /\.table-action-buttons \.el-button,[\s\S]*min-height:\s*32px;[\s\S]*height:\s*32px;/,
    );
    expect(styleText).toMatch(
      /\.table-action-column \.cell,[\s\S]*overflow:\s*visible;/,
    );
    expect(styleText).toMatch(
      /\.table-action-buttons \.el-button:hover,[\s\S]*transform:\s*none;/,
    );
  });

  it('抽屉密钥输入不应提供明文显隐切换', () => {
    const sourceText = readFileSync(
      'src/components/governance/AiProfileFormDrawer.vue',
      'utf8',
    );

    expect(sourceText).not.toContain('show-password');
  });

  it('页面应只展示 HTTP Profile 并支持测试与启用', async () => {
    vi.mocked(analysisService.listAiModelProfiles)
      .mockResolvedValueOnce({
        items: [buildHttpProfile()],
        activation: {
          activeProfileId: 'profile_http',
        },
      })
      .mockResolvedValue({
        items: [buildHttpProfile()],
        activation: {
          activeProfileId: 'profile_http',
        },
      });
    vi.mocked(analysisService.getAiContextPolicy).mockResolvedValue(buildContextPolicy());
    vi.mocked(analysisService.healthCheckAiModelProfile).mockResolvedValue({
      status: 'SUCCEEDED',
      latencyMs: 88,
      providerSummary: 'anthropic-claude:claude-sonnet-4-20250514',
    });
    vi.mocked(analysisService.activateAiModelProfile).mockResolvedValue({
      activeProfileId: 'profile_http',
    });

    const wrapper = mount(AiModelProfilePage);
    await flushPromises();

    expect(wrapper.text()).toContain('环境默认 OpenAI 兼容 HTTP');
    expect(wrapper.text()).toContain('上下文策略');
    expect(wrapper.text()).toContain('上一轮问题保留上限');
    expect(wrapper.text()).toContain('上一轮结果摘要保留上限');
    expect(wrapper.text()).not.toContain('Claude SDK');
    expect(wrapper.text()).not.toContain('Codex SDK');

    wrapper.findComponent(AiProfileTable).vm.$emit('healthCheck', buildHttpProfile());
    await flushPromises();
    expect(analysisService.healthCheckAiModelProfile).toHaveBeenCalledWith('profile_http');

    wrapper.findComponent(AiProfileTable).vm.$emit('activate', buildHttpProfile());
    await flushPromises();
    expect(analysisService.activateAiModelProfile).toHaveBeenCalledWith('profile_http');
  });
});
