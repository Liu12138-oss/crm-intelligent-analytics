import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mainCss = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf-8');

function getRuleBlock(selector: string): string {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm');
  const match = mainCss.match(pattern);
  return match?.[1] ?? '';
}

describe('status state styles', () => {
  it('通用空态、反馈态和风险态应显示紧凑左侧图标', () => {
    expect(mainCss).toContain('.empty-state::before');
    expect(mainCss).toContain('.feedback-state::before');
    expect(mainCss).toContain('.risk-state::before');
    expect(mainCss).toContain('grid-template-columns: 24px minmax(0, 1fr);');
    expect(mainCss).toContain('grid-row: 1 / span 2;');
    expect(mainCss).toContain('-webkit-mask: var(--state-icon-mask) center / 15px 15px no-repeat;');
  });

  it('加载态图标应横向紧凑展示，避免独占一整行', () => {
    const loadingStateBlock = getRuleBlock('.loading-state');
    const loadingIconBlock = getRuleBlock('.loading-state::before');

    expect(loadingStateBlock).toContain('display: grid;');
    expect(loadingStateBlock).toContain('align-items: center;');
    expect(loadingStateBlock).toContain('grid-template-columns: 24px minmax(0, 1fr);');
    expect(loadingIconBlock).toContain('flex: 0 0 24px;');
    expect(loadingIconBlock).toContain('width: 24px;');
    expect(loadingIconBlock).toContain('height: 24px;');
  });
});
