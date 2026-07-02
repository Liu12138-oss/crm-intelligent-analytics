import { z } from 'zod';

export const aiContextPolicyWriteSchema = z.object({
  turnRetentionLimit: z
    .number()
    .int()
    .min(2, '问答上下文保留轮次上限至少为 2。'),
  historySummaryMaxLength: z
    .number()
    .int()
    .min(50, '历史摘要保留上限不能小于 50。'),
  latestQuestionMaxLength: z
    .number()
    .int()
    .min(20, '上一轮问题保留上限不能小于 20。'),
  latestSummaryMaxLength: z
    .number()
    .int()
    .min(50, '上一轮结果摘要保留上限不能小于 50。'),
  analysisSessionIdleTimeoutSeconds: z
    .number()
    .int()
    .min(60, '普通分析会话失活时长不能小于 60 秒。'),
  taskSessionIdleTimeoutSeconds: z
    .number()
    .int()
    .min(300, '任务态会话失活时长不能小于 300 秒。'),
});
