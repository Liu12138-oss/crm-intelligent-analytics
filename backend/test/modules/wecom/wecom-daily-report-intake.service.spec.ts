import { WecomDailyReportIntakeService } from '../../../src/modules/wecom/wecom-daily-report-intake.service';

describe('WecomDailyReportIntakeService', () => {
  it('应该从一句话里识别出多个公司和多个项目', () => {
    const service = new WecomDailyReportIntakeService({
      listCustomers: jest.fn(() => [
        { id: 'cus_001', name: '山东农信', category: '重点客户' },
        { id: 'cus_002', name: '苏州制造', category: '战略客户' },
      ]),
      listOpportunities: jest.fn(() => [
        {
          id: 'opp_002',
          title: '苏州制造升级',
          ownerName: '李浩',
          expectAmount: 540000,
          stage: '方案',
        },
        {
          id: 'opp_001',
          title: '山东农信续约',
          ownerName: '张玲',
          expectAmount: 860000,
          stage: '谈判',
        },
      ]),
      listContracts: jest.fn(() => []),
    } as never);

    const result = service.inspect(
      '上午拜访了苏州制造和山东农信，推进苏州制造升级与山东农信续约。',
    );

    expect(result.companyCandidates).toEqual(
      expect.arrayContaining(['苏州制造', '山东农信']),
    );
    expect(result.projectCandidates).toEqual(
      expect.arrayContaining(['苏州制造升级', '山东农信续约']),
    );
    expect(result.backendMatches.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        '苏州制造',
        '山东农信',
        '苏州制造升级',
        '山东农信续约',
      ]),
    );
    expect(result.confirmationSummaryLines.join('\n')).toContain('苏州制造');
    expect(result.confirmationSummaryLines.join('\n')).toContain('山东农信');
  });

  it('未加引号时也应提取客户和项目核心名称，不把动作前缀一起带入', () => {
    const service = new WecomDailyReportIntakeService({
      listCustomers: jest.fn(() => []),
      listOpportunities: jest.fn(() => []),
      listContracts: jest.fn(() => []),
    } as never);

    const result = service.inspect(
      [
        '跟进内容：今天拜访了海航集团有限公司，简单聊聊，并继续推进海航数据中台POC。',
        '拜访计划：明天继续拜访海航集团有限公司。',
      ].join('\n'),
    );

    expect(result.companyCandidates).toContain('海航集团有限公司');
    expect(result.projectCandidates).toContain('海航数据中台POC');
    expect(result.companyCandidates).not.toContain('今天拜访了海航集团有限公司');
    expect(result.projectCandidates).not.toContain('继续推进海航数据中台POC');
  });

  it('不应把“做了一次全公司”这类泛指短语识别成客户', () => {
    const service = new WecomDailyReportIntakeService({
      listCustomers: jest.fn(() => []),
      listOpportunities: jest.fn(() => []),
      listContracts: jest.fn(() => []),
    } as never);

    const result = service.inspect(
      [
        '跟进内容：跟进了易阳电力微盾扩容项目，做了一次全公司推广。',
        '遇到与协助：部署有问题，已与产品线沟通。',
        '信息共享：这个案例场景可以分享。',
        '拜访计划：明天继续推进。',
      ].join('\n'),
    );

    expect(result.projectCandidates).toContain('易阳电力微盾扩容项目');
    expect(result.companyCandidates).not.toContain('做了一次全公司');
    expect(result.companyCandidates).not.toContain('全公司');
    expect(result.confirmationSummaryLines.join('\n')).toContain('信息共享');
    expect(result.confirmationSummaryLines.join('\n')).toContain('问题与协助');
    expect(result.confirmationSummaryLines.join('\n')).toContain('拜访计划');
  });
});
