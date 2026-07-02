import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim();
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS ?? '30000');
const AUTH_EXPIRED_EVENT = 'crm-auth-expired';

/**
 * 归一化 API 根路径中的部署前缀。
 *
 * 参数说明：
 * - pathname: URL 解析得到的路径部分。
 *
 * 返回值说明：
 * - 返回去掉末尾斜杠后的路径；根路径统一返回空字符串。
 *
 * 调用注意事项：
 * - 只处理路径，不处理协议和域名，避免把构建期 IP 继续带入生产运行时。
 */
function normalizeApiBasePathname(pathname: string): string {
  const normalizedPathname = pathname.replace(/\/+$/u, '');

  // 根路径代表接口直接挂在当前域名下，不需要额外拼接前缀。
  if (!normalizedPathname || normalizedPathname === '/') {
    return '';
  }

  return normalizedPathname.startsWith('/')
    ? normalizedPathname
    : `/${normalizedPathname}`;
}

/**
 * 统一解析前端 API Base URL。
 *
 * 设计原因：
 * 1. 开发环境统一优先走当前页面同源代理，避免局域网联调时因为跨域预检、Cookie 策略或端口漂移造成登录偶发失败；
 * 2. 生产环境默认应该走当前站点同源反向代理，避免静态包误带本地开发机地址后把请求发到用户本机；
 * 3. 即使生产构建时意外带上了开发地址，只要当前页面 origin 不一致，也优先回退到当前站点 origin；
 * 4. 若正式环境显式配置了与当前站点同源的页面前缀，例如 `/insight`，则应保留该前缀，让接口与页面统一挂在同一路径下。
 */
export function resolveApiBaseUrl(params: {
  configuredBaseUrl?: string;
  currentOrigin?: string;
  isProduction: boolean;
}): string {
  const configuredBaseUrl = params.configuredBaseUrl?.trim();
  const currentOrigin = params.currentOrigin?.trim();

  if (!configuredBaseUrl) {
    return currentOrigin || 'http://127.0.0.1:3001';
  }

  if (!params.isProduction && currentOrigin) {
    try {
      const configuredUrl = new URL(configuredBaseUrl, currentOrigin);
      // 开发态只要显式配置成跨域后端，就统一回退到当前页面同源代理。
      // 这样既能覆盖 127.0.0.1，也能覆盖 10.x 局域网入口，避免浏览器预检、
      // SameSite Cookie 以及手工切端口时出现“登录不稳定”的假象。
      if (configuredUrl.origin !== currentOrigin) {
        return currentOrigin;
      }
    } catch {
      return configuredBaseUrl;
    }
  }

  if (!params.isProduction || !currentOrigin) {
    return configuredBaseUrl;
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl, currentOrigin);
    const normalizedPathname = normalizeApiBasePathname(
      configuredUrl.pathname,
    );

    // 生产环境通过门户域名或 IP 访问同一套静态包时，只复用路径前缀，协议和域名必须跟随当前页面。
    if (configuredUrl.origin !== currentOrigin) {
      return `${currentOrigin}${normalizedPathname}`;
    }

    return `${configuredUrl.origin}${normalizedPathname}`;
  } catch {
    // 配置无法解析时保留原值，让发布配置错误暴露出来，避免静默改写成错误路径。
    return configuredBaseUrl;
  }
}

function getRuntimeApiBaseUrl(): string {
  return resolveApiBaseUrl({
    configuredBaseUrl: RAW_API_BASE_URL,
    currentOrigin:
      typeof window !== 'undefined' ? window.location.origin : undefined,
    isProduction: import.meta.env.PROD,
  });
}

interface HttpRequestInit extends RequestInit {
  suppressAuthExpired?: boolean;
  timeoutMs?: number;
}

function normalizeErrorResponseMessage(
  response: Response,
  rawMessage: string,
): string {
  let trimmedMessage = rawMessage.trim();
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json') && trimmedMessage) {
    try {
      const parsed = JSON.parse(trimmedMessage) as { message?: unknown };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        trimmedMessage = parsed.message.trim();
      }
    } catch {
      // 非法 JSON 响应继续回退原始文本，避免吞掉后端真实错误线索。
    }
  }

  return toUserFacingErrorMessage(
    trimmedMessage || rawMessage,
    response.status >= 500
      ? '当前服务暂时不可用，请稍后重试；如果多次失败，请联系管理员。'
      : '当前操作暂未成功，请稍后重试。',
  );
}

async function request<T>(path: string, init?: HttpRequestInit): Promise<T> {
  const apiBaseUrl = getRuntimeApiBaseUrl();
  const controller = new AbortController();
  const { suppressAuthExpired, timeoutMs, ...fetchInit } = init ?? {};
  const effectiveTimeoutMs = timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    effectiveTimeoutMs,
  );

  let response: Response;
  try {
    const isFormDataPayload =
      typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;
    response = await fetch(`${apiBaseUrl}/api/v1${path}`, {
      headers: isFormDataPayload
        ? {
            ...(fetchInit.headers ?? {}),
          }
        : {
            'Content-Type': 'application/json',
            ...(fetchInit.headers ?? {}),
          },
      credentials: 'include',
      signal: controller.signal,
      ...fetchInit,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试。');
    }

    throw new Error(
      toUserFacingErrorMessage(
        error,
        '当前网络连接不太稳定，请稍后重试；如果一直无法连接，请联系管理员检查服务状态。',
      ),
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401 && !suppressAuthExpired) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }

    const message = await response.text();
    throw new Error(normalizeErrorResponseMessage(response, message));
  }

  return (await response.json()) as T;
}

export const httpClient = {
  get<T>(
    path: string,
    init?: Omit<HttpRequestInit, 'method' | 'body'>,
  ): Promise<T> {
    return request<T>(path, init);
  },
  post<T>(
    path: string,
    body?: unknown,
    init?: Omit<HttpRequestInit, 'method' | 'body'>,
  ): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...init,
    });
  },
  postForm<T>(
    path: string,
    body: FormData,
    init?: Omit<HttpRequestInit, 'method' | 'body'>,
  ): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body,
      ...init,
    });
  },
  put<T>(
    path: string,
    body?: unknown,
    init?: Omit<HttpRequestInit, 'method' | 'body'>,
  ): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...init,
    });
  },
  delete<T>(
    path: string,
    init?: Omit<HttpRequestInit, 'method' | 'body'>,
  ): Promise<T> {
    return request<T>(path, {
      method: 'DELETE',
      ...init,
    });
  },
};

export function buildApiUrl(path: string): string {
  return `${getRuntimeApiBaseUrl()}/api/v1${path}`;
}

export { AUTH_EXPIRED_EVENT };
