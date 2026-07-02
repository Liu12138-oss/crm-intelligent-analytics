import { test, expect } from '@playwright/test';

test('login page should keep equal vertical padding for centered panel', async ({ page }) => {
  await page.goto('/login');

  const spacing = await page.locator('.login-page').evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      paddingTop: Number.parseFloat(style.paddingTop),
      paddingBottom: Number.parseFloat(style.paddingBottom),
    };
  });

  expect(spacing.paddingTop).toBeCloseTo(spacing.paddingBottom, 1);
});

test('login page should move the desktop login area 100px away from the right edge', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/login');

  const layout = await page.locator('.login-page').evaluate((element) => {
    const style = window.getComputedStyle(element);
    const canvas = element.querySelector('.login-page__canvas');
    if (!canvas) {
      throw new Error('登录区域画布不存在。');
    }

    const canvasRect = canvas.getBoundingClientRect();
    return {
      paddingRight: Number.parseFloat(style.paddingRight),
      rightInset: window.innerWidth - canvasRect.right,
    };
  });

  expect(layout.rightInset).toBeCloseTo(layout.paddingRight + 100, 1);
});

test('企业微信扫码区应完整展示二维码下方明细', async ({ page }) => {
  await page.route('**/api/v1/auth/wecom/initiate**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: true,
        state: 'mock-state',
        widget: {
          appId: 'ww-test-app',
          agentId: '1000001',
          redirectUri: 'http://127.0.0.1:4173/login',
          state: 'mock-state',
          scope: 'snsapi_privateinfo',
        },
      }),
    });
  });

  await page.route(
    'https://wwcdn.weixin.qq.com/node/wework/wwopen/js/wwLogin-1.2.7.js',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          window.WwLogin = function WwLogin(options) {
            const mount = document.getElementById(options.id);
            if (!mount) {
              return;
            }

            const iframe = document.createElement('iframe');
            iframe.srcdoc = \`
              <!doctype html>
              <html lang="zh-CN">
                <head>
                  <style>
                    body {
                      margin: 0;
                    }

                    .widget {
                      width: 232px;
                      padding-bottom: 12px;
                      background: #ffffff;
                    }

                    .code {
                      width: 232px;
                      height: 232px;
                      background:
                        linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%),
                        linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%);
                      background-size: 16px 16px;
                      background-position: 0 0, 8px 8px;
                    }

                    .detail {
                      margin: 10px 0 0;
                      font: 14px/22px sans-serif;
                      color: #425466;
                      text-align: center;
                    }
                  </style>
                </head>
                <body>
                  <div class="widget">
                    <div class="code"></div>
                    <p class="detail">企业微信扫码登录后自动返回系统</p>
                  </div>
                </body>
              </html>
            \`;
            mount.appendChild(iframe);
          };
        `,
      });
    },
  );

  await page.goto('/login');
  await page.getByRole('button', { name: '企业微信登录' }).click();

  const iframe = page.locator('.login-card__qrcode-widget iframe');
  await expect(iframe).toBeVisible();

  await page.waitForFunction(() => {
    const widget = document.querySelector<HTMLIFrameElement>('.login-card__qrcode-widget iframe');
    return Boolean(widget?.contentDocument?.body?.scrollHeight);
  });

  const metrics = await iframe.evaluate((node: HTMLIFrameElement) => {
    const detail = node.contentDocument?.querySelector<HTMLElement>('.detail');
    return {
      iframeHeight: Math.round(node.getBoundingClientRect().height),
      contentHeight: node.contentDocument?.body?.scrollHeight ?? 0,
      detailBottom: detail ? Math.round(detail.getBoundingClientRect().bottom) : 0,
    };
  });

  expect(metrics.contentHeight).toBeLessThanOrEqual(metrics.iframeHeight);
  expect(metrics.detailBottom).toBeLessThanOrEqual(metrics.iframeHeight);
});
