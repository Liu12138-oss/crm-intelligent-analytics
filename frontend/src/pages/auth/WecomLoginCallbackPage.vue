<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElAlert } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import logoImage from '@/images/logo/logo.png';
import { useAuthStore } from '@/stores/auth.store';
import {
  normalizeWecomLoginErrorMessage,
  WECOM_LOGIN_UNAVAILABLE_MESSAGE,
} from '@/utils/wecom-login-feedback';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const feedback = ref('');
const loginStarted = ref(false);

const redirectPath = computed(() => {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.startsWith('/')
    ? redirect
    : '/governance/ai-models';
});

function resolveWecomExchangePayload(): { code?: string; state?: string } {
  const code =
    typeof route.query.code === 'string' && route.query.code.trim()
      ? route.query.code.trim()
      : typeof route.query.authCode === 'string' && route.query.authCode.trim()
        ? route.query.authCode.trim()
        : undefined;
  const state =
    typeof route.query.state === 'string' && route.query.state.trim()
      ? route.query.state.trim()
      : undefined;

  return {
    code,
    state,
  };
}

async function completeWecomLogin(): Promise<void> {
  if (loginStarted.value) {
    return;
  }

  const { code, state } = resolveWecomExchangePayload();
  if (!code || !state) {
    await router.replace({
      name: 'login',
      query: {
        authError: encodeURIComponent('企业微信登录回流缺少必要参数，请重新扫码。'),
        redirect: redirectPath.value,
      },
    });
    return;
  }

  loginStarted.value = true;
  feedback.value = '';

  try {
    await authStore.loginWithWecomCode({
      code,
      state,
    });
    await router.replace(redirectPath.value);
  } catch (error) {
    feedback.value = normalizeWecomLoginErrorMessage(
      error,
      '企业微信登录换票失败，请稍后重试。',
    );
    await router.replace({
      name: 'login',
      query:
        feedback.value === WECOM_LOGIN_UNAVAILABLE_MESSAGE
          ? { redirect: redirectPath.value }
          : {
              authError: encodeURIComponent(feedback.value),
              redirect: redirectPath.value,
            },
    });
  }
}

onMounted(() => {
  void completeWecomLogin();
});
</script>

<template>
  <div class="login-page">
    <header class="login-page__brand">
      <div class="login-page__brand-mark">
        <img
          class="login-page__brand-logo"
          :src="logoImage"
          alt="AI 企微机器人核心标志"
        >
        <div class="login-page__brand-copy">
          <h1 class="login-page__brand-title">
            AI 企微机器人核心
          </h1>
          <p class="login-page__brand-subtitle">
            AI 配置与企业微信机器人接入
          </p>
        </div>
      </div>
    </header>

    <div class="login-page__canvas">
      <section class="login-page__panel">
        <div class="login-card">
          <h2 class="login-card__title">
            正在完成企业微信登录
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

          <div class="login-card__mode-panel login-card__mode-panel--wecom">
            <div class="login-card__qrcode">
              <div
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
              <p class="login-card__qrcode-hint">
                正在验证扫码结果，若超过 45 秒仍未完成，请刷新后重试
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
