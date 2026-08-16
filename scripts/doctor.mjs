/**
 * Publishing readiness check.
 *
 * Answers one question: can a release be pushed from this machine right now,
 * and if not, what exactly is missing?
 *
 * Deliberately reads no credential and prints no credential. It asks git
 * whether authentication *works*, never what the secret *is* — the token lives
 * in the OS credential store and nothing here needs to see it.
 *
 *   node scripts/doctor.mjs
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";

const ok = [];
const todo = [];

function run(cmd, opts = {}) {
	try {
		return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], ...opts }).trim();
	} catch {
		return null;
	}
}

/* ---- git basics ----------------------------------------------------- */
const branch = run("git rev-parse --abbrev-ref HEAD");
if (branch) ok.push(`On branch ${branch}`);
else todo.push("Not a git repository.");

const commits = run("git rev-list --count HEAD");
if (commits) ok.push(`${commits} commit${commits === "1" ? "" : "s"} locally`);

const dirty = run("git status --porcelain");
if (dirty) todo.push(`Working tree has uncommitted changes:\n${dirty.split("\n").map((l) => "        " + l).join("\n")}`);
else ok.push("Working tree is clean");

/* ---- remote ---------------------------------------------------------- */
const remote = run("git remote get-url origin");
if (!remote) {
	todo.push(
		"No 'origin' remote — the repo does not exist on GitHub yet.\n" +
			"        Create an EMPTY public repo at https://github.com/new (no README,\n" +
			"        no .gitignore, no licence — those would conflict), then:\n" +
			"          git remote add origin https://github.com/<you>/obsidian-reel.git"
	);
} else {
	ok.push(`Remote: ${remote}`);

	/* ---- authentication ---------------------------------------------- */
	// `ls-remote` needs working credentials but returns only refs. It never
	// exposes the token, which is exactly the property we want.
	const refs = run(`git ls-remote --heads ${remote}`, { timeout: 20000 });
	if (refs === null) {
		todo.push(
			"Git cannot authenticate to that remote yet.\n" +
				"        Run this once and complete the browser sign-in:\n" +
				"          git push -u origin " + (branch ?? "main") + "\n" +
				"        Git Credential Manager stores the token in Windows Credential\n" +
				"        Manager. It is never written into this repo, and never needs to\n" +
				"        be pasted into a chat."
		);
	} else {
		ok.push("Git authentication works (push access confirmed)");
		const pushed = run(`git rev-parse origin/${branch}`);
		const local = run("git rev-parse HEAD");
		if (pushed && local && pushed !== local) todo.push(`Local ${branch} is ahead of origin — unpushed commits.`);
		else if (pushed) ok.push("Local branch matches origin");
	}
}

/* ---- release plumbing ------------------------------------------------ */
const manifest = existsSync("manifest.json") ? JSON.parse(readFileSync("manifest.json", "utf8")) : null;
if (manifest) {
	ok.push(`Manifest version ${manifest.version}`);
	const tagged = run(`git tag -l ${manifest.version}`);
	if (tagged) todo.push(`Tag ${manifest.version} already exists — bump the version before publishing again.`);
}

if (existsSync(".github/workflows/release.yml")) ok.push("Release workflow present (builds and publishes on tag push)");
else todo.push("No .github/workflows/release.yml — nothing would build on a tag.");

/* ---- safety ---------------------------------------------------------- */
const tracked = run("git ls-files");
if (tracked && /(^|\n)data\.json(\n|$)/.test(tracked)) todo.push("data.json is TRACKED. It holds your API keys. Untrack it immediately.");
else ok.push("data.json is not tracked (API keys stay out of the repo)");

const hooksPath = run("git config core.hooksPath");
if (hooksPath === ".githooks") ok.push("Pre-push secret scan is active");
else todo.push("Secret-scanning pre-push hook not enabled — run: npm run setup");

/* ---- report ---------------------------------------------------------- */
console.log("\nReady:");
for (const line of ok) console.log(`  ✓ ${line}`);

if (todo.length) {
	console.log("\nNeeded:");
	for (const line of todo) console.log(`  • ${line}`);
	console.log("");
	process.exit(1);
}

console.log("\nEverything is in place. `npm run publish` will build, test, tag and push.\n");
