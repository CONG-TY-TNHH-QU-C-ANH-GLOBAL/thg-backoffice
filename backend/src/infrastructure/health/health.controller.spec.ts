import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppConfig } from '../../config/app.config';
import { DatabaseService } from '../database/database.service';
import { APP_GUARD } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { HealthController } from './health.controller';

/**
 * Both branches matter, and the down branch matters more.
 *
 * A health endpoint that answers 200 whatever happens is an endpoint that
 * never removes a broken instance from rotation — the load balancer reads the
 * status code, not the body. These tests exist to keep that true.
 *
 * No Docker and no PostgreSQL: the database is stubbed, so this runs anywhere,
 * including a CI box with nothing installed.
 */
describe('HealthController', () => {
  let app: INestApplication;
  let reachable: boolean;

  beforeEach(async () => {
    reachable = true;

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DatabaseService, useValue: { isReachable: async () => reachable } },
        { provide: AppConfig, useValue: { nodeEnv: 'test' } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers 200 and ok when the database is reachable', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database).toBe('up');
    expect(response.body.environment).toBe('test');
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });

  it('answers 503 — not 200 — when the database is unreachable', async () => {
    reachable = false;

    const response = await request(app.getHttpServer()).get('/health').expect(503);

    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.database).toBe('down');
  });

  it('carries no guard, so a probe can run before the app is healthy', async () => {
    /**
     * Asserting the wiring, not the response.
     *
     * The previous version of this test issued an unauthenticated GET and
     * expected 200 — which is what the two tests above already do, and which
     * proves nothing about authentication: no guard was ever registered for it
     * to get past. It would have stayed green on the day someone protected this
     * endpoint, because the test module never had a guard either.
     *
     * What actually has to hold is that neither the controller nor its handler
     * declares a guard. Nest records those under `__guards__`, so that is what
     * gets checked. This goes red the moment @UseGuards appears on either.
     */
    const onController = Reflect.getMetadata('__guards__', HealthController);
    const onHandler = Reflect.getMetadata('__guards__', HealthController.prototype.check);

    expect(onController ?? []).toEqual([]);
    expect(onHandler ?? []).toEqual([]);

    /**
     * The other way this endpoint could become authenticated: a guard bound
     * globally with APP_GUARD, which no amount of controller metadata would
     * show. Checked statically against the real AppModule rather than by
     * booting it — booting pulls in configuration and a database pool, and this
     * suite is meant to run on a machine with neither.
     */
    const providers: Array<{ provide?: unknown }> =
      Reflect.getMetadata('providers', AppModule) ?? [];

    expect(providers.filter((provider) => provider?.provide === APP_GUARD)).toEqual([]);

    // And it answers with no cookie and no headers at all.
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body.checks.database).toBe('up');
  });
});
