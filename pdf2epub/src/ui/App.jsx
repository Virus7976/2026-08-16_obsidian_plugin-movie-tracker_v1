import React, { useCallback, useEffect, useRef, useState } from 'react';
import { convert, DEFAULTS } from '../engine/convert.js';
import { pdfAssets } from '../pdfjs.js';
import * as shelf from '../engine/shelf.js';
import { isLockSet, removeLock } from '../engine/vault.js';
import Dropzone from './Dropzone.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import JobCard from './JobCard.jsx';
import Library from './Library.jsx';
import Lock from './Lock.jsx';
import Reader from './Reader.jsx';

const STORAGE_KEY = 'pdf2epub.settings.v1';
const APP_DEFAULTS = { ...DEFAULTS, retention: '24h' };

function loadSettings() {
  try {
    return { ...APP_DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...APP_DEFAULTS };
  }
}

let nextId = 1;

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [jobs, setJobs] = useState([]);
  const [books, setBooks] = useState([]);
  const [reading, setReading] = useState(null);
  const [installEvent, setInstallEvent] = useState(null);
  const [locked, setLocked] = useState(() => isLockSet());
  const [settingLock, setSettingLock] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const shelfKey = useRef(null);
  const running = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  }, [settings]);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const refreshShelf = useCallback(async () => {
    try {
      setBooks(await shelf.listShelf(shelfKey.current));
    } catch (err) {
      console.error('library unavailable', err);
    }
  }, []);

  // Expired books go on load, and again while the page is left open.
  useEffect(() => {
    if (locked) return undefined;
    shelf.keepStored();
    refreshShelf();
    const timer = setInterval(() => refreshShelf(), 5 * 60e3);
    return () => clearInterval(timer);
  }, [locked, refreshShelf]);

  const addFiles = useCallback((files) => {
    const pdfs = [...files].filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!pdfs.length) return;
    setJobs((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        id: nextId++, file, name: file.name, size: file.size,
        status: 'queued', percent: 0, note: 'Waiting',
      })),
    ]);
  }, []);

  useEffect(() => {
    if (locked) return;
    if (!new URLSearchParams(location.search).has('shared')) return;
    (async () => {
      try {
        const cache = await caches.open('pdf2epub-shared');
        const res = await cache.match('/__shared-pdf__');
        if (res) {
          const name = decodeURIComponent(res.headers.get('x-filename') || 'shared.pdf');
          addFiles([new File([await res.blob()], name, { type: 'application/pdf' })]);
          await cache.delete('/__shared-pdf__');
        }
      } catch { /* nothing shared */ }
      history.replaceState(null, '', location.pathname);
    })();
  }, [addFiles, locked]);

  const patch = useCallback((id, fields) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...fields } : j)));
  }, []);

  useEffect(() => {
    if (locked || running.current) return;
    const next = jobs.find((j) => j.status === 'queued');
    if (!next) return;
    running.current = true;

    (async () => {
      patch(next.id, { status: 'running', percent: 1, note: 'Starting' });
      try {
        const buffer = await next.file.arrayBuffer();
        const result = await convert(
          buffer,
          { ...settings, ...pdfAssets, filename: next.name },
          (p) => patch(next.id, { percent: Math.round(p.percent), note: p.note || p.stage }),
        );
        patch(next.id, {
          status: 'done', percent: 100, note: 'Done', result,
          url: URL.createObjectURL(result.blob),
        });
        try {
          await shelf.saveBook(result, {
            retentionMs: shelf.RETENTIONS[settings.retention] ?? shelf.RETENTIONS['24h'],
            key: shelfKey.current,
          });
          await refreshShelf();
        } catch (err) {
          patch(next.id, { saveError: `Could not add it to the library: ${err.message}` });
        }
      } catch (err) {
        console.error(err);
        patch(next.id, { status: 'error', note: err?.message || String(err) });
      } finally {
        running.current = false;
        setJobs((prev) => [...prev]);
      }
    })();
  }, [jobs, settings, patch, locked, refreshShelf]);

  // ---------------------------------------------------------------- library

  const download = async (book) => {
    setBusyId(book.id);
    try {
      const opened = await shelf.openBook(book.id, shelfKey.current);
      if (!opened) return;
      const url = URL.createObjectURL(opened.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = opened.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30e3);
    } finally {
      setBusyId(null);
    }
  };

  const read = async (book) => {
    const opened = await shelf.openBook(book.id, shelfKey.current);
    if (opened) setReading({ blob: opened.blob, title: book.title });
  };

  const remove = async (book) => {
    await shelf.removeBook(book.id);
    await refreshShelf();
  };

  const clearAll = async () => {
    if (!confirm('Delete every book saved on this device?')) return;
    await shelf.clearShelf();
    await refreshShelf();
  };

  // ------------------------------------------------------------------- lock

  const onUnlocked = async (key) => {
    shelfKey.current = key;
    setLocked(false);
    setSettingLock(false);
    await refreshShelf();
  };

  const onLockCreated = async (key) => {
    shelfKey.current = key;
    setSettingLock(false);
    await shelf.encryptShelf(key);
    await refreshShelf();
  };

  const turnOffLock = async () => {
    if (!confirm('Turn off the passcode? Saved books will be stored unencrypted on this device.')) return;
    if (shelfKey.current) await shelf.decryptShelf(shelfKey.current);
    removeLock();
    shelfKey.current = null;
    await refreshShelf();
  };

  if (locked) return <Lock mode="unlock" onKey={onUnlocked} />;

  const busy = jobs.some((j) => j.status === 'running' || j.status === 'queued');

  return (
    <div className="app">
      <header className="masthead">
        <div className="wordmark">
          <span className="glyph" aria-hidden="true">📖</span>
          <div>
            <h1>PDF&nbsp;→&nbsp;EPUB</h1>
            <p>Laid out like a real book. Nothing leaves your device.</p>
          </div>
        </div>
        {installEvent && (
          <button type="button" className="ghost"
            onClick={() => { installEvent.prompt(); setInstallEvent(null); }}>
            Install app
          </button>
        )}
      </header>

      <main>
        <Dropzone onFiles={addFiles} busy={busy} />
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          disabled={busy}
          lockSet={isLockSet()}
          onSetLock={() => setSettingLock(true)}
          onRemoveLock={turnOffLock}
        />

        {jobs.length > 0 && (
          <section className="jobs">
            <div className="jobs-head">
              <h2>Converting</h2>
              {jobs.some((j) => j.status === 'done' || j.status === 'error') && (
                <button type="button" className="ghost small" onClick={() => setJobs((prev) => {
                  prev.filter((j) => j.url).forEach((j) => URL.revokeObjectURL(j.url));
                  return prev.filter((j) => j.status === 'running' || j.status === 'queued');
                })}>Clear finished</button>
              )}
            </div>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job}
                onRead={() => setReading({ blob: job.result.blob, title: job.result.report.title })} />
            ))}
          </section>
        )}

        <Library
          books={books}
          busyId={busyId}
          onDownload={download}
          onRead={read}
          onDelete={remove}
          onClear={clearAll}
        />

        <section className="explainer">
          <h2>What it actually does</h2>
          <ul>
            <li><strong>Reads the layout, not just the text.</strong> Font sizes, weights and positions decide what is a chapter title, a subheading, a caption or body text.</li>
            <li><strong>Rebuilds paragraphs.</strong> Line breaks are undone, hyphenated words rejoined, and paragraphs that straddle a page are stitched back together.</li>
            <li><strong>Strips page furniture.</strong> Running heads, folios and repeated watermarks are detected across the book and removed.</li>
            <li><strong>Keeps the pictures.</strong> Figures are located in the page's drawing operations, cut out at print resolution, and placed back where they belong — with their captions.</li>
            <li><strong>Builds a real book.</strong> Cover, title page, chapter files, a working table of contents, and typography with indents, drop caps and justified text.</li>
          </ul>
        </section>
      </main>

      <footer>
        <p>Everything runs in this browser tab — no upload, no account, works offline once loaded.</p>
      </footer>

      {settingLock && (
        <Lock mode="create" onKey={onLockCreated} onCancel={() => setSettingLock(false)} />
      )}
      {reading && <Reader blob={reading.blob} onClose={() => setReading(null)} />}
    </div>
  );
}
