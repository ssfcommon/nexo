# Supabase schema & migrations

Everything under `supabase/` that shapes the database:

| File / dir | What it is |
|---|---|
| `schema.sql` | Full canonical schema. Used when bootstrapping a fresh project. |
| `seed.sql`, `seed-real.sql` | Demo/seed data. Run manually as needed. |
| `migrations/` | Timestamped, ordered DDL changes layered on top of the initial schema. **Apply in filename order.** |

## Applying migrations

### Option A — Supabase CLI (recommended, one command)

One-time setup (if you don't have the CLI yet):

```bash
brew install supabase/tap/supabase   # macOS
supabase login
supabase link --project-ref <your-project-ref>   # from the Supabase dashboard URL
```

Then, from anywhere in the repo:

```bash
cd frontend && npm run db:push
# or, from the repo root:
supabase db push
```

The CLI tracks which migrations have already been applied (via its `supabase_migrations` schema), so running it again only applies new files. It also validates that nothing has drifted from `schema.sql`.

### Option B — Copy/paste into the SQL editor

If you don't want to install the CLI, open **Supabase dashboard → SQL editor → New query**, paste the contents of each new migration file (in filename order), and **Run**.

The DDL is written with `IF NOT EXISTS` / `IF EXISTS` guards where possible, so re-running a migration is safe.

## Writing a new migration

1. Create a new file in `supabase/migrations/` using the next timestamp:

   ```
   YYYYMMDDHHmmss_short_snake_case_summary.sql
   ```

   Keep timestamps monotonic — `ls migrations/` should list them in the order they should apply.

2. Use idempotent DDL:

   ```sql
   ALTER TABLE nexo.foo ADD COLUMN IF NOT EXISTS bar TEXT;
   CREATE INDEX IF NOT EXISTS idx_foo_bar ON nexo.foo(bar);
   ```

3. Update `schema.sql` so future fresh installs include the change.

4. Run `npm run db:push` (or paste into the SQL editor) **before** merging frontend code that depends on the new columns.

## Frontend ships before migration? (Safety net)

`frontend/src/lib/supabaseService.js` wraps the tasks / homeTasks selects in a fallback that detects missing-column / missing-relationship errors (PG codes `42703`, `42P01`, PostgREST `PGRST200`) and retries with a baseline select.

That means a forgotten migration degrades the UI (new columns show as blank) instead of wiping the whole list. The fallback logs a `console.warn` when it kicks in — search for `falling back:` in the browser console if you see UI fields that should be populated but aren't.

## Current migrations (reverse chronological)

| File | Purpose |
|---|---|
| `20260415010000_task_assigned_by.sql` | `nexo.tasks.assigned_by` — credit cross-assigned quick tasks to their assigner |
| `20260415000000_subtask_alarm.sql` | `nexo.subtasks.alarm_at` — personal alarms on project subtasks |
| `20260414110000_event_lifecycle.sql` | Event complete/reschedule/continue lifecycle |
| `20260414100000_notifications_insert_policy.sql` | RLS policy fix for notifications INSERT |
| `20260414090000_more_notification_types.sql` | Additional notification type variants |
| `20260414080000_expand_notification_types.sql` | Broader notification type enum |
| `20260413213800_create_storage_buckets.sql` | Avatars + attachments buckets |
| `20260413000000_add_confirmed_bug_status.sql` | `confirmed` state in `bug_status` enum |
