#!/usr/bin/env node
// Exercises the on-device library: a converted book survives closing the page,
// the passcode lock really encrypts it, and expired books are cleared.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture = path.join(root, 'test/fixtures/sample-book.pdf');
let baseUrl = '';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};

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

const port = await freePort();
baseUrl = `http://localhost:${port}/`;
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
});
for (let waited = 0; waited < 90000; waited += 300) {
  try { if ((await fetch(baseUrl)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 300));
}

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch(fs.existsSync(CHROME) ? { executablePath: CHROME, args: ['--no-sandbox'] } : {});
// One context throughout: IndexedDB and localStorage must survive reloads.
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.setInputFiles('input[type=file]', fixture);
  await page.waitForSelector('.job.done', { timeout: 180000 });
  await page.waitForSelector('.shelf-item', { timeout: 20000 });

  const title = await page.locator('.shelf-item strong').first().innerText();
  check('converted book lands in the library', title.includes('Keeper'), title);
  const expiry = await page.locator('.shelf-expiry').first().innerText();
  check('shows when it will be cleared', /clears in/.test(expiry), expiry);

  // --- survives the page being closed ------------------------------------
  await page.goto('about:blank');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.shelf-item', { timeout: 20000 });
  check('still there after closing and reopening the page',
    (await page.locator('.shelf-item strong').first().innerText()).includes('Keeper'));
  check('no conversion job is replayed', (await page.locator('.job').count()) === 0);

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.shelf-item button:has-text("Download")').first().click(),
  ]).then(([d]) => d);
  const saved = path.join(root, 'test/out/from-library.epub');
  await download.saveAs(saved);
  check('downloads from the library', fs.statSync(saved).size > 2000,
    `${Math.round(fs.statSync(saved).size / 1024)} KB`);

  // --- passcode lock ------------------------------------------------------
  await page.click('.settings-toggle');
  await page.click('button:has-text("Set up")');
  await page.waitForSelector('.lock-card');
  await page.locator('.lock-card input').nth(0).fill('open-sesame');
  await page.locator('.lock-card input').nth(1).fill('open-sesame');
  await page.click('button:has-text("Turn on the lock")');
  await page.waitForSelector('.lock-card', { state: 'detached', timeout: 20000 });
  await page.waitForTimeout(800);
  check('existing books are encrypted when the lock goes on',
    (await page.locator('.locked-tag').count()) > 0);

  // Nothing readable should remain in storage without the key.
  const leaked = await page.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open('pdf2epub'); r.onsuccess = () => res(r.result); });
    const all = await new Promise((res) => {
      const req = db.transaction('books').objectStore('books').getAll();
      req.onsuccess = () => res(req.result);
    });
    db.close();
    return all.map((r) => ({ encrypted: r.encrypted, hasPlainMeta: !!r.meta, hasPlainData: !!r.data }));
  });
  check('stored records carry no readable title or file',
    leaked.length > 0 && leaked.every((r) => r.encrypted && !r.hasPlainMeta && !r.hasPlainData),
    JSON.stringify(leaked));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lock-card', { timeout: 20000 });
  check('reopening asks for the passcode', await page.locator('.lock-card h2').innerText()
    .then((t) => /locked/i.test(t)));

  await page.locator('.lock-card input').first().fill('wrong-one');
  await page.click('button:has-text("Unlock")');
  await page.waitForSelector('.lock-card .error', { timeout: 10000 });
  check('the wrong passcode is refused',
    /does not match/i.test(await page.locator('.lock-card .error').innerText()));

  await page.locator('.lock-card input').first().fill('open-sesame');
  await page.click('button:has-text("Unlock")');
  await page.waitForSelector('.shelf-item', { timeout: 20000 });
  check('the right passcode opens the library',
    (await page.locator('.shelf-item strong').first().innerText()).includes('Keeper'));

  // --- expiry -------------------------------------------------------------
  await page.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open('pdf2epub'); r.onsuccess = () => res(r.result); });
    const store = db.transaction('books', 'readwrite').objectStore('books');
    const all = await new Promise((res) => { const q = store.getAll(); q.onsuccess = () => res(q.result); });
    for (const record of all) store.put({ ...record, expiresAt: Date.now() - 1000 });
    db.close();
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.lock-card input').first().fill('open-sesame');
  await page.click('button:has-text("Unlock")');
  await page.waitForTimeout(1500);
  check('books past their time are cleared', (await page.locator('.shelf-item').count()) === 0);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} library checks passed`);
process.exit(failed ? 1 : 0);
