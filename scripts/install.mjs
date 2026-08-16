/**
 * Install the built plugin straight into your vaults.
 *
 *   npm run install-local           every vault Obsidian knows about
 *   npm run install-local -- open   only the vault currently open
 *   npm run install-local -- "Liam's Git Vault"
 *
 * This is the update mechanism until the plugin is in the community store.
 * No BRAT, no extra plugin — the three files are copied into
 * `.obsidian/plugins/reel/` and Obsidian picks them up on reload.
 *
 * Vault locations come from Obsidian's own `obsidian.json`, so nothing has to
 * be configured here and it keeps working when you add a vault.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";

const FILES = ["main.js", "manifest.json", "styles.css"];
const PLUGIN_ID = JSON.parse(readFileSync("manifest.json", "utf8")).id;
const VERSION = JSON.parse(readFileSync("manifest.json", "utf8")).version;

for (const f of FILES) {
	if (!existsSync(f)) {
		console.error(`${f} is missing. Run "npm run build" first.`);
		process.exit(1);
	}
}

/** Where Obsidian keeps its list of vaults, per platform. */
function obsidianConfigPath() {
	const home = homedir();
	switch (platform()) {
		case "win32":
			return join(home, "AppData", "Roaming", "obsidian", "obsidian.json");
		case "darwin":
			return join(home, "Library", "Application Support", "obsidian", "obsidian.json");
		default:
			return join(home, ".config", "obsidian", "obsidian.json");
	}
}

const configPath = obsidianConfigPath();
if (!existsSync(configPath)) {
	console.error(
		`Could not find Obsidian's vault list at:\n  ${configPath}\n\n` +
			"Copy the three files manually into <vault>/.obsidian/plugins/reel/ instead."
	);
	process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const all = Object.values(config.vaults ?? {});
if (!all.length) {
	console.error("Obsidian knows about no vaults.");
	process.exit(1);
}

/* ---- pick targets ---------------------------------------------------- */
const arg = process.argv[2];
let targets = all;

if (arg === "open") {
	targets = all.filter((v) => v.open);
	if (!targets.length) {
		console.error("No vault is currently open. Omit the argument to install into all of them.");
		process.exit(1);
	}
} else if (arg) {
	targets = all.filter((v) => String(v.path).toLowerCase().includes(arg.toLowerCase()));
	if (!targets.length) {
		console.error(`No vault matched "${arg}". Known vaults:\n` + all.map((v) => `  ${v.path}`).join("\n"));
		process.exit(1);
	}
}

/* ---- copy ------------------------------------------------------------ */
let installed = 0;
for (const vault of targets) {
	const base = String(vault.path);
	// A vault whose folder has been moved or deleted is still listed here, so
	// check rather than creating a stray directory somewhere unexpected.
	if (!existsSync(base) || !statSync(base).isDirectory()) {
		console.log(`  skipped (folder is gone): ${base}`);
		continue;
	}
	if (!existsSync(join(base, ".obsidian"))) {
		console.log(`  skipped (not an Obsidian vault): ${base}`);
		continue;
	}

	const dest = join(base, ".obsidian", "plugins", PLUGIN_ID);
	mkdirSync(dest, { recursive: true });
	for (const f of FILES) copyFileSync(f, join(dest, f));

	console.log(`  installed ${VERSION} → ${base}${vault.open ? "  (open)" : ""}`);
	installed++;
}

if (!installed) {
	console.error("\nNothing was installed.");
	process.exit(1);
}

console.log(
	`\n✓ ${installed} vault${installed === 1 ? "" : "s"} updated.\n` +
		"  Reload Obsidian (Ctrl+R) to pick it up.\n" +
		"  First time only: Settings → Community plugins → enable Reel.\n"
);
