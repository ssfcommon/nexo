-- =============================================================================
-- NEXO — Supabase PostgreSQL Schema
-- Schema: nexo (isolated namespace — won't conflict with other apps)
-- =============================================================================
--
-- Design principles:
--   1. UUID primary keys everywhere (distributed-safe, no sequence collisions)
--   2. TIMESTAMPTZ for all dates (timezone-aware)
--   3. JSONB for flexible/extensible fields (preferences, metadata)
--   4. Enums for constrained values (role, status, priority, leave_type)
--   5. Row-Level Security (RLS) enabled on all tables
--   6. Indexes on every foreign key + common query patterns
--   7. Supabase Storage references for file attachments (not local paths)
--   8. Soft deletes via `archived_at` where useful (projects, bugs)
--   9. `metadata JSONB` on key tables for future extensibility
--
-- To apply: run this in Supabase SQL Editor or via `supabase db push`
-- =============================================================================

-- Create the schema
CREATE SCHEMA IF NOT EXISTS nexo;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE nexo.user_role AS ENUM ('admin', 'manager', 'member');
CREATE TYPE nexo.project_status AS ENUM ('active', 'on_hold', 'completed', 'archived');
CREATE TYPE nexo.task_status AS ENUM ('pending', 'in_progress', 'done', 'cancelled');
CREATE TYPE nexo.assignment_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE nexo.complexity_level AS ENUM ('high_complex', 'low_complex');
CREATE TYPE nexo.event_type AS ENUM ('work', 'personal');
CREATE TYPE nexo.recurrence_type AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE nexo.leave_type AS ENUM ('PL', 'SL', 'CL', 'FL');
CREATE TYPE nexo.bug_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE nexo.notification_type AS ENUM (
  'assignment', 'completed', 'declined', 'modified', 'accepted',
  'poke', 'reminder', 'overdue', 'optimization', 'mention'
);

-- =============================================================================
-- USERS
-- =============================================================================

CREATE TABLE nexo.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Auth: links to Supabase auth.users for SSO / email+password
  auth_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,

  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  initials      TEXT NOT NULL,
  department    TEXT NOT NULL,
  avatar_color  TEXT NOT NULL DEFAULT '#6B7280',
  avatar_url    TEXT,  -- Supabase Storage path or public URL
  role          nexo.user_role NOT NULL DEFAULT 'member',
  preferences   JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Extensible: add fields without migrations
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON nexo.users(email);
CREATE INDEX idx_users_auth_id ON nexo.users(auth_id);
CREATE INDEX idx_users_department ON nexo.users(department);

-- =============================================================================
-- DEPARTMENTS (normalized — allows dynamic creation without code changes)
-- =============================================================================

CREATE TABLE nexo.departments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT '#6B7280',  -- for UI department dots
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial departments
INSERT INTO nexo.departments (name, color) VALUES
  ('Operations', '#22C55E'),
  ('CEO''s Office', '#4A6CF7'),
  ('Common', '#9CA3AF');

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE TABLE nexo.projects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  department_id UUID REFERENCES nexo.departments(id),
  department    TEXT NOT NULL,  -- denormalized for quick reads
  description   TEXT,
  owner_id      UUID NOT NULL REFERENCES nexo.users(id),
  deadline      DATE,
  progress      INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status        nexo.project_status NOT NULL DEFAULT 'active',
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ  -- soft delete
);

CREATE INDEX idx_projects_owner ON nexo.projects(owner_id);
CREATE INDEX idx_projects_status ON nexo.projects(status);
CREATE INDEX idx_projects_department ON nexo.projects(department);
CREATE INDEX idx_projects_deadline ON nexo.projects(deadline);
CREATE INDEX idx_projects_created ON nexo.projects(created_at DESC);

-- =============================================================================
-- PROJECT MEMBERS (many-to-many)
-- =============================================================================

CREATE TABLE nexo.project_members (
  project_id    UUID NOT NULL REFERENCES nexo.projects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',  -- 'owner', 'member', 'viewer'
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_pm_user ON nexo.project_members(user_id);

-- =============================================================================
-- SUBTASKS (hierarchical checklist items under projects)
-- =============================================================================

CREATE TABLE nexo.subtasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES nexo.projects(id) ON DELETE CASCADE,
  parent_id         UUID REFERENCES nexo.subtasks(id) ON DELETE CASCADE,
  depth             INT NOT NULL DEFAULT 0,
  title             TEXT NOT NULL,
  owner_id          UUID REFERENCES nexo.users(id),
  assigned_by       UUID REFERENCES nexo.users(id),
  assignment_status nexo.assignment_status NOT NULL DEFAULT 'accepted',
  proposed_deadline DATE,
  decline_note      TEXT,
  deadline          DATE,
  complexity        nexo.complexity_level,
  status            nexo.task_status NOT NULL DEFAULT 'pending',
  sort_order        INT NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subtasks_project ON nexo.subtasks(project_id);
CREATE INDEX idx_subtasks_parent ON nexo.subtasks(parent_id);
CREATE INDEX idx_subtasks_owner ON nexo.subtasks(owner_id);
CREATE INDEX idx_subtasks_status ON nexo.subtasks(status);
CREATE INDEX idx_subtasks_sort ON nexo.subtasks(project_id, COALESCE(parent_id, id), depth, sort_order);

-- =============================================================================
-- TASKS (standalone / quick tasks — not tied to a project checklist)
-- =============================================================================

CREATE TABLE nexo.tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  description       TEXT,
  project_id        UUID REFERENCES nexo.projects(id) ON DELETE SET NULL,
  owner_id          UUID NOT NULL REFERENCES nexo.users(id),
  deadline          DATE,
  complexity        nexo.complexity_level,
  status            nexo.task_status NOT NULL DEFAULT 'pending',
  is_quick          BOOLEAN NOT NULL DEFAULT false,
  recurrence        nexo.recurrence_type,
  recurrence_parent UUID REFERENCES nexo.tasks(id) ON DELETE SET NULL,
  alarm_at          TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_owner ON nexo.tasks(owner_id);
CREATE INDEX idx_tasks_project ON nexo.tasks(project_id);
CREATE INDEX idx_tasks_status ON nexo.tasks(status);
CREATE INDEX idx_tasks_deadline ON nexo.tasks(deadline);
CREATE INDEX idx_tasks_alarm ON nexo.tasks(alarm_at) WHERE alarm_at IS NOT NULL;
CREATE INDEX idx_tasks_recurrence ON nexo.tasks(recurrence) WHERE recurrence IS NOT NULL;

-- =============================================================================
-- COMMENTS (on projects — threaded discussion)
-- =============================================================================

CREATE TABLE nexo.comments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES nexo.projects(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES nexo.users(id),
  body          TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_project ON nexo.comments(project_id, created_at);
CREATE INDEX idx_comments_author ON nexo.comments(author_id);

-- =============================================================================
-- ATTACHMENTS (polymorphic — can belong to comment, task, event, project, or bug)
-- =============================================================================

CREATE TABLE nexo.attachments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Polymorphic ownership: exactly one of these should be set
  comment_id    UUID REFERENCES nexo.comments(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES nexo.tasks(id) ON DELETE CASCADE,
  event_id      UUID,  -- FK added after events table
  project_id    UUID REFERENCES nexo.projects(id) ON DELETE CASCADE,
  bug_id        UUID,  -- FK added after bugs table

  filename      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,  -- Supabase Storage bucket path
  mime_type     TEXT,
  size_bytes    BIGINT,
  -- For link attachments (not files)
  link_url      TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_comment ON nexo.attachments(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_attachments_task ON nexo.attachments(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_attachments_project ON nexo.attachments(project_id) WHERE project_id IS NOT NULL;

-- =============================================================================
-- EVENTS (calendar)
-- =============================================================================

CREATE TABLE nexo.events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  owner_id      UUID NOT NULL REFERENCES nexo.users(id),
  start_time    TIMESTAMPTZ NOT NULL,
  duration_min  INT NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  event_type    nexo.event_type NOT NULL DEFAULT 'work',
  department    TEXT,
  priority      TEXT,
  meet_link     TEXT,
  project_id    UUID REFERENCES nexo.projects(id) ON DELETE SET NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_owner ON nexo.events(owner_id);
CREATE INDEX idx_events_start ON nexo.events(start_time);
CREATE INDEX idx_events_project ON nexo.events(project_id) WHERE project_id IS NOT NULL;

-- Add the FK on attachments now that events exists
ALTER TABLE nexo.attachments
  ADD CONSTRAINT fk_attachments_event FOREIGN KEY (event_id) REFERENCES nexo.events(id) ON DELETE CASCADE;

-- =============================================================================
-- EVENT ATTENDEES
-- =============================================================================

CREATE TABLE nexo.event_attendees (
  event_id      UUID NOT NULL REFERENCES nexo.events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
  rsvp_status   TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'declined'
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX idx_ea_user ON nexo.event_attendees(user_id);

-- =============================================================================
-- STREAKS (Duolingo-style habit tracking)
-- =============================================================================

CREATE TABLE nexo.streaks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  current_count INT NOT NULL DEFAULT 0,
  best_count    INT NOT NULL DEFAULT 0,
  last_logged   DATE,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_streaks_user ON nexo.streaks(user_id);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE nexo.notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
  type          nexo.notification_type NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  -- Flexible references to any entity
  ref_subtask   UUID REFERENCES nexo.subtasks(id) ON DELETE SET NULL,
  ref_project   UUID REFERENCES nexo.projects(id) ON DELETE SET NULL,
  ref_task      UUID REFERENCES nexo.tasks(id) ON DELETE SET NULL,
  ref_event     UUID REFERENCES nexo.events(id) ON DELETE SET NULL,
  ref_bug       UUID,  -- FK added after bugs table
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read       BOOLEAN NOT NULL DEFAULT false,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON nexo.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON nexo.notifications(user_id) WHERE is_read = false;

-- =============================================================================
-- LEAVES
-- =============================================================================

CREATE TABLE nexo.leaves (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  type          nexo.leave_type NOT NULL DEFAULT 'PL',
  status        TEXT NOT NULL DEFAULT 'approved',  -- 'pending', 'approved', 'rejected' (for future HRM integration)
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_leaves_user ON nexo.leaves(user_id);
CREATE INDEX idx_leaves_dates ON nexo.leaves(start_date, end_date);

-- =============================================================================
-- BUGS (Bug Tracker)
-- =============================================================================

CREATE TABLE nexo.bugs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_name        TEXT NOT NULL,
  issue           TEXT NOT NULL,
  screenshot_url  TEXT,  -- Supabase Storage path
  assigned_to     UUID REFERENCES nexo.users(id) ON DELETE SET NULL,
  reported_by     UUID NOT NULL REFERENCES nexo.users(id),
  deadline        DATE,
  status          nexo.bug_status NOT NULL DEFAULT 'open',
  severity        TEXT,  -- future: 'critical', 'major', 'minor', 'trivial'
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_bugs_app ON nexo.bugs(app_name);
CREATE INDEX idx_bugs_assigned ON nexo.bugs(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_bugs_status ON nexo.bugs(status);
CREATE INDEX idx_bugs_reporter ON nexo.bugs(reported_by);

-- Add FK on attachments + notifications now that bugs exists
ALTER TABLE nexo.attachments
  ADD CONSTRAINT fk_attachments_bug FOREIGN KEY (bug_id) REFERENCES nexo.bugs(id) ON DELETE CASCADE;
ALTER TABLE nexo.notifications
  ADD CONSTRAINT fk_notifications_bug FOREIGN KEY (ref_bug) REFERENCES nexo.bugs(id) ON DELETE SET NULL;

-- =============================================================================
-- CHAT MESSAGES (Team Chat)
-- =============================================================================

CREATE TABLE nexo.chat_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  -- Future: channel_id for multi-channel support
  channel       TEXT NOT NULL DEFAULT 'general',
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_channel ON nexo.chat_messages(channel, created_at DESC);

-- =============================================================================
-- FOCUS SESSIONS (time tracking)
-- =============================================================================

CREATE TABLE nexo.focus_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES nexo.users(id) ON DELETE CASCADE,
  complexity    nexo.complexity_level NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  duration_min  INT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_focus_user ON nexo.focus_sessions(user_id);
CREATE INDEX idx_focus_active ON nexo.focus_sessions(user_id) WHERE ended_at IS NULL;

-- =============================================================================
-- TEMPLATES (project templates)
-- =============================================================================

CREATE TABLE nexo.templates (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  department    TEXT NOT NULL,
  description   TEXT,
  subtasks      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{title, complexity, children: [...]}]
  created_by    UUID REFERENCES nexo.users(id),
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- ACTIVITY LOG (audit trail — future-proofs analytics)
-- =============================================================================

CREATE TABLE nexo.activity_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID NOT NULL REFERENCES nexo.users(id),
  action        TEXT NOT NULL,  -- 'created', 'updated', 'deleted', 'completed', 'assigned', etc.
  entity_type   TEXT NOT NULL,  -- 'project', 'subtask', 'task', 'comment', 'bug', etc.
  entity_id     UUID NOT NULL,
  changes       JSONB,  -- { field: { old: ..., new: ... } }
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_actor ON nexo.activity_log(actor_id);
CREATE INDEX idx_activity_entity ON nexo.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_created ON nexo.activity_log(created_at DESC);

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- Enable RLS on all tables. Policies use Supabase's auth.uid() to map to
-- nexo.users.auth_id. Adjust these based on your auth implementation.
-- =============================================================================

ALTER TABLE nexo.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexo.activity_log ENABLE ROW LEVEL SECURITY;

-- Helper function: get the nexo user ID from Supabase auth
CREATE OR REPLACE FUNCTION nexo.current_user_id()
RETURNS UUID AS $$
  SELECT id FROM nexo.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Example policies (read-all for authenticated, write-own):
-- Adjust these based on your app's access model.

-- Users: everyone can read all users (for avatars, names), update own
CREATE POLICY users_select ON nexo.users FOR SELECT TO authenticated USING (true);
CREATE POLICY users_update ON nexo.users FOR UPDATE TO authenticated USING (id = nexo.current_user_id());

-- Projects: read all (transparency), write if member
CREATE POLICY projects_select ON nexo.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY projects_insert ON nexo.projects FOR INSERT TO authenticated WITH CHECK (owner_id = nexo.current_user_id());
CREATE POLICY projects_update ON nexo.projects FOR UPDATE TO authenticated USING (
  owner_id = nexo.current_user_id() OR
  EXISTS (SELECT 1 FROM nexo.project_members WHERE project_id = id AND user_id = nexo.current_user_id())
);
CREATE POLICY projects_delete ON nexo.projects FOR DELETE TO authenticated USING (true);

-- Notifications: own only
CREATE POLICY notifications_select ON nexo.notifications FOR SELECT TO authenticated USING (user_id = nexo.current_user_id());
CREATE POLICY notifications_update ON nexo.notifications FOR UPDATE TO authenticated USING (user_id = nexo.current_user_id());
CREATE POLICY notifications_delete ON nexo.notifications FOR DELETE TO authenticated USING (user_id = nexo.current_user_id());

-- Tasks: open for all authenticated users (allows assigning to others)
CREATE POLICY tasks_select ON nexo.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY tasks_insert ON nexo.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tasks_update ON nexo.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY tasks_delete ON nexo.tasks FOR DELETE TO authenticated USING (true);

-- Leaves: read all (team visibility), write own
CREATE POLICY leaves_select ON nexo.leaves FOR SELECT TO authenticated USING (true);
CREATE POLICY leaves_insert ON nexo.leaves FOR INSERT TO authenticated WITH CHECK (user_id = nexo.current_user_id());

-- Bugs: read all, write all (any team member can report/update)
CREATE POLICY bugs_select ON nexo.bugs FOR SELECT TO authenticated USING (true);
CREATE POLICY bugs_insert ON nexo.bugs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY bugs_update ON nexo.bugs FOR UPDATE TO authenticated USING (true);

-- Chat: read all, write own
CREATE POLICY chat_select ON nexo.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY chat_insert ON nexo.chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = nexo.current_user_id());

-- Templates, departments, subtasks, comments, attachments, events, streaks, focus_sessions, activity_log:
-- All readable by authenticated, writable by authenticated (small team, equal access)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'subtasks', 'comments', 'attachments', 'events', 'event_attendees',
    'streaks', 'focus_sessions', 'templates', 'activity_log', 'departments', 'project_members'
  ]) LOOP
    EXECUTE format('CREATE POLICY %I_select ON nexo.%I FOR SELECT TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_insert ON nexo.%I FOR INSERT TO authenticated WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_update ON nexo.%I FOR UPDATE TO authenticated USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_delete ON nexo.%I FOR DELETE TO authenticated USING (true)', tbl, tbl);
  END LOOP;
END $$;

-- =============================================================================
-- TRIGGERS: auto-update `updated_at`
-- =============================================================================

CREATE OR REPLACE FUNCTION nexo.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['users', 'projects', 'subtasks', 'tasks', 'comments', 'bugs']) LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON nexo.%I FOR EACH ROW EXECUTE FUNCTION nexo.set_updated_at()',
      tbl
    );
  END LOOP;
END $$;

-- =============================================================================
-- TRIGGER: auto-recalculate project progress when subtask status changes
-- =============================================================================

CREATE OR REPLACE FUNCTION nexo.recalc_project_progress()
RETURNS TRIGGER AS $$
DECLARE
  total INT;
  done INT;
  proj_id UUID;
BEGIN
  proj_id := COALESCE(NEW.project_id, OLD.project_id);
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'done')
    INTO total, done
    FROM nexo.subtasks WHERE project_id = proj_id;
  IF total > 0 THEN
    UPDATE nexo.projects SET progress = ROUND((done::NUMERIC / total) * 100) WHERE id = proj_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subtask_progress
  AFTER INSERT OR UPDATE OF status OR DELETE ON nexo.subtasks
  FOR EACH ROW EXECUTE FUNCTION nexo.recalc_project_progress();

-- =============================================================================
-- TRIGGER: auto-generate initials from name
-- =============================================================================

CREATE OR REPLACE FUNCTION nexo.generate_initials()
RETURNS TRIGGER AS $$
BEGIN
  NEW.initials := UPPER(LEFT(split_part(NEW.name, ' ', 1), 1) || LEFT(split_part(NEW.name, ' ', 2), 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_initials
  BEFORE INSERT OR UPDATE OF name ON nexo.users
  FOR EACH ROW EXECUTE FUNCTION nexo.generate_initials();

-- =============================================================================
-- VIEWS (convenience queries used by the frontend)
-- =============================================================================

-- Urgent tasks for a user (overdue + due today + upcoming, ranked)
CREATE OR REPLACE VIEW nexo.urgent_tasks AS
  SELECT t.*,
    CASE
      WHEN t.deadline < CURRENT_DATE THEN 0  -- overdue
      WHEN t.deadline = CURRENT_DATE THEN 1  -- due today
      ELSE 2                                  -- upcoming
    END AS urgency_rank
  FROM nexo.tasks t
  WHERE t.status NOT IN ('done', 'cancelled')
  ORDER BY urgency_rank, t.deadline ASC NULLS LAST
  LIMIT 10;

-- Activity feed (union of recent events across the system)
CREATE OR REPLACE VIEW nexo.activity_feed AS
  SELECT id, actor_id, action, entity_type, entity_id, metadata, created_at
  FROM nexo.activity_log
  ORDER BY created_at DESC
  LIMIT 20;

-- =============================================================================
-- STORAGE BUCKETS (run in Supabase Dashboard or via management API)
-- =============================================================================
--
-- These are Supabase Storage buckets, not SQL tables.
-- Create them manually in Dashboard > Storage:
--
--   1. "avatars"     — user profile photos (public)
--   2. "attachments" — comment/task/project file attachments (authenticated)
--   3. "screenshots" — bug report screenshots (authenticated)
--
-- Bucket policies:
--   avatars:     SELECT public, INSERT/UPDATE/DELETE authenticated
--   attachments: SELECT/INSERT/UPDATE/DELETE authenticated
--   screenshots: SELECT/INSERT/UPDATE/DELETE authenticated
--
-- =============================================================================

-- =============================================================================
-- NOTES FOR THE BACKEND DEVELOPER
-- =============================================================================
--
-- 1. AUTH MAPPING
--    When a user signs up via Supabase Auth, create a row in nexo.users with
--    auth_id = auth.uid(). The nexo.current_user_id() function bridges the two.
--
-- 2. REAL-TIME
--    Enable Supabase Realtime on: subtasks, comments, notifications, chat_messages
--    This replaces the SSE /api/stream endpoint with native WebSocket subscriptions.
--
-- 3. EDGE FUNCTIONS
--    Convert Express routes to Supabase Edge Functions (Deno).
--    Most CRUD can use Supabase's auto-generated PostgREST API directly.
--    Complex logic (assignment notifications, poke rate-limiting, progress recalc)
--    should be Edge Functions or Postgres triggers (progress is already a trigger above).
--
-- 4. FILE UPLOADS
--    Use Supabase Storage SDK instead of base64 data URLs in JSON.
--    Upload flow: frontend → Storage.upload() → get public URL → save URL in DB.
--
-- 5. POKE RATE LIMITING
--    Implement in Edge Function: query notifications for today's pokes
--    from the same sender to the same receiver on the same subtask.
--    Or add a nexo.pokes table with a unique constraint on (sender, receiver, subtask, date).
--
-- 6. RECURRING TASKS
--    Implement via a Supabase CRON job (pg_cron) or Edge Function scheduled trigger.
--    When a task with recurrence is marked done, spawn the next occurrence.
--    The trigger can be: AFTER UPDATE OF status ON nexo.tasks.
--
-- 7. EMAIL DIGEST
--    Use Supabase Edge Function + Resend / SendGrid for actual email delivery.
--    The /api/digest/preview endpoint can be a direct Postgres function.
--
-- 8. FUTURE EXTENSIBILITY
--    - Every major table has `metadata JSONB` for ad-hoc fields
--    - Departments are a normalized table (add/rename without migrations)
--    - Enums can be extended: ALTER TYPE nexo.xxx ADD VALUE 'new_value'
--    - activity_log captures all changes for analytics and audit
--    - attachments are polymorphic (link any entity without schema changes)
--
-- =============================================================================
