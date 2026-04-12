-- =============================================================================
-- NEXO — Seed with real team from public.employees
-- =============================================================================

DO $$
DECLARE
  -- Map employees to their auth IDs
  shaubhik_auth UUID := '3a782fc8-f223-4a0d-8ecb-802b2ffc5f77';
  prabal_auth   UUID := '86780470-69c6-4929-aee4-fd815ec79b51';
  tanbir_auth   UUID := 'd6780fa2-c458-4d1b-b5da-9005763ea229';
  shuhel_auth   UUID := '8f661920-7efc-4935-ae84-67687c23401c';

  shaubhik_id UUID; prabal_id UUID; tanbir_id UUID; shuhel_id UUID;
  chinilal_id UUID; kuddus_id UUID; bikram_id UUID; azad_id UUID;

  proj1_id UUID; proj2_id UUID; proj3_id UUID; proj4_id UUID;
BEGIN

-- ── Users ──
INSERT INTO nexo.users (id, auth_id, name, email, initials, department, avatar_color, role, preferences) VALUES
  (uuid_generate_v4(), shaubhik_auth, 'Shaubhik Das',       '7002857682@farm.app', 'SD', 'CEO''s Office', '#4A6CF7', 'admin',   '{}'::jsonb),
  (uuid_generate_v4(), prabal_auth,   'Prabal Parashar',     '6001789483@farm.app', 'PP', 'Operations',   '#22C55E', 'manager', '{}'::jsonb),
  (uuid_generate_v4(), tanbir_auth,   'Tanbir Islam',        '9735005949@farm.app', 'TI', 'Operations',   '#F59E0B', 'manager', '{}'::jsonb),
  (uuid_generate_v4(), shuhel_auth,   'Shuhel Amin Laskar',  '7002861289@farm.app', 'SL', 'Operations',   '#EF4444', 'manager', '{}'::jsonb),
  (uuid_generate_v4(), NULL,          'Chinilal Bhumij',     'chinilal@nexo.local', 'CB', 'Operations',   '#8B5CF6', 'member',  '{}'::jsonb),
  (uuid_generate_v4(), NULL,          'Abdul Kuddus Laskar', 'kuddus@nexo.local',   'AK', 'Operations',   '#EC4899', 'member',  '{}'::jsonb),
  (uuid_generate_v4(), NULL,          'Bikram Bhumij',       'bikram@nexo.local',   'BB', 'Operations',   '#06B6D4', 'member',  '{}'::jsonb),
  (uuid_generate_v4(), NULL,          'Azad Ahmed Laskar',   'azad@nexo.local',     'AA', 'Operations',   '#14B8A6', 'member',  '{}'::jsonb);

SELECT id INTO shaubhik_id FROM nexo.users WHERE name = 'Shaubhik Das';
SELECT id INTO prabal_id   FROM nexo.users WHERE name = 'Prabal Parashar';
SELECT id INTO tanbir_id   FROM nexo.users WHERE name = 'Tanbir Islam';
SELECT id INTO shuhel_id   FROM nexo.users WHERE name = 'Shuhel Amin Laskar';
SELECT id INTO chinilal_id FROM nexo.users WHERE name = 'Chinilal Bhumij';
SELECT id INTO kuddus_id   FROM nexo.users WHERE name = 'Abdul Kuddus Laskar';
SELECT id INTO bikram_id   FROM nexo.users WHERE name = 'Bikram Bhumij';
SELECT id INTO azad_id     FROM nexo.users WHERE name = 'Azad Ahmed Laskar';

-- ── Projects ──
proj1_id := uuid_generate_v4();
proj2_id := uuid_generate_v4();
proj3_id := uuid_generate_v4();
proj4_id := uuid_generate_v4();

INSERT INTO nexo.projects (id, title, department, description, owner_id, deadline, progress, status) VALUES
  (proj1_id, 'B2C Retail Outlet Launch', 'Operations',    'Launch first retail outlet in Silchar',    prabal_id,   '2026-05-15', 0, 'active'),
  (proj2_id, 'Q2 B2B Sales Strategy',    'CEO''s Office', 'Quarterly sales planning and outreach',    shaubhik_id, '2026-06-01', 0, 'active'),
  (proj3_id, 'Farm Automation Phase 2',  'Operations',    'Automate feed dispensers across all sheds',tanbir_id,   '2026-07-01', 0, 'active'),
  (proj4_id, 'HR Policy Document Update','CEO''s Office', 'Refresh HR policies for compliance',       shaubhik_id, '2026-04-20', 0, 'active');

-- ── Project Members ──
INSERT INTO nexo.project_members (project_id, user_id) VALUES
  (proj1_id, shaubhik_id), (proj1_id, prabal_id), (proj1_id, tanbir_id),
  (proj2_id, shaubhik_id), (proj2_id, prabal_id),
  (proj3_id, tanbir_id),   (proj3_id, chinilal_id), (proj3_id, bikram_id),
  (proj4_id, shaubhik_id), (proj4_id, shuhel_id);

-- ── Subtasks ──
INSERT INTO nexo.subtasks (project_id, title, owner_id, assigned_by, assignment_status, deadline, status, sort_order) VALUES
  (proj1_id, 'Finalize store location',      prabal_id,   prabal_id,   'accepted', '2026-03-20', 'done',    1),
  (proj1_id, 'Vendor & supplier contracts',  prabal_id,   prabal_id,   'accepted', '2026-04-05', 'done',    2),
  (proj1_id, 'Interior design & branding',   tanbir_id,   prabal_id,   'accepted', '2026-04-18', 'pending', 3),
  (proj1_id, 'Hire retail staff',            shuhel_id,   prabal_id,   'accepted', '2026-04-25', 'pending', 4),
  (proj1_id, 'Launch marketing campaign',    shaubhik_id, prabal_id,   'accepted', '2026-05-10', 'pending', 5),
  (proj2_id, 'Compile Q1 sales data',        shaubhik_id, shaubhik_id, 'accepted', '2026-04-15', 'done',    1),
  (proj2_id, 'Draft B2B outreach list',      shaubhik_id, shaubhik_id, 'accepted', '2026-04-20', 'pending', 2),
  (proj2_id, 'Prepare B2B pitch deck',       shaubhik_id, shaubhik_id, 'accepted', '2026-04-30', 'pending', 3),
  (proj3_id, 'Survey existing feed stations',tanbir_id,   tanbir_id,   'accepted', '2026-04-25', 'pending', 1),
  (proj3_id, 'Select automation vendor',     tanbir_id,   tanbir_id,   'accepted', '2026-05-15', 'pending', 2),
  (proj4_id, 'Collect policy updates',       shaubhik_id, shaubhik_id, 'accepted', '2026-04-05', 'done',    1),
  (proj4_id, 'Rewrite leave policy',         shuhel_id,   shaubhik_id, 'accepted', '2026-04-12', 'done',    2),
  (proj4_id, 'Legal review',                 shaubhik_id, shaubhik_id, 'accepted', '2026-04-17', 'pending', 3);

-- ── Tasks ──
INSERT INTO nexo.tasks (title, project_id, owner_id, deadline, status, is_quick) VALUES
  ('Distribute HR policy',        proj4_id, shaubhik_id, '2026-04-08', 'pending', false),
  ('Client meeting at 2 PM',      proj2_id, shaubhik_id, '2026-04-09', 'pending', false),
  ('Prepare B2B pitch deck',      proj2_id, shaubhik_id, '2026-04-15', 'pending', false),
  ('Call vendor about packaging',  NULL,    shaubhik_id, '2026-04-09', 'pending', true),
  ('Review Q1 financial summary',  NULL,    shaubhik_id, '2026-04-10', 'pending', true);

INSERT INTO nexo.tasks (title, owner_id, deadline, is_quick, recurrence) VALUES
  ('Weekly team update email', shaubhik_id, '2026-04-10', true, 'weekly');

-- ── Comments ──
INSERT INTO nexo.comments (project_id, author_id, body, created_at) VALUES
  (proj1_id, prabal_id,   'Location locked in. Tanbir, start the interior brief this week.', now() - interval '2 days'),
  (proj1_id, tanbir_id,   'On it. Draft by Friday.',                                         now() - interval '2 days'),
  (proj1_id, shaubhik_id, 'Great. Sync on branding before Monday.',                          now() - interval '1 day'),
  (proj2_id, shaubhik_id, 'Q1 numbers look strong - outreach list is the blocker now.',       now() - interval '1 day');

-- ── Streaks ──
INSERT INTO nexo.streaks (user_id, name, current_count, best_count, last_logged) VALUES
  (shaubhik_id, 'Gym',            23, 45, '2026-04-11'),
  (shaubhik_id, 'Reading 30 min', 12, 20, '2026-04-11');

-- ── Leaves ──
INSERT INTO nexo.leaves (user_id, start_date, end_date, type) VALUES
  (chinilal_id, '2026-04-14', '2026-04-15', 'PL');

-- ── Notifications ──
INSERT INTO nexo.notifications (user_id, type, title, body) VALUES
  (shaubhik_id, 'reminder',  'Meeting Reminder: Retail Launch Sync at 2:00 PM', NULL),
  (shaubhik_id, 'overdue',   'Deadline Alert: Distribute HR Policy',            'Was due Apr 8'),
  (shaubhik_id, 'completed', 'Prabal completed a task',                          'Vendor & supplier contracts');

-- ── Templates ──
INSERT INTO nexo.templates (name, department, description, subtasks, created_by) VALUES
  ('New Retail Outlet Launch', 'Operations', 'Standard checklist for opening a new retail store',
   '["Finalize store location","Vendor & supplier contracts","Interior design & branding","Hire retail staff","Launch marketing campaign","Soft opening"]'::jsonb, shaubhik_id),
  ('Monthly Farm Audit', 'Operations', 'Recurring farm inspection & reporting',
   '["Inspect feed stations","Record flock weights","Check water systems","Compile monthly report"]'::jsonb, tanbir_id);

END $$;
