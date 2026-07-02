<script setup lang="ts">
import { computed } from 'vue';
import type { AiModelActivationView, AiModelProfileItem } from '@/types/analysis';

const props = defineProps<{
  activation: AiModelActivationView;
  activeProfile?: AiModelProfileItem;
}>();

const activeProfileName = computed(() => props.activeProfile?.name ?? '未激活');
const activeModelName = computed(() => props.activeProfile?.model ?? '未配置');
const activeReasoningEffort = computed(
  () => props.activeProfile?.reasoningEffort ?? 'low',
);
const verificationStatus = computed(() =>
  props.activation.lastVerificationStatus === 'SUCCEEDED'
    ? '最近验证成功'
    : props.activation.lastVerificationStatus === 'FAILED'
      ? '最近验证失败'
      : '尚未验证',
);
</script>

<template>
  <section class="panel ai-model-summary-panel">
    <div class="panel__header">
      <div>
        <h3 class="table-panel__title">
          当前激活配置
        </h3>
      </div>
    </div>
    <div class="panel__body ai-model-summary-grid">
      <article class="policy-card">
        <span class="policy-card__label">激活 Profile</span>
        <strong class="policy-card__value">{{ activeProfileName }}</strong>
      </article>
      <article class="policy-card">
        <span class="policy-card__label">当前模型</span>
        <strong class="policy-card__value">{{ activeModelName }}</strong>
      </article>
      <article class="policy-card">
        <span class="policy-card__label">最近验证</span>
        <strong class="policy-card__value">{{ verificationStatus }}</strong>
      </article>
      <article class="policy-card">
        <span class="policy-card__label">推理等级</span>
        <strong class="policy-card__value">{{ activeReasoningEffort }}</strong>
      </article>
    </div>
  </section>
</template>
