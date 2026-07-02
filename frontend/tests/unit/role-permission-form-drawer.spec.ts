import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import RolePermissionFormDrawer from '@/components/governance/RolePermissionFormDrawer.vue';
import type { RolePermissionItem } from '@/types/analysis';

function createRolePermission(
  overrides: Partial<RolePermissionItem> = {},
): RolePermissionItem {
  return {
    roleId: 'role_admin',
    roleNameSnapshot: '超级管理员',
    status: 'ACTIVE',
    visibleMenus: [],
    actionKeys: [],
    webConsoleEnabled: false,
    wecomBotEligible: false,
    exportAllowed: false,
    templateManageAllowed: false,
    contractReviewUploadAllowed: false,
    contractReviewCrossViewAllowed: false,
    contractReviewCrossDownloadAllowed: false,
    updatedBy: 'system',
    updatedAt: '2026-05-22T00:00:00.000Z',
    ...overrides,
  };
}

function findButtonByText(text: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(text),
  );
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
}

function clickText(text: string): void {
  const target = Array.from(document.body.querySelectorAll('label, span')).find(
    (item) => item.textContent?.trim() === text,
  );
  expect(target).toBeTruthy();
  target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('role permission form drawer', () => {
  it('应展示菜单权限树而不是基础开关和动作大列表', async () => {
    const wrapper = mount(RolePermissionFormDrawer, {
      attachTo: document.body,
      props: {
        visible: true,
        saving: false,
        rolePermission: createRolePermission(),
      },
    });

    await nextTick();

    expect(document.body.textContent).toContain('业务功能');
    expect(document.body.textContent).toContain('移动端入口');
    expect(document.body.textContent).toContain('系统维护');
    expect(document.body.textContent).toContain('智能分析');
    expect(document.body.textContent).toContain('菜单入口');
    expect(document.body.textContent).toContain('附加功能');
    expect(document.body.textContent).toContain('企业微信机器人');
    expect(document.body.textContent).not.toContain('查询模板管理');
    expect(document.body.textContent).not.toContain('Web 入口');
    expect(document.body.textContent).not.toContain('动作权限');
    expect(document.body.querySelector('.permission-drawer__menu-card')).toBeTruthy();
    expect(document.body.querySelector('.permission-drawer__risk-row')).toBeTruthy();

    wrapper.unmount();
  });

  it('应按简化权限树回显并提交简化载荷', async () => {
    const wrapper = mount(RolePermissionFormDrawer, {
      attachTo: document.body,
      props: {
        visible: true,
        saving: false,
        rolePermission: createRolePermission({
          simplifiedPermissionProfile: {
            menus: {
              analysis: true,
              managementReport: false,
              contractReview: true,
              wecomBot: true,
              permissionCenter: false,
              templateGovernance: false,
              connectionPolicy: false,
              aiModelGovernance: false,
              auditCenter: false,
            },
            risks: {
              analysisExport: true,
              managementReportExport: false,
              contractCrossView: true,
              contractCrossDownload: false,
            },
          },
        }),
      },
    });

    await nextTick();
    findButtonByText('保存权限').click();
    await nextTick();

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      status: 'ACTIVE',
      simplifiedPermissionProfile: {
        menus: {
          analysis: true,
          contractReview: true,
          wecomBot: true,
        },
        risks: {
          analysisExport: true,
          contractCrossView: true,
        },
      },
    });

    wrapper.unmount();
  });

  it('取消主菜单时应同步清理并禁用风险子权限', async () => {
    const wrapper = mount(RolePermissionFormDrawer, {
      attachTo: document.body,
      props: {
        visible: true,
        saving: false,
        rolePermission: createRolePermission({
          simplifiedPermissionProfile: {
            menus: {
              analysis: true,
              managementReport: false,
              contractReview: false,
              wecomBot: false,
              permissionCenter: false,
              templateGovernance: false,
              connectionPolicy: false,
              aiModelGovernance: false,
              auditCenter: false,
            },
            risks: {
              analysisExport: true,
              managementReportExport: false,
              contractCrossView: false,
              contractCrossDownload: false,
            },
          },
        }),
      },
    });

    await nextTick();
    clickText('智能分析');
    await nextTick();
    findButtonByText('保存权限').click();
    await nextTick();

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      simplifiedPermissionProfile: {
        menus: {
          analysis: false,
        },
        risks: {
          analysisExport: false,
        },
      },
    });

    wrapper.unmount();
  });

  it('历史只开 Web 入口但没有菜单时应提示管理员确认', async () => {
    const wrapper = mount(RolePermissionFormDrawer, {
      attachTo: document.body,
      props: {
        visible: true,
        saving: false,
        rolePermission: createRolePermission({
          webConsoleEnabled: true,
          simplifiedPermissionProfile: {
            menus: {
              analysis: false,
              managementReport: false,
              contractReview: false,
              wecomBot: false,
              permissionCenter: false,
              templateGovernance: false,
              connectionPolicy: false,
              aiModelGovernance: false,
              auditCenter: false,
            },
            risks: {
              analysisExport: false,
              managementReportExport: false,
              contractCrossView: false,
              contractCrossDownload: false,
            },
            legacyWarnings: ['WEB_CONSOLE_WITHOUT_MENU'],
          },
        }),
      },
    });

    await nextTick();

    expect(document.body.textContent).toContain('该角色历史上只开启了 Web 入口但没有配置具体菜单');

    wrapper.unmount();
  });
});
