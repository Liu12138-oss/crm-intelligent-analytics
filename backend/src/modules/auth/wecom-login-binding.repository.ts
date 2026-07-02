import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  PendingWecomBindingRecord,
  WecomLoginBindingRecord,
} from '../../shared/types/domain';

@Injectable()
export class WecomLoginBindingRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  findBindingByWecomUserId(
    wecomUserId: string,
  ): WecomLoginBindingRecord | undefined {
    return this.appStorage.state.wecomLoginBindings.find(
      (item) => item.wecomUserId === wecomUserId,
    );
  }

  saveBinding(binding: WecomLoginBindingRecord): WecomLoginBindingRecord {
    const index = this.appStorage.state.wecomLoginBindings.findIndex(
      (item) => item.wecomUserId === binding.wecomUserId,
    );

    if (index >= 0) {
      this.appStorage.state.wecomLoginBindings[index] = binding;
      return binding;
    }

    this.appStorage.state.wecomLoginBindings.unshift(binding);
    return binding;
  }

  savePendingBinding(
    pendingBinding: PendingWecomBindingRecord,
  ): PendingWecomBindingRecord {
    const index = this.appStorage.state.pendingWecomBindings.findIndex(
      (item) => item.bindToken === pendingBinding.bindToken,
    );

    if (index >= 0) {
      this.appStorage.state.pendingWecomBindings[index] = pendingBinding;
      return pendingBinding;
    }

    this.appStorage.state.pendingWecomBindings.unshift(pendingBinding);
    return pendingBinding;
  }

  findPendingBindingByToken(
    bindToken: string,
  ): PendingWecomBindingRecord | undefined {
    return this.appStorage.state.pendingWecomBindings.find(
      (item) => item.bindToken === bindToken,
    );
  }

  removePendingBinding(bindToken: string): void {
    this.appStorage.state.pendingWecomBindings =
      this.appStorage.state.pendingWecomBindings.filter(
        (item) => item.bindToken !== bindToken,
      );
  }
}
