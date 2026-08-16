/** Local-time date helpers. Everything stored is a plain `yyyy-mm-dd` string. */

export function todayISO(): string {
	return toISO(new Date());
}

export function toISO(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Accepts a Date, a `yyyy-mm-dd` string, or Obsidian's parsed date object. */
export function normaliseDate(value: unknown): string | undefined {
	if (!value) return undefined;
	if (value instanceof Date) return toISO(value);
	const s = String(value).trim();
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

export function yearOf(dateish: string | undefined): number | undefined {
	if (!dateish) return undefined;
	const m = String(dateish).match(/^(\d{4})/);
	return m ? parseInt(m[1], 10) : undefined;
}

/** "3 Nov 2025" — short, unambiguous, and narrow enough for a phone row. */
export function prettyDate(iso: string | undefined): string {
	if (!iso) return "";
	const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return iso;
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

export function daysBetween(aISO: string, bISO: string): number {
	const a = Date.parse(aISO + "T00:00:00");
	const b = Date.parse(bISO + "T00:00:00");
	if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
	return Math.round((b - a) / 86_400_000);
}

/** "2h 35m" / "47m" — runtimes and totals both go through this. */
export function formatMinutes(mins: number): string {
	if (!Number.isFinite(mins) || mins <= 0) return "—";
	const h = Math.floor(mins / 60);
	const m = Math.round(mins % 60);
	if (!h) return `${m}m`;
	return m ? `${h}h ${m}m` : `${h}h`;
}
