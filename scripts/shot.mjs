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
await page.setViewport({ width: 375, height, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}/index.html?screen=${screen}&phone=1&dark=${dark}`, {
	waitUntil: "networkidle0",
});

if (expand) {
	await page.evaluate(() => {
		for (const t of document.querySelectorAll(".reel-fold-toggle")) t.click();
	});
	// The fold has a transition; measuring it mid-animation is how a 44px
	// button was reported as 26px for three rounds.
	await new Promise((r) => setTimeout(r, 400));
}

await mkdir(dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(out);

await browser.close();
server.close();
