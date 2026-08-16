import { ScryptPasswordHasher } from './scrypt-password-hasher';

/**
 * Password storage is the one place in this phase where a mistake is silent
 * and permanent: nobody notices plaintext until the dump appears.
 */
describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();
  const password = 'correct horse battery staple';

  // scrypt at N=2^16 is ~100ms by design, and these tests hash repeatedly.
  jest.setTimeout(30_000);

  it('never stores the plaintext anywhere in the digest', async () => {
    const digest = await hasher.hash(password);

    expect(digest).not.toContain(password);
    expect(digest.toLowerCase()).not.toContain('battery');
    expect(Buffer.from(digest, 'utf8').includes(Buffer.from(password))).toBe(false);
  });

  it('records its own parameters so raising the cost does not invalidate old hashes', async () => {
    const digest = await hasher.hash(password);
    const [algorithm, n, r, p] = digest.split('$');

    expect(algorithm).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(65_536);
    expect(Number(r)).toBe(8);
    expect(Number(p)).toBe(1);
  });

  it('salts, so the same password twice gives two different digests', async () => {
    const [a, b] = await Promise.all([hasher.hash(password), hasher.hash(password)]);

    expect(a).not.toEqual(b);
    // …and both still verify.
    await expect(hasher.verify(password, a)).resolves.toBe(true);
    await expect(hasher.verify(password, b)).resolves.toBe(true);
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const digest = await hasher.hash(password);

    await expect(hasher.verify(password, digest)).resolves.toBe(true);
    await expect(hasher.verify('wrong password', digest)).resolves.toBe(false);
    await expect(hasher.verify(password + ' ', digest)).resolves.toBe(false);
  });

  it('returns false rather than throwing on a corrupt digest', async () => {
    // One bad row must be a failed login, not a 500 that confirms it exists.
    for (const bad of ['', 'garbage', 'scrypt$only$four$parts', 'bcrypt$1$2$3$4$5']) {
      await expect(hasher.verify(password, bad)).resolves.toBe(false);
    }
  });

  it('normalises unicode, so the same typed password verifies from any keyboard', async () => {
    // U+00E9 vs U+0065 U+0301 — identical on screen, different bytes.
    const digest = await hasher.hash('caf\u00e9');
    await expect(hasher.verify('cafe\u0301', digest)).resolves.toBe(true);
  });

  it('fakeVerify costs about as much as a real verification', async () => {
    const digest = await hasher.hash(password);

    const realStart = process.hrtime.bigint();
    await hasher.verify('wrong', digest);
    const real = Number(process.hrtime.bigint() - realStart);

    const fakeStart = process.hrtime.bigint();
    await hasher.fakeVerify();
    const fake = Number(process.hrtime.bigint() - fakeStart);

    // Loose bounds on purpose: this asserts the same order of magnitude, not a
    // stopwatch. A tight assertion here would be a flaky test on shared CI.
    expect(fake).toBeGreaterThan(real * 0.2);
    expect(fake).toBeLessThan(real * 5);
  });
});
