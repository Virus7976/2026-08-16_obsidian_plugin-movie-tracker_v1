/**
 * A browser-side stand-in for the `obsidian` module.
 *
 * The point of this file is verification. Reel's layout could only be checked
 * by shipping it and waiting for a screenshot, which meant three layout
 * regressions in a row — including one fix that broke a second screen, and a
 * whole block of "compact on mobile" rules that never matched on a real
 * device while reading as perfectly correct.
 *
 * With this, the *real* renderers run against the *real* stylesheet in a real
 * browser at a real phone width, and the result can simply be looked at.
 *
 * The tests/obsidian-stub.ts alongside it is deliberately not reused: that one
 * is empty shells for Node, where nothing renders. This one has to actually
 * behave, because the whole value is in what comes out.
 *
 * Obsidian adds its own methods to `HTMLElement` — `createDiv`, `addClass`,
 * `setCssProps` and so on. Those are what the plugin is written against, so
 * they are implemented here rather than the plugin being rewritten to suit a
 * test harness. A harness that changes the thing it measures is worthless.
 */

/* ------------------------------------------------------------------ */
/* Obsidian's DOM extensions                                           */
/* ------------------------------------------------------------------ */

interface ElOptions {
	cls?: string | string[];
	text?: string;
	attr?: Record<string, string | number | boolean | null>;
	href?: string;
	type?: string;
	placeholder?: string;
	value?: string;
	title?: string;
}

function applyOptions(el: HTMLElement, o: ElOptions = {}): HTMLElement {
	if (o.cls) {
		const classes = Array.isArray(o.cls) ? o.cls : o.cls.split(/\s+/);
		for (const c of classes) if (c) el.classList.add(c);
	}
	if (o.text != null) el.textContent = o.text;
	if (o.href != null) el.setAttribute("href", o.href);
	if (o.type != null) el.setAttribute("type", o.type);
	if (o.placeholder != null) el.setAttribute("placeholder", o.placeholder);
	if (o.value != null) (el as HTMLInputElement).value = o.value;
	if (o.title != null) el.setAttribute("title", o.title);
	if (o.attr) {
		for (const [k, v] of Object.entries(o.attr)) {
			if (v != null && v !== false) el.setAttribute(k, String(v));
		}
	}
	return el;
}

export function installDomExtensions(): void {
	const proto = HTMLElement.prototype as HTMLElement & Record<string, unknown>;
	if (proto.createDiv) return;

	proto.createEl = function (tag: string, o?: ElOptions) {
		const el = document.createElement(tag);
		applyOptions(el, o);
		this.appendChild(el);
		return el;
	};
	proto.createDiv = function (o?: ElOptions) {
		return (this as HTMLElement).createEl("div", o);
	};
	proto.createSpan = function (o?: ElOptions) {
		return (this as HTMLElement).createEl("span", o);
	};
	proto.addClass = function (...c: string[]) {
		for (const x of c) if (x) this.classList.add(x);
	};
	proto.removeClass = function (...c: string[]) {
		for (const x of c) this.classList.remove(x);
	};
	proto.removeClasses = function (c: string[]) {
		for (const x of c) this.classList.remove(x);
	};
	proto.toggleClass = function (c: string | string[], on: boolean) {
		for (const x of Array.isArray(c) ? c : [c]) this.classList.toggle(x, on);
	};
	proto.hasClass = function (c: string) {
		return this.classList.contains(c);
	};
	proto.setAttr = function (k: string, v: string | number | boolean) {
		this.setAttribute(k, String(v));
	};
	proto.setText = function (t: string) {
		this.textContent = t;
	};
	proto.empty = function () {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
	proto.detach = function () {
		this.remove();
	};
	proto.setCssProps = function (props: Record<string, string>) {
		for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v);
	};
	proto.setCssStyles = function (styles: Record<string, string>) {
		Object.assign(this.style, styles);
	};
	proto.findAll = function (sel: string) {
		return Array.from(this.querySelectorAll(sel)) as HTMLElement[];
	};
	proto.find = function (sel: string) {
		return this.querySelector(sel) as HTMLElement | null;
	};

	// `createDiv` also exists as a global in Obsidian, for detached elements.
	const g = globalThis as Record<string, unknown>;
	g.createDiv = (o?: ElOptions) => applyOptions(document.createElement("div"), o);
	g.createEl = (tag: string, o?: ElOptions) => applyOptions(document.createElement(tag), o);
	g.createSpan = (o?: ElOptions) => applyOptions(document.createElement("span"), o);
}

installDomExtensions();

/* ------------------------------------------------------------------ */
/* The module surface the renderers import                             */
/* ------------------------------------------------------------------ */

/**
 * Whether the harness is pretending to be a phone.
 *
 * Read from the URL so the same bundle serves both, and — critically —
 * `Platform.isPhone` is what the compact layout is keyed off. A harness that
 * did not model this would have happily shown the desktop layout at 375px
 * wide and told me the bug was fixed.
 */
const params = new URLSearchParams(location.search);
const phone = params.get("phone") !== "0";

export const Platform = {
	isPhone: phone,
	isMobile: phone,
	isDesktop: !phone,
	isDesktopApp: !phone,
	isIosApp: false,
	isAndroidApp: phone,
};

/** A tiny stand-in for Lucide, so icon boxes take up the space they will. */
export function setIcon(el: HTMLElement, name: string): void {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "svg-icon");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("width", "18");
	svg.setAttribute("height", "18");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.dataset.icon = name;
	const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	c.setAttribute("cx", "12");
	c.setAttribute("cy", "12");
	c.setAttribute("r", "8");
	svg.appendChild(c);
	el.appendChild(svg);
}

export class Notice {
	noticeEl: HTMLElement;
	constructor(message = "", _timeout?: number) {
		this.noticeEl = document.createElement("div");
		this.noticeEl.className = "notice";
		this.noticeEl.textContent = message;
	}
	setMessage(m: string): this {
		this.noticeEl.textContent = m;
		return this;
	}
	hide(): void {
		this.noticeEl.remove();
	}
}

export class Modal {
	contentEl: HTMLElement = document.createElement("div");
	modalEl: HTMLElement = document.createElement("div");
	titleEl: HTMLElement = document.createElement("div");
	constructor(public app: unknown) {}
	open(): void {
		/* the harness mounts sheets itself, so it can size them */
	}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}

export class TFile {
	path = "";
	basename = "";
	extension = "md";
	stat = { ctime: 0, mtime: 0, size: 0 };
}
export class TFolder {
	path = "";
	children: unknown[] = [];
}
export class TAbstractFile {
	path = "";
}

export class Events {
	private handlers = new Map<string, ((...a: unknown[]) => void)[]>();
	on(name: string, cb: (...a: unknown[]) => void) {
		const list = this.handlers.get(name) ?? [];
		list.push(cb);
		this.handlers.set(name, list);
		return { name, cb };
	}
	off(): void {}
	offref(): void {}
	trigger(name: string, ...args: unknown[]): void {
		for (const cb of this.handlers.get(name) ?? []) cb(...args);
	}
}

export class Menu {
	addItem(cb: (i: unknown) => void): this {
		cb({
			setTitle: () => this,
			setIcon: () => this,
			onClick: () => this,
		});
		return this;
	}
	addSeparator(): this {
		return this;
	}
	showAtPosition(): void {}
}

export class ItemView {
	contentEl: HTMLElement = document.createElement("div");
	constructor(public leaf: unknown) {}
	registerEvent(): void {}
	registerDomEvent(): void {}
	registerInterval(): void {}
}

export class MarkdownRenderChild {
	constructor(public containerEl: HTMLElement) {}
	registerEvent(): void {}
}

export class Plugin {
	registerEvent(): void {}
	registerDomEvent(): void {}
}
export class PluginSettingTab {}
export class Setting {
	constructor(public el: HTMLElement) {}
	setName(): this {
		return this;
	}
	setDesc(): this {
		return this;
	}
	setHeading(): this {
		return this;
	}
	addText(): this {
		return this;
	}
	addToggle(): this {
		return this;
	}
	addButton(): this {
		return this;
	}
	addDropdown(): this {
		return this;
	}
}

export function normalizePath(p: string): string {
	return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}

export function debounce<T extends (...a: never[]) => unknown>(fn: T, _wait?: number, _immediate?: boolean): T {
	return fn;
}

export async function requestUrl(): Promise<unknown> {
	throw new Error("the harness makes no network requests");
}

export function arrayBufferToBase64(): string {
	return "";
}
export function base64ToArrayBuffer(): ArrayBuffer {
	return new ArrayBuffer(0);
}
export function addIcon(): void {}
export class SuggestModal extends Modal {}
export class MarkdownPostProcessorContext {}
export class WorkspaceLeaf {}
export type RequestUrlResponse = unknown;
