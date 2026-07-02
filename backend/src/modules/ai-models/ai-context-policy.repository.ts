import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { AiContextPolicyRecord } from '../../shared/types/domain';

@Injectable()
export class AiContextPolicyRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  getCurrent(): AiContextPolicyRecord {
    return this.appStorage.state.aiContextPolicy;
  }

  save(record: AiContextPolicyRecord): AiContextPolicyRecord {
    this.appStorage.state.aiContextPolicy = record;
    this.appStorage.persist();
    return record;
  }
}
