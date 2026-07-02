import { randomUUID } from 'node:crypto';

export function buildEntityId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}
