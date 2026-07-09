import {
  buildWecomFollowUpTemplateEntryPrompt,
  buildWecomHelpPrompt,
} from '../../../src/modules/wecom/wecom-ai-prompt.config';

describe('wecom ai prompt config', () => {
  it('企微跟进首轮提示不应包含 emoji 图标，避免 markdown 渲染过大', () => {
    const prompt = buildWecomFollowUpTemplateEntryPrompt({
      requesterName: '测试用户',
    });

    expect(prompt).not.toContain('✅');
    expect(prompt).not.toContain('💡');
    expect(prompt).toContain('温馨提示：');
  });

  it('企微欢迎提示应优先展示经营问数能力，避免用户误以为只能写跟进', () => {
    const prompt = buildWecomHelpPrompt({
      scene: 'GREETING',
    });

    expect(prompt).toContain('经营分析问数');
    expect(prompt).toContain('全国渠道商发展运营情况');
    expect(prompt).toContain('大北区26年一季度与二季度商机对比分析');
    expect(prompt).toContain('你好呀，我是 CRM 智能小助手');
  });

  it('企微帮助提示应说明主链数据口径、图表呈现和分析维度', () => {
    const prompt = buildWecomHelpPrompt({
      scene: 'CAPABILITY',
    });

    expect(prompt).toContain('当前 CRM 主链可访问数据');
    expect(prompt).toContain('示例问题只用于引导提问，不作为线上数据源');
    expect(prompt).toContain('企微卡片、Markdown 摘要和完整报告链接');
    expect(prompt).toContain('完整图表放在报告页');
    expect(prompt).toContain('区域、大区、渠道商、技术服务商、销售负责人');
    expect(prompt).toContain('风险原因、动作建议和建议追问');
  });

  it('企微帮助提示应展示客户商机列表与详情查询能力', () => {
    const prompt = buildWecomHelpPrompt({
      scene: 'CAPABILITY',
    });

    expect(prompt).toContain('客户 / 商机列表与详情查询');
    expect(prompt).toContain('查中国银行客户列表');
    expect(prompt).toContain('看第2个详情');
  });
});
