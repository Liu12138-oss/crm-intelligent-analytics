export type NumberTone = 'success' | 'danger' | 'normal';

export interface NumberToneSegment {
  kind: 'text' | 'number';
  text: string;
  tone?: NumberTone;
}

export interface NumberToneOptions {
  toneHint?: string;
}

const numberTokenPattern = /[-+]?(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d+)?%?/gu;
const asciiWordOrDigitPattern = /[\dA-Za-z_]/u;
const dangerContextPattern =
  /下降|下滑|减少|降低|回落|流失|风险|异常|失败|拦截|超时|逾期|阻断|低于|偏低|不足|未达|缺口|告警|扣减|仅占|宽度|偏宽|需关注/u;
const successContextPattern =
  /增长|上升|提升|增加|新增|完成|达成|收入|承诺|商机|合同|命中|成功|赢单|转化|贡献|高于|有效|同比|环比|稳定|健康|重点|总额|金额/u;

/**
 * 将一段业务文本拆成普通文本和数值片段，供 Vue 模板安全渲染。
 *
 * 参数说明：`value` 是原始用户可见文案；`options.toneHint` 是可选的业务语义提示。
 * 返回值：按原顺序排列的文本片段；数值片段会附带语义色调。
 * 调用注意：该函数只做分段，不生成 HTML，避免把后端文案直接拼成未转义内容。
 */
export function splitNumberToneSegments(value: string | number | null | undefined, options: NumberToneOptions = {}): NumberToneSegment[] {
  const source = value === null || value === undefined ? '' : String(value);
  if (!source) {
    return [];
  }

  const segments: NumberToneSegment[] = [];
  let cursor = 0;

  // 按数值命中点逐段复制原文，确保没有数字的部分仍保持原始文案和空格。
  for (const match of source.matchAll(numberTokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    if (!isNumberTokenStartAllowed(source, index)) {
      continue;
    }

    if (index > cursor) {
      segments.push({ kind: 'text', text: source.slice(cursor, index) });
    }

    segments.push({
      kind: 'number',
      text: token,
      tone: resolveNumberTone({
        token,
        source,
        startIndex: index,
        endIndex: index + token.length,
        toneHint: options.toneHint,
      }),
    });
    cursor = index + token.length;
  }

  // 尾段不能丢，否则中文说明会在最后一个数字后被截断。
  if (cursor < source.length) {
    segments.push({ kind: 'text', text: source.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text: source }];
}

/**
 * 判断数值候选是否位于独立业务数字的起点。
 *
 * 参数说明：`source` 为原文，`startIndex` 为正则命中的候选起点。
 * 返回值：`true` 表示可作为业务数字高亮；`false` 表示候选数字属于编码或英文标识。
 * 调用注意：这里替代正则后行断言，避免 Safari 16 在模块初始化时解析失败。
 */
function isNumberTokenStartAllowed(source: string, startIndex: number): boolean {
  if (startIndex <= 0) {
    return true;
  }

  const previousCharacter = source.charAt(startIndex - 1);
  return !asciiWordOrDigitPattern.test(previousCharacter);
}

/**
 * 将业务文本安全渲染成带数值色标的 HTML 字符串。
 *
 * 参数说明：`value` 是原始文案；`options.toneHint` 用于辅助判断红绿语义。
 * 返回值：已转义的 HTML 字符串，只会额外插入受控 span。
 * 调用注意：仅用于当前项目内受控 Markdown 预览，不应传入未审查的 HTML。
 */
export function renderNumberToneHtml(value: string | number | null | undefined, options: NumberToneOptions = {}): string {
  return splitNumberToneSegments(value, options)
    .map((segment) => {
      const escapedText = escapeHtml(segment.text);
      if (segment.kind !== 'number') {
        return escapedText;
      }

      return `<span class="number-tone" data-tone="${segment.tone ?? 'normal'}">${escapedText}</span>`;
    })
    .join('');
}

/**
 * 根据数值本身、附近业务词和外部提示判断色调。
 *
 * 参数说明：包含当前数值、原文位置和业务提示。
 * 返回值：`success` 表示正向，`danger` 表示风险或下降，`normal` 表示中性数字。
 * 调用注意：风险词优先级最高，避免“收入下降”被收入类正向词误标为绿色。
 */
function resolveNumberTone(params: {
  token: string;
  source: string;
  startIndex: number;
  endIndex: number;
  toneHint?: string;
}): NumberTone {
  const hintTone = resolveHintTone(params.toneHint);
  if (hintTone) {
    return hintTone;
  }

  if (params.token.trim().startsWith('-')) {
    return 'danger';
  }
  if (params.token.trim().startsWith('+')) {
    return 'success';
  }

  const context = buildNumberContext(params.source, params.startIndex, params.endIndex, params.toneHint);
  if (dangerContextPattern.test(context)) {
    return 'danger';
  }
  if (successContextPattern.test(context)) {
    return 'success';
  }

  return 'normal';
}

/**
 * 将外部传入的字段 tone 或业务标签转成统一色调。
 *
 * 参数说明：`toneHint` 可能来自 keyFinding.tone、指标名称或风险标题。
 * 返回值：可直接使用的色调；无法确定时返回 undefined，继续按上下文判断。
 */
function resolveHintTone(toneHint?: string): NumberTone | undefined {
  const normalized = toneHint?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (/risk|danger|negative|error|warning|风险|异常|失败|下降|偏低|不足|逾期|拦截/u.test(normalized)) {
    return 'danger';
  }
  if (/positive|success|增长|提升|新增|完成|达成|收入|承诺|有效|金额|成功|赢单/u.test(normalized)) {
    return 'success';
  }
  if (/neutral|normal|中性|普通/u.test(normalized)) {
    return 'normal';
  }

  return undefined;
}

/**
 * 截取当前数值附近的业务上下文，避免整段文本里远处风险词污染所有数字。
 *
 * 参数说明：`source` 为原文，`startIndex/endIndex` 为数值范围，`toneHint` 为补充语义。
 * 返回值：包含数值前后短窗口和提示词的上下文文本。
 */
function buildNumberContext(source: string, startIndex: number, endIndex: number, toneHint?: string): string {
  const windowSize = 14;
  const before = source.slice(Math.max(0, startIndex - windowSize), startIndex);
  const after = source.slice(endIndex, Math.min(source.length, endIndex + windowSize));
  return `${toneHint ?? ''} ${before}${after}`;
}

/**
 * 转义文本中的 HTML 特殊字符，保证 Markdown 预览中的数字高亮不会引入注入风险。
 *
 * 参数说明：`value` 为原始文本。
 * 返回值：可安全拼入 HTML 字符串的文本。
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
