/**
 * Which cached posters are safe to remove.
 *
 * Kept pure and separate from the vault because it decides what to delete,
 * and a decision like that should be provable without a filesystem. The one
 * rule that matters: an empty library is never treated as "nothing is
 * referenced" — the index reads empty while it is still building and after a
 * failed build, and in both cases the answer must be "remove nothing" rather
 * than "remove everything".
 */

/** Normalise separators and strip redundant and trailing slashes, as Obsidian does. */
function norm(p: string): string {
	return p
		.replace(/\\/g, "/")
		.replace(/\/{2,}/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

export function orphanedPosters(opts: {
	/** Every file currently in the poster folder. */
	files: string[];
	/** The poster path recorded on each library entry, where it has one. */
	referenced: (string | null | undefined)[];
	/** Whether the library index holds any entries at all. */
	libraryEmpty: boolean;
}): string[] {
	if (opts.libraryEmpty) return [];
	const keep = new Set(opts.referenced.filter((p): p is string => !!p).map(norm));
	return opts.files.filter((f) => !keep.has(norm(f)));
}
