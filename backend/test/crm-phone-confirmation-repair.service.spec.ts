import mysql from 'mysql2/promise';
import { CrmPhoneConfirmationRepairService } from '../src/modules/auth/crm-phone-confirmation-repair.service';

jest.mock('mysql2/promise', () => ({
  __esModule: true,
  default: {
    createPool: jest.fn(),
  },
}));

describe('CrmPhoneConfirmationRepairService', () => {
  const createPoolMock = mysql.createPool as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应在命中单个未确认用户时补齐 confirmed_phone_at', async () => {
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([[{ id: 1, confirmed_phone_at: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    createPoolMock.mockReturnValue({
      query: queryMock,
    });

    const service = new CrmPhoneConfirmationRepairService(
      {
        getCrmWritebackDbConfig: () => ({
          enabled: true,
          host: '127.0.0.1',
          port: 3306,
          database: 'crm',
          user: 'root',
          password: 'password',
        }),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
    );

    await expect(service.repairIfMissing('18503081052')).resolves.toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('应在命中多个候选用户时跳过自动修复', async () => {
    const logWarn = jest.fn();
    const queryMock = jest.fn().mockResolvedValue([
      [
        { id: 1, confirmed_phone_at: null },
        { id: 2, confirmed_phone_at: null },
      ],
    ]);
    createPoolMock.mockReturnValue({
      query: queryMock,
    });

    const service = new CrmPhoneConfirmationRepairService(
      {
        getCrmWritebackDbConfig: () => ({
          enabled: true,
          host: '127.0.0.1',
          port: 3306,
          database: 'crm',
          user: 'root',
          password: 'password',
        }),
      } as never,
      {
        logStep: jest.fn(),
        logWarn,
      } as never,
    );

    await expect(service.repairIfMissing('18503081052')).resolves.toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });
});
