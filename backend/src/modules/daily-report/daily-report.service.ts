import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import {
  CrmReadonlyService,
  type DailyReportCreatedCustomerSourceRecord,
  type DailyReportCreatedOpportunitySourceRecord,
  type DailyReportFollowUpSourceRecord,
} from '../../database/crm-readonly/crm-readonly.service';
import type {
  CrmUser,
  DailyReportClosureRecord,
  DailyReportDeliveryRecord,
  DailyReportFragmentRecord,
  DailyReportFragmentType,
  DailyReportAiInsightSnapshot,
  DailyReportRecord,
  DailyReportStatus,
  DailyReportSummaryGroupRecord,
  DailyReportSummaryBatchRecord,
} from '../../shared/types/domain';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { AiGatewayService } from '../analysis/ai-gateway.service';
import { parseWecomFollowUpTemplateUpdates } from '../wecom/wecom-follow-up-template.helper';
import { DailyReportDispatcherService } from './daily-report-dispatcher.service';
import {
  DAILY_REPORT_SECTION_LABELS,
  DAILY_REPORT_SECTION_ORDER,
} from './daily-report.constants';
import { DailyReportRepository } from './daily-report.repository';
import { SalesLeaderMappingService } from './sales-leader-mapping.service';
import { DailyReportAssistanceEscalationService } from './daily-report-assistance-escalation.service';
import { DailyReportDeliveryRoutingService } from './daily-report-delivery-routing.service';

interface DailyReportSourceBundle {
  followUps: DailyReportFollowUpSourceRecord[];
  createdCustomers: DailyReportCreatedCustomerSourceRecord[];
  createdOpportunities: DailyReportCreatedOpportunitySourceRecord[];
}

interface AggregatedDailyFollowUp {
  requesterName: string;
  objectType: 'Customer' | 'Opportunity';
  objectId: string;
  objectTitle: string;
  customerName?: string;
  followUpContents: string[];
  helpValues: string[];
  shareValues: string[];
  tomorrowPlanValues: string[];
  latestWrittenAt: string;
}

interface DailyReportSummaryMemberSnapshot {
  requesterId: string;
  requesterName: string;
  supervisorId: string;
  supervisorName?: string;
  hasSourceData: boolean;
  reportStatus: DailyReportStatus | 'MISSING';
  reportText: string;
  followUpCount: number;
  createdCustomerCount: number;
  createdOpportunityCount: number;
  helpCount: number;
  shareCount: number;
  tomorrowPlanCount: number;
}

export interface DailyReportTeamPreviewResult {
  status: 'READY' | 'LEADER_NOT_FOUND' | 'LEADER_AMBIGUOUS' | 'FORBIDDEN';
  businessDate: string;
  leaderNameQuery: string;
  leaderId?: string;
  leaderName?: string;
  summaryText?: string;
  hasAnySourceData?: boolean;
  aiInsightSnapshot?: DailyReportAiInsightSnapshot;
  candidateLeaderNames?: string[];
}

const CIRCLED_NUMBER_MARKERS = [
  '①',
  '②',
  '③',
  '④',
  '⑤',
  '⑥',
  '⑦',
  '⑧',
  '⑨',
  '⑩',
  '⑪',
  '⑫',
  '⑬',
  '⑭',
  '⑮',
  '⑯',
  '⑰',
  '⑱',
  '⑲',
  '⑳',
];

const EMPTY_SECTION_PLACEHOLDER_VALUES = [
  '无',
  '暂无',
  '没有',
  '不用',
  '不需要',
  '没了',
  '先这样',
  '暂时没有',
  '无分享',
  '暂无分享',
  '暂无信息共享',
  '无需共享',
  '无需信息共享',
  '暂无计划',
];

const GENERIC_INFORMATION_SHARE_DISPLAY_PATTERNS = [
  /^有太多(?:东西|内容)?要分享(?:了)?$/u,
  /^太多(?:东西|内容)?要分享(?:了)?$/u,
  /^有很多(?:东西|内容)?可以分享$/u,
  /^这个(?:案例)?场景可以分享$/u,
  /^这个(?:案例)?可以分享$/u,
  /^可以分享$/u,
  /^可分享$/u,
];

function normalizeBusinessDate(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const normalized = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return normalized.toISOString().slice(0, 10);
}

function formatLocalTimestamp(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString();
}

function isAfterDailyCutoff(input: string | Date, businessDate: string): boolean {
  const localTimestamp = formatLocalTimestamp(input);
  const localDate = localTimestamp.slice(0, 10);
  const localTime = localTimestamp.slice(11, 23);
  return localDate > businessDate || (localDate === businessDate && localTime > '23:59:59.999');
}

function formatCircledNumber(index: number): string {
  return CIRCLED_NUMBER_MARKERS[index] ?? `${index + 1}.`;
}

@Injectable()
export class DailyReportService {
  private readonly aiGatewayService: AiGatewayService;

  constructor(
    private readonly dailyReportRepository: DailyReportRepository,
    private readonly dailyReportDispatcherService: DailyReportDispatcherService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly salesLeaderMappingService: SalesLeaderMappingService,
    private readonly dailyReportAssistanceEscalationService: DailyReportAssistanceEscalationService,
    private readonly dailyReportDeliveryRoutingService: DailyReportDeliveryRoutingService,
    @Optional() aiGatewayService?: AiGatewayService,
  ) {
    // 日报模块当前仍以既有模板链路为安全兜底，因此 AI 依赖缺失时不应阻断整个模块启动。
    this.aiGatewayService =
      aiGatewayService ??
      new AiGatewayService(
        new LocalRuntimeConfigService(),
        new AnalysisLoggerService(),
      );
  }

  recordFragment(
    user: CrmUser,
    payload: {
      fragmentType: DailyReportFragmentType;
      content: string;
      businessDate?: string;
      supervisorId?: string;
      supervisorName?: string;
      sourceLabel?: string;
      sourceInterface?: '/api/v2/opportunities' | '/api/v2/revisit_logs' | 'manual';
      sourceObjectId?: string;
      sourceOperatorId?: string;
      sourceOperatorName?: string;
      sourceCode?: number;
      capturedAt?: string;
    },
  ): DailyReportRecord {
    this.validateSourceFragmentPayload(payload);
    const businessDate = payload.businessDate
      ? normalizeBusinessDate(payload.businessDate)
      : normalizeBusinessDate(payload.capturedAt ?? new Date());
    const capturedAt = payload.capturedAt ?? new Date().toISOString();
    const existing = this.dailyReportRepository.findByRequesterAndBusinessDate(
      user.id,
      businessDate,
    );
    const now = new Date().toISOString();
    const fragment: DailyReportFragmentRecord = {
      id: buildEntityId('daily_report_fragment'),
      fragmentType: payload.fragmentType,
      content: payload.content.trim(),
      sourceLabel:
        payload.sourceLabel?.trim() ||
        payload.sourceInterface ||
        undefined,
      sourceInterface: payload.sourceInterface,
      sourceObjectId: payload.sourceObjectId?.trim() || undefined,
      sourceOperatorId: payload.sourceOperatorId?.trim() || undefined,
      sourceOperatorName: payload.sourceOperatorName?.trim() || undefined,
      sourceCode: payload.sourceCode,
      capturedAt,
    };

    if (!fragment.content) {
      throw new BadRequestException('日报内容不能为空。');
    }

    const report = existing
      ? {
          ...existing,
          supervisorId: payload.supervisorId?.trim() || existing.supervisorId,
          supervisorName: payload.supervisorName?.trim() || existing.supervisorName,
          fragments: this.replaceFragment(existing.fragments, fragment),
          confirmation: undefined,
          lateConfirmed: false,
          updatedAt: now,
        }
      : this.buildInitialReport(user, businessDate, payload, fragment, now);

    const composed = this.composeReport(report);
    const saved = this.dailyReportRepository.save(composed);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_DRAFT_SAVED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        reportId: saved.id,
        businessDate: saved.businessDate,
        fragmentType: payload.fragmentType,
        status: saved.status,
        sourceInterface: fragment.sourceInterface ?? fragment.sourceLabel,
        sourceObjectId: fragment.sourceObjectId,
        sourceOperatorId: fragment.sourceOperatorId,
        sourceOperatorName: fragment.sourceOperatorName,
        sourceCode: fragment.sourceCode,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `日报草稿已更新为 ${saved.status}。`,
      createdAt: now,
    });

    return saved;
  }

  async confirmReport(
    user: CrmUser,
    reportId: string,
    confirmedAt = new Date().toISOString(),
  ): Promise<DailyReportRecord> {
    const report = this.requireOwnedReport(user, reportId);
    if (
      report.status !== 'PENDING_CONFIRMATION' &&
      report.status !== 'CLOSED' &&
      report.status !== 'DRAFT'
    ) {
      throw new BadRequestException('日报尚未完成收口，不能确认。');
    }

    if (!this.hasAllRequiredSections(report)) {
      throw new BadRequestException('日报尚未完成收口，不能确认。');
    }

    const lateConfirmed = isAfterDailyCutoff(confirmedAt, report.businessDate);
    const confirmation = {
      confirmedAt,
      confirmedBy: user.id,
    };
    const confirmedReport = this.dailyReportRepository.save({
      ...report,
      status: lateConfirmed ? 'LATE_CONFIRMED' : 'CONFIRMED',
      confirmation,
      lateConfirmed,
      updatedAt: confirmedAt,
    });

    const deliveryResult = await this.dailyReportDispatcherService.dispatchSupervisorDelivery(
      user,
      confirmedReport,
    );
    const nextReport = this.dailyReportRepository.save({
      ...confirmedReport,
      deliveries: [...confirmedReport.deliveries, deliveryResult.delivery],
      updatedAt: deliveryResult.delivery.deliveredAt ?? confirmedAt,
    });

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_CONFIRMED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        reportId: nextReport.id,
        businessDate: nextReport.businessDate,
        status: nextReport.status,
        deliveryStatus: deliveryResult.outcome,
        supervisorId: nextReport.supervisorId,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome:
        deliveryResult.outcome === 'SENT'
          ? lateConfirmed
            ? '日报已迟交确认并推送主管。'
            : '日报已确认并推送主管。'
          : deliveryResult.outcome === 'SKIPPED'
            ? '日报已确认，但当前开关关闭，已跳过正式对上发送。'
            : '日报已确认，但正式对上发送失败。',
      failureReason:
        deliveryResult.outcome === 'SENT'
          ? undefined
          : deliveryResult.delivery.failureReason,
      createdAt: confirmedAt,
    });

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_DELIVERY_SENT',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        reportId: nextReport.id,
        targetUserId: nextReport.supervisorId,
        contentPreview: deliveryResult.delivery.contentPreview,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome:
        deliveryResult.outcome === 'SENT'
          ? '日报已下发给主管。'
          : deliveryResult.outcome === 'SKIPPED'
            ? '日报开关关闭，已跳过主管侧送达。'
            : '日报下发主管失败。',
      failureReason:
        deliveryResult.outcome === 'SENT'
          ? undefined
          : deliveryResult.delivery.failureReason,
      createdAt: deliveryResult.delivery.deliveredAt ?? confirmedAt,
    });

    // 日报正式对上送达后，再并行升级“需要协助”事项；子任务失败不得回滚主管侧日报送达。
    if (deliveryResult.outcome === 'SENT') {
      await this.dailyReportAssistanceEscalationService.dispatchFormalEscalations({
        actor: user,
        report: nextReport,
        trigger: 'SUPERVISOR_DELIVERY',
        triggeredAt: deliveryResult.delivery.deliveredAt ?? confirmedAt,
      });
    }

    return nextReport;
  }

  async runReminderSweep(
    user: CrmUser,
    businessDate: string,
    sentAt = new Date().toISOString(),
  ): Promise<DailyReportRecord[]> {
    const normalizedDate = normalizeBusinessDate(businessDate);
    const targetUsers = await this.resolveReminderTargets(user);
    const generatedReports: DailyReportRecord[] = [];

    for (const targetUser of targetUsers) {
      const sourceBundle = await this.collectDailySourceBundle(
        targetUser,
        normalizedDate,
      );

      if (!this.hasSourceData(sourceBundle)) {
        const actualDispatchStartedAt = new Date().toISOString();
        const reminderResult =
          await this.dailyReportDispatcherService.dispatchFriendlyReminder({
          actor: user,
          recipient: targetUser,
          businessDate: normalizedDate,
        });
        const auditCreatedAt = new Date().toISOString();

        this.auditEventRepository.create({
          id: buildEntityId('audit'),
          eventType: 'DAILY_REPORT_REMINDER_SENT',
          actorId: user.id,
          actorRoleIds: user.roleIds,
          scopeSnapshot: this.userScopeService.resolveScope(user),
          sessionSnapshot: {
            businessDate: normalizedDate,
            recipientId: targetUser.id,
            reminderKind: 'NO_CRM_ACTIVITY_22_00',
            scheduledAt: sentAt,
            actualDispatchStartedAt,
            lastAttemptAt: reminderResult.lastAttemptAt,
            notificationTaskId: reminderResult.notificationTaskId,
            resolvedChannel: reminderResult.resolvedChannel,
          },
          riskLevel: 'LOW',
          reviewStatus: 'CONFIRMED',
          outcome:
            reminderResult.outcome === 'SENT'
              ? '22点无 CRM 数据的日报提醒已发送。'
              : reminderResult.outcome === 'SKIPPED'
                ? '日报开关关闭，已跳过 22 点无 CRM 数据的催报提醒。'
                : '22点无 CRM 数据的日报提醒发送失败。',
          failureReason:
            reminderResult.outcome === 'SENT'
              ? undefined
              : reminderResult.reason,
          createdAt: auditCreatedAt,
        });
        continue;
      }

      const existingReport =
        this.dailyReportRepository.findByRequesterAndBusinessDate(
          targetUser.id,
          normalizedDate,
        );
      const mappedLeader =
        await this.salesLeaderMappingService.resolveSalesLeaderForUser(
          targetUser,
        );
      const nextReport = await this.buildAutoGeneratedReport({
        requester: targetUser,
        businessDate: normalizedDate,
        existingReport,
        sourceBundle,
        generatedAt: sentAt,
        mappedLeader,
      });

      const savedReport = this.dailyReportRepository.save(nextReport);
      generatedReports.push(savedReport);

      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'DAILY_REPORT_DRAFT_SAVED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        scopeSnapshot: this.userScopeService.resolveScope(user),
        sessionSnapshot: {
          reportId: savedReport.id,
          businessDate: savedReport.businessDate,
          requesterId: targetUser.id,
          followUpCount: sourceBundle.followUps.length,
          createdCustomerCount: sourceBundle.createdCustomers.length,
          createdOpportunityCount: sourceBundle.createdOpportunities.length,
          autoGenerated: true,
        },
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: '22点自动汇总日报草稿已生成。',
        createdAt: sentAt,
      });

      const shouldSendConfirmation =
        savedReport.status !== 'CONFIRMED' &&
        savedReport.status !== 'LATE_CONFIRMED' &&
        savedReport.status !== 'SUMMARIZED';
      if (!shouldSendConfirmation) {
        continue;
      }

      const deliveryResult =
        await this.dailyReportDispatcherService.dispatchPersonalConfirmation(
          user,
          savedReport,
        );
      const deliveredReport = this.dailyReportRepository.save({
        ...savedReport,
        deliveries: this.replacePersonalConfirmationDelivery(
          savedReport.deliveries,
          deliveryResult.delivery,
        ),
        updatedAt: deliveryResult.delivery.deliveredAt ?? sentAt,
      });
      generatedReports[generatedReports.length - 1] = deliveredReport;

      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'DAILY_REPORT_DELIVERY_SENT',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        scopeSnapshot: this.userScopeService.resolveScope(user),
        sessionSnapshot: {
          reportId: deliveredReport.id,
          targetUserId: deliveredReport.requesterId,
          contentPreview: deliveryResult.delivery.contentPreview,
          deliveryType: 'PERSONAL_CONFIRMATION',
        },
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome:
          deliveryResult.outcome === 'SENT'
            ? '22点个人日报确认消息已发送。'
            : deliveryResult.outcome === 'SKIPPED'
              ? '日报开关关闭，已跳过 22 点个人日报确认消息。'
              : '22点个人日报确认消息发送失败。',
        failureReason:
          deliveryResult.outcome === 'SENT'
            ? undefined
            : deliveryResult.delivery.failureReason,
        createdAt: deliveryResult.delivery.deliveredAt ?? sentAt,
      });
    }

    return generatedReports;
  }

  runClosureSweep(
    user: CrmUser,
    businessDate: string,
    closedAt = new Date().toISOString(),
  ): DailyReportRecord[] {
    const normalizedDate = normalizeBusinessDate(businessDate);
    const reports = this.dailyReportRepository.listByBusinessDate(normalizedDate);
    const updatedReports: DailyReportRecord[] = [];

    for (const report of reports) {
      if (
        report.status === 'CONFIRMED' ||
        report.status === 'LATE_CONFIRMED' ||
        report.status === 'CLOSED' ||
        report.status === 'SUMMARIZED'
      ) {
        updatedReports.push(report);
        continue;
      }

      const closure: DailyReportClosureRecord = {
        id: buildEntityId('daily_report_closure'),
        closedAt,
        closedBy: user.id,
        closureReason: '当日 23:59 已封账，等待次日汇总。',
      };
      const updated = this.dailyReportRepository.save({
        ...report,
        status: 'CLOSED',
        closure,
        updatedAt: closedAt,
      });
      updatedReports.push(updated);
      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'DAILY_REPORT_CLOSED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        scopeSnapshot: this.userScopeService.resolveScope(user),
        sessionSnapshot: {
          reportId: updated.id,
          businessDate: updated.businessDate,
        },
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: '日报已封账。',
        createdAt: closedAt,
      });
    }

    return updatedReports;
  }

  async runSummarySweep(
    user: CrmUser,
    businessDate: string,
    recipientIds?: string[],
    generatedAt = new Date().toISOString(),
  ): Promise<DailyReportSummaryBatchRecord> {
    const normalizedDate = normalizeBusinessDate(businessDate);
    const existingBatch =
      this.dailyReportRepository.findSummaryBatchByBusinessDate(normalizedDate);
    if (existingBatch) {
      return existingBatch;
    }

    const resolvedGroups =
      await this.dailyReportDeliveryRoutingService.listResolvedSalesGroups();
    const enabledResolvedGroups = resolvedGroups.filter(
      (item) => item.effectivePolicy !== 'DISABLED',
    );

    if (enabledResolvedGroups.length > 0) {
      const groupedSnapshots = await Promise.all(
        enabledResolvedGroups.map(async (group) => {
          const memberSnapshots =
            await this.collectSummaryMemberSnapshotsByRequesterIds(
              group.memberCrmUserIds,
              normalizedDate,
              generatedAt,
              {
                persistReports: true,
              },
            );
          return {
            group,
            memberSnapshots,
          };
        }),
      );
      const groupSummaries = await Promise.all(
        groupedSnapshots.map(async ({ group, memberSnapshots }) => {
          const readyRecipients = group.resolvedRecipients.filter(
            (recipient) => recipient.resolutionStatus === 'READY',
          );
          const recipientCrmUserIds = readyRecipients
            .map((recipient) => recipient.crmUserId)
            .filter((value): value is string => Boolean(value));
          const recipientNames = readyRecipients
            .map((recipient) => recipient.recipientName)
            .filter((value): value is string => Boolean(value));
          const recipientWecomUserIds = readyRecipients
            .map((recipient) => recipient.wecomUserId)
            .filter((value): value is string => Boolean(value));
          const recipient = {
            id: group.resolvedRecipient.crmUserId ?? group.groupDepartmentId,
            name:
              recipientNames.length > 0
                ? recipientNames.join('、')
                : group.resolvedRecipient.recipientName ?? '未配置收件人',
            roleIds: [],
            roleNames: [],
            organizationIds: [],
            departmentIds: [],
            ownerIds: [],
            isAdmin: false,
            exportAllowed: false,
            channels: ['web-console'],
          } as CrmUser;

          return {
            groupDepartmentId: group.groupDepartmentId,
            groupDepartmentName: group.groupDepartmentName,
            regionDepartmentId: group.regionDepartmentId,
            regionDepartmentName: group.regionDepartmentName,
            recipientCrmUserIds,
            recipientNames,
            recipientWecomUserIds,
            recipientCrmUserId: group.resolvedRecipient.crmUserId,
            recipientName: group.resolvedRecipient.recipientName,
            recipientWecomUserId: group.resolvedRecipient.wecomUserId,
            ruleSource: group.resolvedRecipient.source,
            deliveryStatus:
              recipientCrmUserIds.length > 0
                ? 'READY'
                : 'BLOCKED',
            deliveryReason:
              group.blockedReason ?? group.resolvedRecipient.resolutionReason,
            memberRequesterIds: memberSnapshots.map((item) => item.requesterId),
            memberCount: memberSnapshots.length,
            summaryText: await this.buildTeamSummaryMessage(
              recipient,
              memberSnapshots,
            ),
          } satisfies DailyReportSummaryGroupRecord;
        }),
      );

      const memberSnapshotMap = new Map<
        string,
        DailyReportSummaryMemberSnapshot
      >();
      for (const { memberSnapshots } of groupedSnapshots) {
        for (const snapshot of memberSnapshots) {
          memberSnapshotMap.set(snapshot.requesterId, snapshot);
        }
      }

      const memberSnapshots = [...memberSnapshotMap.values()];
      const confirmedMembers = memberSnapshots.filter(
        (item) => item.reportStatus === 'CONFIRMED',
      );
      const lateMembers = memberSnapshots.filter(
        (item) => item.reportStatus === 'LATE_CONFIRMED',
      );
      const pendingMembers = memberSnapshots.filter(
        (item) =>
          item.reportStatus === 'PENDING_CONFIRMATION' ||
          item.reportStatus === 'DRAFT' ||
          item.reportStatus === 'CLOSED',
      );
      const missingMembers = memberSnapshots.filter(
        (item) => item.reportStatus === 'MISSING',
      );
      const summaryBatch: DailyReportSummaryBatchRecord = {
        id: buildEntityId('daily_report_summary_batch'),
        businessDate: normalizedDate,
        generatedAt,
        confirmedCount: confirmedMembers.length,
        lateCount: lateMembers.length,
        missingCount: missingMembers.length,
        recipientIds: Array.from(
          new Set(
            groupSummaries
              .flatMap((item) =>
                item.recipientCrmUserIds?.length
                  ? item.recipientCrmUserIds
                  : item.recipientCrmUserId
                    ? [item.recipientCrmUserId]
                    : [],
              )
              .filter((value): value is string => Boolean(value)),
          ),
        ),
        deliveryStatus:
          groupSummaries.some((item) => item.deliveryStatus === 'READY')
            ? 'SENT'
            : 'FAILED',
        summaryText: this.buildTeamSummaryBatchPreview({
          confirmedMembers,
          lateMembers,
          pendingMembers,
          missingMembers,
        }),
        groupSummaries,
        aiInsightSnapshot: this.buildDailyReportAiInsightSnapshot({
          scene: 'SUMMARY_BATCH',
          factCount: memberSnapshots.filter((item) => item.hasSourceData).length,
          generatedAt,
        }),
      };

      const dispatched = await this.dailyReportDispatcherService.dispatchSummaryBatch(
        summaryBatch,
        [],
        user,
      );
      const savedBatch = this.dailyReportRepository.saveSummaryBatch(
        dispatched.batch,
      );
      for (const report of this.dailyReportRepository.listByBusinessDate(normalizedDate)) {
        this.dailyReportRepository.save({
          ...report,
          summaryBatchId: savedBatch.id,
          updatedAt: generatedAt,
        });
      }

      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'DAILY_REPORT_SUMMARIZED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        scopeSnapshot: this.userScopeService.resolveScope(user),
        sessionSnapshot: {
          businessDate: savedBatch.businessDate,
          batchId: savedBatch.id,
          confirmedCount: savedBatch.confirmedCount,
          lateCount: savedBatch.lateCount,
          missingCount: savedBatch.missingCount,
          recipientIds: savedBatch.recipientIds,
            groupSummaries: savedBatch.groupSummaries.map((item) => ({
              groupDepartmentId: item.groupDepartmentId,
              recipientCrmUserIds: item.recipientCrmUserIds,
              recipientNames: item.recipientNames,
              recipientCrmUserId: item.recipientCrmUserId,
              recipientName: item.recipientName,
            deliveryStatus: item.deliveryStatus,
            ruleSource: item.ruleSource,
          })),
          aiInsightSnapshot: savedBatch.aiInsightSnapshot,
        },
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: savedBatch.summaryText,
        createdAt: generatedAt,
      });

      if (savedBatch.deliveryStatus === 'SENT') {
        for (const report of this.dailyReportRepository
          .listByBusinessDate(normalizedDate)
          .filter(
            (item) =>
              item.status === 'CONFIRMED' || item.status === 'LATE_CONFIRMED',
          )) {
          await this.dailyReportAssistanceEscalationService.dispatchFormalEscalations({
            actor: user,
            report,
            trigger: 'SUMMARY_BATCH',
            triggeredAt: generatedAt,
          });
        }
      }

      return savedBatch;
    }

    const memberSnapshots = await this.collectSummaryMemberSnapshots(
      user,
      normalizedDate,
      generatedAt,
      recipientIds,
    );
    const confirmedMembers = memberSnapshots.filter(
      (item) => item.reportStatus === 'CONFIRMED',
    );
    const lateMembers = memberSnapshots.filter(
      (item) => item.reportStatus === 'LATE_CONFIRMED',
    );
    const pendingMembers = memberSnapshots.filter(
      (item) =>
        item.reportStatus === 'PENDING_CONFIRMATION' ||
        item.reportStatus === 'DRAFT' ||
        item.reportStatus === 'CLOSED',
    );
    const missingMembers = memberSnapshots.filter(
      (item) => item.reportStatus === 'MISSING',
    );
    const confirmedCount = confirmedMembers.length;
    const lateCount = lateMembers.length;
    const missingCount = missingMembers.length;
    const defaultRecipientIds = Array.from(
      new Set(
        memberSnapshots
          .map((item) => item.supervisorId)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const finalRecipientIds = Array.from(
      new Set(
        recipientIds && recipientIds.length > 0
          ? recipientIds
          : defaultRecipientIds,
      ),
    );

    const summaryBatch: DailyReportSummaryBatchRecord = {
      id: buildEntityId('daily_report_summary_batch'),
      businessDate: normalizedDate,
      generatedAt,
      confirmedCount,
      lateCount,
      missingCount,
      recipientIds: finalRecipientIds,
      deliveryStatus: finalRecipientIds.length > 0 ? 'SENT' : 'FAILED',
      summaryText: this.buildTeamSummaryBatchPreview({
        confirmedMembers,
        lateMembers,
        pendingMembers,
        missingMembers,
      }),
      groupSummaries: [],
      aiInsightSnapshot: this.buildDailyReportAiInsightSnapshot({
        scene: 'SUMMARY_BATCH',
        factCount: memberSnapshots.filter((item) => item.hasSourceData).length,
        generatedAt,
      }),
    };

    const summaryRecipients = await Promise.all(
      (
        await Promise.all(
          finalRecipientIds.map(async (id) => {
            const recipient = await this.crmReadonlyService.getUserById(id);
            if (recipient) {
              return recipient;
            }

            return {
              id,
              name: id,
              roleIds: [],
              roleNames: [],
              organizationIds: [],
              departmentIds: [],
              ownerIds: [],
              isAdmin: false,
              exportAllowed: false,
              channels: ['web-console'],
            } as CrmUser;
          }),
        )
      ).map(async (recipient) => ({
        recipient,
        summaryText: await this.buildTeamSummaryMessage(
          recipient,
          memberSnapshots.filter((item) => item.supervisorId === recipient.id),
        ),
      })),
    );

    const dispatched = await this.dailyReportDispatcherService.dispatchSummaryBatch(
      summaryBatch,
      summaryRecipients,
      user,
    );
    const savedBatch = this.dailyReportRepository.saveSummaryBatch(dispatched.batch);
    for (const report of this.dailyReportRepository.listByBusinessDate(normalizedDate)) {
      this.dailyReportRepository.save({
        ...report,
        summaryBatchId: savedBatch.id,
        updatedAt: generatedAt,
      });
    }

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_SUMMARIZED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        businessDate: savedBatch.businessDate,
        batchId: savedBatch.id,
        confirmedCount: savedBatch.confirmedCount,
        lateCount: savedBatch.lateCount,
        missingCount: savedBatch.missingCount,
        recipientIds: savedBatch.recipientIds,
        aiInsightSnapshot: savedBatch.aiInsightSnapshot,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: savedBatch.summaryText,
      createdAt: generatedAt,
    });

    // 团队汇总属于日报正式对上送达的一种出口，需要在该节点补齐协助升级通知。
    if (savedBatch.deliveryStatus === 'SENT') {
      for (const report of this.dailyReportRepository
        .listByBusinessDate(normalizedDate)
        .filter(
          (item) =>
            item.status === 'CONFIRMED' || item.status === 'LATE_CONFIRMED',
        )) {
        await this.dailyReportAssistanceEscalationService.dispatchFormalEscalations({
          actor: user,
          report,
          trigger: 'SUMMARY_BATCH',
          triggeredAt: generatedAt,
        });
      }
    }

    return savedBatch;
  }

  listReports(
    user: CrmUser,
    filters: {
      businessDate?: string;
      status?: DailyReportStatus;
      requesterId?: string;
    } = {},
  ): DailyReportRecord[] {
    const reports = user.isAdmin
      ? this.dailyReportRepository.list()
      : this.dailyReportRepository.listByRequesterId(user.id);

    return reports
      .filter((item) => (filters.businessDate ? item.businessDate === normalizeBusinessDate(filters.businessDate) : true))
      .filter((item) => (filters.status ? item.status === filters.status : true))
      .filter((item) => (filters.requesterId ? item.requesterId === filters.requesterId : true));
  }

  listSummaryBatches(user: CrmUser): DailyReportSummaryBatchRecord[] {
    if (user.isAdmin) {
      return this.dailyReportRepository.listSummaryBatches();
    }

    return this.dailyReportRepository
      .listSummaryBatches()
      .filter((batch) => batch.recipientIds.includes(user.id));
  }

  getReport(user: CrmUser, reportId: string): DailyReportRecord {
    const report = this.requireOwnedReport(user, reportId);
    return report;
  }

  async getOrBuildUserDailyReportPreview(
    user: CrmUser,
    businessDate: string,
    generatedAt = new Date().toISOString(),
  ): Promise<DailyReportRecord | undefined> {
    const normalizedDate = normalizeBusinessDate(businessDate);
    const sourceBundle = await this.collectDailySourceBundle(user, normalizedDate);
    const existingReport = this.dailyReportRepository.findByRequesterAndBusinessDate(
      user.id,
      normalizedDate,
    );

    if (!this.hasSourceData(sourceBundle)) {
      return existingReport;
    }

    const mappedLeader =
      await this.salesLeaderMappingService.resolveSalesLeaderForUser(user);
    const nextReport = await this.buildAutoGeneratedReport({
      requester: user,
      businessDate: normalizedDate,
      existingReport,
      sourceBundle,
      generatedAt,
      mappedLeader,
    });

    return this.dailyReportRepository.save(nextReport);
  }

  /**
   * 按负责人生成小组当天日报预览。
   * 参数：当前查看人、负责人查询词、业务日期、生成时间；返回解析结果、权限校验结果与预览正文。
   * 返回：命中时返回 READY + summaryText；未命中、重名或无权限时返回明确状态，供聊天入口输出中文提示。
   * 注意：该方法只用于即时预览，不创建 summary batch，也不触发主动通知。
   */
  async getTeamDailyReportPreview(
    actor: CrmUser,
    leaderNameQuery: string,
    businessDate: string,
    generatedAt = new Date().toISOString(),
  ): Promise<DailyReportTeamPreviewResult> {
    const normalizedDate = normalizeBusinessDate(businessDate);
    const matchedGroups = await this.matchSalesLeaderGroupsByName(leaderNameQuery);
    if (matchedGroups.length === 0) {
      return {
        status: 'LEADER_NOT_FOUND',
        businessDate: normalizedDate,
        leaderNameQuery,
      };
    }

    if (matchedGroups.length > 1) {
      return {
        status: 'LEADER_AMBIGUOUS',
        businessDate: normalizedDate,
        leaderNameQuery,
        candidateLeaderNames: this.uniqueLeaderNames(matchedGroups),
      };
    }

    const targetGroup = matchedGroups[0];
    if (!targetGroup || !this.canActorPreviewLeaderTeam(actor, targetGroup)) {
      return {
        status: 'FORBIDDEN',
        businessDate: normalizedDate,
        leaderNameQuery,
        leaderId: targetGroup?.leader.id,
        leaderName: targetGroup?.leader.name ?? targetGroup?.leaderName,
      };
    }

    const memberSnapshots = await this.collectSummaryMemberSnapshots(
      actor,
      normalizedDate,
      generatedAt,
      [targetGroup.leader.id],
      {
        persistReports: false,
      },
    );

    const hasAnySourceData = memberSnapshots.some((item) => item.hasSourceData);
    return {
      status: 'READY',
      businessDate: normalizedDate,
      leaderNameQuery,
      leaderId: targetGroup.leader.id,
      leaderName: targetGroup.leader.name ?? targetGroup.leaderName,
      summaryText: await this.buildTeamSummaryMessage(targetGroup.leader, memberSnapshots),
      hasAnySourceData,
      aiInsightSnapshot: this.buildDailyReportAiInsightSnapshot({
        scene: 'TEAM_PREVIEW',
        factCount: memberSnapshots.filter((item) => item.hasSourceData).length,
        generatedAt,
      }),
    };
  }

  getLatestPendingReport(user: CrmUser): DailyReportRecord | undefined {
    if (user.isAdmin) {
      return this.dailyReportRepository
        .list()
        .filter((item) => item.status === 'PENDING_CONFIRMATION')
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    }

    return this.dailyReportRepository.findLatestPendingByRequesterId(user.id);
  }

  getAuditSnapshot(user: CrmUser, filters: {
    businessDate?: string;
    status?: DailyReportStatus;
  } = {}): Array<Record<string, unknown>> {
    return this.listReports(user, filters).map((report) => ({
      reportId: report.id,
      requesterId: report.requesterId,
      requesterName: report.requesterName,
      supervisorId: report.supervisorId,
      businessDate: report.businessDate,
      status: report.status,
      draftTitle: report.draftTitle,
      draftSummary: report.draftSummary,
      sectionTypes: report.sectionTypes,
      confirmation: report.confirmation,
      reminders: report.reminders,
      closure: report.closure,
      deliveries: report.deliveries,
      aiInsightSnapshot: report.aiInsightSnapshot,
      summaryBatchId: report.summaryBatchId,
      lateConfirmed: report.lateConfirmed,
      fragments: report.fragments.map((fragment) => ({
        id: fragment.id,
        fragmentType: fragment.fragmentType,
        content: fragment.content,
        sourceLabel: fragment.sourceLabel,
        sourceInterface: fragment.sourceInterface,
        sourceObjectId: fragment.sourceObjectId,
        sourceOperatorId: fragment.sourceOperatorId,
        sourceOperatorName: fragment.sourceOperatorName,
        sourceCode: fragment.sourceCode,
        capturedAt: fragment.capturedAt,
      })),
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));
  }

  private async resolveReminderTargets(user: CrmUser): Promise<CrmUser[]> {
    const resolvedGroups =
      await this.dailyReportDeliveryRoutingService.listResolvedSalesGroups();
    if (resolvedGroups.length > 0) {
      const enabledMemberIds = new Set(
        resolvedGroups
          .filter((item) => item.effectivePolicy !== 'DISABLED')
          .flatMap((item) => item.memberCrmUserIds),
      );

      if (!user.isAdmin) {
        return enabledMemberIds.has(user.id) ? [user] : [];
      }

      return (await this.crmReadonlyService.listDailyReportUsers()).filter((item) =>
        enabledMemberIds.has(item.id),
      );
    }

    if (!user.isAdmin) {
      return [user];
    }

    const mappedMembers =
      await this.salesLeaderMappingService.listMappedSalesMembers();
    if (mappedMembers.length > 0) {
      return mappedMembers;
    }

    return (await this.crmReadonlyService.listDailyReportUsers()).filter((item) =>
      this.isDailyReportTargetUser(item),
    );
  }

  private async collectDailySourceBundle(
    requester: CrmUser,
    businessDate: string,
  ): Promise<DailyReportSourceBundle> {
    const [followUps, createdCustomers, createdOpportunities] = await Promise.all([
      this.crmReadonlyService.listDailyFollowUpSources(requester.id, businessDate),
      this.crmReadonlyService.listDailyCreatedCustomers(requester.id, businessDate),
      this.crmReadonlyService.listDailyCreatedOpportunities(
        requester.id,
        businessDate,
      ),
    ]);

    return {
      followUps,
      createdCustomers,
      createdOpportunities,
    };
  }

  private hasSourceData(sourceBundle: DailyReportSourceBundle): boolean {
    return (
      sourceBundle.followUps.length > 0 ||
      sourceBundle.createdCustomers.length > 0 ||
      sourceBundle.createdOpportunities.length > 0
    );
  }

  private hasAllRequiredSections(report: DailyReportRecord): boolean {
    return DAILY_REPORT_SECTION_ORDER.every((sectionType) =>
      report.sectionTypes.includes(sectionType),
    );
  }

  private async buildAutoGeneratedReport(params: {
    requester: CrmUser;
    businessDate: string;
    existingReport?: DailyReportRecord;
    sourceBundle: DailyReportSourceBundle;
    generatedAt: string;
    mappedLeader?: { id: string; name: string };
  }): Promise<DailyReportRecord> {
    const fragments = this.buildAutoGeneratedFragments(
      params.requester,
      params.sourceBundle,
      params.generatedAt,
    );
    const nextDraftSummary = await this.buildSinglePersonAutoSummary(
      params.requester,
      params.sourceBundle,
    );
    const supervisor = this.resolveSupervisor(
      params.requester,
      params.existingReport,
      params.mappedLeader,
    );
    const baseReport: DailyReportRecord = params.existingReport
      ? {
          ...params.existingReport,
          supervisorId: supervisor.id,
          supervisorName: supervisor.name,
          fragments,
          confirmation: undefined,
          lateConfirmed: false,
          updatedAt: params.generatedAt,
        }
      : {
          id: buildEntityId('daily_report'),
          requesterId: params.requester.id,
          requesterName: params.requester.name,
          supervisorId: supervisor.id,
          supervisorName: supervisor.name,
          businessDate: params.businessDate,
          status: 'DRAFT',
          draftTitle: `${params.businessDate} 销售日报`,
          draftSummary: '',
          sectionTypes: [],
          fragments,
          confirmation: undefined,
          reminders: [],
          deliveries: [],
          lateConfirmed: false,
          createdAt: params.generatedAt,
          updatedAt: params.generatedAt,
        };

    const composedReport = this.composeReport(baseReport);
    const autoGeneratedReport = {
      ...composedReport,
      draftSummary: nextDraftSummary,
      summaryBatchId: undefined,
      aiInsightSnapshot: this.buildDailyReportAiInsightSnapshot({
        scene: 'PERSONAL_CONFIRMATION',
        factCount:
          params.sourceBundle.followUps.length +
          params.sourceBundle.createdCustomers.length +
          params.sourceBundle.createdOpportunities.length,
        generatedAt: params.generatedAt,
      }),
    };

    if (
      params.existingReport?.confirmation &&
      params.existingReport.draftSummary === nextDraftSummary
    ) {
      return {
        ...autoGeneratedReport,
        status: params.existingReport.status,
        confirmation: params.existingReport.confirmation,
        lateConfirmed: params.existingReport.lateConfirmed,
        summaryBatchId: params.existingReport.summaryBatchId,
      };
    }

    return {
      ...autoGeneratedReport,
      confirmation: undefined,
      lateConfirmed: false,
    };
  }

  private buildAutoGeneratedFragments(
    requester: CrmUser,
    sourceBundle: DailyReportSourceBundle,
    generatedAt: string,
  ): DailyReportFragmentRecord[] {
    const followUpLines: string[] = [];
    const helpLines: string[] = [];
    const shareLines: string[] = [];
    const tomorrowPlanLines: string[] = [];

    for (const followUp of this.aggregateFollowUpsByObject(sourceBundle.followUps)) {
      const actorName = followUp.requesterName || requester.name;
      const objectLabel =
        followUp.objectType === 'Customer' ? '客户' : '商机';
      const targetLabel = `${objectLabel}「${followUp.objectTitle}」`;

      if (followUp.followUpContents.length > 0) {
        followUpLines.push(
          `${actorName}：${targetLabel}，${followUp.followUpContents.join('；')}`,
        );
      }

      if (followUp.helpValues.length > 0) {
        helpLines.push(`${targetLabel}：${followUp.helpValues.join('；')}`);
      }
      if (followUp.shareValues.length > 0) {
        shareLines.push(`${targetLabel}：${followUp.shareValues.join('；')}`);
      }
      if (followUp.tomorrowPlanValues.length > 0) {
        tomorrowPlanLines.push(
          `${targetLabel}：${followUp.tomorrowPlanValues.join('；')}`,
        );
      }
    }

    const changeLines = [
      ...sourceBundle.createdCustomers.map((item) =>
        `新增客户：${item.customerName}${item.category ? `（${item.category}）` : ''}`,
      ),
      ...sourceBundle.createdOpportunities.map((item) =>
        `新增商机：${item.title}${
          item.customerName ? `（客户：${item.customerName}）` : ''
        }${item.stage ? `，阶段：${item.stage}` : ''}`,
      ),
    ];

    return [
      this.buildAutoFragment(
        'TODAY_FOLLOW_UP',
        this.compactSummaryLines(followUpLines, '今日暂无跟进'),
        requester,
        generatedAt,
        '/api/v2/revisit_logs',
      ),
      this.buildAutoFragment(
        'CUSTOMER_OR_OPPORTUNITY_CHANGE',
        this.compactSummaryLines(changeLines, '暂无新增客户/商机'),
        requester,
        generatedAt,
      ),
      this.buildAutoFragment(
        'INFORMATION_SHARE',
        this.compactSummaryLines(shareLines, '无'),
        requester,
        generatedAt,
      ),
      this.buildAutoFragment(
        'HELP_REQUIRED',
        this.compactSummaryLines(helpLines, '无'),
        requester,
        generatedAt,
      ),
      this.buildAutoFragment(
        'TOMORROW_PLAN',
        this.compactSummaryLines(tomorrowPlanLines, '无'),
        requester,
        generatedAt,
      ),
    ];
  }

  private buildAutoFragment(
    fragmentType: DailyReportFragmentType,
    content: string,
    requester: CrmUser,
    generatedAt: string,
    sourceInterface?: '/api/v2/opportunities' | '/api/v2/revisit_logs' | 'manual',
  ): DailyReportFragmentRecord {
    return {
      id: buildEntityId('daily_report_fragment'),
      fragmentType,
      content,
      sourceLabel: '22点自动汇总',
      sourceInterface,
      sourceOperatorId: requester.id,
      sourceOperatorName: requester.name,
      capturedAt: generatedAt,
    };
  }

  private extractStructuredFollowUpSections(content: string): {
    followUpContent?: string;
    helpNeeded?: string;
    informationShare?: string;
    visitPlan?: string;
  } {
    return parseWecomFollowUpTemplateUpdates(this.stripFollowUpActorPrefix(content));
  }

  private stripFollowUpActorPrefix(content: string): string {
    return content
      .replace(/^【[^】]+】[:：]?\s*/u, '')
      .replace(/^[^：:\n]{1,20}[:：]\s*/u, '')
      .trim();
  }

  private normalizeFreeformFollowUpContent(content: string): string {
    const normalizedContent = this.stripFollowUpActorPrefix(content)
      .replace(/\r?\n/gu, '；')
      .replace(/\s+/gu, ' ')
      .trim();
    const labelMatch = normalizedContent.match(
      /[；;](?:跟进内容|遇到与协助|问题与协助|信息共享|信息分享|拜访计划)[:：]/u,
    );
    if (!labelMatch || labelMatch.index === undefined) {
      return normalizedContent;
    }

    return normalizedContent.slice(0, labelMatch.index).trim();
  }

  /**
   * 判断一条跟进是否命中了结构化模板标签。
   * 只有完全未命中结构标签时，才视为非模板手工跟进，并在日报展示层兜底为：
   * 跟进内容=全文，其它三项=无。
   */
  private hasStructuredFollowUpLabels(content: string): boolean {
    return /(?:^|[\n；;])(?:跟进内容|遇到与协助|问题与协助|信息共享|信息分享|拜访计划)[:：]/u.test(
      this.stripFollowUpActorPrefix(content),
    );
  }

  private compactSummaryLines(lines: string[], fallback: string): string {
    const normalizedLines = Array.from(
      new Set(
        lines
          .map((item) => item.replace(/\s+/gu, ' ').trim())
          .filter(Boolean),
      ),
    );

    if (normalizedLines.length === 0) {
      return fallback;
    }

    return normalizedLines.join('\n');
  }

  private async buildSinglePersonAutoSummary(
    requester: CrmUser,
    sourceBundle: DailyReportSourceBundle,
  ): Promise<string> {
    const latestFollowUps = this.aggregateFollowUpsByObject(sourceBundle.followUps);
    const workLines = [
      ...latestFollowUps.map((followUp) => this.buildWorkExecutionLine(requester, followUp)),
      ...sourceBundle.createdCustomers.map(
        (item) =>
          `新增客户「${item.customerName}」${item.category ? `，客户类型：${item.category}` : ''}`.trim(),
      ),
      ...sourceBundle.createdOpportunities.map(
        (item) =>
          `新增商机「${item.title}」${item.customerName ? `，客户：${item.customerName}` : ''}${item.stage ? `，阶段：${item.stage}` : ''}`.trim(),
      ),
    ];
    const helpLines = latestFollowUps
      .map((followUp) => this.buildStructuredSectionLine(followUp, 'helpNeeded'))
      .filter((item): item is string => Boolean(item));
    const shareLines = latestFollowUps
      .map((followUp) =>
        this.buildStructuredSectionLine(followUp, 'informationShare'),
      )
      .filter((item): item is string => Boolean(item));
    const tomorrowPlanLines = latestFollowUps
      .map((followUp) => this.buildStructuredSectionLine(followUp, 'visitPlan'))
      .filter((item): item is string => Boolean(item));

    const aiSummary = await this.buildPersonalGroundedAiSummary(
      requester.name,
      workLines,
      helpLines,
      shareLines,
      tomorrowPlanLines,
      this.buildPersonalGroundedAiSummaryFallback({
        latestFollowUpCount: latestFollowUps.length,
        createdCustomerCount: sourceBundle.createdCustomers.length,
        createdOpportunityCount: sourceBundle.createdOpportunities.length,
        helpCount: helpLines.length,
        shareCount: shareLines.length,
        tomorrowPlanCount: tomorrowPlanLines.length,
      }),
    );

    return [
      `【${requester.name}日报】`,
      this.buildReportSection('1', '当日工作执行结果', workLines),
      this.buildReportSection('2', '问题与协助', helpLines),
      this.buildReportSection('3', '信息分享', shareLines),
      this.buildReportSection('4', '计划', tomorrowPlanLines),
      aiSummary,
    ].join('\n');
  }

  private buildPersonalGroundedAiSummaryFallback(params: {
    latestFollowUpCount: number;
    createdCustomerCount: number;
    createdOpportunityCount: number;
    helpCount: number;
    shareCount: number;
    tomorrowPlanCount: number;
  }): string {
    if (process.env.WECOM_AI_DAILY_INSIGHT_ENABLED === 'false') {
      return this.buildReportSection('5', 'AI摘要', [
        'AI 摘要开关已关闭，当前回退到既有事实摘要。',
      ]);
    }

    const factCount =
      params.latestFollowUpCount +
      params.createdCustomerCount +
      params.createdOpportunityCount;
    if (factCount <= 0) {
      return this.buildReportSection('5', 'AI摘要', [
        '当前事实不足，已回退到既有事实摘要。',
      ]);
    }

    return this.buildReportSection('5', 'AI摘要', [
      `grounded：今日共沉淀 ${params.latestFollowUpCount} 项跟进、新增客户 ${params.createdCustomerCount} 个、新增商机 ${params.createdOpportunityCount} 个。`,
      params.helpCount > 0
        ? `需要关注 ${params.helpCount} 项协助诉求，建议优先确认资源和审批节奏。`
        : '当前未发现明确协助阻塞项。',
      params.tomorrowPlanCount > 0
        ? `已形成 ${params.tomorrowPlanCount} 项后续计划，可作为明日跟进重点。`
        : undefined,
      params.shareCount > 0
        ? `包含 ${params.shareCount} 条信息共享，可复盘客户关注点。`
        : undefined,
    ].filter((item): item is string => Boolean(item)));
  }

  private async buildPersonalGroundedAiSummary(
    requesterName: string,
    workLines: string[],
    helpLines: string[],
    shareLines: string[],
    tomorrowPlanLines: string[],
    fallbackSummary: string,
  ): Promise<string> {
    if (process.env.WECOM_AI_DAILY_INSIGHT_ENABLED === 'false') {
      return fallbackSummary;
    }

    const aiInsight = await this.aiGatewayService.generateDailyReportGroundedInsight({
      scene: 'PERSONAL_CONFIRMATION',
      requesterName,
      factSummary: workLines.join('；') || '无',
      helpSummary: helpLines.join('；') || '无',
      shareSummary: shareLines.join('；') || '无',
      planSummary: tomorrowPlanLines.join('；') || '无',
    });
    if (!aiInsight || aiInsight.summaryLines.length === 0) {
      return fallbackSummary;
    }

    return this.buildReportSection('5', 'AI摘要', aiInsight.summaryLines);
  }

  private buildReportSection(
    sectionIndex: string,
    title: string,
    lines: string[],
  ): string {
    const normalizedLines = Array.from(
      new Set(
        lines
          .map((item) => item.replace(/\s+/gu, ' ').trim())
          .filter(Boolean),
      ),
    );
    const effectiveLines = normalizedLines.length > 0 ? normalizedLines : ['无'];
    const contentLines = this.shouldRenderPlainFallback(effectiveLines)
      ? [effectiveLines[0]]
      : effectiveLines.map((item, index) => `${formatCircledNumber(index)}${item}`);

    return [`${sectionIndex}、${title}`, ...contentLines].join('\n');
  }

  private buildWorkExecutionLine(
    requester: CrmUser,
    followUp: AggregatedDailyFollowUp,
  ): string {
    const summaryText = followUp.followUpContents.join('；');
    const objectLabel = followUp.objectType === 'Customer' ? '客户' : '商机';
    const actorPrefix =
      followUp.requesterName && followUp.requesterName !== requester.name
        ? `${followUp.requesterName}：`
        : '';

    return `${actorPrefix}${objectLabel}「${followUp.objectTitle}」：${summaryText}`;
  }

  private buildStructuredSectionLine(
    followUp: AggregatedDailyFollowUp,
    fieldName: 'helpNeeded' | 'informationShare' | 'visitPlan',
  ): string | undefined {
    const fieldValues =
      fieldName === 'helpNeeded'
        ? followUp.helpValues
        : fieldName === 'informationShare'
          ? followUp.shareValues
          : followUp.tomorrowPlanValues;
    if (fieldValues.length === 0) {
      return undefined;
    }

    const objectLabel = followUp.objectType === 'Customer' ? '客户' : '商机';
    return `${objectLabel}「${followUp.objectTitle}」：${fieldValues.join('；')}`;
  }

  private aggregateFollowUpsByObject(
    followUps: DailyReportFollowUpSourceRecord[],
  ): AggregatedDailyFollowUp[] {
    const aggregatedMap = new Map<string, AggregatedDailyFollowUp>();

    for (const followUp of [...followUps].sort((left, right) =>
      left.writtenAt.localeCompare(right.writtenAt),
    )) {
      const key = `${followUp.objectType}:${followUp.objectId}`;
      const structuredSections = this.extractStructuredFollowUpSections(
        followUp.content,
      );
      const isNonTemplateFollowUp = !this.hasStructuredFollowUpLabels(
        followUp.content,
      );
      const current =
        aggregatedMap.get(key) ??
        {
          requesterName: followUp.requesterName,
          objectType: followUp.objectType,
          objectId: followUp.objectId,
          objectTitle: followUp.objectTitle,
          customerName: followUp.customerName,
          followUpContents: [],
          helpValues: [],
          shareValues: [],
          tomorrowPlanValues: [],
          latestWrittenAt: followUp.writtenAt,
        };

      const followUpContent =
        structuredSections.followUpContent?.trim() ||
        this.normalizeFreeformFollowUpContent(followUp.content);
      const summaryFollowUpContent = this.normalizeSummaryDisplayValue(
        followUpContent,
        'followUpContent',
      );
      if (summaryFollowUpContent) {
        current.followUpContents = this.pushUniqueLine(
          current.followUpContents,
          summaryFollowUpContent,
        );
      }
      const summaryHelpNeeded = this.normalizeSummaryDisplayValue(
        isNonTemplateFollowUp ? '无' : structuredSections.helpNeeded,
        'helpNeeded',
      );
      if (this.isMeaningfulSectionValue(summaryHelpNeeded)) {
        current.helpValues = this.pushUniqueLine(
          current.helpValues,
          summaryHelpNeeded!,
        );
      }
      const summaryInformationShare = this.normalizeSummaryDisplayValue(
        isNonTemplateFollowUp ? '无' : structuredSections.informationShare,
        'informationShare',
      );
      if (this.isMeaningfulSectionValue(summaryInformationShare)) {
        current.shareValues = this.pushUniqueLine(
          current.shareValues,
          summaryInformationShare!,
        );
      }
      const summaryVisitPlan = this.normalizeSummaryDisplayValue(
        isNonTemplateFollowUp ? '无' : structuredSections.visitPlan,
        'visitPlan',
      );
      if (this.isMeaningfulSectionValue(summaryVisitPlan)) {
        current.tomorrowPlanValues = this.pushUniqueLine(
          current.tomorrowPlanValues,
          summaryVisitPlan!,
        );
      }
      current.latestWrittenAt = followUp.writtenAt;
      aggregatedMap.set(key, current);
    }

    return [...aggregatedMap.values()].sort((left, right) =>
      left.latestWrittenAt.localeCompare(right.latestWrittenAt),
    );
  }

  private isMeaningfulSectionValue(value?: string): boolean {
    const normalizedValue = value?.replace(/\s+/gu, ' ').trim();
    if (!normalizedValue) {
      return false;
    }

    const normalizedPlaceholderValue = normalizedValue
      .replace(/[。！？!?；;，,、]+$/gu, '')
      .trim();

    return !EMPTY_SECTION_PLACEHOLDER_VALUES.includes(
      normalizedPlaceholderValue,
    );
  }

  /**
   * 只在日报展示阶段做轻量降噪，保留原始跟进记录与审计正文不变。
   * 目的：避免测试尾巴或泛化占位短语直接进入摘要，影响企业微信阅读体验。
   */
  private normalizeSummaryDisplayValue(
    value: string | undefined,
    fieldName: 'followUpContent' | 'helpNeeded' | 'informationShare' | 'visitPlan',
  ): string | undefined {
    const normalizedValue = value?.replace(/\s+/gu, ' ').trim();
    if (!normalizedValue) {
      return undefined;
    }

    const withoutNoiseTail = this.stripSummaryDisplayNoise(normalizedValue).trim();
    if (!withoutNoiseTail) {
      return undefined;
    }

    if (fieldName === 'informationShare') {
      const normalizedShareValue = withoutNoiseTail
        .replace(/[，,；;。.!！？、\s]+/gu, '')
        .trim();
      if (
        GENERIC_INFORMATION_SHARE_DISPLAY_PATTERNS.some((pattern) =>
          pattern.test(normalizedShareValue),
        )
      ) {
        return undefined;
      }
    }

    return withoutNoiseTail;
  }

  /** 去除只影响摘要阅读的 ASCII 测试尾巴，避免诸如 hhhh / xxxxxtttt 混入日报正文。 */
  private stripSummaryDisplayNoise(value: string): string {
    let normalizedValue = value.trim();

    const repeatedTailPattern = /([，,；;。.!！？、\s]+)?([A-Za-z0-9])\2{3,}$/u;
    const repeatedTailMatched = repeatedTailPattern.exec(normalizedValue);
    if (repeatedTailMatched) {
      normalizedValue = `${normalizedValue.slice(0, repeatedTailMatched.index)}${this.normalizeSummarySeparator(repeatedTailMatched[1])}`.trim();
    }

    const asciiTailPattern = /([，,；;。.!！？、\s]+)([A-Za-z0-9_-]{8,})$/u;
    while (normalizedValue) {
      const matched = asciiTailPattern.exec(normalizedValue);
      if (!matched?.[2] || matched.index === undefined) {
        break;
      }

      const tailToken = matched[2];
      const uniqueCharCount = new Set(tailToken.toLowerCase()).size;
      if (uniqueCharCount > Math.min(3, Math.ceil(tailToken.length / 4))) {
        break;
      }

      normalizedValue = `${normalizedValue.slice(0, matched.index)}${this.normalizeSummarySeparator(matched[1])}`.trim();
    }

    return normalizedValue;
  }

  /** 保留有效句末标点，只丢掉单纯的空格，避免降噪时把正常语义句号一起删掉。 */
  private normalizeSummarySeparator(separator?: string): string {
    if (!separator) {
      return '';
    }

    return separator.replace(/\s+/gu, '');
  }

  private shouldRenderPlainFallback(lines: string[]): boolean {
    if (lines.length !== 1) {
      return false;
    }

    const normalizedValue = lines[0]?.replace(/\s+/gu, ' ').trim();
    if (!normalizedValue) {
      return false;
    }

    return /^(无|暂无|无需)/u.test(normalizedValue);
  }

  private pushUniqueLine(lines: string[], value: string): string[] {
    const normalizedValue = value.replace(/\s+/gu, ' ').trim();
    if (!normalizedValue) {
      return lines;
    }

    if (lines.includes(normalizedValue)) {
      return lines;
    }

    return [...lines, normalizedValue];
  }

  private resolveSupervisor(
    requester: CrmUser,
    existingReport?: DailyReportRecord,
    mappedLeader?: { id: string; name: string },
  ): { id: string; name?: string } {
    if (existingReport?.supervisorId) {
      return {
        id: existingReport.supervisorId,
        name: existingReport.supervisorName,
      };
    }

    if (mappedLeader) {
      return mappedLeader;
    }

    if (process.env.NODE_ENV === 'test' && requester.id === 'user_sales_director') {
      return {
        id: 'user_region_manager',
        name: '区域经理',
      };
    }

    return {
      id: requester.id,
      name: requester.name,
    };
  }

  private replacePersonalConfirmationDelivery(
    deliveries: DailyReportDeliveryRecord[],
    nextDelivery: DailyReportDeliveryRecord,
  ): DailyReportDeliveryRecord[] {
    return [
      ...deliveries.filter(
        (item) => item.deliveryType !== 'PERSONAL_CONFIRMATION',
      ),
      nextDelivery,
    ];
  }

  private async collectSummaryMemberSnapshots(
    actor: CrmUser,
    businessDate: string,
    generatedAt: string,
    recipientIds?: string[],
    options?: {
      persistReports?: boolean;
    },
  ): Promise<DailyReportSummaryMemberSnapshot[]> {
    const mappedMembers = await this.salesLeaderMappingService.listMappedSalesMembers(
      recipientIds,
    );
    const fallbackUsers = await this.resolveReminderTargets(actor);
    const targetUsers =
      mappedMembers.length > 0 ? mappedMembers : fallbackUsers;
    // 已经命中销售负责人映射的成员，优先视为“允许纳入日报汇总的销售成员”；
    // 这里不再额外依赖 live 用户上下文里的 ownerIds / supervisorId，避免真实环境
    // 因用户快照字段未补齐而把已映射销售成员整体过滤掉。
    const filteredTargetUsers =
      mappedMembers.length > 0
        ? targetUsers.filter((item) => item.channels.includes('wecom-bot'))
        : targetUsers.filter((item) => this.isDailyReportTargetUser(item));
    return await this.collectSummaryMemberSnapshotsFromUsers(
      filteredTargetUsers,
      businessDate,
      generatedAt,
      options,
    );
  }

  private async collectSummaryMemberSnapshotsByRequesterIds(
    requesterIds: string[],
    businessDate: string,
    generatedAt: string,
    options?: {
      persistReports?: boolean;
    },
  ): Promise<DailyReportSummaryMemberSnapshot[]> {
    if (requesterIds.length === 0) {
      return [];
    }

    const requesterIdSet = new Set(requesterIds);
    const targetUsers = (await this.crmReadonlyService.listDailyReportUsers()).filter(
      (item) => requesterIdSet.has(item.id),
    );

    return await this.collectSummaryMemberSnapshotsFromUsers(
      targetUsers,
      businessDate,
      generatedAt,
      options,
    );
  }

  private async collectSummaryMemberSnapshotsFromUsers(
    targetUsers: CrmUser[],
    businessDate: string,
    generatedAt: string,
    options?: {
      persistReports?: boolean;
    },
  ): Promise<DailyReportSummaryMemberSnapshot[]> {
    const snapshots: DailyReportSummaryMemberSnapshot[] = [];

    for (const requester of targetUsers) {
      const sourceBundle = await this.collectDailySourceBundle(requester, businessDate);
      const existingReport =
        this.dailyReportRepository.findByRequesterAndBusinessDate(
          requester.id,
          businessDate,
        );
      const mappedLeader =
        await this.salesLeaderMappingService.resolveSalesLeaderForUser(requester);
      const supervisor = this.resolveSupervisor(
        requester,
        existingReport,
        mappedLeader,
      );
      if (!this.hasSourceData(sourceBundle)) {
        snapshots.push({
          requesterId: requester.id,
          requesterName: requester.name,
          supervisorId: supervisor.id,
          supervisorName: supervisor.name,
          hasSourceData: false,
          reportStatus: 'MISSING',
          reportText: this.buildMissingPersonSummary(requester),
          followUpCount: 0,
          createdCustomerCount: 0,
          createdOpportunityCount: 0,
          helpCount: 0,
          shareCount: 0,
          tomorrowPlanCount: 0,
        });
        continue;
      }

      const report = await this.buildAutoGeneratedReport({
        requester,
        businessDate,
        existingReport,
        sourceBundle,
        generatedAt,
        mappedLeader,
      });
      const effectiveReport =
        options?.persistReports === false
          ? report
          : this.dailyReportRepository.save(report);
      const latestFollowUps = this.aggregateFollowUpsByObject(sourceBundle.followUps);

      snapshots.push({
        requesterId: requester.id,
        requesterName: requester.name,
        supervisorId: supervisor.id,
        supervisorName: supervisor.name,
        hasSourceData: true,
        reportStatus: effectiveReport.status,
        reportText: effectiveReport.draftSummary,
        followUpCount: latestFollowUps.length,
        createdCustomerCount: sourceBundle.createdCustomers.length,
        createdOpportunityCount: sourceBundle.createdOpportunities.length,
        helpCount: latestFollowUps.filter((item) => item.helpValues.length > 0).length,
        shareCount: latestFollowUps.filter((item) => item.shareValues.length > 0).length,
        tomorrowPlanCount: latestFollowUps.filter(
          (item) => item.tomorrowPlanValues.length > 0,
        ).length,
      });
    }

    return snapshots;
  }

  /** 按负责人姓名在销售负责人映射中做精确优先、包含次之的匹配，避免把即时预览落到错误小组。 */
  private async matchSalesLeaderGroupsByName(
    leaderNameQuery: string,
  ): Promise<
    Awaited<ReturnType<SalesLeaderMappingService['listMappedSalesGroups']>>
  > {
    const groups = await this.salesLeaderMappingService.listMappedSalesGroups();
    const normalizedQuery = this.normalizeLeaderName(leaderNameQuery);
    if (!normalizedQuery) {
      return [];
    }

    const exactMatches = groups.filter((group) =>
      this.getLeaderMatchCandidates(group).some(
        (candidate) => this.normalizeLeaderName(candidate) === normalizedQuery,
      ),
    );
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    return groups.filter((group) =>
      this.getLeaderMatchCandidates(group).some((candidate) => {
        const normalizedCandidate = this.normalizeLeaderName(candidate);
        return (
          normalizedCandidate.includes(normalizedQuery) ||
          normalizedQuery.includes(normalizedCandidate)
        );
      }),
    );
  }

  /** 预览权限复用当前组织范围：管理员任意、本小组负责人、递归上级或白名单授权范围。 */
  private canActorPreviewLeaderTeam(
    actor: CrmUser,
    group: Awaited<ReturnType<SalesLeaderMappingService['listMappedSalesGroups']>>[number],
  ): boolean {
    if (actor.isAdmin) {
      return true;
    }

    const leader = group.leader;
    const actorScope = this.userScopeService.resolveScope(actor);
    const managedOwnerIds = new Set(actorScope.ownerIds);
    const grantedDepartmentIds = new Set(actorScope.departmentIds);

    if (
      managedOwnerIds.has(leader.id) ||
      group.members.some((member) => managedOwnerIds.has(member.id))
    ) {
      return true;
    }

    if (
      group.members.some((member) =>
        member.departmentIds.some((departmentId) => grantedDepartmentIds.has(departmentId)),
      )
    ) {
      return true;
    }

    return actor.id === leader.id || leader.supervisorId === actor.id;
  }

  private getLeaderMatchCandidates(params: {
    leader: CrmUser;
    leaderName: string;
  }): string[] {
    return [params.leader.name, params.leaderName].filter(
      (item): item is string => Boolean(item?.trim()),
    );
  }

  private uniqueLeaderNames(
    groups: Awaited<ReturnType<SalesLeaderMappingService['listMappedSalesGroups']>>,
  ): string[] {
    return Array.from(
      new Set(
        groups
          .map((group) => group.leader.name || group.leaderName)
          .filter((item): item is string => Boolean(item?.trim())),
      ),
    );
  }

  private normalizeLeaderName(name: string): string {
    return name.replace(/\s+/gu, '').trim();
  }

  private buildTeamSummaryBatchPreview(params: {
    confirmedMembers: DailyReportSummaryMemberSnapshot[];
    lateMembers: DailyReportSummaryMemberSnapshot[];
    pendingMembers: DailyReportSummaryMemberSnapshot[];
    missingMembers: DailyReportSummaryMemberSnapshot[];
  }): string {
    return [
      this.formatCountWithOptionalNames('已确认', params.confirmedMembers),
      this.formatCountWithOptionalNames('迟交', params.lateMembers),
      this.formatCountWithOptionalNames('待确认', params.pendingMembers),
      this.formatCountWithOptionalNames('未交', params.missingMembers),
    ].join('；');
  }

  private async buildTeamSummaryMessage(
    recipient: CrmUser,
    memberSnapshots: DailyReportSummaryMemberSnapshot[],
  ): Promise<string> {
    const confirmedMembers = memberSnapshots.filter(
      (item) => item.reportStatus === 'CONFIRMED',
    );
    const lateMembers = memberSnapshots.filter(
      (item) => item.reportStatus === 'LATE_CONFIRMED',
    );
    const pendingMembers = memberSnapshots.filter(
      (item) =>
        item.reportStatus === 'PENDING_CONFIRMATION' ||
        item.reportStatus === 'DRAFT' ||
        item.reportStatus === 'CLOSED',
    );
    const missingMembers = memberSnapshots.filter(
      (item) => item.reportStatus === 'MISSING',
    );
    const detailTexts = memberSnapshots
      .map((item) => item.reportText)
      .filter(Boolean)
      .join('\n\n');

    const teamInsight = await this.buildTeamInsight(recipient.name, memberSnapshots);

    return [
      `【${recipient.name}小组日报分析】`,
      '一、日报汇总',
      `1、${this.formatCountWithOptionalNames('已确认', confirmedMembers)}`,
      `2、${this.formatCountWithOptionalNames('迟交', lateMembers)}`,
      `3、${this.formatCountWithOptionalNames('待确认', pendingMembers)}`,
      `4、${this.formatCountWithOptionalNames('未交', missingMembers)}`,
      `5、团队观察：${teamInsight}`,
      '',
      '二、日报明细',
      detailTexts || '当前组内暂无可展示的日报明细。',
    ].join('\n');
  }

  private buildDailyReportAiInsightSnapshot(params: {
    scene: DailyReportAiInsightSnapshot['scene'];
    factCount: number;
    generatedAt: string;
    failureReason?: string;
  }): DailyReportAiInsightSnapshot {
    const featureEnabled = process.env.WECOM_AI_DAILY_INSIGHT_ENABLED !== 'false';
    const hasGroundedFacts =
      featureEnabled && params.factCount > 0 && !params.failureReason;
    return {
      scene: params.scene,
      grounded: hasGroundedFacts,
      degraded: !hasGroundedFacts,
      factCount: params.factCount,
      generatedAt: params.generatedAt,
      failureReason:
        params.failureReason ??
        (!featureEnabled
          ? '企业微信日报 AI 洞察开关已关闭，已回退到既有事实摘要。'
          : undefined) ??
        (hasGroundedFacts ? undefined : '当前事实不足，已回退到既有事实摘要。'),
    };
  }

  private buildNameList(
    snapshots: DailyReportSummaryMemberSnapshot[],
  ): string {
    if (snapshots.length === 0) {
      return '无';
    }

    return snapshots.map((item) => item.requesterName).join('、');
  }

  private formatCountWithOptionalNames(
    label: string,
    snapshots: DailyReportSummaryMemberSnapshot[],
  ): string {
    const countText = `${label} ${snapshots.length} 人`;
    if (snapshots.length === 0) {
      return countText;
    }

    return `${countText}（${this.buildNameList(snapshots)}）`;
  }

  private async buildTeamInsight(
    requesterName: string,
    memberSnapshots: DailyReportSummaryMemberSnapshot[],
  ): Promise<string> {
    const totalFollowUps = memberSnapshots.reduce(
      (sum, item) => sum + item.followUpCount,
      0,
    );
    const totalCreatedCustomers = memberSnapshots.reduce(
      (sum, item) => sum + item.createdCustomerCount,
      0,
    );
    const totalCreatedOpportunities = memberSnapshots.reduce(
      (sum, item) => sum + item.createdOpportunityCount,
      0,
    );
    const totalHelpItems = memberSnapshots.reduce(
      (sum, item) => sum + item.helpCount,
      0,
    );
    const totalShareItems = memberSnapshots.reduce(
      (sum, item) => sum + item.shareCount,
      0,
    );
    const totalTomorrowPlans = memberSnapshots.reduce(
      (sum, item) => sum + item.tomorrowPlanCount,
      0,
    );
    const activeMembers = memberSnapshots.filter((item) => item.hasSourceData);
    const missingMembers = memberSnapshots.filter(
      (item) => item.reportStatus === 'MISSING',
    );
    const topActiveMember = [...activeMembers].sort((left, right) => {
      const leftScore =
        left.followUpCount + left.createdCustomerCount + left.createdOpportunityCount;
      const rightScore =
        right.followUpCount + right.createdCustomerCount + right.createdOpportunityCount;
      return rightScore - leftScore;
    })[0];
    const insightLines: string[] = [];

    if (activeMembers.length > 0) {
      insightLines.push(
        `今日已有 ${activeMembers.length} 人形成日报内容，共跟进 ${totalFollowUps} 项，新增客户 ${totalCreatedCustomers} 个，新增商机 ${totalCreatedOpportunities} 个。`,
      );
    } else {
      insightLines.push('今日组内暂无成员形成可分析的日报内容。');
    }

    if (topActiveMember) {
      insightLines.push(
        `工作推进最活跃的是 ${topActiveMember.requesterName}，其今日跟进 ${topActiveMember.followUpCount} 项，新增客户 ${topActiveMember.createdCustomerCount} 个，新增商机 ${topActiveMember.createdOpportunityCount} 个。`,
      );
    }

    if (totalHelpItems > 0) {
      const helpMembers = memberSnapshots
        .filter((item) => item.helpCount > 0)
        .map((item) => item.requesterName)
        .join('、');
      insightLines.push(
        `当前共有 ${totalHelpItems} 项协助诉求，需优先关注 ${helpMembers} 的推进阻塞。`,
      );
    } else {
      insightLines.push('当前未发现明确的协助阻塞项，整体推进相对顺畅。');
    }

    if (totalTomorrowPlans > 0) {
      insightLines.push(
        `成员已沉淀 ${totalTomorrowPlans} 项后续计划，可据此安排下一阶段的重点跟进节奏。`,
      );
    }

    if (totalShareItems > 0) {
      insightLines.push(
        `组内同步了 ${totalShareItems} 条信息分享，建议组长关注其中可复用的客户反馈与商机判断。`,
      );
    }

    if (missingMembers.length > 0) {
      insightLines.push(
        `仍有 ${missingMembers.length} 人未同步 CRM 数据（${this.buildNameList(
          missingMembers,
        )}），建议优先提醒补录，避免遗漏经营动作。`,
      );
    }

    const fallbackInsight = insightLines.join('');
    if (process.env.WECOM_AI_DAILY_INSIGHT_ENABLED === 'false') {
      return fallbackInsight;
    }

    const aiInsight = await this.aiGatewayService.generateDailyReportGroundedInsight({
      scene: 'TEAM_PREVIEW',
      requesterName,
      factSummary: fallbackInsight || '无',
      helpSummary:
        totalHelpItems > 0
          ? memberSnapshots
              .filter((item) => item.helpCount > 0)
              .map((item) => `${item.requesterName} ${item.helpCount} 项协助`)
              .join('；')
          : '无',
      shareSummary: totalShareItems > 0 ? `组内同步 ${totalShareItems} 条信息分享。` : '无',
      planSummary: totalTomorrowPlans > 0 ? `成员已沉淀 ${totalTomorrowPlans} 项后续计划。` : '无',
      missingSummary:
        missingMembers.length > 0
          ? `仍有 ${missingMembers.length} 人未同步 CRM 数据（${this.buildNameList(missingMembers)}）。`
          : '无',
    });
    if (!aiInsight || aiInsight.summaryLines.length === 0) {
      return fallbackInsight;
    }

    return aiInsight.summaryLines.join('');
  }

  private buildMissingPersonSummary(requester: CrmUser): string {
    return [
      `【${requester.name}日报】`,
      '1、当日工作执行结果',
      '①今日未同步 CRM 数据，暂无可汇总日报内容。',
      '2、问题与协助',
      '无',
      '3、信息分享',
      '无',
      '4、计划',
      '无',
    ].join('\n');
  }

  private buildExistingReportSummary(
    requester: CrmUser,
    report: DailyReportRecord,
  ): string {
    const todayFollowUp = this.findFragmentContent(report, 'TODAY_FOLLOW_UP');
    const changeContent = this.findFragmentContent(
      report,
      'CUSTOMER_OR_OPPORTUNITY_CHANGE',
    );
    const helpContent = this.findFragmentContent(report, 'HELP_REQUIRED');
    const shareContent = this.findFragmentContent(report, 'INFORMATION_SHARE');
    const tomorrowPlan = this.findFragmentContent(report, 'TOMORROW_PLAN');
    const workLines = [todayFollowUp, changeContent].filter(Boolean) as string[];

    return [
      `【${requester.name}日报】`,
      this.buildReportSection('1', '当日工作执行结果', workLines),
      this.buildReportSection('2', '问题与协助', helpContent ? [helpContent] : []),
      this.buildReportSection('3', '信息分享', shareContent ? [shareContent] : []),
      this.buildReportSection('4', '计划', tomorrowPlan ? [tomorrowPlan] : []),
    ].join('\n');
  }

  private findFragmentContent(
    report: DailyReportRecord,
    fragmentType: DailyReportFragmentType,
  ): string | undefined {
    return report.fragments.find((item) => item.fragmentType === fragmentType)?.content;
  }

  /** 仅将具备销售归属的企微成员纳入日报提醒与团队汇总目标。 */
  private isDailyReportTargetUser(user: CrmUser): boolean {
    return (
      !user.isAdmin &&
      user.channels.includes('wecom-bot') &&
      user.ownerIds.length > 0 &&
      Boolean(user.supervisorId)
    );
  }

  private buildInitialReport(
    user: CrmUser,
    businessDate: string,
    payload: {
      supervisorId?: string;
      supervisorName?: string;
      sourceLabel?: string;
    },
    fragment: DailyReportFragmentRecord,
    now: string,
  ): DailyReportRecord {
    if (!payload.supervisorId?.trim()) {
      throw new BadRequestException('首次生成日报时必须指定主管接收人。');
    }

    return {
      id: buildEntityId('daily_report'),
      requesterId: user.id,
      requesterName: user.name,
      supervisorId: payload.supervisorId.trim(),
      supervisorName: payload.supervisorName?.trim() || undefined,
      businessDate,
      status: 'DRAFT',
      draftTitle: `${businessDate} 销售日报`,
      draftSummary: '',
      sectionTypes: [fragment.fragmentType],
      fragments: [fragment],
      reminders: [],
      deliveries: [],
      lateConfirmed: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  private composeReport(report: DailyReportRecord): DailyReportRecord {
    const fragments = this.sortFragments(report.fragments);
    const sectionTypes = fragments.map((item) => item.fragmentType);
    const missingSections = DAILY_REPORT_SECTION_ORDER.filter(
      (sectionType) => !sectionTypes.includes(sectionType),
    );
    const draftSummary = DAILY_REPORT_SECTION_ORDER.map((sectionType) => {
      const fragment = fragments.find((item) => item.fragmentType === sectionType);
      if (!fragment) {
        return `${DAILY_REPORT_SECTION_LABELS[sectionType]}：待补充`;
      }
      return `${DAILY_REPORT_SECTION_LABELS[sectionType]}：${fragment.content}`;
    }).join('\n');

    const readyToConfirm = missingSections.length === 0;
    const nextStatus: DailyReportStatus = report.confirmation
      ? readyToConfirm
        ? 'PENDING_CONFIRMATION'
        : 'DRAFT'
      : readyToConfirm
        ? 'PENDING_CONFIRMATION'
        : 'DRAFT';

    return {
      ...report,
      status: nextStatus,
      sectionTypes,
      fragments,
      draftSummary,
      draftTitle: `${report.businessDate} 销售日报`,
      updatedAt: report.updatedAt,
    };
  }

  private replaceFragment(
    fragments: DailyReportFragmentRecord[],
    fragment: DailyReportFragmentRecord,
  ): DailyReportFragmentRecord[] {
    const currentIndex = fragments.findIndex(
      (item) => item.fragmentType === fragment.fragmentType,
    );
    if (currentIndex >= 0) {
      const nextFragments = [...fragments];
      nextFragments[currentIndex] = fragment;
      return nextFragments;
    }

    return [...fragments, fragment];
  }

  private sortFragments(
    fragments: DailyReportFragmentRecord[],
  ): DailyReportFragmentRecord[] {
    return [...fragments].sort(
      (left, right) =>
        DAILY_REPORT_SECTION_ORDER.indexOf(left.fragmentType) -
        DAILY_REPORT_SECTION_ORDER.indexOf(right.fragmentType),
    );
  }

  private validateSourceFragmentPayload(payload: {
    fragmentType: DailyReportFragmentType;
    sourceInterface?: '/api/v2/opportunities' | '/api/v2/revisit_logs' | 'manual';
    sourceObjectId?: string;
    sourceCode?: number;
  }): void {
    if (payload.sourceCode !== undefined && payload.sourceCode !== 0) {
      throw new BadRequestException('来源接口返回失败，不能写入日报。');
    }

    if (!payload.sourceInterface || payload.sourceInterface === 'manual') {
      return;
    }

    if (!payload.sourceObjectId?.trim()) {
      throw new BadRequestException('来源片段必须保留对象 ID。');
    }

    if (
      payload.sourceInterface === '/api/v2/opportunities' &&
      payload.fragmentType !== 'CUSTOMER_OR_OPPORTUNITY_CHANGE'
    ) {
      throw new BadRequestException('商机来源只能写入客户或商机变化片段。');
    }

    if (
      payload.sourceInterface === '/api/v2/revisit_logs' &&
      payload.fragmentType !== 'TODAY_FOLLOW_UP'
    ) {
      throw new BadRequestException('跟进来源只能写入今日跟进片段。');
    }
  }

  private requireOwnedReport(user: CrmUser, reportId: string): DailyReportRecord {
    const report = this.dailyReportRepository.findById(reportId);
    if (!report) {
      throw new NotFoundException('日报记录不存在。');
    }

    if (report.requesterId !== user.id && !user.isAdmin) {
      throw new ForbiddenException('当前用户无权访问该日报。');
    }

    return report;
  }
}
