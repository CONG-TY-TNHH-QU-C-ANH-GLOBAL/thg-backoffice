import { InjectionToken, Provider } from '@angular/core';
import { Role } from '@bo/services';

/**
 * Fixed navigation entries a tenant wants in the sidebar — overview, inbox,
 * settings, whatever that customer's product calls them.
 *
 * The shell renders whatever it is given. It does not know what any of these
 * pages contain, and it deliberately holds NO default list, so a different
 * company ships a different sidebar with zero shell changes.
 *
 * Department entries are NOT declared here: they come from runtime data.
 */
export interface ShellNavItem {
  label: string;
  icon: string;
  link: string;
  /** Personas that see it. Omit for everyone. */
  roles?: Role[];
  /**
   * Small count on the right.
   * ponytail: a static number from configuration. Make it a Signal when the
   * counts come from live data.
   */
  badge?: number;
}

export interface ShellNavigation {
  /** Above the department list. */
  primary: ShellNavItem[];
  /** Below the department list. */
  secondary: ShellNavItem[];
}

export const SHELL_NAVIGATION = new InjectionToken<ShellNavigation>('SHELL_NAVIGATION');

export function provideShellNavigation(navigation: ShellNavigation): Provider {
  return { provide: SHELL_NAVIGATION, useValue: navigation };
}
