import { httpClient } from './http-client';
import type { AuthSessionView, WecomLoginInitiateView } from '@/types/auth';

interface WecomBrowserLocationParams {
  currentHref?: string;
  currentOrigin?: string;
  topHref?: string;
  parentHref?: string;
  documentReferrer?: string;
  ancestorOrigins?: string[];
  appBasePath?: string;
}

/**
 * 安全读取跨窗口地址。
 *
 * 参数说明：`targetWindow` 为可能的顶层窗口或父窗口。
 * 返回值：同源可访问时返回完整地址；跨域不可访问或无地址时返回空值。
 * 设计原因：门户可能把应用放在内层窗口中，优先读取顶层地址可以拿到用户地址栏看到的真实门户 URL；
 * 但跨域场景浏览器会抛安全异常，必须安静降级到其它来源。
 */
function readWindowHrefSafely(targetWindow?: Window | null): string | undefined {
  try {
    return targetWindow?.location?.href?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 安全读取 iframe 祖先窗口的 origin 列表。
 *
 * 返回值：浏览器暴露 `location.ancestorOrigins` 时返回从近到远的 origin；不支持或不可读时返回空数组。
 * 设计原因：部分门户把内层应用地址改写为内网 IP，`top.location` 和 `document.referrer` 都拿不到门户 URL；
 * Chromium 内核仍可能通过该字段暴露外层门户 origin，可用于还原扫码回跳域名。
 */
function readAncestorOriginsSafely(): string[] {
  try {
    const locationWithAncestors = window.location as Location & {
      ancestorOrigins?: DOMStringList | string[];
    };
    const ancestorOrigins = locationWithAncestors.ancestorOrigins;
    if (!ancestorOrigins) {
      return [];
    }

    const result: string[] = [];
    for (let index = 0; index < ancestorOrigins.length; index += 1) {
      const value =
        typeof ancestorOrigins[index] === 'string'
          ? ancestorOrigins[index]
          : undefined;
      if (value?.trim()) {
        result.push(value.trim());
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * 判断候选地址是否属于当前应用基路径。
 *
 * 参数说明：
 * - candidateHref: 候选完整地址。
 * - currentOrigin: 当前运行窗口的 origin，仅用于解析相对地址。
 * - appBasePath: 应用部署基路径，例如 `/insight/`。
 *
 * 返回值：通过校验时返回 URL 对象；不满足 HTTP 协议或应用前缀时返回空值。
 * 设计原因：顶层地址和 referrer 都来自浏览器环境，必须限制在本应用路径下，避免扫码接口变成开放跳转入口。
 */
function resolveAppLocationCandidate(
  candidateHref: string | undefined,
  currentOrigin: string | undefined,
  appBasePath: string,
): URL | undefined {
  if (!candidateHref?.trim()) {
    return undefined;
  }

  try {
    const candidateUrl = new URL(candidateHref, currentOrigin);
    if (!['http:', 'https:'].includes(candidateUrl.protocol)) {
      return undefined;
    }

    const basePath = new URL(appBasePath, candidateUrl.origin).pathname.replace(
      /\/$/u,
      '',
    );
    const candidatePath = candidateUrl.pathname.replace(/\/$/u, '');
    const matchesBasePath =
      !basePath ||
      basePath === '/' ||
      candidatePath === basePath ||
      candidatePath.startsWith(`${basePath}/`);
    return matchesBasePath ? candidateUrl : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 用 iframe 祖先 origin 和当前应用路径合成门户地址。
 *
 * 参数说明：
 * - ancestorOrigin: 浏览器暴露的外层门户 origin。
 * - currentHref/currentOrigin: 当前内层应用地址，用于复用 pathname/search/hash。
 * - appBasePath: 应用部署基路径。
 *
 * 返回值：合成后仍位于应用基路径下时返回 URL；否则返回空值。
 * 设计原因：祖先信息通常只有 origin，没有完整路径；复用当前内层路径可把 `/insight/login?redirect=...`
 * 还原到门户域名下，同时继续经过应用路径白名单校验。
 */
function resolveAncestorOriginLocationCandidate(
  ancestorOrigin: string | undefined,
  currentHref: string | undefined,
  currentOrigin: string | undefined,
  appBasePath: string,
): URL | undefined {
  if (!ancestorOrigin?.trim()) {
    return undefined;
  }

  try {
    const ancestorUrl = new URL(ancestorOrigin.trim());
    if (!['http:', 'https:'].includes(ancestorUrl.protocol)) {
      return undefined;
    }

    const currentUrl = currentHref?.trim()
      ? new URL(currentHref, currentOrigin)
      : new URL(appBasePath, ancestorUrl.origin);
    const candidateUrl = new URL(
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      ancestorUrl.origin,
    );
    return resolveAppLocationCandidate(
      candidateUrl.toString(),
      ancestorUrl.origin,
      appBasePath,
    );
  } catch {
    return undefined;
  }
}

/**
 * 按可信优先级解析企业微信扫码应使用的浏览器地址。
 *
 * 返回值说明：优先返回用户地址栏对应的顶层/父窗口地址；不可访问时回退到 referrer；
 * 最后才使用当前内层窗口地址。
 */
function resolvePreferredBrowserLocation(
  params?: WecomBrowserLocationParams,
): URL | undefined {
  const currentOrigin =
    params?.currentOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : undefined);
  const appBasePath = params?.appBasePath ?? import.meta.env.BASE_URL ?? '/';
  const currentHref =
    params?.currentHref ??
    (typeof window !== 'undefined' ? window.location.href : undefined);
  const topHref =
    params?.topHref ??
    (typeof window !== 'undefined' ? readWindowHrefSafely(window.top) : undefined);
  const parentHref =
    params?.parentHref ??
    (typeof window !== 'undefined' ? readWindowHrefSafely(window.parent) : undefined);
  const documentReferrer =
    params?.documentReferrer ??
    (typeof document !== 'undefined' ? document.referrer : undefined);
  const ancestorOrigins =
    params?.ancestorOrigins ??
    (typeof window !== 'undefined' ? readAncestorOriginsSafely() : []);

  for (const candidateHref of [
    topHref,
    parentHref,
    ...ancestorOrigins.map((ancestorOrigin) =>
      resolveAncestorOriginLocationCandidate(
        ancestorOrigin,
        currentHref,
        currentOrigin,
        appBasePath,
      )?.toString(),
    ),
    documentReferrer,
    currentHref,
  ]) {
    const candidateUrl = resolveAppLocationCandidate(
      candidateHref,
      currentOrigin,
      appBasePath,
    );
    if (candidateUrl) {
      return candidateUrl;
    }
  }

  return undefined;
}

/**
 * 按当前页面运行环境计算企业微信扫码回跳 Web 基址。
 *
 * 参数说明：
 * - currentOrigin: 当前浏览器地址的 origin，默认取 `window.location.origin`。
 * - currentHref/topHref/parentHref/documentReferrer: 浏览器可见地址候选，优先用于门户内嵌场景。
 * - appBasePath: Vite 注入的前端基路径，默认取 `import.meta.env.BASE_URL`。
 *
 * 返回值说明：
 * - 浏览器环境下返回不带尾斜杠的 Web 基址，例如 `https://portal.example.com/insight`。
 * - 非浏览器环境或 origin 不可用时返回 `undefined`。
 *
 * 设计原因：扫码登录需要回到用户实际打开的 IP 或门户域名；不能依赖构建期
 * `APP_WEB_BASE_URL`，否则同一包在不同入口访问时会把登录态带回错误域名。
 */
export function resolveCurrentWebBaseUrl(params?: {
  currentHref?: string;
  currentOrigin?: string;
  topHref?: string;
  parentHref?: string;
  documentReferrer?: string;
  ancestorOrigins?: string[];
  appBasePath?: string;
}): string | undefined {
  const preferredLocation = resolvePreferredBrowserLocation(params);
  if (preferredLocation) {
    const appBasePath = params?.appBasePath ?? import.meta.env.BASE_URL ?? '/';
    const resolvedUrl = new URL(appBasePath, preferredLocation.origin);
    return resolvedUrl.toString().replace(/\/$/u, '');
  }

  const currentOrigin =
    params?.currentOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : undefined);
  if (!currentOrigin?.trim()) {
    return undefined;
  }

  const appBasePath = params?.appBasePath ?? import.meta.env.BASE_URL ?? '/';
  try {
    const resolvedUrl = new URL(appBasePath, currentOrigin);
    return resolvedUrl.toString().replace(/\/$/u, '');
  } catch {
    return undefined;
  }
}

/**
 * 按当前页面运行环境计算企业微信扫码完成后的完整回跳地址。
 *
 * 参数说明：
 * - currentHref: 当前浏览器完整地址，默认取 `window.location.href`。
 * - currentOrigin: 当前浏览器地址的 origin，默认取 `window.location.origin`。
 * - appBasePath: Vite 注入的前端基路径，默认取 `import.meta.env.BASE_URL`。
 *
 * 返回值说明：当前页面位于应用基路径下时返回完整地址；不在本应用路径下时返回 `undefined`。
 * 设计原因：门户平台会在地址上追加代理参数，扫码成功后必须保留这些参数，避免最终落点被网关拦成 302 页面。
 */
export function resolveCurrentWecomReturnUrl(params?: {
  currentHref?: string;
  currentOrigin?: string;
  topHref?: string;
  parentHref?: string;
  documentReferrer?: string;
  ancestorOrigins?: string[];
  appBasePath?: string;
}): string | undefined {
  const preferredLocation = resolvePreferredBrowserLocation(params);
  if (preferredLocation) {
    return preferredLocation.toString();
  }

  const currentHref =
    params?.currentHref ??
    (typeof window !== 'undefined' ? window.location.href : undefined);
  const currentOrigin =
    params?.currentOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : undefined);
  if (!currentHref?.trim() || !currentOrigin?.trim()) {
    return undefined;
  }

  const appBasePath = params?.appBasePath ?? import.meta.env.BASE_URL ?? '/';
  try {
    const currentUrl = new URL(currentHref, currentOrigin);
    const appBaseUrl = new URL(appBasePath, currentOrigin);
    if (currentUrl.origin !== appBaseUrl.origin) {
      return undefined;
    }

    const basePath = appBaseUrl.pathname.replace(/\/$/u, '');
    const currentPath = currentUrl.pathname.replace(/\/$/u, '');
    const matchesBasePath =
      !basePath ||
      basePath === '/' ||
      currentPath === basePath ||
      currentPath.startsWith(`${basePath}/`);
    if (!matchesBasePath) {
      return undefined;
    }

    return currentUrl.toString();
  } catch {
    return undefined;
  }
}

/**
 * 构造企业微信扫码初始化接口路径，并附带当前 Web 基址和完整页面地址供后端安全校验后缓存。
 */
export function buildWecomLoginInitiatePath(params?: {
  currentHref?: string;
  currentOrigin?: string;
  topHref?: string;
  parentHref?: string;
  documentReferrer?: string;
  ancestorOrigins?: string[];
  appBasePath?: string;
}): string {
  const webBaseUrl = resolveCurrentWebBaseUrl(params);
  const returnUrl = resolveCurrentWecomReturnUrl(params);
  const queryParams = new URLSearchParams();
  if (webBaseUrl) {
    queryParams.set('webBaseUrl', webBaseUrl);
  }
  if (returnUrl) {
    queryParams.set('returnUrl', returnUrl);
  }

  if (Array.from(queryParams.keys()).length === 0) {
    return '/auth/wecom/initiate';
  }

  return `/auth/wecom/initiate?${queryParams.toString()}`;
}

export const authService = {
  login(payload: {
    login: string;
    password: string;
    corpId?: string;
    wecomBindToken?: string;
  }): Promise<AuthSessionView> {
    return httpClient.post('/auth/login', payload);
  },
  getCurrentSession(): Promise<AuthSessionView> {
    return httpClient.get('/auth/session', { suppressAuthExpired: true });
  },
  logout(): Promise<{ success: boolean }> {
    return httpClient.post('/auth/logout');
  },
  startWecomLogin(): Promise<WecomLoginInitiateView> {
    return httpClient.get(buildWecomLoginInitiatePath());
  },
  exchangeWecomCode(payload: {
    code?: string;
    authCode?: string;
    state?: string;
  }): Promise<AuthSessionView> {
    return httpClient.post('/auth/wecom/exchange', payload, {
      suppressAuthExpired: true,
      timeoutMs: 45000,
    });
  },
};
