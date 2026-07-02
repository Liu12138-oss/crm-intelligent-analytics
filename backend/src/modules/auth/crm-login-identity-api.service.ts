import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  LocalRuntimeConfigService,
  type CrmAuthIdentityApiRuntimeConfig,
} from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type { ChannelType, CrmUser } from '../../shared/types/domain';

interface IdentityApiSuccessResponse {
  code?: number;
  message?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class CrmLoginIdentityApiService {
  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  /**
   * 判断真实登录身份查询 API 是否已具备最小配置。
   *
   * 参数说明：无。
   * 返回值说明：已配置身份 API 基址时返回 `true`，否则返回 `false`。
   * 调用注意事项：仅用于第二阶段真实登录兜底判断，不会触发网络请求。
   */
  isEnabled(): boolean {
    return this.localRuntimeConfigService.getCrmAuthIdentityApiConfig().enabled;
  }

  /**
   * 按 `user_id` 调用身份查询 API，并转换为本项目统一的 `CrmUser`。
   *
   * 参数说明：
   * - `userId`：真实登录成功后返回的 CRM 用户编号。
   * - `crmAccessToken`：真实登录成功后返回的 `user_token`，用于 `crm-token` 鉴权模式。
   * 返回值说明：命中时返回标准化后的 CRM 用户；接口返回未找到时返回 `undefined`。
   * 调用注意事项：该方法只在真实登录第二阶段使用，不影响现有只读库链路。
   */
  async getUserById(
    userId: string,
    crmAccessToken?: string,
  ): Promise<CrmUser | undefined> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return undefined;
    }

    const config = this.localRuntimeConfigService.getCrmAuthIdentityApiConfig();
    if (!config.enabled || !config.baseUrl) {
      return undefined;
    }

    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    // 真实登录阶段默认复用 CRM user_token 做身份查询，避免再引入第三套鉴权协议。
    if (config.authMode === 'crm-token') {
      if (!crmAccessToken?.trim()) {
        throw new ServiceUnavailableException(
          '当前已启用真实登录身份查询 API，但登录会话缺少 CRM user_token。',
        );
      }
      headers.Authorization = `Token token=${crmAccessToken.trim()}, device=${crmAuthConfig.device}, version_code=${crmAuthConfig.versionCode}`;
    }

    const requestUrl = this.buildRequestUrl(config, normalizedUserId);
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetch(requestUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      this.analysisLoggerService.logWarn('真实登录身份查询 API 请求失败。', {
        requestUrl,
        timeoutMs: config.timeoutMs,
        durationMs: Date.now() - startedAt,
        reason: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableException(
        '当前无法连接 CRM 身份查询服务，请稍后重试。',
      );
    }

    const payload = (await response.json().catch(() => ({}))) as IdentityApiSuccessResponse;
    this.analysisLoggerService.logStep('真实登录身份查询 API 请求完成。', {
      requestUrl,
      httpStatus: response.status,
      responseOk: response.ok,
      timeoutMs: config.timeoutMs,
      durationMs: Date.now() - startedAt,
    });

    if (response.status === 404 || Number(payload.code ?? -1) === 40401) {
      return undefined;
    }

    if (!response.ok || Number(payload.code ?? -1) !== 0) {
      throw new ServiceUnavailableException(
        String(payload.message ?? 'CRM 身份查询失败。'),
      );
    }

    const userPayload = payload.data ?? {};
    return this.mapIdentityPayloadToCrmUser(normalizedUserId, userPayload);
  }

  /**
   * 统一拼接身份查询地址，并兼容 `{userId}` / `:userId` 两种占位写法。
   *
   * 参数说明：
   * - `config`：身份查询 API 配置。
   * - `userId`：CRM 用户编号。
   * 返回值说明：返回完整请求 URL。
   * 调用注意事项：若路径模板未声明占位符，则自动在末尾补 `/userId`。
   */
  private buildRequestUrl(
    config: CrmAuthIdentityApiRuntimeConfig,
    userId: string,
  ): string {
    const encodedUserId = encodeURIComponent(userId);
    let normalizedPath = config.userPathTemplate.trim();
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${normalizedPath}`;
    }

    if (normalizedPath.includes('{userId}')) {
      normalizedPath = normalizedPath.replaceAll('{userId}', encodedUserId);
    } else if (normalizedPath.includes(':userId')) {
      normalizedPath = normalizedPath.replaceAll(':userId', encodedUserId);
    } else {
      normalizedPath = `${normalizedPath.replace(/\/+$/u, '')}/${encodedUserId}`;
    }

    return `${config.baseUrl}${normalizedPath}`;
  }

  /**
   * 把身份 API 载荷转换为本项目统一的 CRM 用户结构。
   *
   * 参数说明：
   * - `fallbackUserId`：当接口未返回 `id` 时使用的回退用户编号。
   * - `payload`：身份 API 返回的 `data` 对象。
   * 返回值说明：返回可直接进入会话与权限系统的 `CrmUser`。
   * 调用注意事项：缺少数组字段时统一回退为空数组；缺少 `ownerIds` 时回退到本人 ID，避免静默扩权到整个部门。
   */
  private mapIdentityPayloadToCrmUser(
    fallbackUserId: string,
    payload: Record<string, unknown>,
  ): CrmUser {
    const id =
      this.readOptionalText(payload.id) ??
      this.readOptionalText(payload.user_id) ??
      fallbackUserId;
    const roleIds =
      this.readOptionalStringList(payload.roleIds) ??
      this.readOptionalStringList(payload.role_ids) ??
      [];
    const roleNames =
      this.readOptionalStringList(payload.roleNames) ??
      this.readOptionalStringList(payload.role_names) ??
      (this.readOptionalText(payload.role)
        ? [this.readOptionalText(payload.role)!]
        : []);
    const organizationIds =
      this.readOptionalStringList(payload.organizationIds) ??
      this.readOptionalStringList(payload.organization_ids) ??
      [];
    const departmentIds =
      this.readOptionalStringList(payload.departmentIds) ??
      this.readOptionalStringList(payload.department_ids) ??
      [];
    const ownerIds =
      this.readOptionalStringList(payload.ownerIds) ??
      this.readOptionalStringList(payload.owner_ids) ??
      [id];
    const inferredAdminByRole =
      roleIds.some((item) => item === 'role_admin' || item === 'superadmin') ||
      roleNames.some(
        (item) => item.includes('管理员') || item === 'superadmin' || item === 'admin',
      );
    const isAdmin =
      this.readOptionalBoolean(payload.isAdmin) ?? inferredAdminByRole;
    const exportAllowed =
      this.readOptionalBoolean(payload.exportAllowed) ??
      this.readOptionalBoolean(payload.export_allowed) ??
      isAdmin;
    const channels = this.normalizeChannels(payload.channels);

    return {
      id,
      name: this.readOptionalText(payload.name) ?? id,
      roleIds,
      roleNames,
      organizationIds,
      departmentIds,
      ownerIds,
      isAdmin,
      exportAllowed,
      channels,
      wecomSenderId:
        this.readOptionalText(payload.wecomSenderId) ??
        this.readOptionalText(payload.wecom_userid) ??
        this.readOptionalText(payload.wecomUserId),
      supervisorId:
        this.readOptionalText(payload.supervisorId) ??
        this.readOptionalText(payload.supervisor_id),
      supervisorName:
        this.readOptionalText(payload.supervisorName) ??
        this.readOptionalText(payload.supervisor_name),
      identitySource: 'crm-api',
    };
  }

  /**
   * 读取可选文本字段。
   *
   * 参数说明：`value` 为待解析字段。
   * 返回值说明：返回去空后的字符串；为空时返回 `undefined`。
   * 调用注意事项：数值字段会统一转为字符串，避免用户 ID 因类型差异丢失。
   */
  private readOptionalText(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
  }

  /**
   * 读取可选布尔字段，并兼容字符串场景。
   *
   * 参数说明：`value` 为待解析字段。
   * 返回值说明：命中时返回布尔值；为空时返回 `undefined`。
   * 调用注意事项：仅识别 `true/false/1/0/yes/no` 等常见表达，避免误判任意字符串。
   */
  private readOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = this.readOptionalText(value)?.toLowerCase();
    if (!normalized) {
      return undefined;
    }

    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }

    return undefined;
  }

  /**
   * 读取可选字符串数组字段，并兼容逗号分隔文本。
   *
   * 参数说明：`value` 为待解析字段。
   * 返回值说明：命中时返回去空去重后的字符串数组；无法解析时返回 `undefined`。
   * 调用注意事项：空数组会按“已显式提供但无内容”处理，调用方可继续自行决定回退逻辑。
   */
  private readOptionalStringList(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
      return Array.from(
        new Set(
          value
            .map((item) => this.readOptionalText(item))
            .filter((item): item is string => Boolean(item)),
        ),
      );
    }

    const normalizedText = this.readOptionalText(value);
    if (!normalizedText) {
      return undefined;
    }

    return Array.from(
      new Set(
        normalizedText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  /**
   * 归一化身份 API 返回的渠道列表，只保留系统当前支持的渠道枚举。
   *
   * 参数说明：`value` 为身份 API 返回的 `channels` 原始值。
   * 返回值说明：返回至少包含一个渠道的枚举数组；无法识别时默认回退 `web-console`。
   * 调用注意事项：未知渠道不会写入会话，避免自由文本污染权限与能力判断。
   */
  private normalizeChannels(value: unknown): ChannelType[] {
    const parsedChannels = this.readOptionalStringList(value) ?? [];
    const normalizedChannels = Array.from(
      new Set(
        parsedChannels.filter(
          (item): item is ChannelType =>
            item === 'web-console' || item === 'wecom-bot',
        ),
      ),
    );

    return normalizedChannels.length > 0 ? normalizedChannels : ['web-console'];
  }
}
