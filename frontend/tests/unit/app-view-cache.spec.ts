import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';

vi.mock('@/layouts/AppShell.vue', () => ({
  default: defineComponent({
    name: 'AppShellStub',
    template: '<div class="app-shell-stub"><slot /></div>',
  }),
}));

import App from '@/App.vue';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

describe('app view cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('核心 AI 配置页在参数切换后应复用已缓存实例', async () => {
    let aiModelMountCount = 0;

    const AiModelPage = defineComponent({
      name: 'AiModelPage',
      setup() {
        aiModelMountCount += 1;
        const clickCount = ref(0);
        return { clickCount };
      },
      template:
        '<button class="ai-model-counter" @click="clickCount += 1">ai-model-{{ clickCount }}</button>',
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/governance/ai-models',
          name: 'governance-ai-models',
          component: AiModelPage,
        },
      ],
    });

    await router.push('/governance/ai-models');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    await wrapper.find('.ai-model-counter').trigger('click');
    await flushPromises();

    await router.push('/governance/ai-models?tab=context');
    await flushPromises();

    expect(aiModelMountCount).toBe(1);
    expect(wrapper.find('.ai-model-counter').text()).toBe('ai-model-1');
  });
});
