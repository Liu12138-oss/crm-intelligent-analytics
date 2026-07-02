import { Injectable } from '@nestjs/common';
import { Parser } from 'node-sql-parser';
import type { CompiledQuery } from './query-compiler.service';
import { SqlValidationError } from './analysis.errors';

type AstNode = Record<string, any>;

@Injectable()
export class QueryAstValidatorService {
  private readonly parser = new Parser();
  private readonly temporalFieldByBaseTable: Record<string, string> = {
    opportunities: 'created_at',
    contracts: 'created_at',
    customers: 'created_at',
  };

  validateReadOnly(sql: string, compiledQuery: CompiledQuery): void {
    const ast = this.parser.astify(sql);
    const statements = Array.isArray(ast) ? ast : [ast];

    if (statements.length !== 1 || statements[0]?.type !== 'select') {
      throw new SqlValidationError('当前只允许执行单条只读查询。');
    }

    const statement = statements[0];
    this.validateJoins(statement, compiledQuery);
    this.validateTables(statement, compiledQuery);
    this.validateFunctions(statement, compiledQuery.allowedFunctions);
    this.validateGrouping(statement);
    this.validateOrdering(statement);
    this.validateLimit(statement);
    this.validateTemporalField(sql, statement, compiledQuery);
  }

  private validateTables(statement: AstNode, compiledQuery: CompiledQuery): void {
    const tableNames = (statement.from ?? []).map((item: AstNode) => item.table);
    const hasUnexpectedTable = tableNames.some(
      (tableName: string) => !compiledQuery.tables.includes(tableName),
    );

    if (hasUnexpectedTable) {
      throw new SqlValidationError('SQL AST 校验失败，存在未批准的数据表。');
    }
  }

  private validateJoins(statement: AstNode, compiledQuery: CompiledQuery): void {
    const aliasToTable = this.buildAliasToTable(statement);

    for (const item of statement.from ?? []) {
      if (!item.join) {
        continue;
      }

      const normalizedJoins = this.normalizeJoinPaths(item.on, aliasToTable);
      const hasUnexpectedJoin = normalizedJoins.some(
        (normalizedJoin) => !compiledQuery.joinPaths.includes(normalizedJoin),
      );
      if (normalizedJoins.length === 0 || hasUnexpectedJoin) {
        throw new SqlValidationError('SQL AST 校验失败，存在未批准的关联路径。');
      }
    }
  }

  /**
   * 校验带时间槽的查询是否使用了对象白名单内的时间字段和完整边界。
   *
   * 参数说明：
   * - `sql`：待执行 SQL。
   * - `statement`：SQL AST 的单条 select 语句。
   * - `compiledQuery`：包含计划、字段声明和任务元数据的编译结果。
   * 返回值：无；校验失败时抛出 `SqlValidationError`。
   */
  private validateTemporalField(
    sql: string,
    statement: AstNode,
    compiledQuery: CompiledQuery,
  ): void {
    if (!compiledQuery.plan.temporalSlot) {
      return;
    }

    const baseTable = compiledQuery.plan.baseTable;
    const allowedField = this.temporalFieldByBaseTable[baseTable];
    if (!allowedField) {
      throw new SqlValidationError('SQL AST 校验失败，当前对象缺少时间字段白名单。');
    }

    const declaredFields = compiledQuery.fieldMap[baseTable] ?? [];
    if (!declaredFields.includes(allowedField)) {
      throw new SqlValidationError('SQL AST 校验失败，缺少允许的时间字段，时间字段未在字段清单中声明。');
    }

    const aliasToTable = this.buildAliasToTable(statement);
    const aliases = [...aliasToTable.entries()]
      .filter(([, table]) => table === baseTable)
      .map(([alias]) => alias);
    const columnExpressions = [...new Set([baseTable, ...aliases])]
      .map((alias) => `${alias}.${allowedField}`.toLowerCase());
    const normalizedSql = sql.toLowerCase();
    const hasAllowedTemporalField = columnExpressions.some((expression) =>
      normalizedSql.includes(expression),
    );
    if (!hasAllowedTemporalField) {
      throw new SqlValidationError('SQL AST 校验失败，缺少允许的时间字段。');
    }

    const hasStartBoundary = columnExpressions.some((expression) =>
      new RegExp(`${this.escapeRegExp(expression)}\\s*>=`, 'u').test(normalizedSql),
    );
    const hasEndBoundary = columnExpressions.some((expression) =>
      new RegExp(`${this.escapeRegExp(expression)}\\s*<`, 'u').test(normalizedSql),
    );
    if (!hasStartBoundary || !hasEndBoundary) {
      throw new SqlValidationError('SQL AST 校验失败，缺少完整时间边界。');
    }
  }

  private validateFunctions(statement: AstNode, allowedFunctions: string[]): void {
    const functionNames = new Set<string>();
    this.walkNode(statement, (node) => {
      if (node?.type === 'function') {
        const functionName = String(node.name?.name?.[0]?.value ?? '').toUpperCase();
        if (functionName) {
          functionNames.add(functionName);
        }
      }

      if (node?.type === 'aggr_func') {
        functionNames.add(String(node.name ?? '').toUpperCase());
      }

      if (node?.type === 'cast') {
        functionNames.add('CAST');
      }
    });

    const hasBlockedFunction = [...functionNames].some(
      (functionName) => !allowedFunctions.includes(functionName),
    );

    if (hasBlockedFunction) {
      throw new SqlValidationError('SQL AST 校验失败，存在未批准的函数调用。');
    }
  }

  private validateGrouping(statement: AstNode): void {
    const groupByColumns = new Set<string>();
    for (const item of statement.groupby?.columns ?? []) {
      for (const columnRef of this.collectColumnRefs(item)) {
        groupByColumns.add(columnRef);
      }
    }

    const selectColumns = (statement.columns ?? []).filter((item: AstNode) => item.expr?.type !== 'star');
    const nonAggregateColumns = selectColumns.flatMap((item: AstNode) => {
      if (item.expr?.type === 'aggr_func') {
        return [];
      }

      return this.collectColumnRefs(item.expr);
    });

    const hasUngroupedColumn = nonAggregateColumns.some((columnRef: string) => !groupByColumns.has(columnRef));
    if (nonAggregateColumns.length > 0 && hasUngroupedColumn) {
      throw new SqlValidationError('SQL AST 校验失败，GROUP BY 与选择列不匹配。');
    }
  }

  private validateOrdering(statement: AstNode): void {
    const selectableColumns = new Set<string>();
    for (const item of statement.columns ?? []) {
      if (item.as) {
        selectableColumns.add(String(item.as));
      }

      for (const columnRef of this.collectColumnRefs(item.expr)) {
        selectableColumns.add(columnRef.split('.').pop() ?? columnRef);
      }
    }

    const hasInvalidOrderBy = (statement.orderby ?? []).some((item: AstNode) => {
      const columnName = String(item.expr?.column ?? '');
      return !columnName || !selectableColumns.has(columnName);
    });

    if (hasInvalidOrderBy) {
      throw new SqlValidationError('SQL AST 校验失败，ORDER BY 字段不合法。');
    }
  }

  private validateLimit(statement: AstNode): void {
    const limitValue = Number(statement.limit?.value?.[0]?.value ?? 0);
    if (limitValue > 1000) {
      throw new SqlValidationError('SQL AST 校验失败，查询结果行数限制超出安全阈值。');
    }
  }

  private collectColumnRefs(node: AstNode | null | undefined): string[] {
    const refs: string[] = [];
    this.walkNode(node, (childNode) => {
      if (childNode?.type === 'column_ref') {
        refs.push(`${childNode.table ?? 'unknown'}.${childNode.column}`);
      }
    });
    return refs;
  }

  /**
   * 提取 JOIN ON 中真实的表间关联路径，忽略字段常量约束。
   *
   * 参数说明：
   * - `joinNode`：SQL AST 的 JOIN ON 表达式。
   * - `aliasToTable`：表别名到真实表名的映射。
   * 返回值：形如 `users.id=opportunities.user_id` 的关联路径数组。
   * 设计原因：合同有效收入需要在 JOIN ON 中同时限定自定义字段名，不能因为常量条件而误判为未批准关联。
   */
  private normalizeJoinPaths(joinNode: AstNode, aliasToTable: Map<string, string>): string[] {
    if (!joinNode || typeof joinNode !== 'object') {
      return [];
    }

    // ON 条件可能是 `表字段相等 AND 自定义字段名常量约束`，需要递归拆开逐段识别。
    if (String(joinNode.operator ?? '').toUpperCase() === 'AND') {
      return [
        ...this.normalizeJoinPaths(joinNode.left, aliasToTable),
        ...this.normalizeJoinPaths(joinNode.right, aliasToTable),
      ];
    }

    // 只有左右两边都是列引用时才视为表间关联；字段=常量只是 JOIN 的业务过滤条件。
    if (
      String(joinNode.operator ?? '') !== '=' ||
      joinNode.left?.type !== 'column_ref' ||
      joinNode.right?.type !== 'column_ref'
    ) {
      return [];
    }

    const leftTable = aliasToTable.get(String(joinNode.left.table ?? '')) ?? String(joinNode.left.table ?? '');
    const rightTable = aliasToTable.get(String(joinNode.right.table ?? '')) ?? String(joinNode.right.table ?? '');
    return [`${leftTable}.${String(joinNode.left.column ?? '')}=${rightTable}.${String(joinNode.right.column ?? '')}`];
  }

  /**
   * 建立 SQL AST 中表别名到真实表名的映射。
   *
   * 参数说明：`statement` 是已解析的 select 语句。
   * 返回值：别名与真实表名映射，未显式设置别名时使用表名本身。
   */
  private buildAliasToTable(statement: AstNode): Map<string, string> {
    const aliasToTable = new Map<string, string>();
    for (const item of statement.from ?? []) {
      aliasToTable.set(String(item.as ?? item.table), String(item.table));
    }
    return aliasToTable;
  }

  /**
   * 转义字符串以安全构造正则表达式。
   *
   * 参数说明：`value` 是需要匹配的 SQL 字段表达式。
   * 返回值：可放入正则表达式的安全片段。
   */
  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

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
}
