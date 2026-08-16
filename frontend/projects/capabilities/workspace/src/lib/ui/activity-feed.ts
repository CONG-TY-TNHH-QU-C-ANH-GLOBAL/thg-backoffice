import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { OrgStore } from '@backoffice/domain';
import { EmptyState, Icon, RelativeTimePipe, accentVars } from '@backoffice/ui-kit';
import { ActivityItem } from '../models/overview';

/** Recent activity, labelled with the department it came from. */
@Component({
  selector: 'bo-activity-feed',
  imports: [EmptyState, Icon, RelativeTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (item of items(); track item.id) {
      <article class="row" [style]="vars(item.departmentId)">
        <span class="tile"><bo-icon [name]="icon(item.departmentId)" [size]="14" /></span>
        <div class="body">
          <p class="head">
            <strong>{{ name(item.departmentId) }}</strong>
            <time>{{ item.at | boRelativeTime }}</time>
          </p>
          <p class="what">{{ item.actor }} {{ item.action }}</p>
          <p class="target">{{ item.target }}</p>
        </div>
      </article>
    } @empty {
      <bo-empty-state icon="activity" message="Chưa có hoạt động nào." />
    }
  `,
  styleUrl: './activity-feed.scss',
})
export class ActivityFeed {
  readonly items = input.required<readonly ActivityItem[]>();

  private readonly org = inject(OrgStore);

  protected name(id: string) {
    return this.org.byId(id)?.name ?? '—';
  }

  protected icon(id: string) {
    return this.org.byId(id)?.icon ?? 'activity';
  }

  protected vars(id: string) {
    return accentVars(this.org.byId(id)?.accent);
  }
}
