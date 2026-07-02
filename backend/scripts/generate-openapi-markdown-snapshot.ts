import { AppStorageService } from '../src/database/app-storage/app-storage.service';
import { OpenApiMarkdownSnapshotService } from '../src/modules/analysis/openapi-markdown-snapshot.service';
import { LianruanCrmOpenApiAdapterService } from '../src/modules/crm-standard-api/lianruan-crm-openapi.adapter.service';
import { LianruanCrmOpenApiClient } from '../src/modules/crm-standard-api/lianruan-crm-openapi.client';
import { LianruanCrmQueryAdapterService } from '../src/modules/crm-standard-api/lianruan-crm-query-adapter.service';
import { LianruanCrmConnectionConfigService } from '../src/modules/governance/lianruan-crm-connection-config.service';
import { LocalRuntimeConfigService } from '../src/shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../src/shared/logging/analysis-logger.service';

/**
 * 手动生成 OpenAPI Markdown 分析快照。
 *
 * 参数说明：无命令行参数，运行时读取 `.env` / `.env.development.local` 中的 OpenAPI 与快照配置。
 * 返回值说明：成功时在控制台输出目录、文件数和记录数。
 * 可能抛出的异常：OpenAPI 未配置、接口不可达或写入目录失败。
 * 调用注意事项：该脚本只读取联软 OpenAPI 并写本地 Markdown，不写回 CRM。
 */
async function main(): Promise<void> {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }

  const snapshotService = createSnapshotService();
  const manifest = await snapshotService.generateSnapshot();
  console.log(
    JSON.stringify(
      {
        generatedAt: manifest.generatedAt,
        outputDir: manifest.outputDir,
        fileCount: manifest.files.length,
        counts: manifest.counts,
        warnings: manifest.warnings,
      },
      null,
      2,
    ),
  );
}

/**
 * 创建 OpenAPI Markdown 快照脚本所需的最小服务集合。
 *
 * 参数说明：无。
 * 返回值说明：返回可直接执行快照生成的服务实例。
 * 可能抛出的异常：本地状态文件读取失败时由依赖服务自行处理并回退默认状态。
 * 调用注意事项：这里不创建完整 Nest 应用，避免企微监听、日报调度和 Web 控制器被脚本误启动。
 */
function createSnapshotService(): OpenApiMarkdownSnapshotService {
  const localRuntimeConfigService = new LocalRuntimeConfigService();
  const appStorageService = new AppStorageService(localRuntimeConfigService);
  const analysisLoggerService = new AnalysisLoggerService();
  const permissionEnforcementService = {
    ensureAction: () => undefined,
  };
  const connectionConfigService = new LianruanCrmConnectionConfigService(
    appStorageService,
    localRuntimeConfigService,
    permissionEnforcementService as never,
  );
  const openApiClient = new LianruanCrmOpenApiClient(
    connectionConfigService,
    analysisLoggerService,
  );
  const openApiAdapter = new LianruanCrmOpenApiAdapterService(openApiClient);
  const queryAdapter = new LianruanCrmQueryAdapterService(openApiAdapter);

  return new OpenApiMarkdownSnapshotService(
    localRuntimeConfigService,
    queryAdapter,
    openApiAdapter,
    analysisLoggerService,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`OpenAPI Markdown 分析快照生成失败：${message}`);
  process.exitCode = 1;
});
