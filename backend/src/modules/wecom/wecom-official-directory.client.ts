import { promises as dns } from 'node:dns';
import https from 'node:https';
import { URL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import type {
  WecomOfficialDepartmentListResponse,
  WecomOfficialDepartmentSimpleListResponse,
  WecomOfficialTokenResponse,
  WecomOfficialUserGetResponse,
  WecomOfficialUserListResponse,
} from './wecom-official-directory.types';

@Injectable()
export class WecomOfficialDirectoryClient {
  private readonly transientRetryCount = 3;
  private readonly defaultRequestTimeoutMs = 20000;
  private readonly userListRequestTimeoutMs = 60000;
  private readonly hostnameResolutionCache = new Map<string, string>();

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
  ) {}

  async getAccessToken(): Promise<string> {
    const directoryConfig =
      this.localRuntimeConfigService.getWecomDirectorySyncConfig();
    const wecomConfig = this.localRuntimeConfigService.getWecomRuntimeConfig();
    if (
      !directoryConfig.enabled ||
      !directoryConfig.corpId ||
      !directoryConfig.secret
    ) {
      throw new Error('企业微信官方通讯录同步配置不完整。');
    }

    // 目录同步必须使用专用通讯录应用 secret，避免和 Web 登录应用混用导致字段权限不一致。
    const url = `${wecomConfig.qyapiBaseUrl}/gettoken?corpid=${encodeURIComponent(directoryConfig.corpId)}&corpsecret=${encodeURIComponent(directoryConfig.secret)}`;
    const payload =
      await this.requestJsonWithRetry<WecomOfficialTokenResponse>(url);
    if (payload.errcode !== 0 || !payload.access_token) {
      throw new Error(
        `企业微信 access_token 获取失败：${payload.errmsg || payload.errcode}`,
      );
    }

    return payload.access_token;
  }

  async listDepartments(
    accessToken: string,
  ): Promise<WecomOfficialDepartmentListResponse> {
    const wecomConfig = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const url = `${wecomConfig.qyapiBaseUrl}/department/list?access_token=${encodeURIComponent(accessToken)}`;
    const payload =
      await this.requestJsonWithRetry<WecomOfficialDepartmentListResponse>(url);
    if (payload.errcode !== 0) {
      throw new Error(
        `企业微信部门列表获取失败：${payload.errmsg || payload.errcode}`,
      );
    }
    return payload;
  }

  async listDepartmentSimpleIds(
    accessToken: string,
    departmentId: number,
  ): Promise<WecomOfficialDepartmentSimpleListResponse> {
    const wecomConfig = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const url = `${wecomConfig.qyapiBaseUrl}/department/simplelist?access_token=${encodeURIComponent(accessToken)}&id=${departmentId}`;
    const payload =
      await this.requestJsonWithRetry<WecomOfficialDepartmentSimpleListResponse>(url);
    if (payload.errcode !== 0) {
      throw new Error(
        `企业微信子部门列表获取失败：${payload.errmsg || payload.errcode}`,
      );
    }
    return payload;
  }

  async listUsersByDepartment(
    accessToken: string,
    departmentId: number,
  ): Promise<WecomOfficialUserListResponse> {
    const wecomConfig = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const url = `${wecomConfig.qyapiBaseUrl}/user/list?access_token=${encodeURIComponent(accessToken)}&department_id=${departmentId}`;
    const payload =
      await this.requestJsonWithRetry<WecomOfficialUserListResponse>(
        url,
        this.userListRequestTimeoutMs,
      );
    if (payload.errcode === 60123) {
      return {
        ...payload,
        errcode: 0,
        errmsg: 'ok',
        userlist: [],
      };
    }
    if (payload.errcode !== 0) {
      throw new Error(
        `企业微信部门成员详情获取失败：${payload.errmsg || payload.errcode}`,
      );
    }
    return payload;
  }

  async getUserDetail(
    accessToken: string,
    userid: string,
  ): Promise<WecomOfficialUserGetResponse> {
    const wecomConfig = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const url = `${wecomConfig.qyapiBaseUrl}/user/get?access_token=${encodeURIComponent(accessToken)}&userid=${encodeURIComponent(userid)}`;
    const payload =
      await this.requestJsonWithRetry<WecomOfficialUserGetResponse>(url);
    if (payload.errcode !== 0) {
      throw new Error(
        `企业微信成员详情获取失败：${payload.errmsg || payload.errcode}`,
      );
    }
    return payload;
  }

  /**
   * 企业微信官方接口在现网偶发出现瞬时 fetch failed，这里仅对网络层抖动做有限次重试。
   *
   * 设计原因：
   * 1. 目录同步一次会串行调用多个官方 GET 接口，任何单点抖动都会导致整轮失败；
   * 2. 仅重试 fetch 抛错，不吞掉 HTTP 非 2xx 和业务 errcode，避免掩盖真实配置问题；
   * 3. 重试次数保持很小，优先解决短瞬时网络闪断，而不是把慢故障拖成长阻塞。
   */
  private async requestJsonWithRetry<T>(
    urlText: string,
    timeoutMs = this.defaultRequestTimeoutMs,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.transientRetryCount; attempt += 1) {
      try {
        return await this.requestJson<T>(urlText, timeoutMs);
      } catch (error) {
        lastError = error;
        if (attempt >= this.transientRetryCount) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('fetch failed');
  }

  /**
   * 企业微信官方目录同步在现网中对 Node fetch/undici 的长连接复用较敏感，
   * 这里改用一次一连的原生 https 请求，并显式固定 IPv4，降低同轮多次请求时的连接抖动。
   */
  private requestJson<T>(urlText: string, timeoutMs: number): Promise<T> {
    const url = new URL(urlText);
    return this.resolveHostname(url.hostname).then(
      (resolvedHost) =>
        new Promise<T>((resolve, reject) => {
          const request = https.request(
            {
              protocol: url.protocol,
              hostname: resolvedHost,
              servername: url.hostname,
              path: `${url.pathname}${url.search}`,
              method: 'GET',
              family: 4,
              timeout: timeoutMs,
              agent: false,
              headers: {
                Connection: 'close',
                Host: url.hostname,
              },
            },
            (response) => {
              let rawBody = '';
              response.setEncoding('utf8');
              response.on('data', (chunk) => {
                rawBody += chunk;
              });
              response.on('end', () => {
                const statusCode = response.statusCode ?? 0;
                if (statusCode < 200 || statusCode >= 300) {
                  reject(new Error(`HTTP ${statusCode}`));
                  return;
                }

                try {
                  resolve(JSON.parse(rawBody) as T);
                } catch (error) {
                  reject(
                    error instanceof Error
                      ? error
                      : new Error('企业微信响应不是合法 JSON。'),
                  );
                }
              });
            },
          );

          request.on('error', (error) => {
            reject(error);
          });
          request.on('timeout', () => {
            request.destroy(new Error('timeout'));
          });
          request.end();
        }),
    );
  }

  /**
   * 企业微信目录同步一次会连续访问多个官方接口。
   * 当首个请求已经成功后，后续再反复做 DNS 解析没有价值，反而会放大现网偶发的 ENOTFOUND。
   * 这里在首次成功解析后缓存 IPv4，并继续保留原始 servername / Host 头，确保 TLS 与路由不受影响。
   */
  private async resolveHostname(hostname: string): Promise<string> {
    const cached = this.hostnameResolutionCache.get(hostname);
    if (cached) {
      return cached;
    }

    const addresses = await dns.resolve4(hostname);
    if (!addresses[0]) {
      throw new Error(`未解析到 ${hostname} 的 IPv4 地址。`);
    }

    this.hostnameResolutionCache.set(hostname, addresses[0]);
    return addresses[0];
  }
}
