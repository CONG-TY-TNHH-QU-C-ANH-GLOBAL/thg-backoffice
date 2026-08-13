import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { Viewport } from './viewport';

/** Application chrome: sidebar, topbar, routed content. */
@Component({
  selector: 'bo-shell',
  imports: [RouterOutlet, Sidebar, Topbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-layout]': 'layout()' },
  template: `
    <bo-sidebar [rail]="layout() === 'rail'" [open]="drawerOpen()" />

    @if (layout() === 'drawer' && drawerOpen()) {
      <div class="scrim" (click)="drawerOpen.set(false)"></div>
    }

    <div class="main">
      <bo-topbar [showMenu]="layout() === 'drawer'" (menu)="drawerOpen.set(true)" />
      <main class="content"><router-outlet /></main>
    </div>
  `,
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly router = inject(Router);

  protected readonly layout = inject(Viewport).layout;
  protected readonly drawerOpen = signal(false);

  constructor() {
    // Navigating away must close the drawer, or it covers the page it opened.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.drawerOpen.set(false));
  }
}
