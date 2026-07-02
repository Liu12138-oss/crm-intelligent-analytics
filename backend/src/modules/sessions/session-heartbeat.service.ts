import { Injectable } from '@nestjs/common';
import { QuerySessionRepository } from './query-session.repository';
import type { QuerySessionRecord } from '../../shared/types/domain';

@Injectable()
export class SessionHeartbeatService {
  constructor(private readonly querySessionRepository: QuerySessionRepository) {}

  reportHeartbeat(sessionId: string, reportedAt: string): QuerySessionRecord {
    const session = this.querySessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('当前会话不存在。');
    }

    const nextSession: QuerySessionRecord = {
      ...session,
      lastHeartbeatAt: reportedAt,
      contextStatus: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };

    return this.querySessionRepository.save(nextSession);
  }

  markState(
    sessionId: string,
    contextStatus: QuerySessionRecord['contextStatus'],
    reason?: string,
  ): QuerySessionRecord {
    const session = this.querySessionRepository.findById(sessionId);
    if (!session) {
      throw new Error('当前会话不存在。');
    }

    return this.querySessionRepository.save({
      ...session,
      contextStatus,
      disconnectReason: reason ?? session.disconnectReason,
      updatedAt: new Date().toISOString(),
    });
  }
}
