import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { DomainErrorFilter } from './common/http/domain-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(AppConfig);
  app.useLogger([config.logLevel]);

  // Lets OnApplicationShutdown run, so the pool closes instead of leaving
  // connections for PostgreSQL to time out.
  app.enableShutdownHooks();

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
