import { BadRequestException, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import {
  type CrmStandardOpenApiRuntimeConfig,
  LocalRuntimeConfigService,
} from '../../shared/config/local-runtime-config.service';
import type {
  CrmUser,
  LianruanCrmConnectionConfigRecord,
} from '../../shared/types/domain';
import { PermissionEnforcementService } from './permission-enforcement.service';
import {
  type UpdateLianruanCrmConnectionConfigPayload,
  updateLianruanCrmConnectionConfigSchema,
} from './lianruan-crm-connection-config.schema';
import type {
  LianruanCrmOpenApiAuthMePayload,
  LianruanCrmOpenApiPermissionScope,
  LianruanCrmOpenApiResponse,
  LianruanCrmOpenApiTokenPayload,
} from '../crm-standard-api/lianruan-crm-openapi.types';

interface LianruanCrmConnectionConfigView {
  useRuntimeConfig: boolean;
  enabled: boolean;
  effectiveEnabled: boolean;
  source: 'env' | 'runtime' | 'mixed';
  baseUrl?: string;
  appKeyMasked?: string;
  appKeyPresent: boolean;
  appSecretPresent: boolean;
  timeoutMs: number;
  tokenCacheBufferSeconds: number;
  updatedBy?: string;
  updatedAt?: string;
}

interface LianruanCrmConnectionTestResult {
  success: boolean;
  checkedAt: string;
  durationMs: number;
  message: string;
  config: Pick<
    LianruanCrmConnectionConfigView,
    | 'effectiveEnabled'
    | 'source'
    | 'baseUrl'
    | 'appKeyMasked'
    | 'appKeyPresent'
    | 'appSecretPresent'
    | 'timeoutMs'
    | 'tokenCacheBufferSeconds'
  >;
  steps: Array<{
    name: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    message: string;
    durationMs?: number;
  }>;
  context?: {
    clientId?: string;
    clientName?: string;
    boundUserId?: string;
    boundUserName?: string;
    boundUserRole?: string;
    allowedResources?: string[];
  };
  permissionScope?: LianruanCrmOpenApiPermissionScope;
}

class LianruanCrmOpenApiRequestError extends Error {
  constructor(
    readonly code: number,
    readonly remoteMessage: string,
    readonly friendlyMessage: string,
  ) {
    super(friendlyMessage);
  }
}

@Injectable()
export class LianruanCrmConnectionConfigService {
  constructor(
    private readonly appStorage: AppStorageService,
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  /**
   * 读取当前生效的联软标准 OpenAPI 配置。
   *
   * 参数说明：无。
   * 返回值说明：返回已合并页面运行态配置与 `.env` 兜底后的配置。
   * 调用注意事项：页面运行态字段按需覆盖 `.env`，便于只改 IP 或超时时继续复用环境凭证。
   */
  getEffectiveRuntimeConfig(): CrmStandardOpenApiRuntimeConfig & {
    source: 'env' | 'runtime' | 'mixed';
  } {
    const envConfig = this.localRuntimeConfigService.getCrmStandardOpenApiConfig();
    const runtimeConfig = this.getRuntimeConfigRecord();
    if (!runtimeConfig.useRuntimeConfig) {
      return {
        ...envConfig,
        source: 'env',
      };
    }

    const merged = this.mergeRuntimeWithEnv(runtimeConfig, envConfig);
    return {
      ...merged,
      enabled: Boolean(runtimeConfig.enabled && merged.baseUrl && merged.appKey && merged.appSecret),
      source: this.resolveConfigSource(runtimeConfig, envConfig),
    };
  }

  /**
   * 返回治理页面可展示的脱敏配置视图。
   *
   * 参数说明：`user` 为当前登录 CRM 用户。
   * 返回值说明：返回 baseUrl、超时、密钥配置状态和来源摘要；不会返回明文 Secret。
   * 可能抛出的异常：用户缺少治理权限时抛出权限异常。
   */
  getConfigView(user: CrmUser): LianruanCrmConnectionConfigView {
    this.ensureManageAccess(user);
    return this.buildConfigView(this.getEffectiveRuntimeConfig(), this.getRuntimeConfigRecord());
  }

  /**
   * 保存联软标准 OpenAPI 运行态配置。
   *
   * 参数说明：
   * - `user`：当前治理操作者；
   * - `payload`：页面提交的配置增量，未提交的密钥字段会继续沿用运行态或 `.env`。
   * 返回值说明：返回保存后的脱敏配置视图。
   * 调用注意事项：保存后调用方应清理联软 token 缓存，避免继续复用旧地址或旧凭证。
   */
  updateConfig(
    user: CrmUser,
    payload: unknown,
  ): LianruanCrmConnectionConfigView {
    this.ensureManageAccess(user);
    const parsed = updateLianruanCrmConnectionConfigSchema.parse(payload);
    const current = this.getRuntimeConfigRecord();
    const now = new Date().toISOString();
    const next: LianruanCrmConnectionConfigRecord = {
      ...current,
      useRuntimeConfig: true,
      enabled: parsed.enabled ?? current.enabled,
      baseUrl:
        parsed.baseUrl !== undefined
          ? this.normalizeHttpBaseUrl(parsed.baseUrl)
          : current.baseUrl,
      appKey: parsed.appKey ?? current.appKey,
      appSecret: parsed.appSecret ?? current.appSecret,
      timeoutMs: parsed.timeoutMs ?? current.timeoutMs,
      tokenCacheBufferSeconds:
        parsed.tokenCacheBufferSeconds ?? current.tokenCacheBufferSeconds,
      updatedBy: user.id,
      updatedAt: now,
    };

    this.appStorage.state.lianruanCrmConnectionConfig = next;
    this.appStorage.persist();
    return this.buildConfigView(this.getEffectiveRuntimeConfig(), next);
  }

  /**
   * 使用当前配置或页面草稿执行联软连接测试。
   *
   * 参数说明：
   * - `user`：当前治理操作者；
   * - `payload`：可选草稿配置，传入时只用于测试，不落库。
   * 返回值说明：返回鉴权、身份和权限范围三步的测试结果。
   * 调用注意事项：返回结果不包含 accessToken、appSecret 等敏感信息。
   */
  async testConfig(
    user: CrmUser,
    payload?: unknown,
  ): Promise<LianruanCrmConnectionTestResult> {
    this.ensureManageAccess(user);
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    const draft = payload
      ? updateLianruanCrmConnectionConfigSchema.partial().parse(payload)
      : undefined;
    const config = this.resolveDraftConfig(draft);
    const view = this.buildConfigView(config, this.getRuntimeConfigRecord());
    const steps: LianruanCrmConnectionTestResult['steps'] = [];

    if (!config.enabled || !config.baseUrl || !config.appKey || !config.appSecret) {
      return {
        success: false,
        checkedAt,
        durationMs: Date.now() - startedAt,
        message: '联软 CRM 连接参数不完整，请补齐 Base URL、App Key 和 App Secret 后再测试。',
        config: this.pickTestConfigView(view),
        steps: [
          {
            name: '配置完整性',
            status: 'FAILED',
            message: '缺少必要连接参数。',
          },
        ],
      };
    }

    try {
      const tokenStepStartedAt = Date.now();
      const tokenPayload = await this.requestOpenApiData<LianruanCrmOpenApiTokenPayload>(
        config,
        'POST',
        '/auth/token',
        undefined,
        {
          appKey: config.appKey,
          appSecret: config.appSecret,
        },
      );
      steps.push({
        name: '获取访问令牌',
        status: 'SUCCESS',
        message: `已获取 ${tokenPayload.tokenType || 'Bearer'} 访问令牌，过期时间 ${tokenPayload.expiresIn} 秒。`,
        durationMs: Date.now() - tokenStepStartedAt,
      });

      const headers = {
        Authorization: `Bearer ${tokenPayload.accessToken}`,
      };
      const contextStartedAt = Date.now();
      const context = await this.requestOpenApiData<LianruanCrmOpenApiAuthMePayload>(
        config,
        'GET',
        '/auth/me',
        headers,
      );
      steps.push({
        name: '读取绑定身份',
        status: 'SUCCESS',
        message: `当前绑定 CRM 用户：${context.user.name || context.user.id}。`,
        durationMs: Date.now() - contextStartedAt,
      });

      const scopeStartedAt = Date.now();
      const permissionScope =
        await this.requestOpenApiData<LianruanCrmOpenApiPermissionScope>(
          config,
          'GET',
          '/meta/permission-scope',
          headers,
        );
      steps.push({
        name: '读取权限范围',
        status: 'SUCCESS',
        message: `权限范围类型：${permissionScope.scopeType || '未返回'}。`,
        durationMs: Date.now() - scopeStartedAt,
      });

      return {
        success: true,
        checkedAt,
        durationMs: Date.now() - startedAt,
        message: '联软 CRM 标准 OpenAPI 连接测试通过。',
        config: this.pickTestConfigView(view),
        steps,
        context: {
          clientId: context.client.id,
          clientName: context.client.name,
          boundUserId: context.user.id,
          boundUserName: context.user.name,
          boundUserRole: context.user.role,
          allowedResources: context.client.allowedResources,
        },
        permissionScope,
      };
    } catch (error) {
      steps.push({
        name: '连接测试',
        status: 'FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        checkedAt,
        durationMs: Date.now() - startedAt,
        message: this.resolveConnectionTestFailureMessage(error),
        config: this.pickTestConfigView(view),
        steps,
      };
    }
  }

  /**
   * 确认治理用户具备联软连接配置管理权限。
   *
   * 参数说明：`user` 为当前登录 CRM 用户。
   * 返回值说明：校验通过无返回值。
   * 可能抛出的异常：缺少 `governance.policy.manage` 动作权限时抛出。
   */
  private ensureManageAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'governance.policy.manage',
      '当前用户无权管理联软 CRM 连接配置。',
      {
        channel: 'web-console',
        resourceType: 'lianruan-crm-connection-config',
      },
    );
  }

  /**
   * 读取运行态配置记录，并补齐历史快照缺失的默认字段。
   */
  private getRuntimeConfigRecord(): LianruanCrmConnectionConfigRecord {
    const current = this.appStorage.state.lianruanCrmConnectionConfig;
    return {
      id: 'lianruan_crm_standard_openapi',
      useRuntimeConfig: current?.useRuntimeConfig ?? false,
      enabled: current?.enabled ?? true,
      baseUrl: current?.baseUrl,
      appKey: current?.appKey,
      appSecret: current?.appSecret,
      timeoutMs: current?.timeoutMs ?? 12000,
      tokenCacheBufferSeconds: current?.tokenCacheBufferSeconds ?? 60,
      updatedBy: current?.updatedBy,
      updatedAt: current?.updatedAt,
    };
  }

  /**
   * 将运行态配置按字段覆盖到 `.env` 配置上。
   */
  private mergeRuntimeWithEnv(
    runtimeConfig: LianruanCrmConnectionConfigRecord,
    envConfig: CrmStandardOpenApiRuntimeConfig,
  ): CrmStandardOpenApiRuntimeConfig {
    return {
      enabled: true,
      baseUrl: this.normalizeHttpBaseUrl(runtimeConfig.baseUrl ?? envConfig.baseUrl),
      appKey: runtimeConfig.appKey ?? envConfig.appKey,
      appSecret: runtimeConfig.appSecret ?? envConfig.appSecret,
      timeoutMs: runtimeConfig.timeoutMs ?? envConfig.timeoutMs,
      tokenCacheBufferSeconds:
        runtimeConfig.tokenCacheBufferSeconds ?? envConfig.tokenCacheBufferSeconds,
      accessMode: envConfig.accessMode,
      serviceClientAllowedRoles: envConfig.serviceClientAllowedRoles,
    };
  }

  /**
   * 将页面草稿和当前生效配置合并为一次性测试配置。
   */
  private resolveDraftConfig(
    draft?: Partial<UpdateLianruanCrmConnectionConfigPayload>,
  ): CrmStandardOpenApiRuntimeConfig & { source: 'env' | 'runtime' | 'mixed' } {
    const effective = this.getEffectiveRuntimeConfig();
    if (!draft) {
      return effective;
    }

    const next = {
      ...effective,
      enabled: draft.enabled ?? effective.enabled,
      baseUrl:
        draft.baseUrl !== undefined
          ? this.normalizeHttpBaseUrl(draft.baseUrl)
          : effective.baseUrl,
      appKey: draft.appKey ?? effective.appKey,
      appSecret: draft.appSecret ?? effective.appSecret,
      timeoutMs: draft.timeoutMs ?? effective.timeoutMs,
      tokenCacheBufferSeconds:
        draft.tokenCacheBufferSeconds ?? effective.tokenCacheBufferSeconds,
      source: 'mixed' as const,
    };
    return {
      ...next,
      enabled: Boolean(next.enabled && next.baseUrl && next.appKey && next.appSecret),
    };
  }

  /**
   * 构造前端可展示的脱敏配置视图。
   */
  private buildConfigView(
    config: CrmStandardOpenApiRuntimeConfig & { source: 'env' | 'runtime' | 'mixed' },
    runtimeConfig: LianruanCrmConnectionConfigRecord,
  ): LianruanCrmConnectionConfigView {
    return {
      useRuntimeConfig: runtimeConfig.useRuntimeConfig,
      enabled: runtimeConfig.useRuntimeConfig ? runtimeConfig.enabled : config.enabled,
      effectiveEnabled: config.enabled,
      source: config.source,
      baseUrl: config.baseUrl,
      appKeyMasked: this.maskSecret(config.appKey),
      appKeyPresent: Boolean(config.appKey),
      appSecretPresent: Boolean(config.appSecret),
      timeoutMs: config.timeoutMs,
      tokenCacheBufferSeconds: config.tokenCacheBufferSeconds,
      updatedBy: runtimeConfig.updatedBy,
      updatedAt: runtimeConfig.updatedAt,
    };
  }

  /**
   * 截取测试结果中的安全配置字段。
   */
  private pickTestConfigView(
    view: LianruanCrmConnectionConfigView,
  ): LianruanCrmConnectionTestResult['config'] {
    return {
      effectiveEnabled: view.effectiveEnabled,
      source: view.source,
      baseUrl: view.baseUrl,
      appKeyMasked: view.appKeyMasked,
      appKeyPresent: view.appKeyPresent,
      appSecretPresent: view.appSecretPresent,
      timeoutMs: view.timeoutMs,
      tokenCacheBufferSeconds: view.tokenCacheBufferSeconds,
    };
  }

  /**
   * 发起联软标准 OpenAPI 测试请求并返回业务 data。
   */
  private async requestOpenApiData<T>(
    config: CrmStandardOpenApiRuntimeConfig,
    method: 'GET' | 'POST',
    path: string,
    headers?: Record<string, string>,
    body?: Record<string, unknown>,
  ): Promise<T> {
    if (!config.baseUrl) {
      throw new BadRequestException('联软 OpenAPI Base URL 未配置。');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(headers ?? {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const payload = (await response.json()) as LianruanCrmOpenApiResponse<T>;
      if (payload.code !== 0) {
        throw this.buildOpenApiRequestError(
          payload.code,
          payload.message || '未返回错误说明',
        );
      }
      if (!('data' in payload)) {
        throw new Error('联软 OpenAPI 成功响应缺少 data 载荷。');
      }
      return payload.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`联软 OpenAPI 请求超时，请检查地址或将超时调大到 ${config.timeoutMs}ms 以上。`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 判断运行态配置是否只覆盖部分 `.env` 字段。
   */
  private resolveConfigSource(
    runtimeConfig: LianruanCrmConnectionConfigRecord,
    envConfig: CrmStandardOpenApiRuntimeConfig,
  ): 'runtime' | 'mixed' {
    const usesEnvFallback = Boolean(
      (!runtimeConfig.baseUrl && envConfig.baseUrl) ||
        (!runtimeConfig.appKey && envConfig.appKey) ||
        (!runtimeConfig.appSecret && envConfig.appSecret),
    );
    return usesEnvFallback ? 'mixed' : 'runtime';
  }

  /**
   * 将联软标准错误码转换为治理页面可执行的排障提示。
   *
   * 参数说明：`code` 为联软 OpenAPI 响应 code，`message` 为远端原始说明。
   * 返回值说明：返回包含错误码、中文含义和下一步动作的提示。
   * 调用注意事项：只保留错误码和错误类型，不拼接密钥、token 或请求体。
   */
  private buildOpenApiRequestError(
    code: number,
    message: string,
  ): LianruanCrmOpenApiRequestError {
    const normalizedMessage = message.trim() || '未返回错误说明';
    const friendlyMessage = this.resolveOpenApiErrorMessage(
      code,
      normalizedMessage,
    );
    return new LianruanCrmOpenApiRequestError(
      code,
      normalizedMessage,
      friendlyMessage,
    );
  }

  /**
   * 根据联软错误码生成单步测试失败说明。
   */
  private resolveOpenApiErrorMessage(code: number, message: string): string {
    if (code === 40111) {
      return `联软 OpenAPI 返回失败：缺少 App Key 或 App Secret，请确认页面字段已填写完整。（code=${code}，remote=${message}）`;
    }
    if (code === 40112) {
      return `联软 OpenAPI 返回失败：client 无效。请重点核对 App Key 是否属于当前 Base URL 环境，或请对方确认该 client 未被删除、禁用或过期。（code=${code}，remote=${message}）`;
    }
    if (code === 40113) {
      return `联软 OpenAPI 返回失败：App Secret 无效。请重新复制对应 client 的 Secret，注意不要混用其它环境凭证。（code=${code}，remote=${message}）`;
    }
    if (code === 40312 || code === 40302) {
      return `联软 OpenAPI 返回失败：当前请求来源未放行。请让对方核对后端服务器出口 IP 是否已加入该 client 白名单。（code=${code}，remote=${message}）`;
    }
    if (code === 40301) {
      return `联软 OpenAPI 返回失败：client 已禁用或过期。请对方重新启用或重新创建联调 client。（code=${code}，remote=${message}）`;
    }
    if (code === 40313 || code === 40304) {
      return `联软 OpenAPI 返回失败：client 绑定的 CRM 用户不可用或不可访问。请对方核对绑定用户状态和权限范围。（code=${code}，remote=${message}）`;
    }
    return `联软 OpenAPI 返回失败：${message}（code=${code}）`;
  }

  /**
   * 生成测试卡片顶部的失败摘要。
   */
  private resolveConnectionTestFailureMessage(error: unknown): string {
    if (error instanceof LianruanCrmOpenApiRequestError) {
      if (error.code === 40112) {
        return '联软 CRM 连接测试未通过：client 无效，请优先核对 App Key 和当前 Base URL 是否属于同一环境。';
      }
      if (error.code === 40113) {
        return '联软 CRM 连接测试未通过：App Secret 无效，请重新填写当前 client 对应的 Secret。';
      }
      if (error.code === 40312 || error.code === 40302) {
        return '联软 CRM 连接测试未通过：请求来源未放行，请核对服务器出口 IP 白名单。';
      }
      return `联软 CRM 连接测试未通过：${error.friendlyMessage}`;
    }
    return '联软 CRM 标准 OpenAPI 连接测试未通过，请检查地址、白名单或凭证。';
  }

  /**
   * 统一标准化 HTTP Base URL，避免尾部斜杠导致路径拼接异常。
   */
  private normalizeHttpBaseUrl(value?: string): string | undefined {
    const normalized = String(value ?? '').trim().replace(/\/+$/u, '');
    return normalized || undefined;
  }

  /**
   * 对配置密钥做前后缀脱敏展示。
   */
  private maskSecret(value?: string): string | undefined {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return undefined;
    }
    if (normalized.length <= 8) {
      return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`;
    }
    return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`;
  }
}
