import React, { useState } from 'react';

const Row = ({ label, help, children }) => (
  <label className="setting">
    <span className="setting-text">
      <span className="setting-label">{label}</span>
      {help && <span className="setting-help">{help}</span>}
    </span>
    {children}
  </label>
);

export default function SettingsPanel({ settings, onChange, disabled, lockSet, onSetLock, onRemoveLock }) {
  const [open, setOpen] = useState(false);
  const set = (key) => (value) => onChange({ ...settings, [key]: value });

  return (
    <section className="settings">
      <button type="button" className="settings-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>Book settings</span>
        <span className={`chev${open ? ' open' : ''}`} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="settings-body">
          <Row label="Typeface" help="How the finished book reads">
            <select value={settings.family} disabled={disabled}
              onChange={(e) => set('family')(e.target.value)}>
              <option value="serif">Serif (book)</option>
              <option value="sans">Sans serif</option>
              <option value="system">Reader default</option>
            </select>
          </Row>

          <Row label="Cover" help="Artwork for the shelf">
            <select value={settings.cover} disabled={disabled}
              onChange={(e) => set('cover')(e.target.value)}>
              <option value="auto">Automatic</option>
              <option value="firstpage">First page of the PDF</option>
              <option value="generated">Designed from the title</option>
              <option value="none">No cover</option>
            </select>
          </Row>

          <Row label="Chapters from" help="Where chapter breaks come from">
            <select value={settings.chaptersFrom} disabled={disabled}
              onChange={(e) => set('chaptersFrom')(e.target.value)}>
              <option value="auto">Automatic</option>
              <option value="outline">The PDF's bookmarks</option>
              <option value="headings">Detected headings</option>
              <option value="single">One long chapter</option>
            </select>
          </Row>

          <Row label="Picture quality" help="Higher is sharper and larger">
            <select value={String(settings.imageScale)} disabled={disabled}
              onChange={(e) => set('imageScale')(Number(e.target.value))}>
              <option value="1.5">Compact</option>
              <option value="2">Standard</option>
              <option value="3">High</option>
            </select>
          </Row>

          <Row label="Justified text" help="Straight right margin, as in print">
            <input type="checkbox" checked={settings.justify} disabled={disabled}
              onChange={(e) => set('justify')(e.target.checked)} />
          </Row>

          <Row label="Drop caps" help="Large opening letter on each chapter">
            <input type="checkbox" checked={settings.dropCaps} disabled={disabled}
              onChange={(e) => set('dropCaps')(e.target.checked)} />
          </Row>

          <Row label="Include pictures" help="Photographs and figures from the pages">
            <input type="checkbox" checked={settings.includeImages} disabled={disabled}
              onChange={(e) => set('includeImages')(e.target.checked)} />
          </Row>

          <Row label="Charts and diagrams" help="Also capture artwork drawn with vectors">
            <input type="checkbox" checked={settings.vectorFigures} disabled={disabled || !settings.includeImages}
              onChange={(e) => set('vectorFigures')(e.target.checked)} />
          </Row>

          <h3 className="settings-group">Your library</h3>

          <Row label="Keep books for" help="Saved on this device, then cleared automatically">
            <select value={settings.retention} disabled={disabled}
              onChange={(e) => set('retention')(e.target.value)}>
              <option value="6h">6 hours</option>
              <option value="24h">A day</option>
              <option value="3d">Three days</option>
              <option value="never">Until I delete them</option>
            </select>
          </Row>

          <Row label="Passcode lock" help={lockSet
            ? 'Saved books are encrypted on this device'
            : 'Encrypt saved books and ask for a passcode'}>
            {lockSet
              ? <button type="button" className="ghost small" onClick={onRemoveLock}>Turn off</button>
              : <button type="button" className="ghost small" onClick={onSetLock}>Set up</button>}
          </Row>
        </div>
      )}
    </section>
  );
}
