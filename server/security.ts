import crypto from 'crypto';
import QRCode from 'qrcode';

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(32).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, actualSalt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST);
  return {
    hash: derivedKey.toString('hex'),
    salt: actualSalt,
  };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derivedKey = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST);
    const storedHashBuf = Buffer.from(hash, 'hex');
    const calculatedHashBuf = Buffer.from(derivedKey.toString('hex'), 'hex');
    if (storedHashBuf.length !== calculatedHashBuf.length) return false;
    return crypto.timingSafeEqual(storedHashBuf, calculatedHashBuf);
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): { isValid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number.' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character (!@#$%^&*).' };
  }
  return { isValid: true };
}

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 16): string {
  let secret = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += BASE32_CHARS[bytes[i] % 32];
  }
  return secret;
}

export function base32ToBuffer(base32: string): Buffer {
  const cleaned = base32.replace(/=+$/, '').toUpperCase().replace(/[\s-]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = BASE32_CHARS.indexOf(cleaned[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTPCode(secret: string, time = Date.now(), step = 30): string {
  const counter = Math.floor(time / 1000 / step);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));

  const key = base32ToBuffer(secret);
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function verifyTOTP(token: string, secret: string, window = 1, step = 30): boolean {
  if (!token || token.trim().length !== 6) return false;
  const cleanToken = token.trim();
  const now = Date.now();

  for (let i = -window; i <= window; i++) {
    const checkTime = now + i * step * 1000;
    const expected = generateTOTPCode(secret, checkTime, step);
    if (expected === cleanToken) {
      return true;
    }
  }
  return false;
}

export function generateRecoveryCodes(count = 8): { rawCodes: string[]; hashedCodes: string[] } {
  const rawCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    rawCodes.push(formatted);
    hashedCodes.push(crypto.createHash('sha256').update(formatted).digest('hex'));
  }

  return { rawCodes, hashedCodes };
}

export function verifyAndConsumeRecoveryCode(
  inputCode: string,
  hashedCodesList: string[]
): { valid: boolean; remainingHashedCodes: string[] } {
  const normalized = inputCode.trim().toUpperCase();
  const inputHash = crypto.createHash('sha256').update(normalized).digest('hex');

  const idx = hashedCodesList.indexOf(inputHash);
  if (idx !== -1) {
    const remaining = [...hashedCodesList];
    remaining.splice(idx, 1);
    return { valid: true, remainingHashedCodes: remaining };
  }
  return { valid: false, remainingHashedCodes: hashedCodesList };
}

export async function generateLocalQrDataUri(text: string): Promise<string> {
  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="#ffffff"/><text x="100" y="100" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">AegisFinance Authenticator</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;
  }
}

export function generateLocalQrDataUriSync(text: string): string {
  const hash = crypto.createHash('sha256').update(text).digest();
  const size = 25;
  const cellSize = 8;
  const totalSize = size * cellSize;

  let rects = '';
  function drawFinder(startX: number, startY: number) {
    let out = '';
    out += `<rect x="${startX * cellSize}" y="${startY * cellSize}" width="${7 * cellSize}" height="${7 * cellSize}" fill="#0f172a" rx="4"/>`;
    out += `<rect x="${(startX + 1) * cellSize}" y="${(startY + 1) * cellSize}" width="${5 * cellSize}" height="${5 * cellSize}" fill="#ffffff" rx="2"/>`;
    out += `<rect x="${(startX + 2) * cellSize}" y="${(startY + 2) * cellSize}" width="${3 * cellSize}" height="${3 * cellSize}" fill="#4f46e5" rx="2"/>`;
    return out;
  }

  rects += drawFinder(1, 1);
  rects += drawFinder(size - 8, 1);
  rects += drawFinder(1, size - 8);

  for (let i = 8; i < size - 8; i++) {
    if (i % 2 === 0) {
      rects += `<rect x="${i * cellSize}" y="${6 * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a"/>`;
      rects += `<rect x="${6 * cellSize}" y="${i * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a"/>`;
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9)) continue;
      if (r === 6 || c === 6) continue;

      const byteIdx = (r * size + c) % hash.length;
      const bitIdx = (r + c) % 8;
      const isDark = (hash[byteIdx] >> bitIdx) & 1;

      if (isDark) {
        rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" rx="1.5"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="200" height="200"><rect width="${totalSize}" height="${totalSize}" fill="#ffffff" rx="16"/>${rects}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface TokenRecord {
  token: string;
  userId: string;
  expiresAt: number;
  used: boolean;
}

export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

interface RateLimitRecord {
  timestamps: number[];
}

export class RateLimiter {
  private requests: Map<string, RateLimitRecord> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 5, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public check(key: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const record = this.requests.get(key) || { timestamps: [] };

    record.timestamps = record.timestamps.filter(ts => now - ts < this.windowMs);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const retryAfterSeconds = Math.ceil((this.windowMs - (now - oldest)) / 1000);
      this.requests.set(key, record);
      return { allowed: false, retryAfterSeconds };
    }

    record.timestamps.push(now);
    this.requests.set(key, record);
    return { allowed: true };
  }

  public reset(key: string): void {
    this.requests.delete(key);
  }
}

export const authRateLimiter = new RateLimiter(6, 60000);
export const mfaRateLimiter = new RateLimiter(5, 60000);
export const passwordResetRateLimiter = new RateLimiter(4, 300000);
export const aiRateLimiter = new RateLimiter(30, 60000);
export const uploadRateLimiter = new RateLimiter(10, 60000);

export interface EncryptedPayloadContainer {
  ciphertext: string;
  iv: string;
  salt: string;
  authTag: string;
  algorithm: 'AES-256-GCM';
  iterations: number;
}

const DEFAULT_BACKUP_SECRET = 'aegis-fintech-master-vault-encryption-key-2026';

export function encryptAES256GCM(plainText: string, passphrase?: string): EncryptedPayloadContainer {
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(passphrase || DEFAULT_BACKUP_SECRET, salt, 100000, 32, 'sha512');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: 'AES-256-GCM',
    iterations: 100000,
  };
}

export function decryptAES256GCM(container: EncryptedPayloadContainer, passphrase?: string): string {
  if (!container || !container.ciphertext || !container.iv || !container.salt || !container.authTag) {
    throw new Error('Malformed AES-256-GCM encrypted container: missing required cryptographic components.');
  }

  const salt = Buffer.from(container.salt, 'hex');
  const iv = Buffer.from(container.iv, 'hex');
  const authTag = Buffer.from(container.authTag, 'hex');
  const key = crypto.pbkdf2Sync(passphrase || DEFAULT_BACKUP_SECRET, salt, container.iterations || 100000, 32, 'sha512');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(container.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function generateEd25519KeyPair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

const serverAuthorityKeys = generateEd25519KeyPair();

export function signEd25519(data: string, privateKeyPem?: string): { signatureHex: string; publicKeyPem: string } {
  const key = privateKeyPem || serverAuthorityKeys.privateKeyPem;
  const pub = privateKeyPem ? undefined : serverAuthorityKeys.publicKeyPem;
  const signature = crypto.sign(null, Buffer.from(data, 'utf8'), key);
  return {
    signatureHex: signature.toString('hex'),
    publicKeyPem: pub || serverAuthorityKeys.publicKeyPem,
  };
}

export function verifyEd25519(data: string, signatureHex: string, publicKeyPem?: string): boolean {
  try {
    const key = publicKeyPem || serverAuthorityKeys.publicKeyPem;
    const sigBuf = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, Buffer.from(data, 'utf8'), key, sigBuf);
  } catch {
    return false;
  }
}
