# Capability Map: VELORA Premium MVP

Status: **PROPOSED — awaiting owner approval** (2026-11-17)
Produced by: `/using-agent-skills` → `spec-driven-development` (Phase 0)
Source of truth for requirements: the owner's 971-line master prompt ("VELORA — PREMIUM MVP").

This map exists because the request bundles twelve independently testable capabilities.
Each module gets its own `SPEC-<id>.md` when its turn comes; this file is the index.

## Modules

| Module id | Responsibility | Depends on |
|---|---|---|
| `foundation` | Repo, toolchain, env management, CI, migration runner, local DB harness | — |
| `database` | Schema, migrations, constraints, indexes, RLS policies, seed | `foundation` |
| `identity` | Supabase Auth, customer/administrator roles, RBAC, audit log | `database` |
| `brand` | Logo system (mark + wordmark + variants), colour tokens, type system, brand guidelines | — |
| `i18n` | Locale routing (ar-BH / en), message catalogues, RTL/LTR architecture, BHD & date formatting | `foundation`, `brand` |
| `design-system` | UI primitives, page shell (header/nav/footer), form/empty/error/loading states | `brand`, `i18n` |
| `catalogue` | Template + category + asset model; browse, filter, search, detail; admin CRUD | `database`, `design-system`, `i18n` |
| `studio` | Wedding Studio editor: invitation content model, design configuration schema, undo/redo, autosave | `catalogue`, `identity` |
| `renderer` | Single invitation rendering engine used by *both* live preview and the final customer-facing view | `studio` |
| `commerce` | Pricing engine, add-ons, discounts, tax, order lifecycle, WhatsApp handoff | `database`, `renderer`, `identity` |
| `payments` | Provider abstraction, transaction records, manual recording, refunds, reconciliation | `commerce` |
| `admin` | Dashboard metrics, order/template/pricing/customer/transaction management, CMS, settings, audit views | `identity`, `catalogue`, `commerce`, `payments` |
| `quality` | Functional, security/isolation, RTL, a11y, responsive and contrast test suites (runs continuously, not last) | all (incremental) |

## Build order

```
foundation → database → identity → brand → i18n → design-system
    → catalogue → studio → renderer → commerce → payments → admin
quality: continuous from `database` onward
```

## Mapping to the owner's nine workstreams

| Owner workstream | Modules |
|---|---|
| 01 Brand Identity | `brand`, `i18n` |
| 02 Main Website | `design-system`, `catalogue`, `admin` (CMS), `i18n` |
| 03 Template Library | `catalogue` |
| 04 Wedding Studio | `studio` |
| 05 Live Preview | `renderer` |
| 06 Orders & Pricing | `commerce` |
| 07 Admin Dashboard | `admin` |
| 08 Manual WhatsApp Workflow | `commerce` |
| 09 Payments & Transaction Records | `payments` |

Milestones 1–9 in the master prompt are the *schedule*; these modules are the *unit of work*.
One milestone may span two modules and vice versa.

## Interface boundaries (decided here, to prevent drift)

- `studio` writes a **design configuration document**; it never writes HTML. `renderer` is the only
  module that turns a configuration into a visual invitation. Preview and final output share it —
  the brief forbids a second "fake" preview implementation.
- `commerce` **never** accepts a price from the client. Totals are computed server-side from
  `pricing` rows inside the same transaction that creates the order.
- `payments` **never** marks an order paid. It records a provider or manual *transaction*;
  order status is derived from transactions by `commerce`.
- `admin` reads through the same queries as customer surfaces wherever the data is the same;
  it does not re-implement business logic.

## Deliberately excluded from Phase 1

Everything in the master prompt's §9 out-of-scope list (guest links, RSVP, QR check-in, seating,
WhatsApp Business API, animated invitations, AI writing assistant, multi-country tax).
The schema may *not* pre-build these — extensibility means "no decision blocks them", not
"unused tables now".
