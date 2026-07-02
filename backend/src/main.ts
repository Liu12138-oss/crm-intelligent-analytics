import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { LocalRuntimeConfigService } from './shared/config/local-runtime-config.service';
import { resolveAllowedCorsOrigins } from './shared/http/cors-options';
import { AnalysisLoggerService } from './shared/logging/analysis-logger.service';

/**
 * 启动后端应用，并按照当前运行配置动态生成 Web 端跨域白名单，避免局域网联调时二维码初始化请求被浏览器拦截。
 */
async function bootstrap(): Promise<void> {
  const localRuntimeConfigService = new LocalRuntimeConfigService();
  const wecomRuntimeConfig = localRuntimeConfigService.getWecomRuntimeConfig();
  const allowedCorsOrigins = resolveAllowedCorsOrigins([
    wecomRuntimeConfig.webBaseUrl,
    process.env.APP_WEB_BASE_URL,
    process.env.WECOM_WEB_BASE_URL,
  ]);
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: allowedCorsOrigins,
      credentials: true,
    },
  });
  const analysisLoggerService = app.get(AnalysisLoggerService);

  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = Date.now();
    response.on('finish', () => {
      analysisLoggerService.logStep('后端 API 请求完成。', {
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        requestId: request.header('x-request-id') ?? request.header('x-correlation-id'),
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
