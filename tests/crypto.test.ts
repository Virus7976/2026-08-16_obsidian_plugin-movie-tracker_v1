/**
 * Credential crypto tests.
 *
 * This is the one place where a bug destroys user data irrecoverably: a key
 * that encrypts but won't decrypt is a key that is simply gone. Run against
 * Node's WebCrypto, which is the same API the Obsidian renderer exposes.
 */

import { encryptSecret, decryptSecret, guardSecret, forgetGuarded, redact, maskSecret, WrongPassphraseError } from "../src/secrets";

let pass = 0;
let fail = 0;

function ok(cond: boolean, label: string) {
	if (cond) pass++;
	else {
		fail++;
		console.log(`FAIL ${label}`);
	}
}

function eq(actual: unknown, expected: unknown, label: string) {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	if (a === b) pass++;
	else {
		fail++;
		console.log(`FAIL ${label}\n  expected ${b}\n  actual   ${a}`);
	}
}

async function main() {
	// Deliberately not JWT-shaped. A literal `eyJ…` string here is not a secret,
	// but it matches every scanner that looks for one — our own CI check, the
	// pre-push hook, and GitHub's push protection. None of these assertions
	// care about the shape, so the fixture doesn't need to imitate it.
	const KEY = "tmdb-test-key-not-a-real-credential-000000";
	const PASS = "correct horse battery";

	/* ---- round trip ---- */
	const blob = await encryptSecret(KEY, PASS);
	eq(await decryptSecret(blob, PASS), KEY, "round trip");

	/* ---- the blob really is opaque ---- */
	const serialised = JSON.stringify(blob);
	ok(!serialised.includes(KEY), "ciphertext does not contain the plaintext");
	ok(!serialised.includes("not-a-real-credential"), "no plaintext fragment leaks into the blob");
	eq(blob.v, 1, "blob version");
	eq(blob.kdf, "PBKDF2-SHA256", "kdf recorded");
	ok(blob.iters >= 100_000, "iteration count is not weakened");

	/* ---- wrong passphrase fails cleanly, not with garbage ---- */
	let threw: unknown = null;
	try {
		await decryptSecret(blob, "wrong passphrase");
	} catch (e) {
		threw = e;
	}
	ok(threw instanceof WrongPassphraseError, "wrong passphrase throws WrongPassphraseError");

	/* ---- salt and IV are per-encryption, so two blobs never match ---- */
	const blob2 = await encryptSecret(KEY, PASS);
	ok(blob.salt !== blob2.salt, "salt is random per encryption");
	ok(blob.iv !== blob2.iv, "iv is random per encryption");
	ok(blob.ct !== blob2.ct, "ciphertext differs even for identical input");
	eq(await decryptSecret(blob2, PASS), KEY, "second blob also round trips");

	/* ---- tampering is detected (GCM auth tag) ---- */
	// Tamper at the byte level, not the base64 level: the encoded string ends
	// in "=" padding, and flipping that character decodes to byte-identical
	// output — a test that would pass without testing anything.
	for (const [label, mutate] of [
		["body", (b: Buffer) => void (b[4] ^= 0xff)],
		["auth tag", (b: Buffer) => void (b[b.length - 1] ^= 0xff)],
	] as const) {
		const bytes = Buffer.from(blob.ct, "base64");
		mutate(bytes);
		ok(!bytes.equals(Buffer.from(blob.ct, "base64")), `${label} tamper actually changed the bytes`);
		threw = null;
		try {
			await decryptSecret({ ...blob, ct: bytes.toString("base64") }, PASS);
		} catch (e) {
			threw = e;
		}
		ok(threw instanceof WrongPassphraseError, `tampered ${label} is rejected`);
	}

	// A corrupted salt or IV must fail too, rather than yielding garbage.
	for (const field of ["salt", "iv"] as const) {
		const bytes = Buffer.from(blob[field], "base64");
		bytes[0] ^= 0xff;
		threw = null;
		try {
			await decryptSecret({ ...blob, [field]: bytes.toString("base64") }, PASS);
		} catch (e) {
			threw = e;
		}
		ok(threw instanceof WrongPassphraseError, `corrupted ${field} is rejected`);
	}

	/* ---- unicode and long keys survive ---- */
	const odd = "kéy-with-ünicode-✓-and-emoji-🎬";
	eq(await decryptSecret(await encryptSecret(odd, PASS), PASS), odd, "unicode round trip");
	const long = "x".repeat(4096);
	eq(await decryptSecret(await encryptSecret(long, PASS), PASS), long, "long key round trip");

	/* ---- redaction ---- */
	forgetGuarded();
	guardSecret(KEY);
	ok(!redact(`request failed for ${KEY}`).includes(KEY), "guarded secret is stripped");
	eq(redact("GET /movie/1?api_key=abcdef123456&language=en"), "GET /movie/1?api_key=«api-key»&language=en", "api_key in a url is stripped");
	ok(!redact("Authorization: Bearer abcdefghijklmnopqrstuvwxyz").includes("abcdefghij"), "bearer token is stripped");
	ok(redact(new Error(`boom ${KEY}`)).includes("boom"), "error message survives redaction");
	ok(!redact(new Error(`boom ${KEY}`)).includes(KEY), "error message is redacted");

	// A short value must not be guarded — redacting "abc" would mangle prose.
	forgetGuarded();
	guardSecret("abc");
	eq(redact("abc def"), "abc def", "short secrets are not guarded");

	/* ---- masking ---- */
	ok(!maskSecret(KEY).includes("not-a-real-credential"), "mask hides the body");
	ok(maskSecret(KEY).startsWith("tmdb-t"), "mask keeps a recognisable prefix");
	eq(maskSecret("short"), "•••••", "short values are fully masked");
	eq(maskSecret(""), "", "empty mask");

	console.log(`\n${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
}

void main();
