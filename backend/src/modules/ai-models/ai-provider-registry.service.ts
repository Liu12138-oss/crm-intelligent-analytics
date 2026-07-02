import { Injectable } from '@nestjs/common';
import type { AiSdkType } from '../../shared/types/domain';
import type { AiProviderAdapter } from './adapters/ai-provider.adapter';

/**
 * 负责根据 sdkType 返回对应的 Provider adapter。
 */
@Injectable()
export class AiProviderRegistryService {
  constructor(private readonly adapters: AiProviderAdapter[]) {}

  /**
   * 读取指定 sdkType 对应的 adapter，未注册时直接抛错提示实现缺失。
   */
  getAdapter(sdkType: AiSdkType): AiProviderAdapter {
    const matchedAdapter = this.adapters.find(
      (adapter) => adapter.sdkType === sdkType,
    );
    if (!matchedAdapter) {
      throw new Error(`未注册对应的 AI Provider adapter：${sdkType}`);
    }

    return matchedAdapter;
  }
}
