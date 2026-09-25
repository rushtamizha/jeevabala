/**
 * Cryptographic primitives. Pure Node `crypto` – no third-party code.
 *
 * NOTE: intentionally free of `server-only` so CLI scripts can reuse the password
 * hashing. It never touches env vars; keys are passed in explicitly.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/* ----------------------------------------------------------------------------
 * Random values
 * ------------------------------------------------------------------------- */

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

/** Unambiguous alphabet (no 0/O, 1/I/L, U) for human-readable codes. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return out;
}

/* ----------------------------------------------------------------------------
 * Hashing / MACs
 * ------------------------------------------------------------------------- */

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256(key: Buffer | string, input: string, encoding: "hex" | "base64url" = "base64url") {
  return createHmac("sha256", key).update(input).digest(encoding);
}

/** Constant-time string comparison that does not leak length via early return timing. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Compare against itself to keep timing roughly uniform, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Derive an independent 32-byte sub-key for a given purpose (HKDF-SHA256). */
export function deriveKey(masterSecret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(masterSecret, "utf8"), "saarathi.v1", purpose, 32));
}

/* ----------------------------------------------------------------------------
 * Password hashing – scrypt (OWASP: N=2^17, r=8, p=1)
 * Format: scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>
 * ------------------------------------------------------------------------- */

const SCRYPT_PARAMS = { N: 2 ** 17, r: 8, p: 1, keylen: 64 };
const MAX_PASSWORD_LENGTH = 256;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function normalizePassword(password: string): string {
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error("Password too long");
  return password.normalize("NFKC");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = SCRYPT_PARAMS;
  const key = await scrypt(normalizePassword(password), salt, keylen, { N, r, p, maxmem: 256 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  let actual: Buffer;
  try {
    actual = await scrypt(normalizePassword(password), salt, expected.length, {
      N,
      r,
      p,
      maxmem: 256 * 1024 * 1024,
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordNeedsRehash(stored: string): boolean {
  const parts = stored.split("$");
  return parts[0] !== "scrypt" || Number(parts[1]) < SCRYPT_PARAMS.N || Number(parts[2]) < SCRYPT_PARAMS.r;
}

/** A pre-computed hash used to equalise timing when an account does not exist. */
let dummyHashPromise: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomToken(16));
  return dummyHashPromise;
}

export type PasswordPolicyResult = { ok: true } | { ok: false; reason: string };

export function checkPasswordPolicy(password: string, context: string[] = []): PasswordPolicyResult {
  if (password.length < 12) return { ok: false, reason: "Use at least 12 characters." };
  if (password.length > 128) return { ok: false, reason: "Use at most 128 characters." };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    return { ok: false, reason: "Mix at least three of: lowercase, uppercase, numbers, symbols." };
  }
  if (/(.)\1{3,}/.test(password)) return { ok: false, reason: "Avoid repeating the same character." };
  const lower = password.toLowerCase();
  const weak = ["password", "qwerty", "123456", "admin", "letmein", "welcome", "taxi", "cab"];
  if (weak.some((w) => lower.includes(w))) return { ok: false, reason: "Avoid common words or sequences." };
  for (const c of context) {
    const token = c.toLowerCase().split("@")[0];
    if (token.length >= 4 && lower.includes(token)) {
      return { ok: false, reason: "Password must not contain your name or email." };
    }
  }
  return { ok: true };
}

/* ----------------------------------------------------------------------------
 * Symmetric encryption – AES-256-GCM
 * Format: v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 * ------------------------------------------------------------------------- */

export function encryptString(plaintext: string, key: Buffer, aad = "saarathi"): string {
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptString(payload: string, key: Buffer, aad = "saarathi"): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || ctB64 === undefined) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/* ----------------------------------------------------------------------------
 * TOTP (RFC 6238) – HMAC-SHA1, 6 digits, 30s step
 * ------------------------------------------------------------------------- */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(buf).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    (((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]) %
    10 ** digits;
  return code.toString().padStart(digits, "0");
}

/**
 * Verify a TOTP code within ±`window` steps. Returns the matched counter (so the caller
 * can persist it and reject replays) or `null`.
 */
export function verifyTotp(
  secretB32: string,
  code: string,
  opts: { window?: number; now?: number; lastCounter?: number | null } = {},
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const window = opts.window ?? 1;
  const current = Math.floor((opts.now ?? Date.now()) / 1000 / 30);
  let matched: number | null = null;
  for (let i = -window; i <= window; i++) {
    const counter = current + i;
    // Evaluate all candidates (no early exit) to keep timing uniform.
    if (safeEqual(hotp(secret, counter), code) && matched === null) matched = counter;
  }
  if (matched !== null && opts.lastCounter != null && matched <= opts.lastCounter) return null;
  return matched;
}

export function totpUri(secretB32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretB32, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => `${randomCode(5)}-${randomCode(5)}`);
}
