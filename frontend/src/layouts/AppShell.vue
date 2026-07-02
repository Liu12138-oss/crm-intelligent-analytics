<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElIcon, ElTooltip } from 'element-plus';
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import logoImage from '@/images/logo/logo.png';
import {
  beginNavigationTrace,
  isShellTransitioning,
} from '@/services/navigation-performance.service';
import { useAuthStore } from '@/stores/auth.store';
import { UiIcons } from '@/ui/icons';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const isSidebarCollapsed = ref(false);
const logoutLoading = ref(false);
const PORTAL_PERSISTED_QUERY_KEYS = ['GratuitousProxy'] as const;

function isActive(itemPath: string): boolean {
  return route.path === itemPath;
}

const showMenuFallback = computed(() => !authStore.capabilities);

function canShowNavigationItem(menuKey: string, actionKey?: string): boolean {
  if (showMenuFallback.value) {
    return true;
  }

  const menuAllowed = authStore.hasVisibleMenu(menuKey);
  const actionAllowed = actionKey ? authStore.hasAction(actionKey) : true;
  return menuAllowed && actionAllowed;
}

const navigationGroups = computed(() => [
  {
    items: [
      {
        label: 'AI配置',
        to: '/governance/ai-models',
        icon: UiIcons.management,
        visible: canShowNavigationItem('ai-model-governance', 'ai_profile.manage'),
      },
      {
        label: '联调管理',
        to: '/governance/integrations',
        icon: UiIcons.connection,
        visible: canShowNavigationItem('connection-policy', 'governance.policy.manage'),
      },
    ].filter((item) => item.visible),
  },
]);

const collapseActionLabel = computed(() => (isSidebarCollapsed.value ? '展开导航' : '收起导航'));
const collapseIcon = computed(() => (isSidebarCollapsed.value ? UiIcons.arrowRight : UiIcons.arrowLeft));

function toggleSidebar(): void {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
}

function handleNavigationClick(targetPath: string): void {
  if (route.path === targetPath) {
    return;
  }

  beginNavigationTrace(targetPath);
}

/**
 * 提取门户平台需要跨路由保留的代理参数。
 *
 * 返回值：当前路由中有效的门户代理参数。
 * 设计原因：门户入口依赖 `GratuitousProxy` 继续回到同一个代理会话，退出登录或菜单切换时丢失该参数会落到门户 302 页面。
 */
function resolvePortalPersistedQuery(): Record<string, string> {
  return PORTAL_PERSISTED_QUERY_KEYS.reduce<Record<string, string>>((query, key) => {
    const value = route.query[key];
    if (typeof value === 'string' && value.trim()) {
      query[key] = value;
    }
    return query;
  }, {});
}

/**
 * 构造保留门户代理参数的站内导航目标。
 */
function buildPortalAwareRoute(targetPath: string): RouteLocationRaw {
  const persistedQuery = resolvePortalPersistedQuery();
  if (Object.keys(persistedQuery).length === 0) {
    return targetPath;
  }

  return {
    path: targetPath,
    query: persistedQuery,
  };
}

/**
 * 构造退出登录后的登录页位置。
 *
 * 返回值：登录页会携带当前业务页作为登录成功回跳目标。
 */
function buildLogoutLoginLocation(): RouteLocationRaw {
  const persistedQuery = resolvePortalPersistedQuery();
  return {
    name: 'login',
    query: {
      redirect: route.fullPath,
      ...persistedQuery,
    },
  };
}

async function logout(): Promise<void> {
  if (logoutLoading.value) {
    return;
  }

  logoutLoading.value = true;
  try {
    await authStore.logout();
    await router.replace(buildLogoutLoginLocation());
  } finally {
    logoutLoading.value = false;
  }
}
</script>

<template>
  <div
    class="shell"
    :class="{ 'shell--collapsed': isSidebarCollapsed }"
  >
    <header class="shell__header">
      <div class="shell__brand">
        <img
          class="shell__brand-logo"
          :src="logoImage"
          alt="AI 企微机器人核心标志"
        >
        <div class="shell__brand-copy">
          <p class="shell__brand-subtitle">
            AI 企微核心
          </p>
          <h1 class="shell__brand-title">
            AI 配置与机器人接入
          </h1>
        </div>
      </div>
      <div class="shell__actions">
        <div class="shell__chip">
          {{ authStore.currentUser?.name ?? '未登录用户' }}
        </div>
        <button
          class="shell__chip shell__chip--action shell__logout"
          :disabled="logoutLoading"
          :aria-busy="logoutLoading ? 'true' : 'false'"
          @click="logout"
        >
          <el-icon>
            <component :is="UiIcons.back" />
          </el-icon>
          {{ logoutLoading ? '退出中...' : '退出登录' }}
        </button>
      </div>
    </header>
    <div class="shell__body">
      <aside class="shell__sidebar">
        <button
          type="button"
          class="shell__sidebar-head"
          :title="collapseActionLabel"
          :aria-label="collapseActionLabel"
          :aria-pressed="isSidebarCollapsed ? 'true' : 'false'"
          @click="toggleSidebar"
        >
          <span class="shell__sidebar-head-label">点击切换导航</span>
          <span
            class="shell__collapse-button"
            aria-hidden="true"
          >
            <el-icon class="shell__collapse-button-icon">
              <component :is="collapseIcon" />
            </el-icon>
          </span>
        </button>
        <div
          v-for="group in navigationGroups"
          :key="group.items[0]?.to ?? 'main-navigation'"
          class="shell__group"
        >
          <el-tooltip
            v-for="item in group.items"
            :key="item.to"
            :content="item.label"
            placement="right"
            :show-after="120"
          >
            <RouterLink
              :to="buildPortalAwareRoute(item.to)"
              class="shell__nav-item"
              :class="{ 'shell__nav-item--active': isActive(item.to) }"
              :aria-label="item.label"
              @click="handleNavigationClick(item.to)"
            >
              <el-icon
                class="shell__nav-icon"
                aria-hidden="true"
              >
                <component :is="item.icon" />
              </el-icon>
              <span class="shell__nav-label">{{ item.label }}</span>
            </RouterLink>
          </el-tooltip>
        </div>
      </aside>
      <main
        class="shell__main"
        :class="{ 'shell__main--route-settling': isShellTransitioning }"
      >
        <div
          v-if="isShellTransitioning"
          class="shell__route-skeleton"
          aria-hidden="true"
        >
          <span class="shell__route-skeleton-line shell__route-skeleton-line--long" />
          <span class="shell__route-skeleton-line shell__route-skeleton-line--medium" />
          <span class="shell__route-skeleton-line shell__route-skeleton-line--short" />
        </div>
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell__main {
  position: relative;
}

.shell__main--route-settling {
  overflow: hidden;
}

.shell__route-skeleton {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.88)),
    radial-gradient(circle at top left, rgba(125, 211, 252, 0.16), transparent 28%);
  backdrop-filter: blur(2px);
}

.shell__route-skeleton-line {
  display: block;
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(191, 219, 254, 0.45), rgba(226, 232, 240, 0.92));
}

.shell__route-skeleton-line--long {
  width: min(420px, 72%);
}

.shell__route-skeleton-line--medium {
  width: min(320px, 54%);
}

.shell__route-skeleton-line--short {
  width: min(180px, 32%);
}
</style>
