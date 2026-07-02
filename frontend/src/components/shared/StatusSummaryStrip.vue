<script setup lang="ts">
import { computed } from 'vue';
import { ElIcon } from 'element-plus';
import type { StatusTone } from '@/ui/status-presentation';
import { UiIconGroups, type UiIconComponent } from '@/ui/icons';

interface StatusSummaryItem {
  label: string;
  value: string | number;
  helper?: string;
  tone?: StatusTone;
  icon?: UiIconComponent;
}

const statusIconMap: Record<StatusTone, UiIconComponent> = {
  neutral: UiIconGroups.status.info,
  info: UiIconGroups.status.info,
  online: UiIconGroups.status.success,
  running: UiIconGroups.status.running,
  success: UiIconGroups.status.success,
  warning: UiIconGroups.status.warning,
  degraded: UiIconGroups.status.warning,
  danger: UiIconGroups.status.danger,
  blocked: UiIconGroups.status.blocked,
  offline: UiIconGroups.status.offline,
};

const props = defineProps<{
  items: StatusSummaryItem[];
}>();

/**
 * 为摘要项兜底选择状态图标，让状态条始终具备非颜色识别线索。
 * @param item 摘要项。
 * @returns 可渲染的图标组件。
 */
function resolveItemIcon(item: StatusSummaryItem): UiIconComponent {
  if (item.icon) {
    return item.icon;
  }

  const tone = item.tone ?? 'neutral';
  return statusIconMap[tone];
}

const normalizedItems = computed(() =>
  props.items.map((item) => ({
    ...item,
    tone: item.tone ?? 'neutral',
    icon: resolveItemIcon(item),
  })),
);
</script>

<template>
  <div class="status-summary-strip">
    <article
      v-for="item in normalizedItems"
      :key="`${item.label}-${item.value}`"
      class="status-summary-strip__item"
      :class="`status-tone--${item.tone}`"
    >
      <span class="status-summary-strip__icon">
        <el-icon>
          <component :is="item.icon" />
        </el-icon>
      </span>
      <span class="status-summary-strip__copy">
        <small>{{ item.label }}</small>
        <strong>{{ item.value }}</strong>
        <em v-if="item.helper">{{ item.helper }}</em>
      </span>
    </article>
  </div>
</template>
