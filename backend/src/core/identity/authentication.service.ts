import { Inject, Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { LOCAL_PROVIDER } from '../users/user.entity';
import { UserRepository } from '../users/user.repository';
import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.port';
import { IssuedSession, SessionService, SessionUser, toSessionUser } from './session.service';

/**
 * The login use case.
 *
 * Every rejection below returns the SAME error with the SAME message, and
 * takes roughly the same time. Unknown subject, wrong password and disabled
 * account are indistinguishable from outside — otherwise the login endpoint
 * doubles as an account-enumeration oracle, and "this email is not registered"
 * is exactly the answer an attacker wants before they start guessing.
 */

/** One message for every failure. Deliberately says nothing. */
const REJECTED = 'Invalid credentials.';

export interface LoginResult {
  session: IssuedSession;
  user: SessionUser;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async login(subject: string, password: string): Promise<LoginResult> {
    const found = await this.users.findIdentityWithUser(LOCAL_PROVIDER, subject);

    if (!found) {
      // Burn the same work a real verification would, so an unknown subject
      // does not answer faster than a wrong password.
      await this.hasher.fakeVerify();
      throw new UnauthorizedError(REJECTED);
    }

    const { identity, user } = found;

    // A local identity with no secret is a broken row, not a passwordless
    // login. Treated as a failed attempt rather than a crash.
    if (identity.secretHash === null) {
      await this.hasher.fakeVerify();
      throw new UnauthorizedError(REJECTED);
    }

    const passwordMatches = await this.hasher.verify(password, identity.secretHash);
    if (!passwordMatches) {
      throw new UnauthorizedError(REJECTED);
    }

    // Checked AFTER the password on purpose: checking first would let anyone
    // discover which accounts are disabled without knowing a password.
    if (user.status !== 'active') {
      throw new UnauthorizedError(REJECTED);
    }

    return {
      session: await this.sessions.issue(user.id),
      user: toSessionUser(user),
    };
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revoke(token);
  }
}
