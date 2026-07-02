import { Injectable } from '@nestjs/common';
import {
  LowConfidenceQuestionError,
  OpenApiCapabilityGapError,
  QueryPreflightError,
  QueryExecutionTimeoutError,
  RealDataUnavailableError,
  ResultAccuracyError,
  SqlValidationError,
  UnsupportedQuestionError,
  WriteIntentBlockedError,
} from './analysis.errors';

@Injectable()
export class AnalysisResponseMapper {
  mapBlockedReason(error: unknown): string {
    if (error instanceof UnsupportedQuestionError) {
      return error.message;
    }

    if (error instanceof WriteIntentBlockedError) {
      return error.message;
    }

    if (error instanceof LowConfidenceQuestionError) {
      return error.message;
    }

    if (error instanceof OpenApiCapabilityGapError) {
      return error.message;
    }

    if (error instanceof SqlValidationError) {
      return error.message;
    }

    if (error instanceof QueryPreflightError) {
      return error.message;
    }

    if (error instanceof QueryExecutionTimeoutError) {
      return error.message;
    }

    if (error instanceof ResultAccuracyError) {
      return error.message;
    }

    if (error instanceof RealDataUnavailableError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return '当前请求已被系统拦截，请调整条件后重试。';
  }
}
