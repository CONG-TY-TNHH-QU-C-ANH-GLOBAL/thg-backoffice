/*
 * @backoffice/capability-workspace — persona dashboards and the department
 * workspace frame. Tenant-neutral: it renders whatever departments and
 * capabilities exist at runtime.
 */

export * from './lib/models/overview';
export * from './lib/data-access/overview.repository';
export * from './lib/data-access/fixture-overview.repository';

export * from './lib/ui/metric-row';
export * from './lib/ui/department-card';
export * from './lib/ui/approval-list';
export * from './lib/ui/activity-feed';
export * from './lib/ui/suggestion-list';

export * from './lib/feature/department/department-workspace.page';
export * from './lib/feature/department/departments.page';

export * from './lib/workspace.capabilities';
