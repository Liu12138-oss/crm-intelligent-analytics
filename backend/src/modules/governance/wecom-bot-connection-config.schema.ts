import { z } from 'zod';

export const updateWecomBotConnectionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  botId: z.string().trim().optional(),
  botSecret: z.string().trim().optional(),
  botSignature: z.string().trim().optional(),
  botSource: z.string().trim().optional(),
  botTransportMode: z.enum(['mock', 'sdk']).optional(),
  botWsUrl: z.string().trim().optional(),
  botMaxReconnectAttempts: z.number().int().min(0).max(100).optional(),
  botHeartbeatIntervalMs: z.number().int().min(1000).max(300000).optional(),
  deliveryMaxRetries: z.number().int().min(0).max(10).optional(),
  deliveryRetryDelayMs: z.number().int().min(0).max(60000).optional(),
  deliveryChunkMaxLength: z.number().int().min(100).max(3000).optional(),
});

export type UpdateWecomBotConnectionConfigPayload = z.infer<
  typeof updateWecomBotConnectionConfigSchema
>;
