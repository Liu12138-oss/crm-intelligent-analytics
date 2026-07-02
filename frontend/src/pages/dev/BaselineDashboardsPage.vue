<script setup lang="ts">
/**
 * 标杆看板演示页
 *
 * 用于第 1 期验证两个标杆看板的 ECharts 渲染效果
 * 路由：/dev/baseline-dashboards
 */

import { ref } from 'vue';
import ChannelOrderSummaryDashboard from '@/components/baseline-dashboards/ChannelOrderSummaryDashboard.vue';
import AgentDevelopmentDashboard from '@/components/baseline-dashboards/AgentDevelopmentDashboard.vue';

const activeTab = ref<'channel-order' | 'agent-development'>('channel-order');
</script>

<template>
  <div class="baseline-dashboards-page">
    <header class="baseline-dashboards-page__header">
      <h1>标杆看板演示（第 1 期可视化升级验证）</h1>
      <p class="baseline-dashboards-page__desc">
        本页用案例静态数据验证 ECharts block 组件渲染效果，非生产数据。
      </p>
    </header>

    <nav class="baseline-dashboards-page__tabs">
      <button
        :class="['baseline-dashboards-page__tab', { 'is-active': activeTab === 'channel-order' }]"
        @click="activeTab = 'channel-order'"
      >
        案例一：广州办渠道下单汇总
      </button>
      <button
        :class="['baseline-dashboards-page__tab', { 'is-active': activeTab === 'agent-development' }]"
        @click="activeTab = 'agent-development'"
      >
        案例二：全国代理商运营看板
      </button>
    </nav>

    <main class="baseline-dashboards-page__content">
      <ChannelOrderSummaryDashboard v-if="activeTab === 'channel-order'" />
      <AgentDevelopmentDashboard v-else-if="activeTab === 'agent-development'" />
    </main>
  </div>
</template>

<style scoped>
.baseline-dashboards-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.baseline-dashboards-page__header {
  margin-bottom: 24px;
}

.baseline-dashboards-page__header h1 {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 500;
  color: #0A2540;
}

.baseline-dashboards-page__desc {
  margin: 0;
  font-size: 13px;
  color: #6B7C93;
}

.baseline-dashboards-page__tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.baseline-dashboards-page__tab {
  padding: 10px 16px;
  border: 1px solid #D5DEEA;
  border-radius: 12px;
  background: #FFFFFF;
  color: #425466;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.baseline-dashboards-page__tab:hover {
  background: #F8FBFF;
  border-color: #C7D2E3;
}

.baseline-dashboards-page__tab.is-active {
  background: #635BFF;
  border-color: #635BFF;
  color: #FFFFFF;
  font-weight: 500;
}

.baseline-dashboards-page__content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
