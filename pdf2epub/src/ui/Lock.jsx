import React, { useState } from 'react';
import { createLock, unlock, isLockSet } from '../engine/vault.js';

/**
 * Shown before the library when a passcode is set, and used to set one.
 * The passcode never leaves this device — it derives the key that encrypts
 * the saved books, so there is nothing to recover if it is forgotten.
 */
export default function Lock({ mode, onKey, onCancel }) {
  const setting = mode === 'create';
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (setting) {
        if (passcode !== confirm) throw new Error('The two entries do not match.');
        onKey(await createLock(passcode));
      } else {
        const key = await unlock(passcode);
        if (!key) throw new Error('That passcode does not match.');
        onKey(key);
      }
    } catch (err) {
      setError(err.message || String(err));
      setPasscode('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lock">
      <form className="lock-card" onSubmit={submit}>
        <span className="lock-glyph" aria-hidden="true">🔒</span>
        <h2>{setting ? 'Set a passcode' : 'Your library is locked'}</h2>
        <p>
          {setting
            ? 'Your saved books are encrypted with this passcode. It stays on this device, and there is no way to recover it — write it down somewhere.'
            : 'Enter the passcode to open the books saved on this device.'}
        </p>

        <input
          type="password"
          inputMode="text"
          autoComplete={setting ? 'new-password' : 'current-password'}
          placeholder="Passcode"
          value={passcode}
          autoFocus
          onChange={(e) => setPasscode(e.target.value)}
        />
        {setting && (
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Passcode again"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}

        {error && <p className="error">{error}</p>}

        <div className="lock-actions">
          {onCancel && (
            <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
          )}
          <button type="submit" className="primary" disabled={busy || passcode.length < 4}>
            {busy ? 'Working…' : setting ? 'Turn on the lock' : 'Unlock'}
          </button>
        </div>

        {!setting && isLockSet() && (
          <p className="lock-note">
            Forgotten it? The books cannot be decrypted without it — you would have to
            clear the library in settings and convert again.
          </p>
        )}
      </form>
    </div>
  );
}
