export interface WecomNamedCandidate {
  id?: string;
  name: string;
}

export interface WecomCandidateSelectionResult<T extends WecomNamedCandidate> {
  candidate?: T;
  selectionAttempted: boolean;
}

export interface WecomRankedCandidate<T extends WecomNamedCandidate> extends WecomNamedCandidate {
  candidate: T;
  id?: string;
  name: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendationReason: string;
}

export interface WecomCandidateRerankResult<T extends WecomNamedCandidate> {
  candidates: Array<WecomRankedCandidate<T>>;
  recommendedCandidate?: WecomRankedCandidate<T>;
  auditSnapshot: {
    boundary: 'RECALLED_CANDIDATES_ONLY';
    inputCandidateCount: number;
    recommendedCandidateId?: string;
    recommendedCandidateName?: string;
  };
}

const CHINESE_NUMERAL_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

/**
 * 统一解析企业微信里的候选选择回复，允许用户用更口语化的序号表达选候选。
 * 这里只负责候选选择语义本身，是否允许解析由调用方按当前会话状态决定。
 */
export function selectWecomCandidateByReply<T extends WecomNamedCandidate>(
  messageText: string | undefined,
  candidates: T[],
): WecomCandidateSelectionResult<T> {
  const trimmedText = normalizeCandidateReplyText(messageText);
  if (!trimmedText) {
    return {
      selectionAttempted: false,
    };
  }

  const exactCandidate = candidates.find((item) => item.name === trimmedText);
  if (exactCandidate) {
    return {
      candidate: exactCandidate,
      selectionAttempted: true,
    };
  }

  const selectedIndex = parseWecomCandidateSelectionIndex(trimmedText);
  if (selectedIndex === undefined) {
    return {
      selectionAttempted: false,
    };
  }

  return {
    candidate: candidates[selectedIndex],
    selectionAttempted: true,
  };
}

/**
 * 候选列表行统一采用“候选N：名称（辅助信息）”格式，便于用户直接引用或回复。
 */
export function buildWecomCandidateDisplayLine(params: {
  index: number;
  title: string;
  details?: Array<string | undefined>;
}): string {
  const normalizedDetails = (params.details ?? [])
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));

  return normalizedDetails.length > 0
    ? `候选${params.index + 1}：${params.title}（${normalizedDetails.join('｜')}）`
    : `候选${params.index + 1}：${params.title}`;
}

export function rankWecomCandidatesWithAiRecommendation<T extends WecomNamedCandidate>(
  queryText: string | undefined,
  candidates: T[],
): WecomCandidateRerankResult<T> {
  const normalizedQuery = normalizeCandidateReplyText(queryText);
  const rankedCandidates = candidates
    .map((candidate, index) => {
      const score = scoreCandidate(normalizedQuery, candidate.name, index);
      return {
        candidate,
        id: candidate.id,
        name: candidate.name,
        confidence: score >= 80 ? 'HIGH' as const : score >= 40 ? 'MEDIUM' as const : 'LOW' as const,
        recommendationReason:
          score >= 80
            ? '候选名称与当前上下文高度匹配。'
            : score >= 40
              ? '候选名称与当前上下文存在部分匹配。'
              : '候选来自受控召回集合，当前上下文匹配度较低。',
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .map((item) => ({
      candidate: item.candidate,
      id: item.id,
      name: item.name,
      confidence: item.confidence,
      recommendationReason: item.recommendationReason,
    }));
  const recommendedCandidate = rankedCandidates[0];

  return {
    candidates: rankedCandidates,
    recommendedCandidate,
    auditSnapshot: {
      boundary: 'RECALLED_CANDIDATES_ONLY',
      inputCandidateCount: candidates.length,
      recommendedCandidateId: recommendedCandidate?.id,
      recommendedCandidateName: recommendedCandidate?.name,
    },
  };
}

export function parseWecomCandidateSelectionIndex(
  messageText: string | undefined,
): number | undefined {
  const trimmedText = normalizeCandidateReplyText(messageText);
  if (!trimmedText) {
    return undefined;
  }

  const candidatePatterns = [
    /^候选\s*([一二两三四五六七八九十\d]+)$/u,
    /^第\s*([一二两三四五六七八九十\d]+)\s*(?:个|项|条)?$/u,
    /^([一二两三四五六七八九十\d]+)\s*(?:个)?$/u,
  ];

  for (const pattern of candidatePatterns) {
    const matched = trimmedText.match(pattern);
    if (!matched) {
      continue;
    }

    const numericValue = parseCandidateOrdinalToken(matched[1]);
    if (numericValue === undefined || numericValue <= 0) {
      return undefined;
    }

    return numericValue - 1;
  }

  return undefined;
}

function normalizeCandidateReplyText(messageText?: string): string {
  return (
    messageText?.trim().replace(/[。！!，,；;、\s]+$/gu, '') ?? ''
  );
}

function scoreCandidate(queryText: string, candidateName: string, index: number): number {
  const normalizedCandidate = candidateName.replace(/\s+/gu, '').trim();
  if (!queryText || !normalizedCandidate) {
    return Math.max(1, 10 - index);
  }

  if (queryText.includes(normalizedCandidate)) {
    return 100 - index;
  }

  const queryChars = new Set([...queryText]);
  const candidateChars = [...normalizedCandidate];
  const matchedCharCount = candidateChars.filter((item) => queryChars.has(item)).length;
  return Math.round((matchedCharCount / candidateChars.length) * 70) - index;
}

function parseCandidateOrdinalToken(token: string): number | undefined {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return undefined;
  }

  if (/^\d+$/u.test(normalizedToken)) {
    return Number(normalizedToken);
  }

  if (normalizedToken === '十') {
    return 10;
  }

  if (normalizedToken.includes('十')) {
    const [left, right] = normalizedToken.split('十');
    const tens = left ? CHINESE_NUMERAL_MAP[left] : 1;
    const units = right ? CHINESE_NUMERAL_MAP[right] : 0;
    if (!tens || (right && !units)) {
      return undefined;
    }

    return tens * 10 + units;
  }

  return CHINESE_NUMERAL_MAP[normalizedToken];
}
