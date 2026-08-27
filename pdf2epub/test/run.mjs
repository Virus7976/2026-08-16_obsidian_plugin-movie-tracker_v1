#!/usr/bin/env node
// End-to-end check: drive the built app in a real browser, convert the sample
// PDF, and assert the EPUB that comes out is a well-formed, sensibly
// structured book.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = process.argv[2] || path.join(root, 'test/fixtures/sample-book.pdf');
const outDir = path.join(root, 'test/out');
let baseUrl = '';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};

function serve() {
  // No fixed port: take whichever one Vite reports, so a stray server from an
  // earlier run cannot wedge the suite.
  const proc = spawn('npx', ['vite', 'preview', '--port', '0'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview server did not start')), 30000);
    proc.stdout.on('data', (d) => {
      const m = String(d).match(/https?:\/\/localhost:(\d+)\S*/);
      if (m) { baseUrl = `http://localhost:${m[1]}/`; clearTimeout(timer); resolve(proc); }
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('exit', (code) => { clearTimeout(timer); reject(new Error(`preview exited ${code}`)); });
  });
}

const server = await serve();
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// This container ships Chromium at a fixed path; fall back to whatever
// Playwright resolves on a normal machine.
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(
  fs.existsSync(CHROME) ? { executablePath: CHROME, args: ['--no-sandbox'] } : {},
);
const page = await browser.newPage({ acceptDownloads: true });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${m.text()} @ ${JSON.stringify(m.location())}`); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));
const missing = [];
page.on('requestfinished', async (r) => { const res = await r.response(); if (res && res.status() === 404) missing.push(r.url()); });
page.on('response', (r) => { if (r.status() === 404) missing.push(r.url()); });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  check('app loads', await page.locator('.dropzone').isVisible());

  await page.setInputFiles('input[type=file]', fixture);
  await page.waitForSelector('.job.done, .job.error', { timeout: 120000 });

  const failed = await page.locator('.job.error').count();
  check('conversion finished without error', failed === 0,
    failed ? await page.locator('.job.error .error').innerText() : '');

  const report = await page.evaluate(() => window.__lastReport || null);

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.click('a.primary'),
  ]).then(([d]) => d);
  const epubPath = path.join(outDir, 'sample.epub');
  await download.saveAs(epubPath);
  check('EPUB downloaded', fs.existsSync(epubPath) && fs.statSync(epubPath).size > 2000,
    `${Math.round(fs.statSync(epubPath).size / 1024)} KB`);

  // The in-app preview reads the generated file back with a real parser.
  await page.click('button:has-text("Preview the book")');
  await page.waitForSelector('.reader iframe', { timeout: 20000 });
  const frame = page.frameLocator('.reader iframe');
  const sections = await page.locator('.reader select option').count();
  check('preview opens every spine document', sections >= 4, `${sections} sections`);
  // Walk to the first real chapter — the opening sections are cover and title.
  let bodyText = '';
  for (let i = 0; i < sections; i++) {
    await page.selectOption('.reader select', String(i));
    await page.waitForTimeout(120);
    const t = await page.frameLocator('.reader iframe').locator('body').innerText();
    if (t.trim().length > bodyText.length) bodyText = t.trim();
  }
  check('preview renders prose', bodyText.length > 400, `${bodyText.length} chars in the longest section`);
  check('no 404s', missing.length === 0, missing.slice(0, 3).join(' | '));

  if (report) fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failedCount}/${results.length} browser checks passed`);
process.exit(failedCount ? 1 : 0);
