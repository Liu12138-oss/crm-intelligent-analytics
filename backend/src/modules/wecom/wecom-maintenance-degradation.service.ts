import { Injectable } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';

export type WecomDegradationKind =
  | 'identity'
  | 'storage'
  | 'data';

export class WecomMaintenanceDegradationError extends Error {
  constructor(
    readonly kind: WecomDegradationKind,
    message: string,
  ) {
    super(message);
    this.name = 'WecomMaintenanceDegradationError';
  }
}

@Injectable()
export class WecomMaintenanceDegradationService {
  private readonly degradedKinds = new Set<WecomDegradationKind>();

  constructor(
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
  ) {}

  async assertStorageAvailable(): Promise<{ recovered: boolean }> {
    if (process.env.WECOM_FORCE_STORAGE_UNAVAILABLE === 'true') {
      this.degradedKinds.add('storage');
      throw new WecomMaintenanceDegradationError(
        'storage',
        '当前无法稳定维护会话状态，请稍后重试。',
      );
    }

    return { recovered: this.clearDegradedKind('storage') };
  }

  async assertIdentitySourceAvailable(): Promise<{ recovered: boolean }> {
    if (process.env.WECOM_FORCE_IDENTITY_UNAVAILABLE === 'true') {
      this.degradedKinds.add('identity');
      throw new WecomMaintenanceDegradationError(
        'identity',
        '当前无法确认你的 CRM 身份，请稍后重试。',
      );
    }

    if (
      process.env.NODE_ENV !== 'test' &&
      !(await this.isCrmRuntimeDataSourceReady())
    ) {
      this.degradedKinds.add('identity');
      throw new WecomMaintenanceDegradationError(
        'identity',
        '当前无法确认你的 CRM 身份，请稍后重试。',
      );
    }

    return { recovered: this.clearDegradedKind('identity') };
  }

  async assertRealtimeDataAvailable(): Promise<{ recovered: boolean }> {
    if (process.env.WECOM_FORCE_DATA_UNAVAILABLE === 'true') {
      this.degradedKinds.add('data');
      throw new WecomMaintenanceDegradationError(
        'data',
        '当前无法查询实时 CRM 数据，请稍后再试。',
      );
    }

    if (
      process.env.NODE_ENV !== 'test' &&
      !(await this.isCrmRuntimeDataSourceReady())
    ) {
      this.degradedKinds.add('data');
      throw new WecomMaintenanceDegradationError(
        'data',
        '当前无法查询实时 CRM 数据，请稍后再试。',
      );
    }

    return { recovered: this.clearDegradedKind('data') };
  }

  private clearDegradedKind(kind: WecomDegradationKind): boolean {
    if (!this.degradedKinds.has(kind)) {
      return false;
    }

    this.degradedKinds.delete(kind);
    return true;
  }

  /**
   * 判断企业微信问数运行时是否存在可用 CRM 数据源。
   *
   * 参数说明：无。
   * 返回值说明：只读库可用或联软标准 OpenAPI 已启用时返回 `true`。
   * 调用注意事项：这里是维护期总开关，不做用户级授权；用户级权限仍由后续身份解析和分析执行链路控制。
   */
  private async isCrmRuntimeDataSourceReady(): Promise<boolean> {
    if (await this.crmReadonlyService.ensureLiveQueryReady()) {
      return true;
    }

    return this.localRuntimeConfigService.getCrmStandardOpenApiConfig().enabled;
  }
}
