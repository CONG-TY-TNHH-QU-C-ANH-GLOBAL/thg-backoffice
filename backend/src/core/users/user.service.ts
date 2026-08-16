import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { assertPasswordAcceptable } from '../identity/password.policy';
import { PASSWORD_HASHER, type PasswordHasher } from '../identity/password-hasher.port';
import { LOCAL_PROVIDER, User, normalizeSubject } from './user.entity';
import { UserRepository } from './user.repository';

/**
 * User lifecycle.
 *
 * Creation only, for now: everything else — listing, editing, disabling other
 * people — is an authorization question, and answering it before Phase 4 would
 * mean inventing a rule this phase has no basis for.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async createWithPassword(input: {
    displayName: string;
    subject: string;
    password: string;
  }): Promise<User> {
    // Policy lives at the authentication boundary, not on the User model —
    // tightening it later must not make existing rows invalid.
    assertPasswordAcceptable(input.password);

    const subject = normalizeSubject(input.subject);

    // Checked before hashing so a duplicate does not cost 100 ms of scrypt.
    // The unique index is still the authority — this only turns the race into
    // a clean error rather than a constraint violation in the common case.
    if (await this.users.subjectExists(LOCAL_PROVIDER, subject)) {
      throw new ConflictError(`An identity already exists for "${subject}".`);
    }

    return this.users.createWithLocalIdentity({
      displayName: input.displayName.trim(),
      subject,
      secretHash: await this.hasher.hash(input.password),
    });
  }

  async requireById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User not found.');
    return user;
  }
}
