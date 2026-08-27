// Minimal ZIP reader — enough to open the EPUB we just wrote and preview it.

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream unavailable');
  const ds = new DecompressionStream('deflate-raw');
  const res = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await res.arrayBuffer());
}

/** @returns {Promise<Map<string, Uint8Array>>} */
export async function unzip(blobOrBuffer) {
  const buf = blobOrBuffer instanceof Blob
    ? new Uint8Array(await blobOrBuffer.arrayBuffer())
    : new Uint8Array(blobOrBuffer);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive');

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out = new Map();

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const csize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(buf.subarray(ptr + 46, ptr + 46 + nameLen));

    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + csize);
    out.set(name, method === 0 ? raw : await inflateRaw(raw));

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const MIME = {
  xhtml: 'application/xhtml+xml', html: 'text/html', css: 'text/css',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml',
};

/**
 * Turn a generated EPUB into something an <iframe> can show: spine documents
 * with their stylesheet inlined and image references pointed at blob URLs.
 */
export async function openBook(epubBlob) {
  const files = await unzip(epubBlob);
  const text = (name) => new TextDecoder().decode(files.get(name) || new Uint8Array());
  const parser = new DOMParser();

  const container = parser.parseFromString(text('META-INF/container.xml'), 'application/xml');
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path') || 'OEBPS/package.opf';
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opf = parser.parseFromString(text(opfPath), 'application/xml');

  const manifest = new Map();
  for (const item of opf.querySelectorAll('manifest > item')) {
    manifest.set(item.getAttribute('id'), {
      href: item.getAttribute('href'),
      type: item.getAttribute('media-type'),
      props: item.getAttribute('properties') || '',
    });
  }

  const urls = [];
  const blobUrlFor = (href) => {
    const path = base + href;
    const data = files.get(path);
    if (!data) return null;
    const ext = href.split('.').pop().toLowerCase();
    const url = URL.createObjectURL(new Blob([data], { type: MIME[ext] || 'application/octet-stream' }));
    urls.push(url);
    return url;
  };

  const css = [...manifest.values()].filter((m) => m.type === 'text/css')
    .map((m) => text(base + m.href)).join('\n');

  const docs = [];
  for (const ref of opf.querySelectorAll('spine > itemref')) {
    const item = manifest.get(ref.getAttribute('idref'));
    if (!item || !/xhtml/.test(item.type)) continue;
    const dir = item.href.includes('/') ? item.href.slice(0, item.href.lastIndexOf('/') + 1) : '';
    const doc = parser.parseFromString(text(base + item.href), 'application/xhtml+xml');
    if (doc.querySelector('parsererror')) continue;

    for (const img of doc.querySelectorAll('img')) {
      const src = img.getAttribute('src') || '';
      const resolved = new URL(src, `x:/${dir}`).pathname.replace(/^\//, '');
      const url = blobUrlFor(resolved);
      if (url) img.setAttribute('src', url);
    }
    for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) link.remove();

    const bodyClass = doc.body?.getAttribute('class') || '';
    docs.push({
      href: item.href,
      title: doc.querySelector('title')?.textContent || item.href,
      bodyClass,
      html: doc.body ? doc.body.innerHTML : '',
    });
  }

  return {
    css,
    docs,
    release: () => urls.forEach((u) => URL.revokeObjectURL(u)),
  };
}
