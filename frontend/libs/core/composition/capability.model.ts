import { InjectionToken, Provider, Type } from '@angular/core';
import { Accent, CapabilityKey } from '../models/organization.model';
import { Role } from '../access/rules/scope';

/**
 * A capability is a reusable software module. It is registered once and any
 * department may be configured to use it — the shell never asks "is this
 * Sales?", it asks "does this department have this capability, and what does
 * this persona see when they open it?".
 */

/** What one persona gets when they open a capability. */
export interface CapabilityPresentation {
  /** Persona-facing name: 'Khách hàng tiềm năng' (head) vs 'Khách hàng của tôi' (member). */
  title: string;
  icon?: string;
  load: () => Promise<Type<unknown>>;
}

/** An extra nav entry a capability contributes inside a department workspace. */
export interface NavigationContribution {
  /** Path segment under /departments/:slug. */
  path: string;
  title: string;
  icon: string;
  /** Personas that see it. Omit = every persona that can use the capability. */
  roles?: Role[];
  load: () => Promise<Type<unknown>>;
}

export interface CapabilityDescriptor {
  key: CapabilityKey;
  /** Neutral name, used where no persona context exists (settings, dept cards). */
  title: string;
  icon: string;
  accent: Accent;
  /**
   * Missing role ⇒ that persona does not see this capability at all.
   * This is how a MEMBER loses "Phân công" without a single `if (role === …)`.
   */
  presentations: Partial<Record<Role, CapabilityPresentation>>;
  navigation?: NavigationContribution[];
}

export const CAPABILITY_REGISTRY = new InjectionToken<CapabilityDescriptor[]>('CAPABILITY_REGISTRY');

/** Composition root helper: `provideCapabilities(salesCapabilities, hrCapabilities)`. */
export function provideCapabilities(...groups: readonly CapabilityDescriptor[][]): Provider {
  return { provide: CAPABILITY_REGISTRY, useValue: groups.flat() };
}
