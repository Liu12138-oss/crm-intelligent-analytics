import { describe, expect, it } from 'vitest';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

describe('user facing error', () => {
  it('应把未授权数据表报错翻译为友好提示，且不暴露表名', () => {
    const message = toUserFacingErrorMessage(
      new Error('模板 SQL 访问了未授权数据表：departments'),
      '当前操作暂未成功，请稍后重试。',
    );

    expect(message).toContain('当前查询暂时无法执行');
    expect(message).toContain('联系管理员');
    expect(message).not.toContain('departments');
    expect(message).not.toContain('数据表');
  });

  it('应把权限不足翻译为带下一步建议的提示', () => {
    expect(
      toUserFacingErrorMessage(
        new Error('当前用户无权查看经营报表。'),
        '当前操作暂未成功，请稍后重试。',
      ),
    ).toBe('你当前没有权限执行这个操作。请联系管理员开通对应权限后再试。');
  });

  it('应保留已足够友好的中文提示', () => {
    expect(
      toUserFacingErrorMessage(
        new Error('请先选择企业微信账号，再执行身份映射诊断。'),
        '当前操作暂未成功，请稍后重试。',
      ),
    ).toBe('请先选择企业微信账号，再执行身份映射诊断。');
  });

  it('遇到内部技术细节时应回退到业务化兜底提示', () => {
    expect(
      toUserFacingErrorMessage(
        new Error('UNIFIED_AI_EXECUTION_UNAVAILABLE'),
        '当前服务暂时不可用，请稍后重试；如果多次失败，请联系管理员。',
      ),
    ).toBe('当前服务暂时不可用，请稍后重试；如果多次失败，请联系管理员协助处理。');
  });
});
