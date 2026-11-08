import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Encrypts user secrets (their Anthropic key, endpoint keys, publish keys) at rest with AES-256-GCM.
 * The key comes from SECRET_ENCRYPTION_KEY (32 bytes, base64). Ciphertext format: `v1.<base64(iv|tag|data)>`.
 * Losing or rotating the key makes stored secrets unreadable; users then re-enter them.
 */
const VERSION = "v1";

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

export function parseKey(raw: string | undefined): Buffer {
  if (!raw) throw new SecretBoxError("SECRET_ENCRYPTION_KEY is not set on the server.");
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) throw new SecretBoxError("SECRET_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return key;
}

function serverKey() {
  return parseKey(process.env.SECRET_ENCRYPTION_KEY);
}

export function isConfigured(): boolean {
  try {
    serverKey();
    return true;
  } catch {
    return false;
  }
}

export function seal(plain: string, key: Buffer = serverKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${VERSION}.${Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64")}`;
}

export function open(sealed: string, key: Buffer = serverKey()): string {
  const [version, body] = sealed.split(".", 2);
  if (version !== VERSION || !body) throw new SecretBoxError("Unknown secret format.");
  const buf = Buffer.from(body, "base64");
  if (buf.length < 29) throw new SecretBoxError("Secret is corrupted.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    throw new SecretBoxError("Secret could not be decrypted (wrong key or tampered data).");
  }
}
