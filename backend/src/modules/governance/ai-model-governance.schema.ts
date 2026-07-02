import { z } from 'zod';

export const aiModelProfileWriteSchema = z.object({
  name: z.string().trim().min(1, '请输入 Profile 名称。'),
  description: z.string().trim().optional(),
  providerCode: z.string().trim().min(1, '请输入 Provider 标识。'),
  sdkType: z.enum(['openai-compatible-http']),
  model: z.string().trim().min(1, '请输入模型名称。'),
  baseUrl: z.string().trim().min(1, '请输入服务地址。'),
  apiKey: z.string().optional(),
  reasoningEffort: z.string().trim().optional(),
  serviceTier: z.string().trim().optional(),
  timeoutMs: z.number().int().positive().optional(),
  sdkOptions: z.record(z.string(), z.unknown()).default({}),
});

export const aiModelProfileDraftHealthCheckSchema = aiModelProfileWriteSchema.extend({
  profileId: z.string().trim().optional(),
});

export const aiModelProfileStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
