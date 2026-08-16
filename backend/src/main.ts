import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { DomainErrorFilter } from './common/http/domain-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  const config = app.get(AppConfig);
  app.useLogger([config.logLevel]);

  // Lets OnApplicationShutdown run, so the pool closes instead of leaving
  // connections for PostgreSQL to time out.
  app.enableShutdownHooks();

  // The session cookie is the only credential transport, so parsing cookies is
  // not optional plumbing here.
  app.use(cookieParser());

  // Stops advertising the framework and version — free reconnaissance otherwise.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  /**
   * CORS stays OFF.
   *
   * This API is same-origin with its client by design. Leaving CORS closed is
   * what makes the CSRF reasoning hold: a cross-origin script cannot add the
   * required header without a preflight, and there is no preflight to answer.
   * Opening it to another origin means revisiting CsrfGuard and SameSite.
   */

  /**
   * Behind a reverse proxy, trust exactly one hop so `req.ip` is the client
   * rather than the proxy — the login throttle keys on it. `true` would let a
   * caller forge X-Forwarded-For and mint themselves a fresh budget.
   */
  app.set('trust proxy', 1);

  app.useGlobalFilters(new DomainErrorFilter());

  // No request-validation pipe yet, on purpose: Phase 0 has no endpoint that
  // accepts a body, so a global ValidationPipe would validate nothing while
  // pulling in class-validator and class-transformer. The first endpoint that
  // takes input decides — and `zod` is already here for the environment, so
  // one validation library is the likely answer rather than a second.

  await app.listen(config.port);

  new Logger('Bootstrap').log(
    `Backoffice Foundation listening on :${config.port} (${config.nodeEnv})`,
  );
}

void bootstrap();
