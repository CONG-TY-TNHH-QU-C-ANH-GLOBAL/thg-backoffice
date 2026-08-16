import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { MigrationRunner } from './migration-runner';

/**
 * The migration runner against a REAL PostgreSQL.
 *
 * The unit spec next door drives a fake client, which proves the runner calls
 * BEGIN/COMMIT/ROLLBACK in the right order but cannot prove PostgreSQL honours
 * any of it. Three things are only true if a real server says so:
 *
 *   - DDL inside a transaction actually rolls back (it does in PostgreSQL, and
 *     does NOT in MySQL or Oracle — so this is a property of our database
 *     choice, not of our code, and deserves to be pinned)
 *   - `pg_advisory_lock` actually serialises two connections
 *   - a failed file leaves no trace in the ledger
 *
 * Skipped unless DATABASE_URL_TEST names a database this test may WIPE. It
 * drops and recreates `public` between cases, so never point it at anything
 * you care about.
 */
const TEST_URL = process.env['DATABASE_URL_TEST'];
const describeIntegration = TEST_URL ? describe : describe.skip;

describeIntegration('MigrationRunner against real PostgreSQL', () => {
  jest.setTimeout(30_000);

  let pool: Pool;
  let directory: string;

  beforeAll(() => {
    pool = new Pool({ connectionString: TEST_URL, max: 4 });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    directory = await mkdtemp(join(tmpdir(), 'bo-migrations-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const migration = (name: string, sql: string) => writeFile(join(directory, name), sql, 'utf8');

  const tableExists = async (name: string): Promise<boolean> => {
    const result = await pool.query<{ ok: boolean }>('SELECT to_regclass($1) IS NOT NULL AS ok', [
      `public.${name}`,
    ]);
    return result.rows[0]?.ok === true;
  };

  const ledger = async (): Promise<string[]> => {
    const result = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    return result.rows.map((row) => row.version);
  };

  describe('applying', () => {
    it('applies files in filename order and records each one', async () => {
      await migration('0001_first.sql', 'CREATE TABLE bo_first (id INT PRIMARY KEY);');
      // Depends on the first having run: proves ORDER, not just "both ran".
      await migration('0002_second.sql', 'ALTER TABLE bo_first ADD COLUMN label TEXT;');

      const result = await new MigrationRunner(pool, directory).run();

      expect(result.applied).toEqual(['0001_first.sql', '0002_second.sql']);
      expect(await ledger()).toEqual(['0001_first.sql', '0002_second.sql']);
    });

    it('skips everything on a second run and changes nothing', async () => {
      await migration('0001_first.sql', 'CREATE TABLE bo_first (id INT PRIMARY KEY);');
      await new MigrationRunner(pool, directory).run();

      const second = await new MigrationRunner(pool, directory).run();

      expect(second.applied).toEqual([]);
      expect(second.skipped).toEqual(['0001_first.sql']);
      // Re-running the CREATE would have thrown; a duplicate ledger row would
      // have violated the primary key. Neither happened.
      expect(await ledger()).toEqual(['0001_first.sql']);
    });

    it('applies a NEW file added later without touching the applied one', async () => {
      await migration('0001_first.sql', 'CREATE TABLE bo_first (id INT PRIMARY KEY);');
      await new MigrationRunner(pool, directory).run();

      await migration('0002_later.sql', 'CREATE TABLE bo_later (id INT PRIMARY KEY);');
      const result = await new MigrationRunner(pool, directory).run();

      expect(result.applied).toEqual(['0002_later.sql']);
      expect(result.skipped).toEqual(['0001_first.sql']);
    });
  });

  describe('failure', () => {
    it('rolls back the PARTIAL work of a failing file', async () => {
      await migration('0001_ok.sql', 'CREATE TABLE bo_ok (id INT PRIMARY KEY);');
      // First statement succeeds, second fails. If DDL were not transactional,
      // bo_doomed would survive — that is exactly what this asserts against.
      await migration(
        '0002_broken.sql',
        'CREATE TABLE bo_doomed (id INT PRIMARY KEY); SELECT this_function_does_not_exist();',
      );
      await migration('0003_never.sql', 'CREATE TABLE bo_never (id INT PRIMARY KEY);');

      await expect(new MigrationRunner(pool, directory).run()).rejects.toThrow(
        /0002_broken\.sql failed and was rolled back/,
      );

      expect(await tableExists('bo_ok')).toBe(true); // earlier file stays applied
      expect(await tableExists('bo_doomed')).toBe(false); // partial work undone
      expect(await tableExists('bo_never')).toBe(false); // stopped, did not skip ahead
      expect(await ledger()).toEqual(['0001_ok.sql']); // failure left no trace
    });

    it('retries the failed file once fixed, and continues past it', async () => {
      await migration('0001_ok.sql', 'CREATE TABLE bo_ok (id INT PRIMARY KEY);');
      await migration('0002_broken.sql', 'SELECT this_function_does_not_exist();');
      await migration('0003_after.sql', 'CREATE TABLE bo_after (id INT PRIMARY KEY);');

      await expect(new MigrationRunner(pool, directory).run()).rejects.toThrow();

      await migration('0002_broken.sql', 'CREATE TABLE bo_fixed (id INT PRIMARY KEY);');
      const result = await new MigrationRunner(pool, directory).run();

      expect(result.applied).toEqual(['0002_broken.sql', '0003_after.sql']);
      expect(await ledger()).toEqual(['0001_ok.sql', '0002_broken.sql', '0003_after.sql']);
    });

    it('releases the advisory lock even when a migration fails', async () => {
      await migration('0001_broken.sql', 'SELECT this_function_does_not_exist();');
      await expect(new MigrationRunner(pool, directory).run()).rejects.toThrow();

      // A leaked lock would make every later deployment hang forever, which is
      // a far worse outcome than the failed migration itself.
      const held = await pool.query<{ count: string }>(
        "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'",
      );
      expect(held.rows[0]?.count).toBe('0');
    });
  });

  describe('concurrency', () => {
    it('serialises two runners started at the same time', async () => {
      // pg_sleep keeps the first runner inside its transaction long enough
      // that the second is guaranteed to arrive while the lock is held.
      await migration(
        '0001_slow.sql',
        'SELECT pg_sleep(1); CREATE TABLE bo_once (id INT PRIMARY KEY);',
      );

      const [a, b] = await Promise.all([
        new MigrationRunner(pool, directory).run(),
        new MigrationRunner(pool, directory).run(),
      ]);

      // Exactly one applied it; the other waited, then saw it was done.
      const applied = [...a.applied, ...b.applied];
      const skipped = [...a.skipped, ...b.skipped];
      expect(applied).toEqual(['0001_slow.sql']);
      expect(skipped).toEqual(['0001_slow.sql']);

      // One table, one ledger row — no duplicate schema change.
      expect(await tableExists('bo_once')).toBe(true);
      expect(await ledger()).toEqual(['0001_slow.sql']);
    });

    it('makes the second runner WAIT rather than fail fast', async () => {
      await migration(
        '0001_slow.sql',
        'SELECT pg_sleep(1); CREATE TABLE bo_once (id INT PRIMARY KEY);',
      );

      const started = Date.now();
      await Promise.all([
        new MigrationRunner(pool, directory).run(),
        new MigrationRunner(pool, directory).run(),
      ]);

      // Both finished, and the pair took at least the sleep — proof the second
      // blocked on the lock instead of racing through on a stale ledger read.
      expect(Date.now() - started).toBeGreaterThanOrEqual(1_000);
    });
  });
});
