import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Parser } from 'node-sql-parser';
import type {
  QueryTemplateDisplayDimensionSource,
  QueryTemplateScopeClassification,
  QueryTemplateScopePredicateSource,
  QueryTemplateScopeRiskFinding,
  QueryTemplateScopeValidationSnapshot,
  QueryTemplateStaticDimensionSource,
} from '../../shared/types/domain';

type ScopedField = 'organization_id' | 'department_id' | 'user_id';
type ScopeValueMap = Partial<Record<ScopedField, string[]>>;
type AstNode = Record<string, unknown>;

@Injectable()
export class QueryTemplateScopeAnalyzerService {
  private readonly parser = new Parser();
  private readonly scopedFields = new Set<ScopedField>([
    'organization_id',
    'department_id',
    'user_id',
  ]);
  private readonly primaryTablePriority = [
    'opportunities',
    'contracts',
    'customers',
    'users',
  ];

  /**
   * 分析模板 SQL 的权限收口方式和展示口径风险。
   * 参数：模板原始 SQL。
   * 返回：兼容旧字段的范围分析快照，同时补充治理分类、风险和修复建议。
   */
  analyze(sqlText: string): QueryTemplateScopeValidationSnapshot {
    const normalizedSql = sqlText.trim();
    let ast: AstNode;

    try {
      ast = this.parseSql(normalizedSql);
    } catch {
      return this.buildSnapshot({
        sqlText: normalizedSql,
        scopeClassification: 'COMPLEX_REVIEW_REQUIRED',
        detectedScopeFields: [],
        scopePredicateSources: [],
        primaryDataSources: [],
        displayDimensionSources: [],
        staticDimensionSources: [],
        riskFindings: [
          this.buildRiskFinding(
            'SQL_PARSE_FAILED',
            'HIGH',
            'SQL 解析失败',
            '系统暂时无法解析这条模板 SQL，因此不能证明它会按当前权限安全收口。',
            '请先修正 SQL 语法，或让治理人员审核后再发布。',
          ),
        ],
      });
    }

    const analysis = this.collectScopeAnalysis(ast, {}, true);
    const primaryDataSources = this.collectPrimaryDataSources(ast);
    const scopePredicateSources = this.collectScopePredicateSources(ast);
    const staticDimensionSources = this.collectStaticDimensionSources(normalizedSql);
    const displayDimensionSources = this.collectDisplayDimensionSources(ast);
    const riskFindings: QueryTemplateScopeRiskFinding[] = [];

    if (staticDimensionSources.length > 0) {
      riskFindings.push(
        this.buildRiskFinding(
          'STATIC_TEAM_LIST',
          'HIGH',
          '存在静态团队清单',
          '模板内置了固定团队或目标清单，普通用户执行时可能看到授权范围外的团队名称。',
          '请将目标清单迁移为可按部门 ID 收口的配置，或由治理人员补充审核说明。',
        ),
      );
    }

    const displayMismatch = this.hasDisplayScopeMismatch(
      displayDimensionSources,
      scopePredicateSources,
    );
    if (displayMismatch) {
      riskFindings.push(
        this.buildRiskFinding(
          'DISPLAY_SCOPE_MISMATCH',
          'HIGH',
          '展示口径与权限过滤口径不一致',
          '模板按商机或合同归属收口，但团队或部门名称来自客户归属部门，可能让用户看到其它区域名称。',
          '请改成按主业务对象归属部门展示，或为客户归属展示口径补充治理审核。',
        ),
      );
    }

    const primaryScopedTables = primaryDataSources.filter((item) =>
      this.primaryTablePriority.includes(item.table),
    );
    if (primaryScopedTables.length > 1 && scopePredicateSources.length === 0) {
      riskFindings.push(
        this.buildRiskFinding(
          'MULTI_PRIMARY_SOURCE',
          'MEDIUM',
          '存在多个主业务表',
          '模板同时读取多个可收口业务表，但没有明确声明哪个表作为权限主口径。',
          '请声明权限主表，或拆分为多个单口径模板。',
        ),
      );
    }

    const fixedScopePredicates = scopePredicateSources.filter(
      (item) => item.sourceType === 'FIXED_VALUE' || item.sourceType === 'MIXED',
    );
    if (fixedScopePredicates.length > 0) {
      riskFindings.push(
        this.buildRiskFinding(
          'FIXED_SCOPE',
          'MEDIUM',
          '模板写死了固定范围',
          '模板 SQL 中包含固定部门、组织或负责人条件，需要确认当前用户是否覆盖该范围。',
          '请将固定范围改成系统自动收口，或只向覆盖该范围的用户发布。',
        ),
      );
    }

    const detectedScopeFields = [...analysis.detectedScopeFields];
    const scopeClassification = this.resolveScopeClassification({
      riskFindings,
      detectedScopeFields,
      fixedScopePredicates,
      primaryScopedTables,
    });

    return this.buildSnapshot({
      sqlText: normalizedSql,
      scopeClassification,
      detectedScopeFields,
      scopePredicateSources,
      primaryDataSources,
      displayDimensionSources,
      staticDimensionSources,
      riskFindings,
    });
  }

  /**
   * 提取模板中显式声明的固定或运行时范围，供执行前兼容性校验使用。
   */
  extractDeclaredScope(
    sqlText: string,
    runtimeParams: Record<string, unknown> = {},
  ): {
    organizationIds: string[];
    departmentIds: string[];
    ownerIds: string[];
  } {
    const ast = this.parseSql(sqlText);
    const analysis = this.collectScopeAnalysis(ast, runtimeParams);
    if (analysis.unsupportedReason) {
      throw new BadRequestException(analysis.unsupportedReason);
    }

    return {
      organizationIds: analysis.scopeValues.organization_id ?? [],
      departmentIds: analysis.scopeValues.department_id ?? [],
      ownerIds: analysis.scopeValues.user_id ?? [],
    };
  }

  private parseSql(sqlText: string): AstNode {
    const ast = this.parser.astify(sqlText);
    return (Array.isArray(ast) ? ast[0] : ast) as unknown as AstNode;
  }

  private buildSnapshot(params: {
    sqlText: string;
    scopeClassification: QueryTemplateScopeClassification;
    detectedScopeFields: ScopedField[];
    scopePredicateSources: QueryTemplateScopePredicateSource[];
    primaryDataSources: Array<{ table: string; alias?: string }>;
    displayDimensionSources: QueryTemplateDisplayDimensionSource[];
    staticDimensionSources: QueryTemplateStaticDimensionSource[];
    riskFindings: QueryTemplateScopeRiskFinding[];
  }): QueryTemplateScopeValidationSnapshot {
    const scopeMode =
      params.scopeClassification === 'AUTO_SCOPABLE' ? 'AUTO_SCOPE' : 'DECLARED_SCOPE';
    const reviewStatus =
      params.scopeClassification === 'UNSAFE_SCOPE'
        ? 'BLOCKED'
        : params.scopeClassification === 'COMPLEX_REVIEW_REQUIRED'
          ? 'REVIEW_REQUIRED'
          : params.riskFindings.length > 0
            ? 'REVIEW_REQUIRED'
            : 'APPROVED';
    const fixSuggestions = params.riskFindings.map((item) => item.suggestion);

    return {
      scopeMode,
      scopeClassification: params.scopeClassification,
      reviewStatus,
      detectedScopeFields: params.detectedScopeFields,
      primaryDataSources: params.primaryDataSources,
      scopePredicateSources: params.scopePredicateSources,
      displayDimensionSources: params.displayDimensionSources,
      staticDimensionSources: params.staticDimensionSources,
      riskFindings: params.riskFindings,
      friendlyMessage: this.buildFriendlyMessage(params.scopeClassification, params.riskFindings),
      fixSuggestions,
      snapshotHash: createHash('sha256')
        .update(JSON.stringify({
          sqlText: params.sqlText,
          scopeClassification: params.scopeClassification,
          riskCodes: params.riskFindings.map((item) => item.code),
        }))
        .digest('hex'),
    };
  }

  private resolveScopeClassification(params: {
    riskFindings: QueryTemplateScopeRiskFinding[];
    detectedScopeFields: ScopedField[];
    fixedScopePredicates: QueryTemplateScopePredicateSource[];
    primaryScopedTables: Array<{ table: string; alias?: string }>;
  }): QueryTemplateScopeClassification {
    if (
      params.riskFindings.some((item) =>
        ['STATIC_TEAM_LIST', 'DISPLAY_SCOPE_MISMATCH', 'MULTI_PRIMARY_SOURCE'].includes(item.code),
      )
    ) {
      return 'COMPLEX_REVIEW_REQUIRED';
    }

    if (params.fixedScopePredicates.length > 0) {
      return 'FIXED_SCOPE';
    }

    if (params.detectedScopeFields.length > 0) {
      return 'DECLARED_DYNAMIC_SCOPE';
    }

    return params.primaryScopedTables.length > 0
      ? 'AUTO_SCOPABLE'
      : 'COMPLEX_REVIEW_REQUIRED';
  }

  private buildFriendlyMessage(
    classification: QueryTemplateScopeClassification,
    riskFindings: QueryTemplateScopeRiskFinding[],
  ): string {
    if (classification === 'AUTO_SCOPABLE') {
      return '未检测到显式范围条件，系统将在执行时按当前用户权限自动收口。';
    }

    if (classification === 'DECLARED_DYNAMIC_SCOPE') {
      return '检测到模板已使用运行时范围参数，执行时将按当前用户权限做范围兼容性校验。';
    }

    if (classification === 'FIXED_SCOPE') {
      return '检测到模板限定了固定部门、组织或负责人范围，执行前必须确认当前用户权限覆盖该范围。';
    }

    if (riskFindings.length > 0) {
      return `当前模板需要治理复核：${riskFindings.map((item) => item.title).join('；')}。`;
    }

    return '当前模板较复杂，需要治理人员确认权限主表和展示口径后再发布。';
  }

  private buildRiskFinding(
    code: QueryTemplateScopeRiskFinding['code'],
    severity: QueryTemplateScopeRiskFinding['severity'],
    title: string,
    description: string,
    suggestion: string,
  ): QueryTemplateScopeRiskFinding {
    return {
      code,
      severity,
      title,
      description,
      suggestion,
    };
  }

  private collectPrimaryDataSources(ast: AstNode): Array<{ table: string; alias?: string }> {
    const sources = new Map<string, { table: string; alias?: string }>();
    for (const statement of this.collectSelectStatements(ast)) {
      for (const item of this.getFromItems(statement)) {
        if (typeof item.table !== 'string') {
          continue;
        }
        const table = item.table.toLowerCase();
        const alias = typeof item.as === 'string' ? item.as : table;
        sources.set(`${table}:${alias}`, { table, alias });
      }
    }
    return [...sources.values()];
  }

  private collectScopePredicateSources(ast: AstNode): QueryTemplateScopePredicateSource[] {
    const predicates: QueryTemplateScopePredicateSource[] = [];
    for (const statement of this.collectSelectStatements(ast)) {
      const aliasMap = this.buildAliasMap(statement);
      this.walkAst(statement.where as AstNode | undefined, (node) => {
        if (node.type !== 'binary_expr') {
          return;
        }

        const leftNode = node.left as AstNode | undefined;
        if (!leftNode || leftNode.type !== 'column_ref') {
          return;
        }

        const field = String(leftNode.column ?? '').toLowerCase() as ScopedField;
        if (!this.scopedFields.has(field)) {
          return;
        }

        const alias = typeof leftNode.table === 'string' ? leftNode.table : undefined;
        const values = this.collectLiteralScopeValues(node.right as AstNode | undefined);
        predicates.push({
          table: alias ? aliasMap.get(alias)?.table : undefined,
          alias,
          field,
          sourceType: this.resolvePredicateSourceType(node.right as AstNode | undefined),
          values,
        });
      });
    }
    return predicates;
  }

  private collectDisplayDimensionSources(ast: AstNode): QueryTemplateDisplayDimensionSource[] {
    const sources: QueryTemplateDisplayDimensionSource[] = [];
    for (const statement of this.collectSelectStatements(ast)) {
      const aliasMap = this.buildAliasMap(statement);
      const departmentLineage = this.buildDepartmentLineage(statement, aliasMap);
      const columns = Array.isArray(statement.columns) ? (statement.columns as AstNode[]) : [];

      for (const column of columns) {
        const outputName = String(column.as ?? '').toLowerCase();
        if (!/(team|department|dept|owner|region).*name|^(team_name|department_name|owner_name)$/u.test(outputName)) {
          continue;
        }

        const refs = this.collectColumnRefs(column.expr as AstNode | undefined);
        for (const ref of refs) {
          const source = ref.table ? aliasMap.get(ref.table) : undefined;
          const lineage = ref.table ? departmentLineage.get(ref.table) : undefined;
          sources.push({
            outputName,
            sourceTable: source?.table,
            sourceAlias: ref.table,
            sourceColumn: ref.column,
            lineageTable: lineage?.table,
            lineageAlias: lineage?.alias,
            lineageColumn: lineage?.column,
            expressionSummary: outputName,
          });
        }
      }
    }
    return sources;
  }

  private collectStaticDimensionSources(sqlText: string): QueryTemplateStaticDimensionSource[] {
    const values = [...sqlText.matchAll(/(?:^|UNION\s+ALL)\s*SELECT\s+'([^']+)'(?:\s+AS\s+team_name)?\s*,/gimu)]
      .map((item) => item[1])
      .filter((item): item is string => Boolean(item));
    const uniqueValues = Array.from(new Set(values));

    return uniqueValues.length > 0
      ? [
          {
            sourceType: 'UNION_TEAM_LIST',
            values: uniqueValues,
            detail: '模板通过 UNION ALL 内置团队目标或团队枚举。',
          },
        ]
      : [];
  }

  private hasDisplayScopeMismatch(
    displaySources: QueryTemplateDisplayDimensionSource[],
    scopePredicates: QueryTemplateScopePredicateSource[],
  ): boolean {
    const scopedMainTables = new Set(
      scopePredicates
        .map((item) => item.table)
        .filter((item): item is string => Boolean(item))
        .filter((item) => item === 'opportunities' || item === 'contracts'),
    );
    if (scopedMainTables.size === 0) {
      return false;
    }

    return displaySources.some(
      (item) =>
        item.sourceTable === 'departments' &&
        item.lineageTable === 'customers' &&
        item.lineageColumn === 'department_id',
    );
  }

  private buildAliasMap(statement: AstNode): Map<string, { table: string; alias: string }> {
    const aliasMap = new Map<string, { table: string; alias: string }>();
    for (const item of this.getFromItems(statement)) {
      if (typeof item.table !== 'string') {
        continue;
      }
      const table = item.table.toLowerCase();
      const alias = typeof item.as === 'string' ? item.as : table;
      aliasMap.set(alias, { table, alias });
      aliasMap.set(table, { table, alias });
    }
    return aliasMap;
  }

  private buildDepartmentLineage(
    statement: AstNode,
    aliasMap: Map<string, { table: string; alias: string }>,
  ): Map<string, { table: string; alias: string; column: string }> {
    const lineage = new Map<string, { table: string; alias: string; column: string }>();
    for (const item of this.getFromItems(statement)) {
      const onNode = item.on as AstNode | undefined;
      if (!onNode) {
        continue;
      }

      this.walkAst(onNode, (node) => {
        if (node.type !== 'binary_expr' || String(node.operator) !== '=') {
          return;
        }

        const left = node.left as AstNode | undefined;
        const right = node.right as AstNode | undefined;
        if (left?.type !== 'column_ref' || right?.type !== 'column_ref') {
          return;
        }

        const leftRef = this.toColumnRef(left);
        const rightRef = this.toColumnRef(right);
        this.rememberDepartmentLineage(lineage, aliasMap, leftRef, rightRef);
        this.rememberDepartmentLineage(lineage, aliasMap, rightRef, leftRef);
      });
    }
    return lineage;
  }

  private rememberDepartmentLineage(
    lineage: Map<string, { table: string; alias: string; column: string }>,
    aliasMap: Map<string, { table: string; alias: string }>,
    departmentRef: { table?: string; column: string },
    sourceRef: { table?: string; column: string },
  ): void {
    const departmentTable = departmentRef.table
      ? aliasMap.get(departmentRef.table)?.table
      : undefined;
    if (departmentTable !== 'departments' || departmentRef.column !== 'id' || !departmentRef.table || !sourceRef.table) {
      return;
    }

    const source = aliasMap.get(sourceRef.table);
    if (!source || sourceRef.column !== 'department_id') {
      return;
    }

    lineage.set(departmentRef.table, {
      table: source.table,
      alias: source.alias,
      column: sourceRef.column,
    });
  }

  private collectSelectStatements(ast: AstNode): AstNode[] {
    const statements: AstNode[] = [];
    this.walkAst(ast, (node) => {
      if (node.type === 'select') {
        statements.push(node);
      }
    });
    return statements;
  }

  private getFromItems(statement: AstNode): AstNode[] {
    return Array.isArray(statement.from) ? (statement.from as AstNode[]) : [];
  }

  private collectColumnRefs(node: AstNode | undefined): Array<{ table?: string; column: string }> {
    const refs: Array<{ table?: string; column: string }> = [];
    this.walkAst(node, (current) => {
      if (current.type !== 'column_ref') {
        return;
      }
      refs.push(this.toColumnRef(current));
    });
    return refs;
  }

  private toColumnRef(node: AstNode): { table?: string; column: string } {
    return {
      table: typeof node.table === 'string' ? node.table : undefined,
      column: String(node.column ?? '').toLowerCase(),
    };
  }

  private walkAst(node: unknown, visitor: (node: AstNode) => void): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        this.walkAst(item, visitor);
      }
      return;
    }

    const current = node as AstNode;
    visitor(current);
    for (const value of Object.values(current)) {
      this.walkAst(value, visitor);
    }
  }

  private resolvePredicateSourceType(node: AstNode | undefined): QueryTemplateScopePredicateSource['sourceType'] {
    const hasParam = this.containsNodeType(node, 'param');
    const hasLiteral = this.collectLiteralScopeValues(node).length > 0;
    if (hasParam && hasLiteral) {
      return 'MIXED';
    }
    if (hasParam) {
      return 'PARAMETER';
    }
    if (hasLiteral) {
      return 'FIXED_VALUE';
    }
    return 'UNKNOWN';
  }

  private containsNodeType(node: AstNode | undefined, type: string): boolean {
    let matched = false;
    this.walkAst(node, (current) => {
      if (current.type === type) {
        matched = true;
      }
    });
    return matched;
  }

  private collectLiteralScopeValues(node: AstNode | undefined): string[] {
    const values: string[] = [];
    this.walkAst(node, (current) => {
      if (
        current.type === 'number' ||
        current.type === 'string' ||
        current.type === 'single_quote_string'
      ) {
        values.push(String(current.value));
      }
    });
    return values;
  }

  private collectScopeAnalysis(
    statement: AstNode,
    runtimeParams: Record<string, unknown>,
    allowUnresolvedParams = false,
  ): {
    detectedScopeFields: Set<ScopedField>;
    scopeValues: ScopeValueMap;
    unsupportedReason?: string;
  } {
    const detectedScopeFields = new Set<ScopedField>();
    const scopeValues: ScopeValueMap = {};

    const processSelect = (selectNode: AstNode): string | undefined => {
      const localReason = this.collectScopeFromExpression(
        selectNode.where as AstNode | undefined,
        runtimeParams,
        detectedScopeFields,
        scopeValues,
        allowUnresolvedParams,
      );
      if (localReason) {
        return localReason;
      }

      for (const item of this.getFromItems(selectNode)) {
        const nestedAst = item.expr && typeof item.expr === 'object'
          ? (item.expr as { ast?: AstNode }).ast
          : undefined;
        if (nestedAst) {
          const nestedReason = processSelect(nestedAst);
          if (nestedReason) {
            return nestedReason;
          }
        }
      }

      const nextNode = selectNode._next;
      if (nextNode && typeof nextNode === 'object') {
        return processSelect(nextNode as AstNode);
      }

      return undefined;
    };

    const withNodes = Array.isArray(statement.with)
      ? (statement.with as AstNode[])
      : [];
    for (const item of withNodes) {
      const ast = item.stmt && typeof item.stmt === 'object'
        ? (item.stmt as { ast?: AstNode }).ast
        : undefined;
      if (ast) {
        const reason = processSelect(ast);
        if (reason) {
          return {
            detectedScopeFields,
            scopeValues,
            unsupportedReason: reason,
          };
        }
      }
    }

    const topReason = processSelect(statement);
    return {
      detectedScopeFields,
      scopeValues,
      unsupportedReason: topReason,
    };
  }

  private collectScopeFromExpression(
    node: AstNode | undefined,
    runtimeParams: Record<string, unknown>,
    detectedScopeFields: Set<ScopedField>,
    scopeValues: ScopeValueMap,
    allowUnresolvedParams: boolean,
  ): string | undefined {
    if (!node || String(node.type ?? '') !== 'binary_expr') {
      return undefined;
    }

    const operator = String(node.operator ?? '').toUpperCase();
    if (operator === 'AND' || operator === 'OR') {
      const leftReason = this.collectScopeFromExpression(
        node.left as AstNode | undefined,
        runtimeParams,
        detectedScopeFields,
        scopeValues,
        allowUnresolvedParams,
      );
      if (leftReason) {
        return leftReason;
      }

      return this.collectScopeFromExpression(
        node.right as AstNode | undefined,
        runtimeParams,
        detectedScopeFields,
        scopeValues,
        allowUnresolvedParams,
      );
    }

    const leftNode = node.left as AstNode | undefined;
    if (!leftNode || leftNode.type !== 'column_ref') {
      return undefined;
    }

    const fieldName = String(leftNode.column ?? '').toLowerCase() as ScopedField;
    if (!this.scopedFields.has(fieldName)) {
      return undefined;
    }

    detectedScopeFields.add(fieldName);
    if (operator !== '=' && operator !== 'IN') {
      return '当前 SQL 的范围条件较复杂，系统暂时无法安全判断是否应自动按权限收口。请改成标准的 organization_id / department_id / user_id 条件，或去掉范围条件交给系统自动处理。';
    }

    const resolvedValues = this.resolveScopeValues(
      node.right as AstNode | undefined,
      runtimeParams,
      allowUnresolvedParams,
    );
    if (resolvedValues instanceof Error) {
      return resolvedValues.message;
    }

    scopeValues[fieldName] = [
      ...(scopeValues[fieldName] ?? []),
      ...resolvedValues,
    ];
    return undefined;
  }

  private resolveScopeValues(
    rightNode: AstNode | undefined,
    runtimeParams: Record<string, unknown>,
    allowUnresolvedParams: boolean,
  ): string[] | Error {
    if (!rightNode) {
      return [];
    }

    if (rightNode.type === 'expr_list') {
      const values = Array.isArray(rightNode.value) ? rightNode.value : [];
      const resolved: string[] = [];
      for (const item of values) {
        const nextValue = this.resolveScopeValues(
          item as AstNode | undefined,
          runtimeParams,
          allowUnresolvedParams,
        );
        if (nextValue instanceof Error) {
          return nextValue;
        }
        resolved.push(...nextValue);
      }
      return resolved;
    }

    if (
      rightNode.type === 'number' ||
      rightNode.type === 'string' ||
      rightNode.type === 'single_quote_string'
    ) {
      return [String(rightNode.value)];
    }

    if (rightNode.type === 'param') {
      const paramName = String(rightNode.value ?? '');
      const runtimeValue = runtimeParams[paramName];
      if (runtimeValue === undefined || runtimeValue === null) {
        if (allowUnresolvedParams) {
          return [];
        }

        return new Error(
          '当前 SQL 的范围条件依赖运行时参数，系统暂时无法在校验阶段确认其权限范围。请改成固定的标准范围条件，或切换为自动权限收口模式。',
        );
      }

      return Array.isArray(runtimeValue)
        ? runtimeValue.map((item) => String(item))
        : [String(runtimeValue)];
    }

    return new Error(
      '当前 SQL 的范围条件较复杂，系统暂时无法安全判断是否应自动按权限收口。请改成标准的 organization_id / department_id / user_id 条件，或去掉范围条件交给系统自动处理。',
    );
  }
}
