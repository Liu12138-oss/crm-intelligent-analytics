import { Injectable } from '@nestjs/common';
import { buildEntityId } from '../../shared/utils/id.util';
import type {
  WecomOfficialDepartmentItem,
  WecomOfficialUserListItem,
} from './wecom-official-directory.types';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import type {
  WecomSyncCheckpointRecord,
  WecomSyncResourceType,
  WecomSyncRunRecord,
} from '../../shared/types/domain';
import { WecomOfficialDirectoryClient } from './wecom-official-directory.client';
import { WecomSyncedDepartmentRepository } from './wecom-synced-department.repository';
import { WecomSyncedUserRepository } from './wecom-synced-user.repository';
import { WecomSyncCheckpointRepository } from './wecom-sync-checkpoint.repository';
import { WecomSyncRunRepository } from './wecom-sync-run.repository';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { SqlAuditContextService } from '../audit/sql-audit-context.service';
import {
  CrmWecomBindingResult,
  CrmWecomIdentityRepository,
} from './crm-wecom-identity.repository';

interface WecomDepartmentScope {
  rootDepartment: WecomOfficialDepartmentItem;
  scopedDepartments: WecomOfficialDepartmentItem[];
  scopedDepartmentIds: number[];
}

interface WecomUserSyncSummary {
  users: WecomOfficialUserListItem[];
  scannedDepartmentCount: number;
  wxUserUpsertedCount: number;
  wxUserMapCreatedCount: number;
  wxUserMapUpdatedCount: number;
  missingContactCount: number;
  unmatchedCount: number;
  conflictCount: number;
}

@Injectable()
export class WecomDirectorySyncService {
  private runningResources = new Set<WecomSyncResourceType>();

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly wecomOfficialDirectoryClient: WecomOfficialDirectoryClient,
    private readonly crmWecomIdentityRepository: CrmWecomIdentityRepository,
    private readonly wecomSyncedDepartmentRepository: WecomSyncedDepartmentRepository,
    private readonly wecomSyncedUserRepository: WecomSyncedUserRepository,
    private readonly wecomSyncCheckpointRepository: WecomSyncCheckpointRepository,
    private readonly wecomSyncRunRepository: WecomSyncRunRepository,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly sqlAuditContextService: SqlAuditContextService,
  ) {}

  async runSync(resourceType: WecomSyncResourceType): Promise<WecomSyncRunRecord> {
    if (this.runningResources.has(resourceType)) {
      throw new Error(`当前 ${resourceType} 同步任务已在执行中。`);
    }

    if (resourceType === 'user-dept-change') {
      return this.runUnsupportedResource(resourceType);
    }

    const config = this.localRuntimeConfigService.getWecomDirectorySyncConfig();
    const checkpoint =
      this.wecomSyncCheckpointRepository.findByResourceType(resourceType);
    const fromCursor = checkpoint?.committedCursor ?? '0';
    const runRecord: WecomSyncRunRecord = {
      id: buildEntityId('sync_run'),
      resourceType,
      runMode: checkpoint ? 'incremental' : 'bootstrap',
      startedAt: new Date().toISOString(),
      status: 'RUNNING',
      pageCount: 0,
      itemCount: 0,
      fromCursor,
      wxUserUpsertedCount: 0,
      wxUserMapCreatedCount: 0,
      wxUserMapUpdatedCount: 0,
      missingContactCount: 0,
      unmatchedCount: 0,
      conflictCount: 0,
    };
    this.wecomSyncRunRepository.save(runRecord);

    if (!config.enabled) {
      runRecord.finishedAt = new Date().toISOString();
      runRecord.status = 'FAILED';
      runRecord.failureReason = '企业微信官方通讯录同步配置不完整。';
      this.wecomSyncRunRepository.save(runRecord);
      throw new Error(runRecord.failureReason);
    }

    this.runningResources.add(resourceType);
    this.auditTriggered(runRecord);

    const workingCheckpoint: WecomSyncCheckpointRecord = checkpoint ?? {
      id: buildEntityId('sync_ckpt'),
      resourceType,
      candidateCursor: fromCursor,
      committedCursor: fromCursor,
      status: 'RUNNING',
      updatedAt: new Date().toISOString(),
    };

    try {
      return await this.sqlAuditContextService.run(
        {
          actorId: 'system_sync',
          actorRoleIds: [],
          requestId: `wecom-sync:${runRecord.id}`,
          moduleKey: 'wecom-directory-sync',
          programName: 'WecomDirectorySyncService.runSync',
        },
        async () => {
          const accessToken = await this.wecomOfficialDirectoryClient.getAccessToken();
          const departmentScope = await this.resolveDepartmentScope(
            accessToken,
            config.rootDepartmentName,
          );

          if (resourceType === 'department') {
            this.persistDepartmentMirror(departmentScope);
            runRecord.pageCount = 1;
            runRecord.itemCount = departmentScope.scopedDepartmentIds.length;
          } else {
            const wxOrganizationId =
              await this.crmWecomIdentityRepository.resolveOrCreateWxOrganizationId();
            this.persistDepartmentMirror(departmentScope);
            const userSyncSummary = await this.syncUsers(
              accessToken,
              departmentScope,
              wxOrganizationId,
            );
            runRecord.pageCount = userSyncSummary.scannedDepartmentCount;
            runRecord.itemCount = userSyncSummary.users.length;
            runRecord.wxUserUpsertedCount = userSyncSummary.wxUserUpsertedCount;
            runRecord.wxUserMapCreatedCount = userSyncSummary.wxUserMapCreatedCount;
            runRecord.wxUserMapUpdatedCount = userSyncSummary.wxUserMapUpdatedCount;
            runRecord.missingContactCount = userSyncSummary.missingContactCount;
            runRecord.unmatchedCount = userSyncSummary.unmatchedCount;
            runRecord.conflictCount = userSyncSummary.conflictCount;
          }

          runRecord.finishedAt = new Date().toISOString();
          runRecord.status =
            runRecord.itemCount > 0 ? 'SUCCEEDED' : 'SUCCEEDED_WITHOUT_CHANGES';
          runRecord.toCursor = String(Date.now());
          this.wecomSyncRunRepository.save(runRecord);

          this.wecomSyncCheckpointRepository.save({
            ...workingCheckpoint,
            candidateCursor: runRecord.toCursor,
            committedCursor: runRecord.toCursor,
            lastAttemptAt: runRecord.startedAt,
            lastSuccessAt: runRecord.finishedAt,
            lastSuccessPage: runRecord.pageCount,
            lastFailureReason: undefined,
            status: runRecord.status,
            updatedAt: new Date().toISOString(),
          });
          this.auditFinished(runRecord);
          return runRecord;
        },
      );
    } catch (error) {
      runRecord.finishedAt = new Date().toISOString();
      runRecord.status = 'FAILED';
      runRecord.failureReason =
        error instanceof Error ? error.message : '企业微信官方目录同步失败。';
      this.wecomSyncRunRepository.save(runRecord);
      this.wecomSyncCheckpointRepository.save({
        ...workingCheckpoint,
        lastAttemptAt: runRecord.startedAt,
        lastFailureReason: runRecord.failureReason,
        status: 'FAILED',
        updatedAt: new Date().toISOString(),
      });
      this.auditFinished(runRecord);
      throw error;
    } finally {
      this.runningResources.delete(resourceType);
    }
  }

  async runAllSync(): Promise<{ runs: WecomSyncRunRecord[] }> {
    const runs: WecomSyncRunRecord[] = [];
    for (const resourceType of ['department', 'user'] as const) {
      runs.push(await this.runSync(resourceType));
    }
    return { runs };
  }

  async getSyncStatus(userid?: string): Promise<Record<string, unknown>> {
    const checkpoints = this.wecomSyncCheckpointRepository.list();
    const runs = this.wecomSyncRunRepository.list().slice(0, 10);
    const response: Record<string, unknown> = {
      resourceSummaries: checkpoints.map((item) => ({
        resourceType: item.resourceType,
        status: item.status,
        committedCursor: item.committedCursor,
        candidateCursor: item.candidateCursor,
        lastSuccessAt: item.lastSuccessAt,
        lastFailureReason: item.lastFailureReason,
      })),
      checkpoints,
      runs,
    };

    if (userid?.trim()) {
      response.userDiagnostic =
        await this.crmWecomIdentityRepository.getBindingDiagnosticByUserid(
          userid.trim(),
        );
    }

    return response;
  }

  private async resolveDepartmentScope(
    accessToken: string,
    rootDepartmentName: string,
  ): Promise<WecomDepartmentScope> {
    const response = await this.wecomOfficialDirectoryClient.listDepartments(
      accessToken,
    );
    const departments = response.department ?? [];
    const rootDepartment = departments.find(
      (item) => item.name === rootDepartmentName,
    );
    if (!rootDepartment) {
      throw new Error(
        `企业微信官方目录中未找到目标根部门：${rootDepartmentName}`,
      );
    }

    const simpleListResponse =
      await this.wecomOfficialDirectoryClient.listDepartmentSimpleIds(
        accessToken,
        rootDepartment.id,
      );
    const scopedDepartmentIds = [
      rootDepartment.id,
      ...(simpleListResponse.department_id ?? []).map((item) => item.id),
    ].filter((item, index, list) => list.indexOf(item) === index);
    const scopedDepartments = departments.filter((item) =>
      scopedDepartmentIds.includes(item.id),
    );

    return {
      rootDepartment,
      scopedDepartments,
      scopedDepartmentIds,
    };
  }

  private persistDepartmentMirror(scope: WecomDepartmentScope): void {
    for (const item of scope.scopedDepartments) {
      this.wecomSyncedDepartmentRepository.save({
        id: buildEntityId('sync_dept'),
        wxDepartmentId: String(item.id),
        departmentName: item.name,
        departmentAlias: item.name_en,
        parentDepartmentId:
          item.parentid !== undefined ? String(item.parentid) : undefined,
        leaderUserids: [...(item.department_leader ?? [])],
        organizationExternalId: String(scope.rootDepartment.id),
        displayOrder: item.order,
        isParent: scope.scopedDepartments.some(
          (child) => child.parentid === item.id,
        ),
        state: 'open',
        rawPayload: item as unknown as Record<string, unknown>,
        syncStatus: 'ACTIVE',
        lastSyncedAt: new Date().toISOString(),
      });
    }
  }

  private async syncUsers(
    accessToken: string,
    scope: WecomDepartmentScope,
    wxOrganizationId: string,
  ): Promise<WecomUserSyncSummary> {
    const byUserid = new Map<string, WecomOfficialUserListItem>();

    for (const departmentId of scope.scopedDepartmentIds) {
      const response =
        await this.wecomOfficialDirectoryClient.listUsersByDepartment(
          accessToken,
          departmentId,
        );
      const users = response.userlist ?? [];

      for (const user of users) {
        const current = byUserid.get(user.userid);
        const enrichedUser =
          !user.mobile || !user.email
            ? await this.enrichWecomUser(accessToken, user)
            : user;
        byUserid.set(
          user.userid,
          this.mergeWecomUsers(current, enrichedUser),
        );
      }
    }

    const users = [...byUserid.values()];
    let wxUserUpsertedCount = 0;
    let wxUserMapCreatedCount = 0;
    let wxUserMapUpdatedCount = 0;
    let missingContactCount = 0;
    let unmatchedCount = 0;
    let conflictCount = 0;

    for (const user of users) {
      const upsertResult = await this.crmWecomIdentityRepository.upsertWxUser({
        wxOrganizationId,
        user,
      });
      wxUserUpsertedCount += 1;

      this.wecomSyncedUserRepository.save({
        id: buildEntityId('sync_user'),
        wxUserid: user.userid,
        originUserid: user.userid,
        userName: user.name,
        userAlias: user.alias,
        mobile: user.mobile,
        email: user.email,
        tel: user.telephone,
        gender: user.gender,
        position: user.position,
        avatar: user.avatar,
        status:
          user.status !== undefined ? String(user.status) : undefined,
        organizationExternalId: wxOrganizationId,
        primaryDepartmentId:
          user.main_department !== undefined
            ? String(user.main_department)
            : user.department?.[0] !== undefined
              ? String(user.department[0])
              : undefined,
        departmentIds: (user.department ?? []).map((item) => String(item)),
        directLeaderUserids: [...(user.direct_leader ?? [])],
        rawPayload: user as unknown as Record<string, unknown>,
        syncStatus: 'ACTIVE',
        lastSyncedAt: new Date().toISOString(),
      });

      const bindingResult =
        await this.crmWecomIdentityRepository.syncWxUserMap({
          wxOrganizationId,
          wxUserId: upsertResult.wxUserId,
          mobile: user.mobile,
          email: user.email,
        });
      this.accumulateBindingSummary(bindingResult, {
        incCreated: () => {
          wxUserMapCreatedCount += 1;
        },
        incUpdated: () => {
          wxUserMapUpdatedCount += 1;
        },
        incMissingContact: () => {
          missingContactCount += 1;
        },
        incUnmatched: () => {
          unmatchedCount += 1;
        },
        incConflict: () => {
          conflictCount += 1;
        },
      });
    }

    return {
      users,
      scannedDepartmentCount: scope.scopedDepartmentIds.length,
      wxUserUpsertedCount,
      wxUserMapCreatedCount,
      wxUserMapUpdatedCount,
      missingContactCount,
      unmatchedCount,
      conflictCount,
    };
  }

  private mergeWecomUsers(
    current: WecomOfficialUserListItem | undefined,
    incoming: WecomOfficialUserListItem,
  ): WecomOfficialUserListItem {
    if (!current) {
      return {
        ...incoming,
        department: [...(incoming.department ?? [])],
      };
    }

    const mergedDepartments = [
      ...(current.department ?? []),
      ...(incoming.department ?? []),
    ].filter((item, index, list) => list.indexOf(item) === index);

    return {
      ...current,
      ...incoming,
      department: mergedDepartments,
      mobile: incoming.mobile ?? current.mobile,
      email: incoming.email ?? current.email,
      telephone: incoming.telephone ?? current.telephone,
      position: incoming.position ?? current.position,
      main_department: incoming.main_department ?? current.main_department,
      direct_leader: this.mergeStringArrays(
        current.direct_leader,
        incoming.direct_leader,
      ),
      avatar: incoming.avatar ?? current.avatar,
      extattr: incoming.extattr ?? current.extattr,
    };
  }

  private async enrichWecomUser(
    accessToken: string,
    user: WecomOfficialUserListItem,
  ): Promise<WecomOfficialUserListItem> {
    const detail = await this.wecomOfficialDirectoryClient.getUserDetail(
      accessToken,
      user.userid,
    );

    return {
      ...user,
      mobile: detail.mobile ?? user.mobile,
      email: detail.email ?? user.email,
      telephone: detail.telephone ?? user.telephone,
      alias: detail.alias ?? user.alias,
      position: detail.position ?? user.position,
      status: detail.status ?? user.status,
      main_department: detail.main_department ?? user.main_department,
      direct_leader: detail.direct_leader ?? user.direct_leader,
      avatar: detail.avatar ?? user.avatar,
      extattr: detail.extattr ?? user.extattr,
      english_name: detail.english_name ?? user.english_name,
    };
  }

  private accumulateBindingSummary(
    bindingResult: CrmWecomBindingResult,
    counters: {
      incCreated(): void;
      incUpdated(): void;
      incMissingContact(): void;
      incUnmatched(): void;
      incConflict(): void;
    },
  ): void {
    if (bindingResult.status === 'CREATED') {
      counters.incCreated();
      return;
    }
    if (
      bindingResult.status === 'UPDATED' ||
      bindingResult.status === 'UNCHANGED'
    ) {
      counters.incUpdated();
      return;
    }
    if (bindingResult.status === 'MISSING_CONTACT') {
      counters.incMissingContact();
      return;
    }
    if (bindingResult.status === 'UNMATCHED') {
      counters.incUnmatched();
      return;
    }
    counters.incConflict();
  }

  private mergeStringArrays(
    current: string[] | undefined,
    incoming: string[] | undefined,
  ): string[] | undefined {
    const merged = [...(current ?? []), ...(incoming ?? [])].filter(
      (item, index, list) => list.indexOf(item) === index,
    );
    return merged.length > 0 ? merged : undefined;
  }

  private runUnsupportedResource(
    resourceType: WecomSyncResourceType,
  ): WecomSyncRunRecord {
    const runRecord: WecomSyncRunRecord = {
      id: buildEntityId('sync_run'),
      resourceType,
      runMode: 'manual-retry',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: 'SUCCEEDED_WITHOUT_CHANGES',
      pageCount: 0,
      itemCount: 0,
      fromCursor: '0',
      toCursor: '0',
      failureReason:
        '当前官方 API 同步方案未实现用户部门变更拉取，已跳过该资源。',
      wxUserUpsertedCount: 0,
      wxUserMapCreatedCount: 0,
      wxUserMapUpdatedCount: 0,
      missingContactCount: 0,
      unmatchedCount: 0,
      conflictCount: 0,
    };
    this.wecomSyncRunRepository.save(runRecord);
    return runRecord;
  }

  private auditTriggered(runRecord: WecomSyncRunRecord): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_DIRECTORY_SYNC_TRIGGERED',
      actorId: 'system_sync',
      actorRoleIds: [],
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: `企业微信目录同步已触发：${runRecord.resourceType}`,
      },
      sessionSnapshot: {
        resourceType: runRecord.resourceType,
        runMode: runRecord.runMode,
        syncSource: 'wecom-to-crm-native',
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `企业微信目录同步任务已启动：${runRecord.resourceType}`,
      createdAt: runRecord.startedAt,
    });
  }

  private auditFinished(runRecord: WecomSyncRunRecord): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_DIRECTORY_SYNC_FINISHED',
      actorId: 'system_sync',
      actorRoleIds: [],
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary:
          runRecord.status === 'FAILED'
            ? `企业微信目录同步失败：${runRecord.resourceType}`
            : `企业微信目录同步已完成：${runRecord.resourceType}`,
      },
      sessionSnapshot: {
        resourceType: runRecord.resourceType,
        status: runRecord.status,
        itemCount: runRecord.itemCount,
        pageCount: runRecord.pageCount,
        wxUserUpsertedCount: runRecord.wxUserUpsertedCount,
        wxUserMapCreatedCount: runRecord.wxUserMapCreatedCount,
        wxUserMapUpdatedCount: runRecord.wxUserMapUpdatedCount,
        missingContactCount: runRecord.missingContactCount,
        unmatchedCount: runRecord.unmatchedCount,
        conflictCount: runRecord.conflictCount,
        syncSource: 'wecom-to-crm-native',
      },
      riskLevel: runRecord.status === 'FAILED' ? 'MEDIUM' : 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome:
        runRecord.status === 'FAILED'
          ? `企业微信目录同步任务失败：${runRecord.resourceType}`
          : `企业微信目录同步任务完成：${runRecord.resourceType}，状态 ${runRecord.status}`,
      failureReason: runRecord.failureReason,
      createdAt: runRecord.finishedAt ?? new Date().toISOString(),
    });
  }
}
