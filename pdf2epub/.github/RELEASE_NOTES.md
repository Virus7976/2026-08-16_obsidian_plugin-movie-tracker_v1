Converts a PDF into an EPUB that reads like a book: a cover, a title page, real
chapters, figures placed with their captions, and book typography — all done on
your own device, with nothing uploaded.

**On a phone**, open the hosted app and use *Add to Home screen* / *Install app*.
It then works offline and accepts PDFs shared from other apps.

**Offline copy**: download the `-web.zip` below, unzip it, and serve the folder
over HTTP (`python3 -m http.server 8000`, then open `http://localhost:8000`).
Browsers will not run it directly from `file://`.

### What it does

- Reads font size, weight and position to work out chapter titles, subheadings,
  captions and body text
- Rejoins lines into paragraphs, repairs hyphenation, and stitches paragraphs
  that straddle a page break
- Strips running heads, page numbers and repeated watermarks
- Reads two-column pages in the correct order
- Extracts figures — including charts drawn as vectors — and keeps their captions
- Produces a valid EPUB 3 with a working table of contents and an NCX for older
  readers

Scanned PDFs with no text layer become a page-image EPUB, with a note to run OCR
first if you want selectable text.
