export type NotificationRetryStrategy =
  | 'NONE'
  | 'STANDARD_RETRY'
  | 'RATE_LIMIT_BACKOFF';

export interface NormalizedWecomError {
  failureReason: string;
  externalErrorCode?: string;
  externalErrorMessage?: string;
  retryStrategy: NotificationRetryStrategy;
}

const appRateLimitErrorCodes = new Set([
  '45009',
  '45011',
  '-1',
  '60020',
  '81013',
]);

/**
 * 解析企业微信机器人 SDK 异常，保留外部错误码并转换成业务可读原因。
 */
export function normalizeWecomBotError(error: unknown): NormalizedWecomError {
  const rawMessage = readErrorText(error);
  const externalErrorCode = extractErrorCode(rawMessage);
  const externalErrorMessage = extractErrorMessage(rawMessage) ?? rawMessage;

  if (externalErrorCode === '846607' || rawMessage.includes('frequency limit')) {
    return {
      failureReason: '企业微信机器人发送频率超限',
      externalErrorCode: externalErrorCode ?? '846607',
      externalErrorMessage,
      retryStrategy: 'RATE_LIMIT_BACKOFF',
    };
  }

  return {
    failureReason: rawMessage || '企业微信机器人主动通知发送失败。',
    externalErrorCode,
    externalErrorMessage,
    retryStrategy: 'STANDARD_RETRY',
  };
}

/**
 * 解析企业微信自建应用接口业务错误，频率限制和服务暂不可用统一进入退避重试。
 */
export function normalizeWecomAppBusinessError(
  payload: Record<string, unknown>,
): NormalizedWecomError {
  const externalErrorCode = String(payload.errcode ?? '');
  const externalErrorMessage = String(payload.errmsg ?? externalErrorCode);
  if (appRateLimitErrorCodes.has(externalErrorCode) || /freq|limit|busy|system/i.test(externalErrorMessage)) {
    return {
      failureReason: '企业微信自建应用发送频率超限或服务暂不可用',
      externalErrorCode,
      externalErrorMessage,
      retryStrategy: 'RATE_LIMIT_BACKOFF',
    };
  }

  return {
    failureReason: `企业微信自建应用发送失败：${externalErrorMessage}`,
    externalErrorCode,
    externalErrorMessage,
    retryStrategy: 'STANDARD_RETRY',
  };
}

/**
 * 将 fetch、access_token 和请求构造异常转换为标准通知失败信息。
 */
export function normalizeWecomAppThrownError(
  error: unknown,
  fallbackPrefix: string,
): NormalizedWecomError {
  const rawMessage = readErrorText(error);
  return {
    failureReason: `${fallbackPrefix}：${rawMessage}`,
    externalErrorMessage: rawMessage,
    retryStrategy: 'STANDARD_RETRY',
  };
}

function readErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown';
  }
}

function extractErrorCode(text: string): string | undefined {
  const matched = text.match(/(?:errcode|errorCode)["'\s:=]+(-?\d+)/i);
  return matched?.[1];
}

function extractErrorMessage(text: string): string | undefined {
  const matched = text.match(/errmsg["'\s:=]+([^,\]\n\r]+)/i);
  return matched?.[1]?.trim();
}
