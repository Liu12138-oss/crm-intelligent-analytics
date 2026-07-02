<script setup lang="ts">
import { reactive, watch } from 'vue';
import { ElButton, ElIcon, ElInput, ElTooltip } from 'element-plus';
import type { AiContextPolicyView } from '@/types/analysis';
import { UiIcons } from '@/ui/icons';

const props = defineProps<{
  policy: AiContextPolicyView | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  save: [payload: Record<string, unknown>];
}>();

const form = reactive({
  turnRetentionLimit: 8,
  historySummaryMaxLength: 600,
  latestQuestionMaxLength: 200,
  latestSummaryMaxLength: 800,
  analysisSessionIdleTimeoutMinutes: 30,
  taskSessionIdleTimeoutMinutes: 120,
});

watch(
  () => props.policy,
  (policy) => {
    if (!policy) {
      return;
    }

    form.turnRetentionLimit = policy.turnRetentionLimit;
    form.historySummaryMaxLength = policy.historySummaryMaxLength;
    form.latestQuestionMaxLength = policy.latestQuestionMaxLength;
    form.latestSummaryMaxLength = policy.latestSummaryMaxLength;
    form.analysisSessionIdleTimeoutMinutes = Math.max(
      1,
      Math.trunc(policy.analysisSessionIdleTimeoutSeconds / 60),
    );
    form.taskSessionIdleTimeoutMinutes = Math.max(
      1,
      Math.trunc(policy.taskSessionIdleTimeoutSeconds / 60),
    );
  },
  {
    immediate: true,
  },
);

function submit(): void {
  emit('save', {
    turnRetentionLimit: Number(form.turnRetentionLimit),
    historySummaryMaxLength: Number(form.historySummaryMaxLength),
    latestQuestionMaxLength: Number(form.latestQuestionMaxLength),
    latestSummaryMaxLength: Number(form.latestSummaryMaxLength),
    analysisSessionIdleTimeoutSeconds: Number(form.analysisSessionIdleTimeoutMinutes) * 60,
    taskSessionIdleTimeoutSeconds: Number(form.taskSessionIdleTimeoutMinutes) * 60,
  });
}

const contextPolicyHelpLines = [
  '问答上下文保留轮次上限：控制企业微信普通 AI 对话最多保留多少轮上下文。',
  '历史摘要保留上限：控制旧轮次被压缩成摘要后最多保留多少字符。',
  '上一轮问题保留上限：控制连续对话时带回上一轮问题的最大长度。',
  '上一轮结果摘要保留上限：控制连续对话时带回上一轮回复摘要的最大长度。',
  '普通会话失活时长：作用于企业微信普通 AI 对话的短上下文。',
  '任务态会话失活时长：当前核心模式下仅保留配置项，历史业务任务恢复时再评估是否复用。',
  '当前这组配置不恢复 CRM 问数、合同评审、日报或写回能力。',
];
</script>

<template>
  <section class="panel">
    <div class="panel__header">
      <div>
        <h2 class="table-panel__title">
          上下文策略
        </h2>
      </div>
      <div class="panel__header-actions">
        <el-tooltip placement="top" effect="light">
          <template #content>
            <div class="ai-context-policy-tooltip">
              <p
                v-for="line in contextPolicyHelpLines"
                :key="line"
              >
                {{ line }}
              </p>
            </div>
          </template>
          <el-button
            class="button-secondary permission-help-button"
            text
            aria-label="查看上下文策略说明"
          >
            <el-icon>
              <component :is="UiIcons.info" />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-button
          class="button-primary"
          type="primary"
          :loading="saving"
          :disabled="saving"
          @click="submit"
        >
          {{ saving ? '保存中...' : '保存上下文策略' }}
        </el-button>
      </div>
    </div>
    <div class="panel__body panel__body--stack">
      <div class="field-grid">
        <label class="form-field">
          <span>问答上下文保留轮次上限（轮）</span>
          <el-input
            v-model="form.turnRetentionLimit"
            class="input"
            type="number"
          />
        </label>
        <label class="form-field">
          <span>历史摘要保留上限（字符）</span>
          <el-input
            v-model="form.historySummaryMaxLength"
            class="input"
            type="number"
          />
        </label>
        <label class="form-field">
          <span>上一轮问题保留上限（字符）</span>
          <el-input
            v-model="form.latestQuestionMaxLength"
            class="input"
            type="number"
          />
        </label>
        <label class="form-field">
          <span>上一轮结果摘要保留上限（字符）</span>
          <el-input
            v-model="form.latestSummaryMaxLength"
            class="input"
            type="number"
          />
        </label>
        <label class="form-field">
          <span>普通对话会话失活时长（分钟）</span>
          <el-input
            v-model="form.analysisSessionIdleTimeoutMinutes"
            class="input"
            type="number"
          />
        </label>
        <label class="form-field">
          <span>任务态会话失活时长（分钟）</span>
          <el-input
            v-model="form.taskSessionIdleTimeoutMinutes"
            class="input"
            type="number"
          />
        </label>
      </div>
    </div>
  </section>
</template>
