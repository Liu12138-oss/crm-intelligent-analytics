import { Injectable } from '@nestjs/common';
import type { AccessPolicyRecord } from '../../shared/types/domain';
import { SqlValidationError } from './analysis.errors';

@Injectable()
export class QueryWhitelistService {
  ensureAllowed(
    tables: string[],
    fieldMap: Record<string, string[]>,
    policy: AccessPolicyRecord,
  ): void {
    const hasBlockedTable = tables.some(
      (tableName) => !policy.allowedTables.includes(tableName),
    );

    if (hasBlockedTable) {
      throw new SqlValidationError('当前查询访问了未授权的数据表。');
    }

    const hasBlockedField = Object.entries(fieldMap).some(([tableName, fieldNames]) => {
      const allowedFields = policy.allowedFields[tableName] ?? [];
      return fieldNames.some((fieldName) => !allowedFields.includes(fieldName));
    });

    if (hasBlockedField) {
      throw new SqlValidationError(
        '当前查询访问了尚未纳入治理白名单的字段，请联系管理员更新字段白名单或改用标准 OpenAPI 口径。',
      );
    }
  }
}
