#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.env.URL || 'http://localhost:3000/interno';
  const widths = [1920, 1400, 1024, 768, 375];
  const height = 900;
  const outDir = path.resolve(__dirname, '..', '.screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.error('Error launching Playwright Chromium:', e && e.message ? e.message : e);
    process.exit(2);
  }

  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height } });
    try {
      console.log(`Loading ${url} at ${w}x${height}...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(700);
      const file = path.join(outDir, `interno_${w}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`Saved ${file}`);
    } catch (err) {
      console.error(`Failed at ${w}:`, err && err.message ? err.message : err);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('Done. Screenshots in', outDir);
})().catch((e) => { console.error(e); process.exit(1); });
