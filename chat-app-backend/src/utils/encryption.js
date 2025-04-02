// utils/encryption.js
import crypto from "crypto";

const algorithm = "aes-256-cbc";
const ivLength = 16;

// Determine the key format and convert to a 32-byte buffer
let key;
if (process.env.ENCRYPTION_KEY.match(/^[0-9a-fA-F]{64}$/)) {
  // If the key is a 64-character hex string
  key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
} else if (process.env.ENCRYPTION_KEY.match(/^[A-Za-z0-9+/=]{44}$/)) {
  // If the key is a 44-character Base64 string (32 bytes)
  key = Buffer.from(process.env.ENCRYPTION_KEY, "base64");
} else {
  throw new Error(
    "Invalid ENCRYPTION_KEY format. Must be a 64-character hex string or a 44-character Base64 string."
  );
}

if (key.length !== 32) {
  throw new Error("Encryption key must be 32 bytes (256 bits) long");
}

export const encrypt = (text) => {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};

export const decrypt = (encryptedData) => {
  const [ivHex, encryptedText] = encryptedData.split(":");
  if (!ivHex || !encryptedText) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};
