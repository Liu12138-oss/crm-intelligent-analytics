import { Inject, Injectable } from '@nestjs/common';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { AppStorageService } from '../app-storage/app-storage.service';
import {
  CRM_CONTRACTS,
  CRM_CUSTOMERS,
  CRM_OPPORTUNITIES,
  CRM_USERS,
} from '../../shared/mock/sample-data';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { SqlAuditService } from '../../modules/audit/sql-audit.service';
import type {
  AccessOptionRecord,
  ContractReviewSourceApprovalRecord,
  CrmContract,
  CrmCustomer,
  CrmOpportunity,
  CrmUser,
  CrmWxUserMapRecord,
  CrmWxUserRecord,
  ScopeSnapshot,
} from '../../shared/types/domain';
import {
  QueryExecutionTimeoutError,
  QueryPreflightError,
} from '../../modules/analysis/analysis.errors';

export interface DailyReportFollowUpSourceRecord {
  id: string;
  requesterId: string;
  requesterName: string;
  objectType: 'Customer' | 'Opportunity';
  objectId: string;
  objectTitle: string;
  customerName?: string;
  content: string;
  writtenAt: string;
}

export interface DailyReportCreatedCustomerSourceRecord {
  id: string;
  requesterId: string;
  requesterName: string;
  customerName: string;
  category?: string;
  createdAt: string;
}

export interface DailyReportCreatedOpportunitySourceRecord {
  id: string;
  requesterId: string;
  requesterName: string;
  title: string;
  customerName?: string;
  expectAmount: number;
  stage?: string;
  createdAt: string;
}

export interface PendingApprovalContractSourceRecord {
  contractId: string;
  contractCode?: string;
  contractName: string;
  customerName?: string;
  ownerId: string;
  ownerName: string;
  organizationId: string;
  departmentId?: string;
  departmentName?: string;
  totalAmount: number;
  approveStatus: string;
  pendingStep: number;
  submitApplyingAt?: string;
  finishApproveAt?: string;
}

export interface PendingApprovalContractSourceDetailRecord
  extends PendingApprovalContractSourceRecord {
  opportunityTitle?: string;
  startAt?: string;
  endAt?: string;
  signDate?: string;
  customerSigner?: string;
  ourSigner?: string;
  specialTerms?: string;
  approvalComment?: string;
  approvalHistory: ContractReviewSourceApprovalRecord[];
}

export interface PendingApprovalContractSourceListResult {
  items: PendingApprovalContractSourceRecord[];
  page: number;
  pageSize: number;
  total: number;
}

const MOCK_PENDING_APPROVAL_CONTRACT_DETAILS: PendingApprovalContractSourceDetailRecord[] = [
  {
    contractId: 'con_pending_001',
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
    approveStatus: '待审批',
    pendingStep: 1,
    submitApplyingAt: '2026-04-21T09:15:00.000Z',
    startAt: '2026-05-01T00:00:00.000Z',
    endAt: '2027-04-30T00:00:00.000Z',
    signDate: '2026-04-20T00:00:00.000Z',
    customerSigner: '李总',
    ourSigner: '王亮',
    specialTerms:
      '甲方需在验收通过后 45 天内完成付款。\n乙方交付成果的源代码及知识产权归甲方所有。',
    approvalComment: '请重点核对付款账期和知识产权归属。',
    approvalHistory: [
      {
        step: 1,
        status: 'pending',
        approverId: 'user_legal_001',
        approverName: '法务复核',
        comment: '请重点核对付款账期和知识产权归属。',
      },
    ],
  },
  {
    contractId: 'con_pending_002',
    contractCode: 'HT-2026-002',
    contractName: '华东制造实施合同',
    customerName: '苏州制造',
    opportunityTitle: '华东制造流程优化项目',
    ownerId: 'owner_li',
    ownerName: '李浩',
    organizationId: 'org_north',
    departmentId: 'dept_region_east',
    departmentName: '华东销售部',
    totalAmount: 420000,
    approveStatus: '待审批',
    pendingStep: 1,
    submitApplyingAt: '2026-04-22T10:00:00.000Z',
    startAt: '2026-05-10T00:00:00.000Z',
    endAt: '2026-12-31T00:00:00.000Z',
    signDate: '2026-04-22T00:00:00.000Z',
    customerSigner: '周总',
    ourSigner: '王亮',
    specialTerms: '客户要求在项目上线前完成定制报表与专属培训。',
    approvalComment: '关注交付里程碑与验收标准。',
    approvalHistory: [
      {
        step: 1,
        status: 'pending',
        approverId: 'user_legal_002',
        approverName: '商务审批',
        comment: '关注交付里程碑与验收标准。',
      },
    ],
  },
];

const noopSqlAuditService = {
  async execute<T>(options: { execute: () => Promise<T> }): Promise<T> {
    return options.execute();
  },
} as SqlAuditService;

@Injectable()
export class CrmReadonlyService {
  private readonly readonlyDbConnectTimeoutMs = Number(
    process.env.CRM_READONLY_DB_CONNECT_TIMEOUT_MS ?? '8000',
  );
  private pool?: Pool;
  private rawPool?: Pool;
  private poolInitialized = false;
  private poolInitializationPromise?: Promise<boolean>;
  private liveQueryEnabled = false;
  private lastConnectionFailureReason?: string;
  private lastConnectionAttemptAt = 0;
  private identityPoolRecoveryPromise?: Promise<boolean>;
  private readonly accessOptionCacheTtlMs = Number(
    process.env.CRM_ACCESS_OPTION_CACHE_TTL_MS ?? '30000',
  );
  private readonly accessOptionCache = new Map<
    string,
    {
      items: AccessOptionRecord[];
      expiresAt: number;
    }
  >();
  private readonly wecomIdentityMirrorHydratedAt = new Map<string, number>();
  private readonly wecomIdentityMirrorHydrationTtlMs = Number(
    process.env.CRM_WECOM_IDENTITY_MIRROR_TTL_MS ?? '300000',
  );
  private readonly connectionRetryIntervalMs = Number(
    process.env.CRM_READONLY_DB_RETRY_INTERVAL_MS ?? '10000',
  );
  private readonly identityQueryTimeoutMs = Number(
    process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS ?? '8000',
  );
  private readonly identityQueryRetryCount = Number(
    process.env.CRM_READONLY_IDENTITY_QUERY_RETRY_COUNT ?? '1',
  );
  private readonly mockDepartmentNameMap: Record<string, string> = {
    dept_sales: '销售部',
    dept_region_east: '华东销售部',
    dept_sales_management: '销售管理部',
    dept_product: '产品部',
    dept_admin: '行政管理部',
  };
  private readonly mockDepartmentParentMap: Record<string, string | undefined> = {
    dept_sales: undefined,
    dept_region_east: 'dept_sales',
    dept_sales_management: undefined,
    dept_product: undefined,
    dept_admin: undefined,
  };

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
    private readonly sqlAuditService: SqlAuditService = noopSqlAuditService,
  ) {}

  async getUserById(userId: string): Promise<CrmUser | undefined> {
    const localFallbackUser = this.resolveLocalUserById(userId);
    if (process.env.NODE_ENV === 'test' && localFallbackUser) {
      return localFallbackUser;
    }

    if (!(await this.ensurePool())) {
      return this.shouldUseLocalIdentityFallback()
        ? localFallbackUser
        : undefined;
    }

    const [rows] = await this.runIdentityQuery<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string;
          organization_id: string | number | null;
          role_id: string | number | null;
          wecom_userid: string | null;
          role_ids?: string | null;
          role_names?: string | null;
          department_ids?: string | null;
        }
      >
    >({
      sql: `SELECT u.id,
                   u.name,
                   u.organization_id,
                   u.role_id,
                   w.userid AS wecom_userid,
                   CASE
                     WHEN u.role_id IS NOT NULL THEN CAST(u.role_id AS CHAR)
                     ELSE linked_roles.role_ids
                   END AS role_ids,
                   CASE
                     WHEN u.role_id IS NOT NULL THEN direct_role.name
                     ELSE linked_roles.role_names
                   END AS role_names,
                   user_departments.department_ids AS department_ids
              FROM users u
         LEFT JOIN wx_user_maps m ON m.user_id = u.id
         LEFT JOIN wx_users w ON w.id = m.wx_user_id
         LEFT JOIN roles direct_role ON direct_role.id = u.role_id
         LEFT JOIN (
              SELECT ru.user_id,
                     GROUP_CONCAT(DISTINCT r.id ORDER BY r.id SEPARATOR ',') AS role_ids,
                     GROUP_CONCAT(DISTINCT r.name ORDER BY r.id SEPARATOR ',') AS role_names
                FROM roles_users ru
          INNER JOIN roles r ON r.id = ru.role_id
            GROUP BY ru.user_id
         ) linked_roles ON linked_roles.user_id = u.id
         LEFT JOIN (
              SELECT user_id,
                     GROUP_CONCAT(DISTINCT department_id ORDER BY department_id SEPARATOR ',') AS department_ids
                FROM users_departments
               WHERE department_id IS NOT NULL
            GROUP BY user_id
         ) user_departments ON user_departments.user_id = u.id
             WHERE u.id = ?
             LIMIT 1`,
      values: [userId],
      label: 'getUserById:user',
      programName: 'CrmReadonlyService.getUserById',
    });

    const userRow = rows[0];
    if (!userRow) {
      return this.shouldUseLocalIdentityFallback()
        ? localFallbackUser
        : undefined;
    }

    return this.buildLiveUserContext(userRow);
  }

  /**
   * 批量解析用户展示名，只读取用户基础字段，不构建角色、组织和部门上下文。
   *
   * @param identifiers CRM 用户 ID、手机号、邮箱或企业微信 userid 候选值。
   * @returns 以传入标识为 key、用户姓名为 value 的映射；查询失败由调用方决定是否降级。
   *
   * 设计原因：审计列表分页只需要展示行为人姓名，不能复用 `getUserById` 的完整身份链路，
   * 否则每页多条历史记录会并发查询角色和部门，生产 CRM 慢查询时容易拖慢列表甚至触发 500。
   */
  async listUserDisplayNamesByIdentifiers(
    identifiers: string[],
    options: { audit?: boolean } = {},
  ): Promise<Map<string, string>> {
    const normalizedIdentifiers = Array.from(
      new Set(identifiers.map((item) => item.trim()).filter(Boolean)),
    );
    const displayNameMap = new Map<string, string>();

    if (normalizedIdentifiers.length === 0) {
      return displayNameMap;
    }

    const localFallbackNameMap =
      this.resolveLocalUserDisplayNamesByIdentifiers(normalizedIdentifiers);

    if (process.env.NODE_ENV === 'test') {
      return localFallbackNameMap;
    }

    if (!(await this.ensurePool())) {
      return localFallbackNameMap;
    }

    const [rows] = await this.runIdentityQuery<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string | null;
          phone: string | null;
          email: string | null;
          wecom_userid: string | null;
        }
      >
    >({
      sql: `SELECT u.id,
                   u.name,
                   u.phone,
                   u.email,
                   w.userid AS wecom_userid
              FROM users u
         LEFT JOIN wx_user_maps m ON m.user_id = u.id
         LEFT JOIN wx_users w ON w.id = m.wx_user_id
             WHERE u.id IN (?)
                OR u.phone IN (?)
                OR u.email IN (?)
                OR w.userid IN (?)`,
      values: [
        normalizedIdentifiers,
        normalizedIdentifiers,
        normalizedIdentifiers,
        normalizedIdentifiers,
      ],
      label: 'listUserDisplayNamesByIdentifiers:users',
      programName: 'CrmReadonlyService.listUserDisplayNamesByIdentifiers',
      suppressAudit: options.audit === false,
    });

    for (const row of rows) {
      const displayName = row.name?.trim();
      if (!displayName) {
        continue;
      }

      const rowKeys = [
        row.id === undefined || row.id === null ? '' : String(row.id),
        row.phone,
        row.email,
        row.wecom_userid,
      ];

      for (const key of rowKeys) {
        const normalizedKey = key?.trim();
        if (normalizedKey && normalizedIdentifiers.includes(normalizedKey)) {
          displayNameMap.set(normalizedKey, displayName);
        }
      }
    }

    for (const [key, displayName] of localFallbackNameMap.entries()) {
      if (!displayNameMap.has(key)) {
        displayNameMap.set(key, displayName);
      }
    }

    return displayNameMap;
  }

  /**
   * 从本地样例用户中解析展示名，作为 CRM 只读库不可用或内置用户未入库时的兜底。
   *
   * @param normalizedIdentifiers 已去重并去空白的用户标识列表。
   * @returns 以原始标识为 key 的中文展示名映射。
   */
  private resolveLocalUserDisplayNamesByIdentifiers(
    normalizedIdentifiers: string[],
  ): Map<string, string> {
    const displayNameMap = new Map<string, string>();
    for (const user of CRM_USERS) {
      const candidateKeys = [user.id, user.name, user.wecomSenderId].filter(
        (item): item is string => Boolean(item),
      );
      for (const key of candidateKeys) {
        if (normalizedIdentifiers.includes(key)) {
          displayNameMap.set(key, user.name);
        }
      }
    }
    return displayNameMap;
  }

  private shouldUseLocalIdentityFallback(): boolean {
    if (process.env.CRM_LOCAL_IDENTITY_FALLBACK_ENABLED === 'true') {
      return true;
    }
    if (process.env.CRM_LOCAL_IDENTITY_FALLBACK_ENABLED === 'false') {
      return false;
    }
    return process.env.NODE_ENV !== 'production';
  }

  private resolveLocalUserById(userId: string): CrmUser | undefined {
    const mockUser = CRM_USERS.find((item) => item.id === userId);
    if (!mockUser) {
      return undefined;
    }

    return {
      ...mockUser,
      identitySource: 'mock',
    };
  }

  private resolveLocalUserByWecomSenderId(senderId: string): CrmUser | undefined {
    const wxUser = this.appStorage.state.crmWxUsers.find(
      (item) => item.userid === senderId || item.originUserid === senderId,
    );
    const wxUserMap = wxUser
      ? this.appStorage.state.crmWxUserMaps.find(
          (item) => item.wxUserId === wxUser.id,
        )
      : undefined;
    const mappedUser = wxUserMap
      ? CRM_USERS.find((item) => item.id === wxUserMap.crmUserId)
      : undefined;
    const directUser =
      mappedUser ?? CRM_USERS.find((item) => item.wecomSenderId === senderId);
    if (!directUser) {
      return undefined;
    }

    return {
      ...directUser,
      identitySource: 'database',
    };
  }

  async getUserByWecomSenderId(senderId: string): Promise<CrmUser | undefined> {
    const localFallbackUser = this.resolveLocalUserByWecomSenderId(senderId);
    if (process.env.NODE_ENV === 'test' && localFallbackUser) {
      return localFallbackUser;
    }

    if (!(await this.ensurePool())) {
      return this.shouldUseLocalIdentityFallback()
        ? localFallbackUser
        : undefined;
    }

    const [rows] = await this.runIdentityQuery<
      Array<RowDataPacket & { user_id: string | number }>
    >({
      sql: `SELECT m.user_id
           FROM wx_user_maps m
           INNER JOIN wx_users w ON w.id = m.wx_user_id
           WHERE w.userid = ?
           LIMIT 1`,
      values: [senderId],
      label: 'getUserByWecomSenderId:mapping',
      programName: 'CrmReadonlyService.getUserByWecomSenderId',
    });

    const mappedUserId = rows[0]?.user_id;
    if (mappedUserId === undefined || mappedUserId === null) {
      return this.shouldUseLocalIdentityFallback()
        ? localFallbackUser
        : undefined;
    }

    return this.getUserById(String(mappedUserId));
  }

  async getWecomSenderIdByUserId(userId: string): Promise<string | undefined> {
    if (process.env.NODE_ENV === 'test') {
      const mockUser = CRM_USERS.find((item) => item.id === userId);
      return mockUser?.wecomSenderId;
    }

    if (!(await this.ensurePool())) {
      return undefined;
    }

    const [rows] = await this.pool!.query<
      Array<RowDataPacket & { userid: string | null }>
    >(
      `SELECT w.userid
       FROM wx_user_maps m
       INNER JOIN wx_users w ON w.id = m.wx_user_id
       WHERE m.user_id = ?
       LIMIT 1`,
      [userId],
    );

    return rows[0]?.userid ?? undefined;
  }

  async getUserByPhoneOrEmail(value: string): Promise<CrmUser | undefined> {
    if (process.env.NODE_ENV === 'test') {
      const mockUser = CRM_USERS.find(
        (item) =>
          item.wecomSenderId === value ||
          item.id === value ||
          item.name === value,
      );
      if (mockUser) {
        return {
          ...mockUser,
          identitySource: 'mock',
        };
      }
    }

    if (!(await this.ensurePool())) {
      return undefined;
    }

    const [rows] = await this.runIdentityQuery<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string;
          organization_id: string | number | null;
          role_id: string | number | null;
          wecom_userid: string | null;
        }
      >
    >({
      sql: `SELECT u.id,
                   u.name,
                   u.organization_id,
                   u.role_id,
                   w.userid AS wecom_userid
              FROM users u
         LEFT JOIN wx_user_maps m ON m.user_id = u.id
         LEFT JOIN wx_users w ON w.id = m.wx_user_id
             WHERE u.phone = ? OR u.email = ?
             LIMIT 1`,
      values: [value, value],
      label: 'getUserByPhoneOrEmail:user',
      programName: 'CrmReadonlyService.getUserByPhoneOrEmail',
    });

    const userRow = rows[0];
    if (!userRow) {
      return undefined;
    }

    return this.buildLiveUserContext(userRow);
  }

  async listUsersByPhoneOrEmail(value: string): Promise<CrmUser[]> {
    if (process.env.NODE_ENV === 'test') {
      return CRM_USERS.filter(
        (item) =>
          item.wecomSenderId === value ||
          item.id === value ||
          item.name === value,
      ).map((item) => ({
        ...item,
        identitySource: 'mock',
      }));
    }

    if (!(await this.ensurePool())) {
      return [];
    }

    const [rows] = await this.runIdentityQuery<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string;
          organization_id: string | number | null;
          role_id: string | number | null;
          wecom_userid: string | null;
        }
      >
    >({
      sql: `SELECT u.id,
                   u.name,
                   u.organization_id,
                   u.role_id,
                   w.userid AS wecom_userid
              FROM users u
         LEFT JOIN wx_user_maps m ON m.user_id = u.id
         LEFT JOIN wx_users w ON w.id = m.wx_user_id
             WHERE u.phone = ? OR u.email = ?`,
      values: [value, value],
      label: 'listUsersByPhoneOrEmail:users',
      programName: 'CrmReadonlyService.listUsersByPhoneOrEmail',
    });

    const users: CrmUser[] = [];
    for (const row of rows) {
      users.push(await this.buildLiveUserContext(row));
    }

    return users;
  }

  async executeQuery<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    options: { timeoutMs?: number } = {},
  ): Promise<T[]> {
    if (!(await this.ensurePool())) {
      return [];
    }

    const [rows] = await this.sqlAuditService.execute({
      sql,
      params,
      timeoutMs: options.timeoutMs,
      databaseRole: 'CRM_READONLY',
      moduleKey: 'crm-readonly',
      programName: 'CrmReadonlyService.executeQuery',
      execute: () =>
        this.withQueryTimeout(
          (this.rawPool ?? this.pool)!.query(sql, params),
          options.timeoutMs,
        ),
    });
    return rows as T[];
  }

  async preflightQuery(
    sql: string,
    params: unknown[] = [],
    options: { timeoutMs?: number } = {},
  ): Promise<void> {
    if (!(await this.ensurePool())) {
      return;
    }

    try {
      await this.sqlAuditService.execute({
        sql: `EXPLAIN ${sql}`,
        params,
        stage: 'PREFLIGHT',
        timeoutMs: options.timeoutMs,
        databaseRole: 'CRM_READONLY',
        moduleKey: 'crm-readonly',
        programName: 'CrmReadonlyService.preflightQuery',
        execute: () =>
          this.withQueryTimeout(
            (this.rawPool ?? this.pool)!.query(`EXPLAIN ${sql}`, params),
            options.timeoutMs,
          ),
      });
    } catch (error) {
      throw new QueryPreflightError(
        `执行前预检失败，SQL 无法通过数据库检查：${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private async withQueryTimeout<T>(
    queryPromise: Promise<T>,
    timeoutMs?: number,
  ): Promise<T> {
    if (!timeoutMs || timeoutMs <= 0) {
      return await queryPromise;
    }

    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        queryPromise,
        new Promise<T>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(
              new QueryExecutionTimeoutError(
                `查询执行超过 ${timeoutMs}ms 受控超时限制，系统已终止等待结果。`,
              ),
            );
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * 企业微信身份解析相关查询必须设置有限等待时间，避免入口消息长期停留在处理中。
   * @param params 身份查询的 SQL、参数与标签信息。
   * @returns 与 mysql2 原始 query 保持一致的结果。
   */
  private async runIdentityQuery<TRows>(
    params: {
      sql: string;
      values?: unknown[];
      label: string;
      programName: string;
      suppressAudit?: boolean;
    },
  ): Promise<[TRows, unknown[]]> {
    const maxAttempts = Math.max(1, this.identityQueryRetryCount + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.sqlAuditService.execute({
          sql: params.sql,
          params: params.values ?? [],
          timeoutMs: this.identityQueryTimeoutMs,
          databaseRole: 'CRM_READONLY',
          moduleKey: 'crm-identity',
          programName: params.programName,
          suppressAudit: params.suppressAudit,
          execute: () =>
            this.withQueryTimeout(
              (this.rawPool ?? this.pool)!.query(
                params.sql,
                params.values ?? [],
              ) as Promise<[TRows, unknown[]]>,
              this.identityQueryTimeoutMs,
            ),
        });
      } catch (error) {
        if (
          !(error instanceof QueryExecutionTimeoutError) ||
          attempt >= maxAttempts
        ) {
          throw error;
        }

        // 身份查询大多是几十毫秒内完成；一旦超时，更可能是连接池中的旧查询未释放。
        // 这里先切换到新连接池再重试一次，避免登录和会话鉴权被瞬时抖动直接打成 500。
        const reconnected = await this.recoverPoolAfterIdentityTimeout(
          params.label,
          attempt,
          maxAttempts,
        );
        if (!reconnected || !this.pool) {
          this.analysisLoggerService.logWarn('CRM 身份查询超时后重建只读连接池失败。', {
            label: params.label,
            attempt,
            maxAttempts,
          });
          throw error;
        }
      }
    }

    throw new QueryExecutionTimeoutError();
  }

  /**
   * 将身份查询超时后的连接池恢复流程串行化，避免并发请求相互关闭刚恢复的新 pool。
   *
   * @param label 当前超时查询标签。
   * @param attempt 当前重试轮次。
   * @param maxAttempts 最大尝试次数。
   * @returns 恢复后是否拿到了可用连接池。
   */
  private async recoverPoolAfterIdentityTimeout(
    label: string,
    attempt: number,
    maxAttempts: number,
  ): Promise<boolean> {
    if (!this.identityPoolRecoveryPromise) {
      this.resetPoolAfterIdentityTimeout(label, attempt, maxAttempts);
      this.identityPoolRecoveryPromise = (async () => {
        const reconnected = await this.ensurePool();
        return reconnected && Boolean(this.pool);
      })().finally(() => {
        this.identityPoolRecoveryPromise = undefined;
      });
      return await this.identityPoolRecoveryPromise;
    }

    this.analysisLoggerService.logWarn('CRM 身份查询超时恢复进行中，当前请求复用同一次连接池恢复。', {
      label,
      attempt,
      maxAttempts,
    });
    return await this.identityPoolRecoveryPromise;
  }

  /**
   * 身份查询超时后切断旧连接池引用，并允许下一次 `ensurePool` 立即新建连接池。
   *
   * 设计原因：
   * 1. `Promise.race` 只能终止等待，不能取消 mysql2 已发出的真实查询；
   * 2. 若继续复用同一个 pool，慢查询可能长期占住连接，进而把后续登录和会话续期一起拖死；
   * 3. 先摘掉旧 pool 再重建，能够把身份解析请求从已污染的连接队列中隔离出来。
   */
  private resetPoolAfterIdentityTimeout(
    label: string,
    attempt: number,
    maxAttempts: number,
  ): void {
    const stalePool = this.rawPool;
    this.pool = undefined;
    this.rawPool = undefined;
    this.poolInitialized = false;
    this.liveQueryEnabled = false;
    this.lastConnectionFailureReason = `identity-timeout:${label}`;
    this.analysisLoggerService.logWarn('CRM 身份查询超时，准备重建只读连接池。', {
      label,
      attempt,
      maxAttempts,
      timeoutMs: this.identityQueryTimeoutMs,
    });

    if (!stalePool) {
      return;
    }

    void stalePool.end().catch((error: unknown) => {
      this.analysisLoggerService.logWarn('关闭超时前的只读连接池失败。', {
        label,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    });
  }

  canUseLiveQuery(): boolean {
    return this.liveQueryEnabled;
  }

  async ensureLiveQueryReady(): Promise<boolean> {
    return this.ensurePool();
  }

  getLastConnectionFailureReason(): string | undefined {
    return this.lastConnectionFailureReason;
  }

  listUsers(): CrmUser[] {
    return CRM_USERS.map((item) => ({ ...item, identitySource: 'mock' }));
  }

  async listAccessGovernanceUsers(currentUser: CrmUser): Promise<AccessOptionRecord[]> {
    const cachedOptions = this.readAccessOptionCache('users', currentUser);
    if (cachedOptions) {
      return cachedOptions;
    }

    if (process.env.NODE_ENV === 'test') {
      return this.listUsers()
        .filter((item) =>
          item.organizationIds.some((organizationId) =>
            currentUser.organizationIds.includes(organizationId),
          ),
        )
        .map((item) => ({
          value: item.id,
          label: `${item.name}（${item.roleNames.join('、') || item.id}）`,
        }));
    }

    if (!(await this.ensurePool())) {
      const fallbackOptions = this.listUsers()
        .filter((item) =>
          item.organizationIds.some((organizationId) =>
            currentUser.organizationIds.includes(organizationId),
          ),
        )
        .map((item) => ({
          value: item.id,
          label: `${item.name}（${item.roleNames.join('、') || item.id}）`,
        }));
      return fallbackOptions;
    }

    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string | null;
          direct_role_name: string | null;
          linked_role_names: string | null;
        }
      >
    >(
      `SELECT u.id,
              u.name,
              direct_role.name AS direct_role_name,
              linked_roles.role_names AS linked_role_names
       FROM users u
       LEFT JOIN roles direct_role ON direct_role.id = u.role_id
       LEFT JOIN (
         SELECT ru.user_id,
                GROUP_CONCAT(DISTINCT r.name ORDER BY r.name ASC SEPARATOR '、') AS role_names
         FROM roles_users ru
         INNER JOIN roles r ON r.id = ru.role_id
         GROUP BY ru.user_id
       ) linked_roles ON linked_roles.user_id = u.id
       WHERE u.organization_id IN (?)
         AND (u.deleted_at IS NULL OR u.deleted_at = 0)
       ORDER BY u.name ASC, u.id ASC`,
      [currentUser.organizationIds],
    );

    const options = rows.map((item) => {
      const roleNames = [
        item.direct_role_name?.trim(),
        item.linked_role_names?.trim(),
      ].filter((value, index, list): value is string => {
        if (!value) {
          return false;
        }

        return list.indexOf(value) === index;
      });

      return {
        value: String(item.id),
        label: `${item.name?.trim() || String(item.id)}（${roleNames.join('、') || String(item.id)}）`,
      };
    });
    this.writeAccessOptionCache('users', currentUser, options);
    return options;
  }

  async listAccessGovernanceRoles(currentUser: CrmUser): Promise<AccessOptionRecord[]> {
    const cachedOptions = this.readAccessOptionCache('roles', currentUser);
    if (cachedOptions) {
      return cachedOptions;
    }

    if (process.env.NODE_ENV === 'test') {
      return Array.from(
        new Map(
          this.listUsers()
            .filter((item) =>
              item.organizationIds.some((organizationId) =>
                currentUser.organizationIds.includes(organizationId),
              ),
            )
            .flatMap((item) =>
            item.roleIds.map((roleId, index) => [
              roleId,
              {
                value: roleId,
                label: item.roleNames[index] ?? roleId,
              },
            ]),
          ),
        ).values(),
      );
    }

    if (!(await this.ensurePool())) {
      const fallbackOptions = Array.from(
        new Map(
          this.listUsers()
            .filter((item) =>
              item.organizationIds.some((organizationId) =>
                currentUser.organizationIds.includes(organizationId),
              ),
            )
            .flatMap((item) =>
            item.roleIds.map((roleId, index) => [
              roleId,
              {
                value: roleId,
                label: item.roleNames[index] ?? roleId,
              },
            ]),
          ),
        ).values(),
      );
      return fallbackOptions;
    }

    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string | null;
          organization_id: string | number | null;
        }
      >
    >(
      `SELECT id, name, organization_id
       FROM roles
       WHERE organization_id IN (?)
          OR organization_id IS NULL
       ORDER BY organization_id IS NULL DESC, name ASC`,
      [currentUser.organizationIds],
    );

    const options = rows.map((item) => ({
      value: String(item.id),
      label: item.name?.trim() || String(item.id),
    }));
    this.writeAccessOptionCache('roles', currentUser, options);
    return options;
  }

  async listAccessGovernanceDepartments(
    currentUser: CrmUser,
  ): Promise<AccessOptionRecord[]> {
    const cachedOptions = this.readAccessOptionCache('departments', currentUser);
    if (cachedOptions) {
      return cachedOptions;
    }

    if (process.env.NODE_ENV === 'test') {
      const sourceUsers = currentUser.isAdmin
        ? this.listUsers()
        : this.listUsers().filter((item) =>
            item.organizationIds.some((organizationId) =>
              currentUser.organizationIds.includes(organizationId),
            ),
          );
      return Array.from(
        new Map(
          sourceUsers
            .flatMap((item) =>
              item.departmentIds.map((departmentId) => [
                departmentId,
              {
                value: departmentId,
                label: this.mockDepartmentNameMap[departmentId] ?? departmentId,
                parentDepartmentId: this.mockDepartmentParentMap[departmentId],
              },
            ]),
          ),
        ).values(),
      );
    }

    if (!(await this.ensurePool())) {
      const sourceUsers = currentUser.isAdmin
        ? this.listUsers()
        : this.listUsers().filter((item) =>
            item.organizationIds.some((organizationId) =>
              currentUser.organizationIds.includes(organizationId),
            ),
          );
      const fallbackOptions = Array.from(
        new Map(
          sourceUsers
            .flatMap((item) =>
              item.departmentIds.map((departmentId) => [
                departmentId,
              {
                value: departmentId,
                label: this.mockDepartmentNameMap[departmentId] ?? departmentId,
                parentDepartmentId: this.mockDepartmentParentMap[departmentId],
              },
            ]),
          ),
        ).values(),
      );
      return fallbackOptions;
    }

    const [rows] = await this.runIdentityQuery<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string | null;
          organization_id: string | number | null;
          parent_id: string | number | null;
        }
      >
    >({
      sql:
        currentUser.isAdmin
          ? `SELECT id, name, organization_id, parent_id
               FROM departments
               WHERE deleted_at IS NULL
               ORDER BY name ASC`
          : `SELECT id, name, organization_id, parent_id
               FROM departments
               WHERE organization_id IN (?)
                 AND deleted_at IS NULL
               ORDER BY name ASC`,
      values: currentUser.isAdmin ? [] : [currentUser.organizationIds],
      label: 'listAccessGovernanceDepartments:departments',
      programName: 'CrmReadonlyService.listAccessGovernanceDepartments',
    });

    const options = rows.map((item) => ({
      value: String(item.id),
      label: item.name?.trim() || String(item.id),
      parentDepartmentId:
        item.parent_id === null || item.parent_id === undefined
          ? undefined
          : String(item.parent_id),
    }));
    this.writeAccessOptionCache('departments', currentUser, options);
    return options;
  }

  /**
   * 读取日报发送规则可用的 CRM 部门清单。
   *
   * 参数：无。
   * 返回值：部门选择项，包含父部门 ID 以便页面启用销售部门后推导区域收件规则。
   * 异常场景：只读库不可用时回退到当前用户快照中的部门，避免“按钮已启用但发送解析为空”。
   * 调用注意：该方法只提供部门结构，不负责判断某个部门是否应参与日报发送。
   */
  async listDailyReportDepartments(): Promise<AccessOptionRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      return this.buildFallbackDepartmentOptions(this.listUsers());
    }

    // 生产连接不可用时保留可解释的本地兜底，页面配置不会因此直接失效。
    if (!(await this.ensurePool())) {
      return this.buildFallbackDepartmentOptions(this.listUsers());
    }

    const [rows] = await this.runIdentityQuery<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string | null;
          parent_id: string | number | null;
        }
      >
    >({
      sql: `SELECT id, name, parent_id
            FROM departments
            WHERE deleted_at IS NULL
            ORDER BY name ASC`,
      label: 'listDailyReportDepartments:departments',
      programName: 'CrmReadonlyService.listDailyReportDepartments',
    });

    return rows.map((item) => ({
      value: String(item.id),
      label: item.name?.trim() || String(item.id),
      parentDepartmentId:
        item.parent_id === null || item.parent_id === undefined
          ? undefined
          : String(item.parent_id),
    }));
  }

  async listAccessGovernanceWecomUsers(
    currentUser: CrmUser,
  ): Promise<AccessOptionRecord[]> {
    const cachedOptions = this.readAccessOptionCache('wecom-users', currentUser);
    if (cachedOptions) {
      return cachedOptions;
    }

    if (process.env.NODE_ENV === 'test') {
      const organizationScopedUsers = this.listUsers()
        .filter((item) =>
          item.organizationIds.some((organizationId) =>
            currentUser.organizationIds.includes(organizationId),
          ),
        )
        .map((item) => item.wecomSenderId)
        .filter((item): item is string => Boolean(item));

      return this.appStorage.state.crmWxUsers
        .filter((item) => organizationScopedUsers.includes(item.userid))
        .map((item) => ({
          value: item.userid,
          label: item.name?.trim() ? `${item.name}（${item.userid}）` : item.userid,
        }));
    }

    if (!(await this.ensurePool())) {
      return [];
    }

    const [rows] = await this.pool!.query<
      Array<RowDataPacket & { userid: string; name: string | null }>
    >(
      `SELECT DISTINCT w.userid, w.name
       FROM wx_users w
       INNER JOIN wx_user_maps m ON m.wx_user_id = w.id
       INNER JOIN users u ON u.id = m.user_id
       WHERE u.organization_id IN (?)
       ORDER BY name ASC`,
      [currentUser.organizationIds],
    );

    const options = rows.map((item) => ({
      value: item.userid,
      label: item.name?.trim() ? `${item.name}（${item.userid}）` : item.userid,
    }));
    this.writeAccessOptionCache('wecom-users', currentUser, options);
    return options;
  }

  async listDailyReportUsers(): Promise<CrmUser[]> {
    if (process.env.NODE_ENV === 'test') {
      return this.listUsers();
    }

    if (!(await this.ensurePool())) {
      return this.listUsers();
    }

    const [rows] = await this.runIdentityQuery<
      Array<
        RowDataPacket & {
          id: string | number;
          name: string;
          organization_id: string | number | null;
          role_id: string | number | null;
        }
      >
    >({
      sql: `SELECT id, name, organization_id, role_id
           FROM users`,
      label: 'listDailyReportUsers:users',
      programName: 'CrmReadonlyService.listDailyReportUsers',
    });

    const users: CrmUser[] = [];
    for (const row of rows) {
      users.push(await this.buildLiveUserContext(row));
    }

    return users;
  }

  /**
   * 根据用户快照生成部门选项兜底。
   *
   * 参数：`users` 为可见 CRM 用户列表。
   * 返回值：去重后的部门选项。
   * 异常场景：无；缺少部门名称时使用部门 ID，避免阻断日报发送链路。
   * 调用注意：这是只读库不可用时的保底结构，真实生产仍应优先修复部门表查询。
   */
  private buildFallbackDepartmentOptions(users: CrmUser[]): AccessOptionRecord[] {
    return Array.from(
      new Map(
        users.flatMap((item) =>
          item.departmentIds.map((departmentId) => [
            departmentId,
            {
              value: departmentId,
              label: this.mockDepartmentNameMap[departmentId] ?? departmentId,
              parentDepartmentId: this.mockDepartmentParentMap[departmentId],
            },
          ]),
        ),
      ).values(),
    );
  }

  async listDailyReportUsersByOrganizations(
    organizationIds: string[],
  ): Promise<CrmUser[]> {
    const users = await this.listDailyReportUsers();
    return users.filter((item) =>
      item.organizationIds.some((organizationId) =>
        organizationIds.includes(organizationId),
      ),
    );
  }

  listOpportunities(): CrmOpportunity[] {
    return [...CRM_OPPORTUNITIES];
  }

  listContracts(): CrmContract[] {
    return [...CRM_CONTRACTS];
  }

  listCustomers(): CrmCustomer[] {
    return [...CRM_CUSTOMERS];
  }

  async resolveFieldValueLabels(params: {
    fieldName: string;
    values: string[];
    organizationIds?: string[];
    klassNameLike?: string;
  }): Promise<Record<string, string>> {
    if (params.values.length === 0) {
      return {};
    }

    if (process.env.NODE_ENV === 'test') {
      return {};
    }

    if (!(await this.ensurePool())) {
      return {};
    }

    const normalizedValues = Array.from(
      new Set(params.values.map((item) => item.trim()).filter(Boolean)),
    );
    if (normalizedValues.length === 0) {
      return {};
    }

    const clauses: string[] = ['fm.field_name = ?'];
    const queryParams: unknown[] = [params.fieldName];

    if (params.klassNameLike?.trim()) {
      clauses.push('fm.klass_name LIKE ?');
      queryParams.push(params.klassNameLike.trim());
    }

    if ((params.organizationIds ?? []).length > 0) {
      clauses.push('(fm.organization_id IN (?) OR fm.organization_id IS NULL)');
      clauses.push('(fv.organization_id IN (?) OR fv.organization_id IS NULL)');
      queryParams.push(params.organizationIds);
      queryParams.push(params.organizationIds);
    }

    clauses.push('fv.id IN (?)');
    queryParams.push(normalizedValues);

    const [rows] = await this.pool!.query<
      Array<RowDataPacket & { id: string | number | null; value: string | null; name: string | null }>
    >(
      `SELECT fv.id, fv.value, fv.name
       FROM field_values fv
       INNER JOIN field_maps fm ON fm.id = fv.field_map_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY fv.position ASC, fv.id ASC`,
      queryParams,
    );

    const labelMap: Record<string, string> = {};
    for (const row of rows) {
      const rawId =
        row.id === null || row.id === undefined ? '' : String(row.id).trim();
      const label = row.name?.trim() || row.value?.trim();
      if (!rawId || !label || labelMap[rawId]) {
        continue;
      }

      labelMap[rawId] = label;
    }

    return labelMap;
  }

  async listPendingApprovalContracts(params?: {
    scopeSnapshot?: Pick<ScopeSnapshot, 'organizationIds' | 'ownerIds'>;
    page?: number;
    pageSize?: number;
  }): Promise<PendingApprovalContractSourceListResult> {
    const page =
      Number.isFinite(params?.page) && (params?.page ?? 0) > 0
        ? Math.floor(params?.page ?? 1)
        : 1;
    const pageSize =
      Number.isFinite(params?.pageSize) && (params?.pageSize ?? 0) > 0
        ? Math.floor(params?.pageSize ?? 15)
        : 15;
    const scopeSnapshot = params?.scopeSnapshot;

    if (process.env.NODE_ENV === 'test') {
      return this.listMockPendingApprovalContracts(scopeSnapshot, page, pageSize);
    }

    if (!(await this.ensurePool())) {
      return this.listMockPendingApprovalContracts(scopeSnapshot, page, pageSize);
    }

    const { whereClause, values } = this.buildPendingApprovalContractWhereClause(
      scopeSnapshot,
    );
    const offset = (page - 1) * pageSize;

    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          sn: string | null;
          title: string | null;
          customer_name: string | null;
          user_id: string | number;
          owner_name: string | null;
          organization_id: string | number;
          department_id: string | number | null;
          department_name: string | null;
          total_amount: number | string | null;
          approve_status: string | number | null;
          pending_step: number | string | null;
          submit_applying_at: Date | string | null;
          finish_approve_at: Date | string | null;
        }
      >
    >(
      `SELECT c.id,
              c.sn,
              c.title,
              cu.name AS customer_name,
              c.user_id,
              u.name AS owner_name,
              c.organization_id,
              c.department_id,
              d.name AS department_name,
              c.total_amount,
              c.approve_status,
              c.pending_step,
              c.submit_applying_at,
              c.finish_approve_at
       FROM contracts c
       LEFT JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN departments d ON d.id = c.department_id
       ${whereClause}
       ORDER BY COALESCE(c.submit_applying_at, c.updated_at, c.created_at) DESC
       LIMIT ?
       OFFSET ?`,
      [...values, pageSize, offset],
    );

    const [countRows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          total: number | string;
        }
      >
    >(
      `SELECT COUNT(*) AS total
       FROM contracts c
       ${whereClause}`,
      values,
    );

    return {
      items: rows.map((row) => this.mapPendingApprovalContractSummary(row)),
      page,
      pageSize,
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async getPendingApprovalContractDetail(
    contractId: string,
  ): Promise<PendingApprovalContractSourceDetailRecord | undefined> {
    if (process.env.NODE_ENV === 'test') {
      return this.getMockPendingApprovalContractDetail(contractId);
    }

    if (!(await this.ensurePool())) {
      return this.getMockPendingApprovalContractDetail(contractId);
    }

    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          sn: string | null;
          title: string | null;
          customer_name: string | null;
          opportunity_title: string | null;
          user_id: string | number;
          owner_name: string | null;
          organization_id: string | number;
          department_id: string | number | null;
          department_name: string | null;
          total_amount: number | string | null;
          approve_status: string | number | null;
          pending_step: number | string | null;
          submit_applying_at: Date | string | null;
          finish_approve_at: Date | string | null;
          start_at: Date | string | null;
          end_at: Date | string | null;
          sign_date: Date | string | null;
          customer_signer: string | null;
          our_signer: string | null;
          special_terms: string | null;
        }
      >
    >(
      `SELECT c.id,
              c.sn,
              c.title,
              cu.name AS customer_name,
              o.title AS opportunity_title,
              c.user_id,
              u.name AS owner_name,
              c.organization_id,
              c.department_id,
              d.name AS department_name,
              c.total_amount,
              c.approve_status,
              c.pending_step,
              c.submit_applying_at,
              c.finish_approve_at,
              c.start_at,
              c.end_at,
              c.sign_date,
              c.customer_signer,
              c.our_signer,
              c.special_terms
       FROM contracts c
       LEFT JOIN customers cu ON cu.id = c.customer_id
       LEFT JOIN opportunities o ON o.id = c.opportunity_id
       LEFT JOIN users u ON u.id = c.user_id
       LEFT JOIN departments d ON d.id = c.department_id
       WHERE c.id = ?
       LIMIT 1`,
      [contractId],
    );

    const row = rows[0];
    if (!row) {
      return undefined;
    }

    const [approvalRows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          step: number | string | null;
          status: string | null;
          user_id: string | number | null;
          approver_name: string | null;
          approve_at: Date | string | null;
          content: string | null;
        }
      >
    >(
      `SELECT a.step,
              a.status,
              a.user_id,
              u.name AS approver_name,
              a.approve_at,
              a.content
       FROM contract_multistep_approves a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.contract_id = ?
       ORDER BY a.step ASC, a.approve_at DESC`,
      [contractId],
    );

    return this.mapPendingApprovalContractDetail(row, approvalRows);
  }

  async listDailyFollowUpSources(
    requesterId: string,
    businessDate: string,
  ): Promise<DailyReportFollowUpSourceRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      return this.listMockDailyFollowUpSources(requesterId, businessDate);
    }

    if (!(await this.ensurePool())) {
      return this.listMockDailyFollowUpSources(requesterId, businessDate);
    }

    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          user_id: string | number;
          requester_name: string | null;
          loggable_id: string | number | null;
          loggable_type: string | null;
          object_title: string | null;
          customer_name: string | null;
          content: string | null;
          activity_at: Date | string | null;
        }
      >
    >(
      `SELECT rl.id,
              rl.user_id,
              COALESCE(u.name, CAST(rl.user_id AS CHAR)) AS requester_name,
              rl.loggable_id,
              rl.loggable_type,
              CASE
                WHEN rl.loggable_type = 'Opportunity' THEN o.title
                WHEN rl.loggable_type = 'Customer' THEN lc.name
                ELSE NULL
              END AS object_title,
              COALESCE(cc.name, oc.name, lc.name) AS customer_name,
              rl.content,
              COALESCE(rl.real_revisit_at, rl.created_at) AS activity_at
       FROM revisit_logs rl
       LEFT JOIN users u ON u.id = rl.user_id
       LEFT JOIN opportunities o
         ON rl.loggable_type = 'Opportunity'
        AND o.id = rl.loggable_id
       LEFT JOIN customers oc ON oc.id = o.customer_id
       LEFT JOIN customers lc
         ON rl.loggable_type = 'Customer'
        AND lc.id = rl.loggable_id
       LEFT JOIN customers cc ON cc.id = rl.customer_id
       WHERE rl.user_id = ?
         AND rl.loggable_type IN ('Customer', 'Opportunity')
         AND DATE(COALESCE(rl.real_revisit_at, rl.created_at)) = ?
       ORDER BY COALESCE(rl.real_revisit_at, rl.created_at) ASC`,
      [requesterId, businessDate],
    );

    return rows.map((item) => ({
      id: String(item.id),
      requesterId: String(item.user_id),
      requesterName: item.requester_name?.trim() || String(item.user_id),
      objectType:
        item.loggable_type === 'Customer' ? 'Customer' : 'Opportunity',
      objectId: String(item.loggable_id ?? ''),
      objectTitle: item.object_title?.trim() || String(item.loggable_id ?? ''),
      customerName: item.customer_name?.trim() || undefined,
      content: item.content?.trim() || '',
      writtenAt: this.normalizeDbDatetime(item.activity_at) ?? `${businessDate}T00:00:00.000Z`,
    }));
  }

  async listDailyCreatedCustomers(
    requesterId: string,
    businessDate: string,
  ): Promise<DailyReportCreatedCustomerSourceRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      return this.listMockDailyCreatedCustomers(requesterId, businessDate);
    }

    if (!(await this.ensurePool())) {
      return this.listMockDailyCreatedCustomers(requesterId, businessDate);
    }

    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          user_id: string | number;
          requester_name: string | null;
          name: string | null;
          category: string | null;
          created_at: Date | string | null;
        }
      >
    >(
      `SELECT c.id,
              c.user_id,
              COALESCE(u.name, CAST(c.user_id AS CHAR)) AS requester_name,
              c.name,
              c.category,
              c.created_at
       FROM customers c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.user_id = ?
         AND DATE(c.created_at) = ?
       ORDER BY c.created_at ASC`,
      [requesterId, businessDate],
    );

    return rows.map((item) => ({
      id: String(item.id),
      requesterId: String(item.user_id),
      requesterName: item.requester_name?.trim() || String(item.user_id),
      customerName: item.name?.trim() || String(item.id),
      category: item.category?.trim() || undefined,
      createdAt: this.normalizeDbDatetime(item.created_at) ?? `${businessDate}T00:00:00.000Z`,
    }));
  }

  async listDailyCreatedOpportunities(
    requesterId: string,
    businessDate: string,
  ): Promise<DailyReportCreatedOpportunitySourceRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      return this.listMockDailyCreatedOpportunities(requesterId, businessDate);
    }

    if (!(await this.ensurePool())) {
      return this.listMockDailyCreatedOpportunities(requesterId, businessDate);
    }

    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          user_id: string | number;
          requester_name: string | null;
          title: string | null;
          customer_name: string | null;
          expect_amount: number | string | null;
          stage: string | null;
          created_at: Date | string | null;
        }
      >
    >(
      `SELECT o.id,
              o.user_id,
              COALESCE(u.name, CAST(o.user_id AS CHAR)) AS requester_name,
              o.title,
              c.name AS customer_name,
              o.expect_amount,
              o.stage,
              o.created_at
       FROM opportunities o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.user_id = ?
         AND DATE(o.created_at) = ?
       ORDER BY o.created_at ASC`,
      [requesterId, businessDate],
    );

    return rows.map((item) => ({
      id: String(item.id),
      requesterId: String(item.user_id),
      requesterName: item.requester_name?.trim() || String(item.user_id),
      title: item.title?.trim() || String(item.id),
      customerName: item.customer_name?.trim() || undefined,
      expectAmount: Number(item.expect_amount ?? 0),
      stage: item.stage?.trim() || undefined,
      createdAt: this.normalizeDbDatetime(item.created_at) ?? `${businessDate}T00:00:00.000Z`,
    }));
  }

  private listMockPendingApprovalContracts(
    scopeSnapshot?: Pick<ScopeSnapshot, 'organizationIds' | 'ownerIds'>,
    page = 1,
    pageSize = 15,
  ): PendingApprovalContractSourceListResult {
    const filteredItems = MOCK_PENDING_APPROVAL_CONTRACT_DETAILS.filter((item) => {
      const isPending =
        Number(item.pendingStep ?? 0) > 0 ||
        (Boolean(item.submitApplyingAt) && !item.finishApproveAt);
      if (!isPending) {
        return false;
      }

      if (
        scopeSnapshot?.organizationIds?.length &&
        !scopeSnapshot.organizationIds.includes(item.organizationId)
      ) {
        return false;
      }

      if (
        scopeSnapshot?.ownerIds?.length &&
        !scopeSnapshot.ownerIds.includes(item.ownerId)
      ) {
        return false;
      }

      return true;
    }).map((item) => ({
      contractId: item.contractId,
      contractCode: item.contractCode,
      contractName: item.contractName,
      customerName: item.customerName,
      ownerId: item.ownerId,
      ownerName: item.ownerName,
      organizationId: item.organizationId,
      departmentId: item.departmentId,
      departmentName: item.departmentName,
      totalAmount: item.totalAmount,
      approveStatus: item.approveStatus,
      pendingStep: item.pendingStep,
      submitApplyingAt: item.submitApplyingAt,
      finishApproveAt: item.finishApproveAt,
    }));
    const offset = (page - 1) * pageSize;

    return {
      items: filteredItems.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: filteredItems.length,
    };
  }

  private getMockPendingApprovalContractDetail(
    contractId: string,
  ): PendingApprovalContractSourceDetailRecord | undefined {
    const matchedRecord = MOCK_PENDING_APPROVAL_CONTRACT_DETAILS.find(
      (item) => item.contractId === contractId,
    );

    if (!matchedRecord) {
      return undefined;
    }

    return {
      ...matchedRecord,
      approvalHistory: matchedRecord.approvalHistory.map((item) => ({ ...item })),
    };
  }

  private mapPendingApprovalContractSummary(row: {
    id: string | number;
    sn: string | null;
    title: string | null;
    customer_name: string | null;
    user_id: string | number;
    owner_name: string | null;
    organization_id: string | number;
    department_id: string | number | null;
    department_name: string | null;
    total_amount: number | string | null;
    approve_status: string | number | null;
    pending_step: number | string | null;
    submit_applying_at: Date | string | null;
    finish_approve_at: Date | string | null;
  }): PendingApprovalContractSourceRecord {
    return {
      contractId: String(row.id),
      contractCode: row.sn?.trim() || undefined,
      contractName: row.title?.trim() || String(row.id),
      customerName: row.customer_name?.trim() || undefined,
      ownerId: String(row.user_id),
      ownerName: row.owner_name?.trim() || String(row.user_id),
      organizationId: String(row.organization_id),
      departmentId:
        row.department_id === null || row.department_id === undefined
          ? undefined
          : String(row.department_id),
      departmentName: row.department_name?.trim() || undefined,
      totalAmount: Number(row.total_amount ?? 0),
      approveStatus: this.normalizePendingApprovalStatus(
        row.approve_status,
        row.pending_step,
      ),
      pendingStep: Number(row.pending_step ?? 0),
      submitApplyingAt: this.normalizeDbDatetime(row.submit_applying_at),
      finishApproveAt: this.normalizeDbDatetime(row.finish_approve_at),
    };
  }

  private mapPendingApprovalContractDetail(
    row: {
      id: string | number;
      sn: string | null;
      title: string | null;
      customer_name: string | null;
      opportunity_title: string | null;
      user_id: string | number;
      owner_name: string | null;
      organization_id: string | number;
      department_id: string | number | null;
      department_name: string | null;
      total_amount: number | string | null;
      approve_status: string | number | null;
      pending_step: number | string | null;
      submit_applying_at: Date | string | null;
      finish_approve_at: Date | string | null;
      start_at: Date | string | null;
      end_at: Date | string | null;
      sign_date: Date | string | null;
      customer_signer: string | null;
      our_signer: string | null;
      special_terms: string | null;
    },
    approvalRows: Array<{
      step: number | string | null;
      status: string | number | null;
      user_id: string | number | null;
      approver_name: string | null;
      approve_at: Date | string | null;
      content: string | null;
    }>,
  ): PendingApprovalContractSourceDetailRecord {
    const summary = this.mapPendingApprovalContractSummary(row);
    const approvalHistory = approvalRows.map((item) =>
      this.mapPendingApprovalApproval(item),
    );
    const approvalComment =
      approvalHistory.find((item) => item.step === 1 && item.comment)?.comment ??
      approvalHistory.find((item) => Boolean(item.comment))?.comment;

    return {
      ...summary,
      opportunityTitle: row.opportunity_title?.trim() || undefined,
      startAt: this.normalizeDbDatetime(row.start_at),
      endAt: this.normalizeDbDatetime(row.end_at),
      signDate: this.normalizeDbDatetime(row.sign_date),
      customerSigner: row.customer_signer?.trim() || undefined,
      ourSigner: row.our_signer?.trim() || undefined,
      specialTerms: row.special_terms?.trim() || undefined,
      approvalComment,
      approvalHistory,
    };
  }

  private mapPendingApprovalApproval(row: {
    step: number | string | null;
    status: string | number | null;
    user_id: string | number | null;
    approver_name: string | null;
    approve_at: Date | string | null;
    content: string | null;
  }): ContractReviewSourceApprovalRecord {
    return {
      step: Number(row.step ?? 0),
      status: this.normalizeApprovalStepStatus(row.status),
      approverId:
        row.user_id === null || row.user_id === undefined
          ? undefined
          : String(row.user_id),
      approverName: row.approver_name?.trim() || undefined,
      approveAt: this.normalizeDbDatetime(row.approve_at),
      comment: row.content?.trim() || undefined,
    };
  }

  /**
   * 待审批合同接口只返回当前审批中的记录，因此数值型状态统一转成稳定文案，避免线上库返回 tinyint 时触发 trim 异常。
   */
  private normalizePendingApprovalStatus(
    value: string | number | null | undefined,
    pendingStep: number | string | null | undefined,
  ): string {
    const normalizedText = this.normalizeScalarText(value);
    if (normalizedText && !this.isNumericText(normalizedText)) {
      return normalizedText;
    }

    if (Number(pendingStep ?? 0) > 0) {
      return '待审批';
    }

    return normalizedText ?? '待审批';
  }

  /**
   * 审批历史状态来自 CRM 分步审批表，线上字段可能是 int，也可能已被上游转成文本，这里统一归一化为可展示字符串。
   */
  private normalizeApprovalStepStatus(
    value: string | number | null | undefined,
  ): string {
    const normalizedText = this.normalizeScalarText(value);
    if (!normalizedText) {
      return 'pending';
    }

    return this.isNumericText(normalizedText)
      ? `状态${normalizedText}`
      : normalizedText;
  }

  /**
   * CRM 查询结果既可能返回字符串，也可能直接返回数值；统一在这里做安全文本归一化，避免对数字调用 trim 抛错。
   */
  private normalizeScalarText(
    value: string | number | null | undefined,
  ): string | undefined {
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      return trimmedValue || undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : undefined;
    }

    return undefined;
  }

  /**
   * 纯数字状态码不能直接当成用户文案返回，需要先识别后再决定降级显示方式。
   */
  private isNumericText(value: string): boolean {
    return /^\d+$/u.test(value);
  }

  private buildPendingApprovalContractWhereClause(
    scopeSnapshot?: Pick<ScopeSnapshot, 'organizationIds' | 'ownerIds'>,
  ): { whereClause: string; values: Array<string | number> } {
    const conditions = [
      '(COALESCE(c.pending_step, 0) > 0 OR (c.submit_applying_at IS NOT NULL AND c.finish_approve_at IS NULL))',
    ];
    const values: Array<string | number> = [];

    if (scopeSnapshot?.organizationIds?.length) {
      conditions.push(
        `c.organization_id IN (${scopeSnapshot.organizationIds.map(() => '?').join(', ')})`,
      );
      values.push(...scopeSnapshot.organizationIds);
    }

    if (scopeSnapshot?.ownerIds?.length) {
      conditions.push(`c.user_id IN (${scopeSnapshot.ownerIds.map(() => '?').join(', ')})`);
      values.push(...scopeSnapshot.ownerIds);
    }

    return {
      whereClause: `WHERE ${conditions.join(' AND ')}`,
      values,
    };
  }

  private async ensurePool(): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return false;
    }

    if (this.poolInitialized && this.liveQueryEnabled) {
      return this.liveQueryEnabled;
    }

    if (this.poolInitializationPromise) {
      return this.poolInitializationPromise;
    }

    const now = Date.now();
    if (
      this.poolInitialized &&
      !this.liveQueryEnabled &&
      now - this.lastConnectionAttemptAt < this.connectionRetryIntervalMs
    ) {
      return false;
    }

    this.poolInitializationPromise = this.initializeReadonlyPool(now).finally(() => {
      this.poolInitializationPromise = undefined;
    });
    return this.poolInitializationPromise;
  }

  /**
   * 串行创建 CRM 只读连接池。
   *
   * @param now 本次连接尝试开始时间，用于记录重试窗口。
   * @returns 连接池是否可用。
   * @throws 不向上抛出连接异常，调用方按 false 进入受控降级。
   */
  private async initializeReadonlyPool(now: number): Promise<boolean> {
    this.poolInitialized = true;
    this.lastConnectionAttemptAt = now;
    const config = this.localRuntimeConfigService.getCrmReadonlyDbConfig();
    if (!config.enabled || !config.host || !config.database || !config.user || !config.password) {
      this.liveQueryEnabled = false;
      return false;
    }

    try {
      if (this.rawPool) {
        await this.rawPool.end();
        this.rawPool = undefined;
        this.pool = undefined;
      }
      this.rawPool = mysql.createPool({
        host: config.host,
        port: config.port ?? 3306,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionLimit: 4,
        waitForConnections: true,
        charset: 'utf8mb4',
        connectTimeout: this.readonlyDbConnectTimeoutMs,
      });
      this.pool = this.createAuditedReadonlyPool(this.rawPool);
      const connection = await this.rawPool.getConnection();
      connection.release();
      this.liveQueryEnabled = true;
      this.lastConnectionFailureReason = undefined;
      this.analysisLoggerService.logStep('CRM 分析数据源已启用真实连接。');
      return true;
    } catch (error) {
      this.liveQueryEnabled = false;
      this.pool = undefined;
      this.rawPool = undefined;
      this.lastConnectionFailureReason =
        error instanceof Error ? error.message : 'unknown';
      this.analysisLoggerService.logWarn('CRM 分析数据源连接失败，运行态已禁止回退样例数据。', {
        reason: this.lastConnectionFailureReason,
        retryIntervalMs: this.connectionRetryIntervalMs,
        connectTimeoutMs: this.readonlyDbConnectTimeoutMs,
      });
      return false;
    }
  }

  private async buildLiveUserContext(userRow: {
    id: string | number;
    name: string;
    organization_id: string | number | null;
    role_id: string | number | null;
    wecom_userid?: string | null;
    role_ids?: string | null;
    role_names?: string | null;
    department_ids?: string | null;
  }): Promise<CrmUser> {
    const aggregatedRoleIds = this.parseDelimitedIdentityValues(userRow.role_ids);
    const aggregatedRoleNames = this.parseDelimitedIdentityValues(userRow.role_names);
    const aggregatedDepartmentIds = this.parseDelimitedIdentityValues(
      userRow.department_ids,
    );
    const hasAggregatedIdentity =
      userRow.role_ids !== undefined || userRow.department_ids !== undefined;
    const { roleIds, roleNames, departmentIds } = hasAggregatedIdentity
      ? {
          roleIds: aggregatedRoleIds,
          roleNames: aggregatedRoleNames,
          departmentIds: aggregatedDepartmentIds,
        }
      : await this.loadLiveUserRoleAndDepartments(userRow);
    const wecomSenderId = userRow.wecom_userid?.trim() || undefined;

    if (wecomSenderId) {
      await this.hydrateWecomIdentityMirrorByRootSenderId(wecomSenderId);
    }

    return {
      id: String(userRow.id),
      name: userRow.name,
      roleIds,
      roleNames,
      organizationIds:
        userRow.organization_id !== null && userRow.organization_id !== undefined
          ? [String(userRow.organization_id)]
          : [],
      departmentIds,
      ownerIds: [],
      isAdmin: roleNames.some((item) => item.includes('管理员')),
      exportAllowed: true,
      channels: ['web-console', 'wecom-bot'],
      wecomSenderId,
      identitySource: 'database',
    };
  }

  /**
   * 旧调用未携带聚合字段时，按原路径补查角色和部门，保持所有调用方兼容。
   *
   * @param userRow 用户基础行。
   * @returns 角色 ID、角色名和部门 ID。
   * @throws 只读库查询失败或超时时向上抛出，由上层统一转成身份链路降级。
   */
  private async loadLiveUserRoleAndDepartments(userRow: {
    id: string | number;
    role_id: string | number | null;
  }): Promise<{
    roleIds: string[];
    roleNames: string[];
    departmentIds: string[];
  }> {
    const [[roleRows], [departmentRows]] = await Promise.all([
      this.runIdentityQuery<
        Array<RowDataPacket & { id: string | number; name: string }>
      >({
        sql:
          userRow.role_id !== null && userRow.role_id !== undefined
            ? `SELECT id, name
                 FROM roles
                 WHERE id = ?`
            : `SELECT DISTINCT r.id, r.name
                 FROM roles r
                 INNER JOIN roles_users ru ON ru.role_id = r.id
                 WHERE ru.user_id = ?`,
        values: [userRow.role_id ?? userRow.id],
        label: 'buildLiveUserContext:roles',
        programName: 'CrmReadonlyService.buildLiveUserContext.roles',
      }),
      this.runIdentityQuery<
        Array<RowDataPacket & { department_id: string | number | null }>
      >({
        sql: `SELECT DISTINCT department_id
             FROM users_departments
             WHERE user_id = ?`,
        values: [userRow.id],
        label: 'buildLiveUserContext:departments',
        programName: 'CrmReadonlyService.buildLiveUserContext.departments',
      }),
    ]);

    return {
      roleIds: roleRows.map((item) => String(item.id)),
      roleNames: roleRows.map((item) => item.name),
      departmentIds: departmentRows
        .map((item) => item.department_id)
        .filter((item): item is string | number => item !== null && item !== undefined)
        .map((item) => String(item)),
    };
  }

  /**
   * 解析身份聚合 SQL 返回的逗号分隔字段。
   *
   * @param value 聚合字段值，可能为空。
   * @returns 去空后的字符串数组。
   * @throws 不抛出异常；空值按空数组处理。
   */
  private parseDelimitedIdentityValues(value: string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  /**
   * 当实时 CRM 身份上下文命中了企业微信 senderId 后，补齐当前负责人递归下级链的原生映射镜像。
   *
   * 设计原因：
   * 1. 组织范围服务当前是同步 API，生产查询链路需要继续直接消费 `appStorage` 中的企业微信映射缓存；
   * 2. CRM 原生 `wx_user_maps` 在生产是实时权威来源，但 `.runtime/app-storage.json` 可能没有把这些映射同步全量落盘；
   * 3. 这里按当前登录用户的企业微信递归下级链做局部镜像补齐，可修复“角色权限已开通但范围退回本人”的同类问题，而不必把整套查询链全面改成异步。
   */
  private async hydrateWecomIdentityMirrorByRootSenderId(
    rootSenderId: string,
  ): Promise<void> {
    const now = Date.now();
    const lastHydratedAt = this.wecomIdentityMirrorHydratedAt.get(rootSenderId);
    if (
      lastHydratedAt !== undefined &&
      now - lastHydratedAt < this.wecomIdentityMirrorHydrationTtlMs
    ) {
      return;
    }

    const subtreeWxUserids = this.collectWecomSubtreeUserids(rootSenderId);
    const [rows] = await this.runIdentityQuery<
      Array<
        RowDataPacket & {
          wx_user_id: string | number;
          wx_organization_id: string | number | null;
          userid: string;
          origin_userid: string | null;
          name: string | null;
          mobile: string | null;
          tel: string | null;
          email: string | null;
          gender: number | null;
          position: string | null;
          avatar: string | null;
          english_name: string | null;
          status: number | null;
          extattr: string | null;
          department: string | null;
          user_id: string | number;
        }
      >
    >({
      sql: `SELECT w.id AS wx_user_id,
                   w.wx_organization_id,
                   w.userid,
                   w.origin_userid,
                   w.name,
                   w.mobile,
                   w.tel,
                   w.email,
                   w.gender,
                   w.position,
                   w.avatar,
                   w.english_name,
                   w.status,
                   w.extattr,
                   w.department,
                   m.user_id
              FROM wx_user_maps m
        INNER JOIN wx_users w ON w.id = m.wx_user_id
             WHERE w.userid IN (?)`,
      values: [subtreeWxUserids],
      label: 'hydrateWecomIdentityMirrorByRootSenderId:mappings',
      programName: 'CrmReadonlyService.hydrateWecomIdentityMirrorByRootSenderId',
    });

    for (const row of rows) {
      const wxUserRecord: CrmWxUserRecord = {
        id: String(row.wx_user_id),
        wxOrganizationId: String(row.wx_organization_id ?? ''),
        userid: row.userid,
        originUserid: row.origin_userid ?? undefined,
        name: row.name ?? undefined,
        mobile: row.mobile ?? undefined,
        tel: row.tel ?? undefined,
        email: row.email ?? undefined,
        gender: row.gender ?? undefined,
        position: row.position ?? undefined,
        avatar: row.avatar ?? undefined,
        englishName: row.english_name ?? undefined,
        status: row.status ?? undefined,
        extattr: this.parseJsonObject(row.extattr),
        departmentIds: this.parseJsonStringArray(row.department),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const wxUserIndex = this.appStorage.state.crmWxUsers.findIndex(
        (item) => item.id === wxUserRecord.id,
      );
      if (wxUserIndex >= 0) {
        this.appStorage.state.crmWxUsers[wxUserIndex] = {
          ...this.appStorage.state.crmWxUsers[wxUserIndex],
          ...wxUserRecord,
        };
      } else {
        this.appStorage.state.crmWxUsers.unshift(wxUserRecord);
      }

      const wxUserMapRecord: CrmWxUserMapRecord = {
        id: `db-map-${String(row.wx_user_id)}-${String(row.user_id)}`,
        wxOrganizationId: String(row.wx_organization_id ?? ''),
        wxUserId: String(row.wx_user_id),
        crmUserId: String(row.user_id),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const wxUserMapIndex = this.appStorage.state.crmWxUserMaps.findIndex(
        (item) => item.wxUserId === wxUserMapRecord.wxUserId,
      );
      if (wxUserMapIndex >= 0) {
        this.appStorage.state.crmWxUserMaps[wxUserMapIndex] = {
          ...this.appStorage.state.crmWxUserMaps[wxUserMapIndex],
          ...wxUserMapRecord,
        };
      } else {
        this.appStorage.state.crmWxUserMaps.unshift(wxUserMapRecord);
      }
    }

    this.wecomIdentityMirrorHydratedAt.set(rootSenderId, now);
  }

  /**
   * 通过企业微信直属上级链收集根负责人及其递归下级，用于按需补齐 CRM 原生映射镜像。
   */
  private collectWecomSubtreeUserids(rootSenderId: string): string[] {
    const activeUsers = this.appStorage.state.wecomSyncedUsers.filter(
      (item) => item.syncStatus === 'ACTIVE',
    );
    const childrenByLeader = new Map<string, string[]>();
    for (const user of activeUsers) {
      for (const leaderUserid of user.directLeaderUserids ?? []) {
        const currentChildren = childrenByLeader.get(leaderUserid) ?? [];
        currentChildren.push(user.wxUserid);
        childrenByLeader.set(leaderUserid, currentChildren);
      }
    }

    const visited = new Set<string>();
    const queue = [rootSenderId];
    while (queue.length > 0) {
      const currentUserid = queue.shift();
      if (!currentUserid || visited.has(currentUserid)) {
        continue;
      }

      visited.add(currentUserid);
      for (const childUserid of childrenByLeader.get(currentUserid) ?? []) {
        if (!visited.has(childUserid)) {
          queue.push(childUserid);
        }
      }
    }

    return [...visited];
  }

  private parseJsonObject(value: string | null): Record<string, unknown> | undefined {
    if (!value?.trim()) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  private parseJsonStringArray(value: string | null): string[] {
    if (!value?.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown[];
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }

  private listMockDailyFollowUpSources(
    requesterId: string,
    businessDate: string,
  ): DailyReportFollowUpSourceRecord[] {
    return this.appStorage.state.pendingFollowUpWritebacks
      .filter(
        (item) =>
          item.requesterId === requesterId &&
          item.status === 'COMPLETED' &&
          this.matchesBusinessDate(item.writtenAt, businessDate),
      )
      .map((item) => ({
        id: item.id,
        requesterId: item.requesterId,
        requesterName: item.requesterName,
        objectType: item.objectType,
        objectId: item.objectId,
        objectTitle: item.objectTitle,
        customerName: item.customerName,
        content: item.draftContent,
        writtenAt: item.writtenAt ?? `${businessDate}T00:00:00.000Z`,
      }));
  }

  private listMockDailyCreatedCustomers(
    requesterId: string,
    businessDate: string,
  ): DailyReportCreatedCustomerSourceRecord[] {
    const requesterName =
      this.listUsers().find((item) => item.id === requesterId)?.name ?? requesterId;

    return CRM_CUSTOMERS.filter(
      (item) =>
        item.ownerId === requesterId &&
        this.matchesBusinessDate(item.createdAt, businessDate),
    ).map((item) => ({
      id: item.id,
      requesterId,
      requesterName,
      customerName: item.name,
      category: item.category,
      createdAt: item.createdAt ?? `${businessDate}T00:00:00.000Z`,
    }));
  }

  private listMockDailyCreatedOpportunities(
    requesterId: string,
    businessDate: string,
  ): DailyReportCreatedOpportunitySourceRecord[] {
    const requesterName =
      this.listUsers().find((item) => item.id === requesterId)?.name ?? requesterId;

    return CRM_OPPORTUNITIES.filter(
      (item) =>
        item.ownerId === requesterId &&
        this.matchesBusinessDate(item.createdAt, businessDate),
    ).map((item) => ({
      id: item.id,
      requesterId,
      requesterName,
      title: item.title,
      expectAmount: item.expectAmount,
      stage: item.stage,
      createdAt: item.createdAt,
    }));
  }

  private matchesBusinessDate(timestamp: string | undefined, businessDate: string): boolean {
    if (!timestamp?.trim()) {
      return false;
    }

    return timestamp.slice(0, 10) === businessDate;
  }

  private normalizeDbDatetime(value: Date | string | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return undefined;
    }

    if (trimmedValue.includes('T')) {
      return trimmedValue;
    }

    return trimmedValue.replace(' ', 'T');
  }

  /**
   * 读取治理选项短缓存。
   *
   * @param kind 选项类型，用于隔离角色、部门、用户和企业微信用户缓存。
   * @param currentUser 当前登录用户，缓存键会包含组织和管理员标识。
   * @returns 未过期的选项副本；测试环境或未命中时返回 undefined。
   * @throws 不抛出异常，缓存层不能影响实时查询主链路。
   */
  private readAccessOptionCache(
    kind: string,
    currentUser: CrmUser,
  ): AccessOptionRecord[] | undefined {
    if (process.env.NODE_ENV === 'test' || this.accessOptionCacheTtlMs <= 0) {
      return undefined;
    }

    const cacheKey = this.buildAccessOptionCacheKey(kind, currentUser);
    const cached = this.accessOptionCache.get(cacheKey);
    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      this.accessOptionCache.delete(cacheKey);
      return undefined;
    }

    return cached.items.map((item) => ({ ...item }));
  }

  /**
   * 写入治理选项短缓存。
   *
   * @param kind 选项类型。
   * @param currentUser 当前登录用户。
   * @param items 需要缓存的选项列表。
   * @returns 无返回值。
   * @throws 不抛出异常；缓存失败不应改变接口业务结果。
   */
  private writeAccessOptionCache(
    kind: string,
    currentUser: CrmUser,
    items: AccessOptionRecord[],
  ): void {
    if (process.env.NODE_ENV === 'test' || this.accessOptionCacheTtlMs <= 0) {
      return;
    }

    const cacheKey = this.buildAccessOptionCacheKey(kind, currentUser);
    this.accessOptionCache.set(cacheKey, {
      items: items.map((item) => ({ ...item })),
      expiresAt: Date.now() + this.accessOptionCacheTtlMs,
    });
  }

  /**
   * 构造治理选项缓存键。
   *
   * @param kind 选项类型。
   * @param currentUser 当前登录用户。
   * @returns 包含用户组织范围、角色和管理员标识的缓存键。
   * @throws 不抛出异常。
   */
  private buildAccessOptionCacheKey(kind: string, currentUser: CrmUser): string {
    return [
      kind,
      currentUser.isAdmin ? 'admin' : 'user',
      currentUser.id,
      [...currentUser.organizationIds].sort().join('|'),
      [...currentUser.roleIds].sort().join('|'),
    ].join('::');
  }

  /**
   * 为只读连接池挂载统一 SQL 审计代理，避免散落的 `pool.query(...)` 绕过审计底座。
   */
  private createAuditedReadonlyPool(rawPool: Pool): Pool {
    return new Proxy(rawPool, {
      get: (target, property, receiver) => {
        if (property === 'query') {
          return async <T>(sql: string, values?: unknown[]) =>
            this.sqlAuditService.execute({
              sql,
              params: values ?? [],
              databaseRole: 'CRM_READONLY',
              moduleKey: 'crm-readonly',
              programName: 'CrmReadonlyService.pool.query',
              execute: () =>
                (values === undefined
                  ? target.query(sql)
                  : target.query(sql, values)) as Promise<T>,
            });
        }

        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as Pool;
  }
}
