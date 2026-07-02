import { ApplicationSuperAdminPolicyRepository } from '../../../src/modules/governance/application-super-admin-policy.repository';
import type { AppStorageState } from '../../../src/shared/types/domain';
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';

describe('ApplicationSuperAdminPolicyRepository', () => {
  function buildState(): AppStorageState {
    return {
      ...createDefaultAppStorageState(),
      analysisScopePolicy: {
        policyId: 'analysis_scope_policy_current',
        fullAccessUserIds: ['legacy_user', 'user_admin', 'legacy_user'],
        updatedBy: 'user_admin',
        updatedAt: '2026-05-20T10:00:00.000Z',
        changeReason: '历史全量查询名单',
      },
    };
  }

  it('读取时应把历史全量查询名单迁移为用户级超级管理员主体', () => {
    const state = buildState();
    const repository = new ApplicationSuperAdminPolicyRepository({
      state,
      persist: jest.fn(),
    } as never);

    const policy = repository.getCurrent();

    expect(policy.subjects).toEqual([
      {
        subjectType: 'USER',
        subjectId: 'legacy_user',
        status: 'ACTIVE',
      },
    ]);
    expect(policy.changeReason).toContain('历史全量查询名单');
  });

  it('保存新策略时应写入用户和角色主体，并清空旧分析全量名单', () => {
    const state = buildState();
    const persist = jest.fn();
    const repository = new ApplicationSuperAdminPolicyRepository({
      state,
      persist,
    } as never);

    const saved = repository.save({
      policyId: 'application_super_admin_policy_current',
      subjects: [
        { subjectType: 'USER', subjectId: 'user_ceo', status: 'ACTIVE' },
        { subjectType: 'ROLE', subjectId: 'role_boss', status: 'ACTIVE' },
        { subjectType: 'USER', subjectId: 'user_ceo', status: 'ACTIVE' },
      ],
      updatedBy: 'user_admin',
      updatedAt: '2026-05-23T10:00:00.000Z',
      changeReason: '开通经营管理超级管理员',
    });

    expect(saved.subjects).toEqual([
      { subjectType: 'USER', subjectId: 'user_ceo', status: 'ACTIVE' },
      { subjectType: 'ROLE', subjectId: 'role_boss', status: 'ACTIVE' },
    ]);
    expect(state.applicationSuperAdminPolicy?.subjects).toEqual(saved.subjects);
    expect(state.analysisScopePolicy.fullAccessUserIds).toEqual([]);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('应同时支持用户和角色命中超级管理员授权', () => {
    const state = buildState();
    const repository = new ApplicationSuperAdminPolicyRepository({
      state,
      persist: jest.fn(),
    } as never);
    repository.save({
      policyId: 'application_super_admin_policy_current',
      subjects: [
        { subjectType: 'USER', subjectId: 'user_ceo', status: 'ACTIVE' },
        { subjectType: 'ROLE', subjectId: 'role_boss', status: 'ACTIVE' },
        { subjectType: 'ROLE', subjectId: 'role_disabled', status: 'INACTIVE' },
      ],
      updatedBy: 'user_admin',
      updatedAt: '2026-05-23T10:00:00.000Z',
      changeReason: '开通经营管理超级管理员',
    });

    expect(repository.isSuperAdminSubject({
      id: 'user_ceo',
      roleIds: ['role_staff'],
    } as never)).toBe(true);
    expect(repository.isSuperAdminSubject({
      id: 'user_staff',
      roleIds: ['role_boss'],
    } as never)).toBe(true);
    expect(repository.isSuperAdminSubject({
      id: 'user_disabled',
      roleIds: ['role_disabled'],
    } as never)).toBe(false);
  });

  it('同一主体后续保存为停用状态时不应继续放行', () => {
    const state = buildState();
    const repository = new ApplicationSuperAdminPolicyRepository({
      state,
      persist: jest.fn(),
    } as never);

    repository.save({
      policyId: 'application_super_admin_policy_current',
      subjects: [
        { subjectType: 'USER', subjectId: 'user_ceo', status: 'ACTIVE' },
        { subjectType: 'USER', subjectId: 'user_ceo', status: 'INACTIVE' },
      ],
      updatedBy: 'user_admin',
      updatedAt: '2026-05-23T10:00:00.000Z',
      changeReason: '停用误开通的超级管理员授权',
    });

    expect(repository.isSuperAdminSubject({
      id: 'user_ceo',
      roleIds: ['role_staff'],
    } as never)).toBe(false);
  });
});
