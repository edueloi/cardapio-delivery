import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3012';
const SLUG = 'pastel-edu';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });

// Capture console errors
const consoleMessages = [];
page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => consoleMessages.push(`[pageerror] ${err.message}`));

console.log('Navigating...');
await page.goto(`${BASE}/menu/${SLUG}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
console.log('DOM loaded, waiting for React to mount...');

// Wait for the root div to have children (React mounted)
try {
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 15000 });
  console.log('React mounted!');
} catch (e) {
  console.log('React did not mount within 15s:', e.message);
}

await page.waitForTimeout(3000); // extra time for API calls + render

const bodyContent = await page.evaluate(() => document.body.innerHTML.substring(0, 300));
console.log('Body content:', bodyContent);

const h1Text = await page.evaluate(() => document.querySelector('h1')?.textContent ?? 'not found');
console.log('H1:', h1Text);

await page.screenshot({ path: 'verify2-hero.png', fullPage: false });
console.log('Hero screenshot saved');

await page.evaluate(() => window.scrollTo(0, 300));
await page.waitForTimeout(800);
await page.screenshot({ path: 'verify2-scrolled.png', fullPage: false });
console.log('Scrolled screenshot saved');

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: 'verify2-fullpage.png', fullPage: true });
console.log('Full page screenshot saved');

// Print any errors
if (consoleMessages.length > 0) {
  console.log('\nConsole messages:');
  consoleMessages.slice(0, 20).forEach(m => console.log(m));
}

await browser.close();
