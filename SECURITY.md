# Key handling

The short version: **the TMDB key never enters this repository**, and by default it is encrypted where it does live.

## Where the key can leak, and what stops it

An Obsidian plugin has exactly one place to persist anything: `data.json`, inside the vault, at `.obsidian/plugins/reel/data.json`. There is no OS keychain available — a plugin that sets `isDesktopOnly: false` cannot use Node APIs, because on mobile there is no Node. So the design starts from "the store is a readable file in a folder the user syncs" and works from there.

| Leak path | Mitigation |
|---|---|
| Key committed to this repo | The key is never in the repo. `.gitignore` covers `data.json`, `.env`, `*.key`. Nothing in the build reads a key. CI never needs one. |
| Vault synced to git / Dropbox / iCloud | Default mode encrypts the key with AES-256-GCM before it touches `data.json`. What syncs is salt + IV + ciphertext. |
| Key visible on screen | The settings field is `type="password"`, `autocomplete="off"`. Stored keys are only ever shown masked (`eyJhbG…9Zx1`). |
| Key in an error message or the console | Every error surfaced to a `Notice`, a rendered block, or `console.warn` passes through `redact()` in `src/secrets.ts`. |
| Key in a URL | TMDB v3 puts `api_key` in the query string, so a failed request's URL is itself a leak. `redact()` strips `api_key=` and `Bearer` patterns unconditionally — even for a key it was never told about. The settings copy steers you to a **v4 read access token**, which travels in an `Authorization` header instead. |
| Key surviving in memory after use | Held in one private field in `CredentialStore`, cleared on `onunload`, on "Lock now", and by the *Lock the TMDB key* command. |

## The three storage modes

Set in **Settings → Reel → Key storage**.

### `encrypted` (default)

```
plaintext key ──PBKDF2-SHA256, 310 000 iterations, 16-byte random salt──▶ AES-256 key
                                                                          │
                              12-byte random IV ──▶ AES-GCM encrypt ──────┘
                                                          │
                                    data.json ◀── { salt, iv, ct } base64
```

`data.json` ends up holding something like:

```json
{
  "keyMode": "encrypted",
  "keyBlob": { "v": 1, "kdf": "PBKDF2-SHA256", "iters": 310000,
               "salt": "…", "iv": "…", "ct": "…" }
}
```

You enter the passphrase once per Obsidian session. GCM's authentication tag means a wrong passphrase fails cleanly rather than yielding garbage — though note that GCM cannot tell "wrong passphrase" from "someone edited the ciphertext", and neither can this plugin.

310 000 iterations is deliberately slow. It runs once per session, not per request, so even on a phone you pay it once.

**There is no recovery.** Forget the passphrase and you re-enter the TMDB key. That is the intended trade: no recovery mechanism means no second copy of the key to protect.

### `session`

Nothing is written to disk. You paste the key once per app launch. Zero at-rest exposure, maximum friction — reasonable if you only add a few titles a month, or if the vault lives somewhere you don't control.

### `plain`

Stored readably. Only sensible for a vault that is never synced anywhere. The settings screen says so in a warning box, and the status pill turns red. It exists because forcing a passphrase on someone with a local-only vault is security theatre, not security.

## What this does *not* protect against

Stated plainly, because a threat model that claims too much is worse than none:

- **Malware or another plugin on your machine.** Once the key is unlocked it is a string in the renderer's memory. Any code running in the same process can read it. Obsidian plugins are not sandboxed from each other.
- **Someone who has both your vault and your passphrase.** Obviously.
- **A weak passphrase.** PBKDF2 at 310k iterations raises the cost of a guess; it does not save `password1`. The setter enforces 8 characters, which is a floor, not a recommendation.
- **Shoulder-surfing the settings screen** while you paste a key in.

## Two kinds of credential

Until 0.9.0 every key Reel held could only *read* a public catalogue. The worst
case for a leaked TMDB key was somebody else looking up films on your quota.

Publishing changes that, and the difference is worth naming rather than
burying in a shared list of pills:

| | **Read keys** | **Write credentials** |
|---|---|---|
| Which | TMDB, OMDb, DoesTheDogDie, OpenRouter | Trakt, Mastodon |
| What it can do | Fetch public data | **Post publicly under your name** |
| Worst case if leaked | Your quota is spent | Someone writes as you |
| Storage | Same encrypted blob, same passphrase | Same encrypted blob, same passphrase |

They share the blob because splitting them would mean two passphrase prompts
and buy nothing — anything that can read one can read the other. What differs
is what a leak costs, so rotate a write credential the moment you suspect one,
and prefer it over a read key if you can only do one.

### Trakt: you register the application, not Reel

Trakt's device flow needs a client ID **and** a client secret. Reel is open
source, so a secret shipped inside it would be printed in this repository —
which is the definition of not a secret. Rather than ship one and call it
secret, you register your own application at
<https://trakt.tv/oauth/applications> and both halves live in your encrypted
store. The same bargain as the TMDB key: the credential is yours.

Signing out (Settings → Reel → Publishing) drops the access token immediately.
Revoking the application at Trakt kills it from their side.

### Mastodon: the narrowest token that works

The access token needs `write:statuses` and nothing else. A token with `read`
or `follow` scopes would let anything holding it read your timeline and follow
list; Reel never asks for either, and neither should you when you create it.

## What leaves the vault, and when

Reel is offline-first and this is the short list of exceptions. Nothing here
happens without a key you added and a switch you turned on.

| Feature | What is sent | Where |
|---|---|---|
| Metadata | The title you searched for, or a TMDB id | TMDB, OMDb, DoesTheDogDie |
| **Publishing** | One review: the text, your stars, the title's TMDB id | Trakt / your Mastodon instance |
| **Ask** | Your question, plus a shortlist of titles — names, years, genres, runtimes, your ratings, seen or unseen | OpenRouter, and on to whichever model you picked |

Ask deserves the detail because the honest answer is "quite a lot": that
shortlist is your viewing history. So it is off by default, it sends no review
text, no watch dates and no file paths, and the number of titles is bounded by
the shortlist setting rather than being "the whole library". The sheet shows
the token count after every question, because a feature that quietly bills you
is one you are right not to trust.

Publishing never happens as a side effect. There is no post-on-rate and no
bulk publish: a review goes out because you looked at the exact text in the
confirmation sheet and pressed the button under it. That sheet starts with no
destination selected, so a mis-tap on Publish sends nothing anywhere.

## Rotating a key

TMDB keys are free and revocable. If one is exposed:

1. Revoke it at <https://www.themoviedb.org/settings/api>.
2. Issue a new one.
3. Settings → Reel → paste → Save.

Cached responses in `.obsidian/plugins/reel/cache/` contain no credential — only film and show metadata — so they don't need clearing.

The same shape applies to the others: revoke at the source first, then replace
in settings. For **Trakt**, revoke the application at
<https://trakt.tv/oauth/applications>; signing out in Reel drops the token but
does not invalidate it at Trakt's end. For **Mastodon**, delete the
application under Preferences → Development. For **OpenRouter**, delete the key
at <https://openrouter.ai/keys>.

Note the ordering. Removing a credential from Reel is not revocation — it only
stops Reel from using it. If a credential has actually been exposed, the copy
that matters is the one that already left.

## Reporting a problem

Open an issue. If it's a genuine key-disclosure bug, describe the leak path without pasting a real key into the report.
