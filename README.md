# Starblast Arcade — Netlify + Supabase

This version replaces device-only identities with real Supabase accounts and persistent cloud stats.

## Included

- Email/password sign-up and login with Supabase Auth
- Unique public username stored in `profiles`
- Persistent score, XP, level, launches, ejects, failures, best score and best multiplier
- Live global leaderboard using Supabase Realtime
- Per-user run history table protected by Row Level Security
- 10-second cooldown and slower arcade-style launch curve
- Netlify-ready static deployment
- `/api/config` Netlify Function so Supabase settings come from Netlify environment variables

## 1. Create/configure Supabase

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Under **Authentication > URL Configuration**, set your production Site URL to your Netlify URL.
5. Decide whether to keep email confirmation enabled. If enabled, new players must confirm their email before first login.

## 2. Netlify environment variables

In Netlify, add:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

These are the only variables required for player accounts and the leaderboard.

Do not put `SUPABASE_SERVICE_ROLE_KEY` in browser JavaScript. The supplied game does not require it.

## 3. Deploy

Drag the project ZIP into Netlify or connect the folder to a Git repository. Netlify uses `netlify.toml`, serves the root directory, and deploys the `public-config` function automatically.

## Data model

- `auth.users`: Supabase-managed credentials
- `profiles`: public username + career/leaderboard statistics
- `runs`: private per-player run history
- `record_run(...)`: database RPC that records a run and updates career stats atomically

## Security notes

RLS is enabled. Everyone can read leaderboard-safe profile rows. Players can read their own run history. The game records completed runs through an authenticated RPC.

This is an arcade implementation, not a real-money wagering system. If scores ever become financially valuable or redeemable, move crash generation and scoring to a trusted server instead of accepting client-reported run values.


## Password signup notes

The Create Account screen now asks for **Create Password** and **Confirm Password**, requires at least 8 characters in the browser, and sends the chosen password to Supabase Auth.

In Supabase Dashboard, make sure **Authentication -> Providers -> Email -> Allow new users to sign up** is enabled. If **Confirm Email** is enabled, users must click the confirmation email before logging in for the first time. Your Supabase project's configured password policy can be stricter than the frontend's 8-character minimum; the UI will surface that server error.
