import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppStorageState, AuditEventRecord } from '../src/shared/types/domain';

export interface RepairAuditActorAttributionSummary {
  suspectedRobotCount: number;
  mappedCrmCount: number;
  unboundWecomCount: number;
  unknownCount: number;
  updatedCount: number;
}

interface RepairOptions {
  apply: boolean;
}

/**
 * 修复历史审计中把机器人或应用误当行为人的记录。
 * @param state 本地应用状态快照。
 * @param options apply 为 true 时写回内存对象，false 时仅统计。
 * @returns 修复统计，供 dry-run 和测试断言使用。
 */
export function repairAuditActorAttributionState(
  state: Pick<AppStorageState, 'auditEvents' | 'crmWxUserMaps'>,
  options: RepairOptions,
): RepairAuditActorAttributionSummary {
  const summary: RepairAuditActorAttributionSummary = {
    suspectedRobotCount: 0,
    mappedCrmCount: 0,
    unboundWecomCount: 0,
    unknownCount: 0,
    updatedCount: 0,
  };
  const crmUserByWxUserId = new Map(
    state.crmWxUserMaps.map((item) => [item.wxUserId, item.crmUserId] as const),
  );

  for (const event of state.auditEvents) {
    if (!isSuspectedRobotActor(event)) {
      continue;
    }

    summary.suspectedRobotCount += 1;
    const senderId = resolveWecomSenderId(event);
    if (!senderId) {
      summary.unknownCount += 1;
      continue;
    }

    const mappedCrmUserId = crmUserByWxUserId.get(senderId);
    const originalActorId = event.actorId;
    if (mappedCrmUserId) {
      summary.mappedCrmCount += 1;
      if (options.apply) {
        event.actorId = mappedCrmUserId;
        event.actorType = 'crm-user';
        event.actorExternalId = senderId;
        event.actorBindingStatus = 'BOUND_CRM';
      }
    } else {
      summary.unboundWecomCount += 1;
      if (options.apply) {
        event.actorId = `wecom:${senderId}`;
        event.actorType = 'wecom-user';
        event.actorDisplayName = `未绑定 CRM 用户（企业微信：${senderId}）`;
        event.actorExternalId = senderId;
        event.actorBindingStatus = 'UNBOUND_WECOM';
      }
    }

    if (options.apply) {
      event.channel = event.channel ?? 'wecom-bot';
      event.channelAgentId = event.channelAgentId ?? originalActorId;
      event.channelAgentType = event.channelAgentType ?? 'wecom-bot';
      event.sessionSnapshot = {
        ...(event.sessionSnapshot ?? {}),
        attributionRepair: {
          repairedAt: new Date().toISOString(),
          originalActorId,
          recoveredSenderId: senderId,
        },
      };
      summary.updatedCount += 1;
    }
  }

  return summary;
}

function isSuspectedRobotActor(event: AuditEventRecord): boolean {
  const actorId = event.actorId.toLowerCase();
  return (
    event.actorType === 'bot' ||
    actorId === 'unknown_wecom_sender' ||
    actorId.includes('bot') ||
    actorId.includes('aibot') ||
    actorId.includes('agent') ||
    Boolean(event.sessionSnapshot?.botId && event.actorId === event.sessionSnapshot.botId)
  );
}

function resolveWecomSenderId(event: AuditEventRecord): string | undefined {
  const snapshot = event.sessionSnapshot ?? {};
  const candidate = resolveStringValue(
    snapshot.senderId,
    snapshot.wecomSenderId,
    readNested(snapshot, ['from', 'userid']),
    readNested(snapshot, ['body', 'from', 'userid']),
    readNested(snapshot, ['body', 'userid']),
    readNested(snapshot, ['rawPayload', 'from', 'userid']),
    readNested(snapshot, ['rawPayload', 'userid']),
  );
  const botId = resolveStringValue(
    event.channelAgentId,
    snapshot.botId,
    snapshot.rawSenderId,
    readNested(snapshot, ['body', 'botId']),
    readNested(snapshot, ['body', 'aibotid']),
  );

  if (candidate && candidate !== botId) {
    return candidate;
  }

  return undefined;
}

function readNested(value: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function resolveStringValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function runCli(): void {
  const apply = process.argv.includes('--apply');
  const repoRoot = join(__dirname, '..', '..');
  const storageFilePath = join(repoRoot, '.runtime', 'app-storage.json');
  if (!existsSync(storageFilePath)) {
    console.log('未找到 .runtime/app-storage.json，暂无历史审计需要修复。');
    return;
  }

  const state = JSON.parse(readFileSync(storageFilePath, 'utf8')) as AppStorageState;
  const summary = repairAuditActorAttributionState(state, { apply });
  if (apply) {
    writeFileSync(storageFilePath, JSON.stringify(state, null, 2), 'utf8');
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        ...summary,
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  runCli();
}
