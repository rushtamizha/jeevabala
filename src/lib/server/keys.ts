import "server-only";
import { decryptString, deriveKey, encryptString, hmacSha256, safeEqual } from "./crypto";
import { env } from "./env";

type Purpose = "otp" | "place" | "csrf" | "telegram" | "misc";

const keyCache = new Map<Purpose, Buffer>();

/** Independent HMAC sub-keys derived from APP_SECRET, so one leaked MAC can't forge another. */
export function macKey(purpose: Purpose): Buffer {
  let key = keyCache.get(purpose);
  if (!key) {
    key = deriveKey(env().APP_SECRET, purpose);
    keyCache.set(purpose, key);
  }
  return key;
}

export function sign(purpose: Purpose, data: string, length = 32): string {
  return hmacSha256(macKey(purpose), data).slice(0, length);
}

export function verifySignature(purpose: Purpose, data: string, signature: string, length = 32): boolean {
  if (typeof signature !== "string" || signature.length !== length) return false;
  return safeEqual(sign(purpose, data, length), signature);
}

function encryptionKey(): Buffer {
  return Buffer.from(env().ENCRYPTION_KEY, "hex");
}

/** Encrypt a secret for storage at rest (AES-256-GCM). */
export function sealSecret(plaintext: string, context = "settings"): string {
  return encryptString(plaintext, encryptionKey(), context);
}

export function openSecret(ciphertext: string | null | undefined, context = "settings"): string | undefined {
  if (!ciphertext) return undefined;
  try {
    return decryptString(ciphertext, encryptionKey(), context);
  } catch {
    console.error(`[keys] failed to decrypt a stored secret (${context}). Was ENCRYPTION_KEY rotated?`);
    return undefined;
  }
}

/** Show only the last 4 characters of a secret, for UI hints. */
export function maskSecret(secret: string | undefined): string | null {
  if (!secret) return null;
  if (secret.length <= 6) return "••••";
  return `••••${secret.slice(-4)}`;
}
