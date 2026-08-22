/**
 * Publishing never happens on its own.
 *
 * This is a stated requirement rather than an inferred one, and it is the kind
 * that decays silently. Every other rule in this repo is enforced by the code
 * that implements it: if the composer breaks, a post comes out wrong and a test
 * catches it. But "nothing posts unless a person pressed the button" is not a
 * property of any one function — it is a property of *which functions call
 * which*, and nothing about adding a new caller looks like a bug. A future
 * "publish on rate" toggle, or a batch action over the diary, or an auto-post
 * after logging, would each be a perfectly ordinary-looking change, would pass
 * every other test in this directory, and would be discovered by the user in
 * the worst possible way: a review already on the internet.
 *
 * So the call graph itself is the thing under test. There is exactly one route
 * from a review to a public post:
 *
 *   the send button beside a review   (reviewPane.ts)
 *     → the confirmation sheet         (publishSheet.ts)
 *       → PublishService.publish       (publish/index.ts)
 *         → the two clients            (trakt.ts, mastodon.ts)
 *
 * Any new edge into that graph fails here. The failure is not "you may not do
 * this" — it is "if you meant this, say so out loud by editing the allowlist",
 * which is exactly the amount of friction an irreversible public action
 * deserves.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

let passed = 0;
let failed = 0;

function eq(name: string, got: unknown, want: unknown): void {
	if (got === want) {
		passed++;
	} else {
		failed++;
		console.error(`  ✗ ${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
	}
}

function ok(name: string, cond: boolean, detail = ""): void {
	if (cond) {
		passed++;
	} else {
		failed++;
		console.error(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
	}
}

const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (name.endsWith(".ts")) out.push(full);
	}
	return out;
}

/** Path relative to src/, with forward slashes, so the assertions read plainly. */
function rel(p: string): string {
	return p.slice(SRC.length + 1).split("\\").join("/");
}

const files = walk(SRC).map((p) => ({ path: rel(p), text: readFileSync(p, "utf8") }));

ok("the source tree was actually read", files.length > 20, `found ${files.length} files`);

/*
 * Strip comments before looking for call sites.
 *
 * Half of this repo's volume is prose explaining why things are as they are,
 * and several of those paragraphs mention `publish()` by name. A test that
 * counted them would fail the moment somebody documented the thing it is
 * guarding, which teaches everyone to delete the test rather than the comment.
 */
function code(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/* ---- who may open the confirmation sheet ---------------------------- */

const opensSheet = files.filter((f) => /\bnew PublishSheet\b/.test(code(f.text))).map((f) => f.path);
eq("only one place opens the publish sheet", opensSheet.join(","), "ui/reviewPane.ts");

/* ---- who may call the service ---------------------------------------- */

const callsService = files.filter((f) => /\.publish\.publish\s*\(/.test(code(f.text))).map((f) => f.path);
eq("only the confirmation sheet asks the service to post", callsService.join(","), "ui/publishSheet.ts");

/* ---- who may call the clients ---------------------------------------- */

const callsClients = files
	.filter((f) => /\b(?:this\.)?(?:trakt|mastodon)\.publish\s*\(/.test(code(f.text)))
	.map((f) => f.path);
eq("only the service reaches Trakt and Mastodon", callsClients.join(","), "publish/index.ts");

/*
 * ---- and nothing posts on a timer, a schedule, or app start -----------
 *
 * The call-graph checks above would all still pass if `publish/index.ts` grew
 * a `setInterval` that drained a queue, because the edges would be unchanged.
 * This is the separate question of whether anything in the publishing code can
 * fire without a person present.
 */
for (const f of files.filter((x) => x.path.startsWith("publish/") || x.path === "ui/publishSheet.ts")) {
	const body = code(f.text);
	ok(`${f.path} has no timer`, !/\bsetInterval\s*\(/.test(body), "a repeating timer could post unattended");
	ok(`${f.path} does not defer a post`, !/\bsetTimeout\s*\([^)]*publish/.test(body));
	ok(`${f.path} is not wired to app events`, !/registerEvent|registerInterval|\bon\(["']/.test(body));
}

/* ---- onload wires nothing that posts ---------------------------------- */

const main = code(files.find((f) => f.path === "main.ts")?.text ?? "");
const onload = main.slice(main.indexOf("async onload"), main.indexOf("async onload") + 6000);
ok("onload constructs the service but never posts through it", !/\.publish\s*\(/.test(onload));
ok("no command posts a review", !/publish\.publish\s*\(/.test(main));

/*
 * ---- the sheet's own gate ---------------------------------------------
 *
 * The one call that does post must be reached from a click handler and must be
 * guarded by a chosen destination. Asserted textually because the alternative
 * is asserting nothing: the behaviour lives in a private method that no test
 * can reach without widening its visibility for the rig, which the harness
 * notes elsewhere are right to refuse.
 */
const sheet = code(files.find((f) => f.path === "ui/publishSheet.ts")?.text ?? "");
ok(
	"the posting method refuses when no destination is chosen",
	/if\s*\(this\.busy\s*\|\|\s*!this\.chosen\.size\)\s*return;/.test(sheet),
	"run() must bail before posting when nothing is ticked"
);
ok(
	"nothing is ticked when the sheet opens",
	/private chosen = new Set<TargetId>\(\);/.test(sheet),
	"the chosen set must start empty, so a reflex tap posts nowhere"
);
ok("the post is reached from a click", /addEventListener\("click", \(\) => void this\.run\(\)\)/.test(sheet));

/* ---- a blocked destination is not a dead end -------------------------- */

/*
 * The blocked tile carried the instruction and could not be acted on.
 *
 * "No Mastodon access token — add one in Settings → Reel", printed inside a
 * disabled button: the one control on the screen telling you what to do was
 * the one control you could not press. You closed the sheet, opened settings,
 * and hunted for the section, having been told which feature it was by a screen
 * that could have opened it.
 *
 * It opens the walkthrough now, which puts a new click handler inside the
 * publish sheet — so this file, whose whole charter is that no new edge reaches
 * a public post, is where it gets pinned.
 */
ok(
	"a blocked destination opens its walkthrough",
	/new SetupSheet\(this\.app, this\.plugin, spec\)\.open\(\)/.test(sheet),
	"the blocker text names a feature and does nothing about it"
);

/*
 * And that path must not touch the post. The blocked branch closes the sheet
 * before opening anything, so it cannot select a target, cannot enable Publish
 * and cannot reach run().
 */
const blockedBranch = sheet.slice(sheet.indexOf("if (t.blocker) {"), sheet.indexOf("if (already) {"));
ok("the blocked branch was found", blockedBranch.length > 100);
ok(
	"tapping a blocked destination cannot choose it",
	!blockedBranch.includes("this.chosen"),
	"a destination that cannot post would be added to the set that does"
);
ok("nor reach the post", !blockedBranch.includes("this.run"));

/*
 * The blocker sentences live in one table.
 *
 * The test harness kept its own copy of one of them, and it drifted the moment
 * these were reworded: the rig went on rendering "add one in Settings → Reel"
 * for a release in which the app had stopped saying it, and every check passed.
 * A fixture that quotes the app cannot disagree with the app.
 */
const publishSrc = readFileSync(join(SRC, "publish", "index.ts"), "utf8");
ok("there is one table of blocker text", /export const BLOCKERS/.test(publishSrc));
const strays = readFileSync(join(__dirname, "..", "harness", "main.ts"), "utf8").match(/blocker: "/g) ?? [];
ok(
	"and the harness quotes it rather than paraphrasing",
	strays.length === 0,
	"the rig writes its own blocker text, so it can render a sentence the app no longer says"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
