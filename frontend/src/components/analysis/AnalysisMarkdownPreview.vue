<script setup lang="ts">
import { computed } from 'vue';
import { ElIcon } from 'element-plus';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ResultTemporalScope } from '@/types/analysis';
import { UiIcons } from '@/ui/icons';
import { renderNumberToneHtml } from '@/utils/number-tone-text';

const props = defineProps<{
  title?: string;
  markdown?: string;
  temporalScope?: ResultTemporalScope;
  bundle?: {
    status: 'PENDING' | 'READY' | 'FAILED' | 'SKIPPED';
    groundedMarkdown?: string;
    failureReason?: string;
  };
}>();

/**
 * 转义受控 Markdown 中的 HTML 特殊字符，避免报告正文被当作真实标签执行。
 *
 * 参数说明：`value` 为 Markdown 行内文本。
 * 返回值：可安全拼接到渲染字符串中的文本。
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * 渲染受控 Markdown 行内格式，并在普通文本与粗体文本中追加数字色标。
 *
 * 参数说明：`value` 为单行 Markdown 文本。
 * 返回值：只包含受控标签的 HTML 字符串。
 */
function renderInlineMarkdown(value: string): string {
  const inlineTokenPattern = /(\*\*(.+?)\*\*|`(.+?)`)/gu;
  let cursor = 0;
  const htmlParts: string[] = [];

  // 只识别受控的粗体和代码片段，其余正文交给数字色标工具统一转义。
  for (const match of value.matchAll(inlineTokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      htmlParts.push(renderNumberToneHtml(value.slice(cursor, index)));
    }

    if (match[2] !== undefined) {
      htmlParts.push(`<strong>${renderNumberToneHtml(match[2])}</strong>`);
    } else {
      htmlParts.push(`<code>${escapeHtml(match[3] ?? '')}</code>`);
    }
    cursor = index + match[0].length;
  }

  if (cursor < value.length) {
    htmlParts.push(renderNumberToneHtml(value.slice(cursor)));
  }

  return htmlParts.join('');
}

/**
 * 判断当前行是否是 Markdown 表格分隔行。
 *
 * 参数说明：`value` 为去除首尾空白后的单行文本。
 * 返回值：是表头分隔行时返回 `true`。
 */
function isMarkdownTableDivider(value: string): boolean {
  return /^\|(?:\s*:?-{3,}:?\s*\|)+$/u.test(value);
}

/**
 * 把受控 Markdown 表格行渲染为 HTML table。
 *
 * 参数说明：`tableLines` 为连续表格行，包含表头、分隔行和正文。
 * 返回值：安全转义后的表格 HTML。
 */
function renderMarkdownTable(tableLines: string[]): string {
  const cells = (line: string): string[] =>
    line
      .split('|')
      .slice(1, -1)
      .map((item) => item.trim());

  const headerCells = cells(tableLines[0] ?? '');
  const bodyRows = tableLines.slice(2).map((line) => cells(line));

  const headerHtml = headerCells
    .map((item) => `<th>${renderInlineMarkdown(item)}</th>`)
    .join('');
  const bodyHtml = bodyRows
    .map(
      (row) =>
        `<tr>${row.map((item) => `<td>${renderInlineMarkdown(item)}</td>`).join('')}</tr>`,
    )
    .join('');

  return `<table class="analysis-markdown-preview__table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function renderRestrictedMarkdown(markdownText?: string): string {
  if (!markdownText?.trim()) {
    return '';
  }

  const lines = markdownText.split(/\r?\n/u);
  const html: string[] = [];
  let inList = false;

  const closeList = (): void => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const trimmedLine = lines[index]?.trim() ?? '';
    if (!trimmedLine) {
      closeList();
      continue;
    }

    if (trimmedLine.startsWith('### ')) {
      closeList();
      html.push(`<h3>${renderInlineMarkdown(trimmedLine.slice(4))}</h3>`);
      continue;
    }

    if (trimmedLine.startsWith('## ')) {
      closeList();
      html.push(`<h2>${renderInlineMarkdown(trimmedLine.slice(3))}</h2>`);
      continue;
    }

    if (
      trimmedLine.startsWith('|') &&
      index + 1 < lines.length &&
      isMarkdownTableDivider(lines[index + 1]?.trim() ?? '')
    ) {
      closeList();
      const tableLines = [trimmedLine, lines[index + 1]!.trim()];
      index += 1;
      while (index + 1 < lines.length && (lines[index + 1]?.trim() ?? '').startsWith('|')) {
        tableLines.push(lines[index + 1]!.trim());
        index += 1;
      }
      html.push(renderMarkdownTable(tableLines));
      continue;
    }

    if (trimmedLine.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(trimmedLine.slice(2))}</li>`);
      continue;
    }

    if (trimmedLine.startsWith('> ')) {
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(trimmedLine.slice(2))}</blockquote>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(trimmedLine)}</p>`);
  }

  closeList();
  return html.join('');
}

const renderedMarkdown = computed(() =>
  renderRestrictedMarkdown(props.bundle?.groundedMarkdown ?? props.markdown),
);

const temporalScopeText = computed(() => {
  if (!props.temporalScope) {
    return '';
  }

  const boundaryText = props.temporalScope.startAt && props.temporalScope.endAt
    ? `（${props.temporalScope.startAt} 至 ${props.temporalScope.endAt}，${props.temporalScope.timezone}）`
    : '';
  return `${props.temporalScope.normalizedLabel}${boundaryText}`;
});
</script>

<template>
  <section
    v-if="bundle?.status !== 'SKIPPED' || markdown?.trim()"
    class="analysis-markdown-preview"
    aria-label="Markdown 结果预览"
  >
    <div
      v-if="title"
      class="analysis-markdown-preview__title"
    >
      <NumberToneText :text="title" />
    </div>
    <div
      v-if="bundle?.status === 'PENDING'"
      class="analysis-markdown-preview__scope"
      aria-busy="true"
      aria-live="polite"
      data-testid="analysis-pending-status"
    >
      <ElIcon
        class="analysis-markdown-preview__pending-icon is-loading"
        aria-hidden="true"
      >
        <component :is="UiIcons.loading" />
      </ElIcon>
      <span>数据已返回，AI 正在补充分析结论。</span>
    </div>
    <div
      v-else-if="bundle?.status === 'FAILED'"
      class="analysis-markdown-preview__scope"
    >
      AI 报告生成失败：
      <NumberToneText :text="bundle.failureReason ?? '请稍后重试。'" />
    </div>
    <div
      v-if="temporalScopeText"
      class="analysis-markdown-preview__scope"
    >
      时间口径：
      <NumberToneText :text="temporalScopeText" />
    </div>
    <div
      class="analysis-markdown-preview__content"
      v-html="renderedMarkdown"
    />
  </section>
</template>
