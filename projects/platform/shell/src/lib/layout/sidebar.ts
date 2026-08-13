import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BRANDING } from '@backoffice/domain';
import { Icon, accentVars } from '@backoffice/ui-kit';
import { NavigationService } from '../navigation/navigation.service';

/**
 * Navigation is assembled from data only: tenant-declared fixed items plus the
 * departments this persona may enter, each expanded with the capability
 * presentations registered for that persona. There is no list of department
 * names anywhere in this file — that is the whole point.
 */
@Component({
  selector: 'bo-sidebar',
  imports: [Icon, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.rail]': 'rail()', '[class.open]': 'open()' },
  template: `
    <a class="brand" routerLink="/">
      <span class="mark" [style]="brandVars">{{ branding.monogram }}</span>
      @if (!rail()) {
        <span class="name">{{ branding.productName }}</span>
      }
    </a>

    <nav>
      @for (item of nav.primary(); track item.link) {
        <a
          class="item"
          [routerLink]="item.link"
          routerLinkActive="item--active"
          [routerLinkActiveOptions]="{ exact: item.link === '/' }"
          [title]="item.label"
        >
          <bo-icon [name]="item.icon" />
          @if (!rail()) {
            <span class="label">{{ item.label }}</span>
            @if (item.badge) {
              <span class="count">{{ item.badge }}</span>
            }
          }
        </a>
      }

      @if (nav.departments().length) {
        <hr />
        @for (group of nav.departments(); track group.department.id) {
          <a
            class="item"
            [routerLink]="group.link"
            routerLinkActive="item--active"
            [title]="group.department.name"
          >
            <bo-icon [name]="group.department.icon" />
            @if (!rail()) {
              <span class="label">{{ group.department.name }}</span>
              @if (group.children.length) {
                <button
                  class="toggle"
                  type="button"
                  [attr.aria-expanded]="isExpanded(group.department.id, group.expandedByDefault)"
                  [attr.aria-label]="'Mở rộng ' + group.department.name"
                  (click)="toggle($event, group.department.id, group.expandedByDefault)"
                >
                  <bo-icon
                    [name]="
                      isExpanded(group.department.id, group.expandedByDefault)
                        ? 'chevron-down'
                        : 'chevron-right'
                    "
                    [size]="14"
                  />
                </button>
              }
            }
          </a>

          @if (!rail() && isExpanded(group.department.id, group.expandedByDefault)) {
            <div class="children">
              @for (child of group.children; track child.link) {
                <a class="child" [routerLink]="child.link" routerLinkActive="child--active">
                  <bo-icon [name]="child.icon" [size]="14" />
                  <span class="label">{{ child.label }}</span>
                </a>
              } @empty {
                <p class="child child--empty">Chưa có năng lực nào được cấp</p>
              }
            </div>
          }
        }
      }

      @if (nav.secondary().length) {
        <hr />
        @for (item of nav.secondary(); track item.link) {
          <a class="item" [routerLink]="item.link" routerLinkActive="item--active" [title]="item.label">
            <bo-icon [name]="item.icon" />
            @if (!rail()) {
              <span class="label">{{ item.label }}</span>
              @if (item.badge) {
                <span class="count">{{ item.badge }}</span>
              }
            }
          </a>
        }
      }
    </nav>

    @if (!rail()) {
      <footer>
        <p>{{ branding.productName }} {{ branding.version }}</p>
        <p>{{ branding.copyright }}</p>
      </footer>
    }
  `,
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly rail = input(false);
  readonly open = input(false);

  protected readonly nav = inject(NavigationService);
  protected readonly branding = inject(BRANDING);
  protected readonly brandVars = accentVars(this.branding.accent);

  /** Only departments the user explicitly toggled are tracked; the rest follow the default. */
  private readonly overrides = signal<Record<string, boolean>>({});

  protected isExpanded(departmentId: string, fallback: boolean): boolean {
    return this.overrides()[departmentId] ?? fallback;
  }

  protected toggle(event: Event, departmentId: string, fallback: boolean): void {
    event.preventDefault();
    event.stopPropagation();
    const next = !this.isExpanded(departmentId, fallback);
    this.overrides.update((state) => ({ ...state, [departmentId]: next }));
  }
}
