# Nexo — Supabase Data Architecture

## Schema: `nexo`

All tables live in a dedicated `nexo` schema to avoid collisions with Supabase system tables or other apps in the same project.

## Entity Relationship Overview

```
                          ┌──────────────┐
                          │    users     │
                          │ (auth_id FK) │
                          └──────┬───────┘
          ┌──────┬──────┬───────┼───────┬──────┬──────┬───────┐
          │      │      │       │       │      │      │       │
     ┌────▼──┐┌──▼───┐┌─▼────┐┌▼─────┐┌▼────┐┌▼────┐┌▼─────┐┌▼──────────┐
     │projects││tasks ││events││leaves││bugs ││chat ││streaks││focus_     │
     │        ││      ││      ││      ││     ││msgs ││       ││sessions   │
     └───┬────┘└──────┘└──┬───┘└──────┘└──┬──┘└─────┘└───────┘└───────────┘
         │                │               │
    ┌────┼─────┐     ┌────┘          ┌────┘
    │    │     │     │               │
┌───▼┐┌──▼──┐┌▼────┐┌▼──────────┐┌──▼────────┐
│sub- ││comm-││proj ││event_     ││attachments│
│tasks││ents ││memb ││attendees  ││(polymorphic)│
│(tree)│     ││     ││           ││           │
└─────┘└─────┘└─────┘└───────────┘└───────────┘
         │
    ┌────┘
    │
┌───▼─────────┐    ┌─────────────┐    ┌───────────┐
│notifications │    │activity_log │    │departments│
│(refs to any) │    │(audit trail)│    │(normalized)│
└──────────────┘    └─────────────┘    └───────────┘
```

## Tables (18 total)

| # | Table | Purpose | Key relationships |
|---|-------|---------|-------------------|
| 1 | `users` | Team members | Links to Supabase `auth.users` via `auth_id` |
| 2 | `departments` | Normalized department list | Referenced by `projects` |
| 3 | `projects` | Multi-step work items | `owner_id → users`, `department_id → departments` |
| 4 | `project_members` | Many-to-many project ↔ user | Composite PK `(project_id, user_id)` |
| 5 | `subtasks` | Hierarchical checklist under projects | Self-referencing `parent_id`, `owner_id → users` |
| 6 | `tasks` | Standalone / quick tasks | `owner_id → users`, optional `project_id` |
| 7 | `comments` | Discussion threads on projects | `project_id → projects`, `author_id → users` |
| 8 | `attachments` | Files & links (polymorphic) | FKs to comment, task, event, project, or bug |
| 9 | `events` | Calendar entries | `owner_id → users`, optional `project_id` |
| 10 | `event_attendees` | Many-to-many event ↔ user | Composite PK with RSVP status |
| 11 | `streaks` | Habit tracking | `user_id → users` |
| 12 | `notifications` | Inbox items | `user_id → users`, refs to subtask/project/task/event/bug |
| 13 | `leaves` | Leave calendar | `user_id → users`, date range + type enum |
| 14 | `bugs` | Bug tracker | `assigned_to → users`, `reported_by → users` |
| 15 | `chat_messages` | Team chat | `user_id → users`, `channel` for future multi-channel |
| 16 | `focus_sessions` | Time tracking | `user_id → users`, start/end/duration |
| 17 | `templates` | Reusable project blueprints | JSONB subtasks array |
| 18 | `activity_log` | Audit trail | Actor + entity type/id + changes JSONB |

## Design decisions for agility

### 1. `metadata JSONB` on every major table
Add new fields without migrations. Example: if you later need `tags` on projects, just write to `metadata->'tags'` instead of adding a column.

### 2. Normalized departments
Adding a new department is an INSERT, not a code change. The `projects.department` text column is denormalized for fast reads; `department_id` is the canonical FK.

### 3. Polymorphic attachments
One table serves files for comments, tasks, events, projects, and bugs. To attach to a new entity type, just add a nullable FK column — no new table needed.

### 4. PostgreSQL enums
Constrained values (roles, statuses, leave types) are enums. Extend with:
```sql
ALTER TYPE nexo.leave_type ADD VALUE 'EL';  -- Earned Leave
```

### 5. Activity log
Every mutation can log to `activity_log` with `entity_type + entity_id + changes JSONB`. This enables:
- Full audit trail
- Activity feed (the current `/api/activity` endpoint)
- Analytics (who did what, when, how often)
- Undo capability (store old values in `changes`)

### 6. Supabase Realtime replaces SSE
Enable Realtime subscriptions on `subtasks`, `comments`, `notifications`, `chat_messages`. The frontend subscribes via `supabase.channel('nexo').on('postgres_changes', ...)`.

### 7. UUID primary keys
No auto-increment conflicts across environments. Safe for client-side ID generation, multi-region, and data merging.

## Triggers (built into schema)

| Trigger | Table | Fires on | Effect |
|---------|-------|----------|--------|
| `set_updated_at` | users, projects, subtasks, tasks, comments, bugs | BEFORE UPDATE | Sets `updated_at = now()` |
| `subtask_progress` | subtasks | AFTER INSERT/UPDATE/DELETE | Recalculates `projects.progress` from done/total |
| `user_initials` | users | BEFORE INSERT/UPDATE of name | Auto-generates `initials` from first + last name |

## Row-Level Security (RLS)

All tables have RLS enabled. Key policies:
- **Users**: read all, update own
- **Projects/Tasks/Subtasks**: read all (team transparency), write if owner/member
- **Notifications**: read/update own only
- **Leaves/Bugs**: read all, write all (small team, equal access)

Auth flow: Supabase Auth → `auth.uid()` → `nexo.current_user_id()` helper function → maps to `nexo.users.id`.

## Migration path from SQLite

| SQLite | PostgreSQL |
|--------|-----------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `UUID DEFAULT uuid_generate_v4()` |
| `TEXT` for dates | `DATE` or `TIMESTAMPTZ` |
| `TEXT` for enums | Native `ENUM` types |
| `INTEGER` for booleans | `BOOLEAN` |
| `TEXT` for JSON | `JSONB` |
| File paths in `stored_path` | Supabase Storage paths in `storage_path` |
| `datetime('now')` | `now()` |
| `read INTEGER DEFAULT 0` | `is_read BOOLEAN DEFAULT false` |

## Storage buckets to create

| Bucket | Access | Contents |
|--------|--------|----------|
| `avatars` | Public read, auth write | User profile photos |
| `attachments` | Auth read/write | Comment, task, project files |
| `screenshots` | Auth read/write | Bug report screenshots |

## What to implement as Edge Functions (not PostgREST)

These endpoints have complex logic beyond CRUD:
1. **Task assignment** — creates notification, checks leave conflicts
2. **Subtask respond** (accept/modify/decline) — updates status + notifies assigner
3. **Poke** — rate limiting (1/day/sender/subtask)
4. **Streak log** — gap detection + reset logic
5. **Report summary** — aggregation across tasks + subtasks with period bucketing
6. **PDF/CSV export** — server-side document generation
7. **Search** — multi-table LIKE queries (or switch to Postgres full-text search)
8. **Recurring task spawn** — on completion, create next occurrence
9. **Email digest** — compose + send via Resend/SendGrid

Everything else (basic CRUD on projects, tasks, comments, events, leaves, bugs, chat) can use Supabase's auto-generated PostgREST API directly.
