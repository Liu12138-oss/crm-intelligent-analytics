import { Module } from '@nestjs/common';
import { AppStorageService } from './app-storage/app-storage.service';
import { CrmReadonlyService } from './crm-readonly/crm-readonly.service';
import { AnalysisWarehouseMysqlService } from './analysis-warehouse/analysis-warehouse-mysql.service';
import { LocalRuntimeConfigService } from '../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../shared/logging/analysis-logger.service';
import { SqlAuditRepository } from '../modules/audit/sql-audit.repository';
import { SqlAuditService } from '../modules/audit/sql-audit.service';
import { SqlAuditContextService } from '../modules/audit/sql-audit-context.service';
import { SqlAuditFileStore } from '../modules/audit/sql-audit-file.store';

@Module({
  providers: [
    LocalRuntimeConfigService,
    AnalysisLoggerService,
    AppStorageService,
    SqlAuditContextService,
    SqlAuditFileStore,
    SqlAuditRepository,
    SqlAuditService,
    CrmReadonlyService,
    AnalysisWarehouseMysqlService,
  ],
  exports: [
    LocalRuntimeConfigService,
    AnalysisLoggerService,
    AppStorageService,
    SqlAuditContextService,
    SqlAuditFileStore,
    SqlAuditRepository,
    SqlAuditService,
    CrmReadonlyService,
    AnalysisWarehouseMysqlService,
  ],
})
export class DatabaseModule {}
