import {
  createRouter,
  createWebHistory,
  type LocationQueryRaw,
  type RouteLocationNormalized,
  type RouteLocationRaw,
} from 'vue-router';
import AiModelProfilePage from '@/pages/governance/AiModelProfilePage.vue';
import IntegrationsPage from '@/pages/governance/IntegrationsPage.vue';
import LoginPage from '@/pages/auth/LoginPage.vue';
import ForbiddenPage from '@/pages/auth/ForbiddenPage.vue';
import WecomLoginCallbackPage from '@/pages/auth/WecomLoginCallbackPage.vue';
import { useAuthStore } from '@/stores/auth.store';
import { pinia } from '@/stores/pinia';
import { markRouteConfirmed } from '@/services/navigation-performance.service';
import { normalizeAppBasePath } from '@/utils/app-base-path';

export const appRoutes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { title: '登录', layout: 'plain', guestOnly: true },
  },
  {
    path: '/wecom-login/callback',
    name: 'wecom-login-callback',
    component: WecomLoginCallbackPage,
    meta: {
      title: '企业微信登录中',
      layout: 'plain',
      skipSessionHydration: true,
    },
  },
  {
    path: '/forbidden',
    name: 'forbidden',
    component: ForbiddenPage,
    meta: {
      title: '无可用权限',
      requiresAuth: true,
    },
  },
  {
    path: '/',
    redirect: '/governance/ai-models',
  },
  {
    path: '/governance/ai-models',
    name: 'governance-ai-models',
    component: AiModelProfilePage,
    meta: {
      title: 'AI配置',
      section: 'governance',
      requiresAuth: true,
      requiredAction: 'ai_profile.manage',
      requiredMenu: 'ai-model-governance',
    },
  },
  {
    path: '/governance/integrations',
    name: 'governance-integrations',
    component: IntegrationsPage,
    meta: {
      title: '联调管理',
      section: 'governance',
      requiresAuth: true,
      requiredAction: 'governance.policy.manage',
      requiredMenu: 'connection-policy',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/governance/ai-models',
  },
];

const appTitle = 'AI 企微机器人核心';

/**
 * 基于当前 capability 快照推导用户可进入的首个业务首页。
 *
 * 设计原因：
 * 1. 登录成功不等于一定拥有业务菜单权限；
 * 2. 当 capability 为空时必须显式返回 null，交给调用方落到无权限页；
 * 3. 禁止继续用 `/analysis` 作为无权限兜底，否则会在守卫内形成自重定向循环。
 */
function resolveAuthorizedHome(authStore: ReturnType<typeof useAuthStore>): string | null {
  if (
    authStore.hasVisibleMenu('ai-model-governance') &&
    authStore.hasAction('ai_profile.manage')
  ) {
    return '/governance/ai-models';
  }

  if (
    authStore.hasVisibleMenu('connection-policy') &&
    authStore.hasAction('governance.policy.manage')
  ) {
    return '/governance/integrations';
  }

  return null;
}

/**
 * 统一计算“无法访问当前路由”时的安全落点。
 *
 * 设计原因：
 * 1. 优先把用户送到自己确实有权访问的首页；
 * 2. 如果一个可访问首页都没有，则必须落到独立无权限页；
 * 3. 避免守卫把同一条无权限路由再次重定向给自己，触发无限导航。
 */
function resolveGuardFallback(authStore: ReturnType<typeof useAuthStore>): string {
  return resolveAuthorizedHome(authStore) ?? '/forbidden';
}

const PORTAL_PERSISTED_QUERY_KEYS = ['GratuitousProxy'] as const;

/**
 * 提取门户平台要求跨路由保留的代理参数。
 *
 * 参数说明：`to` 为当前即将进入的路由。
 * 返回值：需要追加到守卫重定向目标上的查询参数。
 * 设计原因：门户平台会在 URL 中追加代理参数，守卫重定向如果丢失该参数，刷新或服务端落地时会被网关拦成 302 页面。
 */
function resolvePortalPersistedQuery(
  to: RouteLocationNormalized,
): LocationQueryRaw {
  return PORTAL_PERSISTED_QUERY_KEYS.reduce<LocationQueryRaw>((query, key) => {
    const value = to.query[key];
    if (typeof value === 'string' && value.trim()) {
      query[key] = value;
    }
    return query;
  }, {});
}

/**
 * 给守卫重定向目标追加门户代理参数。
 *
 * 参数说明：
 * - target: 原始重定向路径，允许带查询字符串。
 * - to: 当前即将进入的路由。
 *
 * 返回值：无代理参数时返回原始路径；有代理参数时返回 Vue Router 位置对象。
 */
function appendPortalPersistedQuery(
  target: string,
  to: RouteLocationNormalized,
): RouteLocationRaw {
  const persistedQuery = resolvePortalPersistedQuery(to);
  if (Object.keys(persistedQuery).length === 0) {
    return target;
  }

  const [path, search = ''] = target.split('?');
  const targetQuery = Object.fromEntries(new URLSearchParams(search));
  return {
    path,
    query: {
      ...targetQuery,
      ...persistedQuery,
    },
  };
}

const router = createRouter({
  history: createWebHistory(normalizeAppBasePath(import.meta.env.BASE_URL)),
  routes: appRoutes,
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia);
  const requiresAuth = Boolean(to.meta.requiresAuth);
  const skipSessionHydration = Boolean(to.meta.skipSessionHydration);
  const isWecomScanReturn =
    requiresAuth &&
    typeof to.query.login === 'string' &&
    to.query.login === 'wecom';

  if (!skipSessionHydration) {
    await authStore.hydrateSession();
  }

  // 扫码回流后的首次跳转可能与 Cookie 落盘存在极短竞态，补一次短延迟重试避免误判未登录。
  if (isWecomScanReturn && !authStore.isAuthenticated) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    authStore.hydrated = false;
    await authStore.hydrateSession(true);
  }

  if (requiresAuth && !authStore.isAuthenticated) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
        ...resolvePortalPersistedQuery(to),
      },
    };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    const redirect =
      typeof to.query.redirect === 'string'
        ? to.query.redirect
        : resolveGuardFallback(authStore);
    return appendPortalPersistedQuery(redirect, to);
  }

  const requiredMenu = typeof to.meta.requiredMenu === 'string' ? to.meta.requiredMenu : '';
  if (requiredMenu && !authStore.hasVisibleMenu(requiredMenu)) {
    return appendPortalPersistedQuery(resolveGuardFallback(authStore), to);
  }

  const requiredAction = typeof to.meta.requiredAction === 'string' ? to.meta.requiredAction : '';
  if (requiredAction && !authStore.hasAction(requiredAction)) {
    return appendPortalPersistedQuery(resolveGuardFallback(authStore), to);
  }

  if (to.meta.adminOnly && !authStore.hasAction('governance.policy.manage')) {
    return appendPortalPersistedQuery(resolveGuardFallback(authStore), to);
  }

  return true;
});

router.afterEach((to) => {
  markRouteConfirmed(to.path);
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : '';
  document.title = pageTitle ? `${pageTitle} - ${appTitle}` : appTitle;
});

export default router;
