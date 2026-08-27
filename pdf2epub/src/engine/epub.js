// EPUB 3.0 package writer (with an NCX so EPUB 2 readers still see the TOC).

import { zip } from './zip.js';
import { bookCss } from './bookcss.js';

const XML_HEAD = '<?xml version="1.0" encoding="utf-8"?>\n';
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const pad = (n, w = 3) => String(n).padStart(w, '0');

function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function xhtml(title, bodyClass, body, { css = '../styles/book.css' } = {}) {
  return `${XML_HEAD}<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="${css}"/>
</head>
<body class="${bodyClass}">
${body}
</body>
</html>
`;
}

/** Nodes from the analyzer become the body of one chapter document. */
function chapterBody(chapter, imageHref) {
  const parts = [];
  const notes = [];
  let afterHeading = true;

  for (const node of chapter.nodes) {
    switch (node.type) {
      case 'heading': {
        if (node.merged) break;
        const level = Math.min(4, Math.max(1, node.level));
        const cls = level === 1 ? ' class="chapter-title"' : '';
        const sub = node.subtitleHtml ? `<span class="subtitle">${node.subtitleHtml}</span>` : '';
        parts.push(`<h${level}${cls}>${node.html}${sub}</h${level}>`);
        afterHeading = true;
        break;
      }
      case 'para': {
        const cls = afterHeading || node.opener ? ' class="opening"' : '';
        parts.push(`<p${cls}>${node.html}</p>`);
        afterHeading = false;
        break;
      }
      case 'centered':
        parts.push(`<p class="centered">${node.html}</p>`);
        afterHeading = false;
        break;
      case 'quote':
        parts.push(`<blockquote><p>${node.html}</p></blockquote>`);
        afterHeading = false;
        break;
      case 'list': {
        const tag = node.ordered ? 'ol' : 'ul';
        if (!node.items.length) break;
        parts.push(`<${tag}>\n${node.items.map((i) => `  <li>${i}</li>`).join('\n')}\n</${tag}>`);
        afterHeading = false;
        break;
      }
      case 'figure': {
        const href = imageHref(node.image);
        if (!href) break;
        const alt = node.caption ? node.caption.replace(/<[^>]+>/g, '') : `Illustration from page ${node.page}`;
        const caption = node.caption ? `\n  <figcaption>${node.caption}</figcaption>` : '';
        parts.push(`<figure>\n  <img src="${href}" alt="${esc(alt)}"/>${caption}\n</figure>`);
        afterHeading = false;
        break;
      }
      case 'break':
        parts.push('<p class="scene-break">* * *</p>');
        afterHeading = true;
        break;
      case 'note':
        notes.push(`<p class="note">${node.html}</p>`);
        break;
      default:
        break;
    }
  }

  if (notes.length) {
    parts.push(`<section class="notes" epub:type="footnotes">\n<h4>Notes</h4>\n${notes.join('\n')}\n</section>`);
  }
  return parts.join('\n');
}

function navDocument(chapters, { hasCover, hasTitlePage, title }) {
  const items = chapters.map((c, i) =>
    `      <li><a href="text/${c.file}">${esc(c.title)}</a></li>`).join('\n');
  const landmarks = [
    hasCover ? '      <li><a epub:type="cover" href="text/cover.xhtml">Cover</a></li>' : '',
    hasTitlePage ? '      <li><a epub:type="titlepage" href="text/titlepage.xhtml">Title Page</a></li>' : '',
    chapters[0] ? `      <li><a epub:type="bodymatter" href="text/${chapters[0].file}">Beginning</a></li>` : '',
  ].filter(Boolean).join('\n');

  return `${XML_HEAD}<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
<meta charset="utf-8"/>
<title>Contents</title>
<link rel="stylesheet" type="text/css" href="styles/book.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc" role="doc-toc">
    <h1>Contents</h1>
    <ol>
${items}
    </ol>
  </nav>
  <nav epub:type="landmarks" id="landmarks" hidden="hidden">
    <h2>Guide</h2>
    <ol>
${landmarks}
    </ol>
  </nav>
</body>
</html>
`;
}

function ncxDocument(chapters, { id, title, author }) {
  const points = chapters.map((c, i) => `    <navPoint id="np${pad(i + 1)}" playOrder="${i + 1}">
      <navLabel><text>${esc(c.title)}</text></navLabel>
      <content src="text/${c.file}"/>
    </navPoint>`).join('\n');

  return `${XML_HEAD}<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${esc(id)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${esc(title)}</text></docTitle>
  <docAuthor><text>${esc(author || 'Unknown')}</text></docAuthor>
  <navMap>
${points}
  </navMap>
</ncx>
`;
}

const MEDIA = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml' };

/**
 * @param {Object} book
 *   { title, author, language, publisher, chapters:[{title, nodes}],
 *     images:Map<key,{blob,ext}>, cover:{blob,ext}|null, style:{} }
 * @returns {Promise<Blob>}
 */
export async function buildEpub(book) {
  const {
    title = 'Untitled', author = '', language = 'en', publisher = '',
    chapters = [], images = new Map(), cover = null, style = {}, source = '',
  } = book;

  const id = `urn:uuid:${uuid()}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const imageEntries = [];
  const hrefByKey = new Map();
  let n = 0;
  for (const [key, img] of images) {
    n += 1;
    const name = `img${pad(n)}.${img.ext}`;
    hrefByKey.set(key, name);
    imageEntries.push({ id: `img${pad(n)}`, name, ext: img.ext, blob: img.blob });
  }
  const imageHref = (key) => (hrefByKey.has(key) ? `../images/${hrefByKey.get(key)}` : null);

  chapters.forEach((c, i) => { c.file = `ch${pad(i + 1)}.xhtml`; });

  const files = [];
  files.push({ name: 'mimetype', data: 'application/epub+zip', store: true });
  files.push({
    name: 'META-INF/container.xml',
    data: `${XML_HEAD}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  });
  files.push({ name: 'OEBPS/styles/book.css', data: bookCss(style) });

  const spine = [];
  const manifest = [];

  if (cover) {
    files.push({ name: `OEBPS/images/cover.${cover.ext}`, data: cover.blob });
    manifest.push(`    <item id="cover-image" href="images/cover.${cover.ext}" media-type="${MEDIA[cover.ext]}" properties="cover-image"/>`);
    files.push({
      name: 'OEBPS/text/cover.xhtml',
      data: xhtml('Cover', 'cover', `  <div><img class="cover-image" src="../images/cover.${cover.ext}" alt="${esc(title)}"/></div>`),
    });
    manifest.push('    <item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('    <itemref idref="cover" linear="yes"/>');
  }

  const titleBody = [
    `  <h1 class="book-title">${esc(title)}</h1>`,
    book.subtitle ? `  <p class="book-subtitle">${esc(book.subtitle)}</p>` : '',
    '  <hr class="title-rule"/>',
    author ? `  <p class="book-author">${esc(author)}</p>` : '',
    publisher ? `  <p class="imprint">${esc(publisher)}</p>` : '',
  ].filter(Boolean).join('\n');
  files.push({ name: 'OEBPS/text/titlepage.xhtml', data: xhtml(title, 'titlepage', titleBody) });
  manifest.push('    <item id="titlepage" href="text/titlepage.xhtml" media-type="application/xhtml+xml"/>');
  spine.push('    <itemref idref="titlepage" linear="yes"/>');

  manifest.push('    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  manifest.push('    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');
  manifest.push('    <item id="css" href="styles/book.css" media-type="text/css"/>');
  spine.push('    <itemref idref="nav" linear="yes"/>');

  chapters.forEach((chapter, i) => {
    const cid = `ch${pad(i + 1)}`;
    const body = `<section class="chapter" epub:type="chapter" id="${cid}">\n${chapterBody(chapter, imageHref)}\n</section>`;
    files.push({ name: `OEBPS/text/${chapter.file}`, data: xhtml(chapter.title, 'chapter', body) });
    manifest.push(`    <item id="${cid}" href="text/${chapter.file}" media-type="application/xhtml+xml"/>`);
    spine.push(`    <itemref idref="${cid}" linear="yes"/>`);
  });

  for (const img of imageEntries) {
    files.push({ name: `OEBPS/images/${img.name}`, data: img.blob });
    manifest.push(`    <item id="${img.id}" href="images/${img.name}" media-type="${MEDIA[img.ext] || 'image/jpeg'}"/>`);
  }

  files.push({ name: 'OEBPS/nav.xhtml', data: navDocument(chapters, { hasCover: !!cover, hasTitlePage: true, title }) });
  files.push({ name: 'OEBPS/toc.ncx', data: ncxDocument(chapters, { id, title, author }) });

  const opf = `${XML_HEAD}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${esc(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${esc(id)}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:language>${esc(language)}</dc:language>
${author ? `    <dc:creator id="creator">${esc(author)}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>\n` : ''}${publisher ? `    <dc:publisher>${esc(publisher)}</dc:publisher>\n` : ''}${source ? `    <dc:source>${esc(source)}</dc:source>\n` : ''}    <dc:date>${modified}</dc:date>
    <meta property="dcterms:modified">${modified}</meta>
    <meta name="generator" content="PDF to EPUB"/>
${cover ? '    <meta name="cover" content="cover-image"/>\n' : ''}  </metadata>
  <manifest>
${manifest.join('\n')}
  </manifest>
  <spine toc="ncx">
${spine.join('\n')}
  </spine>
</package>
`;
  files.push({ name: 'OEBPS/package.opf', data: opf });

  // mimetype first, everything else after — the OCF spec is strict about this.
  const ordered = [files[0], ...files.slice(1)];
  const resolved = await Promise.all(ordered.map(async (f) => ({
    name: f.name,
    store: !!f.store,
    data: f.data instanceof Blob ? new Uint8Array(await f.data.arrayBuffer()) : f.data,
  })));

  return zip(resolved);
}
