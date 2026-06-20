# FleetOS v1.0.0

**Release name:** FleetOS Production Release  
**Status:** Production  
**Support level:** Stable  
**Release candidate:** 1.0.0-rc1

## Platform Overview

FleetOS is a fleet operations and governance platform for executive visibility across compliance, maintenance, tire management, and audit governance. Version 1.0.0 delivers a unified panel with operational centers, analytics, alerts, and executive dashboards.

## Included Modules

### Compliance Center
Document lifecycle, expiration engine, notifications, dashboard widget, and analytics.

### Maintenance Center
Maintenance CRUD, vehicle history, scheduler, alerts, and analytics.

### Tire Management
Tire inventory, change history, seasonal planning, alerts, and analytics.

### Audit Governance
Audit logs, change history, diff engine, executive dashboard, and audit analytics.

## Dashboard

- **Executive Dashboard** — Ana Ekran command center
- **Compliance Widget** — fleet document risk summary
- **Maintenance Widget** — plan and maintenance risk signals
- **Tire Widget** — seasonal and inventory overview
- **Audit Widget** — İşlem Aktivitesi with 24h KPIs and latest actions

## Analytics

- Compliance Analytics (`/compliance-analytics`)
- Maintenance Analytics (`/maintenance-analytics`)
- Tire Analytics (`/tire-analytics`)
- Audit Analytics (`/audit-analytics`)

## Governance

- Audit Logs with filters and formatted diffs
- Field-level change history on updates
- Grouped before/after diff engine
- Executive Audit Dashboard widget
- Denetim Analitiği for operational audit intelligence

## Stability

- **STB-1** stabilization sprint completed
- **RC-1** release candidate validated
- Full regression suite passing across CC, MNT, TYR, AUD, STB, and RC phases

## Production Readiness

FleetOS v1.0.0 is certified **production ready** for operational use with documented known limitations. Support level: **stable**.

## Known Limitations

See `data/release/known-issues.json` for the authoritative register. Summary:

- Vehicle CRUD is not integrated with audit logging
- Maintenance schedule rules and alert read-state are not audited
- Fuel/HGS governance is partially covered
- No role-based permissions or approval workflows
- No audit export or formal reporting engine
- Minor UI terminology inconsistencies in compliance analytics and vehicles nav

These limitations are documented and do not block production deployment for the intended v1.0.0 scope.
