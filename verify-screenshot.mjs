import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3012';
const SLUG = 'pastel-edu';

const browser = await chromium.launch({ headless: true });

async function shot(label, fn) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
  await fn(page);
  await page.screenshot({ path: `verify-${label}.png`, fullPage: false });
  console.log(`Screenshot: verify-${label}.png`);
  await page.close();
}

// 1. Mobile — above fold
await shot('mobile-hero', async (page) => {
  await page.goto(`${BASE}/menu/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
});

// 2. Mobile — scroll to see featured + category products
await shot('mobile-products', async (page) => {
  await page.goto(`${BASE}/menu/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
});

// 3. Mobile — full page
const page3 = await browser.newPage();
await page3.setViewportSize({ width: 390, height: 844 });
await page3.goto(`${BASE}/menu/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page3.waitForTimeout(3000);
await page3.screenshot({ path: 'verify-mobile-fullpage.png', fullPage: true });
console.log('Screenshot: verify-mobile-fullpage.png');

// Check elements
const heroText = await page3.locator('h1').first().textContent().catch(() => 'not found');
console.log('H1 text:', heroText);
const navPills = await page3.locator('nav button').count();
console.log('Category nav pills count:', navPills);
const productCards = await page3.locator('.bg-white.rounded-2xl').count();
console.log('White rounded cards count:', productCards);
const cartFab = await page3.locator('text=Ver carrinho').isVisible().catch(() => false);
console.log('Cart FAB visible (should be false):', cartFab);
await page3.close();

// 4. Desktop — sidebar layout
const pageDesktop = await browser.newPage();
await pageDesktop.setViewportSize({ width: 1280, height: 800 });
await pageDesktop.goto(`${BASE}/menu/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
await pageDesktop.waitForTimeout(3000);
await pageDesktop.screenshot({ path: 'verify-desktop.png', fullPage: false });
console.log('Screenshot: verify-desktop.png');
await pageDesktop.close();

await browser.close();
console.log('All done.');
