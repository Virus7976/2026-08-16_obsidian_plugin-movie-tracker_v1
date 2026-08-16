/**
 * Minimal stand-in for the `obsidian` module, so the credential crypto can be
 * exercised under plain Node. Only the two base64 helpers `secrets.ts` imports
 * are provided — these match Obsidian's own implementations, which are thin
 * wrappers over the platform's base64.
 */

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	return Buffer.from(new Uint8Array(buffer)).toString("base64");
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const buf = Buffer.from(base64, "base64");
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
