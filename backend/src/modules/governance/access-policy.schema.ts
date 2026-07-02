import { z } from 'zod';

export const updateAccessPolicySchema = z.object({
  enabledRoleIds: z.array(z.string()).min(1),
  exportRoleIds: z.array(z.string()),
  enabledChannels: z.array(z.enum(['wecom-bot', 'web-console'])).min(1),
  allowedDomains: z.array(
    z.enum(['opportunity-analysis', 'contract-conversion', 'customer-relationship']),
  ),
  allowedTables: z.array(z.string()).min(1),
  allowedFields: z.record(z.array(z.string())),
  maskedFields: z.record(z.array(z.string())).optional().default({}),
  exportRowLimit: z.number().int().min(1).max(1000),
  exportDailyLimit: z.number().int().min(1).max(3),
  maxOnlineSessions: z.number().int().min(1),
  maxConcurrentQueries: z.number().int().min(1),
  heartbeatIntervalSeconds: z.number().int().min(1),
  idleTimeoutSeconds: z.number().int().min(1),
  historyRetentionDays: z.number().int().min(1),
});
