import { Injectable, computed, inject } from '@angular/core';
import { CapabilityRegistry } from '../capability/capability.registry';
import { CapabilityDescriptor, CapabilityPresentation } from '../capability/capability.model';
import { CapabilityKey, Department, Role } from '../models/organization';
import { OrgStore } from '../org/org.store';
import { SessionStore } from '../session/session.store';

/**
 * LEVEL 1 — department isolation. The single place that answers "may this
 * person enter this department, and what does their persona see there?".
 *
 *   SUPERADMIN      → every department
 *   DEPARTMENT_HEAD → their own department only
 *   MEMBER          → their own department only
 *
 * Record ownership inside a department is a different question — see
 * record-access.ts. The two are never merged into one ranked scope.
 */
@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly session = inject(SessionStore);
  private readonly org = inject(OrgStore);
  private readonly registry = inject(CapabilityRegistry);

  readonly role = this.session.role;
  readonly isSuperadmin = this.session.isSuperadmin;

  /** Head Sales must not see Marketing, Operations, Finance or IT. */
  readonly visibleDepartments = computed<Department[]>(() => {
    const departments = this.org.departments();
    if (this.session.isSuperadmin()) return departments;
    const own = this.session.departmentId();
    return departments.filter((d) => d.id === own);
  });

  /** The department a head/member lives in; for a superadmin, none in particular. */
  readonly ownDepartment = computed<Department | undefined>(() =>
    this.org.byId(this.session.departmentId()),
  );

  canViewDepartment(departmentId: string | undefined): boolean {
    if (!departmentId) return false;
    if (this.session.isSuperadmin()) return true;
    return departmentId === this.session.departmentId();
  }

  /** Only a head configures their own department; a superadmin configures any. */
  canConfigureDepartment(departmentId: string): boolean {
    if (this.session.isSuperadmin()) return true;
    return this.session.isHead() && departmentId === this.session.departmentId();
  }

  /**
   * Enabled on the department ∩ registered in code ∩ has a presentation for
   * this persona. Registry order wins so navigation is stable.
   */
  capabilitiesFor(department: Department | undefined, role: Role = this.role()): CapabilityDescriptor[] {
    if (!department || !this.canViewDepartment(department.id)) return [];
    const enabled = new Set(department.capabilities);
    return this.registry.all().filter((c) => enabled.has(c.key) && !!c.presentations[role]);
  }

  canUseCapability(department: Department | undefined, key: CapabilityKey): boolean {
    return this.capabilitiesFor(department).some((c) => c.key === key);
  }

  /** What this persona actually opens for a capability. */
  presentationFor(key: CapabilityKey, role: Role = this.role()): CapabilityPresentation | undefined {
    return this.registry.byKey(key)?.presentations[role];
  }

  /** Capabilities a head could still propose to the superadmin. */
  proposableCapabilities(department: Department): CapabilityDescriptor[] {
    return this.registry.all().filter((c) => !department.capabilities.includes(c.key));
  }
}
