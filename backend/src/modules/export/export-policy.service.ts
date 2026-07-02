import { Injectable } from '@nestjs/common';
import type { AccessPolicyRecord, CrmUser } from '../../shared/types/domain';
import { ExportRequestRepository } from './export-request.repository';
import { AccessDecisionService } from '../governance/access-decision.service';

@Injectable()
export class ExportPolicyService {
  constructor(
    private readonly exportRequestRepository: ExportRequestRepository,
    private readonly accessDecisionService: AccessDecisionService,
  ) {}

  evaluate(user: CrmUser, policy: AccessPolicyRecord, rowCount: number): {
    allowed: boolean;
    reason?: string;
  } {
    const canExport = this.accessDecisionService.hasAction(user, 'analysis.export');

    if (!canExport) {
      return { allowed: false, reason: '当前用户无导出权限。' };
    }

    if (rowCount > policy.exportRowLimit) {
      return {
        allowed: false,
        reason: `当前导出条数超过单次上限 ${policy.exportRowLimit} 行。`,
      };
    }

    const todayCount = this.exportRequestRepository.listByRequesterId(user.id).filter(
      (item) =>
        item.status === 'COMPLETED' &&
        item.createdAt.startsWith(new Date().toISOString().slice(0, 10)),
    ).length;

    if (todayCount >= policy.exportDailyLimit) {
      return {
        allowed: false,
        reason: `当前账号今日导出次数已达上限 ${policy.exportDailyLimit} 次。`,
      };
    }

    return { allowed: true };
  }
}
