import { describe, expect, it } from 'vitest';
import numberToneSource from '@/utils/number-tone-text.ts?raw';
import { splitNumberToneSegments } from '@/utils/number-tone-text';

describe('number tone text', () => {
  it('不应使用 Safari 16 不支持的正则后行断言', () => {
    expect(numberToneSource).not.toMatch(/\(\?<[!=]/u);
  });

  it('应识别独立业务数字并跳过编码内数字', () => {
    const segments = splitNumberToneSegments('Q4 2024年收入增长 6,112.03，客户A1保持稳定');

    expect(segments.filter((segment) => segment.kind === 'number')).toEqual([
      { kind: 'number', text: '2024', tone: 'success' },
      { kind: 'number', text: '6,112.03', tone: 'success' },
    ]);
  });
});
