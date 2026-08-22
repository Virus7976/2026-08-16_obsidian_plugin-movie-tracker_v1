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
/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/*
 * `Setting` used to be eight methods that returned `this` and drew nothing.
 *
 * That is why the settings screen is the one surface in Reel the audit has
 * never covered. Not because it was skipped, or judged unimportant \u2014 the rig
 * physically could not draw it. Forty-nine controls on a phone-first plugin,
 * never once measured for a touch target, a contrast ratio or an overflow,
 * while every other screen was checked eight ways on every release.
 *
 * So this builds Obsidian's actual DOM. The class names below are the ones
 * Obsidian ships \u2014 `.setting-item`, `.setting-item-info`, `.setting-item-name`,
 * `.setting-item-description`, `.setting-item-control` \u2014 because the plugin's
 * own stylesheet targets them, and a shim inventing its own would measure a
 * layout nobody has.
 *
 * The baseline layout for these lives in harness/theme.css, alongside the rest
 * of the app-chrome approximation. It is an approximation and is commented as
 * one: the value here is relative \u2014 does Reel's own content overflow, does a
 * control fall under 44px, does a description go unreadable on a warm palette
 * \u2014 not that a padding matches Obsidian's to the pixel.
 */

class BaseComponent {
	disabled = false;
	setDisabled(on: boolean): this {
		this.disabled = on;
		return this;
	}
	then(cb: (c: this) => unknown): this {
		cb(this);
		return this;
	}
}

export class TextComponent extends BaseComponent {
	inputEl: HTMLInputElement;
	constructor(parent: HTMLElement, textarea = false) {
		super();
		this.inputEl = document.createElement(textarea ? "textarea" : "input") as HTMLInputElement;
		if (!textarea) this.inputEl.type = "text";
		parent.appendChild(this.inputEl);
	}
	setPlaceholder(v: string): this {
		this.inputEl.placeholder = v;
		return this;
	}
	setValue(v: string): this {
		this.inputEl.value = v;
		return this;
	}
	getValue(): string {
		return this.inputEl.value;
	}
	onChange(cb: (v: string) => unknown): this {
		this.inputEl.addEventListener("input", () => cb(this.inputEl.value));
		return this;
	}
	setDisabled(on: boolean): this {
		this.inputEl.disabled = on;
		return super.setDisabled(on);
	}
}

export class ToggleComponent extends BaseComponent {
	toggleEl: HTMLElement;
	private on = false;
	private handler: ((v: boolean) => unknown) | null = null;
	constructor(parent: HTMLElement) {
		super();
		this.toggleEl = document.createElement("div");
		this.toggleEl.className = "checkbox-container";
		this.toggleEl.setAttribute("role", "checkbox");
		this.toggleEl.setAttribute("tabindex", "0");
		this.toggleEl.addEventListener("click", () => this.setValue(!this.on));
		parent.appendChild(this.toggleEl);
	}
	setValue(v: boolean): this {
		this.on = v;
		this.toggleEl.classList.toggle("is-enabled", v);
		this.toggleEl.setAttribute("aria-checked", v ? "true" : "false");
		this.handler?.(v);
		return this;
	}
	getValue(): boolean {
		return this.on;
	}
	onChange(cb: (v: boolean) => unknown): this {
		// Registered after the initial setValue, exactly as Obsidian does it \u2014
		// otherwise every toggle would fire its own handler on first paint and
		// the settings screen would save forty-nine times on open.
		this.handler = cb;
		return this;
	}
}

export class ButtonComponent extends BaseComponent {
	buttonEl: HTMLButtonElement;
	constructor(parent: HTMLElement) {
		super();
		this.buttonEl = document.createElement("button");
		parent.appendChild(this.buttonEl);
	}
	setButtonText(v: string): this {
		this.buttonEl.textContent = v;
		return this;
	}
	setIcon(): this {
		return this;
	}
	setTooltip(v: string): this {
		this.buttonEl.setAttribute("aria-label", v);
		return this;
	}
	setCta(): this {
		this.buttonEl.classList.add("mod-cta");
		return this;
	}
	setWarning(): this {
		this.buttonEl.classList.add("mod-warning");
		return this;
	}
	setDisabled(on: boolean): this {
		this.buttonEl.disabled = on;
		return super.setDisabled(on);
	}
	onClick(cb: (ev: MouseEvent) => unknown): this {
		this.buttonEl.addEventListener("click", cb);
		return this;
	}
}

export class DropdownComponent extends BaseComponent {
	selectEl: HTMLSelectElement;
	constructor(parent: HTMLElement) {
		super();
		this.selectEl = document.createElement("select");
		this.selectEl.className = "dropdown";
		parent.appendChild(this.selectEl);
	}
	addOption(value: string, label: string): this {
		const o = document.createElement("option");
		o.value = value;
		o.textContent = label;
		this.selectEl.appendChild(o);
		return this;
	}
	// The plural form, used once, for poster quality. Missing it aborted the
	// whole render mid-screen — and the audit dutifully reported the four
	// faults it had found before the exception, as though that were the lot.
	addOptions(map: Record<string, string>): this {
		for (const [value, label] of Object.entries(map)) this.addOption(value, label);
		return this;
	}
	setValue(v: string): this {
		this.selectEl.value = v;
		return this;
	}
	getValue(): string {
		return this.selectEl.value;
	}
	onChange(cb: (v: string) => unknown): this {
		this.selectEl.addEventListener("change", () => cb(this.selectEl.value));
		return this;
	}
}

export class SliderComponent extends BaseComponent {
	sliderEl: HTMLInputElement;
	constructor(parent: HTMLElement) {
		super();
		this.sliderEl = document.createElement("input");
		this.sliderEl.type = "range";
		this.sliderEl.className = "slider";
		parent.appendChild(this.sliderEl);
	}
	setLimits(min: number, max: number, step: number): this {
		this.sliderEl.min = String(min);
		this.sliderEl.max = String(max);
		this.sliderEl.step = String(step);
		return this;
	}
	setValue(v: number): this {
		this.sliderEl.value = String(v);
		return this;
	}
	getValue(): number {
		return Number(this.sliderEl.value);
	}
	setDynamicTooltip(): this {
		return this;
	}
	onChange(cb: (v: number) => unknown): this {
		this.sliderEl.addEventListener("input", () => cb(Number(this.sliderEl.value)));
		return this;
	}
}

export class PluginSettingTab {
	containerEl: HTMLElement = document.createElement("div");
	constructor(
		public app: unknown,
		public plugin: unknown
	) {}
	display(): void {}
	hide(): void {}
}

export class Setting {
	settingEl: HTMLElement;
	infoEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(parent: HTMLElement) {
		this.settingEl = document.createElement("div");
		this.settingEl.className = "setting-item";

		this.infoEl = document.createElement("div");
		this.infoEl.className = "setting-item-info";
		this.nameEl = document.createElement("div");
		this.nameEl.className = "setting-item-name";
		this.descEl = document.createElement("div");
		this.descEl.className = "setting-item-description";
		this.infoEl.appendChild(this.nameEl);
		this.infoEl.appendChild(this.descEl);

		this.controlEl = document.createElement("div");
		this.controlEl.className = "setting-item-control";

		this.settingEl.appendChild(this.infoEl);
		this.settingEl.appendChild(this.controlEl);
		parent.appendChild(this.settingEl);
	}

	setName(v: string): this {
		this.nameEl.textContent = v;
		return this;
	}
	setDesc(v: string): this {
		this.descEl.textContent = v;
		return this;
	}
	setClass(c: string): this {
		this.settingEl.classList.add(c);
		return this;
	}
	setHeading(): this {
		this.settingEl.classList.add("setting-item-heading");
		return this;
	}
	setDisabled(on: boolean): this {
		this.settingEl.classList.toggle("is-disabled", on);
		return this;
	}
	addText(cb: (c: TextComponent) => unknown): this {
		cb(new TextComponent(this.controlEl));
		return this;
	}
	addTextArea(cb: (c: TextComponent) => unknown): this {
		cb(new TextComponent(this.controlEl, true));
		return this;
	}
	addToggle(cb: (c: ToggleComponent) => unknown): this {
		cb(new ToggleComponent(this.controlEl));
		return this;
	}
	addButton(cb: (c: ButtonComponent) => unknown): this {
		cb(new ButtonComponent(this.controlEl));
		return this;
	}
	addExtraButton(cb: (c: ButtonComponent) => unknown): this {
		cb(new ButtonComponent(this.controlEl));
		return this;
	}
	addDropdown(cb: (c: DropdownComponent) => unknown): this {
		cb(new DropdownComponent(this.controlEl));
		return this;
	}
	addSlider(cb: (c: SliderComponent) => unknown): this {
		cb(new SliderComponent(this.controlEl));
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
