const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//iu;

/**
 * 统一归一化前端应用基路径，确保路由基座与静态资源前缀始终一致。
 *
 * 参数说明：
 * - rawBasePath: 原始基路径配置；既允许传 `/insight` 这类纯路径，也允许传完整访问地址。
 *
 * 返回值说明：
 * - 返回带首尾斜杠的路径，例如 `/`、`/insight/`。
 *
 * 注意事项：
 * - 若传入完整 URL，只提取 pathname，避免把协议和域名误写进 Vite `base`。
 * - 若未配置或配置为空，统一回退到根路径 `/`。
 */
export function normalizeAppBasePath(rawBasePath?: string): string {
  const trimmedBasePath = rawBasePath?.trim();
  if (!trimmedBasePath) {
    return '/';
  }

  let pathname = trimmedBasePath;

  // 允许直接复用 APP_WEB_BASE_URL 这类完整访问地址，避免部署时再维护一份重复前缀配置。
  if (ABSOLUTE_URL_PATTERN.test(trimmedBasePath)) {
    try {
      pathname = new URL(trimmedBasePath).pathname;
    } catch {
      pathname = trimmedBasePath;
    }
  }

  const normalizedPathname = pathname
    .trim()
    .replace(/\\/gu, '/')
    .replace(/\/{2,}/gu, '/')
    .replace(/[?#].*$/u, '');

  if (!normalizedPathname || normalizedPathname === '/') {
    return '/';
  }

  const withLeadingSlash = normalizedPathname.startsWith('/')
    ? normalizedPathname
    : `/${normalizedPathname}`;

  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}
