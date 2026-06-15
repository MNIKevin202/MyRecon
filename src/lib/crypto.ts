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

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
