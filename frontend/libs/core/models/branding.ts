import { InjectionToken } from '@angular/core';
import { Accent } from './organization';

/**
 * Everything tenant-specific about the chrome. The platform reads this; it
 * never hard-codes a company name, logo or palette. Swapping tenants is a
 * change to one provider in the app's composition root.
 */
export interface Branding {
  productName: string;
  /** Short mark shown in the sidebar logo tile. */
  monogram: string;
  accent: Accent;
  version: string;
  copyright: string;
  /** CSS custom properties applied to :root, e.g. { '--c-primary': '#2563eb' }. */
  theme?: Record<string, string>;
}

export const BRANDING = new InjectionToken<Branding>('BRANDING');
