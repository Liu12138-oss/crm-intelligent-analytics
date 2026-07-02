import { DEFAULT_QUERY_TEMPLATES } from '../../src/shared/mock/sample-data';

describe('默认查询模板样例数据', () => {
  it('内置常用查询说明应直接描述业务用途，不展示看板来源句式', () => {
    const descriptions = DEFAULT_QUERY_TEMPLATES.map((template) => ({
      id: template.id,
      description: template.description,
    }));

    expect(descriptions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringMatching(/源自|来源于/),
        }),
      ]),
    );
  });

  it('承诺商机预测模板应把赢单阶段纳入承诺口径', () => {
    const templateIds = [
      'tpl_company_year_completion_snapshot',
      'tpl_company_2026_completion',
      'tpl_company_committed_opportunity_summary',
    ];

    for (const templateId of templateIds) {
      const template = DEFAULT_QUERY_TEMPLATES.find(
        (item) => item.id === templateId,
      );

      expect(template?.sqlText).toContain("oa_commitment.custom_field_name = 'text_asset_96585a'");
      expect(template?.sqlText).toContain("oa_commitment.text_asset = 'sel_0cae'");
      expect(template?.sqlText).toContain("fv_stage.VALUE = '赢单'");
      expect(template?.sqlText).not.toContain(
        "fv_stage.VALUE NOT IN ('输单', '输单（项目取消）', '1%已联系上客户', '赢单')",
      );
    }
  });

  it('内置商机模板不应因客户、部门或阶段字典缺失把真实商机整批过滤为空', () => {
    const opportunityTemplates = DEFAULT_QUERY_TEMPLATES.filter((template) =>
      template.sqlText.includes('FROM opportunities o'),
    );

    for (const template of opportunityTemplates) {
      expect(template.sqlText).not.toContain('INNER JOIN customers cu ON o.customer_id = cu.id');
      expect(template.sqlText).not.toContain('INNER JOIN departments d ON o.department_id = d.id');
      expect(template.sqlText).not.toContain("AND fv_stage.VALUE NOT IN ('输单', '输单（项目取消）', '1%已联系上客户', '赢单')");
      expect(template.sqlText).not.toContain("AND fv_stage.VALUE NOT IN ('输单', '输单（项目取消）', '1%已联系上客户')");
    }
  });

  it('承诺商机季度拆分应统计承诺签约和赢单商机数量', () => {
    const template = DEFAULT_QUERY_TEMPLATES.find(
      (item) => item.id === 'tpl_company_committed_opportunity_summary',
    );

    expect(template?.sqlText).toContain("oa_commitment.custom_field_name = 'text_asset_96585a'");
    expect(template?.sqlText).toContain(
      "AND (oa_commitment.text_asset = 'sel_0cae' OR fv_stage.VALUE = '赢单')",
    );
    expect(template?.sqlText).toContain('COUNT(DISTINCT o.id) AS opportunity_count');
  });

  it('客户维度提单数据应包含合同有效收入字段', () => {
    const template = DEFAULT_QUERY_TEMPLATES.find(
      (item) => item.id === 'tpl_company_customer_contract_dimension',
    );

    expect(template?.sqlText).toContain("custom_field_name = 'numeric_asset_7ee237'");
    expect(template?.sqlText).toContain('valid_income');
    expect(template?.renderConfig.tableColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'valid_income', label: '有效收入（万元）' }),
      ]),
    );
  });
});
