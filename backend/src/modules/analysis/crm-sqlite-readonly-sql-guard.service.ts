import { Injectable } from '@nestjs/common';
import { Parser } from 'node-sql-parser';
import { SqlValidationError } from './analysis.errors';
import { QueryRiskGuardService } from './query-risk-guard.service';

type AstNode = Record<string, any>;

export interface CrmSqliteReadonlySqlValidationResult {
  normalizedSql: string;
  tables: string[];
  appliedLimit: number;
}

const ALLOWED_TABLES = new Set([
  'v_business_overview',
  'v_sales_funnel',
  'v_partner_contribution',
  'v_customer_lifecycle',
  'v_open_risks',
  'fact_registrations',
  'fact_opportunities',
  'fact_quotes',
  'fact_orders',
  'dim_partners',
  'dim_users',
  'dim_customers',
  'entities',
  'users',
  'customers',
  'partners',
  'registrations',
  'opportunities',
  'quotes',
  'orders',
  'categories',
  'modules',
  'features',
  'hardwareProducts',
  'packages',
  'products',
  'implementationWorkloadClassifications',
  'implementationWorkloadMappings',
  'implementationWorkloadRules',
]);

@Injectable()
export class CrmSqliteReadonlySqlGuardService {
  private readonly parser = new Parser();

  constructor(private readonly queryRiskGuardService: QueryRiskGuardService) {}

  /**
   * 校验 CRM SQLite 只读库候选 SQL。
   *
   * 参数说明：
   * - `sql`：AI 或程序生成的候选 SQL。
   * - `defaultLimit/maxLimit`：缺省 LIMIT 与最大返回行数。
   * 返回值说明：返回规范化 SQL、访问表和实际 LIMIT。
   * 可能抛出的异常：多语句、写操作、系统表访问或超出行数上限时抛出。
   * 调用注意事项：当前正式主链优先使用固定模板，本方法为后续 Text-to-SQL 预留安全门闩。
   */
  validateAndNormalize(
    sql: string,
    options: { defaultLimit?: number; maxLimit?: number } = {},
  ): CrmSqliteReadonlySqlValidationResult {
    this.queryRiskGuardService.ensureQuerySafe(sql);
    const normalizedSql = this.normalizeSql(sql);
    if (!normalizedSql) {
      throw new SqlValidationError('SQLite 只读库查询不能为空。');
    }

    if (normalizedSql.includes(';')) {
      throw new SqlValidationError('SQLite 只读库只允许执行单条 SELECT，不能包含分号或多语句。');
    }

    this.ensureNoBlockedKeyword(normalizedSql);
    const statement = this.parseSingleSelect(normalizedSql);
    const tables = this.collectTables(statement);
    this.validateTables(tables);
    const maxLimit = options.maxLimit ?? 1000;
    const defaultLimit = Math.min(options.defaultLimit ?? 100, maxLimit);
    const appliedLimit = this.resolveLimit(statement, maxLimit);
    const finalSql = appliedLimit > 0
      ? normalizedSql
      : `${normalizedSql} LIMIT ${defaultLimit}`;

    return {
      normalizedSql: finalSql,
      tables,
      appliedLimit: appliedLimit > 0 ? appliedLimit : defaultLimit,
    };
  }

  /**
   * 解析并确认 SQL 是单条 SELECT。
   */
  private parseSingleSelect(sql: string): AstNode {
    const ast = this.parser.astify(sql, { database: 'SQLite' });
    const statements = Array.isArray(ast) ? ast : [ast];
    if (statements.length !== 1 || statements[0]?.type !== 'select') {
      throw new SqlValidationError('CRM SQLite 只读库只允许执行单条只读 SELECT。');
    }

    return statements[0] as AstNode;
  }

  /**
   * 拦截明显写库、变更连接和维护类关键字。
   */
  private ensureNoBlockedKeyword(sql: string): void {
    const blockedPattern =
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX)\b/iu;
    if (blockedPattern.test(sql)) {
      throw new SqlValidationError('CRM SQLite 只读库禁止执行写入、结构变更或维护类语句。');
    }
  }

  /**
   * 收集 SELECT 访问的表名。
   */
  private collectTables(statement: AstNode): string[] {
    const tables = new Set<string>();
    for (const item of statement.from ?? []) {
      const tableName = String(item.table ?? '').trim();
      if (tableName) {
        tables.add(tableName.replace(/["`]/gu, ''));
      }
    }
    return [...tables];
  }

  /**
   * 校验表名白名单，禁止访问 SQLite 系统表。
   */
  private validateTables(tables: string[]): void {
    if (tables.length === 0) {
      throw new SqlValidationError('SQLite 只读库查询必须声明 FROM 表。');
    }

    const invalidTables = tables.filter((table) => {
      const normalizedTable = table.trim();
      return normalizedTable.startsWith('sqlite_') || !ALLOWED_TABLES.has(normalizedTable);
    });
    if (invalidTables.length > 0) {
      throw new SqlValidationError(
        `CRM SQLite 只读库不允许访问这些表：${invalidTables.join('、')}。`,
      );
    }
  }

  /**
   * 校验 LIMIT 上限。
   */
  private resolveLimit(statement: AstNode, maxLimit: number): number {
    const limitValue = Number(statement.limit?.value?.[0]?.value ?? 0);
    if (limitValue > maxLimit) {
      throw new SqlValidationError(`SQLite 只读库单次返回不能超过 ${maxLimit} 行。`);
    }

    return Number.isFinite(limitValue) ? limitValue : 0;
  }

  /**
   * 规范 SQL 字符串，便于安全检查和审计摘要。
   */
  private normalizeSql(sql: string): string {
    return sql.replace(/\s+/gu, ' ').trim().replace(/;+\s*$/u, '');
  }
}
