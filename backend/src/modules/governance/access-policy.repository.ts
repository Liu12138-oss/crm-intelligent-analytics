import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { AccessPolicyRecord } from '../../shared/types/domain';

@Injectable()
export class AccessPolicyRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  getCurrent(): AccessPolicyRecord {
    return this.appStorage.state.policy;
  }

  save(policy: AccessPolicyRecord): AccessPolicyRecord {
    this.appStorage.state.policy = policy;
    this.appStorage.persist();
    return policy;
  }
}
