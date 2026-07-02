import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type {
  AuditEventType,
  CrmUser,
  DailyReportAssistanceEscalationRecord,
  DailyReportRecord,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { ProactiveNotificationService } from '../notifications/proactive-notification.service';
import { SalesLeaderMappingService } from './sales-leader-mapping.service';
import { DailyReportAssistanceRepository } from './daily-report-assistance.repository';

interface AssistanceLineParseResult {
  helperQueryText: string;
  helperUser?: CrmUser;
  relatedContext?: string;
  issueText: string;
  blockedReason?: string;
}

interface AssistanceAggregationBucket {
  helperQueryText: string;
  helperUser?: CrmUser;
  relatedContexts: string[];
  issueTexts: string[];
  blockedReason?: string;
}

const NEGATIVE_HELP_VALUES = new Set([
  '无',
  '无。',
  '没有',
  '没有。',
  '暂无',
  '暂无。',
  '暂无协助',
  '暂无困难',
  '暂无困难或协助需求',
  '暂无困难或协助需求。',
  '无需协助',
  '无需协助。',
  '无需帮助',
  '无需帮助。',
]);

@Injectable()
export class DailyReportAssistanceEscalationService {
  constructor(
    private readonly dailyReportAssistanceRepository: DailyReportAssistanceRepository,
    private readonly proactiveNotificationService: ProactiveNotificationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly salesLeaderMappingService: SalesLeaderMappingService,
  ) {}

  /** 在日报正式对上送达时提取协助事项，并向协助人及其主管发送最小必要通知。 */
  async dispatchFormalEscalations(params: {
    actor: CrmUser;
    report: DailyReportRecord;
    trigger: 'SUPERVISOR_DELIVERY' | 'SUMMARY_BATCH';
    triggeredAt?: string;
  }): Promise<DailyReportAssistanceEscalationRecord[]> {
    const helpFragment = params.report.fragments.find(
      (item) => item.fragmentType === 'HELP_REQUIRED',
    );
    if (!helpFragment || !this.hasMeaningfulHelpContent(helpFragment.content)) {
      return [];
    }

    const users = await this.crmReadonlyService.listDailyReportUsers();
    const buckets = this.aggregateAssistanceBuckets(helpFragment.content, users);
    const escalationRecords: DailyReportAssistanceEscalationRecord[] = [];

    for (const bucket of buckets) {
      const fingerprint = this.buildFingerprint(params.report.id, bucket);
      const existingRecord =
        this.dailyReportAssistanceRepository.findByReportIdAndFingerprint(
          params.report.id,
          fingerprint,
        );
      const createdAt = existingRecord?.createdAt ?? params.triggeredAt ?? new Date().toISOString();
      const baseRecord: DailyReportAssistanceEscalationRecord = {
        id: existingRecord?.id ?? buildEntityId('daily_report_assistance'),
        reportId: params.report.id,
        businessDate: params.report.businessDate,
        requesterId: params.report.requesterId,
        requesterName: params.report.requesterName,
        sourceFragmentId: helpFragment.id,
        helperQueryText: bucket.helperQueryText,
        helperUserId: bucket.helperUser?.id,
        helperUserName: bucket.helperUser?.name,
        issueSummary: bucket.issueTexts.join('\n'),
        relatedContexts: [...bucket.relatedContexts],
        fingerprint,
        status: 'PENDING',
        auditEventIds: [...(existingRecord?.auditEventIds ?? [])],
        createdAt,
        updatedAt: params.triggeredAt ?? new Date().toISOString(),
      };

      if (!bucket.helperUser) {
        escalationRecords.push(
          this.blockEscalation(params.actor, baseRecord, bucket.blockedReason),
        );
        continue;
      }

      if (bucket.helperUser.id === params.report.requesterId) {
        escalationRecords.push(
          this.blockEscalation(
            params.actor,
            baseRecord,
            '协助人解析结果与日报提报人相同，已阻断自通知。',
          ),
        );
        continue;
      }

      const helperSupervisor = await this.resolveSupervisorForUser(bucket.helperUser);
      const notificationResult = await this.dispatchEscalationNotifications({
        actor: params.actor,
        report: params.report,
        record: {
          ...baseRecord,
          helperSupervisorUserId: helperSupervisor?.id,
          helperSupervisorUserName: helperSupervisor?.name,
        },
        helperUser: bucket.helperUser,
        helperSupervisor,
      });
      escalationRecords.push(notificationResult);
    }

    return escalationRecords;
  }

  /** 按日报 ID 返回已经生成的协助升级记录，便于测试和调试查看。 */
  listByReportId(reportId: string): DailyReportAssistanceEscalationRecord[] {
    return this.dailyReportAssistanceRepository.listByReportId(reportId);
  }

  /** 判断“问题与协助”片段是否包含真正需要升级的协助语义。 */
  private hasMeaningfulHelpContent(content?: string): boolean {
    if (!content) {
      return false;
    }

    const normalizedLines = this.splitHelpContent(content).filter((item) =>
      this.isMeaningfulHelpLine(item),
    );
    return normalizedLines.length > 0;
  }

  /** 将帮助片段拆成行，并合并相同协助人的多条事项。 */
  private aggregateAssistanceBuckets(
    content: string,
    users: CrmUser[],
  ): AssistanceAggregationBucket[] {
    const bucketMap = new Map<string, AssistanceAggregationBucket>();

    for (const rawLine of this.splitHelpContent(content)) {
      if (!this.isMeaningfulHelpLine(rawLine)) {
        continue;
      }

      const parsedLine = this.parseAssistanceLine(rawLine, users);
      const key = parsedLine.helperUser
        ? `resolved:${parsedLine.helperUser.id}`
        : `blocked:${this.normalizeText(parsedLine.helperQueryText || parsedLine.issueText)}`;
      const current =
        bucketMap.get(key) ??
        {
          helperQueryText: parsedLine.helperQueryText,
          helperUser: parsedLine.helperUser,
          relatedContexts: [],
          issueTexts: [],
          blockedReason: parsedLine.blockedReason,
        };

      if (parsedLine.relatedContext) {
        current.relatedContexts = this.pushUnique(current.relatedContexts, parsedLine.relatedContext);
      }
      current.issueTexts = this.pushUnique(current.issueTexts, parsedLine.issueText);
      current.blockedReason = current.blockedReason ?? parsedLine.blockedReason;
      bucketMap.set(key, current);
    }

    return [...bucketMap.values()];
  }

  /** 从单行协助文本中提取上下文、问题摘要和明确协助人。 */
  private parseAssistanceLine(
    rawLine: string,
    users: CrmUser[],
  ): AssistanceLineParseResult {
    const normalizedLine = rawLine.replace(/\s+/gu, ' ').trim();
    const { relatedContext, issueText } = this.extractContextAndIssue(normalizedLine);
    const helperQueryText = this.extractHelperQueryText(issueText);
    const exactMatchedUsers = helperQueryText
      ? users.filter(
          (item) => this.normalizeText(item.name) === this.normalizeText(helperQueryText),
        )
      : [];
    const fuzzyMatchedUsers = users.filter((item) =>
      this.normalizeText(issueText).includes(this.normalizeText(item.name)),
    );
    const matchedUsers =
      exactMatchedUsers.length === 1
        ? exactMatchedUsers
        : [...new Map(fuzzyMatchedUsers.map((item) => [item.id, item])).values()];

    if (matchedUsers.length === 1) {
      return {
        helperQueryText: helperQueryText || matchedUsers[0].name,
        helperUser: matchedUsers[0],
        relatedContext,
        issueText,
      };
    }

    return {
      helperQueryText: helperQueryText || normalizedLine,
      relatedContext,
      issueText,
      blockedReason:
        matchedUsers.length > 1
          ? '协助人命中多个内部用户，无法唯一识别。'
          : '协助事项缺少可唯一识别的内部协助人。',
    };
  }

  /** 发送协助人及其主管通知，并对与日报主管重叠的目标去重。 */
  private async dispatchEscalationNotifications(params: {
    actor: CrmUser;
    report: DailyReportRecord;
    record: DailyReportAssistanceEscalationRecord;
    helperUser: CrmUser;
    helperSupervisor?: CrmUser;
  }): Promise<DailyReportAssistanceEscalationRecord> {
    const auditEventIds = [...params.record.auditEventIds];
    const alreadyCoveredRecipientIds = new Set<string>([params.report.supervisorId]);
    let helperTaskId: string | undefined;
    let helperSupervisorTaskId: string | undefined;
    let helperSent = false;
    let helperSupervisorSent = false;
    let failureReasons: string[] = [];

    if (alreadyCoveredRecipientIds.has(params.helperUser.id)) {
      const auditId = this.createAuditEvent(
        params.actor,
        'DAILY_REPORT_ASSISTANCE_SENT',
        '协助人已包含在日报正式接收人中，已跳过额外发送。',
        {
          reportId: params.report.id,
          helperUserId: params.helperUser.id,
          helperUserName: params.helperUser.name,
          trigger: 'REPORT_RECIPIENT_ALREADY_COVERED',
        },
      );
      auditEventIds.push(auditId);
      helperSent = true;
    } else {
      const helperTask = await this.proactiveNotificationService.dispatch({
        actor: params.actor,
        sceneKey: 'daily-report.assistance-target',
        title: `${params.report.businessDate} 协助事项`,
        audience: {
          type: 'CRM_USER',
          crmUserIds: [params.helperUser.id],
        },
        dedupeKey: `${params.record.reportId}:${params.helperUser.id}:assistance-target:${params.record.fingerprint}`,
        metadata: {
          notificationLabel: '【协助提醒】',
          suppressActionHints: true,
        },
        recipientGuard: ({ recipient }) => this.guardRecipient(recipient),
        message: {
          msgtype: 'markdown',
          content: this.buildHelperMessage(params.report, params.helperUser, params.record),
        },
      });
      helperTaskId = helperTask.id;
      alreadyCoveredRecipientIds.add(params.helperUser.id);
      if (this.isSuccessfulNotification(helperTask.status)) {
        helperSent = true;
        const auditId = this.createAuditEvent(
          params.actor,
          'DAILY_REPORT_ASSISTANCE_SENT',
          '日报协助事项已发送给协助人。',
          {
            reportId: params.report.id,
            helperUserId: params.helperUser.id,
            helperUserName: params.helperUser.name,
            helperNotificationTaskId: helperTask.id,
          },
        );
        auditEventIds.push(auditId);
      } else {
        failureReasons = this.pushUnique(
          failureReasons,
          helperTask.failureReason ?? '协助人通知发送失败。',
        );
      }
    }

    if (!params.helperSupervisor) {
      failureReasons = this.pushUnique(
        failureReasons,
        '未能解析协助人的当前主管，已跳过主管通知。',
      );
    } else if (alreadyCoveredRecipientIds.has(params.helperSupervisor.id)) {
      const auditId = this.createAuditEvent(
        params.actor,
        'DAILY_REPORT_ASSISTANCE_SENT',
        '协助人主管已包含在当前日报正式接收人中，已跳过额外发送。',
        {
          reportId: params.report.id,
          helperSupervisorUserId: params.helperSupervisor.id,
          helperSupervisorUserName: params.helperSupervisor.name,
          trigger: 'REPORT_RECIPIENT_ALREADY_COVERED',
        },
      );
      auditEventIds.push(auditId);
      helperSupervisorSent = true;
    } else {
      const supervisorTask = await this.proactiveNotificationService.dispatch({
        actor: params.actor,
        sceneKey: 'daily-report.assistance-supervisor',
        title: `${params.report.businessDate} 成员协助事项`,
        audience: {
          type: 'CRM_USER',
          crmUserIds: [params.helperSupervisor.id],
        },
        dedupeKey: `${params.record.reportId}:${params.helperSupervisor.id}:assistance-supervisor:${params.record.fingerprint}`,
        metadata: {
          notificationLabel: '【协助升级】',
          suppressActionHints: true,
        },
        recipientGuard: ({ recipient }) => this.guardRecipient(recipient),
        message: {
          msgtype: 'markdown',
          content: this.buildHelperSupervisorMessage(
            params.report,
            params.helperUser,
            params.helperSupervisor,
            params.record,
          ),
        },
      });
      helperSupervisorTaskId = supervisorTask.id;
      if (this.isSuccessfulNotification(supervisorTask.status)) {
        helperSupervisorSent = true;
        const auditId = this.createAuditEvent(
          params.actor,
          'DAILY_REPORT_ASSISTANCE_SENT',
          '日报协助事项已发送给协助人主管。',
          {
            reportId: params.report.id,
            helperSupervisorUserId: params.helperSupervisor.id,
            helperSupervisorUserName: params.helperSupervisor.name,
            helperSupervisorNotificationTaskId: supervisorTask.id,
          },
        );
        auditEventIds.push(auditId);
      } else {
        failureReasons = this.pushUnique(
          failureReasons,
          supervisorTask.failureReason ?? '协助人主管通知发送失败。',
        );
      }
    }

    const nextRecord: DailyReportAssistanceEscalationRecord = {
      ...params.record,
      helperNotificationTaskId: helperTaskId,
      helperSupervisorNotificationTaskId: helperSupervisorTaskId,
      auditEventIds,
      status:
        helperSent && helperSupervisorSent
          ? 'SENT'
          : helperSent || helperSupervisorSent
            ? 'PARTIAL_FAILED'
            : 'FAILED',
      failureReason: failureReasons.length > 0 ? failureReasons.join('；') : undefined,
      updatedAt: new Date().toISOString(),
    };

    if (nextRecord.status === 'FAILED') {
      const auditId = this.createAuditEvent(
        params.actor,
        'DAILY_REPORT_ASSISTANCE_FAILED',
        nextRecord.failureReason ?? '日报协助通知发送失败。',
        {
          reportId: params.report.id,
          helperUserId: params.helperUser.id,
          helperUserName: params.helperUser.name,
          helperSupervisorUserId: params.helperSupervisor?.id,
          helperSupervisorUserName: params.helperSupervisor?.name,
        },
      );
      nextRecord.auditEventIds = this.pushUnique(nextRecord.auditEventIds, auditId);
    } else if (nextRecord.status === 'PARTIAL_FAILED') {
      const auditId = this.createAuditEvent(
        params.actor,
        'DAILY_REPORT_ASSISTANCE_FAILED',
        nextRecord.failureReason ?? '日报协助通知部分失败。',
        {
          reportId: params.report.id,
          helperUserId: params.helperUser.id,
          helperUserName: params.helperUser.name,
          helperSupervisorUserId: params.helperSupervisor?.id,
          helperSupervisorUserName: params.helperSupervisor?.name,
        },
      );
      nextRecord.auditEventIds = this.pushUnique(nextRecord.auditEventIds, auditId);
    }

    return this.dailyReportAssistanceRepository.save(nextRecord);
  }

  /** 将无法识别或不允许发送的协助事项记录为阻断结果，并保留审计关联。 */
  private blockEscalation(
    actor: CrmUser,
    record: DailyReportAssistanceEscalationRecord,
    blockedReason = '协助事项缺少可唯一识别的内部协助人。',
  ): DailyReportAssistanceEscalationRecord {
    const auditId = this.createAuditEvent(
      actor,
      'DAILY_REPORT_ASSISTANCE_BLOCKED',
      blockedReason,
      {
        reportId: record.reportId,
        helperQueryText: record.helperQueryText,
        requesterId: record.requesterId,
      },
    );
    const blockedRecord: DailyReportAssistanceEscalationRecord = {
      ...record,
      status: 'BLOCKED',
      failureReason: blockedReason,
      auditEventIds: this.pushUnique(record.auditEventIds, auditId),
      updatedAt: new Date().toISOString(),
    };
    return this.dailyReportAssistanceRepository.save(blockedRecord);
  }

  /** 解析协助人的当前主管，优先走当前用户快照，其次回退销售负责人映射。 */
  private async resolveSupervisorForUser(
    user: CrmUser,
  ): Promise<CrmUser | undefined> {
    if (user.supervisorId) {
      const directSupervisor = await this.crmReadonlyService.getUserById(user.supervisorId);
      if (directSupervisor) {
        return directSupervisor;
      }
    }

    const mappedLeader = await this.salesLeaderMappingService.resolveSalesLeaderForUser(
      user,
    );
    if (!mappedLeader) {
      return undefined;
    }

    return await this.crmReadonlyService.getUserById(mappedLeader.id);
  }

  /** 构造发给协助人的最小必要通知文案。 */
  private buildHelperMessage(
    report: DailyReportRecord,
    helperUser: CrmUser,
    record: DailyReportAssistanceEscalationRecord,
  ): string {
    return [
      `${helperUser.name}，你好。`,
      `${report.requesterName} 在 ${report.businessDate} 的日报中提到需要你协助推进以下事项：`,
      '',
      ...this.buildIssueLines(record),
      '',
      `提报人：${report.requesterName}`,
      '辛苦你优先关注一下，如需补充背景，可直接联系提报人。',
    ].join('\n');
  }

  /** 构造发给协助人主管的最小必要升级文案。 */
  private buildHelperSupervisorMessage(
    report: DailyReportRecord,
    helperUser: CrmUser,
    helperSupervisor: CrmUser,
    record: DailyReportAssistanceEscalationRecord,
  ): string {
    return [
      `${helperSupervisor.name}，你好。`,
      `${report.requesterName} 在 ${report.businessDate} 的日报中，请你的成员 ${helperUser.name} 协助推进以下事项：`,
      '',
      ...this.buildIssueLines(record),
      '',
      `提报人：${report.requesterName}`,
      `协助成员：${helperUser.name}`,
      '辛苦你同步关注一下推进情况。',
    ].join('\n');
  }

  /** 将聚合后的上下文与问题摘要展开成可直接发送的编号条目。 */
  private buildIssueLines(
    record: DailyReportAssistanceEscalationRecord,
  ): string[] {
    const issueTexts = record.issueSummary
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    return issueTexts.map((item, index) => {
      const contextText = record.relatedContexts[index] ?? record.relatedContexts[0];
      if (contextText) {
        return `${index + 1}）${contextText}：${item}`;
      }
      return `${index + 1}）${item}`;
    });
  }

  /** 根据文本内容提取候选协助人称呼，避免直接把整行摘要当作姓名。 */
  private extractHelperQueryText(text: string): string {
    const patterns = [
      /(?:需要|请|麻烦)([^，。；;\n]{1,12}?)(?:协助|支持|配合|帮忙)/u,
      /([^，。；;\n]{1,12}?)(?:协助|支持|配合|帮忙)/u,
    ];

    for (const pattern of patterns) {
      const matched = text.match(pattern)?.[1]?.trim();
      if (matched) {
        return matched.replace(/^(同事|老师|伙伴|成员)/u, '').trim();
      }
    }

    return text.trim();
  }

  /** 从“商机：问题摘要”这类文本中拆出相关对象上下文和纯问题摘要。 */
  private extractContextAndIssue(text: string): {
    relatedContext?: string;
    issueText: string;
  } {
    const separatorIndex = text.indexOf('：') >= 0 ? text.indexOf('：') : text.indexOf(':');
    if (separatorIndex <= 0) {
      return {
        issueText: text,
      };
    }

    const prefix = text.slice(0, separatorIndex).trim();
    const suffix = text.slice(separatorIndex + 1).trim();
    if (/^(客户|商机|项目)/u.test(prefix)) {
      return {
        relatedContext: prefix,
        issueText: suffix || text,
      };
    }

    return {
      issueText: text,
    };
  }

  /** 把帮助片段拆成独立行，兼容自动汇总与手工录入场景。 */
  private splitHelpContent(content: string): string[] {
    return content
      .split(/\r?\n/gu)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /** 判断某一行是否属于真实协助诉求，而不是“无/暂无”类兜底文案。 */
  private isMeaningfulHelpLine(line: string): boolean {
    const normalized = line.replace(/\s+/gu, ' ').trim();
    if (!normalized) {
      return false;
    }

    const compact = normalized.replace(/[；;。,.，]/gu, '');
    if (NEGATIVE_HELP_VALUES.has(normalized) || NEGATIVE_HELP_VALUES.has(compact)) {
      return false;
    }

    return !/^(无|暂无|没有|无需)/u.test(normalized);
  }

  /** 为同一日报内的同一协助人生成稳定指纹，供重复触发时幂等复用。 */
  private buildFingerprint(
    reportId: string,
    bucket: AssistanceAggregationBucket,
  ): string {
    return createHash('sha1')
      .update(
        [
          reportId,
          bucket.helperUser?.id ?? bucket.helperQueryText,
          ...bucket.relatedContexts,
          ...bucket.issueTexts,
        ].join('|'),
      )
      .digest('hex');
  }

  /** 对接收人做最小权限校验，避免对未接入企微会话的内部账号发送协助通知。 */
  private guardRecipient(
    recipient?: CrmUser,
  ): { allowed: boolean; reason?: string } {
    if (!recipient) {
      return {
        allowed: false,
        reason: '当前接收人不存在，无法发送协助通知。',
      };
    }

    if (!recipient.channels.includes('wecom-bot')) {
      return {
        allowed: false,
        reason: '当前接收人未开通企业微信机器人通道。',
      };
    }

    return { allowed: true };
  }

  /** 统一写入协助升级审计并返回事件 ID，便于模型留存关联关系。 */
  private createAuditEvent(
    actor: CrmUser,
    eventType: AuditEventType,
    outcome: string,
    sessionSnapshot?: Record<string, unknown>,
  ): string {
    const eventId = buildEntityId('audit');
    this.auditEventRepository.create({
      id: eventId,
      eventType,
      actorId: actor.id,
      actorRoleIds: actor.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(actor),
      sessionSnapshot,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome,
      failureReason:
        eventType === 'DAILY_REPORT_ASSISTANCE_BLOCKED' ||
        eventType === 'DAILY_REPORT_ASSISTANCE_FAILED'
          ? outcome
          : undefined,
      createdAt: new Date().toISOString(),
    });
    return eventId;
  }

  /** 判断主动通知底座返回结果是否可视为本次协助通知已处理成功。 */
  private isSuccessfulNotification(status: string): boolean {
    return status === 'SENT' || status === 'DEDUPED' || status === 'PARTIAL_FAILED';
  }

  /** 保持字符串集合去重，避免一条日报内重复堆叠相同事项。 */
  private pushUnique(values: string[], nextValue: string): string[] {
    const normalizedValue = nextValue.trim();
    if (!normalizedValue || values.includes(normalizedValue)) {
      return values;
    }

    return [...values, normalizedValue];
  }

  /** 归一化字符串，用于人员匹配和聚合键生成。 */
  private normalizeText(value: string): string {
    return value.replace(/\s+/gu, '').trim();
  }
}
