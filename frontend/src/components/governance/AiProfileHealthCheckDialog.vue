<script setup lang="ts">
import { ElDialog, ElTag } from 'element-plus';
import type { AiModelHealthCheckResult } from '@/types/analysis';

const props = withDefaults(defineProps<{
  visible: boolean;
  loading?: boolean;
  result?: AiModelHealthCheckResult | null;
}>(), {
  loading: false,
  result: null,
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

/**
 * 控制弹窗关闭时机，避免测试执行中被遮罩、Esc 或其他默认交互提前打断。
 *
 * @param done Element Plus 提供的继续关闭回调，仅在允许关闭时调用。
 */
function handleBeforeClose(done: () => void): void {
  if (props.loading) {
    return;
  }

  done();
}
</script>

<template>
  <el-dialog
    :model-value="props.visible"
    title="AI 连通性测试"
    width="420px"
    :show-close="!props.loading"
    :close-on-click-modal="!props.loading"
    :close-on-press-escape="!props.loading"
    :before-close="handleBeforeClose"
    @close="emit('update:visible', false)"
  >
    <div class="panel__body panel__body--stack">
      <article class="policy-card">
        <span class="policy-card__label">测试结果</span>
        <strong class="policy-card__value">
          <span v-if="props.loading" class="ai-model-loading-copy">
            <span class="ai-model-loading-dot" />
            <span class="ai-model-loading-dot" />
            <span class="ai-model-loading-dot" />
            测试中...
          </span>
          <el-tag v-else :type="props.result?.status === 'SUCCEEDED' ? 'success' : 'danger'" round>
            {{ props.result?.status === 'SUCCEEDED' ? '成功' : props.result?.status === 'FAILED' ? '失败' : '未执行' }}
          </el-tag>
        </strong>
      </article>
      <article
        v-if="props.loading"
        class="policy-card"
      >
        <span class="policy-card__label">当前阶段</span>
        <div class="panel__body--stack">
          <strong class="policy-card__value policy-card__value--compact">正在校验服务地址、鉴权和模型可用性</strong>
          <div class="ai-model-progress-bar" />
        </div>
      </article>
      <article class="policy-card">
        <span class="policy-card__label">耗时</span>
        <strong class="policy-card__value">{{ props.result?.latencyMs ?? 0 }}ms</strong>
      </article>
      <article
        v-if="props.result?.failureReason"
        class="policy-card"
      >
        <span class="policy-card__label">失败原因</span>
        <strong class="policy-card__value">{{ props.result.failureReason }}</strong>
      </article>
    </div>
  </el-dialog>
</template>
