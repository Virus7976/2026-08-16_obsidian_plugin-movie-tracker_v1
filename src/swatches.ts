/**
 * Reading a poster's colour, and remembering it.
 *
 * The decision itself is in `util/swatch.ts`, where it is testable. This is
 * the part that needs a browser: load the cached image, draw it small, read
 * the pixels back.
 *
 * Three things kept it from being a naive `drawImage` and a `getImageData`:
 *
 *   It has to be cheap. Downscaling to 48px wide before reading means ~3,400
 *   pixels rather than a million, which is imperceptible even on a phone.
 *
 *   It has to be cached. Opening the same title twice should not decode the
 *   poster twice, and the answer never changes for a given file.
 *
 *   It has to be allowed to fail. A canvas can be tainted, disabled, or
 *   simply unavailable, and the honest response to that is no tint at all —
 *   the screen was fine before and is fine without.
 */

import type { Swatch } from "./util/swatch";
import { swatchFromPixels, toCss, usableAccent } from "./util/swatch";

export class SwatchStore {
	/**
	 * Keyed by resource URL, which already carries a cache-busting suffix that
	 * changes when the file does — so a re-downloaded poster is re-read rather
	 * than serving the old colour forever.
	 */
	private cache = new Map<string, Swatch | null>();
	private inflight = new Map<string, Promise<Swatch | null>>();

	/** The colour for an image, decoding it at most once. */
	async read(src: string): Promise<Swatch | null> {
		const known = this.cache.get(src);
		if (known !== undefined) return known;

		const running = this.inflight.get(src);
		if (running) return running;

		const job = this.compute(src)
			.catch(() => null)
			.then((swatch) => {
				this.cache.set(src, swatch);
				this.inflight.delete(src);
				return swatch;
			});

		this.inflight.set(src, job);
		return job;
	}

	/**
	 * Tint an element from its poster, if a colour can be found.
	 *
	 * Sets a custom property rather than a concrete style so the stylesheet
	 * decides what the accent is actually *used* for. That keeps every
	 * decision about contrast and emphasis in one file instead of scattered
	 * through the renderers.
	 *
	 * Fire-and-forget by design: the screen renders immediately in the theme's
	 * own colours and the tint arrives a frame or two later. Waiting on a
	 * canvas before showing a page would be a poor trade.
	 */
	tint(el: HTMLElement, src: string | null, dark: boolean): void {
		if (!src) return;
		void this.read(src).then((swatch) => {
			if (!swatch || !el.isConnected) return;
			const accent = usableAccent(swatch, dark);
			el.setCssProps({
				"--reel-accent": toCss(accent),
				// The raw parts as well, so the stylesheet can build translucent
				// and shifted variants without re-deriving them.
				"--reel-accent-h": String(accent.hue),
				"--reel-accent-s": `${accent.sat}%`,
				"--reel-accent-l": `${accent.light}%`,
			});
			el.addClass("has-accent");
		});
	}

	private async compute(src: string): Promise<Swatch | null> {
		const img = new Image();
		// The vault's own resource URLs are same-origin, but an imported note
		// can carry a remote poster, and drawing one of those taints the canvas
		// so that reading it back throws. Asking for CORS lets the ones that
		// allow it through; the rest fail into a null, which is fine.
		img.crossOrigin = "anonymous";
		img.decoding = "async";

		await new Promise<void>((resolve, reject) => {
			img.addEventListener("load", () => resolve(), { once: true });
			img.addEventListener("error", () => reject(new Error("image load failed")), { once: true });
			img.src = src;
		});

		// 48px wide is ~3,400 pixels once the poster ratio is applied. Enough
		// for a dominant hue; small enough that the whole read is sub-millisecond.
		const w = 48;
		const h = Math.max(1, Math.round((img.naturalHeight / Math.max(1, img.naturalWidth)) * w));

		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return null;

		ctx.drawImage(img, 0, 0, w, h);
		// Throws on a tainted canvas — a remote poster from a host that sends
		// no CORS header. Caught by the caller and cached as "no colour".
		const { data } = ctx.getImageData(0, 0, w, h);

		// Already downscaled, so every pixel is worth reading.
		return swatchFromPixels(data, 1);
	}
}
