import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createAppBasePathConfig } from './vite-app-base-path';

const viteConfigRootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) =>
  createAppBasePathConfig(mode, viteConfigRootDir, (appBasePath) => {
    const env = loadEnv(mode, viteConfigRootDir, '');
    const devApiProxyTarget =
      process.env.VITE_DEV_API_PROXY_TARGET?.trim() ||
      env.VITE_DEV_API_PROXY_TARGET?.trim() ||
      process.env.VITE_API_BASE_URL?.trim() ||
      env.VITE_API_BASE_URL?.trim() ||
      'http://127.0.0.1:3001';

    return {
      base: appBasePath,
      plugins: [vue()],
      build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: {
              'vue-vendor': ['vue', 'vue-router', 'pinia'],
              'element-plus': ['element-plus', '@element-plus/icons-vue'],
              // ECharts 按需引入分包，避免主 chunk 过大
              echarts: [
                'echarts/core',
                'echarts/charts',
                'echarts/components',
                'echarts/renderers',
              ],
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
      },
      server: {
        host: '0.0.0.0',
        port: 5173,
        proxy: {
          '/api': {
            // 开发态前端统一把 API 走回当前 Vite 站点，再由代理转发到真实后端，
            // 避免局域网入口、跨域预检和 Cookie 策略叠加后让登录看起来“忽好忽坏”。
            target: devApiProxyTarget,
            changeOrigin: true,
          },
        },
      },
    };
  }),
);
