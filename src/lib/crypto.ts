import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const configured = process.env.RCON_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error("RCON_ENCRYPTION_KEY is required");
  }

  const base64 = Buffer.from(configured, "base64");
  if (base64.length === 32) {
    return base64;
  }

  const utf8 = Buffer.from(configured, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  return crypto.createHash("sha256").update(configured).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(payload: string) {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted secret payload");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivRaw, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// Passphrase-based encryption for portable backups (cross-machine export/import).
// Uses PBKDF2 to derive a key from the user's passphrase, so the backup can be
// decrypted on a different machine that doesn't share the local RCON key.
const PBKDF2_ITERATIONS = 120000;

export function encryptWithPassphrase(plaintext: string, passphrase: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, 32, "sha256");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

export function decryptWithPassphrase(blob: string, passphrase: string) {
  let o: { salt: string; iv: string; tag: string; data: string };
  try { o = JSON.parse(blob); }
  catch { throw new Error("This file isn't a valid MyRcon backup."); }
  if (!o.salt || !o.iv || !o.tag || !o.data) throw new Error("This file isn't a valid MyRcon backup.");

  const key = crypto.pbkdf2Sync(passphrase, Buffer.from(o.salt, "base64"), PBKDF2_ITERATIONS, 32, "sha256");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(o.iv, "base64"));
  decipher.setAuthTag(Buffer.from(o.tag, "base64"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(o.data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Wrong passphrase, or the backup file is corrupt.");
  }
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
