import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import initSqlJs from 'sql.js';
import { AnalysisWarehouseSqliteSnapshotImporterService } from '../../../src/modules/analysis-warehouse/analysis-warehouse-sqlite-snapshot-importer.service';

describe('AnalysisWarehouseSqliteSnapshotImporterService', () => {
  const originalEnabled = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED;
  const originalDir = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR;
  const originalFile = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE;
  const originalMap = process.env.LIANRUAN_CRM_SQLITE_TABLE_MAP;
  const originalHash = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_SHA256;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'crm-sqlite-snapshot-'));
    process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED = 'true';
    process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR = tempDir;
    delete process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE;
    delete process.env.LIANRUAN_CRM_SQLITE_TABLE_MAP;
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    restoreEnv('LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED', originalEnabled);
    restoreEnv('LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR', originalDir);
    restoreEnv('LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE', originalFile);
    restoreEnv('LIANRUAN_CRM_SQLITE_TABLE_MAP', originalMap);
    restoreEnv('LIANRUAN_CRM_SQLITE_SNAPSHOT_SHA256', originalHash);
  });

  it('应从只读 SQLite 快照读取白名单资源表', async () => {
    const snapshotFile = await createSnapshot(
      tempDir,
      'lianruan-crm-20260611.sqlite',
      'crm_customers',
    );
    process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE = snapshotFile;
    const service = new AnalysisWarehouseSqliteSnapshotImporterService();

    const result = await service.importResource({
      resource: 'customers',
      mode: 'FULL',
      pageSize: 10,
      maxPages: 1,
    });

    expect(result).toMatchObject({
      resource: 'customers',
      tableName: 'crm_customers',
      snapshotFile: 'lianruan-crm-20260611.sqlite',
      latestUpdatedAt: '2026-06-11T08:00:00.000Z',
      total: 2,
    });
    expect(result.snapshotHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.rows).toEqual([
      {
        sourceObjectId: 'C002',
        payload: {
          customer_id: 'C002',
          name: '华东客户',
          phone: '13900000000',
          updated_at: '2026-06-10T08:00:00.000Z',
        },
      },
      {
        sourceObjectId: 'C001',
        payload: {
          customer_id: 'C001',
          name: '山东客户',
          phone: '13800000000',
          updated_at: '2026-06-11T08:00:00.000Z',
        },
      },
    ]);
  });

  it('增量模式应使用更新时间游标读取快照行', async () => {
    await createSnapshot(tempDir, 'lianruan-crm-20260611.sqlite', 'customers');
    const service = new AnalysisWarehouseSqliteSnapshotImporterService();

    const result = await service.importResource({
      resource: 'customers',
      mode: 'INCREMENTAL',
      pageSize: 10,
      maxPages: 1,
      checkpointCursor: '2026-06-10T12:00:00.000Z',
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sourceObjectId).toBe('C001');
    expect(result.total).toBe(1);
  });

  it('应拒绝读取快照目录之外的 SQLite 文件', async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'crm-sqlite-outside-'));
    const outsideFile = await createSnapshot(
      outsideDir,
      'production-copy.sqlite',
      'customers',
    );
    process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE = outsideFile;
    const service = new AnalysisWarehouseSqliteSnapshotImporterService();

    try {
      await expect(
        service.importResource({
          resource: 'customers',
          mode: 'FULL',
          pageSize: 10,
          maxPages: 1,
        }),
      ).rejects.toThrow('SQLite 快照文件必须位于配置的只读快照目录内');
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('应支持联软 entities 通用实体表并校验 manifest 与记录数', async () => {
    const snapshotFile = await createEntitySnapshot(
      tempDir,
      'crm_openapi_aiagent_sanitized_20260612075556.db',
    );
    const snapshotHash = createHash('sha256')
      .update(readFileSync(snapshotFile))
      .digest('hex');
    writeFileSync(
      join(tempDir, 'snapshot-manifest.json'),
      JSON.stringify({
        snapshotDb: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        sha256: snapshotHash,
      }),
    );
    writeFileSync(
      join(tempDir, 'record-counts.json'),
      JSON.stringify({
        snapshotCounts: [{ entity_name: 'orders', count: 2 }],
      }),
    );
    process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE =
      'crm_openapi_aiagent_sanitized_20260612075556.db';
    const service = new AnalysisWarehouseSqliteSnapshotImporterService();

    const result = await service.importResource({
      resource: 'orders',
      mode: 'FULL',
      pageSize: 10,
      maxPages: 1,
    });

    expect(result).toMatchObject({
      resource: 'orders',
      tableName: 'entities',
      total: 2,
      latestUpdatedAt: '2026-06-12T07:55:00.000Z',
    });
    expect(result.rows).toEqual([
      {
        sourceObjectId: 'O001',
        payload: {
          id: 'O001',
          total: 8250,
          status: 'primary_confirmed',
          updatedAt: '2026-06-11T08:00:00.000Z',
        },
      },
      {
        sourceObjectId: 'O002',
        payload: {
          id: 'O002',
          total: 23100,
          status: 'pending',
          updatedAt: '2026-06-12T07:55:00.000Z',
        },
      },
    ]);
  });

  it('manifest hash 与快照不一致时应阻断导入', async () => {
    await createEntitySnapshot(tempDir, 'crm_openapi_aiagent_sanitized_latest.db');
    writeFileSync(
      join(tempDir, 'snapshot-manifest.json'),
      JSON.stringify({
        latestDb: 'crm_openapi_aiagent_sanitized_latest.db',
        latestSha256: '0'.repeat(64),
      }),
    );
    process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE =
      'crm_openapi_aiagent_sanitized_latest.db';
    const service = new AnalysisWarehouseSqliteSnapshotImporterService();

    await expect(
      service.importResource({
        resource: 'orders',
        mode: 'FULL',
        pageSize: 10,
        maxPages: 1,
      }),
    ).rejects.toThrow('SQLite 快照 SHA256 校验失败');
  });
});

/**
 * 恢复测试修改过的环境变量。
 *
 * 参数说明：`key` 为环境变量名，`value` 为测试前原值。
 * 返回值说明：无返回值。
 * 调用注意事项：避免 SQLite 快照开关泄漏到其它测试用例。
 */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

/**
 * 创建测试用 SQLite 快照文件。
 *
 * 参数说明：目录、文件名和客户表名。
 * 返回值说明：返回生成文件的绝对路径。
 * 调用注意事项：测试库只包含最小客户表，覆盖快照读取、主键识别和增量游标。
 */
async function createSnapshot(
  directory: string,
  fileName: string,
  tableName: string,
): Promise<string> {
  const sqlJs = await initSqlJs();
  const database = new sqlJs.Database();
  database.run(
    `CREATE TABLE "${tableName}" (
      customer_id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      updated_at TEXT
    )`,
  );
  database.run(
    `INSERT INTO "${tableName}" (customer_id, name, phone, updated_at)
     VALUES (?, ?, ?, ?)`,
    ['C001', '山东客户', '13800000000', '2026-06-11T08:00:00.000Z'],
  );
  database.run(
    `INSERT INTO "${tableName}" (customer_id, name, phone, updated_at)
     VALUES (?, ?, ?, ?)`,
    ['C002', '华东客户', '13900000000', '2026-06-10T08:00:00.000Z'],
  );
  const filePath = join(directory, fileName);
  writeFileSync(filePath, Buffer.from(database.export()));
  database.close();
  return filePath;
}

/**
 * 创建联软通用实体表模型测试快照。
 *
 * 参数说明：目录和文件名。
 * 返回值说明：返回生成文件的绝对路径。
 * 调用注意事项：该模型覆盖联软交付快照中的 `entities(entity_name,id,data_json,updated_at)` 结构。
 */
async function createEntitySnapshot(
  directory: string,
  fileName: string,
): Promise<string> {
  const sqlJs = await initSqlJs();
  const database = new sqlJs.Database();
  database.run(
    `CREATE TABLE entities (
      entity_name TEXT NOT NULL,
      id TEXT NOT NULL,
      data_json TEXT NOT NULL,
      updated_at TEXT,
      PRIMARY KEY (entity_name, id)
    )`,
  );
  database.run(
    `INSERT INTO entities (entity_name, id, data_json, updated_at)
     VALUES (?, ?, ?, ?)`,
    [
      'orders',
      'O001',
      JSON.stringify({
        id: 'O001',
        total: 8250,
        status: 'primary_confirmed',
        updatedAt: '2026-06-11T08:00:00.000Z',
      }),
      '2026-06-11T08:00:00.000Z',
    ],
  );
  database.run(
    `INSERT INTO entities (entity_name, id, data_json, updated_at)
     VALUES (?, ?, ?, ?)`,
    [
      'orders',
      'O002',
      JSON.stringify({
        id: 'O002',
        total: 23100,
        status: 'pending',
      }),
      '2026-06-12T07:55:00.000Z',
    ],
  );
  const filePath = join(directory, fileName);
  writeFileSync(filePath, Buffer.from(database.export()));
  database.close();
  return filePath;
}
