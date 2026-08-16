/**
 * Release preflight.
 *
 * Obsidian's updater is unforgiving in one specific way: it compares the
 * version in `manifest.json` against the release tag, and a mismatch doesn't
 * error — the update simply never appears. You'd sit there wondering why
 * Obsidian isn't offering the new version.
 *
 * So every rule that would cause a *silent* failure is checked here, before a
 * tag exists, rather than discovered after publishing.
 *
 *   node scripts/preflight.mjs          check only
 *   node scripts/preflight.mjs 0.3.1    also check the intended tag matches
 */

import { readFileSync, existsSync } from "fs";

const problems = [];
const warnings = [];

function fail(msg) {
	problems.push(msg);
}
function warn(msg) {
	warnings.push(msg);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));

/* ---- the three files Obsidian downloads ---------------------------- */
for (const file of ["main.js", "manifest.json", "styles.css"]) {
	if (!existsSync(file)) {
		fail(`${file} is missing — run "npm run build" first. Obsidian downloads these three by name.`);
	}
}

/* ---- version agreement --------------------------------------------- */
if (manifest.version !== pkg.version) {
	fail(`manifest.json is ${manifest.version} but package.json is ${pkg.version}. They must match.`);
}

if (!versions[manifest.version]) {
	fail(`versions.json has no entry for ${manifest.version}. Obsidian uses it to decide which builds a given app version may install.`);
} else if (versions[manifest.version] !== manifest.minAppVersion) {
	fail(
		`versions.json maps ${manifest.version} to app ${versions[manifest.version]}, but manifest minAppVersion is ${manifest.minAppVersion}.`
	);
}

if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
	fail(`Version "${manifest.version}" is not plain semver. Obsidian will not match a tag against it.`);
}

/* ---- the intended tag ---------------------------------------------- */
const tag = process.argv[2];
if (tag) {
	if (tag.startsWith("v")) {
		fail(`Tag "${tag}" starts with "v". Obsidian tags carry no prefix — use "${manifest.version}".`);
	} else if (tag !== manifest.version) {
		fail(`Tag "${tag}" does not equal manifest version "${manifest.version}". The update would never appear.`);
	}
}

/* ---- manifest hygiene ---------------------------------------------- */
if (!manifest.id || !/^[a-z0-9-]+$/.test(manifest.id)) {
	fail(`Plugin id "${manifest.id}" must be lowercase letters, digits and hyphens.`);
}
if (/obsidian/i.test(manifest.name)) {
	warn(`Plugin name "${manifest.name}" contains "Obsidian" — the community store asks you not to.`);
}
if (manifest.description.length > 250) {
	fail(`Description is ${manifest.description.length} characters; the limit is 250.`);
}
if (!manifest.authorUrl || manifest.authorUrl === "https://github.com/") {
	warn("authorUrl is still a placeholder.");
}
if (manifest.isDesktopOnly !== false) {
	warn("isDesktopOnly is not false — this plugin is meant to run on mobile.");
}

/* ---- nothing secret in the payload --------------------------------- */
if (existsSync("main.js")) {
	const bundle = readFileSync("main.js", "utf8");
	if (/eyJhbGciOi[A-Za-z0-9._-]{20,}/.test(bundle)) {
		fail("main.js contains something shaped like a TMDB v4 token. Do not publish this build.");
	}
	if (/require\("(fs|path|os|child_process|electron)"\)/.test(bundle)) {
		fail("main.js references a Node builtin, which crashes on mobile.");
	}
}
if (existsSync("data.json")) {
	warn("data.json exists in the repo folder. It holds your API keys — confirm it is gitignored.");
}

/* ---- report --------------------------------------------------------- */
for (const w of warnings) console.log(`  warn   ${w}`);
for (const p of problems) console.log(`  ERROR  ${p}`);

if (problems.length) {
	console.log(`\nPreflight failed: ${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
	process.exit(1);
}
console.log(`\nPreflight OK — ${manifest.name} ${manifest.version} (min app ${manifest.minAppVersion}).`);
if (warnings.length) console.log(`${warnings.length} warning${warnings.length === 1 ? "" : "s"}, none blocking.`);
