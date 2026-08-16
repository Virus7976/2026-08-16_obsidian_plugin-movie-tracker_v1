/**
 * One-command publish.
 *
 *   node scripts/publish.mjs            release the current manifest version
 *   node scripts/publish.mjs patch      bump 0.3.0 -> 0.3.1, then release
 *   node scripts/publish.mjs minor      bump 0.3.0 -> 0.4.0, then release
 *   node scripts/publish.mjs major      bump 0.3.0 -> 1.0.0, then release
 *
 * The sequence: build, test, bump the three version files in step, commit, tag
 * from the manifest, push. Pushing the tag is what triggers the release
 * workflow, which rebuilds on a clean checkout and attaches main.js,
 * manifest.json and styles.css to a GitHub release. Obsidian and BRAT pick it
 * up from there.
 *
 * On credentials: this script never reads, prints or stores one. It runs `git
 * push`, and git gets its token from the OS credential store. That is the
 * entire trust boundary — the secret stays with the operating system, and
 * everything here works without ever seeing it.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const bump = process.argv[2];
const VALID = ["patch", "minor", "major"];
if (bump && !VALID.includes(bump)) {
	console.error(`Unknown bump "${bump}". Use one of: ${VALID.join(", ")}`);
	process.exit(1);
}

function run(cmd, opts = {}) {
	return execSync(cmd, { encoding: "utf8", stdio: "inherit", ...opts });
}
function capture(cmd) {
	try {
		return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
	} catch {
		return null;
	}
}
function step(msg) {
	console.log(`\n▶ ${msg}`);
}

/* ---- preconditions --------------------------------------------------- */
const remote = capture("git remote get-url origin");
if (!remote) {
	console.error(
		"No 'origin' remote. The GitHub repo does not exist yet.\n" +
			"Run `npm run doctor` for the exact steps — it needs one action from you,\n" +
			"because creating a public repo publishes the code and that is your call."
	);
	process.exit(1);
}

if (capture("git status --porcelain")) {
	console.error("Working tree is dirty. Commit or stash first.");
	process.exit(1);
}

/* ---- version bump ---------------------------------------------------- */
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

if (bump) {
	const [maj, min, pat] = manifest.version.split(".").map(Number);
	const next =
		bump === "major" ? `${maj + 1}.0.0` : bump === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;

	step(`Bumping ${manifest.version} → ${next}`);

	manifest.version = next;
	writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

	const pkg = JSON.parse(readFileSync("package.json", "utf8"));
	pkg.version = next;
	writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

	// versions.json maps each release to the minimum app version it needs.
	// Obsidian consults it to decide what to offer someone on an older build;
	// a missing entry means the release is silently skipped for them.
	const versions = JSON.parse(readFileSync("versions.json", "utf8"));
	versions[next] = manifest.minAppVersion;
	writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
}

const version = manifest.version;

if (capture(`git tag -l ${version}`)) {
	console.error(
		`Tag ${version} already exists. Re-tagging updates nobody — Obsidian caches by\n` +
			"version number. Publish with a bump instead: npm run publish -- patch"
	);
	process.exit(1);
}

/* ---- build, verify --------------------------------------------------- */
step("Building");
run("npm run build");

step("Testing");
run("npm test");

step("Preflight");
run(`node scripts/preflight.mjs ${version}`);

/* ---- commit, tag, push ----------------------------------------------- */
if (bump) {
	step(`Committing version ${version}`);
	run("git add manifest.json package.json versions.json");
	run(`git commit -m "Release ${version}"`);
}

step(`Tagging ${version}`);
run(`git tag -a ${version} -m "Release ${version}"`);

const branch = capture("git rev-parse --abbrev-ref HEAD");
step(`Pushing ${branch} and tag ${version}`);
run(`git push origin ${branch}`);
run(`git push origin ${version}`);

const webUrl = remote.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
console.log(`\n✓ Published ${version}`);
console.log(`  Workflow:  ${webUrl}/actions`);
console.log(`  Release:   ${webUrl}/releases/tag/${version}`);
console.log("\nBRAT will offer the update in Obsidian once the workflow finishes.\n");
