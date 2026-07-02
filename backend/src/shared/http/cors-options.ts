const DEFAULT_ALLOWED_CORS_ORIGINS = Object.freeze([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://10.8.11.61:5173',
]);

/**
 * 将配置中的前端访问地址归一化为浏览器 CORS 校验使用的 origin，避免把路径误写进白名单。
 * @param candidate 候选地址，允许为空或携带路径。
 * @returns 可用于 CORS 放行的 origin；无法解析时返回空值。
 */
function normalizeOriginCandidate(candidate: string | undefined): string | undefined {
  if (!candidate?.trim()) {
    return undefined;
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return undefined;
  }
}

/**
 * 组合后端应放行的前端来源列表，优先保留既有本地联调入口，并补充运行配置声明的 Web 地址。
 * @param candidates 运行时声明的 Web 基础地址列表。
 * @returns 去重后的 CORS 放行来源。
 */
export function resolveAllowedCorsOrigins(
  candidates: Array<string | undefined>,
): string[] {
  const allowedOrigins = new Set<string>(DEFAULT_ALLOWED_CORS_ORIGINS);

  for (const candidate of candidates) {
    const normalizedOrigin = normalizeOriginCandidate(candidate);
    if (normalizedOrigin) {
      allowedOrigins.add(normalizedOrigin);
    }
  }

  return [...allowedOrigins];
}
