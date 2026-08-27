"""A deliberately awkward PDF: no bookmarks, two-column pages, a vector chart,
footnotes, hyphenated line breaks, drop caps and a scene break."""
import sys, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rlcanvas

W, H = A4
M = 18 * mm
BODY = 10
LEAD = 13.4
TITLE = "Notes on Tidal Engineering"
AUTHOR = "E. R. Halloway"

P1 = ("Every estuary keeps its own clock. The tide that reaches the quay at noon has "
      "already turned twice in the deep channel, and the difference between those two "
      "moments is the whole of the engineer's problem. ")
P2 = ("Measurements taken in the winter of that year showed a consistent lag of forty "
      "minutes, which the committee attributed to silting, though no survey had been "
      "carried out since the previous decade. ")

def wrap(c, text, x, y, width, size=BODY, lead=LEAD, font="Times-Roman", indent=0, first_indent=True):
    c.setFont(font, size)
    words, line, first = text.split(), "", True
    while words:
        w = words.pop(0)
        trial = (line + " " + w).strip()
        avail = width - (indent if (first and first_indent) else 0)
        if c.stringWidth(trial, font, size) > avail and line:
            c.drawString(x + (indent if (first and first_indent) else 0), y, line)
            y -= lead; first = False; line = w
        else:
            line = trial
    if line:
        c.drawString(x + (indent if (first and first_indent) else 0), y, line)
        y -= lead
    return y

def furniture(c, page):
    c.setFont("Helvetica", 8)
    c.drawString(M, H - M + 14, TITLE.upper())
    c.drawRightString(W - M, M - 20, str(page))

def chart(c, x, y, w, h):
    """A bar chart drawn as vectors — no embedded image anywhere."""
    c.setLineWidth(0.8)
    c.line(x, y, x, y + h); c.line(x, y, x + w, y)
    values = [0.35, 0.62, 0.48, 0.81, 0.55, 0.7]
    bw = w / (len(values) * 1.6)
    for i, v in enumerate(values):
        bx = x + 10 + i * bw * 1.6
        c.setFillGray(0.45 if i % 2 else 0.25)
        c.rect(bx, y + 1, bw, h * v, stroke=0, fill=1)
        c.setFillGray(0)
        c.setFont("Helvetica", 6)
        c.drawCentredString(bx + bw / 2, y - 8, str(1998 + i))
    for g in range(1, 4):
        c.setStrokeGray(0.8)
        c.line(x, y + h * g / 4, x + w, y + h * g / 4)
    c.setStrokeGray(0)

def main(out):
    c = rlcanvas.Canvas(out, pagesize=A4)
    c.setTitle("Microsoft Word - tidal_notes_FINAL_v3.doc")   # deliberately junk metadata

    # title page, author given as "by ..."
    c.setFont("Helvetica-Bold", 24); c.drawCentredString(W/2, H - 70*mm, TITLE)
    c.setFont("Helvetica", 12); c.drawCentredString(W/2, H - 82*mm, "Three Studies of the Lower Channel")
    c.setFont("Helvetica", 11); c.drawCentredString(W/2, H - 110*mm, f"by {AUTHOR}")
    c.setFont("Helvetica", 8); c.drawCentredString(W/2, 40*mm, "THE COASTAL PRESS")
    c.showPage()

    page = 2
    for ci, name in enumerate(["The Lag of the Channel", "Silt and Its Measurement", "A Proposal"]):
        # chapter opener with a drop cap and a footnote
        c.setFont("Helvetica-Bold", 16)
        c.drawString(M, H - M - 30, f"{ci + 1}. {name}")
        y = H - M - 62
        c.setFont("Times-Roman", 26)
        c.drawString(M, y - 8, P1[0])                       # drop cap
        first_w = c.stringWidth(P1[0], "Times-Roman", 26)
        y = wrap(c, P1[1:], M + first_w + 2, y, W - 2*M - first_w - 2, first_indent=False)
        y = wrap(c, P2 * 2, M, y, W - 2*M, indent=14)
        y -= 6
        c.setFont("Times-Roman", BODY)
        # a hyphenated break across two lines
        c.drawString(M, y, "The commissioners were unwilling to fund a second hydro-")
        y -= LEAD
        c.drawString(M, y, "graphic survey before the spring, and the matter was deferred.")
        y -= LEAD * 2
        c.setFont("Times-Roman", 11)
        c.drawCentredString(W/2, y, "* * *")
        y -= LEAD * 2
        y = wrap(c, P1 * 2, M, y, W - 2*M, indent=14)
        # footnote block at the foot of the page
        c.setStrokeGray(0.6); c.line(M, M + 46, M + 120, M + 46)
        wrap(c, "1. Committee minutes, 14 March. The figure is disputed in the appendix.",
             M, M + 34, W - 2*M, size=7.6, lead=9.5)
        furniture(c, page); c.showPage(); page += 1

        # two-column page with a numbered list
        col = (W - 2*M - 8*mm) / 2
        y1 = wrap(c, P2 * 3, M, H - M - 20, col)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(M, y1 - 10, "OBSERVED DEVIATIONS")
        y1 -= 26
        for i, item in enumerate(["forty minutes at the quay",
                                  "twelve minutes in the deep channel",
                                  "no measurable change at the bar"], 1):
            c.setFont("Times-Roman", BODY)
            c.drawString(M, y1, f"{i}.")
            y1 = wrap(c, item, M + 14, y1, col - 14)
        wrap(c, P1 * 3, M + col + 8*mm, H - M - 20, col)
        furniture(c, page); c.showPage(); page += 1

        # page led by a vector chart with a caption
        chart(c, M + 20, H - M - 150, W - 2*M - 40, 110)
        c.setFont("Times-Italic", 8.5)
        c.drawCentredString(W/2, H - M - 168, f"Figure {ci + 1}: Recorded lag at the quay, by year.")
        wrap(c, P2 * 4, M, H - M - 195, W - 2*M, indent=14)
        furniture(c, page); c.showPage(); page += 1

    c.save()
    print("wrote", out)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "test/fixtures/hard-sample.pdf")
