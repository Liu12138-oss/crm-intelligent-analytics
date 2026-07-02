import { expect, test, type Page } from '@playwright/test';

async function mockAuthenticatedSession(page: Page) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        sessionId: 'auth_session_ui',
        source: 'password-login',
        expiresAt: '2026-04-18T10:00:00.000Z',
        user: {
          id: 'user_admin',
          name: '系统管理员',
          roleNames: ['系统管理员'],
          channels: ['web-console'],
          organizationIds: ['org_all'],
          departmentIds: ['dept_all'],
        },
      }),
    });
  });
}

async function mockSharedApis(page: Page) {
  await page.route('**/api/v1/analysis/capabilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        serviceStatus: 'ONLINE',
        scopeSummary: '当前管理员可查看已授权的全部组织范围。',
        roleNames: ['系统管理员'],
        channels: ['web-console'],
        domains: ['opportunity-analysis'],
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        exportAllowed: true,
        exportRowLimit: 1000,
        exportDailyLimit: 3,
        remainingDailyExports: 3,
        historyEnabled: true,
        templateCount: 1,
        dataFreshnessAt: '2026-04-17T09:00:00.000Z',
        visibleMenus: [
          'analysis-workbench',
          'contract-review',
          'management-report',
          'permission-center',
          'connection-policy',
          'audit-center',
          'ai-model-governance',
        ],
        actionKeys: [
          'analysis.use',
          'analysis.export',
          'management.report.view',
          'management.report.export',
          'template.manage',
          'governance.policy.manage',
          'audit.view',
          'ai_profile.manage',
          'contract.review.upload',
        ],
        contractWorkspaceAllowed: true,
        wecomBotAccessState: 'ALLOWED',
        contractPermissions: {
          uploadAllowed: true,
          crossViewAllowed: true,
          crossDownloadAllowed: true,
        },
      }),
    });
  });

  await page.route('**/api/v1/contract-reviews/tasks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            taskId: 'task_ui',
            contractName: 'UI 框架合同.docx',
            status: 'COMPLETED',
            overallDecision: 'REVISE',
            reviewBasis: {
              packVersion: '2026.04',
              executionMode: 'AI_HYBRID',
            },
            latestResultSummary: '建议修改后签署 · 高风险 1 项',
            vetoCount: 0,
            highRiskCount: 1,
            mediumRiskCount: 0,
            lowRiskCount: 0,
            createdAt: '2026-04-17T09:00:00.000Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/governance/policies/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        policyId: 'policy_current',
        enabledRoleIds: ['role_admin'],
        exportRoleIds: ['role_admin'],
        enabledChannels: ['web-console'],
        allowedDomains: ['opportunity-analysis'],
        allowedTables: ['crm_opportunities'],
        allowedFields: {},
        maskedFields: {},
        exportRowLimit: 1000,
        exportDailyLimit: 3,
        maxOnlineSessions: 200,
        maxConcurrentQueries: 50,
        heartbeatIntervalSeconds: 30,
        idleTimeoutSeconds: 120,
        historyRetentionDays: 30,
        status: 'ACTIVE',
        updatedAt: '2026-04-17T09:00:00.000Z',
      }),
    });
  });

  await page.route('**/api/v1/governance/query-templates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            templateId: 'tpl_ui',
            name: 'UI 框架模板',
            description: '验证 Element Plus 表格展示。',
            defaultQuestionText: '本月新增商机金额排名',
            defaultFilters: {},
            defaultViewType: 'RANKING_TABLE',
            visibleRoleIds: ['role_admin'],
            displayOrder: 1,
            clickCount7d: 12,
            hitRatePercent: 96,
            optimizationStatus: 'HEALTHY',
            status: 'ACTIVE',
            updatedAt: '2026-04-17T09:00:00.000Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/audit-events?**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const currentPage = Number(requestUrl.searchParams.get('page') ?? '1');
    const currentPageSize = Number(requestUrl.searchParams.get('pageSize') ?? '10');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          todayQueryCount: 3,
          wecomQueryRatioPercent: 40,
          todayBlockedCount: 1,
          todaySensitiveInterceptCount: 0,
          todayExportCount: 0,
          todayExportBlockedCount: 0,
          pendingHighRiskReviewCount: 1,
          todayAiEntryCount: 8,
          todayAiFallbackCount: 2,
          todayAiFallbackRatePercent: 25,
          todayWecomEntryCount: 5,
          entrySceneBreakdown: [],
          entryTargetWorkflowBreakdown: [],
          entryFallbackReasonBreakdown: [],
          entryDailyTrend: [],
          entrySceneDailyTrend: [],
          entryFallbackReasonDailyTrend: [],
          aiGovernanceSuggestions: [],
          aiGovernanceAlerts: [],
        },
        items: [
          {
            eventId: `audit_ui_${currentPage}`,
            eventType: 'QUERY_BLOCKED',
            actorId: 'user_admin',
            actorName: '系统管理员',
            riskLevel: 'HIGH',
            outcome: `第${currentPage}页命中治理规则。`,
            entryScene: 'WEB_ANALYSIS_QUERY',
            entryTargetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
            workflowTargetWorkflow: 'ANALYSIS_BLOCKED',
            entryUsedFallback: true,
            entryFallbackReason: 'ai-unavailable-or-invalid',
            createdAt: '2026-04-17T09:00:00.000Z',
          },
        ],
        page: currentPage,
        pageSize: currentPageSize,
        total: 21,
      }),
    });
  });

  await page.route('**/api/v1/governance/permissions/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        analysisEnabledRoleCount: 3,
        wecomPilotMode: 'PILOT_ONLY',
        wecomPilotWhitelistUserCount: 2,
        exportEnabledRoleCount: 1,
        identityMappingIssueCount: 1,
      }),
    });
  });

  await page.route('**/api/v1/governance/role-permissions**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              roleId: 'role_sales_director',
              roleNameSnapshot: '销售总监',
              status: 'ACTIVE',
              visibleMenus: ['analysis-workbench', 'contract-review'],
              actionKeys: ['analysis.use', 'analysis.export', 'wecom.analysis.use'],
              webConsoleEnabled: true,
              wecomBotEligible: true,
              exportAllowed: true,
              templateManageAllowed: false,
              contractReviewUploadAllowed: true,
              contractReviewCrossViewAllowed: false,
              contractReviewCrossDownloadAllowed: false,
              updatedBy: 'user_admin',
              updatedAt: '2026-04-17T09:00:00.000Z',
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: route.request().postData() ?? '{}',
    });
  });

  await page.route('**/api/v1/governance/channels/wecom-bot/pilot-policy', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channel: 'wecom-bot',
        mode: 'PILOT_ONLY',
        allowUserIds: ['user_sales_director'],
        allowRoleIds: [],
        allowDepartmentIds: [],
        denyUserIds: [],
        note: '首批试点',
        updatedBy: 'user_admin',
        updatedAt: '2026-04-17T09:00:00.000Z',
      }),
    });
  });

  await page.route('**/api/v1/governance/access-preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        crmUserId: 'user_sales_director',
        crmUserName: '销售总监',
        wecomUserId: 'wx_sales_director',
        mappingStatus: 'MAPPED',
        roleNames: ['销售总监'],
        visibleMenus: ['analysis-workbench', 'contract-review'],
        actionKeys: ['analysis.use', 'analysis.export', 'wecom.analysis.use'],
        scopeSummary: '当前管理员可查看已授权的全部组织范围。',
        wecomBotAccessState: 'ALLOWED',
        contractPermissions: {
          uploadAllowed: true,
          crossViewAllowed: false,
          crossDownloadAllowed: false,
        },
      }),
    });
  });

  await page.route('**/api/v1/contract-reviews/contracts/pending-approval**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            contractId: 'con_ui_001',
            contractCode: 'HT-2026-001',
            contractName: '联软科技年度服务合同',
            customerName: '联软科技集团',
            ownerName: '张琳',
            totalAmount: 680000,
            submitApplyingAt: '2026-04-17T09:00:00.000Z',
            approveStatus: '待审批',
            pendingStep: 1,
          },
        ],
        page: 1,
        pageSize: 15,
        total: 1,
      }),
    });
  });

  await page.route('**/api/v1/contract-reviews/contracts/con_ui_001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contractId: 'con_ui_001',
        contractCode: 'HT-2026-001',
        contractName: '联软科技年度服务合同',
        customerName: '联软科技集团',
        opportunityTitle: '联软科技 CRM 升级项目',
        ownerId: 'owner_zhang',
        ownerName: '张琳',
        organizationId: 'org_north',
        departmentId: 'dept_sales',
        departmentName: '销售部',
        totalAmount: 680000,
        specialTermBlocks: [],
        approvalHistory: [],
        approveStatus: '待审批',
        pendingStep: 1,
        sourceSummary: '合同名称：联软科技年度服务合同；客户：联软科技集团；负责人：张琳。',
      }),
    });
  });

  await page.route('**/api/v1/governance/access-options', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          { value: 'user_region_manager', label: '区域经理（区域经理）' },
          { value: 'user_sales_director', label: '销售总监（销售总监）' },
        ],
        roles: [
          { value: 'role_sales_director', label: '销售总监' },
        ],
        departments: [
          { value: 'dept_sd_region', label: '山东区' },
          { value: 'dept_sd_sales', label: '山东销售' },
        ],
        wecomUsers: [
          { value: 'wx_sales_director', label: '销售总监（wx_sales_director）' },
        ],
      }),
    });
  });

  await page.route('**/api/v1/governance/wecom-organization-subjects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lastSyncedAt: '2026-05-20T10:00:00.000Z',
        departments: [
          {
            departmentId: 'dept_sales',
            name: '销售部',
            syncStatus: 'ACTIVE',
            crmDepartmentId: 'dept_sales',
            crmDepartmentName: '销售部',
            mappingStatus: 'MAPPED',
          },
          {
            departmentId: 'dept_sd_sales',
            name: '山东销售',
            parentDepartmentId: 'dept_sales',
            syncStatus: 'ACTIVE',
            crmDepartmentId: 'dept_sd_sales',
            crmDepartmentName: '山东销售',
            mappingStatus: 'MAPPED',
          },
        ],
        users: [
          {
            wecomUserId: 'wx_region_manager',
            name: '区域经理',
            departmentIds: ['dept_sd_sales'],
            primaryDepartmentId: 'dept_sd_sales',
            crmUserId: 'user_region_manager',
            crmUserName: '区域经理',
            syncStatus: 'ACTIVE',
            mappingStatus: 'MAPPED',
          },
          {
            wecomUserId: 'wx_sales_director',
            name: '销售总监',
            departmentIds: ['dept_sales'],
            primaryDepartmentId: 'dept_sales',
            crmUserId: 'user_sales_director',
            crmUserName: '销售总监',
            syncStatus: 'ACTIVE',
            mappingStatus: 'MAPPED',
          },
          {
            wecomUserId: 'wx_unmapped_member',
            name: '未映射成员',
            departmentIds: ['dept_sales'],
            primaryDepartmentId: 'dept_sales',
            syncStatus: 'ACTIVE',
            mappingStatus: 'UNMAPPED',
            disabledReason: '未绑定 CRM 用户，不能保存为授权人员。',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/governance/data-scope-grants', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
      }),
    });
  });

  await page.route('**/api/v1/governance/daily-report-delivery/departments', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              departmentId: 'dept_sd_sales',
              departmentName: '山东销售',
              parentDepartmentId: 'dept_sd_region',
              status: 'ENABLED',
              departmentType: 'SALES',
              applyToChildren: false,
              updatedBy: 'user_admin',
              updatedAt: '2026-04-28T10:00:00.000Z',
              reason: '销售类默认启用',
              resolvedRecipientName: '牛劲',
              resolvedRecipientCrmUserId: '2224755',
              resolvedRecipientWecomUserId: 'NiuJin',
              resolvedRecipientSource: 'REGION_OVERRIDE',
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: route.request().postData() ?? '{}',
    });
  });

  await page.route('**/api/v1/governance/daily-report-delivery/preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        businessDate: '2026-04-28',
        groups: [
          {
            groupDepartmentId: 'dept_sd_sales',
            groupDepartmentName: '山东销售',
            regionDepartmentId: 'dept_sd_region',
            regionDepartmentName: '山东区',
            effectivePolicy: 'ENABLED',
            recipientCrmUserId: '2224755',
            recipientName: '牛劲',
            recipientWecomUserId: 'NiuJin',
            ruleSource: 'REGION_OVERRIDE',
            deliveryStatus: 'READY',
            memberRequesterIds: ['user_sales_director'],
            memberCount: 1,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/governance/identity-mappings?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            wecomUserId: 'wx_sales_director',
            wecomName: '销售总监',
            mappingStatus: 'MAPPED',
            crmUserId: 'user_sales_director',
            crmUserName: '销售总监',
            crmRoleNames: ['销售总监'],
            crmDepartmentIds: ['dept_sales'],
            analysisEnabled: true,
            wecomBotAccessState: 'ALLOWED',
          },
        ],
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page);
  await mockSharedApis(page);
});

test('Element Plus shell should render contract review entry and CRM contract flow', async ({ page }) => {
  await page.goto('/contract-review');

  await expect(page.getByRole('link', { name: /智能合同/ })).toBeVisible();
  await expect(page.locator('.business-visual-anchor')).toHaveCount(0);
  await expect(page.getByText('CRM合同列表')).toBeVisible();
  await expect(page.getByRole('button', { name: /上传合同/ })).toHaveCount(0);
  await expect(page.getByText('联软科技年度服务合同')).toBeVisible();
  await expect(page.getByText('智能合同审核工作台')).toHaveCount(0);
  await expect(page.locator('.shell__group-caption')).toHaveCount(0);
  await expect(page.locator('.shell__hint')).toHaveCount(0);
  await expect(page.locator('.page__eyebrow')).toHaveCount(0);
  await expect(page.locator('.page__description')).toHaveCount(0);
  await expect(page.locator('.section-eyebrow')).toHaveCount(0);
});

test('Element Plus governance pages should render primary actions and tables', async ({ page }) => {
  const mainContent = page.locator('.shell__main');

  await page.goto('/governance/templates');
  await expect(page).toHaveURL(/\/analysis$/);
  await expect(page.getByRole('link', { name: /查询模板|查询模版/ })).toHaveCount(0);

  await page.goto('/governance/connections');
  await expect(page.locator('.business-visual-anchor')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '业务分类' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '方案详情' })).toHaveCount(0);
  await expect(page.getByText('当前分类')).toHaveCount(0);
  await expect(mainContent.getByText('查询模板管理', { exact: true })).toHaveCount(0);
  await expect(page.locator('.page__eyebrow')).toHaveCount(0);
  await expect(page.locator('.page__description')).toHaveCount(0);
  await expect(page.locator('.section-eyebrow')).toHaveCount(0);

  await expect(page.locator('.business-visual-anchor')).toHaveCount(0);
  await expect(page.getByText('会话与并发阈值')).toBeVisible();
  await expect(page.getByRole('button', { name: /保存连接策略/ })).toBeVisible();
  await expect(mainContent.getByText('连接策略管理', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /治理策略/ })).toHaveCount(0);
  await expect(page.locator('.page__eyebrow')).toHaveCount(0);
  await expect(page.locator('.page__description')).toHaveCount(0);
  await expect(page.locator('.section-eyebrow')).toHaveCount(0);

  await page.goto('/governance/access');
  await expect(page.locator('.business-visual-anchor')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '角色权限' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /企业微信准入/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /身份与权限诊断/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /查询/ })).toBeVisible();
});

test('Permission center org picker should clear search and preserve existing save payload fields', async ({
  page,
}) => {
  let savedPilotPayload: Record<string, unknown> | undefined;

  await page.unroute('**/api/v1/governance/channels/wecom-bot/pilot-policy');
  await page.route('**/api/v1/governance/channels/wecom-bot/pilot-policy', async (route) => {
    if (route.request().method() === 'PUT') {
      savedPilotPayload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channel: 'wecom-bot',
        mode: 'PILOT_ONLY',
        allowUserIds: savedPilotPayload?.allowUserIds ?? ['user_sales_director'],
        allowRoleIds: savedPilotPayload?.allowRoleIds ?? [],
        allowDepartmentIds: savedPilotPayload?.allowDepartmentIds ?? [],
        denyUserIds: savedPilotPayload?.denyUserIds ?? [],
        note: '首批试点',
        updatedBy: 'user_admin',
        updatedAt: '2026-04-17T09:00:00.000Z',
      }),
    });
  });

  await page.goto('/governance/access');
  await page.getByRole('tab', { name: /企业微信准入/ }).click();

  const wecomAccessPanel = page.locator('[data-test="wecom-access-panel"]');
  const allowUserPicker = wecomAccessPanel
    .locator('label')
    .filter({ hasText: '白名单用户' })
    .locator('[data-test="wecom-org-picker-open"]');
  await expect(allowUserPicker).toContainText('已选择 1 项');
  await allowUserPicker.click();
  let pickerDialog = page.getByRole('dialog', { name: '选择人员' });
  const searchInput = pickerDialog.locator('[data-test="wecom-org-picker-search"]');
  await searchInput.fill('区域');
  await pickerDialog.locator('[data-test="subject-user-user_region_manager"]').click();
  await expect(searchInput).toHaveValue('');
  await pickerDialog.locator('[data-test="wecom-org-picker-confirm"]').click();
  await expect(allowUserPicker).toContainText('已选择 2 项');

  await allowUserPicker.click();
  pickerDialog = page.getByRole('dialog', { name: '选择人员' });
  await pickerDialog.locator('[data-test="subject-department-bulk-dept_sales"]').click();
  await pickerDialog.locator('[data-test="wecom-org-picker-confirm"]').click();

  const allowDepartmentPicker = wecomAccessPanel
    .locator('label')
    .filter({ hasText: '白名单部门' })
    .locator('[data-test="wecom-org-picker-open"]');
  await allowDepartmentPicker.click();
  pickerDialog = page.getByRole('dialog', { name: '选择部门' });
  await pickerDialog.locator('[data-test="subject-department-row-dept_sd_sales"]').click();
  await pickerDialog.locator('[data-test="subject-department-dept_sd_sales"]').click();
  await pickerDialog.locator('[data-test="wecom-org-picker-confirm"]').click();

  await wecomAccessPanel.getByRole('button', { name: /保存灰度策略/ }).click();

  expect(savedPilotPayload).toMatchObject({
    mode: 'PILOT_ONLY',
    allowUserIds: expect.arrayContaining(['user_region_manager', 'user_sales_director']),
    allowDepartmentIds: ['dept_sd_sales'],
    denyUserIds: [],
  });
});

test('Element Plus audit page should render filters and event table', async ({ page }) => {
  const mainContent = page.locator('.shell__main');

  await page.goto('/audit');
  await expect(page.locator('.business-visual-anchor')).toHaveCount(0);
  await expect(page.locator('.page__eyebrow')).toHaveCount(0);
  await expect(page.locator('.page__description')).toHaveCount(0);
  await expect(page.locator('.section-eyebrow')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /刷新数据/ })).toHaveCount(0);
  await page.getByRole('tab', { name: /用户行为审计/ }).click();
  const userAuditPanel = page.locator('[data-test="audit-panel-user"]');

  await expect(mainContent.getByText('AI 审计', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('按用户名筛选')).toBeVisible();
  await expect(page.getByRole('button', { name: /查询/ })).toBeVisible();
  await expect(userAuditPanel.getByText('查询被阻断')).toBeVisible();
  await expect(userAuditPanel.getByText('系统管理员')).toBeVisible();
  await expect(userAuditPanel.getByText('共 21 条')).toBeVisible();
  await expect(userAuditPanel.getByText('第1页命中治理规则。').first()).toBeVisible();
  await expect(page.getByText('高风险', { exact: true })).toBeVisible();
  await expect(page.getByText('user_admin')).not.toBeVisible();
  await expect(page.getByText('行为人')).not.toBeVisible();
  await expect(page.getByText('QUERY_BLOCKED')).not.toBeVisible();
  await expect(page.getByText('WEB_ANALYSIS_QUERY')).not.toBeVisible();

  await userAuditPanel.locator('.el-pagination .btn-next').click();
  await expect(userAuditPanel.getByText('第2页命中治理规则。').first()).toBeVisible();
});
