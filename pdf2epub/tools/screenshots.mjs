#!/usr/bin/env node
// Captures the screenshots used in the README, on a phone-sized viewport.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'docs/screenshots');
fs.mkdirSync(out, { recursive: true });
let baseUrl = '';

const server = await new Promise((resolve, reject) => {
  const proc = spawn('npx', ['vite', 'preview', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const timer = setTimeout(() => reject(new Error('no server')), 30000);
  proc.stdout.on('data', (d) => {
    const m = String(d).match(/https?:\/\/localhost:(\d+)/);
    if (m) { baseUrl = `http://localhost:${m[1]}/`; clearTimeout(timer); resolve(proc); }
  });
});

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(CHROME) ? { executablePath: CHROME, args: ['--no-sandbox'] } : {});
const page = await browser.newPage({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(out, '01-start.png') });

await page.setInputFiles('input[type=file]', path.join(root, 'test/fixtures/sample-book.pdf'));
await page.waitForSelector('.job.done', { timeout: 180000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, '02-result.png') });

await page.click('button:has-text("Preview the book")');
await page.waitForSelector('.reader iframe');
await page.waitForTimeout(600);
await page.selectOption('.reader select', '3');   // first chapter
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, '03-chapter.png') });
await page.selectOption('.reader select', '1');   // title page
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, '04-titlepage.png') });

await browser.close();
server.kill('SIGTERM');
console.log('screenshots in docs/screenshots');
