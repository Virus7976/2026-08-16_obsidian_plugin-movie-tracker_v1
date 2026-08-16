# Publishing

The aim: one command publishes a release, and no secret is ever pasted into a
chat, committed to the repo, or written anywhere an assistant can read it.

## Two credentials, kept apart

Conflating these is the mistake that gets keys leaked, so they are separated by
design and never meet.

| | **TMDB / OMDb / DoesTheDogDie keys** | **GitHub credential** |
|---|---|---|
| What it's for | Reel fetching film data | Pushing releases |
| Where it lives | Obsidian → Settings → Reel | Windows Credential Manager |
| Protected by | AES-256-GCM under your passphrase | Your OS user account |
| In the repo? | Never. `data.json` is gitignored *and* blocked by a pre-push hook | Never |
| Pasted in chat? | Never needed | **Never** |

Your TMDB key has nothing to do with publishing. It goes into the plugin's
settings inside Obsidian, is encrypted before it touches disk, and never leaves
your vault. See [SECURITY.md](SECURITY.md).

## The trust boundary

`git push` needs a GitHub token. The point of this setup is that **the token
lives with your operating system, and the publishing tooling uses git without
ever seeing it**.

You authenticate once, in a browser. Git Credential Manager (bundled with Git
for Windows) stores the token in Windows Credential Manager, encrypted against
your user account. After that, any `git push` from any shell works — including
one an assistant runs — and at no point is the secret readable as text.

Nothing in `scripts/` reads, prints, or stores a credential. `doctor.mjs`
verifies that authentication *works* by listing remote refs; it never asks what
the secret *is*.

**Never paste a GitHub token into a chat.** A token in a conversation is a
token that has been disclosed, and the only correct response is to revoke it.
This setup exists so that never has to happen.

## One-time setup

Three steps. Only the first two need you.

**1. Create the repo** — at <https://github.com/new>, named `obsidian-reel`,
**public**. Do not tick "Add a README", ".gitignore" or "licence"; those create
a commit that conflicts with the existing history.

This step is yours because making a repo public publishes the code, and that is
a decision to take deliberately rather than have taken for you.

**2. Connect and authenticate**, replacing `<you>`:

```bash
git remote add origin https://github.com/<you>/obsidian-reel.git
git branch -M main
git push -u origin main
```

The push opens a browser sign-in. Complete it once; the token is stored by the
OS from then on.

**3. Enable the guards:**

```bash
npm run setup
```

That switches on the pre-push secret scan and runs the readiness check.

## Publishing after that

```bash
npm run doctor              # what's ready, what's missing
npm run publish             # release the current version
npm run publish -- patch    # bump 0.3.0 → 0.3.1, then release
npm run publish -- minor    # bump 0.3.0 → 0.4.0, then release
```

`publish` builds, runs all three test suites, preflights the manifest rules,
bumps the three version files in step, commits, tags from the manifest, and
pushes. Pushing the tag triggers the release workflow, which rebuilds on a
clean checkout and attaches `main.js`, `manifest.json` and `styles.css`. BRAT
then offers the update inside Obsidian.

It refuses to run on a dirty tree, without a remote, or over an existing tag —
re-tagging a published version updates nobody, since Obsidian caches by version
number.

## The pre-push guard

`.githooks/pre-push` blocks a push outright if the tracked tree contains
anything shaped like a GitHub token, a TMDB v4 JWT, an API key next to a
giveaway field name, or a tracked `data.json` / `.env`.

It scans the whole tracked tree rather than just the latest change, because the
dangerous case is something committed a while ago and forgotten. It blocks
rather than warns, because a warning scrolls past.

If it ever fires on a real credential: removing the file is not enough. Rotate
the key. It existed in git history, and history is recoverable.

## What still needs a person

**Creating the repo** — publishing code publicly is your decision.

**Submitting to the community store** — the directory at
<https://community.obsidian.md> authenticates with your *Obsidian* account,
which cannot be delegated. Publishing releases is automatable; that submission
is not, and neither is responding to review feedback.

Everything between those two — build, test, version, tag, release, update
delivery — runs from one command.
