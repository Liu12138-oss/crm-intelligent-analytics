const wecomIpRestrictionPatterns = [
  /not allow to access from your ip/i,
  /\b60020\b/i,
  /e-60020/i,
  /open\.work\.weixin\.qq\.com\/devtool\/query/i,
] as const;

export const WECOM_LOGIN_UNAVAILABLE_MESSAGE =
  '当前网络环境暂不支持企业微信登录，请改用账号登录或联系管理员。';

function extractMessageFromUnknown(
  value: unknown,
  fallbackMessage: string,
): string {
  if (!(value instanceof Error)) {
    return fallbackMessage;
  }

  if (!value.message.trim()) {
    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(value.message) as { message?: unknown };
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // 保持原始错误文案继续向下兼容。
  }

  return value.message.trim();
}

export function isWecomLoginUnavailableMessage(message: string): boolean {
  return wecomIpRestrictionPatterns.some((pattern) => pattern.test(message));
}

export function normalizeWecomLoginErrorMessage(
  value: unknown,
  fallbackMessage: string,
): string {
  const message = extractMessageFromUnknown(value, fallbackMessage);

  if (message === 'Failed to fetch' || message === 'fetch failed') {
    return '当前无法连接登录服务，请稍后重试。';
  }

  if (isWecomLoginUnavailableMessage(message)) {
    return WECOM_LOGIN_UNAVAILABLE_MESSAGE;
  }

  return message;
}

export function normalizeWecomRouteFeedbackMessage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  const decoded = decodeURIComponent(value).trim();
  if (!decoded || isWecomLoginUnavailableMessage(decoded)) {
    return '';
  }

  return decoded;
}
