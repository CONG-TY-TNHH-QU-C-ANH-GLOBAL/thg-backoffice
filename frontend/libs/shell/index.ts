/*
 * @bo/shell — application chrome and routing plumbing.
 *
 * It asks core four questions and no more: who is signed in, which units they
 * may enter, what navigation was contributed, and which workspace their persona
 * gets. It imports no feature and knows no business terms.
 *
 * It also owns no authorization: guards moved to `@bo/core` access/, next to
 * the rules they enforce, so there is exactly one place to read.
 */

export * from './layout/shell';
export * from './layout/sidebar';
export * from './layout/topbar';
export * from './layout/persona-switcher';
export * from './layout/page-title';
export * from './layout/viewport';

export * from './navigation/navigation.model';
export * from './navigation/navigation.service';

export * from './workspace/workspace-host';

export * from './routing/capability-routes';
export * from './routing/capability-outlet';
export * from './routing/no-access.page';
export * from './routing/placeholder.page';
