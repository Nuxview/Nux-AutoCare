## 1. All users must have unique details
When creating an account as both the driver and garage owner, the app enforces that each record must be unique.

It does this by:
1. returning `409` status code
2. showing the message `A record with those details already exists`
3. highlighting fields with duplicate records in blue (see the [screenshot](media-evidence/unique_details_highlight.png))

The only fields that should enforce unique details are:
1. email
2. phone number
3. business name
4. shop name

Passwords are managed by Supabase Auth and must not have a global uniqueness requirement.

All other information can be duplicated since in the real world, users often have the same details.
Also, make the highlighting a bit more obvious since noone will associate the color blue and lack of a early warning to mean there is conflict

## 2. Requests take too long
The app tries to make many repetitive requests which end up taking any where between 1 second to over 3 just to return a response.

Implemented changes:
- Bookings, invoices, garage settings and billing reuse the dashboard's workspace context instead of requesting `/api/me` again.
- Billing loads its summary and bank list in parallel.
- Garage scope, dashboard, job-list and invoice-list authorization reuse the active membership lookup, removing a repeated Auth request, profile lookup and membership lookup. Tenant-status checks remain shared.
- API routes bypass the page session-refresh proxy and refresh cookies through their own authenticated server client.
- Repair/photo access, shared history and subscription verification reuse the identity already verified in the current request.
- Development fetch logging shows individual Supabase request durations. Restart `npm run dev` after changing the Next.js configuration.

Isolated regression tests check request counts and access boundaries. Production response times still need measuring after deployment.

Local follow-up: the public `/api/garages` endpoint took 4.37 seconds on its first request and 0.34–0.37 seconds on warm requests. Next.js logged a 1,540 ms initial Supabase fetch and 321–329 ms warm fetches. These measurements do not establish signed-in endpoint latency; capture the timing block for any signed-in request that remains slow.

## 3. Unused files
Keep the legacy Prisma migrations pending confirmation from the lead.

## 4. Conflicting docs and code base
A close look at the both the code base and documentation shows a clear misalignment between the two.
In particular, the sections on security.

## 5. Subscription read-only access
Garages with expired trials or a `PAST_DUE` subscription must retain read access but cannot write. Enforce this through one shared server helper so the rule is consistent across write paths.

A short grace window after a failed renewal is optional; no duration has been agreed.

The current membership helper only blocks `SUSPENDED` and `CANCELLED` garages and does not enforce this read-only rule.

## 6. Photo uploads don't actually work
All the buttons for uploading photos don't do anything.
Supabase object storage probably hasn't been configured.

## 7. Wrong UI loaded
Currently there are some slight differences between both the driver and garage UI and it let me notice something.

When you log in as garage owner, when loading, the color scheme and left side bar briefly shows the client side before switching back to the green of the garage owner.
