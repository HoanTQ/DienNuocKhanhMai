import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Password hashing utility using Node.js crypto scrypt.
 *
 * NOTE: In production, Supabase Auth handles password hashing (bcrypt).
 * This module demonstrates the password hashing property for testing purposes
 * and can be used for any application-level password needs.
 */

const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const SEPARATOR = ':';
const SCRYPT_COST = 2048; // N parameter for scrypt (2^11, lower for faster testing)

/**
 * Hash a plaintext password using scrypt with a random salt.
 * Returns a string in the format: salt:hash (both hex-encoded).
 */
export function hashPassword(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Password cannot be empty');
  }

  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = scryptSync(plaintext, salt, KEY_LENGTH, { N: SCRYPT_COST }).toString('hex');

  return `${salt}${SEPARATOR}${hash}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * The storedHash must be in the format: salt:hash (both hex-encoded).
 */
export function verifyPassword(plaintext: string, storedHash: string): boolean {
  if (!plaintext || !storedHash) {
    return false;
  }

  const parts = storedHash.split(SEPARATOR);
  if (parts.length !== 2) {
    return false;
  }

  const [salt, hash] = parts;
  const derivedHash = scryptSync(plaintext, salt, KEY_LENGTH, { N: SCRYPT_COST }).toString('hex');

  // Use timing-safe comparison to prevent timing attacks
  const hashBuffer = Buffer.from(hash, 'hex');
  const derivedBuffer = Buffer.from(derivedHash, 'hex');

  if (hashBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(hashBuffer, derivedBuffer);
}
