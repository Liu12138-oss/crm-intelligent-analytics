import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmReadonlyService,
  type PendingApprovalContractSourceDetailRecord,
  type PendingApprovalContractSourceRecord,
} from '../../database/crm-readonly/crm-readonly.service';
import type {
  ContractReviewSourceContractSnapshotRecord,
  CrmUser,
  ScopeSnapshot,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import type {
  ContractReviewSourceContractDetailView,
  ContractReviewSourceContractListResponse,
  ContractReviewSourceContractSummaryView,
} from './contract-review.types';

@Injectable()
export class ContractReviewCrmSourceService {
  private readonly defaultPendingContractPageSize = 15;
  private readonly maxPendingContractPageSize = 100;

  constructor(
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  async listPendingApprovalContracts(
    user: CrmUser,
    params?: {
      page?: number;
      pageSize?: number;
    },
  ): Promise<ContractReviewSourceContractListResponse> {
    this.ensureWorkspaceAccess(user);
    const scopeSnapshot = this.userScopeService.resolveScope(user);
    const sourceScopeSnapshot = this.resolveSourceContractScope(user, scopeSnapshot);
    const pagination = this.normalizePendingContractPagination(params);
    const result = await this.crmReadonlyService.listPendingApprovalContracts({
      scopeSnapshot: sourceScopeSnapshot,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });

    return {
      items: result.items.map((record) =>
        this.mapSummary(record),
      ),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  async getPendingApprovalContractDetail(
    user: CrmUser,
    contractId: string,
  ): Promise<ContractReviewSourceContractDetailView> {
    this.ensureWorkspaceAccess(user);
    const contract = await this.getAccessibleContract(user, contractId);
    this.recordViewedAuditEvent(user, contract);
    return this.mapDetail(contract);
  }

  async getPendingApprovalContractSnapshot(
    user: CrmUser,
    contractId: string,
  ): Promise<ContractReviewSourceContractSnapshotRecord> {
    this.ensureWorkspaceAccess(user);
    const contract = await this.getAccessibleContract(user, contractId);
    return this.mapSnapshot(contract);
  }

  private async getAccessibleContract(
    user: CrmUser,
    contractId: string,
  ): Promise<PendingApprovalContractSourceDetailRecord> {
    const contract =
      await this.crmReadonlyService.getPendingApprovalContractDetail(contractId);

    if (!contract) {
      throw new NotFoundException('未找到对应的 CRM 合同。');
    }

    const scopeSnapshot = this.userScopeService.resolveScope(user);
    if (!this.matchesScope(contract, scopeSnapshot, this.hasCrossContractView(user))) {
      throw new ForbiddenException('当前用户无权查看该 CRM 合同。');
    }

    if (!this.isPendingApprovalContract(contract)) {
      throw new NotFoundException('未找到处于待审批状态的 CRM 合同。');
    }

    return contract;
  }

  private ensureWorkspaceAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureVisibleMenu(
      user,
      'contract-review',
      '当前用户无权访问智能合同审核工作台。',
      {
        channel: 'web-console',
        resourceType: 'contract-review-workspace',
      },
    );
  }

  /**
   * 解析 CRM 待审批合同源列表的实际读取范围。
   * 参数：当前登录用户及组织范围快照。
   * 返回：传给只读库的范围快照。
   * 注意：`contract.review.cross_view` 表示可查询他人合同，但仍必须保留组织边界，避免跨组织读取。
   */
  private resolveSourceContractScope(
    user: CrmUser,
    scopeSnapshot: ScopeSnapshot,
  ): ScopeSnapshot {
    if (!this.hasCrossContractView(user)) {
      return scopeSnapshot;
    }

    return {
      ...scopeSnapshot,
      ownerIds: [],
    };
  }

  /**
   * 判断当前用户是否具备合同审核跨负责人查看权限。
   * 参数：当前登录用户。
   * 返回：具备 `contract.review.cross_view` 时返回 true。
   */
  private hasCrossContractView(user: CrmUser): boolean {
    return this.permissionEnforcementService.hasAction(
      user,
      'contract.review.cross_view',
    );
  }

  /**
   * 合同列表和详情都必须继续继承 CRM 现有组织、部门和 owner 作用域，避免前端仅隐藏数据但接口仍可越权读取。
   */
  private matchesScope(
    record:
      | PendingApprovalContractSourceRecord
      | PendingApprovalContractSourceDetailRecord,
    scopeSnapshot: ScopeSnapshot,
    allowCrossOwnerView = false,
  ): boolean {
    if (
      scopeSnapshot.organizationIds.length > 0 &&
      !scopeSnapshot.organizationIds.includes(record.organizationId)
    ) {
      return false;
    }

    // CRM 合同列表当前对齐 all_own 口径，不再叠加部门过滤，
    // 避免同组织下可见的合同因为部门口径过严被误排除。

    if (allowCrossOwnerView) {
      return true;
    }

    if (
      scopeSnapshot.ownerIds.length > 0 &&
      !scopeSnapshot.ownerIds.includes(record.ownerId)
    ) {
      return false;
    }

    return true;
  }

  private isPendingApprovalContract(
    record:
      | PendingApprovalContractSourceRecord
      | PendingApprovalContractSourceDetailRecord,
  ): boolean {
    return (
      Number(record.pendingStep ?? 0) > 0 ||
      (Boolean(record.submitApplyingAt) && !record.finishApproveAt)
    );
  }

  private normalizePendingContractPagination(params?: {
    page?: number;
    pageSize?: number;
  }): { page: number; pageSize: number } {
    const page =
      Number.isFinite(params?.page) && (params?.page ?? 0) > 0
        ? Math.floor(params?.page ?? 1)
        : 1;
    const pageSize =
      Number.isFinite(params?.pageSize) && (params?.pageSize ?? 0) > 0
        ? Math.min(
            Math.floor(params?.pageSize ?? this.defaultPendingContractPageSize),
            this.maxPendingContractPageSize,
          )
        : this.defaultPendingContractPageSize;

    return {
      page,
      pageSize,
    };
  }

  private mapSummary(
    record: PendingApprovalContractSourceRecord,
  ): ContractReviewSourceContractSummaryView {
    return {
      contractId: record.contractId,
      contractCode: record.contractCode,
      contractName: record.contractName,
      customerName: record.customerName,
      ownerName: record.ownerName,
      totalAmount: record.totalAmount,
      submitApplyingAt: record.submitApplyingAt,
      approveStatus: record.approveStatus,
      pendingStep: record.pendingStep,
    };
  }

  private mapDetail(
    record: PendingApprovalContractSourceDetailRecord,
  ): ContractReviewSourceContractDetailView {
    return {
      contractId: record.contractId,
      contractCode: record.contractCode,
      contractName: record.contractName,
      customerName: record.customerName,
      opportunityTitle: record.opportunityTitle,
      ownerId: record.ownerId,
      ownerName: record.ownerName,
      organizationId: record.organizationId,
      departmentId: record.departmentId,
      departmentName: record.departmentName,
      totalAmount: record.totalAmount,
      startAt: record.startAt,
      endAt: record.endAt,
      signDate: record.signDate,
      customerSigner: record.customerSigner,
      ourSigner: record.ourSigner,
      specialTerms: record.specialTerms,
      specialTermBlocks: this.splitBlocks(record.specialTerms),
      approvalComment: record.approvalComment,
      approvalHistory: record.approvalHistory,
      approveStatus: record.approveStatus,
      pendingStep: record.pendingStep,
      submitApplyingAt: record.submitApplyingAt,
      sourceSummary: this.buildSourceSummary(record),
    };
  }

  private mapSnapshot(
    record: PendingApprovalContractSourceDetailRecord,
  ): ContractReviewSourceContractSnapshotRecord {
    const specialTermBlocks = this.splitBlocks(record.specialTerms);

    return {
      contractId: record.contractId,
      contractCode: record.contractCode,
      contractName: record.contractName,
      customerName: record.customerName,
      opportunityTitle: record.opportunityTitle,
      ownerId: record.ownerId,
      ownerName: record.ownerName,
      organizationId: record.organizationId,
      departmentId: record.departmentId,
      departmentName: record.departmentName,
      totalAmount: record.totalAmount,
      startAt: record.startAt,
      endAt: record.endAt,
      signDate: record.signDate,
      customerSigner: record.customerSigner,
      ourSigner: record.ourSigner,
      specialTerms: record.specialTerms,
      specialTermBlocks,
      approvalComment: record.approvalComment,
      approvalHistory: record.approvalHistory,
      approveStatus: record.approveStatus,
      pendingStep: record.pendingStep,
      submitApplyingAt: record.submitApplyingAt,
      sourceSummary: this.buildSourceSummary(record),
      reviewContent: this.buildReviewContent(record, specialTermBlocks),
    };
  }

  private splitBlocks(value?: string): string[] {
    const trimmedValue = value?.trim();
    if (!trimmedValue) {
      return [];
    }

    return trimmedValue
      .split(/\r?\n\r?\n|\r?\n/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private buildSourceSummary(
    record: PendingApprovalContractSourceDetailRecord,
  ): string {
    const summaryParts = [
      `合同名称：${record.contractName}`,
      record.customerName ? `客户：${record.customerName}` : undefined,
      `负责人：${record.ownerName}`,
      `审批状态：${record.approveStatus}`,
      record.pendingStep > 0
        ? `审批级次：第 ${record.pendingStep} 级`
        : undefined,
    ].filter((item): item is string => Boolean(item));

    return summaryParts.join('；');
  }

  /**
   * CRM 合同源数据没有原始 docx 时，仍然需要整理成稳定的审核输入文本，确保后续规则链路和 AI 审核都能复用。
   */
  private buildReviewContent(
    record: PendingApprovalContractSourceDetailRecord,
    specialTermBlocks: string[],
  ): string {
    const lines = [
      '合同基础信息',
      `合同名称：${record.contractName}`,
      record.contractCode ? `合同编号：${record.contractCode}` : undefined,
      record.customerName ? `客户名称：${record.customerName}` : undefined,
      record.opportunityTitle ? `商机名称：${record.opportunityTitle}` : undefined,
      `负责人：${record.ownerName}`,
      record.departmentName ? `所属部门：${record.departmentName}` : undefined,
      `合同金额：${this.formatAmount(record.totalAmount)} 元`,
      record.startAt ? `合同开始时间：${record.startAt}` : undefined,
      record.endAt ? `合同结束时间：${record.endAt}` : undefined,
      record.signDate ? `签订日期：${record.signDate}` : undefined,
      record.customerSigner ? `客户签署人：${record.customerSigner}` : undefined,
      record.ourSigner ? `我方签署人：${record.ourSigner}` : undefined,
      '',
      '审批信息',
      `审批状态：${record.approveStatus}`,
      record.pendingStep > 0
        ? `审批级次：第 ${record.pendingStep} 级`
        : undefined,
      record.submitApplyingAt ? `提交审批时间：${record.submitApplyingAt}` : undefined,
      record.approvalComment ? `审批备注：${record.approvalComment}` : undefined,
      '',
      '特殊条款',
      ...(specialTermBlocks.length > 0 ? specialTermBlocks : ['未记录特殊条款。']),
      '',
      '审批历史',
      ...(record.approvalHistory.length > 0
        ? record.approvalHistory.map((item) =>
            [
              `第 ${item.step} 级`,
              item.approverName ?? item.approverId ?? '未记录审批人',
              item.status,
              item.comment ? `备注：${item.comment}` : undefined,
              item.approveAt ? `时间：${item.approveAt}` : undefined,
            ]
              .filter((part): part is string => Boolean(part))
              .join(' / '),
          )
        : ['暂无审批历史。']),
    ];

    return lines.filter((item): item is string => item !== undefined).join('\n');
  }

  private formatAmount(amount: number): string {
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private recordViewedAuditEvent(
    user: CrmUser,
    contract: PendingApprovalContractSourceDetailRecord,
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'CONTRACT_REVIEW_SOURCE_CONTRACT_VIEWED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      permissionKey: 'contract-review',
      resourceType: 'contract-review-source-contract',
      resourceId: contract.contractId,
      channel: 'web-console',
      originalQuestion: contract.contractName,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `查看 CRM 合同数据：${contract.contractName}`,
      createdAt: new Date().toISOString(),
    });
  }
}
