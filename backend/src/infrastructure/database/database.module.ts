import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Global: every module that stores anything needs the pool, and threading it
 * through imports adds noise without adding a boundary.
 *
 * What this module does NOT do is decide *what* is stored. Core and capability
 * modules own their own tables and their own queries; this layer only owns the
 * connection.
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
