import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppConfig } from '../../config/app.config';
import { DatabaseService } from '../database/database.service';
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

  it('needs no authentication, so a probe can run before the app is healthy', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
