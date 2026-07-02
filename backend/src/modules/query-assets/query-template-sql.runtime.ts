import { BadRequestException } from '@nestjs/common';
import type {
  QueryTemplateParameterDefinition,
  QueryTemplateRecord,
} from '../../shared/types/domain';

/**
 * 解析模板最终执行参数，合并参数 schema 默认值、模板默认筛选条件和本次调用参数。
 */
export function buildTemplateExecutionParams(params: {
  template: Pick<QueryTemplateRecord, 'defaultFilters' | 'parameterSchema'>;
  parameters?: Record<string, unknown>;
}): Record<string, unknown> {
  const mergedParams: Record<string, unknown> = {};

  for (const definition of params.template.parameterSchema ?? []) {
    if (definition.defaultValue !== undefined) {
      mergedParams[definition.key] = definition.defaultValue;
    }
  }

  Object.assign(mergedParams, params.template.defaultFilters ?? {});
  Object.assign(mergedParams, params.parameters ?? {});

  for (const definition of params.template.parameterSchema ?? []) {
    ensureRequiredTemplateParameter(definition, mergedParams);
  }

  return mergedParams;
}

/**
 * 将 `:namedParam` 形式的作者原始 SQL 编译成 mysql2 可执行的 `?` 参数数组。
 */
export function compileNamedTemplateSql(
  sqlText: string,
  params: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const orderedParams: unknown[] = [];
  const compiledSql = sqlText.replace(
    /:([a-zA-Z_][a-zA-Z0-9_]*)/gu,
    (_fullMatch, paramName: string) => {
      if (!(paramName in params)) {
        throw new BadRequestException(
          '当前查询缺少必要条件，请补充完整后再试。',
        );
      }

      orderedParams.push(params[paramName]);
      return '?';
    },
  );

  return {
    sql: compiledSql,
    params: orderedParams,
  };
}

/**
 * 将自由问数保存下来的编译后 SQL 转回模板可复跑的命名参数 SQL。
 *
 * @param params.sqlText 自由问数生成的 SQL，可能带任务标题注释和 `?` 占位符。
 * @param params.defaultFilters 原查询过滤条件，用于保留时间范围等业务条件。
 * @returns 可交给模板执行器绑定的 SQL 与默认过滤条件。
 */
export function normalizeGeneratedQueryTemplateSql(params: {
  sqlText: string;
  defaultFilters: Record<string, unknown>;
}): {
  sqlText: string;
  defaultFilters: Record<string, unknown>;
} {
  const primarySql = extractPrimaryGeneratedQueryBlock(params.sqlText);
  const normalizedSql = primarySql
    .replace(
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\.organization_id\s+IN\s*\((?:\s*\?\s*,?)+\)/gu,
      '$1.organization_id IN (:scopeOrganizationIds)',
    )
    .replace(
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\.department_id\s+IN\s*\((?:\s*\?\s*,?)+\)/gu,
      '$1.department_id IN (:scopeDepartmentIds)',
    )
    .replace(
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\.user_id\s+IN\s*\((?:\s*\?\s*,?)+\)/gu,
      '$1.user_id IN (:scopeOwnerIds)',
    )
    .replace(
      /\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\.user_id IN \(:scopeOwnerIds\)\s+OR\s+\1\.department_id IN \(:scopeDepartmentIds\)\s*\)/gu,
      '(:scopeUnrestricted = 1 OR $1.department_id IN (:scopeDepartmentIds) OR $1.user_id IN (:scopeOwnerIds))',
    )
    .replace(
      /\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\.department_id IN \(:scopeDepartmentIds\)\s+OR\s+\1\.user_id IN \(:scopeOwnerIds\)\s*\)/gu,
      '(:scopeUnrestricted = 1 OR $1.department_id IN (:scopeDepartmentIds) OR $1.user_id IN (:scopeOwnerIds))',
    )
    .replace(
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\.(created_at|finish_approve_at)\s*>=\s*\?/gu,
      '$1.$2 >= :startAt',
    )
    .replace(
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\.(created_at|finish_approve_at)\s*<\s*\?/gu,
      '$1.$2 < :endAt',
    )
    .replace(/\bLIMIT\s+\?/giu, 'LIMIT :rowLimit')
    .trim();

  if (normalizedSql.includes('?')) {
    throw new BadRequestException(
      '当前问数结果暂时不能保存为模板，因为它包含系统暂不能复跑的临时查询条件。请在模板治理中手工创建 SQL 模板后再使用。',
    );
  }

  return {
    sqlText: normalizedSql,
    defaultFilters: buildSavedTemplateDefaultFilters(params.defaultFilters, normalizedSql),
  };
}

/**
 * 自由问数可能生成多段任务 SQL，保存为单模板时只保留首个主结果 SQL。
 */
function extractPrimaryGeneratedQueryBlock(sqlText: string): string {
  return sqlText
    .trim()
    .split(/\r?\n\s*\r?\n(?=--\s+)/u)[0]
    ?.trim() ?? sqlText.trim();
}

/**
 * 保存模板时移除一次执行时的权限快照，保留用户查询条件并补齐默认行数。
 */
function buildSavedTemplateDefaultFilters(
  filters: Record<string, unknown>,
  sqlText: string,
): Record<string, unknown> {
  const businessFilters = { ...filters };
  delete businessFilters.organizationIds;
  delete businessFilters.departmentIds;
  delete businessFilters.ownerIds;

  if (sqlText.includes(':rowLimit') && businessFilters.rowLimit === undefined) {
    businessFilters.rowLimit = 100;
  }

  return businessFilters;
}

/**
 * 提取 SQL 中真实引用的数据表，自动跳过 CTE 名称，供白名单校验复用。
 */
export function extractReferencedTables(sqlText: string): string[] {
  const normalizedSql = sqlText.trim();
  const cteNames = new Set(
    Array.from(
      normalizedSql.matchAll(/(?:\bwith\b|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(/giu),
    )
      .map((match) => match[1]?.trim().toLowerCase())
      .filter(Boolean),
  );
  const referencedTables = new Set<string>();
  const tableMatches =
    normalizedSql.matchAll(/\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)/giu);

  for (const match of tableMatches) {
    const tableName = match[1]?.trim().toLowerCase();
    if (!tableName || cteNames.has(tableName)) {
      continue;
    }

    referencedTables.add(tableName);
  }

  return [...referencedTables];
}

function ensureRequiredTemplateParameter(
  definition: QueryTemplateParameterDefinition,
  params: Record<string, unknown>,
): void {
  if (!definition.required) {
    return;
  }

  const value = params[definition.key];
  if (value === undefined || value === null || value === '') {
    throw new BadRequestException(`模板参数 ${definition.label} 不能为空。`);
  }
}
