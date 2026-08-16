/*
 * @thg/capability-potential-customers — THG's sales-side business capability.
 *
 * The first library in this workspace that carries tenant vocabulary. Platform
 * libraries stay clean of it; a different company ships its own capability
 * modules and reuses everything under @backoffice/*.
 */

export * from './lib/models/potential-customer';
export * from './lib/data-access/potential-customer.repository';
export * from './lib/data-access/fixture-potential-customer.repository';

export * from './lib/ui/customer-vocabulary';
export * from './lib/ui/customer-status.badge';

export * from './lib/potential-customers.capabilities';
