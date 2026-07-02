import { loadEnv, type UserConfig } from 'vite';
import { normalizeAppBasePath } from './src/utils/app-base-path';

type LoadEnvLike = typeof loadEnv;

/**
 * 解析 Vite 构建应使用的前端基路径。
 *
 * 参数说明：
 * - mode: 当前 Vite 运行模式，例如 `development` / `production`
 * - rootDir: 前端项目根目录
 * - loadEnvFn: 允许测试注入假的环境读取函数；生产逻辑默认使用 Vite `loadEnv`
 *
 * 返回值说明：
 * - 返回适合直接写入 Vite `base` 的规范化路径，例如 `/`、`/insight/`
 *
 * 设计原因：
 * - `vite.config.ts` 直接读取 `process.env` 时，前端自己的 `.env.production.local`
 *   在独立构建场景下不会自动注入进来；
 * - 这里显式走 `loadEnv`，确保前端项目内的环境文件与发布脚本注入环境都能被统一识别。
 */
export function resolveViteAppBasePath(
  mode: string,
  rootDir: string,
  loadEnvFn: LoadEnvLike = loadEnv,
): string {
  const env = loadEnvFn(mode, rootDir, '');
  return normalizeAppBasePath(
    env.VITE_APP_BASE_PATH?.trim() || env.APP_WEB_BASE_URL?.trim(),
  );
}

/**
 * 统一构造带应用基路径的 Vite 配置，供 `vite.config.ts` 直接消费。
 */
export function createAppBasePathConfig(
  mode: string,
  rootDir: string,
  configFactory: (basePath: string) => UserConfig,
): UserConfig {
  return configFactory(resolveViteAppBasePath(mode, rootDir));
}
