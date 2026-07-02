import { AiGatewayService } from '../../../src/modules/analysis/ai-gateway.service';
import { WECOM_FOLLOW_UP_STRUCTURED_DRAFT_FIXTURES } from '../../../src/modules/analysis/capability-packs/fixtures/wecom-follow-up-structured-draft.fixtures';
import { parseWecomFollowUpTemplateFreeformDraft } from '../../../src/modules/wecom/wecom-follow-up-template.helper';
import { WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS } from '../../../src/modules/wecom/wecom-follow-up-template.helper';

describe('wecom follow up structured draft prompt', () => {
  function createService(): AiGatewayService {
    return new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
        logStep: jest.fn(),
      } as never,
    );
  }

  it('四段草稿提示词应明确说明问题归 helpNeeded、计划归 visitPlan，并提供真实话术示例', () => {
    const service = createService();
    const prompt = (service as never as {
      buildWecomFollowUpStructuredDraftPrompt: (params: {
        requesterName: string;
        messageText: string;
      }) => string;
    }).buildWecomFollowUpStructuredDraftPrompt({
      requesterName: '销售总监',
      messageText:
        '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
    });

    expect(prompt).toContain('helpNeeded');
    expect(prompt).toContain('visitPlan');
    expect(prompt).toContain('客户不好沟通');
    expect(prompt).toContain('明天继续跟进');
    expect(prompt).toContain('未出现则输出空字符串');
    expect(prompt).toContain('示例A 原文');
    expect(prompt).toContain('示例B 原文');
  });

  it('缺项提示应只围绕真实缺失字段组织示例', () => {
    expect(WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.informationShare).toBe('信息共享');
  });

  it('真实线上话术 golden case 应能被规则草稿稳定拆分', () => {
    for (const fixture of WECOM_FOLLOW_UP_STRUCTURED_DRAFT_FIXTURES) {
      const result = parseWecomFollowUpTemplateFreeformDraft({
        requesterName: '销售总监',
        messageText: fixture.messageText,
      });

      expect(result).toMatchObject(fixture.expectedDraft);
    }
  });
});
