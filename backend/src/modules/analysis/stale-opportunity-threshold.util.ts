interface StaleOpportunityThreshold {
  days: number;
  label: string;
}

const CHINESE_NUMBER_MAP: Record<string, number> = {
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
  十一: 11,
  十二: 12,
};

/**
 * 判断用户问题是否属于“商机长期无进展/未更新”的风险分析。
 *
 * 参数说明：`questionText` 为用户原始问法。
 * 返回值说明：命中商机对象，且包含无进展、未更新、未跟进、停滞等业务语义时返回 true。
 * 调用注意事项：该判断只用于选择停滞商机只读模板，不放宽权限或字段白名单。
 */
export function isStaleOpportunityQuestionText(questionText: string): boolean {
  if (!/商机/u.test(questionText)) {
    return false;
  }

  return (
    /(未|没|没有|无).{0,8}(进展|更新|跟进)/u.test(questionText) ||
    /(进展|更新|跟进).{0,8}(未|没|没有|无)/u.test(questionText) ||
    /(超|超过).{0,8}(未|没|没有).{0,8}(更新|进展|跟进)/u.test(questionText) ||
    /停滞|长期.{0,4}(未|没|没有).{0,4}(更新|进展|跟进)/u.test(questionText)
  );
}

/**
 * 从停滞商机问法中提取“多久没有进展”的阈值。
 *
 * 参数说明：`questionText` 为用户原始问法。
 * 返回值说明：返回天数阈值和用户可读标签；未给出明确时长时默认超过两周。
 * 调用注意事项：该函数只接受数字或常见中文数词，输出会被限制在 1 到 3650 天内。
 */
export function resolveStaleOpportunityThreshold(
  questionText: string,
): StaleOpportunityThreshold {
  const durationMatch = questionText.match(
    /(当前|最近|近|过去|前|超过|超|满)?\s*(十二|十一|十|九|八|七|六|五|四|三|两|二|一|\d{1,3})\s*(个月|月|周|星期|天|日)/u,
  );
  const rawAmount = durationMatch?.[2];
  const rawUnit = durationMatch?.[3];

  if (rawAmount && rawUnit) {
    const amount = parseDurationAmount(rawAmount);
    if (amount) {
      const unitDays = rawUnit.includes('月')
        ? 30
        : rawUnit.includes('周') || rawUnit.includes('星期')
          ? 7
          : 1;
      const days = clampThresholdDays(amount * unitDays);
      return {
        days,
        label: `超过${rawAmount}${rawUnit === '日' ? '天' : rawUnit}`,
      };
    }
  }

  return {
    days: 14,
    label: '超过两周',
  };
}

/**
 * 解析停滞时长中的数字。
 *
 * 参数说明：`rawAmount` 为阿拉伯数字或中文数词。
 * 返回值说明：返回整数；无法解析时返回 undefined。
 * 调用注意事项：仅覆盖 CRM 问数里常见的 1-12 中文数词和 1-3 位数字。
 */
function parseDurationAmount(rawAmount: string): number | undefined {
  const numeric = Number(rawAmount);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }

  return CHINESE_NUMBER_MAP[rawAmount];
}

/**
 * 限制停滞阈值边界。
 *
 * 参数说明：`days` 为换算后的天数。
 * 返回值说明：返回 1 到 3650 之间的整数。
 * 调用注意事项：避免异常输入生成过大阈值影响查询性能或业务含义。
 */
function clampThresholdDays(days: number): number {
  return Math.min(Math.max(Math.trunc(days), 1), 3650);
}
