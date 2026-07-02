import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { AuthSessionRecord } from '../../shared/types/domain';

@Injectable()
export class AuthSessionRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  findById(sessionId: string): AuthSessionRecord | undefined {
    return this.appStorage.state.authSessions.find((item) => item.id === sessionId);
  }

  findActiveByRequesterId(requesterId: string): AuthSessionRecord[] {
    return this.appStorage.state.authSessions.filter(
      (item) => item.requesterId === requesterId && item.sessionStatus === 'ACTIVE',
    );
  }

  save(session: AuthSessionRecord): AuthSessionRecord {
    const index = this.appStorage.state.authSessions.findIndex(
      (item) => item.id === session.id,
    );

    if (index >= 0) {
      this.appStorage.state.authSessions[index] = session;
      return session;
    }

    this.appStorage.state.authSessions.unshift(session);
    return session;
  }

  delete(sessionId: string): void {
    this.appStorage.state.authSessions = this.appStorage.state.authSessions.filter(
      (item) => item.id !== sessionId,
    );
  }
}
