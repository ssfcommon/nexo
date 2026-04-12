import { db, initSchema } from './db.js';
import { hashPassword } from './auth.js';

export function runSeed() {
  initSchema();
  seed();
}

function seed() {
// Wipe
db.exec(`
  DELETE FROM chat_messages;
  DELETE FROM bugs;
  DELETE FROM focus_sessions;
  DELETE FROM notifications;
  DELETE FROM event_attendees;
  DELETE FROM events;
  DELETE FROM attachments;
  DELETE FROM comments;
  DELETE FROM subtasks;
  DELETE FROM tasks;
  DELETE FROM templates;
  DELETE FROM project_members;
  DELETE FROM projects;
  DELETE FROM streaks;
  DELETE FROM leaves;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);

const insertUser = db.prepare(
  'INSERT INTO users (id, name, email, password_hash, initials, department, avatar_color, role, preferences) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const pw = hashPassword('password123');
const defaultPrefs = JSON.stringify({ theme: 'light', notifications: true, calendarSync: 'Google', moodTime: '09:00' });
insertUser.run(1, 'Arjun Mehta',  'arjun@nexo.app', pw, 'AM', "CEO's Office", '#F59E0B', 'admin',   defaultPrefs);
insertUser.run(2, 'Ravi Kumar',   'ravi@nexo.app',  pw, 'RK', 'Operations',   '#EF4444', 'manager', defaultPrefs);
insertUser.run(3, 'Ankit Sharma', 'ankit@nexo.app', pw, 'AS', 'Operations',   '#8B5CF6', 'member',  defaultPrefs);

// Projects
const insertProject = db.prepare(
  `INSERT INTO projects (id, title, department, description, owner_id, deadline, priority, complexity, progress)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
insertProject.run(1, 'B2C Retail Outlet Launch', 'Operations', 'Launch first retail outlet', 2, '2026-05-15', 'Critical', 'High', 65);
insertProject.run(2, 'Q2 B2B Sales Strategy', "CEO's Office", 'Quarterly sales planning', 1, '2026-06-01', 'High', 'High', 40);
insertProject.run(3, 'Farm Automation Phase 2', 'Operations', 'Automate feed dispensers', 2, '2026-07-01', 'Medium', 'High', 20);
insertProject.run(4, 'HR Policy Document Update', "CEO's Office", 'Refresh HR policies', 1, '2026-04-20', 'Low', 'Low', 80);

const addMember = db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)');
[[1,1],[1,2],[1,3],[2,1],[2,2],[3,2],[3,3],[4,1],[4,3]].forEach(([p,u]) => addMember.run(p,u));

// Tasks (quick + project)
const insertTask = db.prepare(
  `INSERT INTO tasks (title, project_id, owner_id, deadline, priority, complexity, status, is_quick)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
// Overdue for Arjun
insertTask.run('Distribute HR policy', 4, 1, '2026-04-08', 'Critical', 'Low', 'overdue', 0);
// Due today
insertTask.run('Client meeting at 2 PM', 2, 1, '2026-04-09', 'High', 'Medium', 'pending', 0);
// Upcoming
insertTask.run('Prepare B2B pitch deck', 2, 1, '2026-04-15', 'High', 'High', 'pending', 0);
// Quick tasks
insertTask.run('Call vendor about packaging', null, 1, '2026-04-09', 'Medium', 'Low', 'pending', 1);
insertTask.run('Review Q1 financial summary', null, 1, '2026-04-10', 'Medium', 'Medium', 'pending', 1);
insertTask.run('Send weekly team update', null, 1, '2026-04-10', 'Low', 'Low', 'pending', 1);

// Events for today (2026-04-09)
const insertEvent = db.prepare(
  `INSERT INTO events (id, title, owner_id, start_time, duration_min, event_type, department, priority, meet_link)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
insertEvent.run(1, 'Deep work: B2B pitch deck', 1, '2026-04-09 09:00', 90, 'work', "CEO's Office", 'High', null);
insertEvent.run(2, 'Farm visit check-in', 1, '2026-04-09 10:00', 60, 'work', 'Operations', null, null);
insertEvent.run(3, 'Busy', 1, '2026-04-09 11:30', 60, 'personal', null, null, null);
insertEvent.run(4, 'Retail Launch sync', 1, '2026-04-09 14:00', 45, 'work', 'Operations', 'High', 'https://meet.google.com/abc-defg-hij');
insertEvent.run(5, 'Vendor call', 1, '2026-04-09 16:00', 30, 'work', 'Operations', null, null);
insertEvent.run(6, 'HR policy review', 1, '2026-04-09 17:00', 30, 'work', "CEO's Office", null, null);

const addAttendee = db.prepare('INSERT INTO event_attendees (event_id, user_id) VALUES (?, ?)');
[[4,1],[4,2],[4,3]].forEach(([e,u]) => addAttendee.run(e,u));

// Streaks
const insertStreak = db.prepare(
  'INSERT INTO streaks (user_id, name, current_count, best_count, last_logged) VALUES (?, ?, ?, ?, ?)'
);
insertStreak.run(1, 'Gym', 23, 45, '2026-04-08');
insertStreak.run(1, 'Reading 30 min', 12, 20, '2026-04-08');
insertStreak.run(3, '10K Steps', 7, 15, '2026-04-08');

// Subtasks — B2C Retail Launch (65% done = some checked)
const insertSub = db.prepare(
  `INSERT INTO subtasks (project_id, title, owner_id, deadline, status, sort_order)
   VALUES (?, ?, ?, ?, ?, ?)`
);
[
  [1, 'Finalize store location',           2, '2026-03-20', 'done',    1],
  [1, 'Vendor & supplier contracts',       2, '2026-04-05', 'done',    2],
  [1, 'Interior design & branding',        3, '2026-04-18', 'pending', 3],
  [1, 'Hire retail staff',                 3, '2026-04-25', 'pending', 4],
  [1, 'Launch marketing campaign',         1, '2026-05-10', 'pending', 5],
  [2, 'Compile Q1 sales data',             1, '2026-04-15', 'done',    1],
  [2, 'Draft B2B outreach list',           1, '2026-04-20', 'pending', 2],
  [2, 'Prepare B2B pitch deck',            1, '2026-04-30', 'pending', 3],
  [3, 'Survey existing feed stations',     2, '2026-04-25', 'pending', 1],
  [3, 'Select automation vendor',          2, '2026-05-15', 'pending', 2],
  [4, 'Collect policy updates from team',  1, '2026-04-05', 'done',    1],
  [4, 'Rewrite leave policy',              1, '2026-04-12', 'done',    2],
  [4, 'Legal review',                      1, '2026-04-17', 'pending', 3],
].forEach(row => insertSub.run(...row));

// Recalc project progress from subtasks
const projectIds = db.prepare('SELECT id FROM projects').all().map(r => r.id);
const updateProg = db.prepare('UPDATE projects SET progress = ? WHERE id = ?');
projectIds.forEach(pid => {
  const { total, done } = db.prepare(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done FROM subtasks WHERE project_id = ?"
  ).get(pid);
  if (total > 0) updateProg.run(Math.round((done / total) * 100), pid);
});

// Comments
const insertComment = db.prepare(
  `INSERT INTO comments (project_id, author_id, body, created_at) VALUES (?, ?, ?, datetime('now', ?))`
);
insertComment.run(1, 2, 'Location is locked in. @Ankit can you start on the interior brief this week?', '-2 days');
insertComment.run(1, 3, 'On it. Draft by Friday.', '-2 days');
insertComment.run(1, 1, 'Great. Lets sync on branding before Monday.', '-1 day');
insertComment.run(2, 1, 'Q1 numbers look strong — outreach list is the blocker now.', '-1 day');
insertComment.run(4, 1, 'Legal review scheduled for next week. @Ankit please share the final draft by Fri.', '-3 hours');

// Templates
const insertTemplate = db.prepare(
  `INSERT INTO templates (name, department, priority, complexity, description, subtasks_json, created_by)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
insertTemplate.run(
  'New Retail Outlet Launch', 'Operations', 'High', 'High',
  'Standard checklist for opening a new retail store',
  JSON.stringify([
    'Finalize store location',
    'Vendor & supplier contracts',
    'Interior design & branding',
    'Hire retail staff',
    'Launch marketing campaign',
    'Soft opening',
  ]),
  1
);
insertTemplate.run(
  'Monthly Farm Audit', 'Operations', 'Medium', 'Medium',
  'Recurring farm inspection & reporting',
  JSON.stringify([
    'Inspect feed stations',
    'Record flock weights',
    'Check water systems',
    'Compile monthly report',
  ]),
  2
);
insertTemplate.run(
  'Quarterly Business Review', "CEO's Office", 'High', 'Medium',
  'QBR prep and execution',
  JSON.stringify([
    'Gather department metrics',
    'Draft executive summary',
    'Review with leadership',
    'Share with team',
  ]),
  1
);

// Recurring task for Arjun — weekly team update
db.prepare(
  `INSERT INTO tasks (title, owner_id, deadline, priority, complexity, is_quick, recurrence)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run('Weekly team update email', 1, '2026-04-10', 'Medium', 'Low', 1, 'weekly');

// Leaves
db.prepare('INSERT INTO leaves (user_id, start_date, end_date, type) VALUES (?, ?, ?, ?)')
  .run(3, '2026-04-14', '2026-04-15', 'planned');

// Notifications for Arjun
const insertNotif = db.prepare(
  'INSERT INTO notifications (user_id, type, title, body, meta) VALUES (?, ?, ?, ?, ?)'
);
insertNotif.run(1, 'assignment', 'New Task Assigned: Prepare Vendor Comparison Sheet', 'From Ravi · Retail Launch · Due Apr 14', null);
insertNotif.run(1, 'reminder', 'Meeting Reminder: Retail Launch Sync at 2:00 PM', null, null);
insertNotif.run(1, 'poke', 'Ravi poked you!', 'About: Store branding & interiors · 1h ago', null);
insertNotif.run(1, 'overdue', 'Deadline Alert: Distribute HR Policy', 'Was due today — now past deadline', null);
insertNotif.run(1, 'optimization', 'Calendar optimized for your energy', 'Complex tasks moved to morning', null);
insertNotif.run(1, 'completed', 'Ravi completed a task', 'Vendor & supplier contracts · 3h ago', null);

} // end seed()

// Run when executed directly: `node src/seed.js`
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed();
  console.log('Seeded successfully.');
}
