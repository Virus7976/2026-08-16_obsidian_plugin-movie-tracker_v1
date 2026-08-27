// Minimal ZIP writer sufficient for EPUB containers.
// - First entry (mimetype) must be STOREd and uncompressed per OCF spec.
// - Everything else is DEFLATEd via CompressionStream when available.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const HAS_CS = typeof CompressionStream !== 'undefined';

async function deflateRaw(bytes) {
  if (!HAS_CS) return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const out = new Response(new Blob([bytes]).stream().pipeThrough(cs));
    const buf = new Uint8Array(await out.arrayBuffer());
    return buf.length < bytes.length ? buf : null;
  } catch {
    return null;
  }
}

const enc = new TextEncoder();
const bytesOf = (v) => (typeof v === 'string' ? enc.encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v));

function dosTime(date) {
  const t = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const d = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { t, d };
}

/**
 * @param {{name:string, data:string|Uint8Array|ArrayBuffer, store?:boolean}[]} entries
 * @returns {Promise<Blob>}
 */
export async function zip(entries, { date = new Date() } = {}) {
  const { t, d } = dosTime(date);
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const raw = bytesOf(entry.data);
    const packed = entry.store ? null : await deflateRaw(raw);
    const method = packed ? 8 : 0;
    const body = packed || raw;
    const sum = crc32(raw);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, method, true);
    local.setUint16(10, t, true);
    local.setUint16(12, d, true);
    local.setUint32(14, sum, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);

    parts.push(new Uint8Array(local.buffer), nameBytes, body);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 0x0314, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, method, true);
    cd.setUint16(12, t, true);
    cd.setUint16(14, d, true);
    cd.setUint32(16, sum, true);
    cd.setUint32(20, body.length, true);
    cd.setUint32(24, raw.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);

    offset += 30 + nameBytes.length + body.length;
  }

  const cdSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/epub+zip' });
}
