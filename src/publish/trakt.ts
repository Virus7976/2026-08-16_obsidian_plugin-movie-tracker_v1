/**
 * Trakt — the film site your reviews can actually reach.
 *
 * IMDb was the ask, and IMDb has no way in: no public write API, and a review
 * form behind a login and a bot check. Automating a sign-in and a form post on
 * somebody's behalf is not a workaround, it is impersonation with extra steps,
 * so this goes to the nearest thing that has a real door — Trakt, which is a
 * public film and TV profile with ratings, reviews, and an API that expects to
 * be used by other people's apps.
 *
 * ## You bring your own app
 *
 * Trakt's device flow needs a client id *and* a client secret. Reel is open
 * source, so a secret shipped inside it would be printed in the repo, which is
 * the definition of not a secret. Rather than ship one and pretend, you make
 * your own Trakt application — two minutes, one form — and Reel holds your
 * client id and secret in the same encrypted store as every other key. Same
 * bargain as the TMDB key: the credential is yours, and it stays yours.
 *
 * ## Why device flow and not a redirect
 *
 * The ordinary OAuth dance needs a URL Trakt can send the browser back to, and
 * a plugin inside Obsidian on an Android phone has no such URL. Device flow was
 * built for exactly this shape of client: Reel asks for a code, you type eight
 * characters into trakt.tv/activate on any device you like, and Reel polls
 * until the approval lands. Nothing has to be able to call back into the app.
 */

import { requestUrl } from "obsidian";
import type ReelPlugin from "../main";
import { redact } from "../secrets";
import type { Entry } from "../types";
import { composeTrakt, traktComplaint, traktRating, type Composed, type PublishPayload } from "./compose";

const API = "https://api.trakt.tv";

/** Trakt's own dead-simple activation page, shown to the user verbatim. */
export const ACTIVATE_URL = "https://trakt.tv/activate";

export class TraktError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message);
		this.name = "TraktError";
	}
}

/** The application you registered, as stored. */
export interface TraktApp {
	id: string;
	secret: string;
}

/** A live token set. `expires` is epoch milliseconds. */
export interface TraktToken {
	access: string;
	refresh: string;
	expires: number;
}

export interface DeviceCode {
	deviceCode: string;
	/** The eight characters you type in. Shown large; it is the whole ritual. */
	userCode: string;
	verificationUrl: string;
	/** Seconds. Trakt's codes last about ten minutes. */
	expiresIn: number;
	/** Seconds between polls. Going faster earns a 429 and nothing else. */
	interval: number;
}

export function parseApp(raw: string | null | undefined): TraktApp | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<TraktApp>;
		if (parsed.id && parsed.secret) return { id: String(parsed.id), secret: String(parsed.secret) };
	} catch {
		/* not JSON — fall through */
	}
	return null;
}

export function parseToken(raw: string | null | undefined): TraktToken | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<TraktToken>;
		if (parsed.access && parsed.refresh) {
			return {
				access: String(parsed.access),
				refresh: String(parsed.refresh),
				expires: Number(parsed.expires) || 0,
			};
		}
	} catch {
		/* not JSON — fall through */
	}
	return null;
}

export class TraktClient {
	constructor(private plugin: ReelPlugin) {}

	/* ------------------------------------------------------------------ */
	/* Signing in                                                          */
	/* ------------------------------------------------------------------ */

	async requestDeviceCode(app: TraktApp): Promise<DeviceCode> {
		const body = await this.post<{
			device_code: string;
			user_code: string;
			verification_url: string;
			expires_in: number;
			interval: number;
		}>("/oauth/device/code", { client_id: app.id }, app.id);

		return {
			deviceCode: body.device_code,
			userCode: body.user_code,
			verificationUrl: body.verification_url || ACTIVATE_URL,
			expiresIn: body.expires_in ?? 600,
			interval: body.interval ?? 5,
		};
	}

	/**
	 * Ask once whether the code has been approved yet.
	 *
	 * Returns the token when it has, null while it hasn't, and throws when
	 * waiting longer cannot help. That three-way split is the whole reason this
	 * is not just `post()`: in device flow a 400 is not a failure, it is the
	 * normal answer to "has the user finished typing yet", and treating it as an
	 * error would abandon the sign-in a second after starting it.
	 *
	 *   400  still waiting          → null, keep polling
	 *   404  invalid device code    → throw, the code is gone
	 *   409  already approved       → throw, this poll loop is a duplicate
	 *   410  expired                → throw, start again
	 *   418  the user said no       → throw, and do not ask twice
	 *   429  polling too fast       → null, and slow down
	 */
	async pollDeviceToken(app: TraktApp, deviceCode: string): Promise<TraktToken | null> {
		const res = await requestUrl({
			url: `${API}/oauth/device/token`,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: deviceCode, client_id: app.id, client_secret: app.secret }),
			throw: false,
		}).catch((e) => {
			throw new TraktError(redact(e));
		});

		if (res.status === 200) return tokenFrom(res.json);
		if (res.status === 400 || res.status === 429) return null;
		if (res.status === 404) throw new TraktError("Trakt didn't recognise that code. Start again.", 404);
		if (res.status === 409) throw new TraktError("That code was already used.", 409);
		if (res.status === 410) throw new TraktError("The code expired. Start again.", 410);
		if (res.status === 418) throw new TraktError("Sign-in was declined on Trakt.", 418);
		throw new TraktError(redact(`Trakt sign-in failed (${res.status}).`), res.status);
	}

	/**
	 * A token that is good right now.
	 *
	 * Refreshed a day early rather than on expiry. A token that lapses between
	 * the check and the request fails the one thing you were in the middle of
	 * doing, and Trakt's tokens last three months — spending a refresh a day
	 * sooner costs nothing anybody will ever notice.
	 */
	private async freshToken(): Promise<{ app: TraktApp; token: TraktToken }> {
		const app = parseApp(await this.plugin.credentials.getOptional("traktApp"));
		if (!app) throw new TraktError("No Trakt application set. Add one in Settings → Reel.");
		const token = parseToken(await this.plugin.credentials.getOptional("trakt"));
		if (!token) throw new TraktError("Not signed in to Trakt. Sign in from Settings → Reel.");

		const DAY = 24 * 60 * 60 * 1000;
		if (token.expires && token.expires - Date.now() > DAY) return { app, token };

		const body = await this.post<TokenBody>(
			"/oauth/token",
			{
				refresh_token: token.refresh,
				client_id: app.id,
				client_secret: app.secret,
				grant_type: "refresh_token",
			},
			app.id
		);
		const next = tokenFrom(body);
		await this.plugin.credentials.store("trakt", JSON.stringify(next));
		return { app, token: next };
	}

	/* ------------------------------------------------------------------ */
	/* Posting                                                             */
	/* ------------------------------------------------------------------ */

	/**
	 * Post the review, and the rating with it.
	 *
	 * The comment goes first. If the rating call then fails, you have a review
	 * on Trakt without a score, which is a mild inconvenience; doing it the
	 * other way round and failing gives you a score attached to nothing, which
	 * reads as an opinion you never expressed. Neither is undoable from here, so
	 * the order is chosen to make the worse outcome the unlikely one.
	 */
	async publish(payload: PublishPayload): Promise<{ url?: string }> {
		const complaint = traktComplaint(payload);
		if (complaint) throw new TraktError(complaint);

		const { app, token } = await this.freshToken();
		const composed = composeTrakt(payload);
		const media = mediaObject(payload.entry);

		const comment = await this.post<{ id?: number }>(
			"/comments",
			{ ...media, comment: composed.text, spoiler: payload.spoiler },
			app.id,
			token.access
		);

		if (this.plugin.settings.publishRatings) {
			const rating = traktRating(payload.rating);
			if (rating != null) {
				const key = payload.entry.type === "tv" ? "shows" : "movies";
				await this.post(
					"/sync/ratings",
					{ [key]: [{ rating, ids: { tmdb: payload.entry.tmdbId } }] },
					app.id,
					token.access
				).catch(() => {
					// The review is already up; losing the score is not worth
					// throwing away the success the user can see.
				});
			}
		}

		return { url: comment.id ? `https://trakt.tv/comments/${comment.id}` : undefined };
	}

	/** What the user would see before agreeing to any of it. */
	preview(payload: PublishPayload): Composed {
		return composeTrakt(payload);
	}

	/**
	 * Is this session still real?
	 *
	 * The expiry stored beside the token answers a different question, exactly,
	 * and keeps answering it while the vault is locked — so it stays the thing
	 * the row reports on every render. What it cannot see is revocation. Access
	 * withdrawn from Trakt's own website leaves the stored token untouched and
	 * its expiry months away, so every passive signal still says "Signed in"
	 * and the contradiction arrives when a review you have just written fails
	 * to post.
	 *
	 * `freshToken` first, deliberately. It renews a token near expiry, which
	 * means a pass here is evidence about the session Reel would actually
	 * publish with rather than about a token it would have replaced first. A
	 * refusal at that stage is the same answer by a shorter route: a revoked
	 * refresh token cannot be exchanged either.
	 *
	 * `/users/settings` is the cheapest authenticated GET Trakt has, and it
	 * exists to say who you are.
	 */
	async test(): Promise<{ ok: true } | { ok: false; error: string }> {
		let app, token;
		try {
			({ app, token } = await this.freshToken());
		} catch (e) {
			return { ok: false, error: redact(e) };
		}

		try {
			const res = await requestUrl({
				url: `${API}/users/settings`,
				method: "GET",
				headers: {
					"trakt-api-version": "2",
					"trakt-api-key": app.id,
					Authorization: `Bearer ${token.access}`,
				},
				throw: false,
			});
			// The one that matters, and the one the expiry could never see.
			if (res.status === 401) return { ok: false, error: "Trakt refused this token. It may have been revoked." };
			if (res.status >= 400) return { ok: false, error: `Trakt returned ${res.status}.` };
			return { ok: true };
		} catch (e) {
			// The thrown error can carry the request, token included.
			return { ok: false, error: redact(e) };
		}
	}

	/* ------------------------------------------------------------------ */

	private async post<T>(
		path: string,
		body: Record<string, unknown>,
		clientId: string,
		access?: string
	): Promise<T> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"trakt-api-version": "2",
			"trakt-api-key": clientId,
		};
		if (access) headers["Authorization"] = `Bearer ${access}`;

		let res;
		try {
			res = await requestUrl({ url: API + path, method: "POST", headers, body: JSON.stringify(body), throw: false });
		} catch (e) {
			// The thrown error can carry the request, token included.
			throw new TraktError(redact(e));
		}

		if (res.status === 401) throw new TraktError("Trakt rejected the sign-in. Sign in again in Settings → Reel.", 401);
		if (res.status === 403) throw new TraktError("Trakt refused that (403). Check the app's permissions.", 403);
		if (res.status === 409) throw new TraktError("You've already posted a review for this one on Trakt.", 409);
		if (res.status === 420) throw new TraktError("Trakt account limit reached.", 420);
		if (res.status === 422) {
			throw new TraktError("Trakt wouldn't accept that review — comments need at least five words.", 422);
		}
		if (res.status >= 400) throw new TraktError(redact(`Trakt error ${res.status}.`), res.status);

		return (res.json ?? {}) as T;
	}
}

interface TokenBody {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
	created_at?: number;
}

function tokenFrom(body: TokenBody): TraktToken {
	const seconds = Number(body.expires_in) || 0;
	return {
		access: String(body.access_token ?? ""),
		refresh: String(body.refresh_token ?? ""),
		expires: seconds ? Date.now() + seconds * 1000 : 0,
	};
}

/**
 * Which title, in the shape Trakt wants it.
 *
 * Sent as a TMDB id rather than a title and year. Reel knows the id exactly,
 * and a search by name is how "Dune (2021)" becomes a review posted on
 * "Dune (1984)" — a mistake that is invisible until somebody reads it.
 */
function mediaObject(entry: Entry): Record<string, unknown> {
	const ids = { tmdb: entry.tmdbId };
	return entry.type === "tv" ? { show: { ids } } : { movie: { ids } };
}
