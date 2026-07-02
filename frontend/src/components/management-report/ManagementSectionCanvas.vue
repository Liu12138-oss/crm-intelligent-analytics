<script setup lang="ts">
import { computed } from 'vue';
import { ElButton } from 'element-plus';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import SectionSourcePopover from '@/components/management-report/blocks/SectionSourcePopover.vue';
import { resolveBlockRenderer } from '@/components/management-report/block-renderer-registry';
import { registerAllBlockRenderers } from '@/components/management-report/block-renderers';
import type {
  ManagementReportBlock,
  ManagementReportSectionData,
} from '@/types/management-report';

// 确保所有 block 渲染器已注册（幂等，重复调用无副作用）
registerAllBlockRenderers();

const props = defineProps<{
  title?: string;
  section?: ManagementReportSectionData;
  loading?: boolean;
  emptyText?: string;
  retryable?: boolean;
  retryLabel?: string;
}>();
const emit = defineEmits<{
  (event: 'retry'): void;
}>();

const allBlocks = computed<ManagementReportBlock[]>(() => {
  if (!props.section) {
    return [];
  }

  const metricBlocks = (props.section.metricCards?.length ?? 0) > 0
    ? [
        {
          blockId: `${props.section.sectionKey}-summary-strip`,
          blockType: 'metric-strip',
          title: '核心指标',
          size: 'full',
          layoutHint: 'metric-row',
          items: props.section.metricCards!.map((item) => ({
            label: item.label,
            value: item.value,
            tone: item.tone,
          })),
        } as ManagementReportBlock,
      ]
    : [];

  const stripBlocks = props.section.blocks.filter((block) => block.blockType === 'metric-strip');
  const contentBlocks = props.section.blocks.filter((block) => block.blockType !== 'metric-strip');

  return [...metricBlocks, ...stripBlocks, ...contentBlocks];
});

const showSectionState = computed(
  () =>
    props.section?.state === 'empty' ||
    (props.section?.state === 'degraded' && allBlocks.value.length === 0),
);

const sectionStateText = computed(() => {
  if (!props.section) {
    return props.emptyText ?? '请选择上方专题查看详情。';
  }

  return props.section.emptyReason ?? props.section.summary ?? props.emptyText ?? '当前专题暂不可用。';
});

/**
 * 从注册表解析 block 对应的渲染器组件
 * 未注册的 blockType 返回 undefined，模板中用 fallback 显示提示
 */
function getRenderer(block: ManagementReportBlock) {
  return resolveBlockRenderer(block);
}
</script>

<template>
  <section class="management-section-canvas">
    <div class="management-section-canvas__head">
      <div class="management-section-canvas__title-wrap">
        <h2 class="management-section-canvas__title">
          <NumberToneText :text="props.title ?? props.section?.title ?? '--'" />
        </h2>
      </div>
      <div class="management-section-canvas__tools">
        <SectionSourcePopover
          v-if="props.section && ((props.section.sourceNotes?.length ?? 0) > 0 || (props.section.footnotes?.length ?? 0) > 0)"
          :source-notes="props.section.sourceNotes"
          :footnotes="props.section.footnotes"
        />
      </div>
    </div>

    <div
      v-if="props.loading"
      class="management-section-canvas__state"
    >
      正在加载专题数据...
    </div>
    <div
      v-else-if="!props.section"
      class="management-section-canvas__state"
    >
      <NumberToneText :text="props.emptyText ?? '请选择上方专题查看详情。'" />
    </div>
    <div
      v-else-if="showSectionState"
      class="management-section-canvas__state management-section-canvas__state--degraded"
    >
      <strong class="management-section-canvas__state-title">
        {{ props.section?.state === 'degraded' ? '专题暂不可用' : '当前暂无专题数据' }}
      </strong>
      <p class="management-section-canvas__state-copy">
        <NumberToneText :text="sectionStateText" />
      </p>
      <el-button
        v-if="props.section?.state === 'degraded' && props.retryable"
        class="button-secondary management-section-canvas__retry"
        @click="emit('retry')"
      >
        {{ props.retryLabel ?? '重试加载专题' }}
      </el-button>
    </div>
    <div
      v-else
      class="management-section-canvas__grid"
    >
      <article
        v-for="block in allBlocks"
        :key="block.blockId"
        class="management-section-canvas__block"
        :data-size="block.size"
        :data-block-type="block.blockType"
      >
        <component
          :is="getRenderer(block)"
          v-if="getRenderer(block)"
          :block="block"
        />
        <div v-else class="management-section-canvas__unknown-block">
          未注册的 block 类型：{{ block.blockType }}
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.management-section-canvas {
  display: grid;
  gap: 12px;
  --management-report-block-height: 360px;
  padding: 16px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
}

.management-section-canvas__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.management-section-canvas__title {
  margin: 0;
  font-size: 22px;
  color: #0f172a;
}

.management-section-canvas__tools {
  display: flex;
  gap: 10px;
  align-items: center;
}

.management-section-canvas__state {
  padding: 18px 14px;
  border-radius: 14px;
  text-align: center;
  background: #f8fafc;
  color: #64748b;
}

.management-section-canvas__state--degraded {
  display: grid;
  gap: 10px;
  justify-items: center;
}

.management-section-canvas__state-title {
  color: #0f172a;
}

.management-section-canvas__state-copy {
  margin: 0;
}

.management-section-canvas__grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.management-section-canvas__block {
  grid-column: span 6;
  height: var(--management-report-block-height);
  min-width: 0;
  align-self: start;
  overflow: hidden;
  padding: 12px;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  border: 1px solid #edf2f7;
}

.management-section-canvas__block[data-block-type='metric-strip'] {
  height: auto;
  overflow: visible;
}

.management-section-canvas__block[data-size='compact'],
.management-section-canvas__block[data-size='wide'] {
  grid-column: span 6;
}

.management-section-canvas__block[data-size='full'] {
  grid-column: 1 / -1;
}

@media (max-width: 1200px) {
  .management-section-canvas__block,
  .management-section-canvas__block[data-size='wide'] {
    grid-column: span 6;
  }
}

@media (max-width: 768px) {
  .management-section-canvas__head {
    flex-direction: column;
    align-items: flex-start;
  }

  .management-section-canvas__tools {
    width: 100%;
    justify-content: space-between;
  }

  .management-section-canvas__grid,
  .management-section-canvas__block,
  .management-section-canvas__block[data-size='wide'] {
    grid-template-columns: 1fr;
    grid-column: 1 / -1;
  }
}

.management-section-canvas__unknown-block {
  padding: 16px;
  border-radius: 12px;
  background: #FFF0F2;
  color: #C23D4B;
  font-size: 13px;
  text-align: center;
}
</style>
