import { Inject, Injectable } from '@nestjs/common';
import mysql, {
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { SqlAuditContextService } from '../audit/sql-audit-context.service';
import { SqlAuditService } from '../audit/sql-audit.service';

const noopSqlAuditService = {
  async execute<T>(options: { execute: () => Promise<T> }): Promise<T> {
    return options.execute();
  },
} as SqlAuditService;

const noopSqlAuditContextService = {
  run<T>(_context: unknown, handler: () => Promise<T>): Promise<T> {
    return handler();
  },
} as SqlAuditContextService;

@Injectable()
export class CrmPhoneConfirmationRepairService {
  private pool?: Pool;
  private poolInitialized = false;

  constructor(
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    @Inject(AnalysisLoggerService)
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly sqlAuditService: SqlAuditService = noopSqlAuditService,
    private readonly sqlAuditContextService: SqlAuditContextService = noopSqlAuditContextService,
  ) {}

  async repairIfMissing(login: string): Promise<boolean> {
    const normalizedLogin = login.trim();
    if (!normalizedLogin) {
      return false;
    }

    return this.sqlAuditContextService.run(
      {
        actorId: 'system:auth-phone-repair',
        actorRoleIds: [],
        requestId: `auth-phone-repair:${normalizedLogin}`,
        moduleKey: 'auth-phone-repair',
        programName: 'CrmPhoneConfirmationRepairService.repairIfMissing',
      },
      async () => {
        if (!(await this.ensurePool())) {
          return false;
        }

        try {
          const [rows] = await this.pool!.query<
            Array<
              RowDataPacket & {
                id: string | number;
                confirmed_phone_at: string | Date | null;
              }
            >
          >(
            `SELECT id, confirmed_phone_at
             FROM users
             WHERE deleted_at IS NULL
               AND (phone = ? OR email = ? OR name_pinyin = ?)
             ORDER BY id DESC
             LIMIT 2`,
            [normalizedLogin, normalizedLogin, normalizedLogin],
          );

          if (rows.length !== 1) {
            if (rows.length > 1) {
              this.analysisLoggerService.logWarn(
                '自动补齐手机确认时间时命中多个 CRM 用户，已跳过本次修复。',
                {
                  login: normalizedLogin,
                  candidateCount: rows.length,
                },
              );
            }
            return false;
          }

          if (rows[0].confirmed_phone_at) {
            return false;
          }

          const [updateResult] = await this.pool!.query<ResultSetHeader>(
            `UPDATE users
             SET confirmed_phone_at = NOW(),
                 updated_at = NOW()
             WHERE id = ?
               AND confirmed_phone_at IS NULL`,
            [rows[0].id],
          );

          if (updateResult.affectedRows > 0) {
            this.analysisLoggerService.logStep('已自动补齐 CRM 手机确认时间。', {
              login: normalizedLogin,
              userId: String(rows[0].id),
            });
            return true;
          }

          return false;
        } catch (error) {
          this.analysisLoggerService.logWarn('自动补齐 CRM 手机确认时间失败。', {
            login: normalizedLogin,
            reason: error instanceof Error ? error.message : 'unknown',
          });
          return false;
        }
      },
    );
  }

  private async ensurePool(): Promise<boolean> {
    if (this.poolInitialized && this.pool) {
      return true;
    }

    this.poolInitialized = true;
    const config = this.localRuntimeConfigService.getCrmWritebackDbConfig();
    if (
      !config.enabled ||
      !config.host ||
      !config.database ||
      !config.user ||
      !config.password
    ) {
      return false;
    }

    const rawPool = mysql.createPool({
      host: config.host,
      port: config.port ?? 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      connectionLimit: 2,
      waitForConnections: true,
      charset: 'utf8mb4',
      connectTimeout: Number(
        process.env.CRM_READONLY_DB_CONNECT_TIMEOUT_MS ?? '60000',
      ),
    });
    this.pool = this.createAuditedWritePool(rawPool);

    return true;
  }

  /**
   * 为登录兜底修复写库连接池挂载 SQL 审计代理，确保用户表读写不会绕过治理留痕。
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
              moduleKey: 'auth-phone-repair',
              programName: 'CrmPhoneConfirmationRepairService.pool.query',
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
