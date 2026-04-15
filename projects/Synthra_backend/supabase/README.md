# Supabase Setup

This backend now uses Supabase Postgres instead of MongoDB.

## 1) Create a Supabase project

Create a Supabase Cloud project and capture:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Set these in `projects/Synthra_backend/.env`.

## 2) Run schema migration

Open the Supabase SQL editor and run:

- `supabase/migrations/20260416_init_supabase.sql`
- Or print it from terminal with:
	- `npm run show:migration`

This migration creates:

- `agents`
- `api_keys`
- `usage_logs`
- `payment_tx_proofs`
- `increment_api_key_usage(...)` RPC function

## 3) Start backend

From `projects/Synthra_backend`:

```bash
npm install
npm start
```

Backend startup will fail if Supabase connectivity checks do not pass.

If only schema is missing, backend now starts in degraded mode and logs the migration path.
DB-backed routes (agents/apikeys/usage) will fail until migration SQL is applied.
