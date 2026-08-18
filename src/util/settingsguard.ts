/**
 * The two decisions that stand between an update and a lost API key.
 *
 * Both live here as plain functions rather than inside the plugin class,
 * because the failure they prevent is unrecoverable and needs a test that does
 * not require booting Obsidian to run.
 *
 * The bug they exist for: `loadData()` returns null both when there is no file
 * yet and when the file could not be read or parsed. Treating the second as the
 * first meant falling back to defaults — where the encrypted key blob is null —
 * and the next ordinary save (switching tabs writes `lastTab`) wrote that null
 * over the real thing.
 */

/**
 * May we write settings at all?
 *
 * Only when the read genuinely succeeded. A null result with a file present on
 * disk is a *failed* read wearing the same clothes as a fresh install, and
 * saving over it destroys whatever we could not parse.
 */
export function canPersist(opts: { read: boolean; stored: unknown; fileExists: boolean }): boolean {
	if (!opts.read) return false;
	if (opts.stored === null && opts.fileExists) return false;
	return true;
}

/**
 * Keep a credential that a save would otherwise blank.
 *
 * Returns the object to write. Unknown keys from the stored copy are carried
 * across so a field written by a newer version survives a run under an older
 * one — an unrecognised key is somebody's data, not litter.
 *
 * `clearingKeys` is the caller stating it means it: switching to session-only
 * storage, or "forget my keys". Everywhere else, a credential going from a
 * value to nothing is treated as a bug and refused.
 */
export function mergeForSave<T extends Record<string, unknown>>(
	next: T,
	stored: Record<string, unknown>,
	clearingKeys = false
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...stored, ...next };
	if (clearingKeys) return out;

	for (const field of ["keyBlob", "keysPlain"] as const) {
		const had = stored[field] != null;
		const going = out[field] == null;
		if (had && going) out[field] = stored[field];
	}
	return out;
}
