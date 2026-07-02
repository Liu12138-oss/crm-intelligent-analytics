import { Injectable } from '@nestjs/common';
import type { AnalysisIntent, ScopeSnapshot } from '../../shared/types/domain';

@Injectable()
export class QueryScopeService {
  injectScope(
    intent: AnalysisIntent,
    scope: ScopeSnapshot,
  ): AnalysisIntent & { scopeSummary: string } {
    return {
      ...intent,
      filters: {
        ...intent.filters,
        organizationIds: scope.organizationIds,
        departmentIds: scope.departmentIds,
        ownerIds: scope.ownerIds,
      },
      scopeSummary: scope.scopeSummary,
    };
  }
}
