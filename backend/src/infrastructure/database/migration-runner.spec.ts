import { MigrationRunner } from './migration-runner';

/**
 * The runner is the one piece of Phase 0 with real branching, so it gets the
 * one real test: an empty or missing migrations directory must be a legitimate
 * state, not a crash. A foundation with no schema yet still has to boot.
 */
describe('MigrationRunner', () => {
  const fakePool = () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (text: string) => {
        queries.push(text);
        return { rows: [] as unknown[] };
      }),
      release: jest.fn(),
    };
    return {
      queries,
      client,
      pool: { connect: jest.fn(async () => client) } as never,
    };
  };

  it('treats a missing migrations directory as "nothing to apply"', async () => {
    const { pool, client } = fakePool();
    const runner = new MigrationRunner(pool, '/definitely/not/a/real/path');

    await expect(runner.run()).resolves.toEqual({ applied: [], skipped: [] });
    expect(client.release).toHaveBeenCalled();
  });

  it('creates the ledger and takes an advisory lock before reading', async () => {
    const { pool, queries } = fakePool();
    await new MigrationRunner(pool, '/definitely/not/a/real/path').run();

    expect(queries[0]).toContain('pg_advisory_lock');
    expect(queries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS schema_migrations'))).toBe(
      true,
    );
    expect(queries.at(-1)).toContain('pg_advisory_unlock');
  });
});
