import { Injectable } from '@nestjs/common';
import type {
  AnalysisDatasetBundle,
  AnalysisDatasetSlice,
  AnalysisMissingSection,
} from '../../shared/types/domain';
import { ResultAccuracyError } from './analysis.errors';
import { isSameTemporalScope } from './temporal-scope.util';

@Injectable()
export class AnalysisDatasetAssemblerService {
  assemble(
    workflowId: string,
    scopeSummary: string,
    slices: AnalysisDatasetSlice[],
    missingSections: AnalysisMissingSection[] = [],
  ): AnalysisDatasetBundle {
    const mergedRows = slices.flatMap((item) => item.tableRows);
    const appliedFilters = slices[0]?.appliedFilters ?? [];
    const temporalScope = slices[0]?.temporalScope;

    // 多任务结果必须共享同一时间口径，否则摘要、图表和明细会出现事实范围漂移。
    for (const slice of slices) {
      if (!isSameTemporalScope(temporalScope, slice.temporalScope)) {
        throw new ResultAccuracyError('结果时间口径不一致，已阻止交付。');
      }
    }

    return {
      workflowId,
      scopeSummary,
      slices,
      mergedRows,
      temporalScope,
      totalRowCount: slices.reduce((sum, item) => sum + item.rowCount, 0),
      appliedFilters,
      missingSections,
    };
  }
}
