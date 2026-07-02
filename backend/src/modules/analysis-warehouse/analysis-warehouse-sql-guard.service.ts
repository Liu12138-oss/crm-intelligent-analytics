import { Injectable } from '@nestjs/common';
import { Parser } from 'node-sql-parser';
import { QueryRiskGuardService } from '../analysis/query-risk-guard.service';
import { SqlValidationError } from '../analysis/analysis.errors';

type AstNode = Record<string, any>;

export interface AnalysisWarehouseSqlValidationResult {
  normalizedSql: string;
  tables: string[];
  columns: string[];
  appliedLimit: number;
}

const ALLOWED_TABLE_FIELDS: Record<string, string[]> = {
  dim_lianruan_user: [
    'user_id',
    'username',
    'user_name',
    'role_code',
    'role_name',
    'wecom_userid',
    'department_id',
    'department_name',
    'region',
    'big_region',
    'partner_id',
    'partner_name',
    'status',
    'source_updated_at',
    'synced_at',
  ],
  dim_lianruan_partner: [
    'partner_id',
    'partner_name',
    'short_name',
    'partner_level',
    'partner_level_name',
    'is_technical_service_provider',
    'technical_service_provider_type',
    'parent_partner_id',
    'region',
    'big_region',
    'status',
    'created_at',
    'source_updated_at',
    'synced_at',
  ],
  dim_lianruan_customer: [
    'customer_id',
    'customer_name',
    'customer_id_rule',
    'status',
    'status_name',
    'category',
    'category_name',
    'owner_id',
    'owner_name',
    'assigned_staff_id',
    'assigned_staff_name',
    'partner_id',
    'partner_name',
    'region',
    'big_region',
    'registration_count',
    'opportunity_count',
    'quote_count',
    'order_count',
    'latest_activity_at',
    'created_at',
    'source_updated_at',
    'synced_at',
  ],
  fact_lianruan_registration: [
    'registration_id',
    'customer_id',
    'customer_name',
    'status',
    'created_by',
    'created_by_name',
    'assigned_staff_id',
    'assigned_staff_name',
    'partner_id',
    'region',
    'big_region',
    'created_at',
    'source_updated_at',
    'synced_at',
  ],
  fact_lianruan_opportunity: [
    'opportunity_id',
    'opportunity_name',
    'customer_id',
    'customer_name',
    'stage',
    'stage_name',
    'status',
    'amount',
    'owner_id',
    'owner_name',
    'assigned_staff_id',
    'assigned_staff_name',
    'partner_id',
    'partner_name',
    'assigned_partner_id',
    'region',
    'big_region',
    'registration_id',
    'quote_id',
    'expected_close_at',
    'created_at',
    'source_updated_at',
    'synced_at',
  ],
  fact_lianruan_quote: [
    'quote_id',
    'customer_id',
    'customer_name',
    'opportunity_id',
    'partner_id',
    'assigned_partner_id',
    'parent_partner_id',
    'assigned_staff_id',
    'assigned_staff_name',
    'owner_id',
    'owner_name',
    'amount',
    'status',
    'region',
    'big_region',
    'created_at',
    'source_updated_at',
    'synced_at',
  ],
  fact_lianruan_order: [
    'order_id',
    'customer_id',
    'customer_name',
    'partner_id',
    'parent_partner_id',
    'assigned_partner_id',
    'assigned_staff_id',
    'assigned_staff_name',
    'owner_id',
    'owner_name',
    'amount',
    'status',
    'region',
    'big_region',
    'deal_at',
    'created_at',
    'source_updated_at',
    'synced_at',
  ],
  semantic_field_catalog: [
    'id',
    'table_name',
    'field_name',
    'field_label',
    'business_meaning',
    'data_type',
    'resource',
    'analysis_enabled',
    'display_enabled',
    'sensitive_level',
    'dictionary_key',
  ],
  semantic_metric_catalog: [
    'id',
    'metric_key',
    'metric_label',
    'metric_formula',
    'default_table',
    'business_meaning',
    'analysis_enabled',
  ],
};

const ALLOWED_FUNCTIONS = new Set([
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
  'COALESCE',
  'IFNULL',
  'ROUND',
  'DATEDIFF',
  'DATE',
  'DATE_FORMAT',
  'YEAR',
  'MONTH',
  'QUARTER',
  'NOW',
  'CURRENT_DATE',
  'CURDATE',
]);

@Injectable()
export class AnalysisWarehouseSqlGuardService {
  private readonly parser = new Parser();

  constructor(private readonly queryRiskGuardService: QueryRiskGuardService) {}

  /**
   * 校验并规范化分析库候选 SQL。
   *
   * 参数说明：
   * - `sql`：AI 或程序生成的候选 SQL。
   * - `defaultLimit`：未显式 LIMIT 时追加的默认行数。
   * - `maxLimit`：允许的最大返回行数。
   * 返回值说明：返回规范化 SQL、命中表和字段。
   * 调用注意事项：该方法只允许访问语义层登记的分析表，禁止读取 ODS 原始 JSON 和系统库。
   */
  validateAndNormalize(
    sql: string,
    options: { defaultLimit?: number; maxLimit?: number } = {},
  ): AnalysisWarehouseSqlValidationResult {
    this.queryRiskGuardService.ensureQuerySafe(sql);
    const normalizedSql = this.normalizeSql(sql);
    if (normalizedSql.includes(';')) {
      throw new SqlValidationError('当前只允许执行单条 SELECT，不能包含分号或多语句。');
    }

    const ast = this.parser.astify(normalizedSql, { database: 'mysql' });
    const statements = Array.isArray(ast) ? ast : [ast];
    if (statements.length !== 1 || statements[0]?.type !== 'select') {
      throw new SqlValidationError('AI-agent 分析库只允许执行单条只读 SELECT。');
    }

    const statement = statements[0] as AstNode;
    const aliasToTable = this.buildAliasToTable(statement);
    const tables = [...new Set([...aliasToTable.values()])];
    this.validateTables(tables);
    this.validateColumns(statement, aliasToTable);
    this.validateFunctions(statement);
    const appliedLimit = this.validateLimit(statement, options.maxLimit ?? 1000);
    const finalSql = appliedLimit > 0
      ? normalizedSql
      : `${normalizedSql} LIMIT ${options.defaultLimit ?? 100}`;

    return {
      normalizedSql: finalSql,
      tables,
      columns: this.collectColumnRefs(statement).map((item) => item.column),
      appliedLimit: appliedLimit > 0 ? appliedLimit : options.defaultLimit ?? 100,
    };
  }

  /**
   * 校验查询表是否属于分析语义层白名单。
   */
  private validateTables(tables: string[]): void {
    const invalidTables = tables.filter((table) => !ALLOWED_TABLE_FIELDS[table]);
    if (invalidTables.length > 0) {
      throw new SqlValidationError(
        `当前查询访问了未授权的分析表：${invalidTables.join(', ')}`,
      );
    }
  }

  /**
   * 校验字段是否属于对应表的语义字段目录。
   *
   * 设计原因：ODS 原始 JSON 可能包含敏感字段，受控 SQL 只能访问 DWD/Facts/语义目录中明确登记的字段。
   */
  private validateColumns(statement: AstNode, aliasToTable: Map<string, string>): void {
    const refs = this.collectColumnRefs(statement);
    const selectAliases = this.collectSelectAliases(statement);
    const invalidColumns: string[] = [];

    for (const ref of refs) {
      if (ref.column === '*') {
        invalidColumns.push('*');
        continue;
      }

      const table = ref.table ? aliasToTable.get(ref.table) ?? ref.table : undefined;
      if (table) {
        const allowedFields = ALLOWED_TABLE_FIELDS[table] ?? [];
        if (!allowedFields.includes(ref.column)) {
          invalidColumns.push(`${table}.${ref.column}`);
        }
        continue;
      }

      if (selectAliases.has(ref.column)) {
        continue;
      }

      const matchedTables = Object.entries(ALLOWED_TABLE_FIELDS).filter(([, fields]) =>
        fields.includes(ref.column),
      );
      if (matchedTables.length === 0) {
        invalidColumns.push(ref.column);
      }
    }

    if (invalidColumns.length > 0) {
      throw new SqlValidationError(
        `当前查询访问了未授权的字段：${[...new Set(invalidColumns)].join(', ')}`,
      );
    }
  }

  /**
   * 校验 SQL 函数是否在聚合分析允许范围内。
   */
  private validateFunctions(statement: AstNode): void {
    const functionNames = new Set<string>();
    this.walkNode(statement, (node) => {
      if (node?.type === 'aggr_func') {
        functionNames.add(String(node.name ?? '').toUpperCase());
      }

      if (node?.type === 'function') {
        const name = node.name?.name?.[0]?.value ?? node.name;
        functionNames.add(String(name ?? '').toUpperCase());
      }
    });

    const invalidFunctions = [...functionNames].filter(
      (name) => name && !ALLOWED_FUNCTIONS.has(name),
    );
    if (invalidFunctions.length > 0) {
      throw new SqlValidationError(
        `当前查询使用了未授权函数：${invalidFunctions.join(', ')}`,
      );
    }
  }

  /**
   * 校验 LIMIT，不存在时由调用方追加默认 LIMIT。
   */
  private validateLimit(statement: AstNode, maxLimit: number): number {
    const limitValue = Number(statement.limit?.value?.[0]?.value ?? 0);
    if (limitValue > maxLimit) {
      throw new SqlValidationError(`查询返回行数不能超过 ${maxLimit}。`);
    }
    return Number.isFinite(limitValue) ? limitValue : 0;
  }

  /**
   * 建立 SQL 表别名到真实表名的映射。
   */
  private buildAliasToTable(statement: AstNode): Map<string, string> {
    const aliasToTable = new Map<string, string>();
    for (const item of statement.from ?? []) {
      const tableName = String(item.table ?? '');
      if (!tableName) {
        continue;
      }
      aliasToTable.set(String(item.as ?? tableName), tableName);
      aliasToTable.set(tableName, tableName);
    }
    return aliasToTable;
  }

  /**
   * 收集 SQL 中出现的列引用。
   */
  private collectColumnRefs(statement: AstNode): Array<{ table?: string; column: string }> {
    const refs: Array<{ table?: string; column: string }> = [];
    this.walkNode(statement, (node) => {
      if (node?.type === 'column_ref') {
        refs.push({
          table: node.table ? String(node.table) : undefined,
          column: String(node.column ?? ''),
        });
      }
    });
    return refs;
  }

  /**
   * 收集 SELECT 输出别名。
   *
   * 设计原因：AI 生成聚合 SQL 时常会用 `COUNT(id) AS field_count`，
   * 后续 `ORDER BY field_count` 引用的是结果别名而不是底层字段，不能按未授权字段误拦截。
   */
  private collectSelectAliases(statement: AstNode): Set<string> {
    const aliases = new Set<string>();
    for (const column of statement.columns ?? []) {
      if (column?.as) {
        aliases.add(String(column.as));
      }
    }
    return aliases;
  }

  /**
   * 递归遍历 SQL AST。
   */
  private walkNode(node: AstNode | null | undefined, visit: (node: AstNode) => void): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    visit(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach((item) => this.walkNode(item, visit));
        continue;
      }

      if (value && typeof value === 'object') {
        this.walkNode(value as AstNode, visit);
      }
    }
  }

  /**
   * 规范 SQL 字符串，便于做多语句和审计判断。
   */
  private normalizeSql(sql: string): string {
    return sql.replace(/\s+/gu, ' ').trim().replace(/;+\s*$/u, '');
  }
}
