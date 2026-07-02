import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e-spec.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    // E2E 使用独立端口，避免占用开发态默认 5173 端口并误伤本地 dev server。
    command: 'pnpm exec vite --host 127.0.0.1 --port 4173',
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
