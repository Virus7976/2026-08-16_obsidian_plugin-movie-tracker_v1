import React, { useEffect, useMemo, useState } from 'react';

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/** "in 7 hours", "in 40 minutes" — how long before this book is cleared. */
function expiresIn(expiresAt, now) {
  if (!expiresAt) return 'kept until you delete it';
  const left = expiresAt - now;
  if (left <= 0) return 'clearing now';
  const hours = Math.floor(left / 3600e3);
  if (hours >= 24) return `clears in ${Math.floor(hours / 24)} day${hours >= 48 ? 's' : ''}`;
  if (hours >= 1) return `clears in ${hours} hour${hours === 1 ? '' : 's'}`;
  return `clears in ${Math.max(1, Math.round(left / 60e3))} min`;
}

function Cover({ blob, title }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url
    ? <img className="shelf-cover" src={url} alt={`Cover of ${title}`} />
    : <div className="shelf-cover placeholder" aria-hidden="true">📕</div>;
}

export default function Library({ books, onDownload, onRead, onDelete, onClear, busyId }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60e3);
    return () => clearInterval(timer);
  }, []);

  if (!books.length) return null;

  return (
    <section className="shelf">
      <div className="jobs-head">
        <h2>Your library</h2>
        <button type="button" className="ghost small" onClick={onClear}>Clear all</button>
      </div>
      <p className="shelf-note">
        Saved on this device. Close the page whenever you like — they will be here when you come back.
      </p>

      {books.map((book) => (
        <article className="shelf-item" key={book.id}>
          <Cover blob={book.cover} title={book.title} />
          <div className="shelf-body">
            <strong>{book.title}</strong>
            <span className="shelf-meta">
              {book.author ? `${book.author} · ` : ''}{kb(book.size)}
              {book.encrypted && <span className="locked-tag" title="Encrypted on this device"> 🔒</span>}
            </span>
            <span className="shelf-expiry">{expiresIn(book.expiresAt, now)}</span>
            <div className="row">
              <button type="button" className="primary small" disabled={busyId === book.id}
                onClick={() => onDownload(book)}>
                {busyId === book.id ? 'Opening…' : 'Download'}
              </button>
              <button type="button" className="ghost small" onClick={() => onRead(book)}>Read</button>
              <button type="button" className="ghost small" onClick={() => onDelete(book)}>Delete</button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
