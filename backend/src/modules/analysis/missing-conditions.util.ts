/**
 * 从 AI 输出中提取非空缺口描述。
 *
 * 参数说明：`value` 为 AI 原始 `missingConditions` 输出，可能不是数组。
 * 返回值说明：返回去重后的中文缺口描述。
 * 调用注意事项：这里只做形态清洗，不判断业务是否应该追问。
 */
function normalizeConditionArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * 判断缺口描述是否其实表达“系统已有默认执行口径”。
 *
 * 参数说明：`condition` 为单条缺口描述。
 * 返回值说明：命中默认执行说明时返回 `true`。
 * 调用注意事项：这类文本不能进入澄清链路，否则会把可执行查询误阻断。
 */
function isDefaultExecutionAdvisory(condition: string): boolean {
  return [
    /默认(提供|按|查询|展示|返回|使用|统计|输出)/u,
    /将(展示|查询|返回|统计).*全量/u,
    /默认.*(全量|全部|当前账号权限内)/u,
    /未指定时间范围.*(全量|默认)/u,
    /未指定分析维度.*默认/u,
    /未指定.{0,16}(指标|衡量指标).*默认/u,
  ].some((pattern) => pattern.test(condition));
}

/**
 * 判断是否属于可按主题默认口径执行的指标或维度缺口。
 *
 * 参数说明：`condition` 为单条缺口描述。
 * 返回值说明：描述“指标/维度未指定”且外部已确认有默认口径时返回 `true`。
 * 调用注意事项：只用于已有业务对象和默认任务包的场景，不能吞掉“分析对象缺失”。
 */
function isDefaultableMetricOrDimensionCondition(condition: string): boolean {
  return /(未指定|缺少|缺失|需要明确|不清楚|未明确|具体).{0,18}(指标|衡量指标|统计口径|维度|分析维度|展示维度)/u.test(
    condition,
  );
}

/**
 * 归一化时间范围缺口标签。
 *
 * 参数说明：`condition` 为单条缺口描述。
 * 返回值说明：时间范围类缺口统一返回“时间范围”，其它文本原样返回。
 * 调用注意事项：带有“默认全量”的时间说明会在调用前被过滤，不会被误归一成阻断项。
 */
function normalizeConditionLabel(condition: string): string {
  if (/(时间范围|起止时间|日期范围|时间边界)/u.test(condition)) {
    return '时间范围';
  }

  return condition;
}

export interface NormalizeAnalysisMissingConditionsOptions {
  keepTimeRangeCondition: boolean;
  dropDefaultableMetricOrDimension?: boolean;
}

/**
 * 归一化分析意图里的缺口条件。
 *
 * 参数说明：`value` 为 AI 原始缺口数组，`options` 控制时间缺口和默认业务口径处理。
 * 返回值说明：仅返回真正需要用户补充、会阻断执行的缺口。
 * 调用注意事项：AI 有时会把“默认会如何查询”写进 `missingConditions`，
 * 这里负责把说明性文本移出阻断链路，避免澄清服务误提示。
 */
export function normalizeAnalysisMissingConditions(
  value: unknown,
  options: NormalizeAnalysisMissingConditionsOptions,
): string[] {
  const normalizedConditions = normalizeConditionArray(value)
    .filter((condition) => !isDefaultExecutionAdvisory(condition))
    .map((condition) => normalizeConditionLabel(condition))
    .filter((condition) => {
      if (condition === '时间范围') {
        return options.keepTimeRangeCondition;
      }

      if (
        options.dropDefaultableMetricOrDimension &&
        isDefaultableMetricOrDimensionCondition(condition)
      ) {
        return false;
      }

      return true;
    });

  return Array.from(new Set(normalizedConditions));
}
