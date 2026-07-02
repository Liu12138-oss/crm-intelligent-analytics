<script setup lang="ts">
import { ElButton, ElIcon, ElTag } from 'element-plus';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { RecentQueryItem } from '@/types/analysis';
import { formatViewTypeLabel } from '@/ui/business-code-labels';
import { UiIcons } from '@/ui/icons';

defineProps<{
  items: RecentQueryItem[];
  compact?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{
  rerun: [historyId: string];
}>();
</script>

<template>
  <section
    class="panel"
    :class="{ 'analysis-asset-panel': compact }"
  >
    <div
      v-if="!compact"
      class="panel__header"
    >
      <h3 class="table-panel__title">
        最近查询
      </h3>
      <el-tag
        class="badge status-tone--neutral"
        type="info"
        round
      >
        <el-icon>
          <component :is="UiIcons.refresh" />
        </el-icon>
        个人历史
      </el-tag>
    </div>
    <div
      class="panel__body"
      :class="{ 'analysis-asset-panel__body': compact, 'analysis-asset-list': true }"
    >
      <article
        v-for="item in items"
        :key="item.historyId"
        class="interactive-card analysis-asset-item"
        :class="{ 'analysis-asset-item--compact': compact }"
      >
        <div
          class="analysis-asset-item__content"
          :class="{ 'analysis-asset-item__content--compact': compact }"
        >
          <h4>
            <NumberToneText :text="item.questionText" />
          </h4>
          <p>
            <NumberToneText :text="`${item.resultSummary ?? '暂无结果摘要'} · ${item.lastUsedAt.slice(0, 16).replace('T', ' ')}`" />
          </p>
          <small class="analysis-asset-item__hint">
            {{ item.sourceType === 'TEMPLATE_QUERY' ? '模板查询' : item.sourceType === 'RERUN_HISTORY' ? '历史重跑' : 'AI 问数' }}
            <template v-if="item.renderSnapshot?.primaryViewType">
              · {{ formatViewTypeLabel(item.renderSnapshot.primaryViewType) }}
            </template>
          </small>
        </div>
        <el-button
          class="button-secondary analysis-button analysis-asset-item__button"
          :disabled="busy"
          :loading="busy"
          :aria-busy="busy ? 'true' : 'false'"
          @click="emit('rerun', item.historyId)"
        >
          <el-icon v-if="!busy">
            <component :is="UiIcons.refresh" />
          </el-icon>
          {{ busy ? '运行中...' : '再次运行' }}
        </el-button>
      </article>
      <div
        v-if="items.length === 0"
        class="empty-state"
      >
        暂无最近查询。
      </div>
    </div>
  </section>
</template>
