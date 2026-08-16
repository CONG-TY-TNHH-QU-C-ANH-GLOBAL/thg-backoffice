/*
 * @bo/core — who is acting, what they may do, and what has been registered.
 *
 * Frontend application infrastructure: identity, authorization, the plugin
 * composition mechanism, and the organization model they all speak about.
 * Zero transport, zero tenant vocabulary, zero business logic.
 *
 * The one boundary worth knowing: `access/rules/` holds pure functions with no
 * Angular, no RxJS and no DI, because a TypeScript backend is meant to import
 * that folder and enforce exactly the same rules. Everything else here is the
 * Angular wiring those rules must stay ignorant of.
 */

// --- model ------------------------------------------------------------------
export * from './models/organization.model';
export * from './models/owned-record.model';
export * from './branding/branding';

// --- authorization ----------------------------------------------------------
// Rules first: they are the contract. The Angular pieces below only apply them.
export * from './access/rules/scope';
export * from './access/rules/unit-access';
export * from './access/rules/record-access';
export * from './access/access.service';
export * from './access/access.guards';
export * from './access/can.directive';

// --- identity ---------------------------------------------------------------
export * from './identity/session.repository';
export * from './identity/session.store';

// --- organization -----------------------------------------------------------
export * from './org/department.repository';
export * from './org/org.store';

// --- composition ------------------------------------------------------------
// How a capability registers itself, and how registered things get rendered.
export * from './composition/capability.model';
export * from './composition/capability.registry';
export * from './composition/workspace.model';
export * from './composition/workspace.registry';
export * from './composition/workspace-context';
export * from './composition/widget-host';
export * from './composition/lazy-widget';

export * from './bootstrap';
