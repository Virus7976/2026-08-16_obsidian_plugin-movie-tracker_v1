import React, { useEffect, useState } from 'react';
import { openBook } from '../engine/unzip.js';

// A light preview shell so the sample reads the way an e-reader would show it.
const SHELL = `
  html { background: #efe9df; }
  body { max-width: 34em; margin: 0 auto; padding: 2.2em 1.4em 4em; color: #20242a; background: #fbf7f0;
         box-shadow: 0 0 40px rgba(0,0,0,.08); min-height: 100vh; box-sizing: border-box; }
  @media (prefers-color-scheme: dark) {
    html { background: #14171b; }
    body { background: #1b1f24; color: #e7e2d9; box-shadow: none; }
    .title-rule { opacity: .35; }
  }
  img { max-width: 100%; height: auto; }
`;

export default function Reader({ job, onClose }) {
  const [book, setBook] = useState(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    let opened = null;
    openBook(job.result.blob)
      .then((b) => { if (live) { opened = b; setBook(b); } else b.release(); })
      .catch((e) => live && setError(e.message));
    return () => { live = false; if (opened) opened.release(); };
  }, [job]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, (book?.docs.length || 1) - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book, onClose]);

  const doc = book?.docs[index];
  const srcDoc = doc
    ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
       <style>${book.css}\n${SHELL}</style></head><body class="${doc.bodyClass}">${doc.html}</body></html>`
    : '';

  return (
    <div className="reader" role="dialog" aria-modal="true" aria-label="Book preview">
      <div className="reader-bar">
        <button type="button" className="ghost small" onClick={onClose}>Close</button>
        {book && (
          <select value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Section">
            {book.docs.map((d, i) => <option key={i} value={i}>{d.title}</option>)}
          </select>
        )}
        <div className="reader-nav">
          <button type="button" className="ghost small" disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}>‹</button>
          <button type="button" className="ghost small" disabled={!book || index >= book.docs.length - 1}
            onClick={() => setIndex((i) => Math.min(i + 1, book.docs.length - 1))}>›</button>
        </div>
      </div>
      {error && <p className="error">Preview failed: {error}</p>}
      {!book && !error && <p className="loading">Opening the book…</p>}
      {doc && <iframe title="Book preview" sandbox="allow-same-origin" srcDoc={srcDoc} />}
    </div>
  );
}
