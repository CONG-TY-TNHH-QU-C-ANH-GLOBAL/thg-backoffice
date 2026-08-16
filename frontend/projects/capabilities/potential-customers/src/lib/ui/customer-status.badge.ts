import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Badge } from '@backoffice/ui-kit';
import { PotentialCustomerStatus } from '../models/potential-customer';
import { STATUS } from './customer-vocabulary';

@Component({
  selector: 'thg-customer-status',
  imports: [Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<bo-badge [tone]="view().tone" [dot]="true">{{ view().label }}</bo-badge>`,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class CustomerStatusBadge {
  readonly status = input.required<PotentialCustomerStatus>();
  protected readonly view = computed(() => STATUS[this.status()]);
}
