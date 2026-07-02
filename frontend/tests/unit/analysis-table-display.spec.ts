import { describe, expect, it } from 'vitest';
import {
  resolveAnalysisColumnLabel,
  shouldHideInferredAnalysisColumn,
} from '@/utils/analysis-table-display';

describe('analysis-table-display', () => {
  it('停滞商机明细字段应展示中文表头而不是字段兜底', () => {
    expect(resolveAnalysisColumnLabel('opportunity_name', undefined, 1)).toBe('商机名称');
    expect(resolveAnalysisColumnLabel('stage_name', undefined, 2)).toBe('销售阶段');
    expect(resolveAnalysisColumnLabel('source_updated_at', undefined, 3)).toBe('最近进展时间');
    expect(resolveAnalysisColumnLabel('stale_days', undefined, 4)).toBe('未更新天数');
  });

  it('存在商机名称时应隐藏自动推导出的商机编号列', () => {
    expect(
      shouldHideInferredAnalysisColumn('opportunity_id', {
        opportunity_id: 'OPP-001',
        opportunity_name: '某银行零信任扩容项目',
      }),
    ).toBe(true);
  });
});
