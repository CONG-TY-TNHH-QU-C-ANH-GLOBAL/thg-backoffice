import { Role } from '../access/rules/scope';

/**
 * Organization model. Deliberately free of any tenant's business vocabulary —
 * a department here is a row of data, never a name baked into the code.
 */

/** Key of a capability registered in the capability registry. */
export type CapabilityKey = string;

export type Accent = 'blue' | 'teal' | 'rose' | 'amber' | 'violet' | 'green' | 'slate';

/** Who is acting, and where they sit in the organization. */
export interface UserContext {
  userId: string;
  name: string;
  title: string;
  role: Role;
  /** undefined for SUPERADMIN — they sit above departments. Required otherwise. */
  departmentId?: string;
  avatarUrl?: string;
}

export interface Department {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  accent: Accent;
  active: boolean;
  headId: string | null;
  memberCount: number;
  /** Configuration: which registered capabilities this department may use. */
  capabilities: CapabilityKey[];
}

/** A person inside a department, used for assignment and workload views. */
export interface Member {
  userId: string;
  departmentId: string;
  name: string;
  title: string;
  role: Role;
  avatarUrl?: string;
}
