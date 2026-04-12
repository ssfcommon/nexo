-- =============================================================================
-- NEXO — Seed Data for Supabase
-- =============================================================================
-- Run AFTER schema.sql has been applied.
--
-- IMPORTANT: Before running this, create 3 auth users in Supabase Dashboard
-- (Authentication > Users > Add user) with these emails and password 'password123':
--   1. arjun@nexo.app
--   2. ravi@nexo.app
--   3. ankit@nexo.app
--
-- Then replace the auth_id UUIDs below with the actual auth.users IDs from the
-- Supabase dashboard (or use the query at the bottom to auto-link).
-- =============================================================================

-- Use fixed UUIDs for referential integrity in seed data
-- (These are the nexo.users IDs, NOT the auth.users IDs)

DO $$
DECLARE
  arjun_id UUID := 'a0000000-0000-0000-0000-000000000001';
  ravi_id  UUID := 'a0000000-0000-0000-0000-000000000002';
  ankit_id UUID := 'a0000000-0000-0000-0000-000000000003';

  proj1_id UUID := 'b0000000-0000-0000-0000-000000000001';
  proj2_id UUID := 'b0000000-0000-0000-0000-000000000002';
  proj3_id UUID := 'b0000000-0000-0000-0000-000000000003';
  proj4_id UUID := 'b0000000-0000-0000-0000-000000000004';

  sub1 UUID; sub2 UUID; sub3 UUID; sub4 UUID; sub5 UUID;
  sub6 UUID; sub7 UUID; sub8 UUID; sub9 UUID; sub10 UUID;
  sub11 UUID; sub12 UUID; sub13 UUID;

  evt1 UUID; evt2 UUID; evt3 UUID; evt4 UUID; evt5 UUID; evt6 UUID;
BEGIN

-- ── Clean existing data ──
DELETE FROM nexo.chat_messages;
DELETE FROM nexo.focus_sessions;
DELETE FROM nexo.notifications;
DELETE FROM nexo.event_attendees;
DELETE FROM nexo.events;
DELETE FROM nexo.attachments;
DELETE FROM nexo.comments;
DELETE FROM nexo.subtasks;
DELETE FROM nexo.tasks;
DELETE FROM nexo.templates;
DELETE FROM nexo.project_members;
DELETE FROM nexo.projects;
DELETE FROM nexo.streaks;
DELETE FROM nexo.leaves;
DELETE FROM nexo.bugs;
DELETE FROM nexo.activity_log;
DELETE FROM nexo.users;

-- ── Users ──
INSERT INTO nexo.users (id, name, email, initials, department, avatar_color, role, preferences) VALUES
  (arjun_id, 'Arjun Mehta',  'arjun@nexo.app', 'AM', 'CEO''s Office', '#F59E0B', 'admin',   '{"theme":"light","notifications":true,"calendarSync":"Google","moodTime":"09:00"}'::jsonb),
  (ravi_id,  'Ravi Kumar',   'ravi@nexo.app',   'RK', 'Operations',   '#EF4444', 'manager', '{"theme":"light","notifications":true,"calendarSync":"Google","moodTime":"09:00"}'::jsonb),
  (ankit_id, 'Ankit Sharma', 'ankit@nexo.app',  'AS', 'Operations',   '#8B5CF6', 'member',  '{"theme":"light","notifications":true,"calendarSync":"Google","moodTime":"09:00"}'::jsonb);

-- Link to auth.users (auto-link by email)
UPDATE nexo.users u SET auth_id = a.id
FROM auth.users a WHERE a.email = u.email;

-- ── Projects ──
INSERT INTO nexo.projects (id, title, department, description, owner_id, deadline, progress, status) VALUES
  (proj1_id, 'B2C Retail Outlet Launch', 'Operations',   'Launch first retail outlet',   ravi_id,  '2026-05-15', 65, 'active'),
  (proj2_id, 'Q2 B2B Sales Strategy',   'CEO''s Office', 'Quarterly sales planning',     arjun_id, '2026-06-01', 40, 'active'),
  (proj3_id, 'Farm Automation Phase 2',  'Operations',   'Automate feed dispensers',     ravi_id,  '2026-07-01', 20, 'active'),
  (proj4_id, 'HR Policy Document Update','CEO''s Office', 'Refresh HR policies',          arjun_id, '2026-04-20', 80, 'active');

-- ── Project Members ──
INSERT INTO nexo.project_members (project_id, user_id) VALUES
  (proj1_id, arjun_id), (proj1_id, ravi_id), (proj1_id, ankit_id),
  (proj2_id, arjun_id), (proj2_id, ravi_id),
  (proj3_id, ravi_id),  (proj3_id, ankit_id),
  (proj4_id, arjun_id), (proj4_id, ankit_id);

-- ── Tasks (quick + project) ──
INSERT INTO nexo.tasks (title, project_id, owner_id, deadline, status, is_quick) VALUES
  ('Distribute HR policy',       proj4_id, arjun_id, '2026-04-08', 'pending', false),
  ('Client meeting at 2 PM',     proj2_id, arjun_id, '2026-04-09', 'pending', false),
  ('Prepare B2B pitch deck',     proj2_id, arjun_id, '2026-04-15', 'pending', false),
  ('Call vendor about packaging', NULL,    arjun_id, '2026-04-09', 'pending', true),
  ('Review Q1 financial summary', NULL,    arjun_id, '2026-04-10', 'pending', true),
  ('Send weekly team update',     NULL,    arjun_id, '2026-04-10', 'pending', true);

-- Recurring task
INSERT INTO nexo.tasks (title, owner_id, deadline, is_quick, recurrence) VALUES
  ('Weekly team update email', arjun_id, '2026-04-10', true, 'weekly');

-- ── Events ──
evt1 := uuid_generate_v4(); evt2 := uuid_generate_v4(); evt3 := uuid_generate_v4();
evt4 := uuid_generate_v4(); evt5 := uuid_generate_v4(); evt6 := uuid_generate_v4();

INSERT INTO nexo.events (id, title, owner_id, start_time, duration_min, event_type, department, priority, meet_link) VALUES
  (evt1, 'Deep work: B2B pitch deck', arjun_id, '2026-04-09 09:00', 90, 'work', 'CEO''s Office', 'High', NULL),
  (evt2, 'Farm visit check-in',       arjun_id, '2026-04-09 10:00', 60, 'work', 'Operations',    NULL,   NULL),
  (evt3, 'Busy',                       arjun_id, '2026-04-09 11:30', 60, 'personal', NULL,        NULL,   NULL),
  (evt4, 'Retail Launch sync',        arjun_id, '2026-04-09 14:00', 45, 'work', 'Operations',    'High', 'https://meet.google.com/abc-defg-hij'),
  (evt5, 'Vendor call',               arjun_id, '2026-04-09 16:00', 30, 'work', 'Operations',    NULL,   NULL),
  (evt6, 'HR policy review',          arjun_id, '2026-04-09 17:00', 30, 'work', 'CEO''s Office', NULL,   NULL);

INSERT INTO nexo.event_attendees (event_id, user_id) VALUES
  (evt4, arjun_id), (evt4, ravi_id), (evt4, ankit_id);

-- ── Streaks ──
INSERT INTO nexo.streaks (user_id, name, current_count, best_count, last_logged) VALUES
  (arjun_id, 'Gym',            23, 45, '2026-04-08'),
  (arjun_id, 'Reading 30 min', 12, 20, '2026-04-08'),
  (ankit_id, '10K Steps',       7, 15, '2026-04-08');

-- ── Subtasks ──
sub1  := uuid_generate_v4(); sub2  := uuid_generate_v4(); sub3  := uuid_generate_v4();
sub4  := uuid_generate_v4(); sub5  := uuid_generate_v4(); sub6  := uuid_generate_v4();
sub7  := uuid_generate_v4(); sub8  := uuid_generate_v4(); sub9  := uuid_generate_v4();
sub10 := uuid_generate_v4(); sub11 := uuid_generate_v4(); sub12 := uuid_generate_v4();
sub13 := uuid_generate_v4();

INSERT INTO nexo.subtasks (id, project_id, title, owner_id, assigned_by, assignment_status, deadline, status, sort_order) VALUES
  (sub1,  proj1_id, 'Finalize store location',          ravi_id,  ravi_id,  'accepted', '2026-03-20', 'done',    1),
  (sub2,  proj1_id, 'Vendor & supplier contracts',      ravi_id,  ravi_id,  'accepted', '2026-04-05', 'done',    2),
  (sub3,  proj1_id, 'Interior design & branding',       ankit_id, ravi_id,  'accepted', '2026-04-18', 'pending', 3),
  (sub4,  proj1_id, 'Hire retail staff',                 ankit_id, ravi_id,  'accepted', '2026-04-25', 'pending', 4),
  (sub5,  proj1_id, 'Launch marketing campaign',        arjun_id, ravi_id,  'accepted', '2026-05-10', 'pending', 5),
  (sub6,  proj2_id, 'Compile Q1 sales data',            arjun_id, arjun_id, 'accepted', '2026-04-15', 'done',    1),
  (sub7,  proj2_id, 'Draft B2B outreach list',           arjun_id, arjun_id, 'accepted', '2026-04-20', 'pending', 2),
  (sub8,  proj2_id, 'Prepare B2B pitch deck',            arjun_id, arjun_id, 'accepted', '2026-04-30', 'pending', 3),
  (sub9,  proj3_id, 'Survey existing feed stations',    ravi_id,  ravi_id,  'accepted', '2026-04-25', 'pending', 1),
  (sub10, proj3_id, 'Select automation vendor',          ravi_id,  ravi_id,  'accepted', '2026-05-15', 'pending', 2),
  (sub11, proj4_id, 'Collect policy updates from team', arjun_id, arjun_id, 'accepted', '2026-04-05', 'done',    1),
  (sub12, proj4_id, 'Rewrite leave policy',              arjun_id, arjun_id, 'accepted', '2026-04-12', 'done',    2),
  (sub13, proj4_id, 'Legal review',                      arjun_id, arjun_id, 'accepted', '2026-04-17', 'pending', 3);

-- ── Comments ──
INSERT INTO nexo.comments (project_id, author_id, body, created_at) VALUES
  (proj1_id, ravi_id,  'Location is locked in. @Ankit can you start on the interior brief this week?', now() - interval '2 days'),
  (proj1_id, ankit_id, 'On it. Draft by Friday.',                                                      now() - interval '2 days'),
  (proj1_id, arjun_id, 'Great. Lets sync on branding before Monday.',                                 now() - interval '1 day'),
  (proj2_id, arjun_id, 'Q1 numbers look strong — outreach list is the blocker now.',                   now() - interval '1 day'),
  (proj4_id, arjun_id, 'Legal review scheduled for next week. @Ankit please share the final draft by Fri.', now() - interval '3 hours');

-- ── Templates ──
INSERT INTO nexo.templates (name, department, description, subtasks, created_by) VALUES
  ('New Retail Outlet Launch', 'Operations', 'Standard checklist for opening a new retail store',
   '["Finalize store location","Vendor & supplier contracts","Interior design & branding","Hire retail staff","Launch marketing campaign","Soft opening"]'::jsonb, arjun_id),
  ('Monthly Farm Audit', 'Operations', 'Recurring farm inspection & reporting',
   '["Inspect feed stations","Record flock weights","Check water systems","Compile monthly report"]'::jsonb, ravi_id),
  ('Quarterly Business Review', 'CEO''s Office', 'QBR prep and execution',
   '["Gather department metrics","Draft executive summary","Review with leadership","Share with team"]'::jsonb, arjun_id);

-- ── Leaves ──
INSERT INTO nexo.leaves (user_id, start_date, end_date, type) VALUES
  (ankit_id, '2026-04-14', '2026-04-15', 'PL');

-- ── Notifications ──
INSERT INTO nexo.notifications (user_id, type, title, body) VALUES
  (arjun_id, 'assignment',    'New Task Assigned: Prepare Vendor Comparison Sheet', 'From Ravi · Retail Launch · Due Apr 14'),
  (arjun_id, 'reminder',      'Meeting Reminder: Retail Launch Sync at 2:00 PM',    NULL),
  (arjun_id, 'poke',          'Ravi poked you!',                                    'About: Store branding & interiors · 1h ago'),
  (arjun_id, 'overdue',       'Deadline Alert: Distribute HR Policy',               'Was due today — now past deadline'),
  (arjun_id, 'optimization',  'Calendar optimized for your energy',                 'Complex tasks moved to morning'),
  (arjun_id, 'completed',     'Ravi completed a task',                              'Vendor & supplier contracts · 3h ago');

END $$;
