import { Branding } from '@bo/core';

/**
 * THG's identity. Everything visual that says "THG" lives here — swap this
 * object (and the fixtures) and the same platform ships to another company.
 */
export const THG_BRANDING: Branding = {
  productName: 'THG Backoffice',
  monogram: 'THG',
  accent: 'blue',
  version: 'v2.6.1',
  copyright: '© 2024 THG Fulfill. All rights reserved.',
  theme: {
    // Overrides on top of the ui-kit defaults; omit to inherit them.
    '--c-primary': '#2563eb',
    '--c-primary-600': '#1d4ed8',
  },
};
