# Graph Report - Nux-AutoCare  (2026-11-18)

## Corpus Check
- 163 files · ~54,357 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .example 1, .toml 1)

## Summary
- 859 nodes · 2345 edges · 49 communities (33 shown, 16 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Server API Authorization
- Legacy Prisma Schema
- Authentication and Registration
- Paystack Payment Reconciliation
- Dashboard Data Requests
- Architecture and Workflows
- Core Supabase Schema
- Development Tool Dependencies
- Workshop Client Actions
- Workshop Transaction Schema
- Permissions and Workspace Loading
- Sign-in Form and Branding
- React Interface Components
- Workspace Invoice Views
- Runtime Dependencies
- Scheduling and Repair Handover
- TypeScript Compiler Settings
- CI Verification Steps
- M-Pesa Sandbox Payments
- Session Cache and Shell
- Supabase Integration Tests
- Payment Reservation and Settlement
- Embedded Database Verification
- Customer and Garage Dashboard
- Package Scripts
- Docker Application Runtime
- Supabase Session Proxy
- Customer Vehicle Management
- Booking Photos and Tasks
- Dashboard Performance Documentation
- Booking Capacity Test Model
- Tenant Membership Unit Tests
- Account Form Screenshot
- Dependency Build Permissions
- PostCSS Configuration
- Account Uniqueness Requirements
- Workspace Loading Flash
- Sensitive Field Protection
- Exact Money Arithmetic
- Workshop Feature Limits
- Atomic Repair Transition Documentation

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 106 edges
2. `jsonError()` - 101 edges
3. `ApiError` - 90 edges
4. `request()` - 59 edges
5. `requireAuthenticatedUser()` - 54 edges
6. `zod` - 37 edges
7. `camelize()` - 33 edges
8. `vitest` - 29 edges
9. `garageScope()` - 28 edges
10. `api()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Booking photos and garage logos` --semantically_similar_to--> `Authenticated Supabase photo storage`  [INFERRED] [semantically similar]
  README.md → docs/ARCHITECTURE.md
- `Local and integration verification` --conceptually_related_to--> `Embedded PostgreSQL workshop verification`  [INFERRED]
  README.md → docs/WORKSHOP-WORKFLOWS.md
- `Expired subscription read-only requirement` --conceptually_related_to--> `Server identity and tenant authorization`  [INFERRED]
  bug-reports/Issues.md → docs/ARCHITECTURE.md
- `Reported inactive photo upload buttons` --conceptually_related_to--> `Authenticated Supabase photo storage`  [AMBIGUOUS]
  bug-reports/Issues.md → docs/ARCHITECTURE.md
- `Next.js version-specific guidance` --conceptually_related_to--> `Next.js modular monolith`  [INFERRED]
  AGENTS.md → docs/ARCHITECTURE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Private dashboard return-visit caching** — bug_reports_dashboard_performance_bootstrap, bug_reports_dashboard_performance_query_cache, bug_reports_dashboard_performance_cache_invalidation [EXTRACTED 1.00]
- **Provider-verified invoice settlement** — docs_payments_setup_stripe_checkout, docs_payments_setup_mpesa_express, docs_payments_setup_paystack_reconciliation, docs_payments_setup_ambiguous_outcomes [EXTRACTED 1.00]
- **Job-locked workshop mutations** — docs_workshop_workflows_quote_versions, docs_workshop_workflows_parts_movements, docs_workshop_workflows_invoice_idempotency, docs_workshop_workflows_repair_transitions [EXTRACTED 1.00]

## Communities (49 total, 16 thin omitted)

### Community 0 - "Server API Authorization"
Cohesion: 0.06
Nodes (103): zod, { mockGetUser, mockAdminRpc, mockAdminFrom }, POST(), GET(), POST(), schema, GET(), querySchema (+95 more)

### Community 1 - "Legacy Prisma Schema"
Cohesion: 0.06
Nodes (74): "AuditLog", AuditLog_actorId_createdAt_idx, AuditLog_franchiseId_createdAt_idx, "Booking", Booking_customerId_scheduledAt_idx, Booking_franchiseId_shopId_scheduledAt_idx, Booking_reference_key, Booking_status_idx (+66 more)

### Community 2 - "Authentication and Registration"
Cohesion: 0.11
Nodes (26): POST(), POST(), POST(), POST(), resetSchema, GET(), exchange, getServerEnv() (+18 more)

### Community 3 - "Paystack Payment Reconciliation"
Cohesion: 0.13
Nodes (26): POST(), schema, POST(), Webhook, nextBillingMonth(), toPaystackMinorUnits(), verifyPaystackSignature(), createSubaccount() (+18 more)

### Community 4 - "Dashboard Data Requests"
Cohesion: 0.12
Nodes (32): BillingPage(), connectPayouts(), load(), subscribe(), BookingsPage(), decision(), load(), startJob() (+24 more)

### Community 5 - "Architecture and Workflows"
Cohesion: 0.07
Nodes (30): Documentation and repository drift, Reported inactive photo upload buttons, Expired subscription read-only requirement, Next.js modular monolith, Authenticated Supabase photo storage, Production hardening prerequisites, Server identity and tenant authorization, Server-only database access boundary (+22 more)

### Community 6 - "Core Supabase Schema"
Cohesion: 0.14
Nodes (27): bookings_customer_scheduled, bookings_shop_scheduled, jobs_tenant_status, memberships_unique_scope, public.audit_logs, public.bookings, public.create_booking(), public.create_job_from_booking() (+19 more)

### Community 7 - "Development Tool Dependencies"
Cohesion: 0.09
Nodes (30): devDependencies, eslint@^9.38.0, eslint-config-next@^16.0.0, prettier@3.6.2, tailwindcss@^4.1.14, @tailwindcss/postcss@^4.1.14, tsx@^4.20.6, @types/node@^22.18.0 (+22 more)

### Community 8 - "Workshop Client Actions"
Cohesion: 0.11
Nodes (25): Garage, History, HistoryContent(), act(), HistoryPage(), Vehicle, Invitation, InvitationsPage() (+17 more)

### Community 9 - "Workshop Transaction Schema"
Cohesion: 0.13
Nodes (23): public.jobs, assign_scheduled_mechanic, job_parts_job, public.assign_scheduled_mechanic(), public.decide_repair_quote(), public.guard_approved_repair(), public.guard_vehicle_mileage(), public.issue_repair_invoice() (+15 more)

### Community 10 - "Permissions and Workspace Loading"
Cohesion: 0.12
Nodes (18): GET(), GET(), can(), canAccessWorkspacePage(), Capability, grants, pageCapabilities, StaffRole (+10 more)

### Community 11 - "Sign-in Form and Branding"
Cohesion: 0.11
Nodes (19): lucide-react, empty, Item, Shop, AuthForm(), handleResetPassword(), handleUpdatePassword(), onSubmit() (+11 more)

### Community 12 - "React Interface Components"
Cohesion: 0.11
Nodes (18): nextConfig, next, react, sonner, Booking, formatDate(), Shop, statusText (+10 more)

### Community 13 - "Workspace Invoice Views"
Cohesion: 0.14
Nodes (19): react-dom, Bank, BillingSummary, fetchInvoiceData(), Invoice, InvoicesPage(), load(), fixture (+11 more)

### Community 14 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (24): dependencies, decimal.js@^10.6.0, @hookform/resolvers@^5.2.2, lucide-react@^0.548.0, next@^16.0.0, node-cron@^4.2.1, react@^19.2.0, react-dom@^19.2.0 (+16 more)

### Community 15 - "Scheduling and Repair Handover"
Cohesion: 0.10
Nodes (11): public.create_booking(), public.decide_booking(), public.issue_repair_invoice(), public.accept_staff_invitation(), public.record_service_mileage(), public.save_workshop_slot(), public.workshop_bays, public.workshop_slots (+3 more)

### Community 16 - "TypeScript Compiler Settings"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 17 - "CI Verification Steps"
Cohesion: 0.11
Nodes (17): jobs, verify, name, on, pull_request, push, permissions, contents (+9 more)

### Community 18 - "M-Pesa Sandbox Payments"
Cohesion: 0.31
Nodes (10): POST(), POST(), callbackFingerprint(), providerRequest(), reconcileMpesa(), requestStkPush(), requireMpesaConfig(), fixtures (+2 more)

### Community 19 - "Session Cache and Shell"
Cohesion: 0.21
Nodes (12): Layout(), metadata, customerLinks, DashboardShell(), garageLinks, CachedResponse, clearApiCache(), primeApiCache() (+4 more)

### Community 20 - "Supabase Integration Tests"
Cohesion: 0.24
Nodes (6): @supabase/supabase-js, vitest, { url: SUPABASE_URL, publishableKey: SUPABASE_ANON_KEY, secretKey: SERVICE_ROLE_KEY }, { url: SUPABASE_URL, publishableKey: SUPABASE_ANON_KEY }, supabaseTestConfig(), config

### Community 21 - "Payment Reservation and Settlement"
Cohesion: 0.21
Nodes (10): invoices_customer_created, payments_invoice_status, public.invoice_lines, public.invoices, public.payments, payments_one_open_paystack_invoice, public.settle_paystack_invoice_payment(), payments_one_open_online_invoice (+2 more)

### Community 22 - "Embedded Database Verification"
Cohesion: 0.24
Nodes (7): @electric-sql/pglite@0.3.14, @electric-sql/pglite, approve(), prepareRepair(), quote(), quoteLines, scalar()

### Community 23 - "Customer and Garage Dashboard"
Cohesion: 0.36
Nodes (10): Booking, ClientHome(), Dashboard, DashboardPage(), date(), Empty(), GarageHome(), Job (+2 more)

### Community 24 - "Package Scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, start, test, test:integration, test:watch (+1 more)

### Community 25 - "Docker Application Runtime"
Cohesion: 0.25
Nodes (7): build, command, env_file, ports, restart, services, app

### Community 26 - "Supabase Session Proxy"
Cohesion: 0.36
Nodes (5): @supabase/ssr@^0.12.7, config, proxy(), @supabase/ssr, updateSession()

### Community 27 - "Customer Vehicle Management"
Cohesion: 0.32
Nodes (7): empty, Field(), suggestions, Vehicle, VehiclesPage(), load(), submit()

### Community 28 - "Booking Photos and Tasks"
Cohesion: 0.48
Nodes (6): public.repair_photos, public.repair_tasks, repair_photos_booking_created, repair_photos_uploaded_by, repair_tasks_job_position, repair_tasks_updated_at

### Community 29 - "Dashboard Performance Documentation"
Cohesion: 0.40
Nodes (6): Dashboard bootstrap, Write and session cache invalidation, Signed-in deployment performance verification, TanStack Query dashboard cache, Server-Timing latency diagnostics, Repeated-request latency

### Community 30 - "Booking Capacity Test Model"
Cohesion: 0.50
Nodes (4): attemptAtomicBooking(), hasAvailableCapacity(), mockAdminSelect, mockRpc

### Community 33 - "Account Form Screenshot"
Cohesion: 0.67
Nodes (3): First name field displaying Andrew, Last name field displaying Pierce, Screenshot of first name and last name fields

### Community 34 - "Dependency Build Permissions"
Cohesion: 0.67
Nodes (3): allowScripts, esbuild@0.28.2, unrs-resolver@1.12.2

## Ambiguous Edges - Review These
- `Reported inactive photo upload buttons` → `Authenticated Supabase photo storage`  [AMBIGUOUS]
  bug-reports/Issues.md · relation: conceptually_related_to

## Knowledge Gaps
- **18 isolated node(s):** `Local and integration verification`, `Account uniqueness requirements`, `Repeated-request latency`, `Expired subscription read-only requirement`, `Reported inactive photo upload buttons` (+13 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 225 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Supabase Integration Tests` to `Server API Authorization`, `Tenant Membership Unit Tests`, `Authentication and Registration`, `Paystack Payment Reconciliation`, `Development Tool Dependencies`, `Permissions and Workspace Loading`, `Workspace Invoice Views`, `M-Pesa Sandbox Payments`, `Session Cache and Shell`, `Embedded Database Verification`, `Supabase Session Proxy`, `Booking Capacity Test Model`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **What connects `Local and integration verification`, `Account uniqueness requirements`, `Repeated-request latency` to the rest of the system?**
  _18 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server API Authorization` be split into smaller, more focused modules?**
  _Cohesion score 0.056599209868580184 - nodes in this community are weakly interconnected._
- **Why does `zod` connect `Server API Authorization` to `Authentication and Registration`, `Paystack Payment Reconciliation`, `Development Tool Dependencies`, `Permissions and Workspace Loading`, `Sign-in Form and Branding`, `Runtime Dependencies`, `M-Pesa Sandbox Payments`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `Legacy Prisma Schema` be split into smaller, more focused modules?**
  _Cohesion score 0.06126126126126126 - nodes in this community are weakly interconnected._
- **Why does `request()` connect `Dashboard Data Requests` to `Workshop Client Actions`, `Sign-in Form and Branding`, `React Interface Components`, `Workspace Invoice Views`, `Session Cache and Shell`, `Customer and Garage Dashboard`, `Customer Vehicle Management`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Reported inactive photo upload buttons` and `Authenticated Supabase photo storage`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
## Snapshot and accounting limitations

This graph describes the current working tree, including uncommitted fixes and historical migration definitions; base Git commit 4b0d4369dddac3b2a001c46ea0949816d112bd10. It does not establish which code or database migration is deployed.

Host-agent input/output token usage was not exposed by the collaboration tools. The recorded zero semantic token counters are unavailable-value placeholders, not measured zero usage or zero cost. No Gemini API calls were made. One extraction agent hit its usage limit during a persistence follow-up; its already returned result was saved and validated by the parent.

All seven documents were checked to their final line and the image was visually inspected in full. AST extraction covered 155 code files with no failed/skipped sources; 16 files yielded no modeled symbols. SQL support was added to the Graphify tool environment using tree-sitter-sql 0.3.13; application dependencies were unchanged.

Graph health warning: 3 dangling-endpoint edges, 2 self-loop edges and 75 same-endpoint relationships collapsed by the default undirected model. See GRAPH_HEALTH.md for the full read-only diagnostic.

`graphify-out/` was written into the working tree and is not automatically added to `.gitignore`; commit only the outputs your team should share, or add that directory to your ignore rules.

Fourteen SQL reads_from relationships were incorrectly resolved by the extractor to the CI YAML jobs key. Their targets were corrected to the existing declared public.jobs table using the SQL sources; no new relationships were inferred. See RESOLUTION_CORRECTIONS.json. An extraction rebuild may reintroduce this upstream resolver collision.
