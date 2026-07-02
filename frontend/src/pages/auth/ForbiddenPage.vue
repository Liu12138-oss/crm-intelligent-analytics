<script setup lang="ts">
import { computed } from 'vue';
import { ElButton, ElIcon } from 'element-plus';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { UiIcons } from '@/ui/icons';

const router = useRouter();
const authStore = useAuthStore();

const currentUserName = computed(() => authStore.currentUser?.name ?? '当前账号');

/**
 * 引导用户重新回到登录入口。
 *
 * 设计原因：
 * 1. 当前账号已完成认证，但没有任何可进入的业务菜单；
 * 2. 显式提供返回入口，避免用户被困在空白壳层里只能手动改地址；
 * 3. 实际退出仍可使用页头统一的“退出登录”，这里仅负责导航回登录页说明问题。
 */
async function backToLogin(): Promise<void> {
  await router.replace('/login');
}
</script>

<template>
  <section class="panel forbidden-page">
    <div class="forbidden-page__icon">
      <el-icon>
        <component :is="UiIcons.warning" />
      </el-icon>
    </div>
    <div class="forbidden-page__content">
      <p class="forbidden-page__eyebrow">
        权限未开通
      </p>
      <h2 class="forbidden-page__title">
        {{ currentUserName }} 当前没有可访问的业务菜单
      </h2>
      <p class="forbidden-page__description">
        系统已识别到你的登录会话，但当前角色未获得 AI 配置入口权限。请联系管理员开通 AI 配置菜单和 ai_profile.manage 动作权限后再重试。
      </p>
      <div class="forbidden-page__actions">
        <el-button
          class="button-primary"
          type="primary"
          @click="backToLogin"
        >
          <el-icon>
            <component :is="UiIcons.back" />
          </el-icon>
          返回登录页
        </el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.forbidden-page {
  display: grid;
  gap: 20px;
  max-width: 760px;
  margin: 48px auto;
  padding: 32px;
  border-radius: 28px;
}

.forbidden-page__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
  font-size: 28px;
}

.forbidden-page__content {
  display: grid;
  gap: 12px;
}

.forbidden-page__eyebrow {
  margin: 0;
  color: #9a6700;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.forbidden-page__title {
  margin: 0;
  color: #10233f;
  font-size: 28px;
  line-height: 1.3;
}

.forbidden-page__description {
  margin: 0;
  color: #52627a;
  font-size: 15px;
  line-height: 1.8;
}

.forbidden-page__actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
</style>
