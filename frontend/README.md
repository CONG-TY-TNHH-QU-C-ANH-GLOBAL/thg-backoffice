# THG Backoffice — Frontend

Angular 20 client for THG's internal operations platform. Slice 1: architecture
proven end to end, client-side only, no backend involved.

```bash
npm start           # dev server on :4200
npm run build       # production app bundle
npm run build:libs  # package every library with ng-packagr (dependency order)
npm test            # access-rule specs (needs Chrome)
```

---

## The two ideas everything follows from

**1. Departments are data, capabilities are code.**

```
Department        runtime record  (fixture today, API tomorrow — never hard-coded)
Capability        reusable module (one Angular library, registered through DI)
Dept × Capability configuration   (Department.capabilities: string[])
```

Nothing in the platform knows the words "Sales" or "Marketing". Add a department
to `projects/backoffice/src/app/tenant/fixtures/departments.fixture.ts` and it
appears in navigation, routing, the department directory and dashboards — that
one file is the whole diff.

**2. Role selects a workspace, it does not hide buttons.**

```
SUPERADMIN       → Organization Workspace     → "Công ty đang vận hành thế nào?"
DEPARTMENT_HEAD  → Department Control Center  → "Phòng của tôi vận hành thế nào?"
MEMBER           → Personal Work Desk         → "Hôm nay tôi cần làm gì?"
```

Three separate components behind one URL, resolved by `WorkspaceHost`. A member
has no "Phân công" button to hide because no assignment surface is registered
for that persona in the first place.

### Two access layers, deliberately not merged

| Layer | Question | Where |
|---|---|---|
| **L1 — department isolation** | Which departments may I enter? | `AccessService` |
| **L2 — record ownership** | Whose records may I read in one? | `canSeeRecord()`, applied in repositories |

L1: superadmin → all; head and member → their own department only.
L2: superadmin and head → every record in reach; member → only rows assigned to them.

Collapsing these into one ranked "scope" is what leads to the shared-dashboard
anti-pattern, so they stay separate functions with separate tests.

---

## Layout

```
projects/
├── backoffice/                  APP — composition root only (~8 files)
│   └── src/app/
│       ├── app.config.ts        binds every repository, registers capabilities
│       ├── app.routes.ts
│       └── tenant/              branding, navigation, fixtures — THG-specific
│
├── platform/                    @backoffice/*  — reusable across companies
│   ├── domain/                  models, access rules, registries, repo contracts
│   ├── ui-kit/                  design tokens + presentational components
│   └── shell/                   layout, dynamic navigation, guards, hosts
│
└── capabilities/
    ├── workspace/               @backoffice/capability-workspace  (neutral)
    ├── worklist/                @backoffice/capability-worklist   (neutral)
    └── potential-customers/     @thg/capability-potential-customers (THG)
```

`@backoffice/*` carries no tenant vocabulary — that is what makes the platform
sellable to another company. `@thg/*` is where THG's business lives.

Each capability owns its own layers internally:

```
capabilities/potential-customers/src/lib/
├── models/       PotentialCustomer  (UNASSIGNED | ASSIGNED | CONVERTED | CLOSED)
├── data-access/  PotentialCustomerRepository + Fixture… + fixtures/
├── ui/           dumb components shared by both personas
└── feature/
    ├── head/     pool + assignment + team workload
    └── member/   my customers + onboarding + follow-up
```

Head and member **share** the model and the repository; only `feature/` differs.

### Dependency rule

```
backoffice (app)  →  platform/*, capabilities/*
capabilities/*    →  platform/domain, platform/ui-kit
platform/shell    →  platform/domain, platform/ui-kit
platform/domain   →  ∅
platform/ui-kit   →  ∅

shell ↛ capabilities        capability A ↛ capability B        platform ↛ THG
```

The shell asks four questions and no more: who is signed in, which departments
they may enter, what navigation was contributed, which workspace their persona
gets. It cannot contain `if (department === …)` because it cannot see a
capability at all.

---

## How a capability plugs in

A capability library exports a manifest; the app composes manifests; the shell
reads the result. Nothing imports a page directly, so every surface lazy-loads.

```ts
export const potentialCustomerCapabilities: CapabilityDescriptor[] = [{
  key: 'potential-customers',
  title: 'Khách hàng tiềm năng',
  icon: 'users',
  accent: 'blue',
  presentations: {
    // Same capability, same repository — different page per persona.
    DEPARTMENT_HEAD: { title: 'Khách hàng tiềm năng', load: () => import('…/head/…') },
    MEMBER:          { title: 'Khách hàng của tôi',   load: () => import('…/member/…') },
  },
}];
```

A missing role in `presentations` means that persona never sees the capability —
not in navigation, not in tabs, and the route guard refuses it.

Dashboard panels arrive the same way:

```ts
export const potentialCustomerWidgets: WorkspaceWidget[] = [
  { id: 'customer-pool', capability: 'potential-customers',
    role: 'DEPARTMENT_HEAD', order: 10, span: 2, load: () => import('…') },
];
```

A widget renders only if its capability is enabled for the department in play.

---

## Data access

No HTTP, no mock interceptor, no fake API. Every capability talks to an abstract
repository; the app binds it to a fixture implementation:

```ts
// projects/backoffice/src/app/app.config.ts — the only file that knows
{ provide: PotentialCustomerRepository, useClass: FixturePotentialCustomerRepository },
```

Going live means changing that line to `HttpPotentialCustomerRepository`. No
feature component is touched, because none of them ever learn which
implementation they hold.

Fixtures enforce the same ownership rules the server will, so what you see in
the demo is what a real user would get.

---

## Verified

Run `npm start`, then use the persona switcher in the topbar (visible only
because the fixture `SessionRepository` returns a persona list — a production
one returns `[]` and the control disappears).

| | Result |
|---|---|
| **A · Superadmin** (Vương Nguyên Hảo) | 6 departments including Legal · organization dashboard · department cards from runtime data |
| **B · Head Sales** (Huyền Trang) | sidebar shows Sales only · department control centre · customer pool, team workload, assignment |
| **C · Sales A** | different dashboard entirely · my customers, today's priorities, onboarding · no assignment, no team management |
| **D · Ownership** | Sales A sees 5 customers (only theirs) with 0 assign controls; Head Sales sees all 17 plus the 6-strong pool |
| **E · New department** | `Legal` renders a working workspace with its own 3 tabs — fixture-only change |
| **F · White-label** | `tenant/branding.ts` + token overrides re-skin everything; `platform/*` untouched |

`npm test` → 11 specs covering L1 isolation, per-persona presentations and L2
ownership. Responsive checked at 1440 (full), 1024 (icon rail) and 390 (drawer).
Zero console errors on every persona.

## Design system notes

Elevation is declared once: cards carry a hairline border and no shadow, so the
shadow scale still means "this floats" when a menu or drawer uses it. Accents
ship as solid/soft pairs (`--c-teal` / `--c-teal-soft`) and components read them
through `accentVars()` rather than branching on a colour name. Controls size
from `--control-h`, which coarse pointers raise to 40px automatically.

Below 900px every data table drops its header and becomes labelled blocks, so a
phone shows every column a desktop shows instead of hiding the secondary ones.

Two detector warnings are deliberate: the avatar's `img` is inside an `@if` on
its own source and never ships empty, and Inter stays as the UI face — it has
the tabular figures and the full Vietnamese diacritic coverage this interface
needs, which the "distinctive display face" advice would cost us.

---

## Not in this slice

Full Requests / Approvals / Documents / Reports / AI pages (routed to an honest
placeholder), settings and department administration, PWA, i18n, dark mode,
login (the gateway owns authentication — `SessionRepository` is the boundary).

**Out of scope permanently**: order creation and processing, warehouse
operations, tracking, inventory, wallet. Those belong to the Hub; Backoffice
only ever mirrors status from them.
