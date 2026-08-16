import { validateEnv } from './env.schema';

/**
 * Configuration is the one thing that must fail LOUDLY. A deployment that
 * boots pointing at the wrong database is worse than one that refuses to boot,
 * so these tests assert the refusal.
 */
describe('validateEnv', () => {
  const valid = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

  it('applies defaults for everything optional', () => {
    const env = validateEnv(valid);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('log');
  });

  it('refuses to start without DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuses a non-PostgreSQL connection string', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/PostgreSQL/);
  });

  it('coerces PORT from string, because env vars are always strings', () => {
    expect(validateEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a port outside the valid range', () => {
    expect(() => validateEnv({ ...valid, PORT: '70000' })).toThrow();
  });

  describe('CORS_ORIGINS', () => {
    it('defaults to empty, which means CORS stays off — the secure default', () => {
      expect(validateEnv(valid).CORS_ORIGINS).toEqual([]);
    });

    it('parses a comma-separated allowlist and trims it', () => {
      const env = validateEnv({
        ...valid,
        CORS_ORIGINS: 'http://localhost:4200, https://app.example.com ',
      });

      expect(env.CORS_ORIGINS).toEqual(['http://localhost:4200', 'https://app.example.com']);
    });

    it('REFUSES a wildcard', () => {
      // A wildcard cannot be combined with cookie credentials: the browser
      // would reject the response, and if it did not, any site could read
      // authenticated data. Better to fail at boot than to ship it.
      expect(() => validateEnv({ ...valid, CORS_ORIGINS: '*' })).toThrow(/explicit origins/);
      expect(() => validateEnv({ ...valid, CORS_ORIGINS: 'http://a.test,*' })).toThrow();
    });
  });

  it('reports every problem at once, not one per restart', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging', PORT: 'abc' })).toThrow(
      /NODE_ENV[\s\S]*PORT[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*/,
    );
  });
});
