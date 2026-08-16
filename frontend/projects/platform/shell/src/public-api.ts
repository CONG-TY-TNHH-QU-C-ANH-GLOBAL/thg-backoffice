/*
 * @backoffice/shell — application chrome and routing plumbing.
 *
 * It asks the domain four questions only: who is signed in, which departments
 * they may enter, what navigation was contributed, and which workspace their
 * persona gets. It imports no capability library and knows no business terms.
 */

export * from './lib/layout/shell';
export * from './lib/layout/sidebar';
export * from './lib/layout/topbar';
export * from './lib/layout/persona-switcher';
export * from './lib/layout/page-title';
export * from './lib/layout/viewport';

export * from './lib/navigation/navigation.model';
export * from './lib/navigation/navigation.service';

export * from './lib/workspace/workspace-host';
export * from './lib/workspace/widget-host';
export * from './lib/workspace/lazy-widget';

export * from './lib/routing/guards';
export * from './lib/routing/capability-routes';
export * from './lib/routing/capability-outlet';
export * from './lib/routing/no-access.page';
export * from './lib/routing/placeholder.page';
