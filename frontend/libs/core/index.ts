/*
 * @bo/core — organization model, access rules and composition
 * contracts. Zero UI, zero transport, zero tenant vocabulary.
 */

export * from './models/organization';
export * from './models/branding';

export * from './capability/capability.model';
export * from './capability/capability.registry';

export * from './workspace/workspace.model';
export * from './workspace/workspace.registry';
export * from './workspace/workspace-context';

export * from './org/department.repository';
export * from './org/org.store';

export * from './session/session.repository';
export * from './session/session.store';

export * from './access/access.service';
export * from './access/record-access';
export * from './access/can.directive';

export * from './bootstrap';
