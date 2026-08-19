# Starblast Ops+ — Netlify + Supabase

This package includes the Starblast game plus an advanced `/admin` operations console.

## New admin capabilities

- Role-based administrators: **Owner, Admin, Moderator, Analyst**
- Player directory and per-player run history
- Give/take High Notes Tokens (HNT)
- Immutable HNT transaction ledger with running balances and reasons
- Rebuild player stats from stored runs
- Live players, active flights and recent events (auto-refresh every 5 seconds)
- HNT economy totals: issued, spent, net flow, total supply and average balance
- Anomaly center with scans for impossible multipliers, score spikes, rapid runs, and elevated >3x rate
- Versioned global game configuration
- Admin audit trail
- System health checks
- Ops terminal

## Roles

- **Owner** — all capabilities, including creating/disabling other admins.
- **Admin** — players, HNT economy, config, alerts, notes and suspensions.
- **Moderator** — player moderation, notes, alerts and read access.
- **Analyst** — read-only dashboards and exports.

The `ADMIN_USERNAME` / `ADMIN_PASSWORD` environment account is always treated as the bootstrap **Owner**.

## Existing database upgrade

If your existing Starblast schema is already installed, run this file in **Supabase → SQL Editor**:

`supabase/migrations/20260818_ops_advanced.sql`

This adds the HNT ledger, admin accounts and anomaly alerts and replaces `start_run()` so launch token spends are written to the ledger automatically.

## Fresh database

Run:

`supabase/full-schema-advanced.sql`

## Netlify environment variables

Set these in **Netlify → Site configuration → Environment variables**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Redeploy after changing environment variables.

## Security notes

The Supabase service-role key is used only by Netlify Functions. Do not place it in `index.html`, `admin.html`, or public JavaScript. Admin tables have RLS enabled and no player-facing policies. Privileged admin writes go through server-side Functions using the service-role credential.

The HNT ledger is append-only from the application perspective: normal players have no direct access, and admin/game operations append transaction rows rather than editing historical entries.

## Admin URL

After deployment: `/admin`


## Global crash controls
Owners/Admins can now configure the global crash distribution under **Game Control**: percent above threshold, threshold multiplier, standard min/max, and extended min/max. Use **Simulate 100,000 Runs** to preview the distribution before saving. All saved changes are versioned and audited. Existing databases should run `supabase/migrations/20260818_crash_controls.sql`.


## Admin settings permissions

Game configuration can be saved only by `owner` and `admin` roles. The bootstrap account defined by `ADMIN_USERNAME` / `ADMIN_PASSWORD` always signs in as `owner`. `moderator` and `analyst` accounts are intentionally read-only for game settings. If the Save button says OWNER / ADMIN REQUIRED, sign out and use the bootstrap Owner account or have an Owner create/promote an Admin account.


## Advanced Player Editor

This build adds an advanced Player Control modal in `/admin`:

- Edit public username (Owner/Admin)
- Change login email (Owner only)
- Manual career-stat overrides with validation (Owner/Admin)
- Rebuild derived stats from run history
- Give/take High Notes Tokens through the immutable HNT ledger
- Suspend/unsuspend players
- Private moderator/admin notes
- Per-player HNT ledger and run-history CSV export
- Every privileged change is written through `write_admin_audit_log()`

### Required SQL upgrade
Run `supabase/migrations/20260818_admin_center_advanced.sql` in the Supabase SQL Editor after your earlier migrations. This also fixes the audit-log permission path used by this build.


## Live Airspace / Events / Records upgrade

After all previous Starblast migrations, run:

`supabase/migrations/20260819_live_airspace_events_records.sql`

New systems:
- Live Airspace: signed-in clients report current flight multiplier about once per second.
- Admin Live Ops sees moving flight multipliers.
- Admin-created Announcement, Double XP, Free Launch, HNT Bonus, and Challenge events.
- Free Launch and event rewards are enforced by new versioned server RPCs.
- Global player record board.
- Community milestones.
- Expanded cosmetic engine trails and pilot titles.
- Event and Airspace Realtime subscriptions.

This release uses `start_run_v2` and `record_run_v2` rather than replacing older RPC return types, preventing the PostgreSQL "cannot change return type of existing function" migration error.


## NextGen Online
Run `supabase/migrations/20260819_nextgen_online_systems.sql` after previous migrations.
Adds server-authoritative crash checking, inbox rewards, crews, spectator mode, flight grades/near-miss feedback, and season reward tiers.


## Admin login fix
The bootstrap owner requires `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Netlify Environment Variables. `ADMIN_SESSION_SECRET` is still recommended, but this build can derive a session signing secret from the bootstrap credentials if it is omitted. After changing Netlify variables, trigger a fresh deploy. Supabase admin DB access accepts either `SUPABASE_SERVICE_ROLE_KEY` or the newer `SUPABASE_SECRET_KEY`.
