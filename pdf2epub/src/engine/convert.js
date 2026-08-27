// Orchestrates the whole conversion: PDF in, EPUB blob + a report out.

import { extractLines, findGraphics } from './layout.js';
import { documentStats, findRunningHeads, buildDocument, chapterize, stripTags } from './analyze.js';
import { figureRegions, renderFigures, renderPage, dropRepeats } from './images.js';
import { detectTitlePage, resolveMetadata, generateCover } from './meta.js';
import { buildEpub } from './epub.js';

export const DEFAULTS = {
  includeImages: true,
  vectorFigures: true,
  dropCaps: true,
  justify: true,
  family: 'serif',
  cover: 'auto',        // auto | firstpage | generated | none
  imageScale: 2,
  imageQuality: 0.82,
  chaptersFrom: 'auto', // auto | outline | headings | single
  pageRange: null,      // [from, to] 1-based inclusive
};

const sleep = () => new Promise((r) => setTimeout(r, 0));

async function outlineToChapters(doc, outline) {
  const flat = [];
  const walk = async (items, level) => {
    for (const item of items || []) {
      let page = null;
      try {
        let dest = item.dest;
        if (typeof dest === 'string') dest = await doc.getDestination(dest);
        if (Array.isArray(dest) && dest[0]) page = (await doc.getPageIndex(dest[0])) + 1;
      } catch { /* a broken destination should not sink the outline */ }
      flat.push({ title: String(item.title || '').replace(/\s+/g, ' ').trim(), level, page });
      if (item.items?.length) await walk(item.items, level + 1);
    }
  };
  await walk(outline, 1);
  const withPages = flat.filter((e) => e.page && e.title);
  const topLevel = withPages.filter((e) => e.level === 1);
  const chosen = topLevel.length >= 2 ? topLevel : withPages;
  const seen = new Set();
  return chosen.filter((e) => (seen.has(e.page) ? false : seen.add(e.page)));
}

/**
 * @param {ArrayBuffer|Uint8Array} data
 * @param {Object} opts  see DEFAULTS, plus { filename, pdfjs, workerSrc, cMapUrl, standardFontDataUrl }
 * @param {(p:{stage:string, page?:number, pages?:number, percent:number, note?:string})=>void} onProgress
 */
export async function convert(data, opts = {}, onProgress = () => {}) {
  const options = { ...DEFAULTS, ...opts };
  const pdfjs = options.pdfjs;
  if (!pdfjs) throw new Error('convert() needs a pdfjs module in opts.pdfjs');
  const warnings = [];

  onProgress({ stage: 'loading', percent: 2, note: 'Opening PDF' });
  const doc = await pdfjs.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    cMapUrl: options.cMapUrl,
    cMapPacked: true,
    standardFontDataUrl: options.standardFontDataUrl,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const total = doc.numPages;
  const [from, to] = options.pageRange
    ? [Math.max(1, options.pageRange[0]), Math.min(total, options.pageRange[1] || total)]
    : [1, total];

  const info = (await doc.getMetadata().catch(() => ({}))).info || {};
  const outline = await outlineToChapters(doc, await doc.getOutline().catch(() => null));

  const fontCache = new Map();
  const pages = [];
  const allFigures = [];

  for (let n = from; n <= to; n++) {
    const done = (n - from) / Math.max(1, to - from + 1);
    onProgress({ stage: 'reading', page: n, pages: to, percent: 4 + done * 62, note: `Reading page ${n} of ${to}` });

    const pdfPage = await doc.getPage(n);
    const viewport = pdfPage.getViewport({ scale: 1 });
    // The operator list both locates graphics and resolves the font objects
    // that extractLines needs for bold/italic detection.
    const ops = await pdfPage.getOperatorList();
    const textContent = await pdfPage.getTextContent({ disableNormalization: false });
    const lines = await extractLines(pdfPage, textContent, fontCache);

    const page = {
      number: n,
      width: viewport.width,
      height: viewport.height,
      lines,
      textLines: lines.length,
      figures: [],
    };

    if (options.includeImages) {
      const graphics = findGraphics(ops, pdfjs.OPS, viewport);
      const regions = figureRegions(graphics, page, { vectors: options.vectorFigures });
      if (regions.length) {
        try {
          const rendered = await renderFigures(pdfPage, regions, {
            scale: options.imageScale,
            quality: options.imageQuality,
          });
          for (const fig of rendered) {
            fig.key = `p${n}_${allFigures.length}`;
            allFigures.push(fig);
          }
        } catch (err) {
          warnings.push(`Could not render images on page ${n}: ${err.message}`);
        }
      }
    }

    pages.push(page);
    pdfPage.cleanup();
    if (n % 4 === 0) await sleep();
  }

  onProgress({ stage: 'analyzing', percent: 70, note: 'Working out the structure' });

  const textChars = pages.reduce((n, p) => n + p.lines.reduce((m, l) => m + l.text.length, 0), 0);
  const scanned = textChars / Math.max(1, pages.length) < 60;

  let stats = documentStats(pages);
  let chapters = [];
  let meta;
  let images = new Map();
  let cover = null;

  if (scanned) {
    warnings.push('No usable text layer found — this looks like a scanned PDF. Each page has been kept as an image; run OCR first if you want selectable text.');
    onProgress({ stage: 'analyzing', percent: 72, note: 'Scanned PDF: capturing pages as images' });
    const nodes = [];
    for (let i = 0; i < pages.length; i++) {
      const pdfPage = await doc.getPage(pages[i].number);
      const shot = await renderPage(pdfPage, { maxEdge: 1800, quality: 0.8 });
      const key = `page_${pages[i].number}`;
      images.set(key, shot);
      nodes.push({ type: 'figure', image: key, page: pages[i].number, caption: '' });
      pdfPage.cleanup();
      onProgress({ stage: 'analyzing', percent: 72 + (i / pages.length) * 18, note: `Capturing page ${i + 1} of ${pages.length}` });
      if (i % 3 === 0) await sleep();
    }
    meta = resolveMetadata({ info, detected: { title: '', author: '' }, filename: options.filename });
    chapters = [{ title: meta.title, level: 1, nodes }];
  } else {
    const removed = findRunningHeads(pages, stats);
    if (removed) onProgress({ stage: 'analyzing', percent: 73, note: `Removed ${removed} running heads and page numbers` });
    stats = documentStats(pages);

    const detected = detectTitlePage(pages, stats);
    if (detected.pageIndex >= 0) {
      const tp = pages.find((p) => p.number === detected.pageIndex + 1);
      if (tp) { tp.isTitlePage = true; tp.lines = []; }
    }

    const kept = allFigures.length;
    const surviving = dropRepeats(allFigures, pages.length);
    if (kept - surviving.length) {
      warnings.push(`Dropped ${kept - surviving.length} repeated image${kept - surviving.length === 1 ? '' : 's'} (logos or watermarks).`);
    }
    const keep = new Set(surviving.map((f) => f.key));
    for (const fig of surviving) {
      const page = pages.find((p) => p.number === fig.page);
      if (page) page.figures.push({ ...fig, image: fig.key });
      images.set(fig.key, fig);
    }
    void keep;

    const nodes = buildDocument(pages, stats, { dropCaps: options.dropCaps });
    const firstHeading = nodes.find((n) => n.type === 'heading')?.text || '';
    meta = resolveMetadata({ info, detected, filename: options.filename, firstHeading });

    const useOutline = options.chaptersFrom === 'outline'
      || (options.chaptersFrom === 'auto' && outline.length >= 2);
    chapters = options.chaptersFrom === 'single'
      ? [{ title: meta.title, level: 1, nodes }]
      : chapterize(nodes, { outline: useOutline ? outline : [], titleText: meta.title });

    if (!chapters.length) chapters = [{ title: meta.title, level: 1, nodes }];

    // Images no chapter ended up referencing would bloat the file for nothing.
    const referenced = new Set();
    for (const c of chapters) for (const nd of c.nodes) if (nd.type === 'figure') referenced.add(nd.image);
    for (const key of [...images.keys()]) if (!referenced.has(key)) images.delete(key);
  }

  onProgress({ stage: 'cover', percent: 92, note: 'Making the cover' });
  if (options.cover !== 'none') {
    try {
      const firstPage = pages[0];
      const artFirstPage = firstPage
        && (firstPage.figures?.some((f) => f.area > 0.45) || (firstPage.textLines < 6 && firstPage.figures?.length));
      const wantsPage = options.cover === 'firstpage'
        || (options.cover === 'auto' && (scanned || artFirstPage));
      if (wantsPage) {
        const pdfPage = await doc.getPage(from);
        cover = await renderPage(pdfPage, { maxEdge: 1600, quality: 0.85 });
        pdfPage.cleanup();
      } else {
        cover = await generateCover(meta);
      }
    } catch (err) {
      warnings.push(`Cover could not be made: ${err.message}`);
    }
  }

  onProgress({ stage: 'packaging', percent: 95, note: 'Building the EPUB' });
  const blob = await buildEpub({
    ...meta,
    chapters,
    images,
    cover,
    source: options.filename || '',
    style: { family: options.family, justify: options.justify, dropCaps: options.dropCaps },
  });

  const counts = { headings: 0, paragraphs: 0, figures: 0, lists: 0, quotes: 0, notes: 0, words: 0 };
  for (const c of chapters) {
    for (const nd of c.nodes) {
      if (nd.type === 'heading') counts.headings++;
      else if (nd.type === 'para') { counts.paragraphs++; counts.words += stripTags(nd.html).split(/\s+/).filter(Boolean).length; }
      else if (nd.type === 'figure') counts.figures++;
      else if (nd.type === 'list') counts.lists++;
      else if (nd.type === 'quote') counts.quotes++;
      else if (nd.type === 'note') counts.notes++;
    }
  }

  const safeName = (meta.title || 'book').replace(/[^\p{L}\p{N} .,'()-]/gu, '').trim().slice(0, 80) || 'book';
  onProgress({ stage: 'done', percent: 100, note: 'Done' });

  await doc.destroy();

  return {
    blob,
    cover: cover ? cover.blob : null,
    filename: `${safeName}.epub`,
    report: {
      ...meta,
      pages: pages.length,
      totalPages: total,
      scanned,
      chapters: chapters.map((c) => ({ title: c.title, nodes: c.nodes.length })),
      counts,
      images: images.size,
      coverType: cover ? (cover.generated ? 'generated' : 'from page 1') : 'none',
      usedOutline: outline.length >= 2,
      warnings,
      size: blob.size,
    },
  };
}
