import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "module";

const banner = `/*
Reel — Obsidian plugin. Bundled file; edit src/ and rebuild.
*/
`;

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["src/main.ts"],
  bundle: true,
  // Everything Obsidian provides at runtime, plus every Node builtin.
  // Nothing from `builtins` is actually imported by this plugin — the
  // external list is a guard so a stray dependency can't silently pull a
  // Node API into the bundle and break the mobile app.
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
