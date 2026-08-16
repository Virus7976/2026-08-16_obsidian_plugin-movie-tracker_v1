/**
 * Minimal stand-in for the `obsidian` module, so pure logic can be exercised
 * under plain Node.
 *
 * Only what the modules under test actually import at *module scope* needs to
 * exist here. The classes are empty shells: nothing in the tested code paths
 * constructs or calls into them — they are imported for `instanceof` checks and
 * type positions that never execute. If a test ever does need real behaviour
 * from one of these, that's a signal the logic belongs in a pure module rather
 * than a deeper fake.
 */

/**
 * Obsidian runs in a renderer where `window` exists; Node does not have one.
 * The plugin deliberately uses `window.crypto` rather than `globalThis.crypto`
 * so it keeps working in popout windows, so the test environment has to offer
 * the same shape rather than the plugin bending to suit the tests.
 */
const g = globalThis as unknown as { window?: unknown };
if (typeof g.window === "undefined") g.window = globalThis;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	return Buffer.from(new Uint8Array(buffer)).toString("base64");
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const buf = Buffer.from(base64, "base64");
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Obsidian collapses backslashes and duplicate slashes and trims the ends. */
export function normalizePath(path: string): string {
	return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}

export class Events {
	private handlers = new Map<string, ((...args: unknown[]) => void)[]>();

	on(name: string, cb: (...args: unknown[]) => void): { name: string; cb: unknown } {
		const list = this.handlers.get(name) ?? [];
		list.push(cb);
		this.handlers.set(name, list);
		return { name, cb };
	}

	trigger(name: string, ...args: unknown[]): void {
		for (const cb of this.handlers.get(name) ?? []) cb(...args);
	}
}

export class TAbstractFile {
	path = "";
}

export class TFile extends TAbstractFile {
	basename = "";
	stat = { ctime: 0, mtime: 0, size: 0 };
}

export class TFolder extends TAbstractFile {}

export class Notice {
	constructor(public message?: string) {}
	/** The plugin drives progress through this; the stub had drifted without it. */
	setMessage(message: string): this {
		this.message = message;
		return this;
	}
	hide(): void {}
}

export class Modal {}
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class SuggestModal {}
export class ItemView {}
export class MarkdownRenderChild {}
export const Platform = { isPhone: false, isMobile: false, isDesktop: true };
export function requestUrl(): never {
	throw new Error("requestUrl is not available in tests — no network from a unit test.");
}
