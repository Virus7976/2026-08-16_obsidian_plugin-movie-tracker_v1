/**
 * Tag and push a release.
 *
 * The whole point of this file is that the tag is derived from
 * `manifest.json` rather than typed. Typing it is how you end up with a `v`
 * prefix or a stale number, and Obsidian's response to either is to quietly
 * never offer the update.
 *
 *   npm run release
 *
 * Pushing the tag is what triggers .github/workflows/release.yml, which builds,
 * tests, preflights, and publishes main.js / manifest.json / styles.css as
 * loose assets — the three files Obsidian fetches by name.
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const tag = manifest.version;

function run(cmd) {
	return execSync(cmd, { encoding: "utf8" }).trim();
}

function tryRun(cmd) {
	try {
		return run(cmd);
	} catch {
		return null;
	}
}

/* ---- refuse to release from a dirty or unpushed tree ---------------- */
const status = run("git status --porcelain");
if (status) {
	console.error("Working tree is dirty. Commit or stash first:\n" + status);
	process.exit(1);
}

const remote = tryRun("git remote get-url origin");
if (!remote) {
	console.error(
		"No 'origin' remote. Create the GitHub repo and add it first:\n" +
			"  gh repo create obsidian-reel --public --source=. --remote=origin --push"
	);
	process.exit(1);
}

if (tryRun(`git rev-parse ${tag}`)) {
	console.error(
		`Tag ${tag} already exists. Bump the version in manifest.json, package.json and versions.json first.\n` +
			"Re-tagging a published version does not update anyone — Obsidian caches by version number."
	);
	process.exit(1);
}

/* ---- tag and push --------------------------------------------------- */
console.log(`Tagging ${tag}…`);
run(`git tag -a ${tag} -m "Release ${tag}"`);

const branch = run("git rev-parse --abbrev-ref HEAD");
run(`git push origin ${branch}`);
run(`git push origin ${tag}`);

console.log(`\nPushed ${tag}. The release workflow will build and publish the assets.`);
console.log(`Watch it: ${remote.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/")}/actions`);
