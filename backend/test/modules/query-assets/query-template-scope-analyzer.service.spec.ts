import { QueryTemplateScopeAnalyzerService } from '../../../src/modules/query-assets/query-template-scope-analyzer.service';

describe('QueryTemplateScopeAnalyzerService', () => {
  it('未声明 organization_id / department_id / user_id 条件时应识别为 AUTO_SCOPE', () => {
    const service = new QueryTemplateScopeAnalyzerService();
    const result = service.analyze(`
      SELECT o.id, o.title
      FROM opportunities o
      WHERE YEAR(o.created_at) = 2026
    `);

    expect(result.scopeMode).toBe('AUTO_SCOPE');
    expect(result.detectedScopeFields).toEqual([]);
  });

  it('声明 department_id 条件时应识别为 DECLARED_SCOPE', () => {
    const service = new QueryTemplateScopeAnalyzerService();
    const result = service.analyze(`
      SELECT o.id, o.title
      FROM opportunities o
      WHERE o.department_id IN (469, 578)
    `);

    expect(result.scopeMode).toBe('DECLARED_SCOPE');
    expect(result.detectedScopeFields).toEqual(['department_id']);
  });

  it('CASE 表达式生成 team_name 且来源于客户部门时应识别展示口径风险', () => {
    const service = new QueryTemplateScopeAnalyzerService();
    const result = service.analyze(`
      SELECT
        CASE WHEN d.name LIKE '大北区-%' THEN d.name ELSE d.name END AS team_name,
        SUM(o.expect_amount) AS amount
      FROM opportunities o
      INNER JOIN customers cu ON o.customer_id = cu.id
      INNER JOIN departments d ON cu.department_id = d.id
      WHERE o.organization_id IN (:scopeOrganizationIds)
        AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
      GROUP BY
        CASE WHEN d.name LIKE '大北区-%' THEN d.name ELSE d.name END
    `);

    expect(result.scopeClassification).toBe('COMPLEX_REVIEW_REQUIRED');
    expect(result.displayDimensionSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputName: 'team_name',
          sourceTable: 'departments',
          sourceColumn: 'name',
          lineageTable: 'customers',
          lineageColumn: 'department_id',
        }),
      ]),
    );
    expect(result.riskFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DISPLAY_SCOPE_MISMATCH',
          severity: 'HIGH',
        }),
      ]),
    );
  });

  it('静态 UNION ALL 团队目标清单应进入复杂审核', () => {
    const service = new QueryTemplateScopeAnalyzerService();
    const result = service.analyze(`
      SELECT tt.team_name, tt.annual_target
      FROM (
        SELECT '大北区-山东区' AS team_name, 2100 AS annual_target UNION ALL
        SELECT '大南区-深圳区', 4600
      ) tt
    `);

    expect(result.scopeClassification).toBe('COMPLEX_REVIEW_REQUIRED');
    expect(result.staticDimensionSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'UNION_TEAM_LIST',
          values: expect.arrayContaining(['大北区-山东区', '大南区-深圳区']),
        }),
      ]),
    );
  });

  it('SQL 解析失败时不得默认放行', () => {
    const service = new QueryTemplateScopeAnalyzerService();
    const result = service.analyze('SELECT FROM');

    expect(result.scopeClassification).toBe('COMPLEX_REVIEW_REQUIRED');
    expect(result.riskFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SQL_PARSE_FAILED',
          severity: 'HIGH',
        }),
      ]),
    );
  });
});
