/**
 * Tonight's picks must change, and must have a reason.
 *
 * The point of the engine is that the watchlist does not show the same rows on
 * every visit. These pin that, and the rules that make it trustworthy.
 */
import { pickTonight } from "../src/picks";
import type { Entry } from "../src/types";

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, detail = ""): void {
	if (cond) passed++;
	else {
		failed++;
		console.error(`  ✗ ${name} ${detail}`);
	}
}

const NOW = new Date(2026, 9, 14, 19, 30); // a Wednesday evening
const SAT = new Date(2026, 9, 17, 19, 30);

function film(i: number, extra: Partial<Entry> = {}): Entry {
	return {
		path: `Films/F${i}.md`,
		title: `Film ${i}`,
		type: "film",
		status: "watchlist",
		genres: ["Drama"],
		director: [],
		cast: [],
		providers: [],
		runtime: 100,
		tmdbRating: 7,
		added: NOW.getTime() - 5 * 86400000,
		...extra,
	} as unknown as Entry;
}

const loved = {
	path: "Films/Loved.md",
	title: "Collateral",
	type: "film",
	status: "watched",
	rating: 5,
	genres: ["Thriller"],
	director: ["Michael Mann"],
	cast: [],
	providers: [],
} as unknown as Entry;

const list = Array.from({ length: 20 }, (_, i) => film(i));
const key = (xs: { entry: Entry }[]): string => xs.map((x) => x.entry.path).join(",");

/* ---- it rotates ----------------------------------------------------- */
const a = pickTonight(list, [loved], { now: NOW });
const b = pickTonight(list, [loved], { now: NOW });
ok("same inputs, same picks", key(a) === key(b));
ok("returns three", a.length === 3);

const tomorrow = new Date(NOW.getTime() + 86400000);
ok("a different day gives different picks", key(pickTonight(list, [loved], { now: tomorrow })) !== key(a));
ok("shuffle gives different picks", key(pickTonight(list, [loved], { now: NOW, salt: 1 })) !== key(a));

/* ---- it does not repeat what it just showed ------------------------- */
const shown: Record<string, string> = {};
for (const p of a) shown[p.entry.path] = new Date(NOW.getTime() - 86400000).toISOString();
const next = pickTonight(list, [loved], { now: NOW, shown });
ok("yesterday's picks are not repeated", next.every((p) => !a.some((x) => x.entry.path === p.entry.path)));

/* ---- and it holds still for the day -------------------------------- */
const today: Record<string, string> = {};
for (const p of a) today[p.entry.path] = NOW.toISOString();
ok("picks do not change when re-rendered the same day", key(pickTonight(list, [loved], { now: NOW, shown: today })) === key(a));

/* ---- taste ---------------------------------------------------------- */
const thriller = film(100, { genres: ["Thriller"], director: ["Michael Mann"], title: "Heat" });
const picks = pickTonight([...list.slice(0, 8), thriller], [loved], { now: NOW });
ok("a director you rated 5 is picked", picks.some((p) => p.entry.path === thriller.path));
const why = picks.find((p) => p.entry.path === thriller.path)?.reason ?? "";
ok("and the reason names the title behind it", why.includes("Collateral"), why);

/* ---- tonight -------------------------------------------------------- */
const long = film(200, { runtime: 190, title: "Epic" });
const short = film(201, { runtime: 95, title: "Brisk" });
const wk = pickTonight([long, short, film(202), film(203)], [], { now: NOW, count: 1 });
ok("a weeknight prefers the shorter film", wk[0].entry.path !== long.path);

/* ---- one series at most, no wall of one genre ----------------------- */
const shows = Array.from({ length: 6 }, (_, i) => film(300 + i, { type: "tv", runtime: undefined }));
const mixed = pickTonight([...shows, ...list.slice(0, 4)], [], { now: NOW });
ok("at most one series", mixed.filter((p) => p.entry.type === "tv").length <= 1);

/* ---- empty and tiny lists ------------------------------------------- */
ok("empty watchlist gives nothing", pickTonight([], [loved], { now: NOW }).length === 0);
ok("fewer than three gives what there is", pickTonight(list.slice(0, 2), [], { now: NOW }).length === 2);
ok("a saturday still works", pickTonight(list, [loved], { now: SAT }).length === 3);

if (failed) {
	console.error(`picks: ${failed} failed, ${passed} passed`);
	process.exit(1);
}
console.log(`picks: ${passed} passed`);
