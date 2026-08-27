"""Generate a book-like sample PDF for testing the converter."""
import sys, os, random
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as rlcanvas
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw

W, H = letter
M = 1.0 * inch
BODY = 11
LEAD = 15.5

LOREM = ("The lighthouse keeper had counted the ships for thirty-one years, and in all that time "
         "he had never once seen the harbour empty. There was always something out there, a hull "
         "or a mast or the small red eye of a running light, moving against the grey. He wrote the "
         "numbers in a ledger bound in green cloth, and when the ledger was full he began another, "
         "and the years stacked up on the shelf above the stove like cordwood. ")
LOREM2 = ("In winter the fog came in so thick that the beam seemed to end a few feet from the glass, "
          "and he would stand at the rail listening for the bell buoy, which rang irregularly, as "
          "though someone out in the water were pulling the rope by hand. ")

def make_photo(path, w=900, h=600, seed=3):
    random.seed(seed)
    img = Image.new("RGB", (w, h), (240, 238, 232))
    d = ImageDraw.Draw(img)
    for i in range(h):
        t = i / h
        d.line([(0, i), (w, i)], fill=(int(120+90*t), int(140+80*t), int(170+60*t)))
    d.polygon([(0, h), (w*0.3, h*0.45), (w*0.55, h), ], fill=(70, 85, 95))
    d.polygon([(w*0.45, h), (w*0.75, h*0.3), (w, h)], fill=(50, 62, 72))
    d.ellipse([w*0.72, h*0.12, w*0.86, h*0.26], fill=(250, 244, 220))
    img.save(path, quality=92)

def wrap(c, text, x, y, width, size=BODY, lead=LEAD, font="Times-Roman", indent=0):
    c.setFont(font, size)
    words = text.split()
    line, first = "", True
    while words:
        w = words.pop(0)
        trial = (line + " " + w).strip()
        avail = width - (indent if first else 0)
        if c.stringWidth(trial, font, size) > avail and line:
            c.drawString(x + (indent if first else 0), y, line)
            y -= lead
            first = False
            line = w
        else:
            line = trial
    if line:
        c.drawString(x + (indent if first else 0), y, line)
        y -= lead
    return y

def header(c, page, title, chap):
    c.setFont("Times-Italic", 9)
    if page % 2 == 0:
        c.drawString(M, H - M + 22, title)
    else:
        c.drawRightString(W - M, H - M + 22, chap)
    c.setFont("Times-Roman", 9)
    c.drawCentredString(W / 2, M - 34, str(page))

def main(out):
    photo = os.path.join(os.path.dirname(out), "_sample_photo.jpg")
    make_photo(photo)
    c = rlcanvas.Canvas(out, pagesize=letter)
    c.setTitle("The Keeper of Small Lights")
    c.setAuthor("Marguerite Vale")
    c.setSubject("A novel")

    # --- Title page ---
    c.setFont("Times-Bold", 30)
    c.drawCentredString(W/2, H - 3.2*inch, "The Keeper")
    c.drawCentredString(W/2, H - 3.2*inch - 36, "of Small Lights")
    c.setFont("Times-Italic", 14)
    c.drawCentredString(W/2, H - 4.6*inch, "A Novel")
    c.setFont("Times-Roman", 15)
    c.drawCentredString(W/2, 2.4*inch, "MARGUERITE VALE")
    c.setFont("Times-Roman", 10)
    c.drawCentredString(W/2, 1.7*inch, "HARBOUR & SON")
    c.showPage()

    page = 2
    chapters = [("Chapter One", "The Green Ledger"), ("Chapter Two", "Fog"), ("Chapter Three", "The Bell Buoy")]
    for ci, (num, name) in enumerate(chapters):
        # chapter opener page
        c.bookmarkPage(f"ch{ci}")
        c.addOutlineEntry(f"{num}: {name}", f"ch{ci}", level=0)
        y = H - 2.8*inch
        c.setFont("Times-Bold", 20)
        c.drawCentredString(W/2, y, num)
        y -= 34
        c.setFont("Times-Bold", 15)
        c.drawCentredString(W/2, y, name)
        y -= 46
        y = wrap(c, LOREM * 2, M, y, W - 2*M)
        y -= 4
        y = wrap(c, LOREM2 * 2, M, y, W - 2*M, indent=18)
        header(c, page, "The Keeper of Small Lights", name)
        c.showPage(); page += 1

        # text page with subheading, list, blockquote
        y = H - M
        c.setFont("Times-Bold", 12.5)
        c.drawString(M, y, "A Note on the Instruments")
        y -= 26
        y = wrap(c, LOREM, M, y, W - 2*M)
        y -= 8
        for item in ["the brass sextant, unused since the war",
                     "a barometer with a cracked face",
                     "three lamps and a tin of wicks"]:
            c.setFont("Times-Roman", BODY)
            c.drawString(M + 14, y, "•")
            y = wrap(c, item, M + 30, y, W - 2*M - 30)
            y -= 2
        y -= 10
        c.setFont("Times-Italic", 10)
        y = wrap(c, "Nothing is ever lost at sea, only relocated by the weather.",
                 M + 40, y, W - 2*M - 80, size=10, lead=13, font="Times-Italic")
        y -= 14
        y = wrap(c, LOREM2 * 2, M, y, W - 2*M, indent=18)
        header(c, page, "The Keeper of Small Lights", name); c.showPage(); page += 1

        # page with a figure + caption
        y = H - M
        y = wrap(c, LOREM, M, y, W - 2*M)
        y -= 16
        ih = 2.6*inch; iw = 3.9*inch
        c.drawImage(ImageReader(photo), (W-iw)/2, y-ih, width=iw, height=ih)
        y -= ih + 14
        c.setFont("Times-Italic", 9)
        c.drawCentredString(W/2, y, f"Figure {ci+1}. The north light, seen from the breakwater.")
        y -= 22
        y = wrap(c, LOREM2 * 2, M, y, W - 2*M, indent=18)
        header(c, page, "The Keeper of Small Lights", name); c.showPage(); page += 1
    c.save()
    os.remove(photo)
    print("wrote", out)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sample.pdf")
