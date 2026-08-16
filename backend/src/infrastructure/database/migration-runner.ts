import { Logger } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

/**
 * Applies `migrations/*.sql` in filename order, exactly once each.
 *
 * Hand-written rather than a migration library, and that is a deliberate
 * trade. What this needs to be is *reviewable*: a reader should be able to see
 * the whole apply algorithm in one screen and trust it. Eighty lines of
 * explicit SQL do that; a library's conventions do not, and it would be the
 * only dependency in this layer.
 *
 * Three guarantees:
 *
 *   ordered      filenames sort lexicographically, so `0001_` … `0002_` …
 *   exactly once applied versions are recorded and skipped
 *   atomic       each file runs inside a transaction; a failure rolls back
 *                that file and stops, leaving earlier ones applied
 *
 * Concurrency is handled with a session advisory lock, so two instances
 * starting at the same time cannot both apply the same file — a real failure
 * mode when a deployment scales to two replicas.
 */

/** Arbitrary but fixed: identifies *this* runner's lock, not any other. */
const ADVISORY_LOCK_KEY = 4_113_559_201;

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(
    private readonly pool: Pool,
    private readonly directory: string,
  ) {}

  async run(): Promise<MigrationResult> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
      await this.ensureLedger(client);

      const files = await this.migrationFiles();
      const already = await this.appliedVersions(client);

      const applied: string[] = [];
      const skipped: string[] = [];

      for (const file of files) {
        if (already.has(file)) {
          skipped.push(file);
          continue;
        }

        const sql = await readFile(join(this.directory, file), 'utf8');

        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          // Stop at the first failure. Continuing would apply migrations out of
          // order against a schema that is no longer what they expect.
          throw new Error(
            `Migration ${file} failed and was rolled back: ${(error as Error).message}`,
          );
        }

        applied.push(file);
        this.logger.log(`Applied ${file}`);
      }

      if (applied.length === 0) {
        this.logger.log(`Schema up to date (${skipped.length} migration(s) already applied)`);
      }

      return { applied, skipped };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
      client.release();
    }
  }

  /**
   * The ledger is created by the runner rather than by a migration, because a
   * migration cannot record itself before the table it records into exists.
   */
  private async ensureLedger(client: { query: Pool['query'] }): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     TEXT        PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  private async appliedVersions(client: { query: Pool['query'] }): Promise<Set<string>> {
    const result = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    return new Set(result.rows.map((row) => row.version));
  }

  private async migrationFiles(): Promise<string[]> {
    try {
      const entries = await readdir(this.directory);
      return entries.filter((name) => name.endsWith('.sql')).sort();
    } catch (error) {
      // No directory yet is a legitimate state: a foundation with no schema.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
}
