import { AnalysisService } from '../../../src/modules/analysis/analysis.service';

describe('AnalysisService', () => {
  function createService(params?: {
    enrich?: jest.Mock;
    saveResult?: jest.Mock;
    result?: Record<string, unknown>;
  }): AnalysisService {
    const analysisRequestRepository = {
      findRequestById: jest.fn(() => ({
        id: 'query_wait_001',
        requesterId: 'user_001',
        status: 'RETURNED',
      })),
      findResultByRequestId: jest.fn(
        () =>
          params?.result ?? {
            requestId: 'query_wait_001',
            report: {},
            keyFindings: [],
            availableActions: [],
          },
      ),
      saveResult: params?.saveResult ?? jest.fn(),
    };

    return new AnalysisService(
      {} as never,
      {} as never,
      { hasVisibleMenu: jest.fn(() => true) } as never,
      {} as never,
      {} as never,
      {
        resolveRoute: jest.fn(() => 'OPENAPI'),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      analysisRequestRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        enrich: params?.enrich ?? jest.fn(() => new Promise(() => undefined)),
      } as never,
      {
        presentResult: jest.fn((result) => result),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('等待 AI 报告时应允许 55 秒窗口，不应被 30 秒上限提前截断', async () => {
    jest.useFakeTimers();
    const enrichedResult = {
      requestId: 'query_wait_001',
      report: {
        analysisConfidence: 'HIGH',
      },
      keyFindings: [],
      availableActions: [],
    };
    const enrich = jest.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(enrichedResult), 45000);
        }),
    );
    const saveResult = jest.fn();
    const delayedService = createService({ enrich, saveResult });
    jest.spyOn(delayedService, 'getQueryDetail').mockReturnValue({
      queryId: 'query_wait_001',
      status: 'READY',
      report: {
        analysisConfidence: 'HIGH',
      },
      keyFindings: [],
    });

    const resultPromise = delayedService.getQueryReport(
      {
        id: 'user_001',
        roleIds: [],
      } as never,
      'query_wait_001',
      55000,
    );

    await Promise.resolve();
    jest.advanceTimersByTime(45000);
    await Promise.resolve();

    await expect(resultPromise).resolves.toMatchObject({
      queryId: 'query_wait_001',
      status: 'READY',
    });
    expect(saveResult).toHaveBeenCalledWith(enrichedResult);
    jest.useRealTimers();
  });

  it('非空历史结果如果保存了旧版不可预测报告，应重新生成报告', async () => {
    const enrichedResult = {
      requestId: 'query_wait_001',
      tableRows: [{ customer_name: '宁波泰康脑科医院有限公司', expected_amount: 15 }],
      metricCards: [{ name: '新增金额', value: 15 }],
      report: {
        analysisConfidence: 'MEDIUM',
        forecastInsight: {
          status: 'LOW_CONFIDENCE',
          summary: '预计下一周期大概率落在 12 到 18 之间。',
        },
      },
      keyFindings: [],
      availableActions: [],
    };
    const enrich = jest.fn(async () => enrichedResult);
    const saveResult = jest.fn();
    const service = createService({
      enrich,
      saveResult,
      result: {
        requestId: 'query_wait_001',
        tableRows: [{ customer_name: '宁波泰康脑科医院有限公司', expected_amount: 15 }],
        metricCards: [{ name: '新增金额', value: 15 }],
        report: {
          analysisConfidence: 'MEDIUM',
          forecastInsight: {
            status: 'UNAVAILABLE',
            summary: '当前结果仅支持趋势判断，暂不具备预测条件。',
          },
        },
        keyFindings: [],
        availableActions: [],
      },
    });
    jest.spyOn(service, 'getQueryDetail').mockReturnValue({
      queryId: 'query_wait_001',
      status: 'READY',
      report: enrichedResult.report,
      keyFindings: [],
    });

    await expect(
      service.getQueryReport(
        {
          id: 'user_001',
          roleIds: [],
        } as never,
        'query_wait_001',
        1000,
      ),
    ).resolves.toMatchObject({
      queryId: 'query_wait_001',
      status: 'READY',
    });
    expect(enrich).toHaveBeenCalledTimes(1);
    expect(saveResult).toHaveBeenCalledWith(enrichedResult);
  });
});
