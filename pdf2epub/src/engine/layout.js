// Page-level geometry: PDF text items -> styled lines, image regions, vector figures.

const BOLD_RE = /bold|black|heavy|semib|demib|[-_,]bd\b|extrab|ultrab|\bmedi\b/i;
const ITALIC_RE = /italic|oblique|[-_,]it\b|slant/i;
const SERIF_RE = /times|serif|georgia|garamond|minion|caslon|baskerv|palatino|book|roman|cambria|constantia|utopia|charter|sabon|bembo|arno|elzevir/i;
const MONO_RE = /mono|courier|consol|menlo|inconsolata/i;

/** Derive style traits from a PostScript font name like "ABCDEF+Times-Bold". */
export function fontTraits(rawName) {
  const name = String(rawName || '').replace(/^[A-Z]{6}\+/, '');
  const bare = name.replace(/^.*?[-,]/, '');
  return {
    name,
    bold: BOLD_RE.test(name),
    italic: ITALIC_RE.test(name),
    mono: MONO_RE.test(name),
    serif: SERIF_RE.test(name) || (!/sans|arial|helvet|calibri|verdana|tahoma|futura|gill|frutiger|myriad|segoe|roboto|open\s*sans|lato/i.test(name) && !MONO_RE.test(name)),
    bare,
  };
}


/**
 * Vertical channels that no glyph on the page crosses — the gutters between
 * columns. Only the middle of the page is considered, so ordinary margins and
 * a ragged right edge are never mistaken for one.
 */
function findGutters(items, pageWidth) {
  if (items.length < 24) return [];
  const width = Math.ceil(pageWidth);
  const covered = new Uint8Array(width + 2);
  for (const item of items) {
    const from = Math.max(0, Math.floor(item.x0));
    const to = Math.min(width, Math.ceil(item.x1));
    for (let x = from; x <= to; x++) covered[x] = 1;
  }
  const gutters = [];
  let run = null;
  const flush = () => {
    if (run && run.to - run.from >= 8) gutters.push((run.from + run.to) / 2);
    run = null;
  };
  for (let x = Math.floor(width * 0.25); x <= Math.ceil(width * 0.75); x++) {
    if (covered[x]) flush();
    else run = run ? { from: run.from, to: x } : { from: x, to: x };
  }
  flush();
  return gutters;
}

/** Resolve a page font object (only populated once the operator list has run). */
function resolveFont(page, fontName, cache) {
  if (cache.has(fontName)) return cache.get(fontName);
  const p = new Promise((res) => {
    let done = false;
    const finish = (f) => { if (!done) { done = true; res(fontTraits(f && (f.name || f.fallbackName))); } };
    try {
      page.commonObjs.get(fontName, finish);
    } catch { finish(null); }
    // commonObjs never rejects; guard against a font that is simply absent.
    setTimeout(() => finish(null), 3000);
  });
  cache.set(fontName, p);
  return p;
}

const round = (n, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

/** Char-count-weighted median, so a stray large glyph cannot skew a line. */
function weightedMedian(pairs) {
  if (!pairs.length) return 0;
  const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
  const total = sorted.reduce((n, p) => n + p[1], 0);
  let acc = 0;
  for (const [value, weight] of sorted) {
    acc += weight;
    if (acc >= total / 2) return value;
  }
  return sorted[sorted.length - 1][0];
}

/**
 * Convert a page's text content into ordered, styled lines in a top-left
 * coordinate system (y grows downward), which is how everything downstream reasons.
 */
export async function extractLines(page, textContent, fontCache) {
  const viewport = page.getViewport({ scale: 1 });
  const pageH = viewport.height;
  const raw = [];

  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue;
    const [a, b, c, d, e, f] = item.transform;
    const size = Math.hypot(b, d) || Math.hypot(a, c) || item.height || 0;
    if (!size) continue;
    const rotated = Math.abs(b) > 0.05 * size || Math.abs(c) > 0.05 * size;
    raw.push({
      text: item.str,
      x0: e,
      x1: e + (item.width || 0),
      y: pageH - f, // baseline from page top
      size: round(size),
      fontName: item.fontName,
      rotated,
      eol: item.hasEOL,
    });
  }

  const traits = new Map();
  await Promise.all([...new Set(raw.map((r) => r.fontName))].map(async (fn) => {
    traits.set(fn, await resolveFont(page, fn, fontCache));
  }));

  const flow = raw.filter((r) => !r.rotated);
  flow.sort((p, q) => (Math.abs(p.y - q.y) > 0.6 ? p.y - q.y : p.x0 - q.x0));

  const rows = [];
  let cur = null;
  for (const it of flow) {
    const tol = Math.max(1.1, it.size * 0.42);
    if (!cur || Math.abs(it.y - cur.y) > tol) {
      cur = { y: it.y, items: [] };
      rows.push(cur);
    } else {
      cur.y = (cur.y * cur.items.length + it.y) / (cur.items.length + 1);
    }
    cur.items.push(it);
  }

  // Text in adjacent columns shares a baseline, so a row of items can span two
  // columns at once. Split rows at any vertical channel that no glyph on the
  // page crosses, and at gaps far too wide to be a word space.
  const gutters = findGutters(flow, viewport.width);
  const columnOf = (x) => gutters.filter((g) => x > g).length;

  const lines = [];
  for (const row of rows) {
    row.items.sort((p, q) => p.x0 - q.x0);
    let segment = [row.items[0]];
    for (let i = 1; i < row.items.length; i++) {
      const item = row.items[i];
      const prev = row.items[i - 1];
      const gap = item.x0 - prev.x1;
      const newColumn = columnOf((item.x0 + item.x1) / 2) !== columnOf((prev.x0 + prev.x1) / 2);
      if (newColumn || gap > Math.max(item.size * 2.6, 14)) {
        lines.push({ y: row.y, items: segment });
        segment = [item];
      } else segment.push(item);
    }
    lines.push({ y: row.y, items: segment });
  }

  return lines.map((line) => {
    line.items.sort((p, q) => p.x0 - q.x0);
    const spans = [];
    let text = '';
    let prev = null;
    for (const it of line.items) {
      const t = traits.get(it.fontName) || fontTraits('');
      let piece = it.text;
      if (prev) {
        const gap = it.x0 - prev.x1;
        // A drop cap is a single outsized glyph set tight against the word it
        // begins; the gap after it is typographic, not a space.
        const dropCap = prev.size >= it.size * 1.5 && prev.text.trim().length <= 2;
        const needsSpace = !dropCap && gap > it.size * 0.16 && !/\s$/.test(text) && !/^\s/.test(piece);
        if (needsSpace) piece = ' ' + piece;
      }
      const last = spans[spans.length - 1];
      if (last && last.bold === t.bold && last.italic === t.italic && Math.abs(last.size - it.size) < 0.6) {
        last.text += piece;
      } else {
        spans.push({ text: piece, bold: t.bold, italic: t.italic, mono: t.mono, size: it.size, font: t.name });
      }
      text += piece;
      prev = it;
    }
    const sizes = line.items.map((it) => [it.size, Math.max(1, it.text.trim().length)]);
    const maxSize = Math.max(...line.items.map((it) => it.size));
    const bodyish = line.items.filter((it) => it.text.trim().length > 1);
    return {
      page: page.pageNumber,
      y: round(line.y),
      x0: round(Math.min(...line.items.map((it) => it.x0))),
      x1: round(Math.max(...line.items.map((it) => it.x1))),
      size: round(weightedMedian(sizes)),
      maxSize: round(maxSize),
      bold: bodyish.length ? bodyish.every((it) => (traits.get(it.fontName) || {}).bold) : false,
      italic: bodyish.length ? bodyish.every((it) => (traits.get(it.fontName) || {}).italic) : false,
      serif: (traits.get(line.items[0].fontName) || {}).serif !== false,
      font: (traits.get(line.items[0].fontName) || {}).name || '',
      text: text.replace(/\s+/g, ' ').trim(),
      spans: spans.filter((s) => s.text.length),
      pageWidth: round(viewport.width),
      pageHeight: round(pageH),
    };
  }).filter((l) => l.text.length);
}

/**
 * Walk the operator list with a CTM stack to locate painted images and
 * substantial vector artwork, in top-left page coordinates.
 */
export function findGraphics(ops, OPS, viewport) {
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const H = viewport.height;
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const images = [];
  const paths = [];

  const unitBox = (m) => {
    const xs = [m[4], m[0] + m[4], m[2] + m[4], m[0] + m[2] + m[4]];
    const ys = [m[5], m[1] + m[5], m[3] + m[5], m[1] + m[3] + m[5]];
    const y0 = H - Math.max(...ys);
    const y1 = H - Math.min(...ys);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0, y1 };
  };

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    switch (fn) {
      case OPS.save: stack.push(ctm.slice()); break;
      case OPS.restore: ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; break;
      case OPS.transform: ctm = mul(ctm, args); break;
      case OPS.setTransform: ctm = args.slice(); break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
      case OPS.paintJpegXObject: {
        const box = unitBox(ctm);
        if (box.x1 - box.x0 > 1 && box.y1 - box.y0 > 1) {
          images.push({
            ...box,
            id: typeof args[0] === 'string' ? args[0] : `inline_${i}`,
            pxWidth: typeof args[1] === 'number' ? args[1] : 0,
            pxHeight: typeof args[2] === 'number' ? args[2] : 0,
            isMask: fn === OPS.paintImageMaskXObject,
          });
        }
        break;
      }
      case OPS.constructPath: {
        // args: [opList, coords, minMax] — minMax present in pdf.js >= 4,
        // expressed in the path's own space, so map it through the CTM.
        const mm = args[2];
        if (mm && mm.length === 4 && mm.every(Number.isFinite)) {
          const xs = [];
          const ys = [];
          for (const [px, py] of [[mm[0], mm[1]], [mm[2], mm[1]], [mm[0], mm[3]], [mm[2], mm[3]]]) {
            xs.push(ctm[0] * px + ctm[2] * py + ctm[4]);
            ys.push(ctm[1] * px + ctm[3] * py + ctm[5]);
          }
          if (xs.every(Number.isFinite) && ys.every(Number.isFinite)) {
            paths.push({
              x0: Math.min(...xs), x1: Math.max(...xs),
              y0: H - Math.max(...ys), y1: H - Math.min(...ys),
            });
          }
        }
        break;
      }
      default: break;
    }
  }
  return { images, paths };
}
