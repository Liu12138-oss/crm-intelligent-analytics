import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { extname } from 'node:path';
import type {
  AuditEventRecord,
  ContractReviewArtifactRecord,
  ContractReviewDecision,
  ContractReviewExecutionMode,
  ContractReviewIssueRecord,
  ContractReviewSourceContractSnapshotRecord,
  ContractReviewReviewBasisRecord,
  ContractReviewRuleItem,
  ContractReviewRuleSetRecord,
  ContractReviewTaskRecord,
  CrmUser,
  RiskLevel,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { AccessDecisionService } from '../governance/access-decision.service';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { ContractReviewAnnotatedDocxService } from './contract-review.annotated-docx.service';
import { ContractReviewAiReviewService } from './contract-review.ai-review.service';
import { ContractReviewConfigService } from './contract-review.config';
import { ContractReviewDeterministicValidatorService } from './contract-review-deterministic-validator.service';
import { ContractReviewDocxExtractorService } from './contract-review.docx-extractor.service';
import { ContractReviewFactExtractorService } from './contract-review-fact-extractor.service';
import { ContractReviewFileStorageService } from './contract-review.file-storage.service';
import { ContractReviewRepository } from './contract-review.repository';
import type {
  ContractReviewDeterministicIssueCandidate,
  ContractReviewFactExtractionResult,
  ContractReviewReviewExecutionSummary,
  ContractReviewSkillPackSnapshot,
} from './contract-review.runtime.types';
import { ContractReviewSnapshotCompilerService } from './contract-review-snapshot.compiler.service';
import { ContractReviewSkillPackRuntimeService } from './skill-pack/contract-review-skill-pack.runtime.service';
import type { ContractReviewSkillPack } from './skill-pack/contract-review-skill-pack.types';
import type {
  ContractReviewDocumentSnapshot,
  ContractReviewArtifactView,
  ContractReviewCreateTaskResponse,
  ContractReviewIssueView,
  ContractReviewTaskDetailView,
  ContractReviewTaskSummaryView,
  UploadedContractFile,
} from './contract-review.types';

@Injectable()
export class ContractReviewService {
  private taskExecutionQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: ContractReviewRepository,
    private readonly configService: ContractReviewConfigService,
    private readonly annotatedDocxService: ContractReviewAnnotatedDocxService,
    private readonly aiReviewService: ContractReviewAiReviewService,
    private readonly deterministicValidatorService: ContractReviewDeterministicValidatorService,
    private readonly docxExtractorService: ContractReviewDocxExtractorService,
    private readonly factExtractorService: ContractReviewFactExtractorService,
    private readonly fileStorageService: ContractReviewFileStorageService,
    private readonly snapshotCompilerService: ContractReviewSnapshotCompilerService,
    private readonly skillPackRuntimeService: ContractReviewSkillPackRuntimeService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  listRecentTasks(user: CrmUser): { items: ContractReviewTaskSummaryView[] } {
    this.ensureContractWorkspaceAccess(user);
    return {
      items: this.repository
        // 工作台底部“最近审核记录”始终只展示当前登录人的任务，
        // 不能因为具备 cross_view 权限就放大到其他人的审核记录。
        .listVisibleTasks(user, false)
        .slice(0, 10)
        .map((task) =>
          this.mapTaskSummary(task, this.repository.listIssuesByTaskId(task.id)),
        ),
    };
  }

  async createTask(
    user: CrmUser,
    file: UploadedContractFile | undefined,
  ): Promise<ContractReviewCreateTaskResponse> {
    this.ensureContractWorkspaceAccess(user);
    this.permissionEnforcementService.ensureAction(
      user,
      'contract.review.upload',
      '当前用户无权上传合同进行审核。',
      {
        channel: 'web-console',
        resourceType: 'contract-review-upload',
      },
    );
    this.assertUploadedFile(file);
    const safeFile = this.normalizeUploadedFile(file as UploadedContractFile);
    this.validateUploadFile(safeFile);

    const activePack = this.skillPackRuntimeService.getActivePack();
    const initialReviewBasis = this.buildReviewBasisFromActivePack(activePack);
    const ruleSet = this.repository.getCurrentRuleSet();
    const now = new Date().toISOString();
    const taskId = buildEntityId('contract_review_task');
    const sourceFilePath = await this.fileStorageService.saveSourceFile(taskId, safeFile);

    const task: ContractReviewTaskRecord = {
      id: taskId,
      requesterId: user.id,
      requesterName: user.name,
      originalFileName: safeFile.originalname,
      sourceType: 'UPLOAD',
      storedFilePath: sourceFilePath,
      mimeType: safeFile.mimetype,
      fileSize: safeFile.size,
      status: 'UPLOADED',
      latestStageMessage: '文件已上传，等待系统开始审核。',
      ruleSetCode: ruleSet.code,
      ruleSetVersion: ruleSet.version,
      overallDecision: 'REVISE',
      summary: '合同已上传，系统正在准备审核。',
      latestResultSummary: '文件已上传，等待系统完成审核。',
      vetoCount: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 0,
      reviewBasis: initialReviewBasis,
      createdAt: now,
      updatedAt: now,
    };

    this.repository.saveTask(task);
    this.recordAuditEvent(user, 'CONTRACT_REVIEW_FILE_UPLOADED', task, 'LOW', '合同文件上传成功。');
    this.recordAuditEvent(
      user,
      'CONTRACT_REVIEW_TASK_CREATED',
      task,
      'LOW',
      '合同审核任务已创建。',
    );

    this.enqueueTaskExecution(async () => {
      await this.processTask(user, safeFile, activePack, initialReviewBasis, ruleSet, task);
    });

    return {
      taskId: task.id,
      status: task.status,
      createdAt: task.createdAt,
    };
  }

  async createTaskFromCrmContract(
    user: CrmUser,
    sourceContract: ContractReviewSourceContractSnapshotRecord,
  ): Promise<ContractReviewCreateTaskResponse> {
    const normalizedSourceContract =
      this.normalizeCrmSourceContractSnapshot(sourceContract);
    this.ensureContractWorkspaceAccess(user);
    this.permissionEnforcementService.ensureAction(
      user,
      'contract.review.upload',
      '当前用户无权从 CRM 合同发起审核。',
      {
        channel: 'web-console',
        resourceType: 'contract-review-source-contract',
        resourceId: normalizedSourceContract.contractId,
      },
    );

    const activePack = this.skillPackRuntimeService.getActivePack();
    const initialReviewBasis = this.buildReviewBasisFromActivePack(activePack);
    const ruleSet = this.repository.getCurrentRuleSet();
    const now = new Date().toISOString();
    const taskId = buildEntityId('contract_review_task');

    const task: ContractReviewTaskRecord = {
      id: taskId,
      requesterId: user.id,
      requesterName: user.name,
      originalFileName: normalizedSourceContract.contractName,
      sourceType: 'CRM_PENDING_APPROVAL',
      sourceContractId: normalizedSourceContract.contractId,
      sourceContractSnapshot: normalizedSourceContract,
      storedFilePath: `crm-pending-approval:${normalizedSourceContract.contractId}`,
      mimeType: 'application/x.crm-contract-source+json',
      fileSize: Buffer.byteLength(normalizedSourceContract.reviewContent, 'utf8'),
      status: 'UPLOADED',
      latestStageMessage: '合同已加入审核队列，系统正在整理 CRM 合同快照。',
      ruleSetCode: ruleSet.code,
      ruleSetVersion: ruleSet.version,
      overallDecision: 'REVISE',
      summary: normalizedSourceContract.sourceSummary,
      latestResultSummary: '合同数据已加载，等待系统完成审核。',
      vetoCount: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 0,
      reviewBasis: initialReviewBasis,
      createdAt: now,
      updatedAt: now,
    };

    this.repository.saveTask(task);
    this.recordSourceContractReviewStarted(user, task, normalizedSourceContract);
    this.recordAuditEvent(
      user,
      'CONTRACT_REVIEW_TASK_CREATED',
      task,
      'LOW',
      '合同审核任务已创建。',
    );

    this.enqueueTaskExecution(async () => {
      await this.processCrmSourceTask(
        user,
        normalizedSourceContract,
        activePack,
        initialReviewBasis,
        ruleSet,
        task,
      );
    });

    return {
      taskId: task.id,
      status: task.status,
      createdAt: task.createdAt,
    };
  }

  async waitForTaskExecution(): Promise<void> {
    await this.taskExecutionQueue;
  }

  private enqueueTaskExecution(executor: () => Promise<void>): void {
    this.taskExecutionQueue = this.taskExecutionQueue
      .then(async () => {
        await executor();
      })
      .catch(() => undefined);
  }

  private enqueueSupplementalReview(executor: () => Promise<void>): void {
    // AI 主审模式下不再进入补充审核队列，保留空实现仅用于兼容历史流程分支。
    void executor;
  }

  /**
   * CRM 源合同依赖真实库字段拼接审核正文，线上偶发的空值或异常标量不能直接透传到任务创建链路，
   * 否则会在 `Buffer.byteLength(...)`、文本拆分或后续正文解析阶段直接抛出 500。
   */
  private normalizeCrmSourceContractSnapshot(
    sourceContract: ContractReviewSourceContractSnapshotRecord,
  ): ContractReviewSourceContractSnapshotRecord {
    const contractId = this.normalizeCrmSourceText(sourceContract.contractId) ?? 'unknown-contract';
    const contractName = this.normalizeCrmSourceText(sourceContract.contractName) ?? contractId;
    const contractCode = this.normalizeCrmSourceText(sourceContract.contractCode);
    const customerName = this.normalizeCrmSourceText(sourceContract.customerName);
    const opportunityTitle = this.normalizeCrmSourceText(sourceContract.opportunityTitle);
    const ownerId = this.normalizeCrmSourceText(sourceContract.ownerId) ?? 'unknown-owner';
    const ownerName = this.normalizeCrmSourceText(sourceContract.ownerName) ?? '未记录负责人';
    const organizationId =
      this.normalizeCrmSourceText(sourceContract.organizationId) ?? 'unknown-organization';
    const departmentId = this.normalizeCrmSourceText(sourceContract.departmentId);
    const departmentName = this.normalizeCrmSourceText(sourceContract.departmentName);
    const totalAmount = this.normalizeCrmSourceNumber(sourceContract.totalAmount) ?? 0;
    const startAt = this.normalizeCrmSourceText(sourceContract.startAt);
    const endAt = this.normalizeCrmSourceText(sourceContract.endAt);
    const signDate = this.normalizeCrmSourceText(sourceContract.signDate);
    const customerSigner = this.normalizeCrmSourceText(sourceContract.customerSigner);
    const ourSigner = this.normalizeCrmSourceText(sourceContract.ourSigner);
    const specialTerms = this.normalizeCrmSourceText(sourceContract.specialTerms);
    const specialTermBlocks = this.normalizeCrmSourceTextArray(
      sourceContract.specialTermBlocks,
    );
    const approvalComment = this.normalizeCrmSourceText(sourceContract.approvalComment);
    const approvalHistory = Array.isArray(sourceContract.approvalHistory)
      ? sourceContract.approvalHistory.map((item) => ({
          step: this.normalizeCrmSourceInteger(item.step) ?? 0,
          status: this.normalizeCrmSourceText(item.status) ?? 'pending',
          approverId: this.normalizeCrmSourceText(item.approverId),
          approverName: this.normalizeCrmSourceText(item.approverName),
          approveAt: this.normalizeCrmSourceText(item.approveAt),
          comment: this.normalizeCrmSourceText(item.comment),
        }))
      : [];
    const approveStatus = this.normalizeCrmSourceText(sourceContract.approveStatus) ?? '待审批';
    const pendingStep = this.normalizeCrmSourceInteger(sourceContract.pendingStep) ?? 0;
    const submitApplyingAt = this.normalizeCrmSourceText(sourceContract.submitApplyingAt);

    const normalizedSourceContract: ContractReviewSourceContractSnapshotRecord = {
      ...sourceContract,
      contractId,
      contractCode,
      contractName,
      customerName,
      opportunityTitle,
      ownerId,
      ownerName,
      organizationId,
      departmentId,
      departmentName,
      totalAmount,
      startAt,
      endAt,
      signDate,
      customerSigner,
      ourSigner,
      specialTerms,
      specialTermBlocks,
      approvalComment,
      approvalHistory,
      approveStatus,
      pendingStep,
      submitApplyingAt,
      sourceSummary: '',
      reviewContent: '',
    };

    normalizedSourceContract.sourceSummary =
      this.normalizeCrmSourceText(sourceContract.sourceSummary) ??
      this.buildCrmSourceContractSummary(normalizedSourceContract);
    normalizedSourceContract.reviewContent =
      this.normalizeCrmSourceText(sourceContract.reviewContent) ??
      this.buildCrmSourceContractReviewContent(normalizedSourceContract);

    return normalizedSourceContract;
  }

  /**
   * CRM 字段在不同环境可能出现 `null`、空字符串甚至数值，统一在这里转成稳定文本，避免同步创建链路再散落兜底。
   */
  private normalizeCrmSourceText(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      return trimmedValue || undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : undefined;
    }

    return undefined;
  }

  /**
   * 合同金额来自只读库时可能是字符串化 decimal；统一转为有限数值，避免正文拼接和前端展示出现 `NaN`。
   */
  private normalizeCrmSourceNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        return undefined;
      }

      const parsedValue = Number(trimmedValue);
      return Number.isFinite(parsedValue) ? parsedValue : undefined;
    }

    return undefined;
  }

  /**
   * 审批层级需要是整数语义；非法值统一回落为 `undefined`，再由调用方决定默认层级。
   */
  private normalizeCrmSourceInteger(value: unknown): number | undefined {
    const parsedValue = this.normalizeCrmSourceNumber(value);
    if (parsedValue === undefined) {
      return undefined;
    }

    return Number.isInteger(parsedValue) ? parsedValue : Math.trunc(parsedValue);
  }

  /**
   * 特殊条款与审批历史正文要剔除空白项，避免生成空行块并影响后续规则提取。
   */
  private normalizeCrmSourceTextArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.normalizeCrmSourceText(item))
      .filter((item): item is string => Boolean(item));
  }

  /**
   * 当 CRM 未给出可展示摘要时，至少保证最近任务列表和审计记录里仍然能看懂来源合同是谁。
   */
  private buildCrmSourceContractSummary(
    sourceContract: ContractReviewSourceContractSnapshotRecord,
  ): string {
    const summaryParts = [
      `合同名称：${sourceContract.contractName}`,
      sourceContract.customerName ? `客户：${sourceContract.customerName}` : undefined,
      `负责人：${sourceContract.ownerName}`,
      `审批状态：${sourceContract.approveStatus}`,
      sourceContract.pendingStep > 0 ? `审批级次：第 ${sourceContract.pendingStep} 级` : undefined,
    ].filter((item): item is string => Boolean(item));

    return summaryParts.join(' / ');
  }

  /**
   * 如果真实库没返回审核正文快照，就基于白名单字段重新拼一份最小可用文本，保证 CRM 发起审核至少能进入异步队列。
   */
  private buildCrmSourceContractReviewContent(
    sourceContract: ContractReviewSourceContractSnapshotRecord,
  ): string {
    const lines = [
      '合同基础信息',
      `合同名称：${sourceContract.contractName}`,
      sourceContract.contractCode ? `合同编号：${sourceContract.contractCode}` : undefined,
      sourceContract.customerName ? `客户名称：${sourceContract.customerName}` : undefined,
      sourceContract.opportunityTitle ? `商机名称：${sourceContract.opportunityTitle}` : undefined,
      `负责人：${sourceContract.ownerName}`,
      sourceContract.departmentName ? `所属部门：${sourceContract.departmentName}` : undefined,
      `合同金额：${sourceContract.totalAmount}`,
      sourceContract.startAt ? `合同开始时间：${sourceContract.startAt}` : undefined,
      sourceContract.endAt ? `合同结束时间：${sourceContract.endAt}` : undefined,
      sourceContract.signDate ? `签订日期：${sourceContract.signDate}` : undefined,
      sourceContract.customerSigner ? `客户签约人：${sourceContract.customerSigner}` : undefined,
      sourceContract.ourSigner ? `我方签约人：${sourceContract.ourSigner}` : undefined,
      '',
      '审批信息',
      `审批状态：${sourceContract.approveStatus}`,
      sourceContract.pendingStep > 0 ? `审批级次：第 ${sourceContract.pendingStep} 级` : undefined,
      sourceContract.submitApplyingAt
        ? `提交审批时间：${sourceContract.submitApplyingAt}`
        : undefined,
      sourceContract.approvalComment ? `审批备注：${sourceContract.approvalComment}` : undefined,
      '',
      '特殊条款',
      ...(sourceContract.specialTermBlocks.length > 0
        ? sourceContract.specialTermBlocks
        : sourceContract.specialTerms
          ? [sourceContract.specialTerms]
          : ['未记录特殊条款']),
      '',
      '审批历史',
      ...(sourceContract.approvalHistory.length > 0
        ? sourceContract.approvalHistory.map((item) =>
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
        : ['暂无审批历史']),
    ];

    return lines.filter((item): item is string => item !== undefined).join('\n');
  }

  private async processTask(
    user: CrmUser,
    safeFile: UploadedContractFile,
    activePack: ContractReviewSkillPack,
    initialReviewBasis: ContractReviewReviewBasisRecord,
    ruleSet: ContractReviewRuleSetRecord,
    task: ContractReviewTaskRecord,
  ): Promise<void> {
    try {
      task = this.repository.saveTask({
        ...task,
        status: 'PARSING',
        latestStageMessage: '正在提取合同文本与结构摘要。',
        updatedAt: new Date().toISOString(),
      });

      const documentSnapshot = this.docxExtractorService.extract(safeFile.buffer);
      const factExtraction = this.factExtractorService.extract(documentSnapshot);
      const packSnapshot = this.snapshotCompilerService.compile(activePack, factExtraction);
      // 新链路由 AI 一次性完成全量审核，补充审核阶段仅保留兼容字段，不再进入主流程。
      const supplementalSnapshot = packSnapshot;
      const shouldRunSupplementalAiReview = false;
      task = this.repository.saveTask({
        ...task,
        status: 'REVIEWING',
        latestStageMessage: `已固化 ${packSnapshot.checkCount} 个审核检查项，正在识别合同风险。`,
        summary: factExtraction.summary,
        reviewBasis: this.buildReviewBasisFromSnapshot(packSnapshot),
        updatedAt: new Date().toISOString(),
      });

      const reviewResult = await this.buildReviewIssues(
        task.id,
        safeFile.originalname,
        documentSnapshot,
        packSnapshot,
        factExtraction,
        activePack.requirements,
        activePack.workflow,
        activePack.prompts,
      );
      const aiDebugContext = this.aiReviewService.consumeLastDebugContext?.();
      this.repository.replaceIssues(task.id, reviewResult.issues);

      task = this.repository.saveTask({
        ...task,
        status: 'GENERATING_REPORT',
        latestStageMessage: '正在生成审核报告、批注稿与结构化结果。',
        updatedAt: new Date().toISOString(),
      });

      const decision = this.resolveOverallDecision(reviewResult.issues);
      const artifacts = this.appendAiDebugArtifact(
        this.initializeArtifacts(task.id, reviewResult.reviewBasis),
        task.id,
        reviewResult.reviewBasis,
        aiDebugContext,
      );
      this.repository.replaceArtifacts(task.id, artifacts);

      await this.generateArtifact(
        task.id,
        artifacts,
        'REPORT',
        async () =>
          await this.fileStorageService.saveTextArtifact(
            task.id,
            'review-report.md',
            this.buildReviewReport(
              task,
              reviewResult.issues,
              documentSnapshot,
              packSnapshot,
              factExtraction,
              reviewResult.executionSummary,
            ),
          ),
      );
      await this.generateArtifact(
        task.id,
        artifacts,
        'STRUCTURED_RESULT',
        async () =>
          await this.fileStorageService.saveTextArtifact(
            task.id,
            'review-result.json',
            JSON.stringify(
              {
                taskId: task.id,
                contractName: task.originalFileName,
                ruleSet: { code: ruleSet.code, version: ruleSet.version },
                summary: documentSnapshot.summary,
                packSnapshot,
                factExtraction,
                execution: reviewResult.executionSummary,
                document: {
                  title: documentSnapshot.title,
                  paragraphCount: documentSnapshot.paragraphs.length,
                  headingCount: documentSnapshot.headings.length,
                  clauseCount: documentSnapshot.clauses.length,
                },
                issues: reviewResult.issues.map((issue) => ({
                  issueId: issue.id,
                  title: issue.title,
                  riskLevel: issue.riskLevel,
                  isVeto: issue.isVeto,
                  quote: issue.quote,
                  description: issue.description,
                  suggestion: issue.suggestion,
                  ruleCode: issue.ruleCode,
                  sourceClause: issue.sourceClause,
                })),
              },
              null,
              2,
            ),
          ),
      );
      await this.generateArtifact(
        task.id,
        artifacts,
        'AI_DEBUG_CONTEXT',
        async () =>
          await this.fileStorageService.saveTextArtifact(
            task.id,
            'ai-debug-context.json',
            this.buildAiDebugArtifactContent(aiDebugContext),
          ),
      );
      await this.generateArtifact(
        task.id,
        artifacts,
        'ANNOTATED_DOCX',
        async () => {
          const annotatedDocx = this.annotatedDocxService.buildAnnotatedDocx(
            safeFile.buffer,
            reviewResult.issues,
          );
          return await this.fileStorageService.saveBinaryArtifact(
            task.id,
            'annotated-review.docx',
            annotatedDocx,
          );
        },
      );

      const counters = this.countIssues(reviewResult.issues);
      const failedArtifacts = artifacts.filter((artifact) => artifact.status === 'FAILED');
      task = this.repository.saveTask({
        ...task,
        status: 'COMPLETED',
        latestStageMessage:
          shouldRunSupplementalAiReview
            ? `规则快审已完成，AI 正在补充审核 ${supplementalSnapshot.checkCount} 项待确认条目。`
            : reviewResult.executionSummary.mode === 'DETERMINISTIC_ONLY'
            ? this.buildDegradedCompletionMessage(
                failedArtifacts.length,
                reviewResult.executionSummary.degradationReason,
              )
            : failedArtifacts.length > 0
            ? `审核完成，${failedArtifacts.length} 个产物生成失败，可先查看风险详情。`
            : '审核完成，可查看风险详情。',
        overallDecision: decision,
        latestResultSummary: this.buildLatestResultSummary(
          decision,
          counters,
          reviewResult.executionSummary,
        ),
        vetoCount: counters.vetoCount,
        highRiskCount: counters.highRiskCount,
        mediumRiskCount: counters.mediumRiskCount,
        lowRiskCount: counters.lowRiskCount,
        totalIssueCount: reviewResult.issues.length,
        reviewBasis: reviewResult.reviewBasis,
        supplementalReviewStatus: shouldRunSupplementalAiReview ? 'PENDING' : undefined,
        supplementalReviewMessage: shouldRunSupplementalAiReview
          ? `AI 正在补充审核 ${supplementalSnapshot.checkCount} 个规则未覆盖项，当前先展示规则快审结果。`
          : undefined,
        supplementalCompletedAt: undefined,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      this.recordAuditEvent(
        user,
        'CONTRACT_REVIEW_TASK_COMPLETED',
        task,
        counters.vetoCount > 0 || counters.highRiskCount > 0 ? 'HIGH' : 'LOW',
        '合同审核任务已完成。',
      );

      if (shouldRunSupplementalAiReview) {
        this.enqueueSupplementalReview(async () => {
          await this.processSupplementalAiReview(
            task.id,
            safeFile.buffer,
            activePack,
            ruleSet,
            documentSnapshot,
            factExtraction,
            packSnapshot,
            supplementalSnapshot,
          );
        });
      }
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : '合同审核失败。';
      const isBlocked = error instanceof BadRequestException;
      task = this.repository.saveTask({
        ...task,
        status: isBlocked ? 'BLOCKED' : 'FAILED',
        latestStageMessage: failureMessage,
        latestResultSummary: failureMessage,
        reviewBasis: this.buildBlockedReviewBasis(task.reviewBasis ?? initialReviewBasis, failureMessage),
        updatedAt: new Date().toISOString(),
      });

      this.recordAuditEvent(
        user,
        isBlocked ? 'CONTRACT_REVIEW_TASK_BLOCKED' : 'CONTRACT_REVIEW_TASK_FAILED',
        task,
        isBlocked ? 'MEDIUM' : 'HIGH',
        isBlocked ? '合同审核任务被阻断。' : '合同审核任务执行失败。',
        failureMessage,
      );
    }
  }

  private async processCrmSourceTask(
    user: CrmUser,
    sourceContract: ContractReviewSourceContractSnapshotRecord,
    activePack: ContractReviewSkillPack,
    initialReviewBasis: ContractReviewReviewBasisRecord,
    ruleSet: ContractReviewRuleSetRecord,
    task: ContractReviewTaskRecord,
  ): Promise<void> {
    try {
      task = this.repository.saveTask({
        ...task,
        status: 'PARSING',
        latestStageMessage: '正在整理 CRM 合同字段、特殊条款与审批备注。',
        updatedAt: new Date().toISOString(),
      });

      const documentSnapshot =
        this.buildDocumentSnapshotFromSourceContract(sourceContract);
      const factExtraction = this.factExtractorService.extract(documentSnapshot);
      const packSnapshot = this.snapshotCompilerService.compile(
        activePack,
        factExtraction,
      );
      const shouldRunSupplementalAiReview = false;

      task = this.repository.saveTask({
        ...task,
        status: 'REVIEWING',
        latestStageMessage: `已固化 ${packSnapshot.checkCount} 个审核检查项，正在识别合同风险。`,
        summary: factExtraction.summary,
        reviewBasis: this.buildReviewBasisFromSnapshot(packSnapshot),
        updatedAt: new Date().toISOString(),
      });

      const reviewResult = await this.buildReviewIssues(
        task.id,
        task.originalFileName,
        documentSnapshot,
        packSnapshot,
        factExtraction,
        activePack.requirements,
        activePack.workflow,
        activePack.prompts,
      );
      const aiDebugContext = this.aiReviewService.consumeLastDebugContext?.();
      this.repository.replaceIssues(task.id, reviewResult.issues);

      task = this.repository.saveTask({
        ...task,
        status: 'GENERATING_REPORT',
        latestStageMessage: '正在生成审核报告与结构化结果。',
        updatedAt: new Date().toISOString(),
      });

      const decision = this.resolveOverallDecision(reviewResult.issues);
      const artifacts = this.appendAiDebugArtifact(
        this.initializeArtifacts(task.id, reviewResult.reviewBasis),
        task.id,
        reviewResult.reviewBasis,
        aiDebugContext,
      );
      this.repository.replaceArtifacts(task.id, artifacts);

      await this.generateArtifact(
        task.id,
        artifacts,
        'REPORT',
        async () =>
          await this.fileStorageService.saveTextArtifact(
            task.id,
            'review-report.md',
            this.buildReviewReport(
              task,
              reviewResult.issues,
              documentSnapshot,
              packSnapshot,
              factExtraction,
              reviewResult.executionSummary,
            ),
          ),
      );
      await this.generateArtifact(
        task.id,
        artifacts,
        'STRUCTURED_RESULT',
        async () =>
          await this.fileStorageService.saveTextArtifact(
            task.id,
            'review-result.json',
            JSON.stringify(
              {
                taskId: task.id,
                contractName: task.originalFileName,
                ruleSet: { code: ruleSet.code, version: ruleSet.version },
                summary: documentSnapshot.summary,
                packSnapshot,
                factExtraction,
                execution: reviewResult.executionSummary,
                document: {
                  title: documentSnapshot.title,
                  paragraphCount: documentSnapshot.paragraphs.length,
                  headingCount: documentSnapshot.headings.length,
                  clauseCount: documentSnapshot.clauses.length,
                },
                sourceContract: {
                  contractId: sourceContract.contractId,
                  contractCode: sourceContract.contractCode,
                  contractName: sourceContract.contractName,
                  customerName: sourceContract.customerName,
                  opportunityTitle: sourceContract.opportunityTitle,
                  ownerName: sourceContract.ownerName,
                  totalAmount: sourceContract.totalAmount,
                  approveStatus: sourceContract.approveStatus,
                  pendingStep: sourceContract.pendingStep,
                  submitApplyingAt: sourceContract.submitApplyingAt,
                },
                issues: reviewResult.issues.map((issue) => ({
                  issueId: issue.id,
                  title: issue.title,
                  riskLevel: issue.riskLevel,
                  isVeto: issue.isVeto,
                  quote: issue.quote,
                  description: issue.description,
                  suggestion: issue.suggestion,
                  ruleCode: issue.ruleCode,
                  sourceClause: issue.sourceClause,
                })),
              },
              null,
              2,
            ),
          ),
      );
      await this.generateArtifact(
        task.id,
        artifacts,
        'AI_DEBUG_CONTEXT',
        async () =>
          await this.fileStorageService.saveTextArtifact(
            task.id,
            'ai-debug-context.json',
            this.buildAiDebugArtifactContent(aiDebugContext),
          ),
      );
      await this.generateArtifact(
        task.id,
        artifacts,
        'ANNOTATED_DOCX',
        async () => {
          throw new Error(
            '当前任务来源于 CRM 合同数据，缺少原始 docx，暂不支持生成批注稿。',
          );
        },
      );

      const counters = this.countIssues(reviewResult.issues);
      const failedArtifacts = artifacts.filter((artifact) => artifact.status === 'FAILED');
      task = this.repository.saveTask({
        ...task,
        status: 'COMPLETED',
        latestStageMessage:
          shouldRunSupplementalAiReview
            ? `规则快审已完成，AI 正在补充审核 ${packSnapshot.checkCount} 项待确认条目。`
            : reviewResult.executionSummary.mode === 'DETERMINISTIC_ONLY'
            ? this.buildDegradedCompletionMessage(
                failedArtifacts.length,
                reviewResult.executionSummary.degradationReason,
              )
            : failedArtifacts.length > 0
            ? `审核完成，${failedArtifacts.length} 个产物暂不可用，可先查看风险详情。`
            : '审核完成，可查看风险详情。',
        overallDecision: decision,
        latestResultSummary: this.buildLatestResultSummary(
          decision,
          counters,
          reviewResult.executionSummary,
        ),
        vetoCount: counters.vetoCount,
        highRiskCount: counters.highRiskCount,
        mediumRiskCount: counters.mediumRiskCount,
        lowRiskCount: counters.lowRiskCount,
        totalIssueCount: reviewResult.issues.length,
        reviewBasis: reviewResult.reviewBasis,
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      this.recordAuditEvent(
        user,
        'CONTRACT_REVIEW_TASK_COMPLETED',
        task,
        counters.vetoCount > 0 || counters.highRiskCount > 0 ? 'HIGH' : 'LOW',
        '合同审核任务已完成。',
      );
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : '合同审核失败。';
      const isBlocked = error instanceof BadRequestException;
      task = this.repository.saveTask({
        ...task,
        status: isBlocked ? 'BLOCKED' : 'FAILED',
        latestStageMessage: failureMessage,
        latestResultSummary: failureMessage,
        reviewBasis: this.buildBlockedReviewBasis(
          task.reviewBasis ?? initialReviewBasis,
          failureMessage,
        ),
        updatedAt: new Date().toISOString(),
      });

      this.recordAuditEvent(
        user,
        isBlocked ? 'CONTRACT_REVIEW_TASK_BLOCKED' : 'CONTRACT_REVIEW_TASK_FAILED',
        task,
        isBlocked ? 'MEDIUM' : 'HIGH',
        isBlocked ? '合同审核任务被阻断。' : '合同审核任务执行失败。',
        failureMessage,
      );
    }
  }

  getTaskDetail(user: CrmUser, taskId: string): ContractReviewTaskDetailView {
    const task = this.getAccessibleTask(user, taskId);
    const reviewBasis = this.resolveTaskReviewBasis(task);
    const ruleSet =
      this.repository.findRuleSetByCodeVersion(task.ruleSetCode, task.ruleSetVersion) ??
      this.repository.getCurrentRuleSet();
    const issues = this.sortIssues(this.repository.listIssuesByTaskId(task.id));
    const artifacts = this.repository.listArtifactsByTaskId(task.id);

    return {
      taskId: task.id,
      contractName: this.normalizePotentialMojibakeText(task.originalFileName),
      sourceType: task.sourceType,
      status: task.status,
      latestStageMessage: task.latestStageMessage,
      overallDecision: task.overallDecision,
      summary: task.summary,
      latestResultSummary: this.resolveTaskSummary(task, issues),
      vetoCount: this.resolveIssueCounters(task, issues).vetoCount,
      highRiskCount: this.resolveIssueCounters(task, issues).highRiskCount,
      mediumRiskCount: this.resolveIssueCounters(task, issues).mediumRiskCount,
      lowRiskCount: this.resolveIssueCounters(task, issues).lowRiskCount,
      totalIssueCount: issues.length > 0 ? issues.length : task.totalIssueCount,
      supplementalReviewStatus: task.supplementalReviewStatus,
      supplementalReviewMessage: task.supplementalReviewMessage,
      supplementalCompletedAt: task.supplementalCompletedAt,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      reviewBasis,
      naturalLanguageEntryCapability:
        this.buildNaturalLanguageEntryCapability(),
      ruleSet: {
        code: ruleSet.code,
        version: ruleSet.version,
        title: ruleSet.title,
        summary: ruleSet.summary,
      },
      issues: issues.map((issue) => this.mapIssue(issue)),
      artifacts: artifacts.map((artifact) => this.mapArtifact(task, artifact)),
    };
  }

  private buildDocumentSnapshotFromSourceContract(
    sourceContract: ContractReviewSourceContractSnapshotRecord,
  ): ContractReviewDocumentSnapshot {
    const lines = sourceContract.reviewContent
      .split(/\r?\n/u)
      .map((item) => item.trim())
      .filter(Boolean);
    const paragraphs = lines.map((text, index) => ({
      index: index + 1,
      text,
      locator: `CRM合同字段${index + 1}`,
      source: 'document' as const,
    }));
    const headings = lines
      .filter((text) => /^【.+】$/u.test(text))
      .map((text, index) => ({
        index: index + 1,
        text,
        locator: `CRM标题${index + 1}`,
        source: 'document' as const,
        style: 'heading-1',
      }));
    const clauses = paragraphs
      .filter((item) => !/^【.+】$/u.test(item.text))
      .map((item, index) => ({
        ...item,
        index: index + 1,
        locator: `CRM条款${index + 1}`,
      }));

    return {
      title: sourceContract.contractName,
      summary: sourceContract.sourceSummary,
      fullText: sourceContract.reviewContent,
      paragraphs,
      headings,
      clauses,
    };
  }

  private recordSourceContractReviewStarted(
    user: CrmUser,
    task: ContractReviewTaskRecord,
    sourceContract: ContractReviewSourceContractSnapshotRecord,
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'CONTRACT_REVIEW_SOURCE_REVIEW_STARTED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      permissionKey: 'contract.review.upload',
      resourceType: 'contract-review-source-contract',
      resourceId: sourceContract.contractId,
      channel: 'web-console',
      relatedRequestId: task.id,
      originalQuestion: sourceContract.contractName,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `基于待1级审批合同发起审核：${sourceContract.contractName}`,
      contractReviewReviewBasis: this.resolveTaskReviewBasis(task),
      createdAt: new Date().toISOString(),
    });
  }

  getArtifactDownload(user: CrmUser, taskId: string, artifactId: string): ContractReviewArtifactRecord {
    const task = this.getAccessibleTask(user, taskId, 'download');
    const artifact = this.repository.findArtifactById(task.id, artifactId);
    if (!artifact) {
      throw new NotFoundException('未找到对应的审核产物。');
    }

    if (artifact.status !== 'AVAILABLE' || !artifact.filePath) {
      throw new BadRequestException('当前产物尚未生成完成，暂不支持下载。');
    }

    this.recordAuditEvent(
      user,
      'CONTRACT_REVIEW_ARTIFACT_DOWNLOADED',
      task,
      'LOW',
      `下载合同审核产物：${artifact.fileName}`,
    );

    return {
      ...artifact,
      reviewBasis: this.resolveArtifactReviewBasis(task, artifact),
    };
  }

  private getAccessibleTask(
    user: CrmUser,
    taskId: string,
    accessType: 'detail' | 'download' = 'detail',
  ): ContractReviewTaskRecord {
    const task = this.repository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException('未找到对应的合同审核任务。');
    }

    const hasAccess =
      accessType === 'download'
        ? this.canDownloadTask(user, task)
        : this.canAccessTaskDetail(user, task);

    if (!hasAccess) {
      const permissionKey =
        task.requesterId === user.id
          ? 'contract-review'
          : accessType === 'download'
            ? 'contract.review.cross_download'
            : 'contract.review.cross_view';
      const eventType =
        task.requesterId === user.id ? 'ACCESS_MENU_DENIED' : 'ACCESS_ACTION_DENIED';

      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType,
        actorId: user.id,
        actorRoleIds: user.roleIds,
        permissionKey,
        resourceType: accessType === 'download' ? 'contract-review-artifact' : 'contract-review-task',
        resourceId: accessType === 'download' ? `${taskId}:${task.id}` : task.id,
        channel: 'web-console',
        scopeSnapshot: this.userScopeService.resolveScope(user),
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome:
          accessType === 'download'
            ? '当前无权下载该合同审核产物。'
            : '当前仅允许查看本人创建的合同审核任务，或由授权角色查看。',
        failureReason:
          accessType === 'download'
            ? '当前无权下载该合同审核产物。'
            : '当前仅允许查看本人创建的合同审核任务，或由授权角色查看。',
        createdAt: new Date().toISOString(),
      });

      throw new ForbiddenException(
        accessType === 'download'
          ? '当前无权下载该合同审核产物。'
          : '当前仅允许查看本人创建的合同审核任务，或由授权角色查看。',
      );
    }

    return task;
  }

  private assertUploadedFile(file: UploadedContractFile | undefined): void {
    if (!file) {
      throw new BadRequestException('请先上传待审核的 .docx 合同文件。');
    }
  }

  private normalizeUploadedFile(file: UploadedContractFile): UploadedContractFile {
    const normalizedFileName = this.normalizePotentialMojibakeText(file.originalname);
    if (normalizedFileName === file.originalname) {
      return file;
    }

    return {
      ...file,
      originalname: normalizedFileName,
    };
  }

  private validateUploadFile(file: UploadedContractFile): void {
    const extension = extname(file.originalname).toLowerCase();
    if (!this.configService.getAllowedExtensions().includes(extension)) {
      throw new BadRequestException('当前仅支持上传 .docx 合同文件。');
    }

    if (file.size <= 0) {
      throw new BadRequestException('上传文件为空，请重新选择有效合同。');
    }

    if (file.size > this.configService.getMaxFileSizeBytes()) {
      throw new BadRequestException('上传文件超过当前大小限制，请压缩后重试。');
    }
  }

  private async buildReviewIssues(
    taskId: string,
    fileName: string,
    documentSnapshot: ContractReviewDocumentSnapshot,
    packSnapshot: ContractReviewSkillPackSnapshot,
    factExtraction: ContractReviewFactExtractionResult,
    requirementsText: string,
    workflowText: string,
    promptSet: {
      planner: string;
      reviewer: string;
      summarizer: string;
    },
  ): Promise<{
    issues: ContractReviewIssueRecord[];
    executionSummary: ContractReviewReviewExecutionSummary;
    reviewBasis: ContractReviewReviewBasisRecord;
  }> {
    const executableSnapshot = this.filterSnapshotForExecutionMode(packSnapshot);
    const rules = this.mapSnapshotToRuleItems(executableSnapshot);
    const now = new Date().toISOString();
    const deterministicCandidates = this.deterministicValidatorService.validate(
      executableSnapshot,
      factExtraction,
    );
    let aiReviewedIssues: ContractReviewIssueRecord[] | null = null;
    let aiFailureReason: string | undefined;

    let resolvedReviewResult:
      | ReturnType<ContractReviewService['buildDeterministicOnlyReviewIssues']>
      | ReturnType<ContractReviewService['mergeReviewIssues']>;

    if (executableSnapshot.executionMode === 'DETERMINISTIC_ONLY') {
      resolvedReviewResult = this.buildDeterministicOnlyReviewIssues(
        taskId,
        rules,
        deterministicCandidates,
        now,
      );
    } else {
      aiReviewedIssues = await this.buildAiReviewedIssues(
        taskId,
        documentSnapshot,
        executableSnapshot,
        factExtraction,
        requirementsText,
        workflowText,
        promptSet,
        now,
      );
      aiFailureReason =
        aiReviewedIssues === null
          ? this.aiReviewService.consumeLastFailureReason()
          : undefined;
      resolvedReviewResult = this.mergeReviewIssues(
        taskId,
        rules,
        aiReviewedIssues,
        deterministicCandidates,
        aiFailureReason,
        now,
        fileName,
      );
    }
    const reviewBasis = this.buildReviewBasisFromSnapshot(
      executableSnapshot,
      resolvedReviewResult.executionSummary,
    );

    return {
      issues: resolvedReviewResult.issues.map((issue) => ({
        ...issue,
        reviewBasis,
      })),
      executionSummary: resolvedReviewResult.executionSummary,
      reviewBasis,
    };
  }

  private filterSnapshotForExecutionMode(
    packSnapshot: ContractReviewSkillPackSnapshot,
  ): ContractReviewSkillPackSnapshot {
    if (packSnapshot.executionMode !== 'DETERMINISTIC_ONLY') {
      return packSnapshot;
    }

    const checks = packSnapshot.checks
      .filter((check) => check.validatorBindings.length > 0)
      .map((check) => ({
        ...check,
        keywords: [...check.keywords],
        applicableContractTypes: [...check.applicableContractTypes],
        validatorBindings: [...check.validatorBindings],
      }));
    const groups = [...new Set(checks.map((check) => check.group))].map((group) => ({
      group,
      checkCodes: checks.filter((check) => check.group === group).map((check) => check.code),
    }));

    return {
      ...packSnapshot,
      checkCount: checks.length,
      groups,
      checks,
    };
  }

  private async buildAiReviewedIssues(
    taskId: string,
    documentSnapshot: ContractReviewDocumentSnapshot,
    packSnapshot: ContractReviewSkillPackSnapshot,
    factExtraction: ContractReviewFactExtractionResult,
    requirementsText: string,
    workflowText: string,
    promptSet: {
      planner: string;
      reviewer: string;
      summarizer: string;
    },
    now: string,
    reviewMode: 'FULL' | 'SUPPLEMENTAL' = 'FULL',
  ): Promise<ContractReviewIssueRecord[] | null> {
    const aiCandidates =
      reviewMode === 'SUPPLEMENTAL'
        ? await this.aiReviewService.reviewSupplementalChecks({
            documentSnapshot,
            packSnapshot,
            factExtraction,
            requirementsText,
            workflowText,
            promptSet,
          })
        : await this.aiReviewService.reviewDocument({
            documentSnapshot,
            packSnapshot,
            factExtraction,
            requirementsText,
            workflowText,
            promptSet,
          });
    if (aiCandidates === null) {
      return null;
    }

    const rules = this.mapSnapshotToRuleItems(packSnapshot);
    const ruleMap = new Map(rules.map((rule) => [rule.code, rule] as const));
    const seenRuleCodes = new Set<string>();

    return aiCandidates.flatMap((candidate) => {
      if (seenRuleCodes.has(candidate.ruleCode)) {
        return [];
      }

      seenRuleCodes.add(candidate.ruleCode);

      if (candidate.reviewType === 'SUPPLEMENTAL') {
        if (!candidate.title || !candidate.sourceClause) {
          return [];
        }

        return [
          {
            id: buildEntityId('contract_review_issue'),
            taskId,
            title: candidate.title,
            riskLevel: candidate.riskLevel,
            isVeto: candidate.isVeto,
            description: candidate.reason || candidate.analysis || 'AI 补充发现',
            suggestion: candidate.suggestion || '请结合公司审核要求补充修订。',
            quote: `${candidate.locator}：${candidate.quote}`,
            ruleCode: candidate.ruleCode,
            ruleTitle: candidate.title,
            sourceClause: candidate.sourceClause,
            createdAt: now,
          },
        ];
      }

      const rule = ruleMap.get(candidate.ruleCode);
      if (!rule) {
        return [];
      }

      return [
        {
          id: buildEntityId('contract_review_issue'),
          taskId,
          title: rule.title,
          riskLevel: candidate.riskLevel ?? rule.riskLevel,
          isVeto: candidate.isVeto ?? rule.isVeto,
          description: candidate.reason || candidate.analysis || rule.description,
          suggestion: candidate.suggestion || rule.suggestion,
          quote: `${candidate.locator}：${candidate.quote}`,
          ruleCode: rule.code,
          ruleTitle: rule.title,
          sourceClause: rule.sourceClause,
          createdAt: now,
        },
      ];
    });
  }

  private buildSupplementalAiSnapshot(
    activePack: ContractReviewSkillPack,
    factExtraction: ContractReviewFactExtractionResult,
  ): ContractReviewSkillPackSnapshot {
    const hybridSnapshot = this.snapshotCompilerService.compile(activePack, factExtraction, {
      executionModeOverride: 'AI_HYBRID',
    });
    const checks = hybridSnapshot.checks
      .filter((check) => check.validatorBindings.length === 0)
      .map((check) => ({
        ...check,
        keywords: [...check.keywords],
        applicableContractTypes: [...check.applicableContractTypes],
        validatorBindings: [...check.validatorBindings],
      }));
    const groups = [...new Set(checks.map((check) => check.group))].map((group) => ({
      group,
      checkCodes: checks.filter((check) => check.group === group).map((check) => check.code),
    }));

    return {
      ...hybridSnapshot,
      modelProfile: 'codex-low',
      checkCount: checks.length,
      groups,
      checks,
    };
  }

  private canStartSupplementalAiReview(
    supplementalSnapshot: ContractReviewSkillPackSnapshot,
  ): boolean {
    const aiReviewService = this.aiReviewService as unknown as {
      isReviewAvailable?: () => boolean;
      reviewSupplementalChecks?: (...args: unknown[]) => Promise<unknown>;
    };

    return Boolean(
      supplementalSnapshot.checkCount > 0 &&
        typeof aiReviewService.isReviewAvailable === 'function' &&
        aiReviewService.isReviewAvailable() &&
        typeof aiReviewService.reviewSupplementalChecks === 'function',
    );
  }

  private async processSupplementalAiReview(
    taskId: string,
    sourceBuffer: Buffer,
    activePack: ContractReviewSkillPack,
    ruleSet: ContractReviewRuleSetRecord,
    documentSnapshot: ContractReviewDocumentSnapshot,
    factExtraction: ContractReviewFactExtractionResult,
    primarySnapshot: ContractReviewSkillPackSnapshot,
    supplementalSnapshot: ContractReviewSkillPackSnapshot,
  ): Promise<void> {
    let task = this.repository.findTaskById(taskId);
    if (!task) {
      return;
    }

    task = this.repository.saveTask({
      ...task,
      supplementalReviewStatus: 'RUNNING',
      supplementalReviewMessage: `AI 正在补充审核 ${supplementalSnapshot.checkCount} 个规则未覆盖项。`,
      updatedAt: new Date().toISOString(),
    });

    const aiReviewedIssues = await this.buildAiReviewedIssues(
      taskId,
      documentSnapshot,
      supplementalSnapshot,
      factExtraction,
      activePack.requirements,
      activePack.workflow,
      activePack.prompts,
      new Date().toISOString(),
      'SUPPLEMENTAL',
    );

    if (aiReviewedIssues === null) {
      this.repository.saveTask({
        ...task,
        supplementalReviewStatus: 'FAILED',
        supplementalReviewMessage: 'AI 补充审核未完成，已保留当前规则快审结果。',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const allowedRuleCodes = new Set(supplementalSnapshot.checks.map((check) => check.code));
    const filteredAiIssues = aiReviewedIssues.filter((issue) => allowedRuleCodes.has(issue.ruleCode));
    const currentIssues = this.repository.listIssuesByTaskId(taskId);
    const executionSummary: ContractReviewReviewExecutionSummary = {
      mode: 'AI_HYBRID',
      aiIssueCount: filteredAiIssues.length,
      deterministicIssueCount: currentIssues.length,
    };
    const reviewBasis = this.buildReviewBasisFromSnapshot(
      supplementalSnapshot,
      executionSummary,
    );
    const mergedIssues = this.mergeIssuesForSupplementalReview(
      currentIssues,
      filteredAiIssues,
      reviewBasis,
    );
    const combinedSnapshot = this.combineSnapshotsForReport(
      primarySnapshot,
      supplementalSnapshot,
      reviewBasis.modelProfile,
      executionSummary.mode,
    );

    this.repository.replaceIssues(taskId, mergedIssues);

    const refreshedTask = this.repository.findTaskById(taskId) ?? task;
    const artifacts = this.prepareArtifactsForRegeneration(taskId, reviewBasis);
    await this.regenerateArtifacts(
      refreshedTask,
      ruleSet,
      mergedIssues,
      combinedSnapshot,
      factExtraction,
      executionSummary,
      sourceBuffer,
      artifacts,
    );

    const counters = this.countIssues(mergedIssues);
    const decision = this.resolveOverallDecision(mergedIssues);
    const failedArtifacts = artifacts.filter((artifact) => artifact.status === 'FAILED');

    this.repository.saveTask({
      ...refreshedTask,
      overallDecision: decision,
      latestStageMessage:
        filteredAiIssues.length > 0
          ? 'AI 补充审核已完成，风险结果已更新。'
          : failedArtifacts.length > 0
          ? `AI 补充审核已完成，当前未新增风险项，另有 ${failedArtifacts.length} 个产物生成失败。`
          : 'AI 补充审核已完成，当前未新增风险项。',
      latestResultSummary: this.buildLatestResultSummary(
        decision,
        counters,
        executionSummary,
      ),
      vetoCount: counters.vetoCount,
      highRiskCount: counters.highRiskCount,
      mediumRiskCount: counters.mediumRiskCount,
      lowRiskCount: counters.lowRiskCount,
      totalIssueCount: mergedIssues.length,
      reviewBasis,
      supplementalReviewStatus: 'COMPLETED',
      supplementalReviewMessage:
        filteredAiIssues.length > 0
          ? `AI 补充审核已完成，新增 ${filteredAiIssues.length} 条风险结果。`
          : 'AI 补充审核已完成，未新增风险项。',
      supplementalCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private mergeIssuesForSupplementalReview(
    currentIssues: ContractReviewIssueRecord[],
    supplementalIssues: ContractReviewIssueRecord[],
    reviewBasis: ContractReviewReviewBasisRecord,
  ): ContractReviewIssueRecord[] {
    const mergedIssueMap = new Map<string, ContractReviewIssueRecord>();

    for (const issue of currentIssues) {
      mergedIssueMap.set(issue.ruleCode, {
        ...issue,
        reviewBasis,
      });
    }

    for (const issue of supplementalIssues) {
      mergedIssueMap.set(issue.ruleCode, {
        ...issue,
        reviewBasis,
      });
    }

    return this.sortIssues([...mergedIssueMap.values()]);
  }

  private combineSnapshotsForReport(
    primarySnapshot: ContractReviewSkillPackSnapshot,
    supplementalSnapshot: ContractReviewSkillPackSnapshot,
    modelProfile: string,
    executionMode: ContractReviewExecutionMode,
  ): ContractReviewSkillPackSnapshot {
    const checkMap = new Map<string, ContractReviewSkillPackSnapshot['checks'][number]>();
    for (const check of [...primarySnapshot.checks, ...supplementalSnapshot.checks]) {
      if (!checkMap.has(check.code)) {
        checkMap.set(check.code, {
          ...check,
          keywords: [...check.keywords],
          applicableContractTypes: [...check.applicableContractTypes],
          validatorBindings: [...check.validatorBindings],
        });
      }
    }

    const groupMap = new Map<string, string[]>();
    for (const snapshot of [primarySnapshot, supplementalSnapshot]) {
      for (const group of snapshot.groups) {
        const currentCodes = groupMap.get(group.group) ?? [];
        for (const checkCode of group.checkCodes) {
          if (!currentCodes.includes(checkCode)) {
            currentCodes.push(checkCode);
          }
        }
        groupMap.set(group.group, currentCodes);
      }
    }

    return {
      ...primarySnapshot,
      compiledAt: new Date().toISOString(),
      executionMode,
      modelProfile,
      checkCount: checkMap.size,
      groups: [...groupMap.entries()].map(([group, checkCodes]) => ({
        group,
        checkCodes,
      })),
      checks: [...checkMap.values()],
    };
  }

  private prepareArtifactsForRegeneration(
    taskId: string,
    reviewBasis: ContractReviewReviewBasisRecord,
  ): ContractReviewArtifactRecord[] {
    const existingArtifacts = this.repository.listArtifactsByTaskId(taskId);
    const preparedArtifacts = this.initializeArtifacts(taskId, reviewBasis).map((artifact) => {
      const existingArtifact = existingArtifacts.find(
        (item) => item.artifactType === artifact.artifactType,
      );
      if (!existingArtifact) {
        return artifact;
      }

      return {
        ...existingArtifact,
        status: 'PENDING' as const,
        failureReason: undefined,
        reviewBasis,
        updatedAt: new Date().toISOString(),
      };
    });

    this.repository.replaceArtifacts(taskId, preparedArtifacts);
    return preparedArtifacts;
  }

  private async regenerateArtifacts(
    task: ContractReviewTaskRecord,
    ruleSet: ContractReviewRuleSetRecord,
    issues: ContractReviewIssueRecord[],
    packSnapshot: ContractReviewSkillPackSnapshot,
    factExtraction: ContractReviewFactExtractionResult,
    executionSummary: ContractReviewReviewExecutionSummary,
    sourceBuffer: Buffer,
    artifacts: ContractReviewArtifactRecord[],
  ): Promise<void> {
    const documentSnapshot = this.docxExtractorService.extract(sourceBuffer);

    await this.generateArtifact(
      task.id,
      artifacts,
      'REPORT',
      async () =>
        await this.fileStorageService.saveTextArtifact(
          task.id,
          'review-report.md',
          this.buildReviewReport(
            task,
            issues,
            documentSnapshot,
            packSnapshot,
            factExtraction,
            executionSummary,
          ),
        ),
    );
    await this.generateArtifact(
      task.id,
      artifacts,
      'STRUCTURED_RESULT',
      async () =>
        await this.fileStorageService.saveTextArtifact(
          task.id,
          'review-result.json',
          JSON.stringify(
            {
              taskId: task.id,
              contractName: task.originalFileName,
              ruleSet: { code: ruleSet.code, version: ruleSet.version },
              summary: documentSnapshot.summary,
              packSnapshot,
              factExtraction,
              execution: executionSummary,
              document: {
                title: documentSnapshot.title,
                paragraphCount: documentSnapshot.paragraphs.length,
                headingCount: documentSnapshot.headings.length,
                clauseCount: documentSnapshot.clauses.length,
              },
              issues: issues.map((issue) => ({
                issueId: issue.id,
                title: issue.title,
                riskLevel: issue.riskLevel,
                isVeto: issue.isVeto,
                quote: issue.quote,
                description: issue.description,
                suggestion: issue.suggestion,
                ruleCode: issue.ruleCode,
                sourceClause: issue.sourceClause,
              })),
            },
            null,
            2,
          ),
        ),
    );
    await this.generateArtifact(
      task.id,
      artifacts,
      'ANNOTATED_DOCX',
      async () => {
        const annotatedDocx = this.annotatedDocxService.buildAnnotatedDocx(
          sourceBuffer,
          issues,
        );
        return await this.fileStorageService.saveBinaryArtifact(
          task.id,
          'annotated-review.docx',
          annotatedDocx,
        );
      },
    );
  }

  private canViewAllTasks(user: CrmUser): boolean {
    return this.accessDecisionService.hasAction(user, 'contract.review.cross_view');
  }

  private canAccessTaskDetail(user: CrmUser, task: ContractReviewTaskRecord): boolean {
    if (task.requesterId === user.id) {
      return this.accessDecisionService.hasVisibleMenu(user, 'contract-review');
    }

    return this.canViewAllTasks(user);
  }

  private canDownloadTask(user: CrmUser, task: ContractReviewTaskRecord): boolean {
    return (
      (task.requesterId === user.id &&
        this.accessDecisionService.hasVisibleMenu(user, 'contract-review')) ||
      this.accessDecisionService.hasAction(user, 'contract.review.cross_download')
    );
  }

  /**
   * 合同审核工作台与本人任务详情的基础访问资格由合同审核菜单承担，避免只有前端隐藏而后端仍可直接访问。
   */
  private ensureContractWorkspaceAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureVisibleMenu(
      user,
      'contract-review',
      '当前用户无权访问合同审核工作台。',
      {
        channel: 'web-console',
        resourceType: 'contract-review-workspace',
      },
    );
  }

  private initializeArtifacts(
    taskId: string,
    reviewBasis: ContractReviewReviewBasisRecord,
  ): ContractReviewArtifactRecord[] {
    const now = new Date().toISOString();
    return [
      {
        id: buildEntityId('contract_review_artifact'),
        taskId,
        artifactType: 'REPORT',
        fileName: '审核报告.md',
        mimeType: 'text/markdown',
        status: 'PENDING',
        reviewBasis,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: buildEntityId('contract_review_artifact'),
        taskId,
        artifactType: 'STRUCTURED_RESULT',
        fileName: '结构化审核结果.json',
        mimeType: 'application/json',
        status: 'PENDING',
        reviewBasis,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: buildEntityId('contract_review_artifact'),
        taskId,
        artifactType: 'ANNOTATED_DOCX',
        fileName: '带批注合同.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        status: 'PENDING',
        reviewBasis,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  private appendAiDebugArtifact(
    artifacts: ContractReviewArtifactRecord[],
    taskId: string,
    reviewBasis: ContractReviewReviewBasisRecord,
    aiDebugContext?: unknown,
  ): ContractReviewArtifactRecord[] {
    if (!aiDebugContext) {
      return artifacts;
    }

    return [
      ...artifacts,
      {
        id: buildEntityId('contract_review_artifact'),
        taskId,
        artifactType: 'AI_DEBUG_CONTEXT',
        fileName: 'AI调试上下文.json',
        mimeType: 'application/json',
        status: 'PENDING',
        reviewBasis,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  private buildAiDebugArtifactContent(aiDebugContext?: unknown): string {
    return JSON.stringify(
      aiDebugContext ?? { status: 'UNAVAILABLE', message: '当前任务未记录 AI 调试上下文。' },
      null,
      2,
    );
  }

  private async generateArtifact(
    taskId: string,
    artifacts: ContractReviewArtifactRecord[],
    artifactType: ContractReviewArtifactRecord['artifactType'],
    generator: () => Promise<string>,
  ): Promise<void> {
    const artifact = artifacts.find((item) => item.artifactType === artifactType);
    if (!artifact) {
      return;
    }

    try {
      const filePath = await generator();
      artifact.filePath = filePath;
      artifact.status = 'AVAILABLE';
      artifact.failureReason = undefined;
      artifact.updatedAt = new Date().toISOString();
    } catch (error) {
      artifact.status = 'FAILED';
      artifact.failureReason =
        error instanceof Error ? error.message : '当前产物生成失败，请稍后重试。';
      artifact.updatedAt = new Date().toISOString();
    }

    this.repository.replaceArtifacts(taskId, artifacts);
  }

  private resolveOverallDecision(issues: ContractReviewIssueRecord[]): ContractReviewDecision {
    if (issues.some((issue) => issue.isVeto)) {
      return 'REJECT';
    }

    if (issues.some((issue) => issue.riskLevel === 'HIGH')) {
      return 'REVISE';
    }

    return 'APPROVE';
  }

  private countIssues(issues: ContractReviewIssueRecord[]): {
    vetoCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
  } {
    return issues.reduce(
      (accumulator, issue) => {
        if (issue.isVeto) {
          accumulator.vetoCount += 1;
        }

        if (issue.riskLevel === 'HIGH') {
          if (!issue.isVeto) {
            accumulator.highRiskCount += 1;
          }
        } else if (issue.riskLevel === 'MEDIUM') {
          accumulator.mediumRiskCount += 1;
        } else {
          accumulator.lowRiskCount += 1;
        }

        return accumulator;
      },
      {
        vetoCount: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
      },
    );
  }

  private buildLatestResultSummary(
    decision: ContractReviewDecision,
    counters: {
      vetoCount: number;
      highRiskCount: number;
      mediumRiskCount: number;
      lowRiskCount: number;
    },
    executionSummary?: ContractReviewReviewExecutionSummary,
  ): string {
    const summaryPrefix =
      executionSummary?.mode === 'DETERMINISTIC_ONLY'
        ? executionSummary.degradationReason
          ? '降级快审 · '
          : '规则快审 · '
        : '';

    if (decision === 'REJECT') {
      const summaryParts = ['建议修改后再签署', `一票否决 ${counters.vetoCount} 项`];
      if (counters.highRiskCount > 0) {
        summaryParts.push(`高风险 ${counters.highRiskCount} 项`);
      }
      if (counters.mediumRiskCount > 0) {
        summaryParts.push(`中风险 ${counters.mediumRiskCount} 项`);
      }
      return `${summaryPrefix}${summaryParts.join(' · ')}`;
    }

    if (decision === 'REVISE') {
      const summaryParts = ['建议修改后再签署'];
      if (counters.highRiskCount > 0) {
        summaryParts.push(`高风险 ${counters.highRiskCount} 项`);
      }
      if (counters.mediumRiskCount > 0) {
        summaryParts.push(`中风险 ${counters.mediumRiskCount} 项`);
      }
      if (summaryParts.length === 1) {
        summaryParts.push(`低风险 ${counters.lowRiskCount} 项`);
      }
      return `${summaryPrefix}${summaryParts.join(' · ')}`;
    }

    return `${summaryPrefix}可直接签署 · 低风险 ${counters.lowRiskCount} 项`;
  }

  private buildReviewReport(
    task: ContractReviewTaskRecord,
    issues: ContractReviewIssueRecord[],
    documentSnapshot: ContractReviewDocumentSnapshot,
    packSnapshot: ContractReviewSkillPackSnapshot,
    factExtraction: ContractReviewFactExtractionResult,
    executionSummary: ContractReviewReviewExecutionSummary,
  ): string {
    const reviewModeLabel =
      executionSummary.mode === 'DETERMINISTIC_ONLY'
        ? executionSummary.degradationReason
          ? 'DETERMINISTIC_ONLY（降级快审）'
          : 'DETERMINISTIC_ONLY（规则快审）'
        : 'AI_HYBRID（AI 规则提示词审核）';
    const lines = [
      '# 合同审核报告',
      '',
      `- 合同名称：${this.normalizePotentialMojibakeText(task.originalFileName)}`,
      `- 识别标题：${documentSnapshot.title}`,
      `- 审核任务：${task.id}`,
      `- 审核时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
      `- 审核摘要：${documentSnapshot.summary}`,
      `- 审核标准：${packSnapshot.packTitle} ${packSnapshot.packVersion}`,
      `- 审核模式：${reviewModeLabel}`,
      `- 审核快照：${packSnapshot.checkCount} 个检查项 / ${packSnapshot.groups.length} 个主题组`,
      `- 事实提取：${factExtraction.summary}`,
      '',
      '## 问题清单',
      '',
    ];

    if (executionSummary.degradationReason) {
      lines.splice(9, 0, `- 降级说明：${executionSummary.degradationReason}`);
    } else if (executionSummary.mode === 'DETERMINISTIC_ONLY') {
      lines.splice(9, 0, '- 执行说明：规则快审模式，仅覆盖已配置的明确判定项。');
    }

    for (const issue of issues) {
      lines.push(`### ${issue.title}`);
      lines.push(`- 风险等级：${issue.isVeto ? '一票否决 / 高风险' : issue.riskLevel}`);
      lines.push(`- 原文片段：${issue.quote}`);
      lines.push(`- 问题说明：${issue.description}`);
      lines.push(`- 修改建议：${issue.suggestion}`);
      lines.push(`- 依据：${issue.sourceClause}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private sortIssues(issues: ContractReviewIssueRecord[]): ContractReviewIssueRecord[] {
    const riskOrder: Record<RiskLevel, number> = {
      HIGH: 0,
      MEDIUM: 1,
      LOW: 2,
    };

    return [...issues].sort((left, right) => {
      if (left.isVeto !== right.isVeto) {
        return left.isVeto ? -1 : 1;
      }

      return riskOrder[left.riskLevel] - riskOrder[right.riskLevel];
    });
  }

  private mapTaskSummary(
    task: ContractReviewTaskRecord,
    issues: ContractReviewIssueRecord[],
  ): ContractReviewTaskSummaryView {
    const counters = this.resolveIssueCounters(task, issues);
    return {
      taskId: task.id,
      contractName: this.normalizePotentialMojibakeText(task.originalFileName),
      sourceType: task.sourceType,
      status: task.status,
      overallDecision: task.overallDecision,
      reviewBasis: this.resolveTaskReviewBasis(task),
      latestResultSummary: this.resolveTaskSummary(task, issues),
      vetoCount: counters.vetoCount,
      highRiskCount: counters.highRiskCount,
      mediumRiskCount: counters.mediumRiskCount,
      lowRiskCount: counters.lowRiskCount,
      supplementalReviewStatus: task.supplementalReviewStatus,
      supplementalReviewMessage: task.supplementalReviewMessage,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    };
  }

  private mapIssue(issue: ContractReviewIssueRecord): ContractReviewIssueView {
    return {
      issueId: issue.id,
      title: issue.title,
      riskLevel: issue.riskLevel,
      isVeto: issue.isVeto,
      description: issue.description,
      suggestion: issue.suggestion,
      quote: issue.quote,
      ruleCode: issue.ruleCode,
      ruleTitle: issue.ruleTitle,
      sourceClause: issue.sourceClause,
    };
  }

  private mapArtifact(
    task: ContractReviewTaskRecord,
    artifact: ContractReviewArtifactRecord,
  ): ContractReviewArtifactView {
    return {
      artifactId: artifact.id,
      artifactType: artifact.artifactType,
      fileName: artifact.fileName,
      status: artifact.status,
      failureReason: artifact.failureReason,
      reviewBasis: this.resolveArtifactReviewBasis(task, artifact),
    };
  }

  private mapSnapshotToRuleItems(
    packSnapshot: ContractReviewSkillPackSnapshot,
  ): ContractReviewRuleItem[] {
    return packSnapshot.checks.map((check) => ({
      code: check.code,
      category: check.category,
      title: check.title,
      description: check.description,
      riskLevel: check.riskLevel,
      isVeto: check.isVeto,
      sourceClause: check.sourceClause,
      keywords: [...check.keywords],
      suggestion: check.suggestion,
    }));
  }

  private buildReviewBasisFromActivePack(
    activePack: ContractReviewSkillPack,
  ): ContractReviewReviewBasisRecord {
    return this.normalizeReviewBasis({
      packCode: activePack.code,
      packVersion: activePack.version,
      packChecksum: activePack.checksum,
      packChecksumSummary: activePack.checksumSummary,
      modelProfile: activePack.defaultModelProfile,
      executionMode: activePack.defaultExecutionMode,
    });
  }

  private buildReviewBasisFromSnapshot(
    packSnapshot: ContractReviewSkillPackSnapshot,
    executionSummary?: ContractReviewReviewExecutionSummary,
  ): ContractReviewReviewBasisRecord {
    return this.normalizeReviewBasis({
      packCode: packSnapshot.packCode,
      packVersion: packSnapshot.packVersion,
      packChecksum: packSnapshot.packChecksum,
      packChecksumSummary: packSnapshot.packChecksumSummary,
      modelProfile: packSnapshot.modelProfile,
      executionMode:
        (executionSummary?.mode ?? packSnapshot.executionMode) as ContractReviewExecutionMode,
      degradationReason: executionSummary?.degradationReason,
      promptFingerprints: { ...packSnapshot.promptFingerprints },
    });
  }

  private buildBlockedReviewBasis(
    reviewBasis: ContractReviewReviewBasisRecord,
    degradationReason: string,
  ): ContractReviewReviewBasisRecord {
    return this.normalizeReviewBasis({
      ...reviewBasis,
      executionMode: 'BLOCKED',
      degradationReason,
    });
  }

  private resolveTaskReviewBasis(
    task: ContractReviewTaskRecord,
  ): ContractReviewReviewBasisRecord {
    if (task.reviewBasis) {
      return this.normalizeReviewBasis(task.reviewBasis);
    }

    const activePack = this.skillPackRuntimeService.getActivePack();
    const isCurrentPack =
      activePack.code === task.ruleSetCode && activePack.version === task.ruleSetVersion;

    return this.normalizeReviewBasis({
      packCode: task.ruleSetCode,
      packVersion: task.ruleSetVersion,
      packChecksum: isCurrentPack ? activePack.checksum : 'legacy',
      packChecksumSummary: isCurrentPack ? activePack.checksumSummary : 'legacy',
      modelProfile: isCurrentPack ? activePack.defaultModelProfile : 'unknown',
      executionMode: this.resolveLegacyExecutionMode(task),
    });
  }

  private resolveArtifactReviewBasis(
    task: ContractReviewTaskRecord,
    artifact: ContractReviewArtifactRecord,
  ): ContractReviewReviewBasisRecord {
    return this.normalizeReviewBasis(artifact.reviewBasis ?? this.resolveTaskReviewBasis(task));
  }

  private normalizeReviewBasis(
    reviewBasis: ContractReviewReviewBasisRecord,
  ): ContractReviewReviewBasisRecord {
    if (reviewBasis.executionMode === 'AI_HYBRID') {
      return {
        ...reviewBasis,
        degradationReason: undefined,
      };
    }

    return reviewBasis;
  }

  private resolveLegacyExecutionMode(
    task: ContractReviewTaskRecord,
  ): ContractReviewExecutionMode {
    if (task.status === 'BLOCKED' || task.status === 'FAILED') {
      return 'BLOCKED';
    }

    if (
      task.latestResultSummary.includes('仅供初筛') ||
      task.latestResultSummary.includes('规则快审') ||
      task.latestResultSummary.includes('降级快审')
    ) {
      return 'DETERMINISTIC_ONLY';
    }

    return 'AI_HYBRID';
  }

  private recordAuditEvent(
    user: CrmUser,
    eventType: AuditEventRecord['eventType'],
    task: ContractReviewTaskRecord,
    riskLevel: RiskLevel,
    outcome: string,
    failureReason?: string,
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType,
      actorId: user.id,
      actorRoleIds: user.roleIds,
      relatedRequestId: task.id,
      originalQuestion: this.normalizePotentialMojibakeText(task.originalFileName),
      scopeSnapshot: this.userScopeService.resolveScope(user),
      riskLevel,
      reviewStatus: riskLevel === 'HIGH' ? 'PENDING' : 'CONFIRMED',
      outcome,
      failureReason,
      contractReviewReviewBasis: this.resolveTaskReviewBasis(task),
      createdAt: new Date().toISOString(),
    });
  }

  private resolveIssueCounters(
    task: ContractReviewTaskRecord,
    issues: ContractReviewIssueRecord[],
  ): {
    vetoCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
  } {
    if (issues.length === 0) {
      return {
        vetoCount: task.vetoCount,
        highRiskCount: task.highRiskCount,
        mediumRiskCount: task.mediumRiskCount,
        lowRiskCount: task.lowRiskCount,
      };
    }

    return this.countIssues(issues);
  }

  private resolveTaskSummary(
    task: ContractReviewTaskRecord,
    issues: ContractReviewIssueRecord[],
  ): string {
    if (issues.length === 0) {
      return task.latestResultSummary;
    }

    return this.buildLatestResultSummary(
      this.resolveOverallDecision(issues),
      this.resolveIssueCounters(task, issues),
      this.buildExecutionSummaryFromReviewBasis(task.reviewBasis),
    );
  }

  private buildExecutionSummaryFromReviewBasis(
    reviewBasis?: ContractReviewReviewBasisRecord,
  ): ContractReviewReviewExecutionSummary | undefined {
    if (!reviewBasis || reviewBasis.executionMode === 'BLOCKED') {
      return undefined;
    }

    return {
      mode: reviewBasis.executionMode,
      degradationReason: reviewBasis.degradationReason,
      aiIssueCount: 0,
      deterministicIssueCount: 0,
    };
  }

  private normalizePotentialMojibakeText(value: string): string {
    if (!value || /[\u4e00-\u9fff]/.test(value) || !/[À-ÿ]/.test(value)) {
      return value;
    }

    const decodedValue = Buffer.from(value, 'latin1').toString('utf8');
    if (!decodedValue || decodedValue.includes('\u0000')) {
      return value;
    }

    const sourceChineseCount = (value.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const decodedChineseCount = (decodedValue.match(/[\u4e00-\u9fff]/g) ?? []).length;
    if (decodedChineseCount <= sourceChineseCount) {
      return value;
    }

    return decodedValue;
  }

  private mergeReviewIssues(
    taskId: string,
    rules: ContractReviewRuleItem[],
    aiReviewedIssues: ContractReviewIssueRecord[] | null,
    deterministicCandidates: ContractReviewDeterministicIssueCandidate[],
    aiFailureReason: string | undefined,
    now: string,
    fileName: string,
  ): {
    issues: ContractReviewIssueRecord[];
    executionSummary: ContractReviewReviewExecutionSummary;
  } {
    if (aiReviewedIssues !== null) {
      return {
        issues: aiReviewedIssues,
        executionSummary: {
          mode: 'AI_HYBRID',
          aiIssueCount: aiReviewedIssues.length,
          deterministicIssueCount: 0,
        },
      };
    }

    const issueMap = new Map<string, ContractReviewIssueRecord>();
    for (const deterministicCandidate of deterministicCandidates) {
      if (issueMap.has(deterministicCandidate.ruleCode)) {
        continue;
      }

      const rule = rules.find((item) => item.code === deterministicCandidate.ruleCode);
      if (!rule) {
        continue;
      }

      issueMap.set(deterministicCandidate.ruleCode, {
        id: buildEntityId('contract_review_issue'),
        taskId,
        title: rule.title,
        riskLevel: deterministicCandidate.riskLevel,
        isVeto: deterministicCandidate.isVeto,
        description: `命中确定性校验：${deterministicCandidate.reason}`,
        suggestion: deterministicCandidate.suggestion || rule.suggestion,
        quote: `${deterministicCandidate.locator}：${deterministicCandidate.quote}`,
        ruleCode: rule.code,
        ruleTitle: rule.title,
        sourceClause: rule.sourceClause,
        createdAt: now,
      });
    }

    const issues = [...issueMap.values()];
    return {
      issues,
      executionSummary: {
        mode: 'DETERMINISTIC_ONLY',
        degradationReason:
          deterministicCandidates.length > 0
            ? 'AI 审核不可用，当前结果已降级为规则兜底初筛，仅供人工复核。'
            : `AI 审核不可用，当前未命中规则兜底风险项，结果仅供初筛（合同：${fileName}）。`,
        ...(aiFailureReason
          ? {
              degradationReason: this.buildAiUnavailableDegradationReason(
                fileName,
                deterministicCandidates.length,
                aiFailureReason,
              ),
            }
          : {}),
        aiIssueCount: 0,
        deterministicIssueCount: deterministicCandidates.length,
      },
    };
  }

  private buildAiUnavailableDegradationReason(
    fileName: string,
    deterministicIssueCount: number,
    aiFailureReason?: string,
  ): string {
    const baseReason =
      deterministicIssueCount > 0
        ? 'AI 审核不可用，当前结果已降级为规则兜底初筛，仅供人工复核。'
        : `AI 审核不可用，当前未命中规则兜底风险项，结果仅供初筛（合同：${fileName}）。`;

    return aiFailureReason ? `${baseReason} 失败原因：${aiFailureReason}` : baseReason;
  }

  private buildDeterministicOnlyReviewIssues(
    taskId: string,
    rules: ContractReviewRuleItem[],
    deterministicCandidates: ContractReviewDeterministicIssueCandidate[],
    now: string,
  ): {
    issues: ContractReviewIssueRecord[];
    executionSummary: ContractReviewReviewExecutionSummary;
  } {
    const ruleMap = new Map(rules.map((rule) => [rule.code, rule] as const));
    const issues = deterministicCandidates.flatMap((candidate) => {
      const rule = ruleMap.get(candidate.ruleCode);
      if (!rule) {
        return [];
      }

      return [
        {
          id: buildEntityId('contract_review_issue'),
          taskId,
          title: rule.title,
          riskLevel: candidate.riskLevel,
          isVeto: candidate.isVeto,
          description: `命中确定性校验：${candidate.reason}`,
          suggestion: candidate.suggestion || rule.suggestion,
          quote: `${candidate.locator}：${candidate.quote}`,
          ruleCode: rule.code,
          ruleTitle: rule.title,
          sourceClause: rule.sourceClause,
          createdAt: now,
        },
      ];
    });

    return {
      issues,
      executionSummary: {
        mode: 'DETERMINISTIC_ONLY',
        aiIssueCount: 0,
        deterministicIssueCount: deterministicCandidates.length,
      },
    };
  }

  private buildDegradedCompletionMessage(
    failedArtifactCount: number,
    degradationReason?: string,
  ): string {
    const baseMessage =
      degradationReason ?? '审核完成，已输出规则快审结果，仅覆盖可明确判定项。';
    if (failedArtifactCount > 0) {
      return `${baseMessage} 另有 ${failedArtifactCount} 个产物生成失败。`;
    }

    return baseMessage;
  }

  /**
   * 预留合同审核后续自然语言交互的统一入口能力说明。
   *
   * 当前合同审核仅开放“上传 -> 固定安全前置检查 -> AI 规则提示词审核 -> 结果查看”，
   * 后续如果增加解释追问或补充说明，必须先经过统一 AI 理解层，再进入固定程序。
   */
  private buildNaturalLanguageEntryCapability() {
    return {
      status: 'RESERVED' as const,
      aiEntryRequired: true as const,
      targetWorkflow: 'CONTRACT_REVIEW_NATURAL_LANGUAGE_ROUTER' as const,
      fixedPrecheckSteps: ['文件类型校验', '文件大小校验', '任务创建', '权限校验'],
    };
  }
}
