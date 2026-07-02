import {
  formatWanAmount,
  parseDisplayAmountToYuan,
  toWanAmount,
} from '../../src/shared/utils/business-amount.util';

describe('business amount util', () => {
  it('应把 CRM 元级金额统一换算成万元展示', () => {
    expect(toWanAmount(13843700)).toBe(1384.37);
    expect(formatWanAmount(13843700)).toBe('1,384.37 万元');
    expect(formatWanAmount(66666)).toBe('6.67 万元');
    expect(formatWanAmount(0)).toBe('0 万元');
  });

  it('应能把展示态万元金额还原为元级数值用于一致性校验', () => {
    expect(parseDisplayAmountToYuan('1,384.37 万元')).toBe(13843700);
    expect(parseDisplayAmountToYuan('¥ 500,000')).toBe(500000);
    expect(parseDisplayAmountToYuan('6.67')).toBe(6.67);
  });
});
