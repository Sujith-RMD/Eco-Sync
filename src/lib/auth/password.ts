import "server-only";
import {
  randomBytes,
  scrypt as scryptCallback,
  scryptSync,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function formatKey(salt: Buffer, derived: Buffer): string {
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/** Hash a plaintext credential with salted scrypt. Stored server-side only. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(plain, salt, KEY_LENGTH, PARAMS);
  return formatKey(salt, derived);
}

/** Constant-time verification against a stored scrypt hash. */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt" || !n || !r || !p || !saltB64 || !hashB64) {
      return false;
    }
    const expected = Buffer.from(hashB64, "base64");
    const derived = await scryptAsync(
      plain,
      Buffer.from(saltB64, "base64"),
      KEY_LENGTH,
      { N: Number(n), r: Number(r), p: Number(p) },
    );
    return (
      expected.length === derived.length && timingSafeEqual(expected, derived)
    );
  } catch {
    return false;
  }
}

/**
 * Hash used to equalize timing when the requested principal does not exist,
 * so failed logins cannot be distinguished by response latency.
 */
export const DUMMY_PASSWORD_HASH = formatKey(
  randomBytes(SALT_LENGTH),
  scryptSync("dummy-credential", randomBytes(SALT_LENGTH), KEY_LENGTH, PARAMS),
);
