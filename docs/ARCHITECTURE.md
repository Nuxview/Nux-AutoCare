# AutoCare architecture

AutoCare is a modular monolith built on Next.js App Router. Route handlers are transport adapters; domain services own authorization, transactional writes, and business rules. Supabase Postgres is the system of record and the Supabase JavaScript SDK is the persistence adapter.

## Trust boundaries

- Supabase Auth owns credentials, access tokens, refresh rotation, email confirmation, and HTTP-only SSR session cookies.
- Platform administrators have no implicit access to workshop data.
- Operational reads and writes are scoped by `franchiseId`; branch records are additionally scoped by `shopId`.
- Client-supplied identifiers are treated as lookup hints only. Services validate vehicle ownership, membership, shop/franchise relationships, subscription state, and role before mutations.
- Phone/VIN-style sensitive fields are AES-256-GCM encrypted. A separate one-way normalized hash supports exact lookups without deterministic encryption.
- The service-role Supabase key runs only on the server. Browser clients never receive it; route handlers enforce identity and tenant scope before data access.
- Row Level Security is enabled on all application tables. Operational data (bookings, jobs, invoices, inventory, services, shops, payments, subscriptions, invitations and audit logs) is server-only: browser roles have no table privileges. The service-role data layer bypasses RLS only after route-level authorization. `20261116000100_restore_operational_server_access.sql` restores this boundary for existing databases without changing their records or service-role grants.
- Vehicle history consent is also server-only. `20261116000200_restore_history_consent_server_access.sql` removes direct browser access to sharing grants; the history route verifies vehicle ownership before granting or revoking consent. Existing sharing records are preserved.
- `20261116000300_restore_related_server_access.sql` removes default browser grants from related server-only tables, including invoice lines and repair tasks. Vehicles retain their explicit owner-only CRUD policy; memberships retain self-only reads.
- Supabase Storage uses a private `repair-photos` bucket and a public `garage-logos` bucket. All uploads and signed photo reads go through authenticated, tenant-checked server routes. The legacy generic upload route remains disabled.
- Money uses PostgreSQL `NUMERIC` and Decimal.js for arithmetic.

## Tenant model

`PLATFORM → FRANCHISE → SHOP`. Customers and vehicles are platform-owned. A garage sees customer data only through its own bookings, jobs, invoices, or payments. Staff membership grants a role within one franchise and optionally one branch. Franchise-wide roles use a null `shopId`.

## Main modules

- `src/server/auth`: Supabase login, onboarding, authenticated and tenant contexts.
- `src/server/bookings`: capacity-aware, ownership-checked customer bookings.
- `src/server/jobs`: role-gated job creation and tenant-scoped workshop visibility.
- `src/server/payments`: Safaricom Daraja STK requests and idempotent callback reconciliation.
- `src/lib/supabase`: browser, server-cookie, service-role, and proxy clients.
- `src/app/api`: thin HTTP handlers with Zod parsing and normalized error responses.

## Migration decision record

The supplied workspace contained no earlier frontend, Flask backend, Git history, business types, or tests. Consequently no code could be preserved or incrementally migrated. The implementation starts greenfield and deliberately does not introduce localStorage persistence. If an earlier client is later recovered, migrate one domain at a time against these APIs, retain only presentation and harmless UI preferences, and remove simulated notifications/payments after the equivalent server workflow is connected.

## Production hardening before launch

Enable Supabase backups and point-in-time recovery as required; keep the secret key in a server-only secrets manager; configure Auth redirect URLs and email templates; terminate TLS at the load balancer; configure Daraja credentials/callback allowlists; add rate limiting; add error/trace collection; test tenant isolation against a migrated test project; and complete a data protection impact assessment under Kenya's Data Protection Act.
