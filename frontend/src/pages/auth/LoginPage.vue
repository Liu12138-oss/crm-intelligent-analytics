<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ElAlert, ElButton, ElInput } from 'element-plus';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import logoImage from '@/images/logo/logo.png';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import type { WecomLoginInitiateView } from '@/types/auth';
import { UiIcons } from '@/ui/icons';
import {
  normalizeWecomLoginErrorMessage,
  normalizeWecomRouteFeedbackMessage,
  WECOM_LOGIN_UNAVAILABLE_MESSAGE,
} from '@/utils/wecom-login-feedback';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

function resolveWecomExchangePayloadFromQuery(query: Record<string, unknown>): {
  code?: string;
  state?: string;
} {
  const code =
    typeof query.code === 'string' && query.code.trim()
      ? query.code.trim()
      : typeof query.authCode === 'string' && query.authCode.trim()
        ? query.authCode.trim()
        : undefined;
  const state =
    typeof query.state === 'string' && query.state.trim()
      ? query.state.trim()
      : undefined;

  return {
    code,
    state,
  };
}

/**
 * 解析企业微信扫码回流 hash 中的换票参数。
 *
 * 参数说明：`hash` 为当前路由 hash，支持 `#wecom-login?state=...&code=...`。
 * 返回值：解析成功时返回扫码 code/state；缺少参数时返回空对象。
 * 设计原因：部分门户网关会拦截带 query 的深链接，hash 不会发送到服务器，可绕开网关二次 302。
 */
function resolveWecomExchangePayloadFromHash(hash: unknown): {
  code?: string;
  state?: string;
} {
  if (typeof hash !== 'string' || !hash.trim()) {
    return {};
  }

  const normalizedHash = hash.trim().replace(/^#/u, '');
  const queryText = normalizedHash.startsWith('wecom-login?')
    ? normalizedHash.slice('wecom-login?'.length)
    : normalizedHash;
  const params = new URLSearchParams(queryText);
  const code = params.get('code')?.trim() || params.get('authCode')?.trim();
  const state = params.get('state')?.trim();

  return {
    code: code || undefined,
    state: state || undefined,
  };
}

/**
 * 合并解析扫码回流参数，兼容旧 query 链路和新 hash 链路。
 */
function resolveWecomExchangePayloadFromRoute(): {
  code?: string;
  state?: string;
} {
  const queryPayload = resolveWecomExchangePayloadFromQuery(route.query);
  if (queryPayload.code && queryPayload.state) {
    return queryPayload;
  }

  return resolveWecomExchangePayloadFromHash(route.hash);
}

/**
 * 解析扫码回流错误提示，兼容 query 与 hash 两种来源。
 */
function resolveWecomRouteAuthError(): unknown {
  if (typeof route.query.authError === 'string' && route.query.authError.trim()) {
    return route.query.authError;
  }

  if (typeof route.hash !== 'string' || !route.hash.trim()) {
    return undefined;
  }

  const normalizedHash = route.hash.trim().replace(/^#/u, '');
  const queryText = normalizedHash.startsWith('wecom-login?')
    ? normalizedHash.slice('wecom-login?'.length)
    : normalizedHash;
  return new URLSearchParams(queryText).get('authError') ?? undefined;
}

const initialWecomExchangePayload = resolveWecomExchangePayloadFromRoute();
const hasInitialWecomExchangePayload = Boolean(
  initialWecomExchangePayload.code && initialWecomExchangePayload.state,
);

const mode = ref<'password' | 'wecom'>(
  hasInitialWecomExchangePayload ? 'wecom' : 'password',
);
const form = reactive({
  login: '',
  password: '',
});
const feedback = ref('');
const wecomBindToken = ref('');
const wecomLogin = ref<WecomLoginInitiateView | null>(null);
const wecomWidgetLoading = ref(false);
const wecomExchangeLoading = ref(hasInitialWecomExchangePayload);
const wecomExchangeStarted = ref(false);
const wecomWidgetMountRef = ref<HTMLElement | null>(null);
const supportOpen = ref(false);
const supportRef = ref<HTMLElement | null>(null);
let wecomWidgetScriptLoading: Promise<void> | null = null;

const redirectPath = computed(() => {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.startsWith('/')
    ? redirect
    : '/governance/ai-models';
});

/**
 * 提取需要跨登录跳转保留的门户代理参数。
 *
 * 返回值：当前路由上有效的门户代理查询参数；没有时返回空对象。
 * 设计原因：扫码或账号登录完成后的前端跳转如果丢失门户代理参数，用户刷新时可能再次落到网关 302 页面。
 */
function resolvePortalPersistedQuery(): Record<string, string> {
  const gratuitousProxy = route.query.GratuitousProxy;
  return typeof gratuitousProxy === 'string' && gratuitousProxy.trim()
    ? { GratuitousProxy: gratuitousProxy }
    : {};
}

/**
 * 构造登录成功后的跳转目标。
 *
 * 参数说明：`targetPath` 为登录前记录的业务路径。
 * 返回值：无门户代理参数时返回原始路径；有代理参数时返回带查询参数的路由位置对象。
 */
function buildLoginRedirectLocation(targetPath: string): RouteLocationRaw {
  const persistedQuery = resolvePortalPersistedQuery();
  if (Object.keys(persistedQuery).length === 0) {
    return targetPath;
  }

  const [path, search = ''] = targetPath.split('?');
  return {
    path,
    query: {
      ...Object.fromEntries(new URLSearchParams(search)),
      ...persistedQuery,
    },
  };
}

/**
 * 为登录页挂载独立 body 类，避免全局最小宽度影响缩放和响应式布局。
 */
function mountLoginPageBodyClass(): void {
  document.body.classList.add('page-body--login');
}

/**
 * 页面卸载时移除登录页专用类，避免影响其他业务页布局。
 */
function unmountLoginPageBodyClass(): void {
  document.body.classList.remove('page-body--login');
}

/**
 * 清理企业微信登录组件挂载点，避免切换登录方式后残留旧 iframe。
 */
function clearWecomWidgetMount(): void {
  const mountPoint = wecomWidgetMountRef.value;
  if (mountPoint) {
    mountPoint.innerHTML = '';
  }
}

/**
 * 重置企业微信登录态缓存，确保重新进入扫码标签时重新拉取二维码配置。
 */
function resetWecomLoginState(): void {
  wecomLogin.value = null;
  wecomExchangeLoading.value = false;
  wecomExchangeStarted.value = false;
  clearWecomWidgetMount();
}

/**
 * 判断企业微信扫码是否应改走整页授权跳转。
 *
 * 返回值说明：Safari 浏览器返回 `true`，其它主流浏览器继续使用内嵌二维码。
 * 设计原因：Safari 16 会拦截跨域 iframe 在扫码确认后发起顶层跳转，导致用户停留在空白或无响应页面；
 * 整页进入企业微信授权页后，回调由顶层页面完成，不会触发该安全限制。
 */
function shouldUseWecomFullPageRedirect(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isSafari = /Safari/iu.test(userAgent);
  const isChromiumOrOtherShell =
    /Chrome|Chromium|CriOS|FxiOS|Edg|EdgiOS|OPR|OPiOS/iu.test(userAgent);
  return isSafari && !isChromiumOrOtherShell;
}

/**
 * 将企业微信扫码回流的错误文案转成可直接展示给用户的提示。
 */
/**
 * 统一格式化登录页网络请求失败提示，避免把底层 fetch 文案直接暴露给用户。
 */
function normalizeLoginRequestErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  if (!error.message.trim()) {
    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: unknown };
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // 继续使用规范化的本地提示。
  }

  if (error.message === 'Failed to fetch' || error.message === 'fetch failed') {
    return '当前无法连接登录服务，请检查网络后重试。';
  }

  return error.message;
}

/**
 * 当企业微信扫码回流到登录页后，前端主动发起换票并展示加载态。
 *
 * 设计原因：
 * 1. 避免浏览器长时间停留在后端 callback 文档请求上，看起来像“页面卡死”；
 * 2. 用户始终停留在登录页，可感知当前正在登录、失败原因和下一步动作；
 * 3. 复用已有 `POST /auth/wecom/exchange` 接口，让后端继续负责 state 校验和会话落盘。
 */
async function completeWecomLoginFromRoute(): Promise<void> {
  const { code, state } = resolveWecomExchangePayloadFromRoute();

  if (!code || !state || wecomExchangeStarted.value) {
    return;
  }

  mode.value = 'wecom';
  supportOpen.value = false;
  feedback.value = '';
  wecomExchangeLoading.value = true;
  wecomExchangeStarted.value = true;
  clearWecomWidgetMount();

  try {
    await authStore.loginWithWecomCode({
      code,
      state,
    });
    await router.replace(buildLoginRedirectLocation(redirectPath.value));
  } catch (error) {
    const message = normalizeWecomLoginErrorMessage(
      error,
      '企业微信登录换票失败，请稍后重试。',
    );
    await router.replace({
      name: 'login',
      query: typeof route.query.redirect === 'string'
        ? { redirect: route.query.redirect }
        : {},
    });
    mode.value = 'password';
    feedback.value = message === WECOM_LOGIN_UNAVAILABLE_MESSAGE ? '' : message;
  } finally {
    wecomExchangeLoading.value = false;
    wecomExchangeStarted.value = false;
  }
}

const adminContacts = [
  { name: '王亮', phone: '19806510901' },
  { name: '邱凤云', phone: '18503081052' },
] as const;

watch(
  () => [route.query.authError, route.hash],
  () => {
    feedback.value = normalizeWecomRouteFeedbackMessage(resolveWecomRouteAuthError());
  },
  { immediate: true },
);

watch(
  () => route.query.wecomBindToken,
  (value) => {
    if (typeof value === 'string' && value.trim()) {
      wecomBindToken.value = value.trim();
      mode.value = 'password';
    }
  },
  { immediate: true },
);

watch(
  () => route.query.wecomBindPrompt,
  (value) => {
    if (typeof value === 'string' && value.trim()) {
      feedback.value = decodeURIComponent(value);
      mode.value = 'password';
    }
  },
  { immediate: true },
);

watch(
  () => route.query.reason,
  (value) => {
    if (typeof value === 'string' && value === 'expired') {
      feedback.value = '登录状态已失效，请重新登录。';
    }
  },
  { immediate: true },
);

watch(
  () => [route.query.code, route.query.authCode, route.query.state, route.hash],
  async () => {
    await completeWecomLoginFromRoute();
  },
  { immediate: true },
);

/**
 * 处理账号密码登录。
 */
async function submitPasswordLogin(): Promise<void> {
  if (!form.login.trim() || !form.password.trim()) {
    feedback.value = '请输入账号和密码后再登录。';
    return;
  }

  feedback.value = '';
  try {
    await authStore.loginWithPassword({
      login: form.login.trim(),
      password: form.password,
      wecomBindToken: wecomBindToken.value || undefined,
    });
    await router.replace(buildLoginRedirectLocation(redirectPath.value));
  } catch (error) {
    feedback.value = normalizeLoginRequestErrorMessage(
      error,
      '登录失败，请稍后重试。',
    );
  }
}

/**
 * 切换登录方式。
 */
async function switchMode(nextMode: 'password' | 'wecom'): Promise<void> {
  feedback.value = '';
  supportOpen.value = false;

  if (nextMode === 'wecom') {
    await openWecomLoginPanel();
    return;
  }

  mode.value = 'password';
  clearWecomWidgetMount();
}

/**
 * 拉取企业微信网页登录配置。
 */
async function prepareWecomLogin(): Promise<boolean> {
  if (wecomWidgetLoading.value || wecomLogin.value) {
    return Boolean(wecomLogin.value?.widget);
  }

  wecomWidgetLoading.value = true;
  try {
    wecomLogin.value = await authService.startWecomLogin();
    if (wecomLogin.value.reason) {
      feedback.value = wecomLogin.value.reason;
    }

    if (wecomLogin.value.authorizeUrl && shouldUseWecomFullPageRedirect()) {
      window.location.assign(wecomLogin.value.authorizeUrl);
      return false;
    }

    if (wecomLogin.value.widget) {
      return true;
    }

    if (wecomLogin.value.authorizeUrl) {
      window.location.assign(wecomLogin.value.authorizeUrl);
    }
    return false;
  } catch (error) {
    const message = normalizeWecomLoginErrorMessage(
      error,
      '企业微信登录发起失败，请稍后重试。',
    );
    feedback.value = message === WECOM_LOGIN_UNAVAILABLE_MESSAGE ? '' : message;
    return false;
  } finally {
    wecomWidgetLoading.value = false;
  }
}

/**
 * 在二维码挂载节点已经渲染到 DOM 后，再实际初始化企业微信扫码组件。
 */
async function openWecomLoginPanel(): Promise<void> {
  resetWecomLoginState();
  const shouldOpenWecomPanel = await prepareWecomLogin();
  if (!shouldOpenWecomPanel || !wecomLogin.value?.widget) {
    return;
  }

  mode.value = 'wecom';
  await nextTick();
  await renderWecomWidget(wecomLogin.value);
}

/**
 * 渲染企业微信官方网页登录组件。
 */
async function renderWecomWidget(config: WecomLoginInitiateView): Promise<void> {
  if (!config.widget) {
    return;
  }

  if (!wecomWidgetScriptLoading) {
    wecomWidgetScriptLoading = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-wecom-login-widget]',
      );
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://wwcdn.weixin.qq.com/node/wework/wwopen/js/wwLogin-1.2.7.js';
      script.async = true;
      script.dataset.wecomLoginWidget = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('企业微信扫码组件加载失败。'));
      document.head.appendChild(script);
    });
  }

  await wecomWidgetScriptLoading;
  const mountPoint = wecomWidgetMountRef.value;
  if (!mountPoint) {
    return;
  }

  mountPoint.innerHTML = '';
  const widgetFactory = (window as Window & {
    WwLogin?: new (options: Record<string, unknown>) => unknown;
  }).WwLogin;
  if (!widgetFactory) {
    throw new Error('企业微信扫码组件未成功挂载。');
  }

  new widgetFactory({
    id: 'wecom-login-widget',
    appid: config.widget.appId,
    agentid: config.widget.agentId,
    redirect_uri: config.widget.redirectUri,
    state: config.widget.state,
    scope: config.widget.scope ?? 'snsapi_privateinfo',
    self_redirect: false,
  });
}

/**
 * 切换联系管理员信息展示，用于移动端点击展开。
 */
function toggleSupportPanel(): void {
  supportOpen.value = !supportOpen.value;
}

/**
 * 点击联系管理员区域外时自动收起信息框。
 */
function handleSupportOutsideClick(event: MouseEvent): void {
  if (!supportOpen.value) {
    return;
  }
  const target = event.target as Node | null;
  const supportEl = supportRef.value;
  if (supportEl && target && supportEl.contains(target)) {
    return;
  }
  supportOpen.value = false;
}

onBeforeUnmount(() => {
  resetWecomLoginState();
  unmountLoginPageBodyClass();
  document.removeEventListener('click', handleSupportOutsideClick);
});

onMounted(() => {
  mountLoginPageBodyClass();
  document.addEventListener('click', handleSupportOutsideClick);
});
</script>

<template>
  <div class="login-page">
    <header class="login-page__brand">
      <div class="login-page__brand-mark">
        <img
          class="login-page__brand-logo"
          :src="logoImage"
          alt="CRM 智能业务平台标志"
        >
        <div class="login-page__brand-copy">
          <h1 class="login-page__brand-title">
            CRM 智能业务平台
          </h1>
          <p class="login-page__brand-subtitle">
            统一客户经营入口
          </p>
        </div>
      </div>
    </header>

    <div class="login-page__canvas">
      <section class="login-page__panel">
        <div class="login-card">
          <h2 class="login-card__title">
            登录 CRM 智能业务平台
          </h2>

          <el-alert
            v-if="feedback"
            class="login-card__feedback"
            type="warning"
            :closable="false"
            show-icon
          >
            {{ feedback }}
          </el-alert>

          <div
            class="login-card__tabs"
            role="tablist"
            aria-label="登录方式切换"
          >
            <el-button
              class="login-card__tab"
              :class="{ 'login-card__tab--active': mode === 'password' }"
              :disabled="wecomWidgetLoading || wecomExchangeLoading"
              @click="switchMode('password')"
            >
              账号登录
            </el-button>
            <el-button
              class="login-card__tab"
              :class="{ 'login-card__tab--active': mode === 'wecom' }"
              :disabled="wecomWidgetLoading || wecomExchangeLoading"
              :loading="wecomWidgetLoading"
              :aria-busy="wecomWidgetLoading ? 'true' : 'false'"
              @click="switchMode('wecom')"
            >
              {{ wecomWidgetLoading ? '加载中...' : '企业微信登录' }}
            </el-button>
          </div>

          <div
            class="login-card__mode-panel"
            :class="
              mode === 'password'
                ? 'login-card__mode-panel--password'
                : 'login-card__mode-panel--wecom'
            "
          >
            <template v-if="mode === 'password'">
              <label class="login-card__field">
                <span>账号</span>
                <el-input
                  v-model="form.login"
                  class="input login-card__input"
                  placeholder="请输入 CRM 账号或手机号"
                  :prefix-icon="UiIcons.user"
                />
              </label>

              <label class="login-card__field">
                <span>密码</span>
                <el-input
                  v-model="form.password"
                  class="input login-card__input"
                  type="password"
                  show-password
                  placeholder="请输入登录密码"
                  :prefix-icon="UiIcons.password"
                  @keyup.enter="submitPasswordLogin"
                />
              </label>

              <div
                ref="supportRef"
                class="login-card__support"
                :class="{ 'login-card__support--open': supportOpen }"
              >
                <el-button
                  class="login-card__support-trigger"
                  link
                  aria-haspopup="dialog"
                  :aria-expanded="supportOpen"
                  aria-controls="login-admin-contact"
                  @click="toggleSupportPanel"
                >
                  联系管理员
                </el-button>
                <div
                  id="login-admin-contact"
                  class="login-card__support-panel"
                >
                  <p class="login-card__support-title">
                    管理员信息
                  </p>
                  <ul class="login-card__support-list">
                    <li
                      v-for="contact in adminContacts"
                      :key="contact.phone"
                    >
                      <span class="login-card__support-name">{{ contact.name }}</span>
                      <span class="login-card__support-phone">{{ contact.phone }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <el-button
                class="button-primary login-card__primary"
                type="primary"
                native-type="button"
                :disabled="authStore.isSubmitting"
                :loading="authStore.isSubmitting"
                :aria-busy="authStore.isSubmitting ? 'true' : 'false'"
                @click="submitPasswordLogin"
              >
                {{ authStore.isSubmitting ? '登录中...' : '登录' }}
              </el-button>
            </template>

            <template v-else>
              <div class="login-card__qrcode">
                <div
                  v-if="wecomExchangeLoading"
                  class="login-card__qrcode-pending"
                  role="status"
                  aria-live="polite"
                >
                  <div class="login-card__qrcode-spinner" />
                  <p class="login-card__qrcode-pending-title">
                    正在完成企业微信登录
                  </p>
                  <p class="login-card__qrcode-pending-hint">
                    请保持当前页面，系统正在校验扫码结果并建立登录会话。
                  </p>
                </div>
                <div
                  v-else-if="wecomLogin?.widget"
                  id="wecom-login-widget"
                  ref="wecomWidgetMountRef"
                  class="login-card__qrcode-widget"
                />
                <div
                  v-else
                  class="login-card__qrcode-box"
                >
                  {{ wecomWidgetLoading ? '加载扫码中...' : '企业微信扫码区' }}
                </div>
                <el-button
                  v-if="!wecomExchangeLoading && !wecomWidgetLoading"
                  class="login-card__qrcode-retry"
                  link
                  @click="openWecomLoginPanel"
                >
                  重新获取二维码
                </el-button>
                <p class="login-card__qrcode-hint">
                  {{
                    wecomExchangeLoading
                      ? '正在验证扫码结果，若超过 45 秒仍未完成，请刷新后重试'
                      : '请使用已绑定 CRM 的企业微信扫码'
                  }}
                </p>
              </div>
            </template>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
