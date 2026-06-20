# FleetOS RC-1

**Version:** 1.0.0-rc1  
**Release name:** FleetOS RC-1  
**Branch:** panel-refactor  
**Status:** Release Candidate

FleetOS RC-1 is the first formal release candidate of the executive fleet operations platform. It consolidates compliance, maintenance, tire, and audit governance into a single panel with executive dashboards, analytics, and stabilization hardening.

## Major Modules

### Compliance Center (CC-1 → CC-6)
- Uygunluk Merkezi with document lifecycle management
- Expiration engine and risk scoring
- Compliance notifications
- Executive compliance dashboard widget
- Compliance analytics

### Maintenance Center (MNT-1 → MNT-5)
- Bakım Merkezi with full CRUD
- Vehicle maintenance history
- KM/date scheduler and plan views
- Maintenance alerts
- Maintenance analytics

### Tire Management (TYR-1 → TYR-5)
- Lastik Merkezi with inventory CRUD
- Tire change history
- Seasonal schedule planner
- Tire alerts
- Tire analytics

### Audit Governance (AUD-1 → AUD-5)
- Append-only audit log foundation
- Field-level change history
- Before/after diff engine
- Executive audit dashboard widget
- Denetim analitiği

## Dashboard Features

- **Compliance Widget** — fleet document risk summary on Ana Ekran
- **Maintenance Widget** — plan risk and upcoming maintenance signals
- **Tire Widget** — seasonal and inventory risk overview
- **Audit Widget (İşlem Aktivitesi)** — 24h activity, critical changes, latest actions

## Analytics

- Uygunluk Analitiği (`/compliance-analytics`)
- Bakım Analitiği (`/maintenance-analytics`)
- Lastik Analitiği (`/tire-analytics`)
- Denetim Analitiği (`/audit-analytics`)

## Governance

- İşlem Geçmişi (`/audit-logs`) with filters and formatted diffs
- Change history on maintenance, tire, and compliance updates
- Grouped before/after diff presentation
- Executive audit summary on dashboard and audit pages

## Stability

- **STB-1** stabilization sprint completed
- Route ordering verified for analytics vs parameterized APIs
- Navigation consistency pass (Filo + Sistem groups)
- Empty-state hardening on major module pages
- Full regression suite: compliance, maintenance, tire, audit, stabilization

## Known Limitations

- Vehicle CRUD is not integrated with the audit log system
- Fuel/HGS actions are only partially represented in audit history
- No role-based permissions or approval workflows
- No audit export or formal reporting engine
- Compliance analytics retains some English UI labels
- Schedule rule changes and alert read-state are not audited

## Release Readiness

RC-1 is marked **release ready** with documented known issues and no open critical defects at time of cut.
