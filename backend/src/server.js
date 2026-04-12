import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, initSchema } from './db.js';
import {
  verifyPassword, setSessionCookie, clearSessionCookie, sessionMiddleware, requireAuth,
} from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

initSchema();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(sessionMiddleware);

// ----- Auth -----
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  setSessionCookie(res, user.id);
  const { password_hash, ...safe } = user;
  res.json(safe);
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Everything below /api except /auth/* normally requires auth, but login is
// temporarily disabled — fall back to user 1 (Arjun) for any unauthenticated
// request. Re-enable by swapping `req.userId ||= 1` for the commented line.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  // return requireAuth(req, res, next);
  if (!req.userId) req.userId = 1;
  return next();
});

// Helpers
const all = (sql, ...params) => db.prepare(sql).all(...params);
const get = (sql, ...params) => db.prepare(sql).get(...params);
const run = (sql, ...params) => db.prepare(sql).run(...params);

// ----- Users -----
const USER_COLS = 'id, name, email, initials, department, avatar_color, avatar_url, role, preferences';

function requireRole(...allowed) {
  return (req, res, next) => {
    const u = get('SELECT role FROM users WHERE id = ?', req.userId);
    if (!u || !allowed.includes(u.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}

app.get('/api/me/preferences', (req, res) => {
  const u = get('SELECT preferences FROM users WHERE id = ?', req.userId);
  try { res.json(JSON.parse(u?.preferences || '{}')); }
  catch { res.json({}); }
});

app.patch('/api/me', (req, res) => {
  const { name, department } = req.body;
  const fields = [], values = [];
  if (name) { fields.push('name = ?'); values.push(name); }
  if (department) { fields.push('department = ?'); values.push(department); }
  if (name) {
    const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    fields.push('initials = ?'); values.push(initials);
  }
  if (fields.length) {
    values.push(req.userId);
    run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...values);
  }
  res.json(get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, req.userId));
});

app.post('/api/me/avatar', (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return res.status(400).json({ error: 'invalid data URL' });
  const mime = match[1];
  if (!mime.startsWith('image/')) return res.status(400).json({ error: 'must be an image' });
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'max 2MB' });
  const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
  const stored = `avatar-${req.userId}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, stored), buf);
  const avatarUrl = '/uploads/' + stored;
  run('UPDATE users SET avatar_url = ? WHERE id = ?', avatarUrl, req.userId);
  res.json(get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, req.userId));
});

app.patch('/api/me/preferences', (req, res) => {
  const current = get('SELECT preferences FROM users WHERE id = ?', req.userId);
  const prefs = { ...(JSON.parse(current?.preferences || '{}')), ...req.body };
  run('UPDATE users SET preferences = ? WHERE id = ?', JSON.stringify(prefs), req.userId);
  res.json(prefs);
});

// Admin-only: change a user's role
app.patch('/api/users/:id/role', requireRole('admin'), (req, res) => {
  const { role } = req.body;
  if (!['admin', 'manager', 'member'].includes(role)) {
    return res.status(400).json({ error: 'invalid role' });
  }
  run('UPDATE users SET role = ? WHERE id = ?', role, req.params.id);
  res.json(get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, req.params.id));
});
app.get('/api/me', (req, res) => {
  res.json(get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, req.userId));
});

app.get('/api/users', (req, res) => {
  res.json(all(`SELECT ${USER_COLS} FROM users ORDER BY id`));
});

// ----- Projects -----
app.get('/api/projects', (req, res) => {
  const { scope } = req.query; // 'mine' | 'all'
  let rows;
  if (scope === 'mine') {
    rows = all(
      `SELECT DISTINCT p.* FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       WHERE p.owner_id = ? OR pm.user_id = ?
       ORDER BY p.created_at DESC`,
      req.userId, req.userId
    );
  } else {
    rows = all('SELECT * FROM projects ORDER BY created_at DESC');
  }
  const memberStmt = db.prepare(
    `SELECT u.id, u.name, u.email, u.initials, u.department, u.avatar_color, u.avatar_url FROM users u JOIN project_members pm ON pm.user_id = u.id WHERE pm.project_id = ?`
  );
  rows.forEach(r => { r.members = memberStmt.all(r.id); });
  res.json(rows);
});

app.post('/api/projects', (req, res) => {
  const { title, department, description, deadline, priority, complexity, memberIds = [] } = req.body;
  const info = run(
    `INSERT INTO projects (title, department, description, owner_id, deadline, priority, complexity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    title, department, description || null, req.userId, deadline || null,
    priority || 'Medium', complexity || 'Medium'
  );
  const projectId = info.lastInsertRowid;
  run('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)', projectId, req.userId);
  memberIds.forEach(uid => {
    if (uid !== req.userId) {
      run('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', projectId, uid);
    }
  });
  const created = get('SELECT * FROM projects WHERE id = ?', projectId);
  broadcast('project-created', { id: created.id, title: created.title });
  res.json(created);
});

app.get('/api/projects/:id', (req, res) => {
  const p = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  p.owner = get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, p.owner_id);
  p.members = all(
    `SELECT u.id, u.name, u.email, u.initials, u.department, u.avatar_color, u.avatar_url FROM users u JOIN project_members pm ON pm.user_id = u.id WHERE pm.project_id = ?`,
    p.id
  );
  p.subtasks = all(
    `SELECT s.*, u.name AS owner_name, u.initials AS owner_initials, u.avatar_color AS owner_color, u.avatar_url AS owner_avatar
     FROM subtasks s LEFT JOIN users u ON u.id = s.owner_id
     WHERE s.project_id = ?
     ORDER BY COALESCE(s.parent_id, s.id), s.depth, s.sort_order, s.id`,
    p.id
  );
  p.comments = all(
    `SELECT c.*, u.name AS author_name, u.initials AS author_initials, u.avatar_color AS author_color, u.avatar_url AS author_avatar
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.project_id = ? ORDER BY c.created_at ASC`,
    p.id
  );
  const attachStmt = db.prepare('SELECT id, filename, stored_path, mime, size FROM attachments WHERE comment_id = ?');
  p.comments.forEach(c => {
    c.attachments = attachStmt.all(c.id).map(a => ({
      id: a.id,
      filename: a.filename,
      url: '/uploads/' + a.stored_path,
      mime: a.mime,
      size: a.size,
    }));
  });
  res.json(p);
});

function recalcProgress(projectId) {
  const row = get(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done FROM subtasks WHERE project_id = ?",
    projectId
  );
  if (row.total > 0) {
    run('UPDATE projects SET progress = ? WHERE id = ?', Math.round((row.done / row.total) * 100), projectId);
  }
}

app.post('/api/projects/:id/subtasks', (req, res) => {
  const { title, ownerId, deadline, parentId, complexity } = req.body;
  const owner = ownerId || req.userId;
  const assignedToOther = owner !== req.userId;
  const assignment_status = assignedToOther ? 'pending' : 'accepted';
  const max = get('SELECT COALESCE(MAX(sort_order), 0) AS m FROM subtasks WHERE project_id = ?', req.params.id).m;
  const depth = parentId ? (get('SELECT depth FROM subtasks WHERE id = ?', parentId)?.depth || 0) + 1 : 0;
  const info = run(
    `INSERT INTO subtasks (project_id, parent_id, depth, title, owner_id, assigned_by, assignment_status, deadline, complexity, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.params.id, parentId || null, depth, title, owner, req.userId, assignment_status, deadline || null, complexity || null, max + 1
  );
  recalcProgress(req.params.id);

  if (assignedToOther) {
    const project = get('SELECT title FROM projects WHERE id = ?', req.params.id);
    const assigner = get('SELECT name FROM users WHERE id = ?', req.userId);
    let onLeave = null;
    if (deadline) {
      onLeave = get(
        `SELECT * FROM leaves WHERE user_id = ? AND start_date <= ? AND end_date >= ?`,
        owner, deadline, deadline
      );
    }
    run(
      `INSERT INTO notifications (user_id, type, title, body, subtask_id, project_id)
       VALUES (?, 'assignment', ?, ?, ?, ?)`,
      owner,
      `New Task Assigned: ${title}`,
      `From ${assigner.name} · ${project.title}${deadline ? ' · Due ' + deadline : ''}${onLeave ? ' · ⚠️ assigned during your leave' : ''}`,
      info.lastInsertRowid,
      req.params.id
    );
  }

  res.json(get('SELECT * FROM subtasks WHERE id = ?', info.lastInsertRowid));
});

app.post('/api/subtasks/:id/respond', (req, res) => {
  const { action, deadline, note } = req.body; // 'accept' | 'modify' | 'decline'
  const sub = get('SELECT * FROM subtasks WHERE id = ?', req.params.id);
  if (!sub) return res.status(404).json({ error: 'not found' });
  if (sub.owner_id !== req.userId) return res.status(403).json({ error: 'not your subtask' });

  let nextStatus = sub.assignment_status;
  let nextDeadline = sub.deadline;
  let proposed = null;
  let declineNote = null;

  if (action === 'accept') {
    nextStatus = 'accepted';
  } else if (action === 'modify') {
    nextStatus = 'accepted';
    nextDeadline = deadline || sub.deadline;
    proposed = deadline || null;
  } else if (action === 'decline') {
    nextStatus = 'declined';
    declineNote = note || null;
  }

  run(
    `UPDATE subtasks SET assignment_status = ?, deadline = ?, proposed_deadline = ?, decline_note = ? WHERE id = ?`,
    nextStatus, nextDeadline, proposed, declineNote, req.params.id
  );

  // Notify the assigner of the response
  if (sub.assigned_by && sub.assigned_by !== req.userId) {
    const responder = get('SELECT name FROM users WHERE id = ?', req.userId);
    const type = action === 'decline' ? 'declined' : action === 'modify' ? 'modified' : 'accepted';
    const label = action === 'decline' ? 'declined' : action === 'modify' ? 'proposed new timeline' : 'accepted';
    run(
      `INSERT INTO notifications (user_id, type, title, body, subtask_id, project_id)
       VALUES (?, 'completed', ?, ?, ?, ?)`,
      sub.assigned_by,
      `${responder.name} ${label}: ${sub.title}`,
      action === 'modify' ? `Proposed new deadline: ${deadline}` : (note || null),
      sub.id,
      sub.project_id
    );
  }

  // Mark original assignment notification as read
  run(
    `UPDATE notifications SET read = 1 WHERE subtask_id = ? AND type = 'assignment' AND user_id = ?`,
    req.params.id, req.userId
  );

  res.json(get('SELECT * FROM subtasks WHERE id = ?', req.params.id));
});

app.patch('/api/subtasks/:id', (req, res) => {
  const { status, title, deadline, ownerId, complexity } = req.body;
  const fields = [], values = [];
  if (status) { fields.push('status = ?'); values.push(status); }
  if (title) { fields.push('title = ?'); values.push(title); }
  if (deadline) { fields.push('deadline = ?'); values.push(deadline); }
  if (ownerId) { fields.push('owner_id = ?'); values.push(ownerId); }
  if (complexity !== undefined) { fields.push('complexity = ?'); values.push(complexity || null); }
  if (fields.length) {
    values.push(req.params.id);
    run(`UPDATE subtasks SET ${fields.join(', ')} WHERE id = ?`, ...values);
  }
  const sub = get('SELECT * FROM subtasks WHERE id = ?', req.params.id);
  if (sub) {
    recalcProgress(sub.project_id);
    broadcast('subtask-updated', { id: sub.id, projectId: sub.project_id, status: sub.status });

    // When a subtask is completed, notify the owner of the next step
    if (status === 'done') {
      const nextSub = get(
        `SELECT s.*, u.name AS owner_name FROM subtasks s LEFT JOIN users u ON u.id = s.owner_id
         WHERE s.project_id = ? AND s.status != 'done' AND s.depth = ? AND s.sort_order > ?
         ORDER BY s.sort_order, s.id LIMIT 1`,
        sub.project_id, sub.depth, sub.sort_order
      );
      if (nextSub && nextSub.owner_id && nextSub.owner_id !== req.userId) {
        const completer = get('SELECT name FROM users WHERE id = ?', req.userId);
        const project = get('SELECT title FROM projects WHERE id = ?', sub.project_id);
        run(
          `INSERT INTO notifications (user_id, type, title, body, subtask_id, project_id)
           VALUES (?, 'assignment', ?, ?, ?, ?)`,
          nextSub.owner_id,
          `Your turn: ${nextSub.title}`,
          `${completer?.name || 'Someone'} completed "${sub.title}" in ${project?.title || 'a project'}. You're up next.`,
          nextSub.id,
          sub.project_id
        );
      }
    }
  }
  res.json(sub);
});

app.delete('/api/subtasks/:id', (req, res) => {
  const sub = get('SELECT * FROM subtasks WHERE id = ?', req.params.id);
  run('DELETE FROM subtasks WHERE id = ?', req.params.id);
  if (sub) recalcProgress(sub.project_id);
  res.json({ ok: true });
});

// Mock Google Meet link generator
function generateMeetLink() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * 26)]).join('');
  return `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
}

app.post('/api/projects/:id/meetings', (req, res) => {
  const { title, startTime, durationMin = 30, attendeeIds = [] } = req.body;
  const meetLink = generateMeetLink();
  const info = run(
    `INSERT INTO events (title, owner_id, start_time, duration_min, event_type, department, priority, meet_link)
     VALUES (?, ?, ?, ?, 'work', NULL, 'High', ?)`,
    title, req.userId, startTime, durationMin, meetLink
  );
  const eventId = info.lastInsertRowid;
  const allAttendees = [...new Set([req.userId, ...attendeeIds])];
  allAttendees.forEach(uid => {
    run('INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)', eventId, uid);
  });
  // Notify attendees
  const project = get('SELECT title FROM projects WHERE id = ?', req.params.id);
  const organizer = get('SELECT name FROM users WHERE id = ?', req.userId);
  allAttendees.filter(uid => uid !== req.userId).forEach(uid => {
    run(
      `INSERT INTO notifications (user_id, type, title, body, project_id, meta)
       VALUES (?, 'reminder', ?, ?, ?, ?)`,
      uid,
      `Meeting: ${title}`,
      `${organizer.name} · ${project.title} · ${startTime} · ${meetLink}`,
      req.params.id,
      `event:${eventId}`
    );
  });
  res.json(get('SELECT * FROM events WHERE id = ?', eventId));
});

app.get('/api/projects/:id/meetings', (req, res) => {
  const rows = all(
    `SELECT e.* FROM events e
     WHERE e.meet_link IS NOT NULL AND EXISTS (
       SELECT 1 FROM notifications n WHERE n.project_id = ? AND n.meta = 'event:' || e.id
     )
     OR (e.owner_id = ? AND e.meet_link IS NOT NULL)
     ORDER BY e.start_time ASC`,
    req.params.id, req.userId
  );
  res.json(rows);
});

app.post('/api/pokes', (req, res) => {
  const { receiverId, subtaskId = null, projectId = null } = req.body;
  if (!receiverId || receiverId === req.userId) {
    return res.status(400).json({ error: 'invalid receiver' });
  }
  // Rate limit: 1 poke per sender/receiver/subtask per day
  const sinceMidnight = new Date().toISOString().slice(0, 10) + ' 00:00:00';
  const recent = get(
    `SELECT COUNT(*) AS c FROM notifications
     WHERE type = 'poke' AND user_id = ? AND meta = ? AND created_at >= ?`,
    receiverId, `from:${req.userId};sub:${subtaskId || ''}`, sinceMidnight
  );
  if (recent.c > 0) {
    return res.status(429).json({ error: 'Already poked today' });
  }

  const sender = get('SELECT name FROM users WHERE id = ?', req.userId);
  let subtitle = '';
  if (subtaskId) {
    const s = get('SELECT title FROM subtasks WHERE id = ?', subtaskId);
    if (s) subtitle = s.title;
  } else if (projectId) {
    const p = get('SELECT title FROM projects WHERE id = ?', projectId);
    if (p) subtitle = p.title;
  }

  // If receiver is on leave today, still create but add leave note
  const today = new Date().toISOString().slice(0, 10);
  const leave = get(
    `SELECT * FROM leaves WHERE user_id = ? AND start_date <= ? AND end_date >= ?`,
    receiverId, today, today
  );
  const leaveSuffix = leave ? ` · currently on leave until ${leave.end_date}` : '';

  run(
    `INSERT INTO notifications (user_id, type, title, body, meta, subtask_id, project_id)
     VALUES (?, 'poke', ?, ?, ?, ?, ?)`,
    receiverId,
    `${sender.name} poked you 👆`,
    `About: ${subtitle}${leaveSuffix}`,
    `from:${req.userId};sub:${subtaskId || ''}`,
    subtaskId,
    projectId
  );
  res.json({ ok: true, queuedForReturn: !!leave });
});

app.post('/api/projects/:id/comments', (req, res) => {
  const { body, attachments = [] } = req.body;
  const info = run(
    `INSERT INTO comments (project_id, author_id, body) VALUES (?, ?, ?)`,
    req.params.id, req.userId, body
  );
  const commentId = info.lastInsertRowid;
  saveAttachments(attachments, { commentId });

  const comment = get(
    `SELECT c.*, u.name AS author_name, u.initials AS author_initials, u.avatar_color AS author_color, u.avatar_url AS author_avatar
     FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
    commentId
  );
  comment.attachments = all(
    'SELECT id, filename, stored_path, mime, size FROM attachments WHERE comment_id = ?',
    commentId
  ).map(a => ({ id: a.id, filename: a.filename, url: '/uploads/' + a.stored_path, mime: a.mime, size: a.size }));
  broadcast('comment-created', { projectId: Number(req.params.id), commentId });
  res.json(comment);
});

app.delete('/api/projects/:id', requireRole('admin', 'manager'), (req, res) => {
  run('DELETE FROM projects WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

app.patch('/api/projects/:id', (req, res) => {
  const { progress, status, priority } = req.body;
  const fields = [];
  const values = [];
  if (progress != null) { fields.push('progress = ?'); values.push(progress); }
  if (status) { fields.push('status = ?'); values.push(status); }
  if (priority) { fields.push('priority = ?'); values.push(priority); }
  if (fields.length) {
    values.push(req.params.id);
    run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, ...values);
  }
  res.json(get('SELECT * FROM projects WHERE id = ?', req.params.id));
});

// ----- Tasks -----
app.get('/api/tasks', (req, res) => {
  const { quick, owner } = req.query;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  if (quick === '1') { sql += ' AND is_quick = 1'; }
  if (quick === '0') { sql += ' AND is_quick = 0'; }
  if (owner === 'me') { sql += ' AND owner_id = ?'; params.push(req.userId); }
  sql += ' ORDER BY deadline ASC';
  res.json(all(sql, ...params));
});

app.get('/api/tasks/urgent', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = all(
    `SELECT * FROM tasks
     WHERE owner_id = ? AND status != 'done'
     ORDER BY
       CASE WHEN deadline < ? THEN 0
            WHEN deadline = ? THEN 1
            ELSE 2 END,
       CASE WHEN priority = 'Urgent & Important' THEN 0
            WHEN priority = 'Urgent & Not Important' THEN 1
            WHEN priority = 'Not Urgent but Important' THEN 2
            WHEN priority = 'Critical' THEN 0
            WHEN priority = 'High' THEN 1
            ELSE 3 END,
       deadline ASC
     LIMIT 5`,
    req.userId, today, today
  );
  res.json(rows);
});

function saveAttachments(attachments, { commentId, taskId, eventId, projectId }) {
  if (!attachments || !attachments.length) return;
  attachments.forEach(att => {
    const match = /^data:([^;]+);base64,(.+)$/.exec(att.dataUrl || '');
    if (!match) return;
    const mime = match[1];
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) return;
    const ext = (att.filename?.match(/\.[a-z0-9]+$/i) || [''])[0];
    const stored = crypto.randomBytes(12).toString('hex') + ext;
    fs.writeFileSync(path.join(UPLOADS_DIR, stored), buf);
    run(
      `INSERT INTO attachments (comment_id, task_id, event_id, project_id, filename, stored_path, mime, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      commentId || null, taskId || null, eventId || null, projectId || null, att.filename || stored, stored, mime, buf.length
    );
  });
}

app.post('/api/tasks', (req, res) => {
  const { title, projectId, deadline, priority, complexity, isQuick, recurrence, alarm_at, description, attachments } = req.body;
  const info = run(
    `INSERT INTO tasks (title, description, project_id, owner_id, deadline, priority, complexity, is_quick, recurrence, alarm_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    title, description || null, projectId || null, req.userId, deadline || null,
    priority || 'Medium', complexity || 'Medium', isQuick ? 1 : 0, recurrence || null, alarm_at || null
  );
  const taskId = info.lastInsertRowid;
  saveAttachments(attachments, { taskId });
  res.json(get('SELECT * FROM tasks WHERE id = ?', taskId));
});

// ----- Templates -----
app.get('/api/templates', (req, res) => {
  res.json(all('SELECT * FROM templates ORDER BY name ASC'));
});

app.post('/api/templates', (req, res) => {
  const { name, department, priority, complexity, description, subtasks = [] } = req.body;
  const info = run(
    `INSERT INTO templates (name, department, priority, complexity, description, subtasks_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    name, department, priority || 'Medium', complexity || 'Medium',
    description || null, JSON.stringify(subtasks), req.userId
  );
  res.json(get('SELECT * FROM templates WHERE id = ?', info.lastInsertRowid));
});

app.post('/api/templates/:id/apply', (req, res) => {
  const { title, deadline, memberIds = [] } = req.body;
  const t = get('SELECT * FROM templates WHERE id = ?', req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  const subtaskTitles = JSON.parse(t.subtasks_json || '[]');

  const info = run(
    `INSERT INTO projects (title, department, description, owner_id, deadline, priority, complexity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    title || `${t.name} — ${new Date().toISOString().slice(0,10)}`,
    t.department, t.description || null, req.userId,
    deadline || null, t.priority, t.complexity
  );
  const projectId = info.lastInsertRowid;
  run('INSERT INTO project_members (project_id, user_id) VALUES (?, ?)', projectId, req.userId);
  memberIds.forEach(uid => {
    if (uid !== req.userId) run('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', projectId, uid);
  });
  subtaskTitles.forEach((st, i) => {
    run(
      `INSERT INTO subtasks (project_id, title, owner_id, assigned_by, assignment_status, sort_order)
       VALUES (?, ?, ?, ?, 'accepted', ?)`,
      projectId, st, req.userId, req.userId, i + 1
    );
  });
  res.json(get('SELECT * FROM projects WHERE id = ?', projectId));
});

function addPeriod(dateStr, recurrence) {
  if (!dateStr || !recurrence) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (recurrence === 'daily')   d.setUTCDate(d.getUTCDate() + 1);
  if (recurrence === 'weekly')  d.setUTCDate(d.getUTCDate() + 7);
  if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

app.patch('/api/tasks/:id', (req, res) => {
  const { status, deadline, title, alarm_at } = req.body;
  const fields = [], values = [];
  if (status) { fields.push('status = ?'); values.push(status); }
  if (deadline) { fields.push('deadline = ?'); values.push(deadline); }
  if (title) { fields.push('title = ?'); values.push(title); }
  if (alarm_at !== undefined) { fields.push('alarm_at = ?'); values.push(alarm_at); }
  if (fields.length) {
    values.push(req.params.id);
    run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, ...values);
  }
  const task = get('SELECT * FROM tasks WHERE id = ?', req.params.id);

  // Recurrence: when marked done, spawn the next occurrence
  if (status === 'done' && task?.recurrence && task.deadline) {
    const nextDeadline = addPeriod(task.deadline, task.recurrence);
    run(
      `INSERT INTO tasks (title, project_id, owner_id, deadline, priority, complexity, is_quick, recurrence, recurrence_parent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      task.title, task.project_id, task.owner_id, nextDeadline,
      task.priority, task.complexity, task.is_quick, task.recurrence,
      task.recurrence_parent || task.id
    );
  }

  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  run('DELETE FROM tasks WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// ----- Events -----
app.get('/api/events', (req, res) => {
  const { date } = req.query;
  let sql = 'SELECT * FROM events WHERE owner_id = ?';
  const params = [req.userId];
  if (date) {
    sql += " AND substr(start_time, 1, 10) = ?";
    params.push(date);
  }
  sql += ' ORDER BY start_time ASC';
  const events = all(sql, ...params);
  const attendeeStmt = db.prepare(
    `SELECT u.id, u.name, u.email, u.initials, u.department, u.avatar_color, u.avatar_url FROM users u JOIN event_attendees ea ON ea.user_id = u.id WHERE ea.event_id = ?`
  );
  events.forEach(e => { e.attendees = attendeeStmt.all(e.id); });
  res.json(events);
});

app.post('/api/events', (req, res) => {
  const { title, startTime, durationMin, eventType, department, priority, meetLink, attendeeIds = [] } = req.body;
  const info = run(
    `INSERT INTO events (title, owner_id, start_time, duration_min, event_type, department, priority, meet_link)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    title, req.userId, startTime, durationMin || 60, eventType || 'work',
    department || null, priority || null, meetLink || null
  );
  attendeeIds.forEach(uid =>
    run('INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)', info.lastInsertRowid, uid)
  );
  res.json(get('SELECT * FROM events WHERE id = ?', info.lastInsertRowid));
});

// ----- Streaks -----
app.get('/api/streaks', (req, res) => {
  const rows = all(
    `SELECT s.*, u.name AS user_name, u.initials, u.avatar_color, u.avatar_url
     FROM streaks s JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ?
     ORDER BY s.current_count DESC`,
    req.userId
  );
  res.json(rows);
});

app.post('/api/streaks', (req, res) => {
  const { name } = req.body;
  const info = run(
    'INSERT INTO streaks (user_id, name, current_count, best_count) VALUES (?, ?, 0, 0)',
    req.userId, name
  );
  res.json(get('SELECT * FROM streaks WHERE id = ?', info.lastInsertRowid));
});

app.post('/api/streaks/:id/log', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const streak = get('SELECT * FROM streaks WHERE id = ?', req.params.id);
  if (!streak) return res.status(404).json({ error: 'not found' });
  if (streak.last_logged === today) return res.json(streak);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newCount = streak.last_logged === yesterday ? streak.current_count + 1 : 1;
  const newBest = Math.max(newCount, streak.best_count);
  run('UPDATE streaks SET current_count = ?, best_count = ?, last_logged = ? WHERE id = ?',
    newCount, newBest, today, req.params.id);
  res.json(get('SELECT * FROM streaks WHERE id = ?', req.params.id));
});

// ----- Notifications -----
app.get('/api/notifications', (req, res) => {
  res.json(all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', req.userId));
});

app.patch('/api/notifications/:id/read', (req, res) => {
  run('UPDATE notifications SET read = 1 WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// ----- Bug Tracker -----
app.get('/api/bugs', (req, res) => {
  const { app } = req.query;
  let sql = `SELECT b.*, u.name AS assigned_name, u.initials AS assigned_initials, u.avatar_color AS assigned_color, u.avatar_url AS assigned_avatar,
             r.name AS reporter_name FROM bugs b
             LEFT JOIN users u ON u.id = b.assigned_to
             LEFT JOIN users r ON r.id = b.reported_by`;
  const params = [];
  if (app) { sql += ' WHERE b.app_name = ?'; params.push(app); }
  sql += ' ORDER BY b.created_at DESC';
  res.json(all(sql, ...params));
});

app.get('/api/bugs/apps', (req, res) => {
  res.json(all('SELECT DISTINCT app_name FROM bugs ORDER BY app_name ASC').map(r => r.app_name));
});

app.post('/api/bugs', (req, res) => {
  const { appName, issue, screenshotDataUrl, assignedTo, deadline } = req.body;
  let screenshotUrl = null;
  if (screenshotDataUrl) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(screenshotDataUrl);
    if (match) {
      const buf = Buffer.from(match[2], 'base64');
      const ext = match[1] === 'image/png' ? '.png' : '.jpg';
      const stored = `bug-${crypto.randomBytes(6).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, stored), buf);
      screenshotUrl = '/uploads/' + stored;
    }
  }
  const info = run(
    `INSERT INTO bugs (app_name, issue, screenshot_url, assigned_to, deadline, reported_by) VALUES (?, ?, ?, ?, ?, ?)`,
    appName, issue, screenshotUrl, assignedTo || null, deadline || null, req.userId
  );
  // Notify assignee
  if (assignedTo && assignedTo !== req.userId) {
    const reporter = get('SELECT name FROM users WHERE id = ?', req.userId);
    run(
      `INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'assignment', ?, ?)`,
      assignedTo, `Bug reported: ${issue.slice(0, 50)}`, `${reporter?.name} reported a bug in ${appName}`
    );
  }
  res.json(get(
    `SELECT b.*, u.name AS assigned_name, u.initials AS assigned_initials, u.avatar_color AS assigned_color, u.avatar_url AS assigned_avatar,
     r.name AS reporter_name FROM bugs b
     LEFT JOIN users u ON u.id = b.assigned_to
     LEFT JOIN users r ON r.id = b.reported_by WHERE b.id = ?`,
    info.lastInsertRowid
  ));
});

app.patch('/api/bugs/:id', (req, res) => {
  const { status, assignedTo, deadline } = req.body;
  const fields = [], values = [];
  if (status) { fields.push('status = ?'); values.push(status); }
  if (assignedTo !== undefined) { fields.push('assigned_to = ?'); values.push(assignedTo); }
  if (deadline !== undefined) { fields.push('deadline = ?'); values.push(deadline); }
  if (fields.length) { values.push(req.params.id); run(`UPDATE bugs SET ${fields.join(', ')} WHERE id = ?`, ...values); }
  res.json(get('SELECT * FROM bugs WHERE id = ?', req.params.id));
});

app.get('/api/bugs/export', (req, res) => {
  const { app } = req.query;
  let sql = `SELECT b.*, u.name AS assigned_name, r.name AS reporter_name FROM bugs b
             LEFT JOIN users u ON u.id = b.assigned_to LEFT JOIN users r ON r.id = b.reported_by`;
  const params = [];
  if (app) { sql += ' WHERE b.app_name = ?'; params.push(app); }
  sql += ' ORDER BY b.created_at DESC';
  const rows = all(sql, ...params);
  const header = ['#', 'App', 'Issue', 'Status', 'Assigned To', 'Reported By', 'Deadline', 'Screenshot', 'Created'];
  const csvRows = [header];
  rows.forEach((r, i) => {
    csvRows.push([
      i + 1, r.app_name, `"${(r.issue || '').replace(/"/g, '""')}"`, r.status,
      r.assigned_name || '', r.reporter_name || '', r.deadline || '',
      r.screenshot_url || '', r.created_at
    ]);
  });
  const csv = csvRows.map(r => r.join(',')).join('\n');
  const fname = `bugs-${app || 'all'}-${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.send(csv);
});

// ----- Team Chat -----
app.get('/api/chat', (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const rows = all(
    `SELECT m.*, u.name, u.initials, u.avatar_color, u.avatar_url
     FROM chat_messages m JOIN users u ON u.id = m.user_id
     ORDER BY m.created_at DESC LIMIT ?`,
    limit
  );
  res.json(rows.reverse());
});

app.post('/api/chat', (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'empty message' });
  const info = run(
    'INSERT INTO chat_messages (user_id, body) VALUES (?, ?)',
    req.userId, body.trim()
  );
  const msg = get(
    `SELECT m.*, u.name, u.initials, u.avatar_color, u.avatar_url
     FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`,
    info.lastInsertRowid
  );
  broadcast('chat-message', msg);
  const mentions = body.match(/@(\w+)/g) || [];
  if (mentions.length) {
    const sender = get('SELECT name FROM users WHERE id = ?', req.userId);
    const allUsers = all('SELECT id, name FROM users');
    mentions.forEach(mention => {
      const mentionName = mention.slice(1).toLowerCase();
      const target = allUsers.find(u => u.name.toLowerCase().startsWith(mentionName) && u.id !== req.userId);
      if (target) {
        run(
          `INSERT INTO notifications (user_id, type, title, body) VALUES (?, 'poke', ?, ?)`,
          target.id, `${sender.name} mentioned you in Team Chat`, body.trim().slice(0, 100)
        );
      }
    });
  }
  res.json(msg);
});

// ----- Alarms -----
app.get('/api/tasks/alarms-due', (req, res) => {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const rows = all(
    `SELECT id, title, alarm_at FROM tasks
     WHERE owner_id = ? AND alarm_at IS NOT NULL AND alarm_at <= ? AND status != 'done'
     ORDER BY alarm_at ASC LIMIT 5`,
    req.userId, now
  );
  res.json(rows);
});

// ----- Focus sessions -----
app.get('/api/focus/active', (req, res) => {
  const session = get(
    `SELECT * FROM focus_sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1`,
    req.userId
  );
  res.json(session || null);
});

app.post('/api/focus/start', (req, res) => {
  const { complexity = 'High Complex' } = req.body;
  // End any existing session first
  const existing = get('SELECT * FROM focus_sessions WHERE user_id = ? AND ended_at IS NULL', req.userId);
  if (existing) {
    const dur = Math.round((Date.now() - new Date(existing.started_at).getTime()) / 60000);
    run(`UPDATE focus_sessions SET ended_at = datetime('now'), duration_min = ? WHERE id = ?`, dur, existing.id);
  }
  const info = run(
    'INSERT INTO focus_sessions (user_id, complexity) VALUES (?, ?)',
    req.userId, complexity
  );
  res.json(get('SELECT * FROM focus_sessions WHERE id = ?', info.lastInsertRowid));
});

app.post('/api/focus/stop', (req, res) => {
  const session = get('SELECT * FROM focus_sessions WHERE user_id = ? AND ended_at IS NULL', req.userId);
  if (!session) return res.json(null);
  const dur = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);
  run(`UPDATE focus_sessions SET ended_at = datetime('now'), duration_min = ? WHERE id = ?`, dur, session.id);
  res.json(get('SELECT * FROM focus_sessions WHERE id = ?', session.id));
});

app.get('/api/focus/stats', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const highToday = get(
    `SELECT COALESCE(SUM(duration_min), 0) AS total FROM focus_sessions
     WHERE user_id = ? AND complexity = 'High Complex' AND substr(started_at, 1, 10) = ?`,
    req.userId, today
  ).total;
  const lowToday = get(
    `SELECT COALESCE(SUM(duration_min), 0) AS total FROM focus_sessions
     WHERE user_id = ? AND complexity = 'Low Complex' AND substr(started_at, 1, 10) = ?`,
    req.userId, today
  ).total;
  // Averages (last 7 days)
  const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const highWeek = get(
    `SELECT COALESCE(SUM(duration_min), 0) AS total FROM focus_sessions
     WHERE user_id = ? AND complexity = 'High Complex' AND started_at >= ?`,
    req.userId, week
  ).total;
  const lowWeek = get(
    `SELECT COALESCE(SUM(duration_min), 0) AS total FROM focus_sessions
     WHERE user_id = ? AND complexity = 'Low Complex' AND started_at >= ?`,
    req.userId, week
  ).total;
  res.json({
    today: { high: highToday, low: lowToday },
    weekTotal: { high: highWeek, low: lowWeek },
    weekAvg: { high: Math.round(highWeek / 7), low: Math.round(lowWeek / 7) },
    breakRecommended: highToday >= 90, // recommend break after 90min of complex work
  });
});

// ----- Leaves -----
app.get('/api/leaves/check', (req, res) => {
  const { userId, date } = req.query;
  if (!userId || !date) return res.json({ onLeave: false });
  const leave = get(
    `SELECT * FROM leaves WHERE user_id = ? AND start_date <= ? AND end_date >= ?`,
    userId, date, date
  );
  res.json(leave ? { onLeave: true, from: leave.start_date, to: leave.end_date, type: leave.type } : { onLeave: false });
});

app.post('/api/leaves', (req, res) => {
  const { userId, startDate, endDate, type = 'planned' } = req.body;
  const target = userId || req.userId;
  const info = run(
    `INSERT INTO leaves (user_id, start_date, end_date, type) VALUES (?, ?, ?, ?)`,
    target, startDate, endDate, type
  );
  broadcast('leave-added', { id: info.lastInsertRowid, userId: target });
  res.json(get(
    `SELECT l.*, u.name, u.initials, u.avatar_color, u.avatar_url
     FROM leaves l JOIN users u ON u.id = l.user_id WHERE l.id = ?`,
    info.lastInsertRowid
  ));
});

app.delete('/api/leaves/:id', (req, res) => {
  run('DELETE FROM leaves WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

app.get('/api/leaves', (req, res) => {
  res.json(all(
    `SELECT l.*, u.name, u.initials, u.avatar_color, u.avatar_url
     FROM leaves l JOIN users u ON u.id = l.user_id
     ORDER BY l.start_date ASC`
  ));
});

// ----- Real-time (Server-Sent Events) -----
const sseClients = new Set();

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('event: hello\ndata: {"ok":true}\n\n');

  const client = { res, userId: req.userId };
  sseClients.add(client);

  // Keepalive ping every 25s so proxies don't close the connection
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(client);
  });
});

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) {
    try { c.res.write(payload); c.res.flush?.(); } catch {}
  }
}

// ----- Search -----
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ projects: [], subtasks: [], comments: [], tasks: [] });
  const like = '%' + q.replace(/[%_]/g, m => '\\' + m) + '%';

  const projects = all(
    `SELECT id, title, department, priority FROM projects
     WHERE title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'
     ORDER BY id DESC LIMIT 8`,
    like, like
  );
  const subtasks = all(
    `SELECT s.id, s.title, s.project_id, s.status, p.title AS project_title
     FROM subtasks s JOIN projects p ON p.id = s.project_id
     WHERE s.title LIKE ? ESCAPE '\\'
     ORDER BY s.id DESC LIMIT 8`,
    like
  );
  const tasks = all(
    `SELECT id, title, status, deadline, is_quick FROM tasks
     WHERE title LIKE ? ESCAPE '\\'
     ORDER BY id DESC LIMIT 8`,
    like
  );
  const comments = all(
    `SELECT c.id, c.body, c.project_id, p.title AS project_title,
            u.name AS author
     FROM comments c JOIN projects p ON p.id = c.project_id
     JOIN users u ON u.id = c.author_id
     WHERE c.body LIKE ? ESCAPE '\\'
     ORDER BY c.id DESC LIMIT 8`,
    like
  );
  res.json({ projects, subtasks, tasks, comments });
});

// ----- Email digest (generates content; does NOT actually send) -----
app.get('/api/digest/preview', (req, res) => {
  const user = get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, req.userId);
  const today = new Date().toISOString().slice(0, 10);

  const overdue = all(
    `SELECT s.title, s.deadline, p.title AS project_title FROM subtasks s
     LEFT JOIN projects p ON p.id = s.project_id
     WHERE s.owner_id = ? AND s.status != 'done' AND s.deadline < ?
     ORDER BY s.deadline ASC LIMIT 10`,
    req.userId, today
  );
  const dueToday = all(
    `SELECT s.title, s.deadline, p.title AS project_title FROM subtasks s
     LEFT JOIN projects p ON p.id = s.project_id
     WHERE s.owner_id = ? AND s.status != 'done' AND s.deadline = ?
     LIMIT 10`,
    req.userId, today
  );
  const completedYesterday = all(
    `SELECT s.title, p.title AS project_title FROM subtasks s
     LEFT JOIN projects p ON p.id = s.project_id
     WHERE s.owner_id = ? AND s.status = 'done'
     ORDER BY s.id DESC LIMIT 5`,
    req.userId
  );
  const streaks = all('SELECT name, current_count FROM streaks WHERE user_id = ?', req.userId);

  const subject = `[Nexo] Your daily digest — ${today}`;
  const lines = [];
  lines.push(`Hi ${user.name.split(' ')[0]},`);
  lines.push('');
  lines.push(`Here's what's on your plate today.`);
  lines.push('');
  if (overdue.length) {
    lines.push(`⚠️  OVERDUE (${overdue.length})`);
    overdue.forEach(o => lines.push(`  • ${o.title} — ${o.project_title || '—'} (was due ${o.deadline})`));
    lines.push('');
  }
  if (dueToday.length) {
    lines.push(`📌  DUE TODAY (${dueToday.length})`);
    dueToday.forEach(o => lines.push(`  • ${o.title} — ${o.project_title || '—'}`));
    lines.push('');
  }
  if (completedYesterday.length) {
    lines.push(`✅  RECENTLY COMPLETED`);
    completedYesterday.forEach(o => lines.push(`  • ${o.title}`));
    lines.push('');
  }
  if (streaks.length) {
    lines.push(`🔥  ACTIVE STREAKS`);
    streaks.forEach(s => lines.push(`  • ${s.name}: ${s.current_count} days`));
    lines.push('');
  }
  lines.push('— Nexo');

  res.json({
    to: user.email,
    subject,
    body: lines.join('\n'),
    generated_at: new Date().toISOString(),
    note: 'This is a preview. No email is actually sent. Configure SMTP and wire a mail library (e.g. nodemailer) to enable delivery.',
  });
});

// ----- Dev: reset seed -----
app.post('/api/dev/reset-seed', async (req, res) => {
  try {
    const { runSeed } = await import('./seed.js');
    runSeed();
    res.json({ ok: true, message: 'Database reseeded' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ----- AI Insights (heuristic) -----
app.get('/api/insights', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const insights = [];

  // 1. Top performing department by completion rate
  const deptRows = all(
    `SELECT p.department,
       SUM(CASE WHEN s.status='done' THEN 1 ELSE 0 END) AS done,
       COUNT(s.id) AS total
     FROM projects p LEFT JOIN subtasks s ON s.project_id = p.id
     GROUP BY p.department HAVING total > 0`
  );
  if (deptRows.length) {
    const top = deptRows.map(d => ({ ...d, rate: d.done / d.total })).sort((a, b) => b.rate - a.rate)[0];
    insights.push({
      icon: '🏆',
      title: `${top.department} is leading`,
      text: `${Math.round(top.rate * 100)}% of subtasks completed — ${top.done} of ${top.total}.`,
    });
  }

  // 2. User's own overdue streak
  const myOverdue = get(
    `SELECT COUNT(*) AS c FROM subtasks
     WHERE owner_id = ? AND status != 'done' AND deadline < ?`,
    req.userId, today
  ).c;
  if (myOverdue > 0) {
    insights.push({
      icon: '⚠️',
      title: `${myOverdue} overdue subtask${myOverdue === 1 ? '' : 's'} need attention`,
      text: 'Consider rescheduling or delegating before they block downstream work.',
    });
  } else {
    insights.push({
      icon: '🎯',
      title: 'No overdue work',
      text: 'You are on track with everything assigned to you.',
    });
  }

  // 3. Most-completed project owner (proxy for productivity)
  const topOwner = get(
    `SELECT u.name, COUNT(*) AS c FROM subtasks s
     JOIN users u ON u.id = s.owner_id
     WHERE s.status = 'done'
     GROUP BY s.owner_id
     ORDER BY c DESC LIMIT 1`
  );
  if (topOwner) {
    insights.push({
      icon: '⚡',
      title: `${topOwner.name.split(' ')[0]} is this week's driver`,
      text: `${topOwner.c} subtasks completed recently.`,
    });
  }

  // 4. Active streaks observation
  const topStreak = get(
    `SELECT u.name, s.name AS streak, s.current_count FROM streaks s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.current_count DESC LIMIT 1`
  );
  if (topStreak && topStreak.current_count >= 5) {
    insights.push({
      icon: '🔥',
      title: `${topStreak.name.split(' ')[0]}'s ${topStreak.streak} streak is inspiring`,
      text: `${topStreak.current_count} days in a row.`,
    });
  }

  // 5. Recurring task heuristic
  const recurringCount = get("SELECT COUNT(*) AS c FROM tasks WHERE recurrence IS NOT NULL").c;
  if (recurringCount > 0) {
    insights.push({
      icon: '🔁',
      title: `${recurringCount} recurring task${recurringCount === 1 ? '' : 's'} automating your routine`,
      text: 'These auto-spawn each cycle so nothing slips through.',
    });
  }

  res.json(insights);
});

// ----- Activity feed -----
app.get('/api/activity', (req, res) => {
  const limit = Number(req.query.limit) || 15;
  const items = [];

  // Completed subtasks
  all(
    `SELECT s.id, s.title, s.project_id, p.title AS project_title,
            u.name AS actor, u.initials, u.avatar_color, u.avatar_url
     FROM subtasks s
     JOIN projects p ON p.id = s.project_id
     LEFT JOIN users u ON u.id = s.owner_id
     WHERE s.status = 'done'
     ORDER BY s.id DESC LIMIT ?`,
    limit
  ).forEach(r => items.push({
    id: `sub-${r.id}`, kind: 'completed_subtask',
    actor: r.actor, initials: r.initials, color: r.avatar_color, avatar_url: r.avatar_url,
    text: `completed "${r.title}"`, context: r.project_title,
    ts: new Date(Date.now() - r.id * 3600000).toISOString(),
  }));

  // New projects (use created_at)
  all(
    `SELECT p.id, p.title, p.department, p.created_at,
            u.name AS actor, u.initials, u.avatar_color, u.avatar_url
     FROM projects p
     JOIN users u ON u.id = p.owner_id
     ORDER BY p.created_at DESC LIMIT ?`,
    limit
  ).forEach(r => items.push({
    id: `proj-${r.id}`, kind: 'new_project',
    actor: r.actor, initials: r.initials, color: r.avatar_color, avatar_url: r.avatar_url,
    text: `created project "${r.title}"`, context: r.department,
    ts: r.created_at,
  }));

  // New comments
  all(
    `SELECT c.id, c.body, c.created_at, c.project_id, p.title AS project_title,
            u.name AS actor, u.initials, u.avatar_color, u.avatar_url
     FROM comments c
     JOIN projects p ON p.id = c.project_id
     JOIN users u ON u.id = c.author_id
     ORDER BY c.created_at DESC LIMIT ?`,
    limit
  ).forEach(r => items.push({
    id: `cmt-${r.id}`, kind: 'comment',
    actor: r.actor, initials: r.initials, color: r.avatar_color, avatar_url: r.avatar_url,
    text: `commented on "${r.project_title}"`,
    context: r.body.length > 60 ? r.body.slice(0, 57) + '…' : r.body,
    ts: r.created_at,
  }));

  // Streak milestones (current_count divisible by 7 and > 0)
  all(
    `SELECT s.id, s.name, s.current_count, s.last_logged,
            u.name AS actor, u.initials, u.avatar_color, u.avatar_url
     FROM streaks s JOIN users u ON u.id = s.user_id
     WHERE s.current_count > 0 ORDER BY s.current_count DESC LIMIT 5`
  ).forEach(r => items.push({
    id: `streak-${r.id}`, kind: 'streak',
    actor: r.actor, initials: r.initials, color: r.avatar_color, avatar_url: r.avatar_url,
    text: `is on a ${r.current_count}-day ${r.name} streak 🔥`,
    context: null,
    ts: r.last_logged || new Date().toISOString(),
  }));

  // Upcoming leaves (next 7 days)
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  all(
    `SELECT l.id, l.start_date, l.end_date, l.type,
            u.name AS actor, u.initials, u.avatar_color, u.avatar_url
     FROM leaves l JOIN users u ON u.id = l.user_id
     WHERE l.start_date >= ? AND l.start_date <= ?`,
    today, in7
  ).forEach(r => items.push({
    id: `leave-${r.id}`, kind: 'leave',
    actor: r.actor, initials: r.initials, color: r.avatar_color, avatar_url: r.avatar_url,
    text: `will be on leave ${r.start_date} → ${r.end_date} 🏖️`,
    context: r.type,
    ts: new Date().toISOString(),
  }));

  // Sort all by ts desc and cap
  items.sort((a, b) => (b.ts > a.ts ? 1 : -1));
  res.json(items.slice(0, limit));
});

// ----- Reports -----
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

app.get('/api/reports/export', (req, res) => {
  const { scope = 'me' } = req.query;
  const scopedUser = scope === 'me' ? req.userId : null;

  const tasks = all(
    `SELECT t.id, t.title, t.status, t.deadline, t.priority, t.is_quick,
            u.name AS owner_name, p.title AS project_title, p.department
     FROM tasks t LEFT JOIN users u ON u.id = t.owner_id
     LEFT JOIN projects p ON p.id = t.project_id
     ${scopedUser ? 'WHERE t.owner_id = ?' : ''}
     ORDER BY t.deadline DESC`,
    ...(scopedUser ? [scopedUser] : [])
  );
  const subs = all(
    `SELECT s.id, s.title, s.status, s.deadline, s.assignment_status,
            u.name AS owner_name, p.title AS project_title, p.department, p.priority
     FROM subtasks s LEFT JOIN users u ON u.id = s.owner_id
     LEFT JOIN projects p ON p.id = s.project_id
     ${scopedUser ? 'WHERE s.owner_id = ?' : ''}
     ORDER BY s.deadline DESC`,
    ...(scopedUser ? [scopedUser] : [])
  );

  const today = new Date().toISOString().slice(0, 10);
  const header = ['Type', 'Title', 'Project', 'Department', 'Owner', 'Deadline', 'Status', 'Priority', 'Overdue'];
  const rows = [header];
  tasks.forEach(t => rows.push([
    t.is_quick ? 'Quick Task' : 'Task',
    t.title,
    t.project_title || '',
    t.department || '',
    t.owner_name || '',
    t.deadline || '',
    t.status,
    t.priority || '',
    t.status !== 'done' && t.deadline && t.deadline < today ? 'Yes' : 'No',
  ]));
  subs.forEach(s => rows.push([
    'Subtask',
    s.title,
    s.project_title || '',
    s.department || '',
    s.owner_name || '',
    s.deadline || '',
    s.status,
    s.priority || '',
    s.status !== 'done' && s.deadline && s.deadline < today ? 'Yes' : 'No',
  ]));

  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const fname = `nexo-report-${scope}-${today}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  res.send(csv);
});

app.get('/api/reports/export.pdf', async (req, res) => {
  const PDFDocument = (await import('pdfkit')).default;
  const { scope = 'me' } = req.query;
  const scopedUser = scope === 'me' ? req.userId : null;
  const today = new Date().toISOString().slice(0, 10);
  const user = get(`SELECT ${USER_COLS} FROM users WHERE id = ?`, req.userId);

  const tasks = all(
    `SELECT t.title, t.status, t.deadline, t.priority, u.name AS owner_name, p.title AS project_title
     FROM tasks t LEFT JOIN users u ON u.id = t.owner_id LEFT JOIN projects p ON p.id = t.project_id
     ${scopedUser ? 'WHERE t.owner_id = ?' : ''} ORDER BY t.deadline DESC`,
    ...(scopedUser ? [scopedUser] : [])
  );
  const subs = all(
    `SELECT s.title, s.status, s.deadline, u.name AS owner_name, p.title AS project_title
     FROM subtasks s LEFT JOIN users u ON u.id = s.owner_id LEFT JOIN projects p ON p.id = s.project_id
     ${scopedUser ? 'WHERE s.owner_id = ?' : ''} ORDER BY s.deadline DESC`,
    ...(scopedUser ? [scopedUser] : [])
  );

  const done    = [...tasks, ...subs].filter(r => r.status === 'done').length;
  const overdue = [...tasks, ...subs].filter(r => r.status !== 'done' && r.deadline && r.deadline < today).length;

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="nexo-report-${scope}-${today}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fillColor('#4A6CF7').fontSize(24).text('Nexo Productivity Report', { align: 'left' });
  doc.moveDown(0.2);
  doc.fillColor('#6B7280').fontSize(11).text(`${scope === 'me' ? user.name : 'Company-wide'} · Generated ${today}`);
  doc.moveDown(1);

  // Summary
  doc.fillColor('#1A1A2E').fontSize(14).text('Summary', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor('#1A1A2E')
    .text(`Tasks completed: ${done}`)
    .text(`Overdue items: ${overdue}`)
    .text(`Total tracked: ${tasks.length + subs.length}`)
    .text(`Completion rate: ${Math.round((done / Math.max(1, tasks.length + subs.length)) * 100)}%`);
  doc.moveDown(1);

  // Tasks table
  doc.fillColor('#1A1A2E').fontSize(14).text('Tasks & Subtasks', { underline: true });
  doc.moveDown(0.3);

  const COL = { title: 220, project: 140, owner: 90, deadline: 70 };
  doc.fontSize(9).fillColor('#6B7280');
  let y = doc.y;
  doc.text('Title', 50, y, { width: COL.title });
  doc.text('Project', 50 + COL.title, y, { width: COL.project });
  doc.text('Owner', 50 + COL.title + COL.project, y, { width: COL.owner });
  doc.text('Deadline', 50 + COL.title + COL.project + COL.owner, y, { width: COL.deadline });
  doc.moveTo(50, y + 14).lineTo(545, y + 14).strokeColor('#E5E7EB').stroke();
  doc.moveDown(1);

  const rows = [...tasks, ...subs];
  rows.forEach(r => {
    const rowY = doc.y;
    const overdueRow = r.status !== 'done' && r.deadline && r.deadline < today;
    doc.fillColor(r.status === 'done' ? '#9CA3AF' : (overdueRow ? '#EF4444' : '#1A1A2E')).fontSize(9);
    doc.text((r.status === 'done' ? '✓ ' : '○ ') + r.title, 50, rowY, { width: COL.title });
    doc.fillColor('#6B7280').text(r.project_title || '—', 50 + COL.title, rowY, { width: COL.project });
    doc.text(r.owner_name || '—', 50 + COL.title + COL.project, rowY, { width: COL.owner });
    doc.text(r.deadline || '—', 50 + COL.title + COL.project + COL.owner, rowY, { width: COL.deadline });
    doc.moveDown(0.4);
    if (doc.y > 770) { doc.addPage(); }
  });

  doc.end();
});

app.get('/api/projects/:id/export.pdf', async (req, res) => {
  const PDFDocument = (await import('pdfkit')).default;
  const p = get('SELECT * FROM projects WHERE id = ?', req.params.id);
  if (!p) return res.status(404).send('Project not found');
  const owner = get(`SELECT name FROM users WHERE id = ?`, p.owner_id);
  const members = all(
    `SELECT u.name FROM users u JOIN project_members pm ON pm.user_id = u.id WHERE pm.project_id = ?`,
    p.id
  );
  const subs = all(
    `SELECT s.title, s.status, s.deadline, u.name AS owner_name
     FROM subtasks s LEFT JOIN users u ON u.id = s.owner_id
     WHERE s.project_id = ? ORDER BY s.sort_order`,
    p.id
  );
  const comments = all(
    `SELECT c.body, c.created_at, u.name AS author
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.project_id = ? ORDER BY c.created_at ASC`,
    p.id
  );

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="project-${p.id}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fillColor('#4A6CF7').fontSize(22).text(p.title);
  doc.moveDown(0.2);
  doc.fillColor('#6B7280').fontSize(10).text(
    `${p.department} · ${p.priority} · Owner: ${owner?.name || '—'} · Deadline: ${p.deadline || '—'}`
  );
  doc.moveDown(0.2);
  doc.text(`Progress: ${p.progress}% · Members: ${members.map(m => m.name).join(', ') || '—'}`);
  doc.moveDown(1);

  if (p.description) {
    doc.fillColor('#1A1A2E').fontSize(11).text(p.description, { align: 'left' });
    doc.moveDown(1);
  }

  // Subtasks
  doc.fillColor('#1A1A2E').fontSize(14).text('Checklist', { underline: true });
  doc.moveDown(0.3);
  const today = new Date().toISOString().slice(0, 10);
  subs.forEach(s => {
    const mark = s.status === 'done' ? '✓' : '○';
    const overdue = s.status !== 'done' && s.deadline && s.deadline < today;
    doc.fillColor(s.status === 'done' ? '#9CA3AF' : (overdue ? '#EF4444' : '#1A1A2E')).fontSize(10);
    doc.text(`${mark}  ${s.title}`, { continued: true });
    doc.fillColor('#9CA3AF').text(`   ${s.owner_name || '—'}  ${s.deadline || ''}`);
  });
  doc.moveDown(1);

  // Comments
  if (comments.length) {
    doc.fillColor('#1A1A2E').fontSize(14).text(`Comments (${comments.length})`, { underline: true });
    doc.moveDown(0.3);
    comments.forEach(c => {
      doc.fillColor('#1A1A2E').fontSize(10).text(`${c.author}`, { continued: true });
      doc.fillColor('#9CA3AF').text(`   ${c.created_at}`);
      doc.fillColor('#6B7280').fontSize(10).text(c.body, { indent: 10 });
      doc.moveDown(0.4);
      if (doc.y > 770) doc.addPage();
    });
  }

  doc.end();
});

app.get('/api/reports/summary', (req, res) => {
  const { scope = 'me', period = 'weekly' } = req.query;
  const scopedUser = scope === 'me' ? req.userId : null;

  // Build a "task_union" view of tasks + subtasks so reports reflect both
  const userFilterTask = scopedUser ? ' AND t.owner_id = ?' : '';
  const userFilterSub  = scopedUser ? ' AND s.owner_id = ?' : '';
  const args = scopedUser ? [scopedUser] : [];

  const done = get(
    `SELECT
       (SELECT COUNT(*) FROM tasks t WHERE t.status='done'${userFilterTask}) +
       (SELECT COUNT(*) FROM subtasks s WHERE s.status='done'${userFilterSub}) AS c`,
    ...args, ...args
  ).c;

  const today = new Date().toISOString().slice(0, 10);
  const overdue = get(
    `SELECT
       (SELECT COUNT(*) FROM tasks t WHERE t.status != 'done' AND t.deadline < ?${userFilterTask}) +
       (SELECT COUNT(*) FROM subtasks s WHERE s.status != 'done' AND s.deadline < ?${userFilterSub}) AS c`,
    today, ...args, today, ...args
  ).c;

  const total = get(
    `SELECT
       (SELECT COUNT(*) FROM tasks t WHERE 1=1${userFilterTask}) +
       (SELECT COUNT(*) FROM subtasks s WHERE 1=1${userFilterSub}) AS c`,
    ...args, ...args
  ).c || 1;

  // On-time rate = done / (done + overdue). Pending-but-not-yet-overdue work doesn't count against it.
  const denom = Math.max(1, done + overdue);
  const onTimeRate = Math.round((done / denom) * 100);
  const score = Math.max(0, Math.min(100, Math.round((done - overdue * 2) / Math.max(1, total) * 100)));

  // Chart: last 6 days, count of tasks+subtasks marked done (use deadline as proxy — we don't track completed_at yet)
  const periodDays = period === 'daily' ? 1 : period === 'monthly' ? 30 : period === 'quarterly' ? 90 : 7;
  const bucketCount = period === 'quarterly' ? 12 : period === 'monthly' ? 6 : 6;
  const bucketDays = Math.max(1, Math.round(periodDays / bucketCount));
  const chart = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const start = new Date();
    start.setDate(start.getDate() - (i + 1) * bucketDays);
    const end = new Date();
    end.setDate(end.getDate() - i * bucketDays);
    const s = start.toISOString().slice(0, 10);
    const e = end.toISOString().slice(0, 10);
    const count = get(
      `SELECT
         (SELECT COUNT(*) FROM tasks t WHERE t.status='done' AND t.deadline >= ? AND t.deadline < ?${userFilterTask}) +
         (SELECT COUNT(*) FROM subtasks s WHERE s.status='done' AND s.deadline >= ? AND s.deadline < ?${userFilterSub}) AS c`,
      s, e, ...args, s, e, ...args
    ).c;
    const label = period === 'weekly'
      ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][start.getDay()]
      : start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    chart.push({ day: label, value: count });
  }

  // Departments: group projects by department; count done/overdue from their tasks+subtasks
  const deptColors = { 'Operations': '#22C55E', "CEO's Office": '#4A6CF7', 'Common': '#9CA3AF' };
  const deptRows = all(
    `SELECT p.department,
       SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) +
       SUM(CASE WHEN s.status='done' THEN 1 ELSE 0 END) AS done_count,
       SUM(CASE WHEN t.status!='done' AND t.deadline < ? THEN 1 ELSE 0 END) +
       SUM(CASE WHEN s.status!='done' AND s.deadline < ? THEN 1 ELSE 0 END) AS overdue_count,
       COUNT(t.id) + COUNT(s.id) AS total_count
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     LEFT JOIN subtasks s ON s.project_id = p.id
     GROUP BY p.department`,
    today, today
  );
  const departments = deptRows.map(r => {
    const d = r.done_count || 0, o = r.overdue_count || 0, t = r.total_count || 1;
    return {
      name: r.department,
      color: deptColors[r.department] || '#9CA3AF',
      done: d,
      overdue: o,
      efficiency: Math.max(0, Math.round(((t - o) / t) * 100)),
    };
  });

  res.json({ score, done, overdue, onTimeRate, chart, departments });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Nexo backend running on http://localhost:${PORT}`));
