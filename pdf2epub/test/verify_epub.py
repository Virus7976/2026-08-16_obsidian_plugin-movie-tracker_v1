#!/usr/bin/env python3
"""Structural and editorial checks on a generated EPUB."""
import sys, zipfile, re
from xml.etree import ElementTree as ET

NS = {
    'opf': 'http://www.idpf.org/2007/opf',
    'dc': 'http://purl.org/dc/elements/1.1/',
    'x': 'http://www.w3.org/1999/xhtml',
    'ncx': 'http://www.daisy.org/z3986/2005/ncx/',
}

fails, passes = [], []
def check(name, ok, detail=''):
    (passes if ok else fails).append(name)
    print(f"{'  ok  ' if ok else ' FAIL '} {name}" + (f" — {detail}" if detail else ''))

path = sys.argv[1]
z = zipfile.ZipFile(path)

names = z.namelist()
check('mimetype is the first entry', names[0] == 'mimetype', names[0])
info = z.getinfo('mimetype')
check('mimetype is stored uncompressed', info.compress_type == zipfile.ZIP_STORED)
check('mimetype content', z.read('mimetype') == b'application/epub+zip')
check('zip integrity', z.testzip() is None)

container = ET.fromstring(z.read('META-INF/container.xml'))
opf_path = container[0][0].get('full-path')
check('container points at the package', opf_path.endswith('.opf'), opf_path)

base = opf_path.rsplit('/', 1)[0] + '/' if '/' in opf_path else ''
opf = ET.fromstring(z.read(opf_path))
meta = opf.find('opf:metadata', NS)
title = meta.findtext('dc:title', namespaces=NS)
author = meta.findtext('dc:creator', namespaces=NS)
check('has a title', bool(title and title.strip() and title != 'Untitled'), repr(title))
check('has an author', bool(author and author.strip()), repr(author))
check('has dcterms:modified', any(m.get('property') == 'dcterms:modified' for m in meta.findall('opf:meta', NS)))

manifest = {i.get('id'): i for i in opf.find('opf:manifest', NS)}
missing = [i.get('href') for i in manifest.values() if base + i.get('href') not in names]
check('every manifest item exists in the archive', not missing, str(missing[:3]))

spine = [r.get('idref') for r in opf.find('opf:spine', NS)]
check('spine is non-empty', len(spine) >= 2, f'{len(spine)} documents')
check('spine only references manifest ids', all(s in manifest for s in spine))
check('nav document is declared', any('nav' in (i.get('properties') or '') for i in manifest.values()))
check('ncx present for older readers', any(i.get('media-type') == 'application/x-dtbncx+xml' for i in manifest.values()))

xhtml_docs = [base + manifest[s].get('href') for s in spine if 'xhtml' in (manifest[s].get('media-type') or '')]
bad_xml = []
body_text = ''
chapter_docs = []
for doc in xhtml_docs:
    raw = z.read(doc)
    try:
        tree = ET.fromstring(raw)
    except ET.ParseError as e:
        bad_xml.append(f'{doc}: {e}')
        continue
    body = tree.find('x:body', NS)
    text = ' '.join(t for t in (body.itertext() if body is not None else []))
    body_text += ' ' + text
    if '/ch' in doc:
        chapter_docs.append((doc, tree, ' '.join((body.itertext() if body is not None else []))))
check('every XHTML document is well-formed XML', not bad_xml, '; '.join(bad_xml[:2]))
check('no undefined HTML entities', not re.search(rb'&(?!amp;|lt;|gt;|quot;|apos;|#)', b''.join(z.read(d) for d in xhtml_docs)))

check('chapters were produced', len(chapter_docs) >= 1, f'{len(chapter_docs)} chapter files')
headings = sum(len(t.findall('.//x:h1', NS)) + len(t.findall('.//x:h2', NS)) for _, t, _ in chapter_docs)
check('headings survived', headings >= 1, f'{headings} headings')

paras = sum(len(t.findall('.//x:p', NS)) for _, t, _ in chapter_docs)
check('paragraphs were rebuilt', paras >= 3, f'{paras} paragraphs')

imgs = [i for i in manifest.values() if (i.get('media-type') or '').startswith('image/')]
check('images carried over', len(imgs) >= 1, f'{len(imgs)} images')
figures = sum(len(t.findall('.//x:figure', NS)) for _, t, _ in chapter_docs)
captions = sum(len(t.findall('.//x:figcaption', NS)) for _, t, _ in chapter_docs)

toc = [d for d in xhtml_docs if d.endswith('nav.xhtml')]
nav = ET.fromstring(z.read(base + 'nav.xhtml'))
links = nav.findall('.//x:nav/x:ol/x:li/x:a', NS)
check('table of contents has entries', len(links) >= 1, f'{len(links)} entries')
hrefs_ok = all((base + a.get('href').split('#')[0]) in names for a in links)
check('every TOC link resolves', hrefs_ok)

# ---- editorial quality -------------------------------------------------
expectations = sys.argv[2] if len(sys.argv) > 2 else None
if expectations == 'sample':
    check('title read from the PDF', title == 'The Keeper of Small Lights', repr(title))
    check('author read from the PDF', author == 'Marguerite Vale', repr(author))
    check('three chapters found', len(chapter_docs) == 3, f'{len(chapter_docs)}')
    check('figures placed with captions', figures >= 3 and captions >= 3, f'{figures} figures / {captions} captions')

    # Running heads repeated the book title on every page; body text should not.
    stray_folio = re.findall(r'(?<![\w])\b(?:[2-9]|1[0-9])\b(?=\s*(?:The Keeper|$))', body_text)
    check('page numbers stripped', len(stray_folio) == 0, str(stray_folio[:5]))
    chapter_text = ' '.join(t for _, _, t in chapter_docs)
    title_hits = chapter_text.count('The Keeper of Small Lights')
    check('running heads stripped', title_hits <= 1, f'{title_hits} occurrences left in the text')

    # Paragraphs must be reflowed, not one <p> per printed line.
    line_like = 0
    for _, tree, _ in chapter_docs:
        quoted = {p for p in tree.findall('.//x:blockquote//x:p', NS)}
        for p in tree.findall('.//x:p', NS):
            if p in quoted or p.get('class') in ('scene-break', 'centered'):
                continue
            t = ''.join(p.itertext()).strip()
            if 40 < len(t) < 95:
                line_like += 1
    check('lines were joined into paragraphs', line_like <= 2, f'{line_like} paragraph(s) look like single lines')

    joined = 'cordwood' in body_text and 'ledger' in body_text
    check('body prose intact', joined)
    check('bulleted list preserved',
          any(len(t.findall('.//x:ul/x:li', NS)) >= 3 for _, t, _ in chapter_docs))
    check('block quotation preserved',
          any(len(t.findall('.//x:blockquote', NS)) >= 1 for _, t, _ in chapter_docs))
    check('hyphenation across lines repaired', ' - ' not in body_text and not re.search(r'\w- \w', body_text))

print(f"\n{len(passes)}/{len(passes) + len(fails)} EPUB checks passed")
sys.exit(1 if fails else 0)
