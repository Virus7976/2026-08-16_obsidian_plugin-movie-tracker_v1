/**
 * Connect this repo to GitHub, once.
 *
 *   npm run connect -- <your-github-username>
 *
 * Adds the remote, renames the branch to `main`, and pushes. The push triggers
 * a browser sign-in; Git Credential Manager stores the resulting token in
 * Windows Credential Manager, encrypted against your user account.
 *
 * After this runs, every later `git push` — including one an assistant runs —
 * authenticates from that store. The token is never typed into a chat, never
 * written into the repo, and never readable as text by the tooling here.
 *
 * This script deliberately does not create the repository. Making a repo public
 * publishes your code, which should be a deliberate act rather than a side
 * effect of running a setup command.
 */

import { execSync } from "child_process";

const user = process.argv[2];
const repoArg = process.argv[3] ?? "obsidian-reel";

if (!user || user.startsWith("-")) {
	console.error(
		"Usage: npm run connect -- <your-github-username> [repo-name-or-url]\n\n" +
			"The repo must already exist and be EMPTY — no README, no .gitignore, no\n" +
			"licence, since those create a commit that conflicts with the local history."
	);
	process.exit(1);
}

// A username, not a token. Guard against one being passed here by mistake — it
// would land in shell history, which is what this whole arrangement avoids.
if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(user)) {
	console.error(
		`"${user}" is not a GitHub username.\n\n` +
			"If you were about to pass a token: don't. Nothing here needs one. The\n" +
			"push below opens a browser sign-in and the OS stores the credential."
	);
	process.exit(1);
}

// Accept a bare repo name or a full clone URL, since copying the URL straight
// out of GitHub is the obvious thing to do.
function repoName(value) {
	const m = String(value).match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?\/?$/i);
	if (m) return m[2];
	return String(value).replace(/\.git$/, "").trim();
}

const repo = repoName(repoArg);
if (!/^[A-Za-z0-9._-]+$/.test(repo)) {
	console.error(`"${repoArg}" is not a usable repository name.`);
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

const url = `https://github.com/${user}/${repo}.git`;

/* ---- credential helper ---------------------------------------------- */
// Without a helper, git asks for credentials on every push and forgets them.
// Repo-local rather than global, to avoid changing how other repos behave.
if (!capture("git config --local credential.helper")) {
	console.log("▶ Configuring Git Credential Manager for this repo");
	run("git config --local credential.helper manager");
}

/* ---- remote ---------------------------------------------------------- */
const existing = capture("git remote get-url origin");
if (existing && existing !== url) {
	console.error(`origin already points at ${existing}.\nRemove it first: git remote remove origin`);
	process.exit(1);
}
if (!existing) {
	console.log(`▶ Adding remote ${url}`);
	run(`git remote add origin ${url}`);
}

/* ---- branch ---------------------------------------------------------- */
const branch = capture("git rev-parse --abbrev-ref HEAD");
if (branch !== "main") {
	// GitHub's default is `main`, and the plugin directory reads manifest.json
	// from the default branch — one obvious branch avoids a confusing failure.
	console.log(`▶ Renaming ${branch} → main`);
	run("git branch -M main");
}

/* ---- push ------------------------------------------------------------ */
console.log("\n▶ Pushing to GitHub");
console.log("  A browser window will open for sign-in. Approve it once.\n");

try {
	run("git push -u origin main");
} catch {
	console.error(
		"\nPush failed. The two usual causes:\n\n" +
			`  1. The repo doesn't exist at ${url}\n` +
			"     Create it (public, empty) and run this again.\n\n" +
			"  2. The repo was initialised with a README, .gitignore or licence.\n" +
			"     That gives it a commit yours doesn't share, so the push is refused.\n" +
			"     Either delete and recreate it empty, or rebase onto it:\n" +
			"       git pull --rebase origin main && git push -u origin main\n"
	);
	process.exit(1);
}

console.log("\n✓ Connected. Nothing else needs your credentials.");
console.log("  Check state:  npm run doctor");
console.log("  Publish:      npm run publish -- patch\n");
