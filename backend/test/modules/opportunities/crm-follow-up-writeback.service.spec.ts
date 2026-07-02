import { ServiceUnavailableException } from '@nestjs/common';
import { CrmBuiltinAccountTokenService } from '../../../src/modules/opportunities/crm-builtin-account-token.service';
import { CrmFollowUpWritebackService } from '../../../src/modules/opportunities/crm-follow-up-writeback.service';
import type { CrmUser } from '../../../src/shared/types/domain';

describe('CrmFollowUpWritebackService', () => {
  const mockUser: CrmUser = {
    id: 'user_wecom_001',
    name: '张三',
    roleIds: ['role_sales'],
    roleNames: ['销售'],
    organizationIds: ['org_001'],
    departmentIds: ['dept_001'],
    ownerIds: ['owner_001'],
    isAdmin: false,
    exportAllowed: false,
    channels: ['wecom-bot'],
  };

  const mockConfigService = {
    getCrmAuthConfig: jest.fn(),
  };
  const mockLoggerService = {
    logStep: jest.fn(),
    logWarn: jest.fn(),
  };

  let service: CrmFollowUpWritebackService;
  let builtinTokenService: CrmBuiltinAccountTokenService;
  let originalFetch: typeof global.fetch | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalNodeEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    mockConfigService.getCrmAuthConfig.mockReset();
    mockLoggerService.logStep.mockReset();
    mockLoggerService.logWarn.mockReset();
    builtinTokenService = new CrmBuiltinAccountTokenService(
      mockConfigService as never,
      mockLoggerService as never,
    );
    service = new CrmFollowUpWritebackService(
      mockConfigService as never,
      mockLoggerService as never,
      builtinTokenService as never,
    );
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete (global as Partial<typeof global>).fetch;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('应给跟进内容补齐发送人署名并避免重复前缀', () => {
    expect(service.formatSignedFollowUpContent('张三', '今天跟进完成')).toBe(
      '张三：今天跟进完成',
    );
    expect(
      service.formatSignedFollowUpContent('张三', '张三：今天跟进完成'),
    ).toBe('张三：今天跟进完成');
    expect(
      service.formatSignedFollowUpContent('张三', '张三: 今天跟进完成'),
    ).toBe('张三：今天跟进完成');
    expect(
      service.formatSignedFollowUpContent(
        '张三',
        '【张三】：\n跟进内容：今天跟进完成\n遇到与协助：无',
      ),
    ).toBe('【张三】：\n跟进内容：今天跟进完成\n遇到与协助：无');
  });

  it('未配置机器人写回内置账号时应返回明确错误', async () => {
    mockConfigService.getCrmAuthConfig.mockReturnValue({
      enabled: true,
      baseUrl: 'http://crm.example.com',
      corpId: 'corp_001',
      versionCode: '9.9.9',
      device: 'open_api',
      timeoutMs: 12000,
      mockEnabled: false,
    });

    await expect(
      service.writeFollowUp(mockUser, {
        loggableType: 'Opportunity',
        loggableId: 'opp_001',
        content: '今天跟进完成',
      }),
    ).rejects.toThrow(
      new ServiceUnavailableException(
        '当前未配置企业微信受控写入内置 CRM 账号，请设置 CRM_OPEN_API_WRITEBACK_LOGIN 和 CRM_OPEN_API_WRITEBACK_PASSWORD。',
      ),
    );
  });

  it('应使用内置账号登录后执行跟进写回', async () => {
    mockConfigService.getCrmAuthConfig.mockReturnValue({
      enabled: true,
      baseUrl: 'http://crm.example.com',
      corpId: 'corp_001',
      versionCode: '9.9.9',
      device: 'open_api',
      timeoutMs: 12000,
      mockEnabled: false,
      writebackLogin: 'system_followup',
      writebackPassword: 'system_password',
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              user_token: 'builtin-token-001',
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            message: '写回成功',
            data: {
              id: 'revisit_001',
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    global.fetch = fetchMock as typeof global.fetch;

    const result = await service.writeFollowUp(mockUser, {
      loggableType: 'Opportunity',
      loggableId: 'opp_001',
      content: '今天跟进完成',
    });

    expect(result.revisitLogId).toBe('revisit_001');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://crm.example.com/api/v2/auth/login',
    );

    const loginOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(loginOptions.method).toBe('POST');
    expect(String(loginOptions.body)).toContain('"login":"system_followup"');

    const writebackOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(writebackOptions.method).toBe('POST');
    expect(writebackOptions.headers).toMatchObject({
      Authorization:
        'Token token=builtin-token-001, device=open_api, version_code=9.9.9',
    });
    expect(decodeURIComponent(String(writebackOptions.body))).toContain(
      'revisit_log[content]=张三：今天跟进完成',
    );
  });
});
