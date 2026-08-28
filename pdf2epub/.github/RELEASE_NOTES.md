Converts a PDF into an EPUB that reads like a book: a cover, a title page, real
chapters, figures placed with their captions, and book typography — all done on
your own device, with nothing uploaded.

**On a phone**, open the hosted app and use *Add to Home screen* / *Install app*.
It then works offline and accepts PDFs shared from other apps.

**Offline copy**: download the `-web.zip` below, unzip it, and serve the folder
over HTTP (`python3 -m http.server 8000`, then open `http://localhost:8000`).
Browsers will not run it directly from `file://`.

### New in v1.1.0 — your library

Converted books are now kept on the device. Start a conversion, and once it
finishes you can close the page: the EPUB is waiting when you come back. Each
book shows how long it has left — a day by default, or six hours, three days, or
until you delete it.

An optional **passcode lock** encrypts everything saved, with a key derived from
your passcode (PBKDF2-SHA256 → AES-GCM-256). With it on, the browser's storage
holds nothing readable: no titles, no covers, no files. It is a lock on this
device, not an account — the library does not follow you to another phone, and a
forgotten passcode cannot be recovered.

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
