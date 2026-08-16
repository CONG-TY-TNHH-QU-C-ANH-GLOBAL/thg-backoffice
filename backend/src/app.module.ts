import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './infrastructure/health/health.module';

/**
 * THE COMPOSITION ROOT — the only file that knows the whole system.
 *
 * Three kinds of module land here and the order below reflects the dependency
 * direction the whole codebase is built on:
 *
 *   config/          the validated environment
 *   infrastructure/  technology adapters — database, health, later auth/storage
 *   core/            the Backoffice Foundation itself         (Phase 1 onward)
 *   capabilities/    optional business modules, per project    (empty by design)
 *
 * `core/` defines ports; `infrastructure/` implements them; this file is where
 * the two are wired together. That is why core never imports infrastructure —
 * if it did, swapping a password provider for OIDC would mean editing the
 * foundation.
 *
 * A deployment with zero capabilities is a valid deployment. The foundation has
 * to be useful on its own, or it is not a foundation.
 */
@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule],
})
export class AppModule {}
