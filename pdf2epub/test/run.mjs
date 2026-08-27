#!/usr/bin/env node
// End-to-end check: drive the built app in a real browser, convert the sample
// PDF, and assert the EPUB that comes out is a well-formed, sensibly
// structured book.

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
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

/**
 * Start `vite preview` on a port we choose, then wait for it to answer.
 * Parsing the banner out of stdout was fragile — the format differs between
 * a terminal and CI.
 */
async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function serve() {
  const port = await freePort();
  baseUrl = `http://localhost:${port}/`;
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stderr.on('data', (d) => process.stderr.write(d));

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`preview exited ${proc.exitCode}`);
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return proc;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  proc.kill('SIGTERM');
  throw new Error('preview server did not start');
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
  await page.waitForSelector('.job.done, .job.error', { timeout: Number(process.env.CONVERT_TIMEOUT || 120000) });

  const failed = await page.locator('.job.error').count();
  check('conversion finished without error', failed === 0,
    failed ? await page.locator('.job.error .error').innerText() : '');

  const report = await page.evaluate(() => window.__lastReport || null);

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.click('a.primary'),
  ]).then(([d]) => d);
  const epubPath = path.join(outDir, `${path.basename(fixture, '.pdf')}.epub`);
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
  // Structural and editorial checks on the file itself.
  const profile = path.basename(fixture) === 'sample-book.pdf' ? 'sample' : '';
  const verify = spawnSync('python3', [path.join(root, 'test/verify_epub.py'), epubPath, profile].filter(Boolean),
    { cwd: root, encoding: 'utf8' });
  if (verify.stdout) process.stdout.write(verify.stdout);
  if (verify.error) console.log('  (skipped EPUB checks: python3 unavailable)');
  else check('EPUB structure and content checks', verify.status === 0);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failedCount}/${results.length} browser checks passed`);
process.exit(failedCount ? 1 : 0);
