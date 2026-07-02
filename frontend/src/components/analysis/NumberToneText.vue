<script setup lang="ts">
import { computed } from 'vue';
import { splitNumberToneSegments } from '@/utils/number-tone-text';

const props = defineProps<{
  text?: string | number | null;
  toneHint?: string;
}>();

const segments = computed(() =>
  splitNumberToneSegments(props.text, {
    toneHint: props.toneHint,
  }),
);
</script>

<template>
  <span class="number-tone-text">
    <template
      v-for="(segment, index) in segments"
      :key="`${index}-${segment.text}`"
    >
      <span
        v-if="segment.kind === 'number'"
        class="number-tone"
        :data-tone="segment.tone ?? 'normal'"
      >
        {{ segment.text }}
      </span>
      <template v-else>
        {{ segment.text }}
      </template>
    </template>
  </span>
</template>
