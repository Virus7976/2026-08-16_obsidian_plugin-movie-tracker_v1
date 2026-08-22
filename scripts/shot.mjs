/**
 * A picture of one harness screen.
 *
 * The audit answers questions you thought to ask. Four of the faults in this
 * plugin passed every check and were obvious the moment anyone looked: a bar
 * chart where every bar was full width, a star drawn twice, a chevron that was
 * a corner mark, ten rows of zeroes that looked like ten measurements. None of
 * those is a rule you can write down in advance; all of them take two seconds
 * to see.
 *
 * This had been rebuilt by hand as a throwaway four times in three days, which
 * is the definition of something that should be a script.
 *
 * Usage:
 *   npm run shot -- stats
 *   npm run shot -- logsheet --dark
 *   npm run shot -- stats --h=432          # as if the keyboard were up
 *   npm run shot -- stats --expand         # opens every collapsed section
 *   npm run shot -- stats --out=/tmp/s.png
 */
import { createServer } from "node:http";
import { readFile, access, mkdir } from "node:fs/promises";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = 5633;

const args = process.argv.slice(2);
const screen = args.find((a) => !a.startsWith("--")) ?? "library";
const flag = (name, fallback) => {
	const hit = args.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
};
const dark = args.includes("--dark") ? 1 : 0;
const height = Number(flag("h", 812));
const expand = args.includes("--expand");
/*
 * Where to start the capture. The setup guide is 2,700px tall and the thing
 * worth looking at was 2,258px down it, which a full-height shot renders at a
 * scale where nothing is legible.
 */
const top = Number(flag("y", 0));
/*
 * How many matches to report. Twelve is plenty for "is this row laid out
 * right" and far too few for "which rows exist at all" — a probe of the
 * settings screen came back with exactly twelve names and looked, convincingly,
 * like six sections had failed to render.
 */
const probeMax = Number(flag("max", 12));
const out = flag("out", join(ROOT, "shots", `${screen}${dark ? "-dark" : ""}-${height}.png`));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer(async (req, res) => {
	const url = (req.url ?? "/").split("?")[0];
	// The harness first, then the project root — `styles.css` lives at the top
	// level and everything else lives under harness/.
	for (const f of [
		join(ROOT, "harness", url === "/" ? "index.html" : url.replace(/^\//, "")),
		join(ROOT, url.replace(/^\//, "")),
	]) {
		try {
			const body = await readFile(f);
			res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "text/plain" });
			return res.end(body);
		} catch {}
	}
	res.writeHead(404);
	res.end("not found");
});
await new Promise((r) => server.listen(PORT, r));

/** Same list the audit uses — a Chromium is a Chromium. */
const CANDIDATES = {
	win32: [
		"C:/Program Files/Google/Chrome/Application/chrome.exe",
		"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
		"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
		"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
	],
	darwin: [
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
	],
	linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
};
let exe = process.env.REEL_CHROME;
if (!exe) {
	for (const c of CANDIDATES[process.platform] ?? []) {
		try {
			await access(c);
			exe = c;
			break;
		} catch {}
	}
}
if (!exe) {
	console.error("No Chromium found. Set REEL_CHROME to a browser path.");
	process.exit(1);
}

const browser = await puppeteer.launch({ executablePath: exe, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
// deviceScaleFactor 2, because a phone is a retina screen and half the things
// worth looking at here are one or two pixels wide.
// The viewport has to reach the region being cropped, or the clip lands past
// the bottom of the page and returns a blank image.
await page.setViewport({ width: 375, height: top + height, deviceScaleFactor: 2 });
/*
 * What the page said on the way up.
 *
 * A screen that renders an error message has already swallowed the real one —
 * `redact()` strips the detail on purpose, and what reaches the user is a
 * sentence. The console still has the throw, and reading it is the difference
 * between fixing the cause and guessing at it.
 */
if (args.includes("--console")) {
	page.on("console", (m) => console.log(`[${m.type()}] ${m.text()}`));
	page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
}

// Shots can render on the audit's alternate palettes too. Looking at a
// screen on neutral greys only tells you how it looks on neutral greys, and
// the whole point of the palette passes is that this differs.
const palette = args.find((a) => a.startsWith("--palette="))?.slice(10) ?? "";
const palArg = palette ? `&palette=${palette}` : "";
// Obsidian's text size slider, so a screen can be looked at the way somebody
// who turned it up actually sees it.
const shotScale = flag("scale", "");
const scaleArg = shotScale ? `&scale=${shotScale}` : "";
await page.goto(`http://localhost:${PORT}/index.html?screen=${screen}&phone=1&dark=${dark}${palArg}${scaleArg}&probeMax=${probeMax}`, {
	waitUntil: "networkidle0",
});

// Screens that fetch finish arriving after load. Without this the screenshot
// of a sheet is a picture of the word "Loading…".
await page.waitForFunction(() => document.body.classList.contains("reel-settled"), { timeout: 30_000 }).catch(() => {});

if (expand) {
	await page.evaluate(() => {
		for (const t of document.querySelectorAll(".reel-fold-toggle")) t.click();
	});
	// The fold has a transition; measuring it mid-animation is how a 44px
	// button was reported as 26px for three rounds.
	await new Promise((r) => setTimeout(r, 400));
}

/*
 * Geometry, when the picture shows something wrong but not why.
 *
 * A screenshot says "these two rows overlap"; it does not say which box is
 * taller than its parent thinks. Working that out by reading four competing
 * rule blocks is guesswork, and guessing at the cascade is what produced three
 * rounds of the same 26px button. One selector, every match, measured.
 */
const probe = flag("probe", "");
if (probe) {
	const rows = await page.evaluate((sel) => {
		const seen = [...document.querySelectorAll(sel)].slice(0, Number(new URLSearchParams(location.search).get("probeMax") ?? 12));
		return seen.map((el) => {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			return {
				cls: el.className,
				text: (el.textContent ?? "").trim().slice(0, 200),
				box: `${Math.round(r.width)}x${Math.round(r.height)} @ ${Math.round(r.left)},${Math.round(r.top)}`,
				display: cs.display,
				position: cs.position,
				// The two numbers that explain most overlaps: what the element
				// says it is, and what it actually paints.
				scroll: `${el.scrollWidth}x${el.scrollHeight}`,
				overflow: `${cs.overflowX}/${cs.overflowY}`,
				margin: cs.margin,
				gridArea: cs.gridArea,
				// Contrast failures are the other half of what a picture cannot
				// answer: which of the several rules that name this element won.
				color: cs.color,
				background: cs.backgroundColor,
				// Typography and elevation, because "did my rule win" is the
				// question a screenshot answers least well.
				tracking: cs.letterSpacing,
				figures: cs.fontVariantNumeric,
				shadow: cs.boxShadow === "none" ? "none" : cs.boxShadow.slice(0, 60),
				bgImage: cs.backgroundImage === "none" ? "none" : cs.backgroundImage.slice(0, 70),
				darkClass: document.body.classList.contains("theme-dark"),
			};
		});
	}, probe);
	for (const r of rows) console.log(JSON.stringify(r));
}

await mkdir(dirname(out), { recursive: true });
await page.screenshot(
	top > 0 ? { path: out, clip: { x: 0, y: top, width: page.viewport().width, height } } : { path: out }
);
console.log(out);

await browser.close();
server.close();
