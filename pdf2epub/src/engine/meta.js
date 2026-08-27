// Book identity: title, author, publisher, and the cover image.

const JUNK_TITLE = /^(untitled|document\d*|microsoft word|print|output|scan(ned)?|book1?|final|draft|new document|pdf ?document|.*\.(pdf|docx?|indd|tex|pages|odt|ps|qxd|html?|xhtml|epub|txt|rtf|md))$/i;

export function cleanTitle(raw) {
  if (!raw) return '';
  let t = String(raw).trim()
    .replace(/^microsoft\s+word\s*[-–—]\s*/i, '')
    .replace(/\.(pdf|docx?|indd|tex|pages|odt|ps|qxd|html?|xhtml|epub|txt|rtf|md)$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!t || JUNK_TITLE.test(t)) return '';
  if (!/[A-Za-zÀ-￿]/.test(t)) return '';
  if (t.length > 200) return '';
  return t;
}

const titleCase = (s) => s.replace(/\S+/g, (w) =>
  (/^[A-Z0-9&.'-]+$/.test(w) && w.length > 1
    ? w.charAt(0) + w.slice(1).toLowerCase()
    : w));

/**
 * Read the opening pages the way a person does: the biggest type is the title,
 * the name below it is the author, the small line at the foot is the imprint.
 */
export function detectTitlePage(pages, stats) {
  const result = { title: '', subtitle: '', author: '', publisher: '', pageIndex: -1 };
  const candidates = pages.slice(0, Math.min(4, pages.length));

  for (const page of candidates) {
    const lines = page.lines.filter((l) => l.text.trim().length > 1);
    if (!lines.length || lines.length > 18) continue;
    const maxSize = Math.max(...lines.map((l) => l.size));
    if (maxSize < stats.body * 1.35) continue;

    const sorted = [...lines].sort((a, b) => a.y - b.y);
    const titleLines = sorted.filter((l) => l.size >= maxSize - 0.6);
    if (!titleLines.length) continue;

    result.pageIndex = page.number - 1;
    result.title = titleLines.map((l) => l.text).join(' ').replace(/\s{2,}/g, ' ').trim();

    const lastTitleY = Math.max(...titleLines.map((l) => l.y));
    const rest = sorted.filter((l) => !titleLines.includes(l));

    const subtitle = rest.find((l) =>
      l.y > lastTitleY && l.y - lastTitleY < stats.leading * 5
      && l.size > stats.body * 1.02 && l.size < maxSize
      && l.text.split(/\s+/).length <= 12);
    if (subtitle) result.subtitle = subtitle.text.replace(/^[-–—:\s]+/, '').trim();

    const byLine = rest.find((l) => /^\s*(by|written by|edited by)\s+\S/i.test(l.text));
    if (byLine) {
      result.author = titleCase(byLine.text.replace(/^\s*(by|written by|edited by)\s+/i, '').trim());
    } else {
      const lower = rest.filter((l) => l.y > lastTitleY && l !== subtitle);
      const nameish = lower.find((l) => {
        const words = l.text.trim().split(/\s+/);
        return words.length >= 1 && words.length <= 6
          && l.text.length < 60
          && /[A-Za-z]/.test(l.text)
          && !/^[0-9\W]+$/.test(l.text)
          && (l.text === l.text.toUpperCase() || l.size >= stats.body);
      });
      if (nameish) result.author = titleCase(nameish.text.trim());
    }

    const foot = sorted[sorted.length - 1];
    if (foot && foot.y > page.height * 0.7 && foot.size <= stats.body * 1.05
        && foot.text.length < 60 && foot.text !== result.author
        && !/^[0-9\s.\-]+$/.test(foot.text)) {
      result.publisher = titleCase(foot.text.trim());
    }
    break;
  }
  return result;
}

/** Merge every source of metadata, best evidence first. */
const MACHINE_TITLE = /_|\b(final|draft|copy|rev|revised|v ?\d+|version ?\d+|untitled|new)\b|^[a-z0-9.\-]+$/i;

export function resolveMetadata({ info, detected, filename, firstHeading }) {
  const fromInfo = cleanTitle(info?.Title);
  const fromFile = cleanTitle(filename?.replace(/\.pdf$/i, ''));
  // A Title field like "tidal_notes_FINAL_v3" is a save-as artefact; the words
  // set in large type on the title page are the real title.
  const weakInfo = fromInfo && MACHINE_TITLE.test(fromInfo);
  const title = (weakInfo ? '' : fromInfo)
    || cleanTitle(detected.title)
    || fromInfo
    || cleanTitle(firstHeading)
    || fromFile
    || 'Untitled';
  const infoAuthor = (info?.Author || '').trim();
  const junkAuthor = /^(anonymous|unknown|user|admin|owner|author|none|n\/?a|guest|windows user|microsoft office user|acrobat|pdf)$/i;
  const author = (junkAuthor.test(infoAuthor) ? '' : infoAuthor) || detected.author || '';
  return {
    title,
    subtitle: detected.subtitle && detected.subtitle !== title ? detected.subtitle : '',
    author: author.replace(/\s{2,}/g, ' ').slice(0, 120),
    publisher: detected.publisher || '',
    language: (info?.Language || 'en').slice(0, 8),
  };
}

// ------------------------------------------------------------------- cover

const PALETTES = [
  { bg: '#1d2b33', ink: '#f3ece1', rule: '#c9a227' },
  { bg: '#f4efe4', ink: '#2b2b2b', rule: '#8c3b2f' },
  { bg: '#2a2118', ink: '#f0e6d2', rule: '#b08447' },
  { bg: '#1b2a24', ink: '#eef2ea', rule: '#d8a13a' },
  { bg: '#efe7dc', ink: '#26323c', rule: '#3f6d80' },
];

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

/** A restrained typographic cover for books that arrive without artwork. */
export async function generateCover({ title, author, publisher }, { width = 1200, height = 1800 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  let seed = 0;
  for (const ch of String(title)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const palette = PALETTES[seed % PALETTES.length];

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = palette.rule;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.strokeRect(width * 0.06, height * 0.045, width * 0.88, height * 0.91);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.fillStyle = palette.ink;

  const margin = width * 0.16;
  let size = Math.min(120, Math.max(52, 1500 / Math.max(8, String(title).length) * 4));
  let lines = [];
  for (;;) {
    ctx.font = `${size}px Georgia, 'Times New Roman', serif`;
    lines = wrapText(ctx, title, width - margin * 2);
    if (lines.length <= 4 || size <= 46) break;
    size -= 6;
  }
  let y = height * 0.3;
  for (const line of lines.slice(0, 5)) {
    ctx.fillText(line, width / 2, y);
    y += size * 1.16;
  }

  ctx.strokeStyle = palette.rule;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(width * 0.36, y + size * 0.35);
  ctx.lineTo(width * 0.64, y + size * 0.35);
  ctx.stroke();

  if (author) {
    ctx.font = `${Math.round(size * 0.42)}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = palette.ink;
    const authorLines = wrapText(ctx, author.toUpperCase(), width - margin * 2).slice(0, 2);
    let ay = y + size * 1.35;
    for (const line of authorLines) {
      ctx.fillText(line, width / 2, ay);
      ay += size * 0.55;
    }
  }

  if (publisher) {
    ctx.font = `${Math.round(size * 0.26)}px Georgia, 'Times New Roman', serif`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(publisher.toUpperCase(), width / 2, height * 0.88);
    ctx.globalAlpha = 1;
  }

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
  canvas.width = canvas.height = 0;
  return { blob, ext: 'jpg', width, height, generated: true };
}
