/**
 * Which cached posters are safe to remove.
 *
 * Kept pure and separate from the vault because it decides what to delete,
 * and a decision like that should be provable without a filesystem.
 *
 * Two rules, both learned the hard way:
 *
 *   An empty library is never treated as "nothing is referenced". The index
 *   reads empty while it is still building and after a failed build, and in
 *   both cases the answer must be "remove nothing" rather than "remove
 *   everything".
 *
 *   Only files Reel itself created are candidates. The poster folder is a
 *   user-editable setting; point it at a folder that already holds your own
 *   attachments and a rule of "delete whatever no note references" would bin
 *   them. Reel writes exactly two shapes — `<tmdbId>.jpg` and
 *   `tv-<tmdbId>.jpg` — and nothing else in that folder is ours to delete.
 */

/** Normalise separators and strip redundant, leading and trailing slashes. */
function norm(p: string): string {
	return p
		.replace(/\\/g, "/")
		.replace(/\/{2,}/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

/** The exact filenames PosterStore.fileName produces, and nothing else. */
const REEL_POSTER = /^(?:tv-)?\d+\.jpg$/;

export function isReelPoster(path: string): boolean {
	const name = norm(path).split("/").pop() ?? "";
	return REEL_POSTER.test(name);
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
	return opts.files.filter((f) => isReelPoster(f) && !keep.has(norm(f)));
}
