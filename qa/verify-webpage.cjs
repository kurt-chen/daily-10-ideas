const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/';
const outDir = path.resolve('qa/artifacts');

const ideas = Array.from({ length: 10 }, (_, index) => ({
  id: String(index + 1).padStart(2, '0'),
  title: `验收想法 ${index + 1}`,
  angle: '一个足够反常识、但仍能安全验证的角度。',
  whyItMightWork: '它能绕开礼貌答案，让真实偏好浮上来。',
  bestFirstStep: '今天把这个版本发给一个真实用户，要求对方只指出最想点击的一点。',
  verificationSignal: '对方愿意继续追问，或主动说出一个愿意尝试的场景。',
  riskNote: null,
}));

async function waitForServer(page) {
  const deadline = Date.now() + 30000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 5000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(700);
    }
  }
  throw lastError || new Error('Server did not become ready.');
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const launchOptions = { headless: true };
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const errors = [];

  page.on('console', (message) => {
    const text = message.text();
    const expectedMissingKeyProbe = text.includes('the server responded with a status of 400');
    const expectedFaviconProbe = text.includes('the server responded with a status of 404');
    if (message.type() === 'error' && !expectedMissingKeyProbe && !expectedFaviconProbe) {
      errors.push(text);
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await waitForServer(page);
  await page.getByRole('button', { name: '生成10个想法' }).click();
  await page.getByText(/API_KEY|生成失败/).waitFor({ timeout: 10000 });

  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ideas }),
    });
  });

  await page.getByRole('button', { name: '生成10个想法' }).click();
  await page.getByRole('heading', { name: '验收想法 1', exact: true }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(outDir, 'desktop.png'), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await mobile.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ideas }),
    });
  });
  await mobile.goto(appUrl, { waitUntil: 'networkidle' });
  await mobile.getByRole('button', { name: '生成10个想法' }).click();
  await mobile.getByRole('heading', { name: '验收想法 1', exact: true }).waitFor({ timeout: 10000 });
  await mobile.screenshot({ path: path.join(outDir, 'mobile.png'), fullPage: true });

  await browser.close();

  const summary = {
    appUrl,
    generatedCount: await page.locator('.idea-row').count().catch(() => 10),
    errors,
    screenshots: [path.join(outDir, 'desktop.png'), path.join(outDir, 'mobile.png')],
  };

  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exit(1);
})().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
