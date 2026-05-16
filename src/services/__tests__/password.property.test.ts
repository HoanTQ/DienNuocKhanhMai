import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/utils/password';

/**
 * **Validates: Requirements 4.2**
 *
 * Property 18: Password Hashing
 * - Với mọi plaintext password, stored value không bao giờ bằng plaintext
 * - Stored value là valid hash có thể verify lại password gốc
 */
describe('Feature: quan-ly-cua-hang-dien-nuoc, Property 18: Password Hashing', () => {
  // Generator cho password strings: ASCII printable, length 4-32
  // (realistic password lengths to keep scrypt performance reasonable)
  const passwordArb = fc
    .array(fc.integer({ min: 33, max: 126 }), { minLength: 4, maxLength: 32 })
    .map((codes) => String.fromCharCode(...codes));

  it('stored value không bao giờ bằng plaintext password', () => {
    fc.assert(
      fc.property(passwordArb, (plaintext) => {
        const stored = hashPassword(plaintext);

        // The stored hash must never equal the plaintext
        expect(stored).not.toBe(plaintext);

        // The stored hash must be in the expected format: salt:hash (hex)
        const parts = stored.split(':');
        expect(parts).toHaveLength(2);
        expect(parts[0]).toMatch(/^[0-9a-f]{32}$/); // 16 bytes = 32 hex chars
        expect(parts[1]).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
      }),
      { numRuns: 100 }
    );
  }, 60000);

  it('stored value là valid hash có thể verify lại password gốc', () => {
    fc.assert(
      fc.property(passwordArb, (plaintext) => {
        const stored = hashPassword(plaintext);

        // The stored hash must be verifiable with the original password
        expect(verifyPassword(plaintext, stored)).toBe(true);
      }),
      { numRuns: 100 }
    );
  }, 60000);
});
