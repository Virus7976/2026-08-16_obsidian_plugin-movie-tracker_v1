// Single place where the app wires up pdf.js and its side-car assets.
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const base = import.meta.env.BASE_URL || '/';

export const pdfAssets = {
  pdfjs: pdfjsLib,
  cMapUrl: `${base}pdfjs/cmaps/`,
  standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
};

export default pdfjsLib;
