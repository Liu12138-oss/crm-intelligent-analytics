import { Inject, Injectable } from '@nestjs/common';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { SqlAuditService } from '../audit/sql-audit.service';
import type {
  CrmWxUserMapRecord,
  CrmWxUserRecord,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import type { WecomOfficialUserListItem } from './wecom-official-directory.types';

export type CrmWecomBindingResult =
  | {
      status: 'MISSING_CONTACT';
      reason: 'mobile-email-missing';
    }
  | {
      status: 'UNMATCHED';
      reason: 'phone-not-found' | 'email-not-found';
    }
  | {
      status: 'CONFLICT';
      reason:
        | 'phone-multi-match'
        | 'email-multi-match'
        | 'wx-user-map-conflict'
        | 'crm-user-map-conflict';
      crmUserIds?: string[];
      existingCrmUserId?: string;
      existingWxUserId?: string;
    }
  | {
      status: 'CREATED' | 'UPDATED' | 'UNCHANGED';
      matchedBy: 'mobile' | 'email' | 'manual';
      crmUserId: string;
    };

@Injectable()
export class CrmWecomIdentityRepository {
  private pool?: Pool;
  private poolInitialized = false;

  constructor(
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    @Inject(AnalysisLoggerService)
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly sqlAuditService: SqlAuditService,
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
    @Inject(CrmReadonlyService)
    private readonly crmReadonlyService: CrmReadonlyService,
  ) {}

  async resolveOrCreateWxOrganizationId(): Promise<string> {
    if (process.env.NODE_ENV === 'test') {
      return 'wx_org_mock';
    }

    await this.ensurePool();
    const directoryConfig = this.localRuntimeConfigService.getWecomDirectorySyncConfig();
    const corpId = directoryConfig.corpId;
    if (!corpId) {
      throw new Error('企业微信目录同步缺少 corpId，无法写入 CRM 原生映射表。');
    }

    const [existingRows] = await this.pool!.query<
      Array<RowDataPacket & { id: string | number }>
    >(
      `SELECT id
       FROM wx_organizations
       WHERE corp_id = ?
       LIMIT 1`,
      [corpId],
    );
    if (existingRows[0]?.id !== undefined) {
      return String(existingRows[0].id);
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [insertResult] = await this.pool!.query<ResultSetHeader>(
      `INSERT INTO wx_organizations (
         corp_name,
         corp_full_name,
         corp_id,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        directoryConfig.rootDepartmentName,
        directoryConfig.rootDepartmentName,
        corpId,
        now,
        now,
      ],
    );
    return String(insertResult.insertId);
  }

  async upsertWxUser(params: {
    wxOrganizationId: string;
    user: WecomOfficialUserListItem;
  }): Promise<{ wxUserId: string; action: 'CREATED' | 'UPDATED' }> {
    if (process.env.NODE_ENV === 'test') {
      const current = this.appStorage.state.crmWxUsers.find(
        (item) =>
          item.wxOrganizationId === params.wxOrganizationId &&
          item.userid === params.user.userid,
      );
      const now = new Date().toISOString();
      const nextRecord: CrmWxUserRecord = {
        id: current?.id ?? buildEntityId('crm_wx_user'),
        wxOrganizationId: params.wxOrganizationId,
        userid: params.user.userid,
        originUserid: params.user.userid,
        name: params.user.name,
        mobile: params.user.mobile,
        tel: params.user.telephone,
        email: params.user.email,
        gender:
          params.user.gender !== undefined
            ? Number(params.user.gender)
            : undefined,
        position: params.user.position,
        avatar: params.user.avatar,
        englishName: params.user.english_name,
        status:
          params.user.status !== undefined
            ? Number(params.user.status)
            : undefined,
        extattr:
          params.user.extattr as Record<string, unknown> | undefined,
        departmentIds: (params.user.department ?? []).map((item) => String(item)),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };

      const index = this.appStorage.state.crmWxUsers.findIndex(
        (item) => item.id === nextRecord.id,
      );
      if (index >= 0) {
        this.appStorage.state.crmWxUsers[index] = nextRecord;
        return { wxUserId: nextRecord.id, action: 'UPDATED' };
      }

      this.appStorage.state.crmWxUsers.unshift(nextRecord);
      return { wxUserId: nextRecord.id, action: 'CREATED' };
    }

    await this.ensurePool();
    const [existingRows] = await this.pool!.query<
      Array<RowDataPacket & { id: string | number }>
    >(
      `SELECT id
       FROM wx_users
       WHERE wx_organization_id = ?
         AND userid = ?
       LIMIT 1`,
      [params.wxOrganizationId, params.user.userid],
    );

    const extattrText =
      params.user.extattr !== undefined
        ? this.safeJsonStringify(params.user.extattr)
        : null;
    const departmentText = this.safeJsonStringify(params.user.department ?? []);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sanitizedName = this.sanitizeMysqlString(params.user.name);
    const sanitizedMobile = this.sanitizeMysqlString(params.user.mobile);
    const sanitizedTelephone = this.sanitizeMysqlString(params.user.telephone);
    const sanitizedEmail = this.sanitizeMysqlString(params.user.email);
    const sanitizedPosition = this.sanitizeMysqlString(params.user.position);
    const sanitizedAvatar = this.sanitizeMysqlString(params.user.avatar);
    const sanitizedEnglishName = this.sanitizeMysqlString(
      params.user.english_name,
    );
    const sanitizedUserid = this.sanitizeMysqlString(params.user.userid);

    if (existingRows[0]?.id !== undefined) {
      await this.pool!.query(
        `UPDATE wx_users
         SET origin_userid = ?,
             name = ?,
             mobile = ?,
             tel = ?,
             email = ?,
             gender = ?,
             position = ?,
             avatar = ?,
             english_name = ?,
             status = ?,
             extattr = ?,
             department = ?,
             updated_at = ?,
             deleted_at = NULL
         WHERE id = ?`,
        [
          sanitizedUserid,
          sanitizedName,
          sanitizedMobile,
          sanitizedTelephone,
          sanitizedEmail,
          params.user.gender !== undefined ? Number(params.user.gender) : null,
          sanitizedPosition,
          sanitizedAvatar,
          sanitizedEnglishName,
          params.user.status !== undefined ? Number(params.user.status) : null,
          extattrText,
          departmentText,
          now,
          existingRows[0].id,
        ],
      );
      return { wxUserId: String(existingRows[0].id), action: 'UPDATED' };
    }

    const [insertResult] = await this.pool!.query<ResultSetHeader>(
      `INSERT INTO wx_users (
         wx_organization_id,
         userid,
         origin_userid,
         name,
         mobile,
         tel,
         email,
         gender,
         position,
         avatar,
         english_name,
         status,
         extattr,
         department,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.wxOrganizationId,
        sanitizedUserid,
        sanitizedUserid,
        sanitizedName,
        sanitizedMobile,
        sanitizedTelephone,
        sanitizedEmail,
        params.user.gender !== undefined ? Number(params.user.gender) : null,
        sanitizedPosition,
        sanitizedAvatar,
        sanitizedEnglishName,
        params.user.status !== undefined ? Number(params.user.status) : 1,
        extattrText,
        departmentText,
        now,
        now,
      ],
    );

    return { wxUserId: String(insertResult.insertId), action: 'CREATED' };
  }

  async syncWxUserMap(params: {
    wxOrganizationId: string;
    wxUserId: string;
    mobile?: string;
    email?: string;
  }): Promise<CrmWecomBindingResult> {
    const phoneMatches = params.mobile
      ? await this.crmReadonlyService.listUsersByPhoneOrEmail(params.mobile)
      : [];
    if (phoneMatches.length === 1) {
      return this.upsertWxUserMap({
        wxOrganizationId: params.wxOrganizationId,
        wxUserId: params.wxUserId,
        crmUserId: phoneMatches[0].id,
        matchedBy: 'mobile',
      });
    }
    if (phoneMatches.length > 1) {
      return {
        status: 'CONFLICT',
        reason: 'phone-multi-match',
        crmUserIds: phoneMatches.map((item) => item.id),
      };
    }

    const emailMatches = params.email
      ? await this.crmReadonlyService.listUsersByPhoneOrEmail(params.email)
      : [];
    if (emailMatches.length === 1) {
      return this.upsertWxUserMap({
        wxOrganizationId: params.wxOrganizationId,
        wxUserId: params.wxUserId,
        crmUserId: emailMatches[0].id,
        matchedBy: 'email',
      });
    }
    if (emailMatches.length > 1) {
      return {
        status: 'CONFLICT',
        reason: 'email-multi-match',
        crmUserIds: emailMatches.map((item) => item.id),
      };
    }

    if (!params.mobile && !params.email) {
      return {
        status: 'MISSING_CONTACT',
        reason: 'mobile-email-missing',
      };
    }

    return {
      status: 'UNMATCHED',
      reason: params.mobile ? 'phone-not-found' : 'email-not-found',
    };
  }

  async bindWecomWebLoginUser(params: {
    wecomUserId: string;
    wecomUserName?: string;
    mobile?: string;
    email?: string;
    crmUserId: string;
  }): Promise<CrmWecomBindingResult> {
    const wxOrganizationId = await this.resolveOrCreateWxOrganizationId();
    const wxUser = await this.upsertWxUser({
      wxOrganizationId,
      user: {
        userid: params.wecomUserId,
        name: params.wecomUserName ?? params.wecomUserId,
        department: [],
        mobile: params.mobile,
        email: params.email,
      },
    });

    return this.upsertWxUserMap({
      wxOrganizationId,
      wxUserId: wxUser.wxUserId,
      crmUserId: params.crmUserId,
      matchedBy: 'manual',
    });
  }

  async getBindingDiagnosticByUserid(userid: string): Promise<Record<string, unknown>> {
    const wxUser = await this.findWxUserByUserid(userid);
    if (!wxUser) {
      return {
        userid,
        status: 'NOT_SYNCED',
        reason: '当前 userid 尚未同步到 CRM.wx_users。',
      };
    }

    const wxUserMap = await this.findWxUserMapByWxUserId(wxUser.id);
    if (wxUserMap) {
      return {
        userid,
        status: 'BOUND',
        wxUserId: wxUser.id,
        crmUserId: wxUserMap.crmUserId,
      };
    }

    const phoneMatches = wxUser.mobile
      ? await this.crmReadonlyService.listUsersByPhoneOrEmail(wxUser.mobile)
      : [];
    const emailMatches = wxUser.email
      ? await this.crmReadonlyService.listUsersByPhoneOrEmail(wxUser.email)
      : [];

    if (!wxUser.mobile && !wxUser.email) {
      return {
        userid,
        status: 'UNBOUND',
        reason: '企业微信成员已同步到 CRM.wx_users，但缺少手机号和邮箱，无法自动生成 wx_user_maps。',
        wxUserId: wxUser.id,
      };
    }

    if (phoneMatches.length > 1) {
      return {
        userid,
        status: 'UNBOUND',
        reason: '企业微信成员手机号匹配到多个 CRM 用户，未自动绑定。',
        wxUserId: wxUser.id,
        phoneCandidateUserIds: phoneMatches.map((item) => item.id),
      };
    }

    if (emailMatches.length > 1) {
      return {
        userid,
        status: 'UNBOUND',
        reason: '企业微信成员邮箱匹配到多个 CRM 用户，未自动绑定。',
        wxUserId: wxUser.id,
        emailCandidateUserIds: emailMatches.map((item) => item.id),
      };
    }

    if (phoneMatches.length === 0 && emailMatches.length === 0) {
      return {
        userid,
        status: 'UNBOUND',
        reason: '企业微信成员已同步到 CRM.wx_users，但手机号和邮箱均未匹配到 CRM 用户。',
        wxUserId: wxUser.id,
      };
    }

    return {
      userid,
      status: 'UNBOUND',
      reason: '企业微信成员存在唯一匹配候选，但当前尚未生成 CRM.wx_user_maps，请重新执行同步或检查写入失败。',
      wxUserId: wxUser.id,
      phoneCandidateUserIds: phoneMatches.map((item) => item.id),
      emailCandidateUserIds: emailMatches.map((item) => item.id),
    };
  }

  async listCrmWxUsers(): Promise<CrmWxUserRecord[]> {
    if (process.env.NODE_ENV === 'test') {
      return [...this.appStorage.state.crmWxUsers];
    }

    await this.ensurePool();
    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          wx_organization_id: string | number;
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
          created_at: Date | string | null;
          updated_at: Date | string | null;
        }
      >
    >('SELECT * FROM wx_users');
    return rows.map((item) => this.mapDbWxUser(item));
  }

  private async upsertWxUserMap(params: {
    wxOrganizationId: string;
    wxUserId: string;
    crmUserId: string;
    matchedBy: 'mobile' | 'email' | 'manual';
  }): Promise<CrmWecomBindingResult> {
    if (process.env.NODE_ENV === 'test') {
      const existingByWxUser = this.appStorage.state.crmWxUserMaps.find(
        (item) => item.wxUserId === params.wxUserId,
      );
      if (existingByWxUser && existingByWxUser.crmUserId !== params.crmUserId) {
        return {
          status: 'CONFLICT',
          reason: 'wx-user-map-conflict',
          existingCrmUserId: existingByWxUser.crmUserId,
        };
      }

      const existingByCrmUser = this.appStorage.state.crmWxUserMaps.find(
        (item) => item.crmUserId === params.crmUserId && item.wxUserId !== params.wxUserId,
      );
      if (existingByCrmUser) {
        return {
          status: 'CONFLICT',
          reason: 'crm-user-map-conflict',
          existingWxUserId: existingByCrmUser.wxUserId,
        };
      }

      const now = new Date().toISOString();
      if (existingByWxUser) {
        existingByWxUser.updatedAt = now;
        return {
          status: 'UNCHANGED',
          matchedBy: params.matchedBy,
          crmUserId: params.crmUserId,
        };
      }

      this.appStorage.state.crmWxUserMaps.unshift({
        id: buildEntityId('crm_wx_map'),
        wxOrganizationId: params.wxOrganizationId,
        wxUserId: params.wxUserId,
        crmUserId: params.crmUserId,
        createdAt: now,
        updatedAt: now,
      });
      return {
        status: 'CREATED',
        matchedBy: params.matchedBy,
        crmUserId: params.crmUserId,
      };
    }

    await this.ensurePool();
    const [existingWxUserRows] = await this.pool!.query<
      Array<RowDataPacket & { id: string | number; user_id: string | number }>
    >(
      `SELECT id, user_id
       FROM wx_user_maps
       WHERE wx_user_id = ?
       LIMIT 1`,
      [params.wxUserId],
    );
    if (existingWxUserRows[0]?.id !== undefined) {
      if (String(existingWxUserRows[0].user_id) !== params.crmUserId) {
        return {
          status: 'CONFLICT',
          reason: 'wx-user-map-conflict',
          existingCrmUserId: String(existingWxUserRows[0].user_id),
        };
      }

      await this.pool!.query(
        `UPDATE wx_user_maps
         SET wx_organization_id = ?
         WHERE id = ?`,
        [params.wxOrganizationId, existingWxUserRows[0].id],
      );
      return {
        status: 'UNCHANGED',
        matchedBy: params.matchedBy,
        crmUserId: params.crmUserId,
      };
    }

    const [existingCrmUserRows] = await this.pool!.query<
      Array<RowDataPacket & { id: string | number; wx_user_id: string | number }>
    >(
      `SELECT id, wx_user_id
       FROM wx_user_maps
       WHERE user_id = ?
       LIMIT 1`,
      [params.crmUserId],
    );
    if (
      existingCrmUserRows[0]?.id !== undefined &&
      String(existingCrmUserRows[0].wx_user_id) !== params.wxUserId
    ) {
      return {
        status: 'CONFLICT',
        reason: 'crm-user-map-conflict',
        existingWxUserId: String(existingCrmUserRows[0].wx_user_id),
      };
    }

    await this.pool!.query(
      `INSERT INTO wx_user_maps (
         wx_user_id,
         user_id,
         wx_organization_id
       ) VALUES (?, ?, ?)`,
      [params.wxUserId, params.crmUserId, params.wxOrganizationId],
    );
    return {
      status: 'CREATED',
      matchedBy: params.matchedBy,
      crmUserId: params.crmUserId,
    };
  }

  private async findWxUserByUserid(userid: string): Promise<CrmWxUserRecord | undefined> {
    if (process.env.NODE_ENV === 'test') {
      return this.appStorage.state.crmWxUsers.find((item) => item.userid === userid);
    }

    await this.ensurePool();
    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          wx_organization_id: string | number;
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
          created_at: Date | string | null;
          updated_at: Date | string | null;
        }
      >
    >(
      `SELECT *
       FROM wx_users
       WHERE userid = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userid],
    );
    if (!rows[0]) {
      return undefined;
    }
    return this.mapDbWxUser(rows[0]);
  }

  private async findWxUserMapByWxUserId(
    wxUserId: string,
  ): Promise<CrmWxUserMapRecord | undefined> {
    if (process.env.NODE_ENV === 'test') {
      return this.appStorage.state.crmWxUserMaps.find(
        (item) => item.wxUserId === wxUserId,
      );
    }

    await this.ensurePool();
    const [rows] = await this.pool!.query<
      Array<
        RowDataPacket & {
          id: string | number;
          wx_organization_id: string | number | null;
          wx_user_id: string | number;
          user_id: string | number;
        }
      >
    >(
      `SELECT id, wx_organization_id, wx_user_id, user_id
       FROM wx_user_maps
       WHERE wx_user_id = ?
       LIMIT 1`,
      [wxUserId],
    );
    if (!rows[0]) {
      return undefined;
    }
    return {
      id: String(rows[0].id),
      wxOrganizationId: String(rows[0].wx_organization_id ?? ''),
      wxUserId: String(rows[0].wx_user_id),
      crmUserId: String(rows[0].user_id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async ensurePool(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    if (this.poolInitialized && this.pool) {
      return;
    }

    const config = this.localRuntimeConfigService.getCrmWritebackDbConfig();
    if (!config.enabled || !config.host || !config.database || !config.user || !config.password) {
      throw new Error('CRM 数据源配置不完整，无法写入企业微信原生映射表。');
    }

    const rawPool = mysql.createPool({
      host: config.host,
      port: config.port ?? 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      connectionLimit: 4,
      waitForConnections: true,
      charset: 'utf8mb4',
      connectTimeout: Number(process.env.CRM_READONLY_DB_CONNECT_TIMEOUT_MS ?? '60000'),
    });
    this.pool = this.createAuditedWritePool(rawPool);
    this.poolInitialized = true;
    this.analysisLoggerService.logStep('CRM 企业微信原生映射写入仓库已启用真实连接。');
  }

  private mapDbWxUser(row: {
    id: string | number;
    wx_organization_id: string | number;
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
    created_at: Date | string | null;
    updated_at: Date | string | null;
  }): CrmWxUserRecord {
    return {
      id: String(row.id),
      wxOrganizationId: String(row.wx_organization_id),
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
      createdAt: this.normalizeDbDatetime(row.created_at),
      updatedAt: this.normalizeDbDatetime(row.updated_at),
    };
  }

  private parseJsonObject(value: string | null): Record<string, unknown> | undefined {
    if (!value) {
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
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown[];
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }

  private normalizeDbDatetime(value: Date | string | null): string {
    if (!value) {
      return new Date().toISOString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(value).toISOString();
  }

  private safeJsonStringify(value: unknown): string {
    return JSON.stringify(this.sanitizeJsonValue(value));
  }

  private sanitizeJsonValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.sanitizeMysqlString(value) ?? '';
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeJsonValue(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, childValue]) => [
          key,
          this.sanitizeJsonValue(childValue),
        ]),
      );
    }
    return value;
  }

  private sanitizeMysqlString(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    // CRM 现有 wx_* 表字符集并不保证支持 4 字节字符，先剔除 emoji 等字符，避免整批同步被单条数据阻塞。
    const sanitized = value
      // 这里需要显式移除历史数据中的 NUL 控制字符，否则 MySQL 写入会整批失败。
      // eslint-disable-next-line no-control-regex
      .replace(/\u0000/g, '')
      .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
      .trim();

    return sanitized || null;
  }

  /**
   * 为企微目录同步写库连接池挂载 SQL 审计代理，确保 `wx_*` 读写不会绕过统一审计。
   */
  private createAuditedWritePool(rawPool: Pool): Pool {
    return new Proxy(rawPool, {
      get: (target, property, receiver) => {
        if (property === 'query') {
          return async <T>(sql: string, values?: unknown[]) =>
            this.sqlAuditService.execute({
              sql,
              params: values ?? [],
              databaseRole: 'CRM_WRITEBACK',
              moduleKey: 'wecom-directory-sync',
              programName: 'CrmWecomIdentityRepository.pool.query',
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
