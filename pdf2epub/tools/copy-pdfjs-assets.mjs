#!/usr/bin/env node
// pdf.js needs its standard fonts and character maps served alongside the app.
// They are copied out of the installed package at build time rather than
// committed, so they can never drift from the pdfjs-dist version in use.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const from = path.join(root, 'node_modules/pdfjs-dist');
const to = path.join(root, 'public/pdfjs');

if (!fs.existsSync(from)) {
  console.error('pdfjs-dist is not installed — run npm install first.');
  process.exit(1);
}

fs.rmSync(to, { recursive: true, force: true });
for (const dir of ['standard_fonts', 'cmaps']) {
  fs.cpSync(path.join(from, dir), path.join(to, dir), { recursive: true });
}
const count = (d) => fs.readdirSync(path.join(to, d)).length;
console.log(`pdf.js assets: ${count('standard_fonts')} fonts, ${count('cmaps')} character maps`);
