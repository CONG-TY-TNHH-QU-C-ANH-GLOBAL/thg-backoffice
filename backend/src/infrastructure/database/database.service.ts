import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { AppConfig } from '../../config/app.config';

/**
 * The single PostgreSQL connection pool for this deployment.
 *
 * One deployment, one database — there is no tenant routing here and no
 * per-request connection switching, because the database itself is the
 * isolation boundary.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor(config: AppConfig) {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      // Modest by design: a backoffice serves tens of concurrent users, not
      // thousands. Raise it when a measurement says to, not before.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    // A pool error is emitted for idle clients dropped by the server. Without
    // a listener Node treats it as unhandled and takes the process down.
    this.pool.on('error', (error) => {
      this.logger.error(`Idle client error: ${error.message}`);
    });
  }

  /**
   * Reports reachability at boot but does NOT refuse to start.
   *
   * Deliberate: a database blip during a deploy would otherwise crash-loop the
   * service, and a crash-looping instance cannot tell anyone why. Booting
   * degraded means the health endpoint answers 503 — the load balancer keeps
   * this instance out of rotation, the operator sees the reason, and the
   * instance recovers on its own when the database returns.
   *
   * A misconfigured URL still surfaces loudly: this logs an error every boot,
   * and /health never goes green.
   */
  async onModuleInit(): Promise<void> {
    if (await this.isReachable()) {
      this.logger.log('PostgreSQL connection established');
      return;
    }

    this.logger.error(
      'PostgreSQL unreachable at boot — starting in a degraded state. ' +
        '/health will report 503 until the connection succeeds.',
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
    this.logger.log('PostgreSQL pool closed');
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(text, params as unknown[]);
    return result.rows;
  }

  /**
   * Runs `work` inside a transaction, rolling back on any throw.
   *
   * Takes a callback rather than exposing begin/commit so a caller cannot leak
   * a client by forgetting to release it — the failure mode that silently
   * exhausts the pool under load.
   */
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /** True when the database answers. Used by the health endpoint. */
  async isReachable(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
