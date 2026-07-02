import mysql from 'mysql2/promise';
import { AnalysisWarehouseMysqlService } from '../../../src/database/analysis-warehouse/analysis-warehouse-mysql.service';

jest.mock('mysql2/promise', () => ({
  __esModule: true,
  default: {
    createPool: jest.fn(),
  },
}));

describe('AnalysisWarehouseMysqlService', () => {
  const createPoolMock = mysql.createPool as jest.Mock;
  const originalCooldown = process.env.ANALYSIS_WAREHOUSE_DB_FAILURE_COOLDOWN_MS;

  beforeEach(() => {
    process.env.ANALYSIS_WAREHOUSE_DB_FAILURE_COOLDOWN_MS = '60000';
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.ANALYSIS_WAREHOUSE_DB_FAILURE_COOLDOWN_MS = originalCooldown;
  });

  it('分析库连接失败后应短时熔断，避免每次问数重复建连接', async () => {
    const end = jest.fn(async () => undefined);
    createPoolMock.mockReturnValue({
      getConnection: jest.fn(async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:3307');
      }),
      end,
    });
    const service = new AnalysisWarehouseMysqlService(
      {
        getAnalysisWarehouseDbConfig: () => ({
          enabled: true,
          host: '127.0.0.1',
          port: 3307,
          database: 'crm_agent_analysis',
          user: 'root',
          password: 'password',
        }),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
      {
        execute: jest.fn(),
      } as never,
    );

    const run = {
      id: 'run_001',
      sourceType: 'OPENAPI',
      mode: 'FULL',
      dryRun: false,
      status: 'FAILED',
      requestedBy: 'user_admin',
      resources: ['opportunities'],
      resourceResults: [],
      configSnapshot: {},
      startedAt: '2026-06-12T07:00:00.000Z',
      finishedAt: '2026-06-12T07:00:01.000Z',
    } as never;

    await expect(service.upsertSyncRun(run)).resolves.toBe(false);
    await expect(service.upsertSyncRun(run)).resolves.toBe(false);

    expect(createPoolMock).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
});
