// Document-level analysis: styled lines from every page become a semantic
// book model (chapters, headings, paragraphs, lists, quotes, figures, notes).

const CHAPTER_WORD = /^\s*(chapter|part|book|volume|section|prologue|epilogue|introduction|preface|foreword|afterword|appendix|conclusion|acknowledge?ments?|epigraph|interlude|canto|act)\b/i;
const ROMAN_OR_NUM = /^\s*(chapter|part|book|section)?\s*([0-9]{1,3}|[ivxlcdm]{1,7})\s*[.:—–-]?\s*$/i;
const BULLET = /^([•▪◦‣·∙⁃●○—–\-*]|•)\s+/;
const ORDERED = /^\(?([0-9]{1,2}|[a-z]|[ivx]{1,4})[.)]\s+/i;
const CAPTION_WORD = /^\s*(fig(ure|\.)?|table|plate|illus(tration)?|image|photo|chart|diagram|map|exhibit)\s*[0-9ivxlc]*[.:) ]/i;
const SCENE_BREAK = /^[\s*·•~§#✦❖◆◇＊⁂⸻.\-–—_]{2,}$/;
const TERMINAL = /["'”’)\]]*[.!?…:;]["'”’)\]]*\s*$/;

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const percentile = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
};
const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Straighten the quotes/dashes PDFs mangle, without touching real content. */
function tidy(text) {
  return text
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/([\p{L}])\u00ad([\p{L}])/gu, '$1$2')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function mode(pairs, bucket = 0.5) {
  const tally = new Map();
  for (const [value, weight] of pairs) {
    const key = Math.round(value / bucket) * bucket;
    tally.set(key, (tally.get(key) || 0) + weight);
  }
  let best = 0;
  let bestCount = -1;
  for (const [key, count] of tally) if (count > bestCount) { best = key; bestCount = count; }
  return { value: best, tally };
}

// ---------------------------------------------------------------- statistics

export function documentStats(pages) {
  const all = pages.flatMap((p) => p.lines);
  const body = mode(all.map((l) => [l.size, l.text.length])).value || 11;

  const gaps = [];
  for (const page of pages) {
    const sorted = [...page.lines].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      const d = sorted[i].y - sorted[i - 1].y;
      if (d > 0.4 * body && d < 3 * body) gaps.push(d);
    }
  }
  const leading = median(gaps) || body * 1.2;

  const bodyLines = all.filter((l) => Math.abs(l.size - body) < body * 0.12);
  const left = percentile(bodyLines.map((l) => l.x0), 0.12);
  const right = percentile(bodyLines.map((l) => l.x1), 0.88);
  const justifiedShare = bodyLines.length
    ? bodyLines.filter((l) => Math.abs(l.x1 - right) < body * 0.35).length / bodyLines.length
    : 0;

  return { body, leading, left, right, justified: justifiedShare > 0.55, pageCount: pages.length };
}

/**
 * Strip page furniture: folios, and running heads that either repeat across the
 * book or echo one of its titles. Candidates are only ever the first or last
 * line on a page, sitting in the margin or cut off from the text block by an
 * unusual gap — so a genuine opening line is never at risk.
 */
export function findRunningHeads(pages, stats) {
  const norm = (t) => t.toLowerCase().replace(/[0-9]+/g, '#').replace(/[^a-z#]+/g, ' ').trim();

  const titleLike = new Set();
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.size >= stats.body * 1.1 && line.text.split(/\s+/).length <= 12) {
        const key = norm(line.text);
        if (key) titleLike.add(key);
      }
    }
  }

  const candidates = new Map();
  const tally = new Map();
  for (const page of pages) {
    const sorted = [...page.lines].sort((a, b) => a.y - b.y);
    if (sorted.length < 3) continue;
    const picks = [];
    if (sorted[0].y < page.height * 0.13 || sorted[1].y - sorted[0].y > stats.leading * 1.6) {
      picks.push(sorted[0]);
    }
    const last = sorted[sorted.length - 1];
    const penultimate = sorted[sorted.length - 2];
    if (last.y > page.height * 0.87 || last.y - penultimate.y > stats.leading * 1.6) {
      picks.push(last);
    }
    candidates.set(page.number, new Set(picks));
    for (const line of picks) {
      const key = norm(line.text);
      if (key) tally.set(key, (tally.get(key) || 0) + 1);
    }
  }

  const repeatLimit = Math.max(2, Math.ceil(pages.length * 0.15));
  let removed = 0;

  for (const page of pages) {
    const picks = candidates.get(page.number);
    if (!picks || !picks.size) continue;
    page.lines = page.lines.filter((line) => {
      if (!picks.has(line)) return true;
      const text = line.text.trim();
      if (/^[ivxlcdm\d\s.\-—–|]{1,11}$/i.test(text)) { removed++; return false; }   // folio
      if (line.size > stats.body * 1.06 || text.length > 80) return true;          // a real heading
      const key = norm(text);
      if (!key) return true;
      if ((tally.get(key) || 0) >= repeatLimit || titleLike.has(key)) { removed++; return false; }
      return true;
    });
  }
  return removed;
}

// -------------------------------------------------------------------- blocks

/** Split a page into two columns when a clean, tall gutter runs down it. */
function splitColumns(lines, stats, pageWidth) {
  if (lines.length < 8) return [lines];
  const mid = [];
  for (let x = pageWidth * 0.34; x <= pageWidth * 0.66; x += 2) {
    const crossing = lines.filter((l) => l.x0 < x - 1 && l.x1 > x + 1).length;
    mid.push([x, crossing]);
  }
  const clean = mid.filter(([, c]) => c === 0).map(([x]) => x);
  if (clean.length < 6) return [lines];
  const gutter = clean[Math.floor(clean.length / 2)];
  const leftCol = lines.filter((l) => l.x1 <= gutter);
  const rightCol = lines.filter((l) => l.x0 >= gutter);
  if (leftCol.length < 4 || rightCol.length < 4) return [lines];
  if (leftCol.length + rightCol.length < lines.length * 0.9) return [lines];
  return [leftCol, rightCol];
}

function buildBlocks(page, stats) {
  const columns = splitColumns([...page.lines].sort((a, b) => a.y - b.y), stats, page.width);
  const blocks = [];
  for (const column of columns) {
    const sorted = [...column].sort((a, b) => a.y - b.y);
    let cur = null;
    for (const line of sorted) {
      const gap = cur ? line.y - cur.lines[cur.lines.length - 1].y : 0;
      const prev = cur && cur.lines[cur.lines.length - 1];
      const sizeShift = prev ? Math.abs(line.size - prev.size) > Math.max(0.6, prev.size * 0.13) : false;
      const bigGap = prev ? gap > Math.max(stats.leading, prev.size * 1.15) * 1.5 : false;
      if (!cur || bigGap || sizeShift) {
        cur = { lines: [line], page: page.number };
        blocks.push(cur);
      } else {
        cur.lines.push(line);
      }
    }
  }
  for (const b of blocks) {
    b.x0 = Math.min(...b.lines.map((l) => l.x0));
    b.x1 = Math.max(...b.lines.map((l) => l.x1));
    b.top = Math.min(...b.lines.map((l) => l.y));
    b.bottom = Math.max(...b.lines.map((l) => l.y));
    b.size = median(b.lines.map((l) => l.size));
    b.text = b.lines.map((l) => l.text).join(' ');
    b.bold = b.lines.every((l) => l.bold);
    b.italic = b.lines.every((l) => l.italic);
    b.centered = b.lines.every((l) => Math.abs((l.x0 + l.x1) / 2 - page.width / 2) < page.width * 0.06)
      && b.x1 - b.x0 < page.width * 0.8;
  }
  return blocks.sort((a, b) => a.top - b.top);
}

// ------------------------------------------------------------ inline styling

/** Render a block's spans as HTML, emitting emphasis only where it deviates
 *  from the block's own dominant style (a fully italic block is a style, not stress). */
function inlineHtml(lines, stats, { dropCap = false } = {}) {
  const spans = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const s of line.spans) spans.push({ ...s });
    const next = lines[i + 1];
    if (!next) continue;
    const last = spans[spans.length - 1];
    const hyphen = /[\p{L}]‐?-$/u.test(last.text.trimEnd());
    const nextStartsLower = /^[\p{Ll}]/u.test(next.spans[0]?.text.trimStart() || '');
    if (hyphen && nextStartsLower) last.text = last.text.trimEnd().replace(/[‐-]$/, '');
    else last.text = last.text.replace(/\s*$/, ' ');
  }

  const weight = (pred) => spans.filter(pred).reduce((n, s) => n + s.text.length, 0);
  const total = spans.reduce((n, s) => n + s.text.length, 0) || 1;
  const baseBold = weight((s) => s.bold) / total > 0.65;
  const baseItalic = weight((s) => s.italic) / total > 0.65;

  let html = '';
  let first = true;
  for (const s of spans) {
    let text = escapeHtml(tidy(s.text) + (/\s$/.test(s.text) ? ' ' : ''));
    if (!text) continue;
    if (first && dropCap) {
      const m = text.match(/^(["'“‘]?[\p{L}\p{N}])/u);
      if (m && s.size > stats.body * 1.6) {
        text = `<span class="dropcap">${m[1]}</span>` + text.slice(m[1].length);
      }
      first = false;
    }
    const em = s.italic && !baseItalic;
    const strong = s.bold && !baseBold;
    if (em) text = `<em>${text}</em>`;
    if (strong) text = `<strong>${text}</strong>`;
    html += text;
  }
  return html.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

/** Break a text block into paragraphs using indentation and line-fill cues. */
function paragraphsOf(block, stats) {
  const lines = block.lines;
  const groups = [[lines[0]]];
  const baseX = percentile(lines.map((l) => l.x0), 0.2);
  const rightEdge = Math.max(...lines.map((l) => l.x1));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const prev = lines[i - 1];
    const indented = line.x0 > baseX + stats.body * 0.55;
    const prevShort = prev.x1 < rightEdge - stats.body * 2.2;
    const prevEnds = TERMINAL.test(prev.text);
    const gap = line.y - prev.y > stats.leading * 1.28;
    const startsNew = indented || gap || (stats.justified && prevShort && prevEnds);
    if (startsNew) groups.push([line]);
    else groups[groups.length - 1].push(line);
  }
  return groups.map((g) => ({ lines: g, indented: g[0].x0 > baseX + stats.body * 0.55 }));
}

// ------------------------------------------------------------- classification

function classify(block, stats, page, headingSizes) {
  const words = block.text.trim().split(/\s+/).filter(Boolean);
  const rel = block.size / stats.body;
  const short = words.length <= 18 && block.lines.length <= 3;
  const chaptery = CHAPTER_WORD.test(block.text) || ROMAN_OR_NUM.test(block.text);

  if (SCENE_BREAK.test(block.text.trim()) && words.length <= 6) return { kind: 'break' };

  if (short && (rel >= 1.12 || (block.bold && rel > 0.97) || (chaptery && (block.centered || rel > 1.02)))) {
    if (!/[.!?]\s*$/.test(block.text) || chaptery || rel >= 1.3) {
      const rank = headingSizes.findIndex((s) => Math.abs(s - block.size) < 0.4);
      let level = rank < 0 ? 2 : Math.min(rank + 1, 4);
      if (chaptery && block.size >= stats.body) level = Math.min(level, rank <= 1 ? 1 : 2);
      return { kind: 'heading', level };
    }
  }

  if (BULLET.test(block.lines[0].text) || ORDERED.test(block.lines[0].text)) {
    return { kind: 'list', ordered: !BULLET.test(block.lines[0].text) };
  }

  if (CAPTION_WORD.test(block.text) && words.length < 60) return { kind: 'caption' };

  const bottomBand = block.top > page.height * 0.72;
  if (block.size < stats.body * 0.88 && bottomBand && words.length > 2) return { kind: 'note' };

  const indentedBoth = block.x0 > stats.left + stats.body * 1.6
    && block.x1 < stats.right - stats.body * 0.4;
  if ((indentedBoth || (block.italic && block.size <= stats.body)) && words.length > 6
      && block.x0 > stats.left + stats.body) {
    return { kind: 'quote' };
  }

  if (block.centered && words.length <= 12 && rel > 0.95 && !TERMINAL.test(block.text)) {
    return { kind: 'centered' };
  }

  return { kind: 'para' };
}

function headingSizeLadder(blocks, stats) {
  const sizes = new Map();
  for (const b of blocks) {
    if (b.size < stats.body * 1.08) continue;
    if (b.text.trim().split(/\s+/).length > 18) continue;
    const key = Math.round(b.size * 2) / 2;
    sizes.set(key, (sizes.get(key) || 0) + 1);
  }
  return [...sizes.keys()].sort((a, b) => b - a);
}

// ------------------------------------------------------------------ assembly

/**
 * @param {Array} pages  [{ number, width, height, lines, figures }]
 * @returns {{nodes:Array, stats:Object}}
 */
export function buildDocument(pages, stats, options = {}) {
  const allBlocks = [];
  for (const page of pages) {
    page.blocks = buildBlocks(page, stats);
    allBlocks.push(...page.blocks);
  }
  const ladder = headingSizeLadder(allBlocks, stats);

  const nodes = [];
  const pushPara = (html, meta = {}) => {
    if (!html) return;
    nodes.push({ type: 'para', html, ...meta });
  };

  for (const page of pages) {
    const figures = [...(page.figures || [])].sort((a, b) => a.y0 - b.y0);
    const emitted = new Set();
    const items = [];

    for (const block of page.blocks) {
      // Text baked into a figure crop must not be repeated as prose.
      const covered = figures.some((f) => {
        if (f.area > 0.62) return false;
        const ox = Math.min(block.x1, f.x1) - Math.max(block.x0, f.x0);
        const oy = Math.min(block.bottom, f.y1) - Math.max(block.top, f.y0);
        if (ox <= 0 || oy <= 0) return false;
        const blockArea = Math.max(1, (block.x1 - block.x0) * Math.max(1, block.bottom - block.top));
        return (ox * oy) / blockArea > 0.6;
      });
      if (covered) continue;
      items.push({ y: block.top, block });
    }
    for (const fig of figures) items.push({ y: fig.y0, fig });
    items.sort((a, b) => a.y - b.y);

    let lastWasFigure = null;
    for (const item of items) {
      if (item.fig) {
        const node = { type: 'figure', image: item.fig.image, page: page.number, caption: '' };
        nodes.push(node);
        lastWasFigure = node;
        continue;
      }
      const block = item.block;
      const info = classify(block, stats, page, ladder);

      if (info.kind === 'caption' && lastWasFigure) {
        lastWasFigure.caption = inlineHtml(block.lines, stats);
        lastWasFigure = null;
        continue;
      }
      lastWasFigure = null;

      switch (info.kind) {
        case 'heading':
          nodes.push({
            type: 'heading',
            level: info.level,
            html: inlineHtml(block.lines, stats),
            text: tidy(block.text),
            page: page.number,
            size: block.size,
          });
          break;
        case 'break':
          nodes.push({ type: 'break' });
          break;
        case 'list': {
          const entries = [];
          let cur = null;
          for (const line of block.lines) {
            if (BULLET.test(line.text) || ORDERED.test(line.text)) {
              cur = { lines: [{ ...line, spans: stripMarker(line.spans) }] };
              entries.push(cur);
            } else if (cur) cur.lines.push(line);
          }
          nodes.push({
            type: 'list',
            ordered: !!info.ordered,
            items: entries.map((e) => inlineHtml(e.lines, stats)).filter(Boolean),
            page: page.number,
          });
          break;
        }
        case 'quote':
          nodes.push({ type: 'quote', html: inlineHtml(block.lines, stats), page: page.number });
          break;
        case 'note':
          nodes.push({ type: 'note', html: inlineHtml(block.lines, stats), page: page.number });
          break;
        case 'centered':
          nodes.push({ type: 'centered', html: inlineHtml(block.lines, stats), page: page.number });
          break;
        case 'caption':
          pushPara(inlineHtml(block.lines, stats), { page: page.number, caption: true });
          break;
        default: {
          const paras = paragraphsOf(block, stats);
          paras.forEach((p, i) => {
            const opener = options.dropCaps && nodes.length && i === 0
              && nodes[nodes.length - 1]?.type === 'heading';
            pushPara(inlineHtml(p.lines, stats, { dropCap: opener }), {
              page: page.number,
              indented: p.indented,
              opener,
              continues: i === 0 && !p.indented,
            });
          });
          break;
        }
      }
    }
    nodes.push({ type: 'pageEnd', page: page.number });
  }

  return mergeAcrossPages(nodes);
}

function stripMarker(spans) {
  const out = spans.map((s) => ({ ...s }));
  for (const s of out) {
    const before = s.text;
    s.text = s.text.replace(BULLET, '').replace(ORDERED, '');
    if (s.text !== before) break;
  }
  return out;
}

/** Re-join paragraphs and words split by a page boundary. */
function mergeAcrossPages(nodes) {
  const out = [];
  for (const node of nodes) {
    if (node.type === 'pageEnd') { out.push(node); continue; }
    const prevReal = [...out].reverse().find((n) => n.type !== 'pageEnd');
    const crossedPage = out.length && out[out.length - 1].type === 'pageEnd';
    if (
      crossedPage && node.type === 'para' && prevReal && prevReal.type === 'para'
      && node.continues && !/<\/(h[1-6]|blockquote)>/.test(prevReal.html)
      && !TERMINAL.test(stripTags(prevReal.html))
    ) {
      const joiner = /[\p{L}]$/u.test(stripTags(prevReal.html)) && /^[\p{Ll}]/u.test(stripTags(node.html)) ? ' ' : ' ';
      prevReal.html = (prevReal.html + joiner + node.html).replace(/\s{2,}/g, ' ');
      while (out.length && out[out.length - 1].type === 'pageEnd') out.pop();
      continue;
    }
    out.push(node);
  }
  return out.filter((n) => n.type !== 'pageEnd' || false);
}

const stripTags = (html) => String(html).replace(/<[^>]+>/g, '');

/** Group the flat node list into chapters, preferring the PDF outline. */
export function chapterize(nodes, { outline = [], titleText = '' } = {}) {
  const chapters = [];
  const startChapter = (title, level = 1) => {
    chapters.push({ title: title || `Section ${chapters.length + 1}`, level, nodes: [] });
    return chapters[chapters.length - 1];
  };

  const outlineByPage = new Map();
  for (const entry of outline) {
    if (entry.page == null) continue;
    if (!outlineByPage.has(entry.page)) outlineByPage.set(entry.page, entry);
  }
  const useOutline = outlineByPage.size >= 2;

  let cur = null;
  let pendingHeading = null;

  for (const node of nodes) {
    const page = node.page;
    const outlineHit = useOutline && page != null && outlineByPage.get(page);
    const isTopHeading = node.type === 'heading' && node.level === 1;

    if (outlineHit && !outlineHit.used && (node.type !== 'figure')) {
      outlineHit.used = true;
      cur = startChapter(node.type === 'heading' ? node.text : outlineHit.title, outlineHit.level || 1);
      if (node.type === 'heading') { cur.headingNode = node; cur.nodes.push(node); continue; }
    } else if (!useOutline && isTopHeading) {
      cur = startChapter(node.text, 1);
      cur.headingNode = node;
      cur.nodes.push(node);
      continue;
    }

    if (!cur) cur = startChapter(titleText || 'Beginning', 1);
    // A subtitle immediately under a chapter title belongs to the title.
    if (node.type === 'heading' && cur.nodes.length === 1 && cur.headingNode
        && node.level > cur.headingNode.level && cur.nodes[0] === cur.headingNode) {
      cur.subtitle = node.html;
      cur.title = `${cur.title}: ${node.text}`;
      cur.nodes.push(node);
      continue;
    }
    cur.nodes.push(node);
    pendingHeading = null;
  }

  return chapters.filter((c) => c.nodes.some((n) => n.type !== 'heading' || c.nodes.length === 1));
}

export { escapeHtml, tidy, stripTags, median, percentile };
