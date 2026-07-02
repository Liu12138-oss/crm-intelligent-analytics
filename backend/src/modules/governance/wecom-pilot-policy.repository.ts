import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { WecomPilotPolicyRecord } from '../../shared/types/domain';

@Injectable()
export class WecomPilotPolicyRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  getCurrent(): WecomPilotPolicyRecord {
    if (!this.appStorage.state.wecomPilotPolicy) {
      this.appStorage.state.wecomPilotPolicy = {
        channel: 'wecom-bot',
        mode: 'FULL',
        allowUserIds: [],
        allowRoleIds: [],
        allowDepartmentIds: [],
        denyUserIds: [],
        updatedBy: 'system',
        updatedAt: new Date().toISOString(),
        note: '默认全量开放给已具备企业微信入口资格的角色',
      };
    }

    return this.appStorage.state.wecomPilotPolicy;
  }

  save(policy: WecomPilotPolicyRecord): WecomPilotPolicyRecord {
    this.appStorage.state.wecomPilotPolicy = policy;
    this.appStorage.persist();
    return policy;
  }
}
