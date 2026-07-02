export class UnsupportedQuestionError extends Error {
  constructor(message = '当前仅支持 CRM 智能分析相关问题，请改为商机、合同、客户等经营分析问题。') {
    super(message);
    this.name = 'UnsupportedQuestionError';
  }
}

export class WriteIntentBlockedError extends Error {
  constructor(message = '当前一期仅支持受控问数，不支持写入型请求。') {
    super(message);
    this.name = 'WriteIntentBlockedError';
  }
}

export class LowConfidenceQuestionError extends Error {
  constructor(message = '当前问题语义不够明确，请补充 CRM 对象、时间范围或分析指标后重试。') {
    super(message);
    this.name = 'LowConfidenceQuestionError';
  }
}

export class SqlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqlValidationError';
  }
}

export class QueryPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueryPreflightError';
  }
}

export class QueryExecutionTimeoutError extends Error {
  constructor(message = '查询执行超过受控超时限制，系统已终止等待结果。') {
    super(message);
    this.name = 'QueryExecutionTimeoutError';
  }
}

export class ResultAccuracyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResultAccuracyError';
  }
}

export class RealDataUnavailableError extends Error {
  constructor(
    message = '当前未连接真实 CRM 分析数据源或真实用户映射不可用，系统已停止返回样例数据，请先完成数据库与身份映射配置。',
  ) {
    super(message);
    this.name = 'RealDataUnavailableError';
  }
}

export class OpenApiCapabilityGapError extends Error {
  constructor(
    message = '当前联软标准 OpenAPI 暂不支持本次分析所需的对象、字段、筛选或聚合能力，请补齐 OpenAPI 能力后再执行。',
  ) {
    super(message);
    this.name = 'OpenApiCapabilityGapError';
  }
}

export class OfficialApiFallbackToSqlError extends Error {
  constructor(
    message = '当前正式分析只启用 OpenAPI Markdown 快照主链，请先刷新本地 Markdown 快照或补齐标准 API 刷新配置。',
  ) {
    super(message);
    this.name = 'OfficialApiFallbackToSqlError';
  }
}

export class OfficialApiAnalyticsUnavailableError extends Error {
  constructor(
    message = '联软标准 OpenAPI 统计接口暂不可用，正式分析请以本地 Markdown 快照明细聚合结果为准。',
  ) {
    super(message);
    this.name = 'OfficialApiAnalyticsUnavailableError';
  }
}
