import { WecomMaintenanceDegradationService } from '../../../src/modules/wecom/wecom-maintenance-degradation.service';

describe('WecomMaintenanceDegradationService', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.WECOM_FORCE_IDENTITY_UNAVAILABLE;
    delete process.env.WECOM_FORCE_DATA_UNAVAILABLE;
  });

  it('标准 OpenAPI 已启用时，应允许企微身份和数据检查绕过只读库门禁', async () => {
    process.env.NODE_ENV = 'development';
    const service = new WecomMaintenanceDegradationService(
      {
        ensureLiveQueryReady: jest.fn().mockResolvedValue(false),
      } as never,
      {
        getCrmStandardOpenApiConfig: jest.fn(() => ({
          enabled: true,
        })),
      } as never,
    );

    await expect(service.assertIdentitySourceAvailable()).resolves.toEqual({
      recovered: false,
    });
    await expect(service.assertRealtimeDataAvailable()).resolves.toEqual({
      recovered: false,
    });
  });

  it('标准 OpenAPI 未启用且只读库不可用时，仍应返回维护期友好提示', async () => {
    process.env.NODE_ENV = 'development';
    const service = new WecomMaintenanceDegradationService(
      {
        ensureLiveQueryReady: jest.fn().mockResolvedValue(false),
      } as never,
      {
        getCrmStandardOpenApiConfig: jest.fn(() => ({
          enabled: false,
        })),
      } as never,
    );

    await expect(service.assertIdentitySourceAvailable()).rejects.toThrow(
      '当前无法确认你的 CRM 身份，请稍后重试。',
    );
  });
});
