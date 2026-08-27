#!/usr/bin/env node
// Text-pipeline inspector: prints the blocks and nodes the analyzer produces,
// without needing a browser (images are skipped).
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import { extractLines } from '../src/engine/layout.js';
import { documentStats, findRunningHeads, buildDocument, chapterize } from '../src/engine/analyze.js';

const file = process.argv[2] || 'test/fixtures/sample-book.pdf';
const doc = await pdfjs.getDocument({
  data: new Uint8Array(fs.readFileSync(file)),
  standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
}).promise;

const pages = [];
const fontCache = new Map();
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  await page.getOperatorList();
  const lines = await extractLines(page, await page.getTextContent(), fontCache);
  const vp = page.getViewport({ scale: 1 });
  pages.push({ number: n, width: vp.width, height: vp.height, lines, textLines: lines.length, figures: [] });
}

let stats = documentStats(pages);
console.log('stats', stats);
const removed = findRunningHeads(pages, stats);
console.log('running heads removed:', removed);
stats = documentStats(pages);

if (process.argv.includes('--lines')) {
  for (const p of pages) {
    console.log(`\n--- page ${p.number} (${p.lines.length} lines)`);
    for (const l of p.lines) console.log(`  y=${l.y.toFixed(0)} x=${l.x0.toFixed(0)}-${l.x1.toFixed(0)} s=${l.size} ${l.bold ? 'B' : ''}${l.italic ? 'I' : ''} | ${l.text.slice(0, 70)}`);
  }
}

const nodes = buildDocument(pages, stats, { dropCaps: true });
console.log(`\n=== ${nodes.length} nodes ===`);
for (const n of nodes) {
  const text = (n.html || n.text || (n.items || []).join(' | ') || '').replace(/<[^>]+>/g, '');
  console.log(`[${n.type}${n.level ? n.level : ''}${n.opener ? ' opener' : ''}] p${n.page ?? '-'} ${text.slice(0, 90)}`);
}
const chapters = chapterize(nodes, { outline: [], titleText: 'x' });
console.log('\nchapters:', chapters.map((c) => `${c.title} (${c.nodes.length})`));
