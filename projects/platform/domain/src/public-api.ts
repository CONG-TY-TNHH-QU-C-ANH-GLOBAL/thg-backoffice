/*
 * @backoffice/domain — organization model, access rules and composition
 * contracts. Zero UI, zero transport, zero tenant vocabulary.
 */

export * from './lib/models/organization';
export * from './lib/models/branding';

export * from './lib/capability/capability.model';
export * from './lib/capability/capability.registry';

export * from './lib/workspace/workspace.model';
export * from './lib/workspace/workspace.registry';
export * from './lib/workspace/workspace-context';

export * from './lib/org/department.repository';
export * from './lib/org/org.store';

export * from './lib/session/session.repository';
export * from './lib/session/session.store';

export * from './lib/access/access.service';
export * from './lib/access/record-access';
export * from './lib/access/can.directive';

export * from './lib/bootstrap';
