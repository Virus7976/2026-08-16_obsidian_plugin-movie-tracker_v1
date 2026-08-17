/**
 * Run the layout audit headlessly.
 *
 * The harness could already catch real bugs, but only when someone opened it
 * and looked — which is the same failure mode as the "compact on mobile"
 * rules that sat inert for three releases while reading as correct. A check
 * nobody runs is a check that does not exist.
 *
 * This serves the repo, drives a real browser at a real phone viewport, reads
 * the audit's own verdict, and exits non-zero on failure. `npm run preflight`
 * calls it, so a layout regression stops a release the way a failing test
 * does.
 *
 * Two deliberate choices:
 *
 *   `puppeteer-core`, not `puppeteer`. The full package downloads its own
 *   Chromium — around 200 MB — to render six screens. Every machine that can
 *   run Obsidian already has a Chromium-based browser, so this finds one.
 *
 *   The static server is fifty lines of `node:http` rather than a dependency.
 *   Serving four files does not warrant one, and a build step that reaches
 *   the network to check a stylesheet is a build step that fails on a train.
 */

import { createServer } from "node:http";
import { readFile, access } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = 5600;

/** Where a Chromium-based browser usually lives, by platform. */
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
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
	],
	linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"],
};

async function findBrowser() {
	// An explicit path wins, so CI can point at whatever it has.
	if (process.env.REEL_CHROME) return process.env.REEL_CHROME;
	for (const path of CANDIDATES[process.platform] ?? []) {
		try {
			await access(path);
			return path;
		} catch {
			/* try the next */
		}
	}
	return null;
}

const TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
};

function serve() {
	return new Promise((ready) => {
		const server = createServer(async (req, res) => {
			// Query strings are the whole interface here, so they are stripped
			// before the path is resolved rather than after.
			let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
			if (path.endsWith("/")) path += "index.html";
			// No traversal out of the repo, even from a local-only server.
			const file = join(ROOT, path);
			if (!file.startsWith(ROOT)) {
				res.writeHead(403).end();
				return;
			}
			try {
				const body = await readFile(file);
				res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
			} catch {
				res.writeHead(404).end("not found");
			}
		});
		server.listen(PORT, () => ready(server));
	});
}

const exe = await findBrowser();
if (!exe) {
	// Not a failure. A machine with no Chromium cannot run this, and blocking
	// a release for that would be worse than skipping a check.
	console.log("Reel: no Chromium-based browser found — skipping the layout audit.");
	console.log("      Set REEL_CHROME to an executable path to run it.");
	process.exit(0);
}

const server = await serve();
const browser = await puppeteer.launch({ executablePath: exe, headless: "new", args: ["--no-sandbox"] });

let failed = 0;
try {
	for (const phone of [1, 0]) {
		const page = await browser.newPage();
		// A real phone viewport, and a desktop one — the compact layout is a
		// separate code path and a regression in either is a regression.
		await page.setViewport(phone ? { width: 375, height: 812 } : { width: 1280, height: 900 });
		await page.goto(`http://localhost:${PORT}/harness/?audit=1&phone=${phone}`, { waitUntil: "networkidle0" });

		const result = await page.evaluate(() => window.REEL_AUDIT);
		const label = phone ? "phone 375x812" : "desktop 1280x900";

		if (!result) {
			console.log(`✗ ${label}: the audit did not run — the harness failed to load.`);
			failed++;
		} else if (result.failures.length) {
			console.log(`✗ ${label}: ${result.failures.length} of ${result.total} checks failed`);
			for (const f of result.failures) console.log(`    ${f.screen} · ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
			failed += result.failures.length;
		} else {
			console.log(`✓ ${label}: ${result.total} checks passed`);
		}
		await page.close();
	}
} finally {
	await browser.close();
	server.close();
}

process.exit(failed ? 1 : 0);
