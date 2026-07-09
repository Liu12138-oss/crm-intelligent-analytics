import { buildWecomHelpPrompt } from '../../src/modules/wecom/wecom-ai-prompt.config';

describe('企业微信帮助提示主链说明', () => {
  it('能力说明应展示主链数据口径、分析维度和图表呈现方式', () => {
    const prompt = buildWecomHelpPrompt({
      scene: 'CAPABILITY',
    });

    expect(prompt).toContain('当前 CRM 主链可访问数据');
    expect(prompt).toContain('示例问题只用于引导提问，不作为线上数据源');
    expect(prompt).toContain('企微卡片、Markdown 摘要和完整报告链接');
    expect(prompt).toContain('完整图表放在报告页');
    expect(prompt).toContain('全国渠道商发展运营情况');
    expect(prompt).toContain('大北区26年一季度与二季度商机对比分析');
    expect(prompt).toContain('区域、大区、渠道商、技术服务商、销售负责人');
    expect(prompt).toContain('风险原因、动作建议和建议追问');
  });
});
