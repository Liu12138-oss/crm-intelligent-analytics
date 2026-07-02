import {
  buildWecomCandidateDisplayLine,
  parseWecomCandidateSelectionIndex,
  rankWecomCandidatesWithAiRecommendation,
  selectWecomCandidateByReply,
} from '../../../src/modules/wecom/wecom-candidate-selection.helper';

describe('wecom candidate selection helper', () => {
  const candidates = [
    { id: 'c1', name: '候选甲' },
    { id: 'c2', name: '候选乙' },
  ];

  it('应支持多种候选序号回复格式', () => {
    expect(parseWecomCandidateSelectionIndex('候选1')).toBe(0);
    expect(parseWecomCandidateSelectionIndex('1')).toBe(0);
    expect(parseWecomCandidateSelectionIndex('一')).toBe(0);
    expect(parseWecomCandidateSelectionIndex('第一')).toBe(0);
    expect(parseWecomCandidateSelectionIndex('第1个')).toBe(0);
    expect(parseWecomCandidateSelectionIndex('1个')).toBe(0);
    expect(parseWecomCandidateSelectionIndex('候选2')).toBe(1);
  });

  it('非候选语义文本不应被误识别为选择序号', () => {
    expect(parseWecomCandidateSelectionIndex('第一阶段已完成')).toBeUndefined();
    expect(parseWecomCandidateSelectionIndex('1个风险')).toBeUndefined();
    expect(parseWecomCandidateSelectionIndex('今天先做1个方案')).toBeUndefined();
  });

  it('应支持按宽松序号或完整名称选中候选', () => {
    expect(selectWecomCandidateByReply('候选2', candidates).candidate?.name).toBe('候选乙');
    expect(selectWecomCandidateByReply('二', candidates).candidate?.name).toBe('候选乙');
    expect(selectWecomCandidateByReply('候选甲', candidates).candidate?.name).toBe('候选甲');
  });

  it('候选展示行应附带辅助信息', () => {
    expect(
      buildWecomCandidateDisplayLine({
        index: 0,
        title: '苏州纳芯微电子股份有限公司',
        details: ['战略客户', '李浩'],
      }),
    ).toBe('候选1：苏州纳芯微电子股份有限公司（战略客户｜李浩）');
  });

  it('AI 推荐重排只能在已召回候选集合内输出推荐', () => {
    const ranked = rankWecomCandidatesWithAiRecommendation('我说的是候选乙项目', [
      { id: 'c1', name: '候选甲' },
      { id: 'c2', name: '候选乙' },
    ]);

    expect(ranked.recommendedCandidate?.name).toBe('候选乙');
    expect(ranked.candidates.map((item) => item.name)).toEqual(['候选乙', '候选甲']);
    expect(ranked.candidates).toHaveLength(2);
    expect(ranked.candidates.some((item) => item.name === '候选丙')).toBe(false);
    expect(ranked.auditSnapshot).toEqual(
      expect.objectContaining({
        boundary: 'RECALLED_CANDIDATES_ONLY',
        recommendedCandidateId: 'c2',
      }),
    );
  });
});
