// The reader stylesheet. Aims at the conventions of a printed book:
// justified measure, indented paragraphs (except after a break), chapter
// openers on a fresh page, restrained figure treatment.

const FAMILIES = {
  serif: "Iowan Old Style, Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, 'Times New Roman', serif",
  sans: "Seravek, 'Helvetica Neue', Helvetica, Arial, 'Segoe UI', Roboto, sans-serif",
  system: "serif",
};

export function bookCss({ family = 'serif', justify = true, dropCaps = true } = {}) {
  return `@charset "utf-8";

html {
  font-size: 100%;
}

body {
  font-family: ${FAMILIES[family] || FAMILIES.serif};
  line-height: 1.5;
  margin: 0 5%;
  text-align: ${justify ? 'justify' : 'left'};
  -webkit-hyphens: auto;
  -epub-hyphens: auto;
  hyphens: auto;
  widows: 2;
  orphans: 2;
}

/* ------------------------------------------------------------- structure */

section.chapter {
  page-break-before: always;
  break-before: page;
}

h1, h2, h3, h4 {
  font-weight: normal;
  text-align: center;
  line-height: 1.25;
  -webkit-hyphens: none;
  hyphens: none;
  page-break-after: avoid;
  break-after: avoid;
}

h1.chapter-title {
  margin: 2.6em 0 0.2em;
  font-size: 1.6em;
  letter-spacing: 0.02em;
}

h2 { margin: 1.8em 0 0.6em; font-size: 1.25em; }
h3 { margin: 1.5em 0 0.5em; font-size: 1.1em; font-style: italic; }
h4 { margin: 1.3em 0 0.4em; font-size: 1em; letter-spacing: 0.06em; text-transform: uppercase; }

h1 .subtitle {
  display: block;
  font-size: 0.62em;
  font-style: italic;
  letter-spacing: 0;
  margin-top: 0.7em;
}

/* ------------------------------------------------------------ paragraphs */

p {
  margin: 0;
  text-indent: 1.2em;
}

p.opening,
h1 + p, h2 + p, h3 + p, h4 + p,
blockquote + p.after-break,
figure + p {
  text-indent: 0;
}

p.opening { margin-top: 1em; }

p.centered {
  text-indent: 0;
  text-align: center;
  margin: 1.2em 0;
}

p.scene-break {
  text-indent: 0;
  text-align: center;
  margin: 1.4em 0;
  letter-spacing: 0.6em;
  font-size: 0.9em;
}

${dropCaps ? `
.dropcap {
  float: left;
  font-size: 3.1em;
  line-height: 0.82;
  padding: 0.04em 0.08em 0 0;
  margin-right: 0.02em;
}
` : `.dropcap { font-size: 1em; }`}

/* ---------------------------------------------------------------- quotes */

blockquote {
  margin: 1.2em 1.6em;
  font-size: 0.95em;
  text-indent: 0;
}

blockquote p { text-indent: 0; margin-bottom: 0.6em; }

/* --------------------------------------------------------------- figures */

figure {
  margin: 1.6em 0;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}

figure img {
  max-width: 100%;
  max-height: 88vh;
  height: auto;
  width: auto;
}

figcaption {
  margin-top: 0.5em;
  font-size: 0.82em;
  font-style: italic;
  text-align: center;
  text-indent: 0;
  line-height: 1.35;
}

/* ----------------------------------------------------------------- lists */

ul, ol { margin: 1em 0 1em 1.4em; padding: 0; text-align: left; }
li { margin-bottom: 0.35em; text-indent: 0; }

/* ----------------------------------------------------------------- notes */

section.notes {
  margin-top: 2.4em;
  font-size: 0.84em;
  border-top: 1px solid rgba(128, 128, 128, 0.4);
  padding-top: 0.9em;
}

section.notes h4 { text-align: left; margin: 0 0 0.6em; }
section.notes p { text-indent: 0; margin-bottom: 0.5em; }

/* ------------------------------------------------------ cover and title */

body.cover, body.titlepage { text-align: center; margin: 0; }

body.cover { padding: 0; }

.cover-image {
  max-width: 100%;
  max-height: 100vh;
  width: auto;
  height: auto;
}

body.titlepage { margin: 0 8%; }

.book-title {
  margin-top: 22%;
  font-size: 2.1em;
  line-height: 1.15;
  font-weight: normal;
  -webkit-hyphens: none;
  hyphens: none;
}

.book-subtitle {
  margin-top: 0.9em;
  font-size: 1.05em;
  font-style: italic;
}

.title-rule {
  width: 26%;
  margin: 1.8em auto;
  border: 0;
  border-top: 1px solid currentColor;
  opacity: 0.5;
}

.book-author {
  font-size: 1.15em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.imprint {
  margin-top: 3.5em;
  font-size: 0.8em;
  opacity: 0.75;
  letter-spacing: 0.08em;
}

@media (prefers-color-scheme: dark) {
  section.notes { border-top-color: rgba(160, 160, 160, 0.4); }
}
`;
}
