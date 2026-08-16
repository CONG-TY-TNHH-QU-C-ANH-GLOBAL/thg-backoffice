import { Pool } from 'pg';
import { AppConfig } from '../../config/app.config';
import { DatabaseService } from './database.service';

/**
 * What is worth testing here is not "does a query work" — that is PostgreSQL's
 * job — but the three ways a pool gets destroyed in production:
 *
 *   a client checked out and never released      → pool exhausts, app hangs
 *   a COMMIT issued after the work threw         → half-written data
 *   an error path that skips ROLLBACK            → transaction left open
 *
 * All three are invisible until load, which is exactly why they are asserted
 * here rather than found later.
 */


const poolInstance = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => poolInstance),
}));

function newClient(behaviour?: (sql: string) => void) {
  const client = {
    query: jest.fn(async (sql: string) => {
      behaviour?.(sql);
      return { rows: [] };
    }),
    release: jest.fn(),
  };

  return client;
}

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();

    poolInstance.query.mockResolvedValue({ rows: [] });

    const config = { databaseUrl: 'postgres://u:p@localhost:5432/db' } as AppConfig;
    service = new DatabaseService(config);
  });

  it('registers an idle-client error listener, or one dropped connection kills the process', () => {
    // `pool.on('error')` is not decoration: without a listener Node treats an
    // idle-client error as unhandled and takes the whole process down.
    expect(poolInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(Pool).toHaveBeenCalledTimes(1);
  });

  describe('transaction', () => {
    it('commits and releases on success', async () => {
      const client = newClient();
      poolInstance.connect.mockResolvedValue(client);

      const result = await service.transaction(async () => 'done');

      expect(result).toBe('done');
      const issued = client.query.mock.calls.map(([sql]) => sql);
      expect(issued).toEqual(['BEGIN', 'COMMIT']);
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('rolls back — and never commits — when the work throws', async () => {
      const client = newClient();
      poolInstance.connect.mockResolvedValue(client);

      await expect(
        service.transaction(async () => {
          throw new Error('business rule violated');
        }),
      ).rejects.toThrow('business rule violated');

      const issued = client.query.mock.calls.map(([sql]) => sql);
      expect(issued).toEqual(['BEGIN', 'ROLLBACK']);
      expect(issued).not.toContain('COMMIT');
    });

    it('releases the client on the failure path too', async () => {
      const client = newClient();
      poolInstance.connect.mockResolvedValue(client);

      await expect(
        service.transaction(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow();

      // The leak that silently exhausts a pool: released in `finally`, so it
      // happens whichever way the callback ends.
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('reports the original failure even when the rollback itself fails', async () => {
      const client = newClient((sql) => {
        if (sql === 'ROLLBACK') throw new Error('connection terminated');
      });
      poolInstance.connect.mockResolvedValue(client);

      // Both fail, and it is the FIRST one that explains the bug. If the
      // rollback error escaped instead, every log for this class of failure
      // would read "connection terminated" and the real cause would be gone.
      await expect(
        service.transaction(async () => {
          throw new Error('unique constraint violated');
        }),
      ).rejects.toThrow('unique constraint violated');

      // And the client is still returned to the pool despite two failures.
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('isReachable', () => {
    it('is true when the database answers', async () => {
      poolInstance.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      await expect(service.isReachable()).resolves.toBe(true);
    });

    it('is false — and does not throw — when the database does not', async () => {
      poolInstance.query.mockRejectedValue(new Error('ECONNREFUSED'));

      // Must swallow: the health endpoint calls this and has to answer 503
      // rather than propagate a 500.
      await expect(service.isReachable()).resolves.toBe(false);
    });
  });

  it('closes the pool on application shutdown', async () => {
    await service.onApplicationShutdown();
    expect(poolInstance.end).toHaveBeenCalledTimes(1);
  });

  it('boots degraded rather than refusing to start when the database is down', async () => {
    poolInstance.query.mockRejectedValue(new Error('ECONNREFUSED'));

    // A database blip during deploy must not crash-loop the service.
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
