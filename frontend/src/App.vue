<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import { RouterView } from 'vue-router';
import AppShell from '@/layouts/AppShell.vue';
import { markShellVisible } from '@/services/navigation-performance.service';

const route = useRoute();
const showShell = computed(() => route.meta.layout !== 'plain');
const cachedShellRouteNames = new Set([
  'governance-ai-models',
  'governance-integrations',
]);

function shouldCacheShellRoute(currentRoute: {
  name?: string | symbol | null;
}): boolean {
  return typeof currentRoute.name === 'string' && cachedShellRouteNames.has(currentRoute.name);
}

watch(
  () => route.fullPath,
  async () => {
    if (!showShell.value) {
      return;
    }

    await nextTick();
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        markShellVisible(route.path);
      });
      return;
    }

    markShellVisible(route.path);
  },
);
</script>

<template>
  <AppShell v-if="showShell">
    <RouterView v-slot="{ Component, route: currentRoute }">
      <KeepAlive>
        <component
          :is="Component"
          v-if="shouldCacheShellRoute(currentRoute)"
          :key="String(currentRoute.name ?? currentRoute.path)"
        />
      </KeepAlive>
      <component
        :is="Component"
        v-if="!shouldCacheShellRoute(currentRoute)"
        :key="currentRoute.fullPath"
      />
    </RouterView>
  </AppShell>
  <RouterView v-else />
</template>
