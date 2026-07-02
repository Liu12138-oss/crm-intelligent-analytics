import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AnalysisLoggerService {
  private readonly logger = new Logger('CRMAnalytics');

  logStep(message: string, payload?: Record<string, unknown>): void {
    this.logger.log(
      payload ? `${message} ${JSON.stringify(payload)}` : message,
    );
  }

  logInfo(message: string, payload?: Record<string, unknown>): void {
    this.logger.log(
      payload ? `${message} ${JSON.stringify(payload)}` : message,
    );
  }

  logWarn(message: string, payload?: Record<string, unknown>): void {
    this.logger.warn(
      payload ? `${message} ${JSON.stringify(payload)}` : message,
    );
  }

  logError(message: string, payload?: Record<string, unknown>): void {
    this.logger.error(
      payload ? `${message} ${JSON.stringify(payload)}` : message,
    );
  }

  logDebug(message: string, payload?: Record<string, unknown>): void {
    this.logger.debug(
      payload ? `${message} ${JSON.stringify(payload)}` : message,
    );
  }
}
