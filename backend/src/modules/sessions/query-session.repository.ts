import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { QuerySessionRecord } from '../../shared/types/domain';

@Injectable()
export class QuerySessionRepository {
  constructor(private readonly appStorage: AppStorageService) {}

  findById(sessionId: string): QuerySessionRecord | undefined {
    return this.appStorage.state.querySessions.find((item) => item.id === sessionId);
  }

  findByConversation(
    externalConversationId: string,
    requesterId: string,
    senderId?: string,
  ): QuerySessionRecord | undefined {
    return this.appStorage.state.querySessions.find(
      (item) =>
        item.externalConversationId === externalConversationId &&
        item.requesterId === requesterId &&
        (senderId ? item.senderId === senderId : true),
    );
  }

  findByWecomConversation(
    externalConversationId: string,
    senderId?: string,
  ): QuerySessionRecord | undefined {
    return this.appStorage.state.querySessions.find(
      (item) =>
        item.channel === 'wecom-bot' &&
        item.externalConversationId === externalConversationId &&
        (senderId ? item.senderId === senderId : true),
    );
  }

  list(): QuerySessionRecord[] {
    return [...this.appStorage.state.querySessions];
  }

  save(session: QuerySessionRecord): QuerySessionRecord {
    const currentIndex = this.appStorage.state.querySessions.findIndex(
      (item) => item.id === session.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.querySessions[currentIndex] = session;
      this.appStorage.persist();
      return session;
    }

    this.appStorage.state.querySessions.unshift(session);
    this.appStorage.persist();
    return session;
  }
}
