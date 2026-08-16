import { Injectable } from '@nestjs/common';
import { type ScryptOptions, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher } from '../../core/identity/password-hasher.port';

/**
 * `promisify` resolves to scrypt's 3-argument overload and drops `options`,
 * so the signature is restated here — without it the cost parameters below
 * would be silently ignored and every hash would use Node's defaults.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * ADAPTER for the PasswordHasher port, using scrypt from `node:crypto`.
 *
 * Why scrypt and not argon2id: argon2id is the stronger recommendation, but
 * every Node binding for it is a native module, and a native module is a
 * build-toolchain dependency on every machine and CI runner that touches this
 * repo. scrypt is RFC 7914, memory-hard, OWASP-approved for password storage,
 * and already in the standard library — no crypto is being invented here, only
 * selected. Replacing it later means writing one more adapter, not touching
 * `core/`.
 *
 * Parameters below are the cost decision, and they are deliberately explicit
 * rather than defaulted.
 */

/**
 * N = 2^16 with r=8 costs about 64 MB and ~100 ms per hash.
 *
 * OWASP's floor is 2^16; 2^17 doubles the memory to 128 MB, which on a login
 * burst becomes a self-inflicted denial of service before it becomes extra
 * security. Raise it when the box can afford it — the digest records which
 * parameters produced it, so old hashes keep verifying.
 */
const COST = { N: 65_536, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = 'scrypt';

@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await this.derive(plaintext, salt);

    // Self-describing: the parameters live with the digest, so changing COST
    // does not invalidate every stored password.
    return [
      PREFIX,
      COST.N,
      COST.r,
      COST.p,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  }

  async verify(plaintext: string, digest: string): Promise<boolean> {
    const parsed = this.parse(digest);
    // A malformed or unknown digest is a failed login, not a crash: one corrupt
    // row must not turn into a 500 that tells an attacker it exists.
    if (!parsed) return false;

    const derived = await this.derive(plaintext, parsed.salt, parsed.cost, parsed.hash.length);

    return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
  }

  /**
   * Spends the same work as a real verification against a throwaway salt, so
   * an unknown subject and a wrong password are indistinguishable by timing.
   */
  async fakeVerify(): Promise<void> {
    await this.derive('', randomBytes(SALT_LENGTH));
  }

  private derive(
    plaintext: string,
    salt: Buffer,
    cost: typeof COST = COST,
    keyLength: number = KEY_LENGTH,
  ): Promise<Buffer> {
    return scryptAsync(plaintext.normalize('NFKC'), salt, keyLength, {
      N: cost.N,
      r: cost.r,
      p: cost.p,
      // scrypt needs headroom above N*r*128 or it refuses to run.
      maxmem: 256 * cost.N * cost.r,
    });
  }

  private parse(
    digest: string,
  ): { cost: typeof COST; salt: Buffer; hash: Buffer } | null {
    const parts = digest.split('$');
    if (parts.length !== 6 || parts[0] !== PREFIX) return null;

    const [, n, r, p, salt, hash] = parts;
    const cost = { N: Number(n), r: Number(r), p: Number(p) };
    if (!Number.isInteger(cost.N) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) {
      return null;
    }

    try {
      return {
        cost: cost as typeof COST,
        salt: Buffer.from(salt ?? '', 'base64'),
        hash: Buffer.from(hash ?? '', 'base64'),
      };
    } catch {
      return null;
    }
  }
}
