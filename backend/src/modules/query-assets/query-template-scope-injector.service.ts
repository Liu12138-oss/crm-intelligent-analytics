import { Injectable } from '@nestjs/common';
import { Parser } from 'node-sql-parser';
import type { ScopeSnapshot } from '../../shared/types/domain';

type ScopedTable = 'opportunities' | 'contracts' | 'customers' | 'users';
type AstNode = Record<string, unknown>;
const SQL_IN_NO_MATCH_VALUE = '__crm_scope_no_match__';

@Injectable()
export class QueryTemplateScopeInjectorService {
  private readonly parser = new Parser();
  private readonly scopedTablePriority: ScopedTable[] = [
    'opportunities',
    'contracts',
    'customers',
    'users',
  ];

  inject(
    sqlText: string,
    scopeSnapshot: ScopeSnapshot,
  ): { sql: string; params: unknown[] } {
    const ast = this.parser.astify(sqlText);
    const statement = (Array.isArray(ast) ? ast[0] : ast) as unknown as AstNode;
    const params: unknown[] = [];

    this.injectIntoStatement(statement, scopeSnapshot, params);

    return {
      sql: this.parser.sqlify(statement as never),
      params,
    };
  }

  private injectIntoStatement(
    statement: AstNode,
    scopeSnapshot: ScopeSnapshot,
    params: unknown[],
  ): void {
    const withNodes = Array.isArray(statement.with)
      ? (statement.with as AstNode[])
      : [];
    for (const item of withNodes) {
      const cteAst = item.stmt && typeof item.stmt === 'object'
        ? (item.stmt as { ast?: AstNode }).ast
        : undefined;
      if (cteAst) {
        this.injectIntoStatement(cteAst, scopeSnapshot, params);
      }
    }

    this.injectIntoSelect(statement, scopeSnapshot, params);

    const nextNode = statement._next;
    if (nextNode && typeof nextNode === 'object') {
      this.injectIntoStatement(nextNode as AstNode, scopeSnapshot, params);
    }
  }

  private injectIntoSelect(
    selectNode: AstNode,
    scopeSnapshot: ScopeSnapshot,
    params: unknown[],
  ): void {
    const scopedEntries = this.resolveScopedEntries(selectNode.from);
    if (scopedEntries.length > 0) {
      let nextWhere = selectNode.where as AstNode | undefined;
      for (const item of scopedEntries) {
        const scopeCondition = this.buildScopeCondition(
          item.alias,
          item.table,
          scopeSnapshot,
          params,
        );
        nextWhere = nextWhere
          ? {
              type: 'binary_expr',
              operator: 'AND',
              left: nextWhere,
              right: scopeCondition,
            }
          : scopeCondition;
      }
      selectNode.where = nextWhere;
    }

    const fromItems = Array.isArray(selectNode.from)
      ? (selectNode.from as AstNode[])
      : [];
    for (const item of fromItems) {
      const nestedAst = item.expr && typeof item.expr === 'object'
        ? (item.expr as { ast?: AstNode }).ast
        : undefined;
      if (nestedAst) {
        this.injectIntoStatement(nestedAst, scopeSnapshot, params);
      }
    }
  }

  private resolveScopedEntries(
    fromValue: unknown,
  ): Array<{ table: ScopedTable; alias: string }> {
    const fromItems = Array.isArray(fromValue) ? (fromValue as AstNode[]) : [];
    const directEntries = fromItems
      .filter((item) => typeof item.table === 'string')
      .map((item) => ({
        table: String(item.table).toLowerCase() as ScopedTable,
        alias: String(item.as ?? item.table),
      }))
      .filter((item) => this.scopedTablePriority.includes(item.table));

    const selectedTable = this.scopedTablePriority.find((tableName) =>
      directEntries.some((item) => item.table === tableName),
    );
    if (!selectedTable) {
      return [];
    }

    return directEntries.filter((item) => item.table === selectedTable);
  }

  private buildScopeCondition(
    alias: string,
    tableName: ScopedTable,
    scopeSnapshot: ScopeSnapshot,
    params: unknown[],
  ): AstNode {
    params.push(this.normalizeSqlInScopeValues(scopeSnapshot.organizationIds));
    const organizationExpr = this.buildInExpression(alias, 'organization_id');

    if (tableName === 'users') {
      return organizationExpr;
    }

    params.push(this.normalizeSqlInScopeValues(scopeSnapshot.departmentIds));
    const departmentExpr = this.buildInExpression(alias, 'department_id');

    params.push(this.normalizeSqlInScopeValues(scopeSnapshot.ownerIds));
    const ownerExpr = this.buildInExpression(alias, 'user_id');

    return {
      type: 'binary_expr',
      operator: 'AND',
      left: organizationExpr,
      right: {
        type: 'binary_expr',
        operator: 'OR',
        parentheses: true,
        left: departmentExpr,
        right: ownerExpr,
      },
    };
  }

  private buildInExpression(alias: string, columnName: string): AstNode {
    return {
      type: 'binary_expr',
      operator: 'IN',
      left: {
        type: 'column_ref',
        table: alias,
        column: columnName,
      },
      right: {
        type: 'expr_list',
        value: [
          {
            type: 'origin',
            value: '?',
          },
        ],
      },
    };
  }

  /**
   * 自动注入权限条件时同样要避免空数组被 mysql2 展开为非法的 `IN ()`。
   */
  private normalizeSqlInScopeValues(values: string[]): string[] {
    return values.length > 0 ? values : [SQL_IN_NO_MATCH_VALUE];
  }
}
