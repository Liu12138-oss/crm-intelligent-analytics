/**
 * 统一拼接 Web 站点地址与前端页面路径，避免绝对路径把应用前缀抹掉。
 *
 * 参数说明：
 * - webBaseUrl: 当前 Web 站点的对外访问根地址，可包含如 `/insight` 的应用前缀。
 * - pagePath: 需要跳转到的页面路径，例如 `/login`。
 *
 * 返回值说明：
 * - 返回完整页面地址，并保留 `webBaseUrl` 中已有的路径前缀。
 *
 * 注意事项：
 * - `pagePath` 会被强制转换为相对路径再拼接，避免 `new URL('/login', ...)`
 *   这类绝对路径写法把 `/insight/` 覆盖掉。
 */
export function buildWebAppUrl(webBaseUrl: string, pagePath: string): string {
  const normalizedBaseUrl = ensureTrailingSlash(webBaseUrl);
  const normalizedPagePath = pagePath.trim().replace(/^\/+/u, '');
  return new URL(normalizedPagePath, normalizedBaseUrl).toString();
}

/**
 * 为基地址补齐尾部斜杠，确保后续相对路径拼接始终以“目录”语义解析。
 */
function ensureTrailingSlash(baseUrl: string): string {
  const parsedUrl = new URL(baseUrl);
  if (!parsedUrl.pathname.endsWith('/')) {
    parsedUrl.pathname = `${parsedUrl.pathname}/`;
  }

  return parsedUrl.toString();
}
