import { detectTimeRange } from '../../../src/shared/utils/time-range.util';

describe('time-range util', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-23T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('应识别前两个月并返回动态起始时间', () => {
    const result = detectTimeRange('请分析一下前两个月的商机情况');

    expect(result).toEqual({
      label: '前两个月',
      startAt: '2026-01-31T16:00:00.000Z',
    });
  });

  it('应动态计算本月起始时间，而不是返回硬编码日期', () => {
    const result = detectTimeRange('本月各销售负责人新增商机金额排名');

    expect(result).toEqual({
      label: '本月',
      startAt: '2026-03-31T16:00:00.000Z',
    });
  });

  it('应识别前三个月并返回最近三个月的动态起始时间', () => {
    const result = detectTimeRange('请分析一下前三个月的商机情况');

    expect(result).toEqual({
      label: '前三个月',
      startAt: '2026-01-31T16:00:00.000Z',
    });
  });

  it('应识别最近四个月并返回四个月窗口的动态起始时间', () => {
    const result = detectTimeRange('请分析一下最近四个月的商机情况');

    expect(result).toEqual({
      label: '最近四个月',
      startAt: '2025-12-31T16:00:00.000Z',
    });
  });

  it('应识别最近一年、近一年和近12个月，避免误提示缺少时间范围', () => {
    expect(detectTimeRange('帮我分析一下最近一年全国的订单情况、商机情况')).toEqual({
      label: '最近一年',
      startAt: '2025-03-31T16:00:00.000Z',
    });
    expect(detectTimeRange('近一年全国订单情况')).toEqual({
      label: '最近一年',
      startAt: '2025-03-31T16:00:00.000Z',
    });
    expect(detectTimeRange('近12个月商机情况')).toEqual({
      label: '近12个月',
      startAt: '2025-04-30T16:00:00.000Z',
    });
  });
});
