import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { WecomConversationContextRecord } from '../../shared/types/domain';

@Injectable()
export class WecomConversationContextRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  findBySessionId(sessionId: string): WecomConversationContextRecord | undefined {
    return this.appStorage.state.wecomConversationContexts.find(
      (item) => item.sessionId === sessionId,
    );
  }

  save(
    record: WecomConversationContextRecord,
  ): WecomConversationContextRecord {
    const currentIndex = this.appStorage.state.wecomConversationContexts.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.wecomConversationContexts[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.wecomConversationContexts.unshift(record);
    this.appStorage.persist();
    return record;
  }
}
