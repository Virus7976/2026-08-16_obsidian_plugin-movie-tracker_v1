/**
 * "A year ago today."
 *
 * Sits at the top of Up Next, which is the screen you open when deciding what
 * to watch — so a reminder of what you were watching this time last year is
 * both a pleasure and, occasionally, an answer.
 *
 * Renders nothing at all until there is something to say. A permanent panel
 * reading "no anniversaries today" would be a daily reminder that the feature
 * exists and has nothing for you, which is worse than the feature not being
 * there. It appears on the days it has something, and is absent otherwise.
 */

import type ReelPlugin from "../main";
import { onThisDay, type Anniversary } from "../util/milestones";
import { todayISO, prettyDate } from "../util/dates";
import { viewings } from "./diary";

export function paintOnThisDay(plugin: ReelPlugin, container: HTMLElement): void {
	const rows = viewings(plugin.visible(plugin.library.all()));
	const hits = onThisDay(
		rows.map((v) => ({
			date: v.date,
			title: v.entry.title,
			path: v.entry.path,
			rating: v.rating ?? v.entry.rating,
		})),
		todayISO()
	);
	if (!hits.length) return;

	const box = container.createDiv({ cls: "reel-otd" });
	box.createDiv({ cls: "reel-block-title", text: "On this day" });

	const strip = box.createDiv({ cls: "reel-otd-strip" });
	// Capped at four. This is a grace note on the way to the thing you opened
	// the screen for, not a second diary.
	for (const hit of hits.slice(0, 4)) strip.appendChild(card(plugin, hit));
}

function card(plugin: ReelPlugin, hit: Anniversary): HTMLElement {
	const entry = plugin.library.byPath(hit.viewing.path);
	const el = createDiv({ cls: "reel-otd-card" });

	const thumb = el.createDiv({ cls: "reel-otd-thumb" });
	if (entry) plugin.posters.attach(thumb, entry);

	const body = el.createDiv({ cls: "reel-otd-body" });
	body.createDiv({
		cls: "reel-otd-when",
		text: hit.years === 1 ? "One year ago" : `${hit.years} years ago`,
	});
	body.createDiv({ cls: "reel-otd-title", text: hit.viewing.title });
	// The exact date as well as the interval: "three years ago" is the hook,
	// but the date is the thing you might actually be trying to remember.
	body.createDiv({ cls: "reel-otd-date", text: prettyDate(hit.viewing.date) });

	if (!entry) return el;
	el.setAttr("role", "button");
	el.setAttr("tabindex", "0");
	el.setAttr("aria-label", `${hit.viewing.title}, watched ${prettyDate(hit.viewing.date)} — open it`);
	const open = () => void plugin.openDetail(entry);
	el.addEventListener("click", open);
	el.addEventListener("keydown", (ev: KeyboardEvent) => {
		if (ev.key !== "Enter" && ev.key !== " ") return;
		ev.preventDefault();
		open();
	});
	return el;
}
