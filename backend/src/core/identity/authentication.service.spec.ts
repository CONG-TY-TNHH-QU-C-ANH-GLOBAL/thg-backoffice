import { UnauthorizedError } from '../../common/errors/domain.error';
import { LOCAL_PROVIDER, User } from '../users/user.entity';
import { UserRepository } from '../users/user.repository';
import { AuthenticationService } from './authentication.service';
import { LoginThrottleService } from './login-throttle.service';
import type { PasswordHasher } from './password-hasher.port';
import { SessionService } from './session.service';

/**
 * The rule this file protects: **every** rejection is indistinguishable.
 *
 * Unknown subject, wrong password, disabled account and a broken credential row
 * all produce the same error with the same message. Anything else turns the
 * login endpoint into an account-enumeration oracle, and "that email is not
 * registered" is precisely the answer an attacker wants before guessing.
 */
describe('AuthenticationService', () => {
  const activeUser: User = {
    id: 'user-1',
    displayName: 'A Person',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const identityFor = (secretHash: string | null) => ({
    id: 'identity-1',
    userId: activeUser.id,
    provider: LOCAL_PROVIDER,
    subject: 'a@example.com',
    secretHash,
    createdAt: new Date(),
  });

  let hasher: jest.Mocked<PasswordHasher>;
  let users: { findIdentityWithUser: jest.Mock };
  let sessions: { issue: jest.Mock; revoke: jest.Mock };
  let service: AuthenticationService;

  beforeEach(() => {
    hasher = {
      hash: jest.fn(),
      verify: jest.fn().mockResolvedValue(true),
      fakeVerify: jest.fn().mockResolvedValue(undefined),
    };
    users = { findIdentityWithUser: jest.fn() };
    sessions = {
      issue: jest.fn().mockResolvedValue({ token: 'tok', expiresAt: new Date() }),
      revoke: jest.fn(),
    };

    service = new AuthenticationService(
      users as unknown as UserRepository,
      sessions as unknown as SessionService,
      new LoginThrottleService(),
      hasher,
    );
  });

  const expectIndistinguishableRejection = async (promise: Promise<unknown>) => {
    await expect(promise).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(promise).rejects.toThrow('Invalid credentials.');
  };

  it('issues a session for the right password', async () => {
    users.findIdentityWithUser.mockResolvedValue({
      identity: identityFor('scrypt$digest'),
      user: activeUser,
    });

    const result = await service.login('a@example.com', 'right');

    expect(result.user.id).toBe('user-1');
    expect(result.session.token).toBe('tok');
    expect(sessions.issue).toHaveBeenCalledWith('user-1');
  });

  it('rejects a wrong password without issuing anything', async () => {
    users.findIdentityWithUser.mockResolvedValue({
      identity: identityFor('scrypt$digest'),
      user: activeUser,
    });
    hasher.verify.mockResolvedValue(false);

    await expectIndistinguishableRejection(service.login('a@example.com', 'wrong'));
    expect(sessions.issue).not.toHaveBeenCalled();
  });

  it('rejects an unknown subject with the identical error', async () => {
    users.findIdentityWithUser.mockResolvedValue(null);

    await expectIndistinguishableRejection(service.login('nobody@example.com', 'anything'));
  });

  it('spends the same work on an unknown subject, so timing does not answer either', async () => {
    users.findIdentityWithUser.mockResolvedValue(null);

    await expect(service.login('nobody@example.com', 'x')).rejects.toThrow();

    // Without this, an unknown subject returns before any hashing happens and
    // the response time reveals what the message refuses to.
    expect(hasher.fakeVerify).toHaveBeenCalledTimes(1);
  });

  it('rejects a disabled user — and only AFTER checking the password', async () => {
    users.findIdentityWithUser.mockResolvedValue({
      identity: identityFor('scrypt$digest'),
      user: { ...activeUser, status: 'disabled' },
    });

    await expectIndistinguishableRejection(service.login('a@example.com', 'right'));

    // Order matters: rejecting on status first would let anyone discover which
    // accounts are disabled without knowing a password.
    expect(hasher.verify).toHaveBeenCalled();
    expect(sessions.issue).not.toHaveBeenCalled();
  });

  it('treats a local identity with no secret as a failed login, not a crash', async () => {
    users.findIdentityWithUser.mockResolvedValue({
      identity: identityFor(null),
      user: activeUser,
    });

    await expectIndistinguishableRejection(service.login('a@example.com', ''));
    expect(hasher.fakeVerify).toHaveBeenCalled();
  });

  it('looks the subject up under the local provider', async () => {
    users.findIdentityWithUser.mockResolvedValue(null);
    await expect(service.login('A@Example.com', 'x')).rejects.toThrow();

    expect(users.findIdentityWithUser).toHaveBeenCalledWith(LOCAL_PROVIDER, 'A@Example.com');
  });

  it('revokes the session on logout', async () => {
    await service.logout('tok');
    expect(sessions.revoke).toHaveBeenCalledWith('tok');
  });
});
