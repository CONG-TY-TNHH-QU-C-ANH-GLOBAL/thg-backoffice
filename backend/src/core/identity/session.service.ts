import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DATABASE, type Database } from '../../common/types/database.port';
import { User, UserStatus } from '../users/user.entity';

/**
 * Server-side sessions, addressed by an opaque bearer token.
 *
 * Chosen over a signed stateless token for one reason: logout has to actually
 * log out. Revoking a JWT needs a denylist, a denylist needs storage and a
 * lookup on every request — which is this table, only with a signature layer
 * and an expiry-skew problem on top. Fewer moving parts win.
 *
 * No refresh tokens, no rotation, no sliding expiry. Those solve problems a
 * short-lived access token creates, and a backoffice with a server-side
 * session does not have them.
 */

/** 256 bits from the CSPRNG — long enough that guessing is not a threat model. */
const TOKEN_BYTES = 32;

/** Fixed lifetime. Re-login is cheap in a backoffice; silent extension is not. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  displayName: string;
  status: UserStatus;
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  u_display_name: string;
  u_status: UserStatus;
}

@Injectable()
export class SessionService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Issues a session and returns the token ONCE.
   *
   * Only the hash is stored, so this value cannot be recovered later — a dump
   * of `sessions` hands an attacker nothing they can present.
   */
  async issue(userId: string, now: Date = new Date()): Promise<IssuedSession> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    await this.db.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, hashToken(token), expiresAt],
    );

    return { token, expiresAt };
  }

  /**
   * Resolves a bearer token to its user, or null.
   *
   * Returns null — never throws and never distinguishes — for every failure:
   * unknown token, expired, revoked, or a user disabled since they logged in.
   * The caller answers 401 for all of them, so none of them is a probe.
   */
  async resolve(token: string, now: Date = new Date()): Promise<SessionUser | null> {
    const rows = await this.db.query<SessionRow>(
      `SELECT s.id, s.user_id, s.expires_at, s.revoked_at,
              u.display_name AS u_display_name,
              u.status       AS u_status
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1`,
      [hashToken(token)],
    );

    const row = rows[0];
    if (!row) return null;
    if (row.revoked_at !== null) return null;
    if (row.expires_at.getTime() <= now.getTime()) return null;

    // Checked on every request, not only at login: disabling an account has to
    // take effect now, not when their session happens to expire.
    if (row.u_status !== 'active') return null;

    return { id: row.user_id, displayName: row.u_display_name, status: row.u_status };
  }

  /** Logout. Idempotent: revoking an unknown or already-revoked token is a no-op. */
  async revoke(token: string, now: Date = new Date()): Promise<void> {
    await this.db.query(
      'UPDATE sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL',
      [hashToken(token), now],
    );
  }

  /** Every session for a user — for disabling an account or a forced sign-out. */
  async revokeAllForUser(userId: string, now: Date = new Date()): Promise<void> {
    await this.db.query(
      'UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL',
      [userId, now],
    );
  }
}

/**
 * SHA-256, deliberately — NOT a password hash.
 *
 * The token is 256 random bits, so there is no dictionary to slow down. A
 * memory-hard KDF here would add ~100 ms to *every authenticated request* and
 * hand anyone a trivial denial of service. Slow hashing defends low-entropy
 * secrets; this is not one.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Exported for tests that need to assert the stored form, never for lookup. */
export const __hashTokenForTest = hashToken;

/** Kept for callers comparing two digests without leaking length via early exit. */
export function digestsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Narrow a full user to what a session exposes. */
export const toSessionUser = (user: User): SessionUser => ({
  id: user.id,
  displayName: user.displayName,
  status: user.status,
});
