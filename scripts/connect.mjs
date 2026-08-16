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

if (!user || user.startsWith("-")) {
	console.error(
		"Usage: npm run connect -- <your-github-username>\n\n" +
			"First create an EMPTY public repo named 'obsidian-reel' at\n" +
			"https://github.com/new — no README, no .gitignore, no licence, since\n" +
			"those create a commit that conflicts with the existing history."
	);
	process.exit(1);
}

// A username, not a URL or a token. Guard against a token being passed here by
// mistake — it would end up in shell history, which is exactly what this whole
// arrangement exists to avoid.
if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(user)) {
	console.error(
		`"${user}" is not a GitHub username.\n\n` +
			"If you were about to pass a token: don't. Nothing here needs one. The\n" +
			"push below opens a browser sign-in and the OS stores the credential."
	);
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

const url = `https://github.com/${user}/obsidian-reel.git`;

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
		"\nPush failed.\n\n" +
			"Most likely the repository doesn't exist yet. Create an EMPTY public repo\n" +
			`named 'obsidian-reel' at https://github.com/new under the account "${user}",\n` +
			"then run this again."
	);
	process.exit(1);
}

console.log("\n✓ Connected. Nothing else needs your credentials.");
console.log("  Check state:  npm run doctor");
console.log("  Publish:      npm run publish -- patch\n");
