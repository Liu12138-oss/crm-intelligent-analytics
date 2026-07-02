const LOGIN_ERROR_PATTERNS = [
  /未登录/u,
  /登录状态/u,
  /登录态/u,
  /401/u,
  /auth expired/iu,
] as const;

const TIMEOUT_ERROR_PATTERNS = [
  /超时/u,
  /\btimeout\b/iu,
  /timed out/iu,
] as const;

const NETWORK_ERROR_PATTERNS = [
  /failed to fetch/iu,
  /fetch failed/iu,
  /network ?error/iu,
  /网络/u,
] as const;

const SQL_SCOPE_ERROR_PATTERNS = [
  /未授权数据表/u,
  /访问了未授权数据表/u,
  /schema 探测/u,
  /未批准的关联路径/u,
  /未批准的函数调用/u,
  /information_schema/iu,
  /\bselect\b[\s\S]{0,120}\bfrom\b/iu,
  /\bjoin\b/iu,
  /模板参数 .* 未提供有效值/u,
] as const;

const SERVICE_UNAVAILABLE_PATTERNS = [
  /UNIFIED_AI_EXECUTION_UNAVAILABLE/u,
  /AI_CAPABILITY_PACK_RUNTIME_UNAVAILABLE/u,
  /Internal Server Error/iu,
] as const;

const SCOPE_DENIED_PATTERNS = [
  /授权范围/u,
  /权限范围/u,
  /当前筛选部门未命中任何可统计范围/u,
  /不在经营报表授权范围内/u,
] as const;

const PERMISSION_DENIED_PATTERNS = [
  /无权/u,
  /权限不足/u,
  /未开放/u,
  /\bforbidden\b/iu,
] as const;

const INTERNAL_DETAIL_PATTERNS = [
  /organization_id/iu,
  /department_id/iu,
  /user_id/iu,
  /\b[A-Z_]{8,}\b/u,
  /<\/?[a-z][^>]*>/iu,
  /Cannot GET/iu,
  /TypeError/iu,
  /ReferenceError/iu,
  /SyntaxError/iu,
  /Cannot\s+\w+/iu,
  /Unexpected token/iu,
  /undefined/iu,
  /null/iu,
] as const;

/**
 * 从未知错误对象中提取可展示文案，优先兼容后端 JSON 错误结构。
 */
function extractRawErrorMessage(
  value: unknown,
  fallbackMessage: string,
): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (!(value instanceof Error)) {
    return fallbackMessage.trim();
  }

  const message = value.message.trim();
  if (!message) {
    return fallbackMessage.trim();
  }

  try {
    const parsed = JSON.parse(message) as { message?: unknown };
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // 保持原始错误继续向下归一化。
  }

  return message;
}

/**
 * 判断一段提示是否已经包含了明确的下一步建议，避免重复追加相同语气。
 */
function hasNextStepGuidance(message: string): boolean {
  return /请|联系管理员|稍后重试|重新登录|重试|切换|调整|检查|重新选择|补充/u.test(
    message,
  );
}

/**
 * 为缺少动作建议的提示补齐“下一步怎么做”，统一页面错误体验。
 */
function ensureActionableMessage(
  message: string,
  defaultAction: string,
): string {
  const normalizedMessage = message.trim().replace(/[，。！？\s]+$/u, '');
  if (!normalizedMessage) {
    return defaultAction;
  }

  if (hasNextStepGuidance(normalizedMessage)) {
    return `${normalizedMessage}。`;
  }

  return `${normalizedMessage}，${defaultAction}`;
}

/**
 * 将 API 或前端本地错误统一翻译成用户可理解、且带下一步建议的中文提示。
 */
export function toUserFacingErrorMessage(
  value: unknown,
  fallbackMessage: string,
): string {
  const rawMessage = extractRawErrorMessage(value, fallbackMessage);

  if (LOGIN_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return '登录状态已失效，请重新登录后再试。';
  }

  if (TIMEOUT_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return '系统处理时间有点久，请稍后重试；如果连续多次失败，请联系管理员协助处理。';
  }

  if (NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return '当前网络连接不太稳定，请稍后重试；如果一直无法连接，请联系管理员检查服务状态。';
  }

  if (SQL_SCOPE_ERROR_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return '当前查询暂时无法执行，因为它超出了系统允许的分析范围。请换一个已开通的查询，或联系管理员调整配置后再试。';
  }

  if (SCOPE_DENIED_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return '你当前只能查看自己权限范围内的数据。请切换到已授权范围，或联系管理员调整权限后再试。';
  }

  if (PERMISSION_DENIED_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return '你当前没有权限执行这个操作。请联系管理员开通对应权限后再试。';
  }

  if (SERVICE_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return '当前服务暂时不可用，请稍后重试；如果多次失败，请联系管理员协助处理。';
  }

  if (INTERNAL_DETAIL_PATTERNS.some((pattern) => pattern.test(rawMessage))) {
    return ensureActionableMessage(
      fallbackMessage,
      '请稍后重试；如果问题持续出现，请联系管理员协助处理。',
    );
  }

  return ensureActionableMessage(
    rawMessage,
    '请根据页面提示调整后再试。',
  );
}
