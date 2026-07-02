import { DEFAULT_QUERY_TEMPLATES } from '../src/shared/mock/sample-data';
import { QueryTemplateScopeAnalyzerService } from '../src/modules/query-assets/query-template-scope-analyzer.service';

/**
 * 输出内置查询模板的范围治理分类。
 * 参数：无。
 * 返回：进程标准输出中的 JSON 报告。
 * 调用注意：该脚本只读取内置模板定义，不读取 `.runtime` 明文配置，避免把本地敏感信息写入报告。
 */
function main(): void {
  const analyzer = new QueryTemplateScopeAnalyzerService();
  const items = DEFAULT_QUERY_TEMPLATES.map((template) => {
    const snapshot = analyzer.analyze(template.sqlText);
    return {
      templateId: template.id,
      name: template.name,
      scopeClassification: snapshot.scopeClassification,
      reviewStatus: snapshot.reviewStatus,
      riskFindings: snapshot.riskFindings.map((item) => ({
        code: item.code,
        severity: item.severity,
        title: item.title,
        suggestion: item.suggestion,
      })),
    };
  });

  const summary = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.scopeClassification] = (acc[item.scopeClassification] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), summary, items }, null, 2));
}

main();
