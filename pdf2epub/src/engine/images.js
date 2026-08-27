// Figure extraction. Regions are located from the operator list, then rendered
// from the page itself so masks, overlays and vector art survive intact.

const PAD = 2;

const areaOf = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const overlaps = (a, b, pad = 0) =>
  a.x0 - pad < b.x1 && b.x0 - pad < a.x1 && a.y0 - pad < b.y1 && b.y0 - pad < a.y1;
const union = (a, b) => ({
  x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
});

function mergeBoxes(boxes, pad) {
  const out = [];
  for (const box of boxes) {
    let merged = { ...box };
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = out.length - 1; i >= 0; i--) {
        if (overlaps(merged, out[i], pad)) {
          merged = { ...union(merged, out[i]), parts: (merged.parts || 1) + (out[i].parts || 1) };
          out.splice(i, 1);
          changed = true;
        }
      }
    }
    out.push(merged);
  }
  return out;
}

/**
 * Decide which parts of a page are figures worth carrying into the EPUB.
 * @param {{images:Array, paths:Array}} graphics
 */
export function figureRegions(graphics, page, { vectors = true, minArea = 0.005 } = {}) {
  const pageArea = page.width * page.height;
  const regions = mergeBoxes(graphics.images.map((i) => ({ ...i, parts: 1 })), PAD * 3);

  if (vectors && graphics.paths.length > 12) {
    const meaningful = graphics.paths.filter((p) => {
      const w = p.x1 - p.x0;
      const h = p.y1 - p.y0;
      return w > 6 && h > 6 && w < page.width * 0.98 && h < page.height * 0.98;
    });
    for (const cluster of mergeBoxes(meaningful, 8)) {
      if ((cluster.parts || 1) < 8) continue;
      if (areaOf(cluster) / pageArea < 0.04) continue;
      if (regions.some((r) => overlaps(r, cluster, 4))) continue;
      regions.push({ ...cluster, vector: true });
    }
  }

  return regions
    .map((r) => ({
      x0: Math.max(0, r.x0 - PAD), y0: Math.max(0, r.y0 - PAD),
      x1: Math.min(page.width, r.x1 + PAD), y1: Math.min(page.height, r.y1 + PAD),
      vector: !!r.vector,
      parts: r.parts || 1,
    }))
    .filter((r) => {
      const w = r.x1 - r.x0;
      const h = r.y1 - r.y0;
      const share = areaOf(r) / pageArea;
      if (w < 22 || h < 22) return false;              // rules, bullets, icons
      if (share < minArea) return false;
      if (share > 0.94 && page.textLines > 18) return false; // page background
      return true;
    })
    .map((r) => ({ ...r, area: areaOf(r) / pageArea, y: r.y0 }));
}

/** 64-bit average hash of a region, used to spot logos repeated on every page. */
function perceptualHash(ctx, sx, sy, sw, sh) {
  const small = document.createElement('canvas');
  small.width = 8;
  small.height = 8;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx.fillStyle = '#fff';
  sctx.fillRect(0, 0, 8, 8);
  sctx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, 8, 8);
  const { data } = sctx.getImageData(0, 0, 8, 8);
  const grey = [];
  for (let i = 0; i < data.length; i += 4) grey.push((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
  const mean = grey.reduce((a, b) => a + b, 0) / grey.length;
  return grey.map((g) => (g > mean ? '1' : '0')).join('');
}

/** Line art compresses better (and looks better) as PNG; photos as JPEG. */
function looksLikeLineArt(ctx, sx, sy, sw, sh) {
  const probe = document.createElement('canvas');
  probe.width = 32;
  probe.height = 32;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, 32, 32);
  pctx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, 32, 32);
  const { data } = pctx.getImageData(0, 0, 32, 32);
  const colors = new Set();
  let nearWhite = 0;
  for (let i = 0; i < data.length; i += 4) {
    colors.add((data[i] >> 4) + ',' + (data[i + 1] >> 4) + ',' + (data[i + 2] >> 4));
    if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) nearWhite++;
  }
  return colors.size < 40 || nearWhite / 1024 > 0.72;
}

const toBlob = (canvas, type, quality) =>
  new Promise((res) => canvas.toBlob((b) => res(b), type, quality));

/**
 * Render a page once and cut every figure region out of it.
 * @returns {Promise<Array<{blob:Blob, width:number, height:number, hash:string, ext:string, y:number}>>}
 */
export async function renderFigures(pdfPage, regions, { scale = 2, quality = 0.82, maxEdge = 1600 } = {}) {
  if (!regions.length) return [];
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;

  const out = [];
  for (const region of regions) {
    const sx = Math.max(0, Math.floor(region.x0 * scale));
    const sy = Math.max(0, Math.floor(region.y0 * scale));
    const sw = Math.min(canvas.width - sx, Math.ceil((region.x1 - region.x0) * scale));
    const sh = Math.min(canvas.height - sy, Math.ceil((region.y1 - region.y0) * scale));
    if (sw < 8 || sh < 8) continue;

    const shrink = Math.min(1, maxEdge / Math.max(sw, sh));
    const crop = document.createElement('canvas');
    crop.width = Math.max(1, Math.round(sw * shrink));
    crop.height = Math.max(1, Math.round(sh * shrink));
    const cctx = crop.getContext('2d');
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(0, 0, crop.width, crop.height);
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);

    const lineArt = looksLikeLineArt(ctx, sx, sy, sw, sh);
    const ext = lineArt ? 'png' : 'jpg';
    const blob = await toBlob(crop, lineArt ? 'image/png' : 'image/jpeg', quality);
    if (!blob) continue;
    out.push({
      blob,
      width: crop.width,
      height: crop.height,
      ext,
      hash: perceptualHash(ctx, sx, sy, sw, sh),
      x0: region.x0,
      y0: region.y0,
      x1: region.x1,
      y1: region.y1,
      y: region.y0,
      page: pdfPage.pageNumber,
      area: region.area,
      vector: region.vector,
    });
  }
  canvas.width = canvas.height = 0;
  return out;
}

/** Render a whole page (used for the cover when page one is artwork). */
export async function renderPage(pdfPage, { maxEdge = 1400, quality = 0.86 } = {}) {
  const base = pdfPage.getViewport({ scale: 1 });
  const scale = Math.min(3, maxEdge / Math.max(base.width, base.height));
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pdfPage.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
  const blob = await toBlob(canvas, 'image/jpeg', quality);
  const result = { blob, width: canvas.width, height: canvas.height, ext: 'jpg' };
  canvas.width = canvas.height = 0;
  return result;
}

/** Drop images that repeat across the book — logos, watermarks, page furniture. */
export function dropRepeats(figures, pageCount) {
  const tally = new Map();
  for (const f of figures) tally.set(f.hash, (tally.get(f.hash) || 0) + 1);
  // Page furniture appears on most pages and is small; a recurring illustration
  // in an illustrated book is neither, so the bar has to be high on both counts.
  const limit = Math.max(4, Math.ceil(pageCount * 0.5));
  return figures.filter((f) => !(tally.get(f.hash) >= limit && f.area < 0.15));
}
