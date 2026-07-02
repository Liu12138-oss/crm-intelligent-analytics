export const WECOM_COMMON_CONFIRM_REPLIES = [
  '确认',
  '是',
  '是的',
  '对',
  '对的',
  '好',
  '好的',
  '可以',
  '可以的',
  '没问题',
  '没错',
  '行',
  '行的',
  '通过',
  '嗯',
  '嗯嗯',
];

function normalizeWecomReplyIntentText(messageText?: string): string {
  return (messageText ?? '')
    .trim()
    .replace(/[“”"'`]/gu, '')
    .replace(/\s+/g, '')
    .replace(/[。！!？?，,；;：:~～、]/gu, '')
    .replace(/(吧|呀|啊|哦|喔|呢|哈|啦)+$/u, '');
}

export function matchesWecomExactReply(
  messageText: string | undefined,
  keywords: string[],
): boolean {
  const normalizedText = normalizeWecomReplyIntentText(messageText);
  if (!normalizedText) {
    return false;
  }

  return keywords.some(
    (keyword) => normalizeWecomReplyIntentText(keyword) === normalizedText,
  );
}

export function isWecomAffirmativeReply(
  messageText: string | undefined,
  extraKeywords: string[] = [],
): boolean {
  return matchesWecomExactReply(messageText, [
    ...WECOM_COMMON_CONFIRM_REPLIES,
    ...extraKeywords,
  ]);
}
