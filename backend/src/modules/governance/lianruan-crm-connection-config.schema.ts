import { z } from 'zod';

export const updateLianruanCrmConnectionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().trim().min(1).optional(),
  appKey: z.string().trim().min(1).optional(),
  appSecret: z.string().trim().min(1).optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(120000).optional(),
  tokenCacheBufferSeconds: z.coerce.number().int().min(0).max(3600).optional(),
});

export type UpdateLianruanCrmConnectionConfigPayload = z.infer<
  typeof updateLianruanCrmConnectionConfigSchema
>;
