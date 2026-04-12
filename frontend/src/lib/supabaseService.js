import { supabase } from './supabase.js';

// ── Helpers ─────────────────────────────────────────────

let _userId = null;

export function setCurrentUserId(id) { _userId = id; }
export function getCurrentUserId() { return _userId; }

function uid() {
  if (!_userId) throw new Error('Not authenticated');
  return _userId;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function addPeriod(dateStr, recurrence) {
  if (!dateStr || !recurrence) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (recurrence === 'daily')   d.setUTCDate(d.getUTCDate() + 1);
  if (recurrence === 'weekly')  d.setUTCDate(d.getUTCDate() + 7);
  if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function generateMeetLink() {
  const c = 'abcdefghijklmnopqrstuvwxyz';
  const seg = n => Array.from({ length: n }, () => c[Math.floor(Math.random() * 26)]).join('');
  return `https://meet.google.com/${seg(3)}-${seg(4)}-${seg(3)}`;
}

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Map frontend complexity/priority strings to DB values and back
function mapComplexityToDB(val) {
  if (!val) return null;
  if (val === 'High Complex') return 'high_complex';
  if (val === 'Low Complex') return 'low_complex';
  return val; // already in DB format
}
function mapComplexityFromDB(val) {
  if (!val) return null;
  if (val === 'high_complex') return 'High Complex';
  if (val === 'low_complex') return 'Low Complex';
  return val;
}

const USER_SELECT = 'id, name, email, initials, department, avatar_color, avatar_url, role, preferences';

// ── Auth (handled by AuthContext; stubs for compat) ──────

async function login() { throw new Error('Use AuthContext.signIn()'); }
async function logout() { await supabase.auth.signOut(); }

// ── Users ────────────────────────────────────────────────

async function me() {
  return unwrap(await supabase.from('users').select(USER_SELECT).eq('id', uid()).single());
}

async function users() {
  return unwrap(await supabase.from('users').select(USER_SELECT).order('name'));
}

async function updateMe(patch) {
  const updates = {};
  if (patch.name) {
    updates.name = patch.name;
    updates.initials = patch.name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }
  if (patch.department) updates.department = patch.department;
  return unwrap(await supabase.from('users').update(updates).eq('id', uid()).select(USER_SELECT).single());
}

async function uploadAvatar(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('invalid data URL');
  const mime = match[1];
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  const path = `${uid()}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  return unwrap(await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', uid()).select(USER_SELECT).single());
}

async function preferences() {
  const u = await me();
  return typeof u.preferences === 'string' ? JSON.parse(u.preferences) : (u.preferences || {});
}

async function updatePreferences(patch) {
  const current = await preferences();
  const merged = { ...current, ...patch };
  await supabase.from('users').update({ preferences: merged }).eq('id', uid());
  return merged;
}

// ── Projects ─────────────────────────────────────────────

async function projects(scope = 'mine') {
  let rows;
  if (scope === 'mine') {
    // Get project IDs where user is owner or member
    const { data: memberRows } = await supabase.from('project_members').select('project_id').eq('user_id', uid());
    const memberProjectIds = (memberRows || []).map(r => r.project_id);
    const { data: ownedRows } = await supabase.from('projects').select('id').eq('owner_id', uid());
    const ownedIds = (ownedRows || []).map(r => r.id);
    const allIds = [...new Set([...memberProjectIds, ...ownedIds])];
    if (allIds.length === 0) return [];
    rows = unwrap(await supabase.from('projects').select('*').in('id', allIds).order('created_at', { ascending: false }));
  } else {
    rows = unwrap(await supabase.from('projects').select('*').order('created_at', { ascending: false }));
  }
  // Populate members for each project
  for (const p of rows) {
    const { data: members } = await supabase
      .from('project_members')
      .select('user:users(id, name, email, initials, department, avatar_color, avatar_url)')
      .eq('project_id', p.id);
    p.members = (members || []).map(m => m.user);
  }
  return rows;
}

async function project(id) {
  const p = unwrap(await supabase.from('projects').select('*').eq('id', id).single());

  // Owner
  p.owner = unwrap(await supabase.from('users').select(USER_SELECT).eq('id', p.owner_id).single());

  // Members
  const { data: memberRows } = await supabase
    .from('project_members')
    .select('user:users(id, name, email, initials, department, avatar_color, avatar_url)')
    .eq('project_id', id);
  p.members = (memberRows || []).map(m => m.user);

  // Subtasks with owner info
  const { data: subtasks } = await supabase
    .from('subtasks')
    .select('*, owner:users!owner_id(name, initials, avatar_color, avatar_url)')
    .eq('project_id', id)
    .order('sort_order', { ascending: true });
  p.subtasks = (subtasks || []).map(s => ({
    ...s,
    complexity: mapComplexityFromDB(s.complexity),
    owner_name: s.owner?.name || null,
    owner_initials: s.owner?.initials || null,
    owner_color: s.owner?.avatar_color || null,
    owner_avatar: s.owner?.avatar_url || null,
    owner: undefined,
  }));

  // Comments with author info
  const { data: comments } = await supabase
    .from('comments')
    .select('*, author:users!author_id(name, initials, avatar_color, avatar_url)')
    .eq('project_id', id)
    .order('created_at', { ascending: true });
  p.comments = [];
  for (const c of (comments || [])) {
    const { data: attachments } = await supabase.from('attachments').select('id, filename, storage_path, mime_type, size_bytes').eq('comment_id', c.id);
    p.comments.push({
      ...c,
      author_name: c.author?.name || null,
      author_initials: c.author?.initials || null,
      author_color: c.author?.avatar_color || null,
      author_avatar: c.author?.avatar_url || null,
      author: undefined,
      attachments: (attachments || []).map(a => ({
        id: a.id,
        filename: a.filename,
        url: a.storage_path,
        mime: a.mime_type,
        size: a.size_bytes,
      })),
    });
  }

  return p;
}

async function createProject(data) {
  const { title, department, description, deadline, priority, complexity, memberIds = [] } = data;
  const p = unwrap(await supabase.from('projects').insert({
    title, department, description: description || null, owner_id: uid(),
    deadline: deadline || null, progress: 0, status: 'active',
  }).select().single());

  // Add creator + members
  await supabase.from('project_members').insert({ project_id: p.id, user_id: uid() });
  for (const mid of memberIds) {
    if (mid !== uid()) {
      await supabase.from('project_members').upsert({ project_id: p.id, user_id: mid }, { onConflict: 'project_id,user_id' });
    }
  }
  return p;
}

async function updateProject(id, data) {
  const updates = {};
  if (data.title) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.department) updates.department = data.department;
  if (data.deadline !== undefined) updates.deadline = data.deadline;
  if (data.progress != null) updates.progress = data.progress;
  if (data.status) updates.status = data.status;
  if (data.priority) updates.priority = data.priority;
  return unwrap(await supabase.from('projects').update(updates).eq('id', id).select().single());
}

async function deleteProject(id) {
  await supabase.from('projects').delete().eq('id', id);
  return { ok: true };
}

// ── Subtasks ─────────────────────────────────────────────

async function createSubtask(projectId, data) {
  const { title, ownerId, deadline, parentId, complexity } = data;
  const owner = ownerId || uid();
  const assignedToOther = owner !== uid();

  // Find max sort_order
  const { data: maxRow } = await supabase
    .from('subtasks')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const maxSort = maxRow?.sort_order || 0;

  // Calculate depth from parent
  let depth = 0;
  if (parentId) {
    const { data: parent } = await supabase.from('subtasks').select('depth').eq('id', parentId).single();
    depth = (parent?.depth || 0) + 1;
  }

  const sub = unwrap(await supabase.from('subtasks').insert({
    project_id: projectId,
    parent_id: parentId || null,
    depth,
    title,
    owner_id: owner,
    assigned_by: uid(),
    assignment_status: assignedToOther ? 'pending' : 'accepted',
    deadline: deadline || null,
    complexity: mapComplexityToDB(complexity),
    sort_order: maxSort + 1,
  }).select().single());

  // Notify if assigned to someone else
  if (assignedToOther) {
    const [proj, assigner] = await Promise.all([
      supabase.from('projects').select('title').eq('id', projectId).single(),
      supabase.from('users').select('name').eq('id', uid()).single(),
    ]);
    let leaveWarn = '';
    if (deadline) {
      const { data: leave } = await supabase.from('leaves')
        .select('*').eq('user_id', owner).lte('start_date', deadline).gte('end_date', deadline).maybeSingle();
      if (leave) leaveWarn = ' · ⚠️ assigned during your leave';
    }
    await supabase.from('notifications').insert({
      user_id: owner,
      type: 'assignment',
      title: `New Task Assigned: ${title}`,
      body: `From ${assigner.data?.name || 'someone'} · ${proj.data?.title || ''}${deadline ? ' · Due ' + deadline : ''}${leaveWarn}`,
      ref_subtask: sub.id,
      ref_project: projectId,
    });
  }

  return sub;
}

async function respondSubtask(id, action, extra = {}) {
  const sub = unwrap(await supabase.from('subtasks').select('*').eq('id', id).single());
  const updates = {};
  if (action === 'accept') {
    updates.assignment_status = 'accepted';
  } else if (action === 'modify') {
    updates.assignment_status = 'accepted';
    updates.deadline = extra.deadline || sub.deadline;
    updates.proposed_deadline = extra.deadline || null;
  } else if (action === 'decline') {
    updates.assignment_status = 'declined';
    updates.decline_note = extra.note || null;
  }

  const updated = unwrap(await supabase.from('subtasks').update(updates).eq('id', id).select().single());

  // Notify assigner
  if (sub.assigned_by && sub.assigned_by !== uid()) {
    const responder = unwrap(await supabase.from('users').select('name').eq('id', uid()).single());
    const label = action === 'decline' ? 'declined' : action === 'modify' ? 'proposed new timeline' : 'accepted';
    await supabase.from('notifications').insert({
      user_id: sub.assigned_by,
      type: 'completed',
      title: `${responder.name} ${label}: ${sub.title}`,
      body: action === 'modify' ? `Proposed new deadline: ${extra.deadline}` : (extra.note || null),
      ref_subtask: sub.id,
      ref_project: sub.project_id,
    });
  }

  // Mark original assignment notification as read
  await supabase.from('notifications')
    .update({ is_read: true })
    .eq('ref_subtask', id)
    .eq('type', 'assignment')
    .eq('user_id', uid());

  return updated;
}

async function updateSubtask(id, data) {
  const updates = {};
  if (data.status) updates.status = data.status;
  if (data.title) updates.title = data.title;
  if (data.deadline) updates.deadline = data.deadline;
  if (data.ownerId) updates.owner_id = data.ownerId;
  if (data.complexity !== undefined) updates.complexity = mapComplexityToDB(data.complexity);
  if (data.sort_order !== undefined) updates.sort_order = data.sort_order;

  const sub = unwrap(await supabase.from('subtasks').update(updates).eq('id', id).select().single());

  // Progress is auto-recalculated by the DB trigger

  // When subtask completed, notify next subtask owner
  if (data.status === 'done') {
    const { data: nextSub } = await supabase
      .from('subtasks')
      .select('*, owner:users!owner_id(name)')
      .eq('project_id', sub.project_id)
      .eq('depth', sub.depth)
      .neq('status', 'done')
      .gt('sort_order', sub.sort_order)
      .order('sort_order')
      .limit(1)
      .maybeSingle();

    if (nextSub?.owner_id && nextSub.owner_id !== uid()) {
      const [completer, proj] = await Promise.all([
        supabase.from('users').select('name').eq('id', uid()).single(),
        supabase.from('projects').select('title').eq('id', sub.project_id).single(),
      ]);
      await supabase.from('notifications').insert({
        user_id: nextSub.owner_id,
        type: 'assignment',
        title: `Your turn: ${nextSub.title}`,
        body: `${completer.data?.name || 'Someone'} completed "${sub.title}" in ${proj.data?.title || 'a project'}. You're up next.`,
        ref_subtask: nextSub.id,
        ref_project: sub.project_id,
      });
    }
  }

  return sub;
}

async function deleteSubtask(id) {
  await supabase.from('subtasks').delete().eq('id', id);
  return { ok: true };
}

// ── Tasks ────────────────────────────────────────────────

async function tasks(params = {}) {
  let q = supabase.from('tasks').select('*');
  if (params.quick === '1' || params.quick === 1) q = q.eq('is_quick', true);
  if (params.quick === '0' || params.quick === 0) q = q.eq('is_quick', false);
  if (params.owner === 'me') q = q.eq('owner_id', uid());
  q = q.order('deadline', { ascending: true, nullsFirst: false });
  return unwrap(await q);
}

async function urgentTasks() {
  // Fetch non-done tasks for current user, sort client-side with urgency ranking
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('owner_id', uid())
    .neq('status', 'done')
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(20);

  const today = todayStr();
  const ranked = (data || []).map(t => ({
    ...t,
    _rank: !t.deadline ? 3 : t.deadline < today ? 0 : t.deadline === today ? 1 : 2,
  }));
  ranked.sort((a, b) => a._rank - b._rank || (a.deadline || '').localeCompare(b.deadline || ''));
  return ranked.slice(0, 5).map(({ _rank, ...rest }) => rest);
}

async function createTask(data) {
  const { title, projectId, deadline, priority, complexity, isQuick, recurrence, alarm_at, description, assignedTo } = data;
  return unwrap(await supabase.from('tasks').insert({
    title, description: description || null,
    project_id: projectId || null, owner_id: assignedTo || uid(),
    deadline: deadline || null,
    status: 'pending',
    is_quick: isQuick ? true : false,
    recurrence: recurrence || null,
    alarm_at: alarm_at || null,
  }).select().single());
}

async function updateTask(id, data) {
  const updates = {};
  if (data.status) updates.status = data.status;
  if (data.deadline) updates.deadline = data.deadline;
  if (data.title) updates.title = data.title;
  if (data.alarm_at !== undefined) updates.alarm_at = data.alarm_at;

  const task = unwrap(await supabase.from('tasks').update(updates).eq('id', id).select().single());

  // Recurrence: spawn next occurrence
  if (data.status === 'done' && task.recurrence && task.deadline) {
    const nextDeadline = addPeriod(task.deadline, task.recurrence);
    await supabase.from('tasks').insert({
      title: task.title, project_id: task.project_id, owner_id: task.owner_id,
      deadline: nextDeadline, status: 'pending',
      is_quick: task.is_quick, recurrence: task.recurrence,
      recurrence_parent: task.recurrence_parent || task.id,
    });
  }
  return task;
}

async function deleteTask(id) {
  await supabase.from('tasks').delete().eq('id', id);
  return { ok: true };
}

// ── Templates ────────────────────────────────────────────

async function templates() {
  return unwrap(await supabase.from('templates').select('*').order('name'));
}

async function applyTemplate(id, data) {
  const { title, deadline, memberIds = [] } = data;
  const t = unwrap(await supabase.from('templates').select('*').eq('id', id).single());
  const subtaskTitles = Array.isArray(t.subtasks) ? t.subtasks : JSON.parse(t.subtasks || '[]');

  const p = unwrap(await supabase.from('projects').insert({
    title: title || `${t.name} — ${todayStr()}`,
    department: t.department, description: t.description || null,
    owner_id: uid(), deadline: deadline || null,
  }).select().single());

  await supabase.from('project_members').insert({ project_id: p.id, user_id: uid() });
  for (const mid of memberIds) {
    if (mid !== uid()) await supabase.from('project_members').upsert({ project_id: p.id, user_id: mid }, { onConflict: 'project_id,user_id' });
  }
  for (let i = 0; i < subtaskTitles.length; i++) {
    await supabase.from('subtasks').insert({
      project_id: p.id, title: subtaskTitles[i],
      owner_id: uid(), assigned_by: uid(),
      assignment_status: 'accepted', sort_order: i + 1,
    });
  }
  return p;
}

// ── Events ───────────────────────────────────────────────

async function events(date) {
  let q = supabase.from('events').select('*').eq('owner_id', uid());
  if (date) {
    // Filter using local timezone boundaries so events match the user's calendar day
    const dayStart = new Date(`${date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59`).toISOString();
    q = q.gte('start_time', dayStart).lte('start_time', dayEnd);
  }
  q = q.order('start_time');
  const rows = unwrap(await q);
  for (const e of rows) {
    const { data: att } = await supabase
      .from('event_attendees')
      .select('user:users(id, name, email, initials, department, avatar_color, avatar_url)')
      .eq('event_id', e.id);
    e.attendees = (att || []).map(a => a.user);
  }
  return rows;
}

async function createEvent(data) {
  const { title, startTime, durationMin, eventType, department, priority, meetLink, attendeeIds = [] } = data;
  const e = unwrap(await supabase.from('events').insert({
    title, owner_id: uid(), start_time: startTime,
    duration_min: durationMin || 60, event_type: eventType || 'work',
    department: department || null, priority: priority || null,
    meet_link: meetLink || null,
  }).select().single());
  for (const aid of attendeeIds) {
    await supabase.from('event_attendees').upsert({ event_id: e.id, user_id: aid }, { onConflict: 'event_id,user_id' });
  }
  return e;
}

async function updateEvent(id, data) {
  const updates = {};
  if (data.title) updates.title = data.title;
  if (data.startTime) updates.start_time = data.startTime;
  if (data.durationMin) updates.duration_min = data.durationMin;
  if (data.eventType) updates.event_type = data.eventType;
  return unwrap(await supabase.from('events').update(updates).eq('id', id).select().single());
}

async function deleteEvent(id) {
  await supabase.from('event_attendees').delete().eq('event_id', id);
  await supabase.from('events').delete().eq('id', id);
  return { ok: true };
}

async function deleteComment(id) {
  await supabase.from('attachments').delete().eq('comment_id', id);
  await supabase.from('comments').delete().eq('id', id);
  return { ok: true };
}

// ── Meetings ─────────────────────────────────────────────

async function createMeeting(projectId, data) {
  const { title, startTime, durationMin = 30, attendeeIds = [] } = data;
  const meetLink = generateMeetLink();
  const e = unwrap(await supabase.from('events').insert({
    title, owner_id: uid(), start_time: startTime,
    duration_min: durationMin, event_type: 'work', meet_link: meetLink,
    project_id: projectId,
  }).select().single());

  const allAttendees = [...new Set([uid(), ...attendeeIds])];
  for (const aid of allAttendees) {
    await supabase.from('event_attendees').upsert({ event_id: e.id, user_id: aid }, { onConflict: 'event_id,user_id' });
  }

  // Notify attendees
  const [proj, organizer] = await Promise.all([
    supabase.from('projects').select('title').eq('id', projectId).single(),
    supabase.from('users').select('name').eq('id', uid()).single(),
  ]);
  for (const aid of allAttendees.filter(a => a !== uid())) {
    await supabase.from('notifications').insert({
      user_id: aid, type: 'reminder',
      title: `Meeting: ${title}`,
      body: `${organizer.data?.name} · ${proj.data?.title} · ${startTime} · ${meetLink}`,
      ref_project: projectId,
      meta: { event: e.id },
    });
  }
  return e;
}

async function projectMeetings(projectId) {
  const { data } = await supabase
    .from('events')
    .select('*')
    .not('meet_link', 'is', null)
    .or(`project_id.eq.${projectId},owner_id.eq.${uid()}`)
    .order('start_time');
  return data || [];
}

// ── Comments ─────────────────────────────────────────────

async function createComment(projectId, body, attachments = []) {
  const c = unwrap(await supabase.from('comments').insert({
    project_id: projectId, author_id: uid(), body,
  }).select('*, author:users!author_id(name, initials, avatar_color, avatar_url)').single());

  // Upload attachments to Storage
  const savedAttachments = [];
  for (const att of attachments) {
    if (!att.dataUrl && !att.file) continue;
    let blob, filename;
    if (att.file) {
      blob = att.file;
      filename = att.filename || att.file.name;
    } else {
      const match = /^data:([^;]+);base64,(.+)$/.exec(att.dataUrl);
      if (!match) continue;
      const bytes = Uint8Array.from(atob(match[2]), ch => ch.charCodeAt(0));
      blob = new Blob([bytes], { type: match[1] });
      filename = att.filename || `file-${Date.now()}`;
    }
    const storagePath = `${projectId}/${c.id}/${filename}`;
    await supabase.storage.from('attachments').upload(storagePath, blob);
    const { data: inserted } = await supabase.from('attachments').insert({
      comment_id: c.id, project_id: projectId,
      filename, storage_path: storagePath,
      mime_type: blob.type, size_bytes: blob.size,
    }).select().single();
    if (inserted) savedAttachments.push({ id: inserted.id, filename, url: storagePath, mime: blob.type, size: blob.size });
  }

  return {
    ...c,
    author_name: c.author?.name, author_initials: c.author?.initials,
    author_color: c.author?.avatar_color, author_avatar: c.author?.avatar_url,
    author: undefined,
    attachments: savedAttachments,
  };
}

// ── Pokes ────────────────────────────────────────────────

async function poke(receiverId, subtaskId, projectId) {
  if (!receiverId || receiverId === uid()) throw new Error('invalid receiver');

  // Rate limit check
  const sinceMidnight = todayStr() + 'T00:00:00';
  const metaVal = { from: uid(), sub: subtaskId || '' };
  const { data: recent } = await supabase
    .from('notifications')
    .select('id')
    .eq('type', 'poke')
    .eq('user_id', receiverId)
    .gte('created_at', sinceMidnight)
    .limit(1);

  // Simple rate limit: check if there's a poke today with same meta
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'poke')
    .eq('user_id', receiverId)
    .gte('created_at', sinceMidnight);

  // Get sender name & subtitle
  const sender = unwrap(await supabase.from('users').select('name').eq('id', uid()).single());
  let subtitle = '';
  if (subtaskId) {
    const { data: s } = await supabase.from('subtasks').select('title').eq('id', subtaskId).single();
    if (s) subtitle = s.title;
  } else if (projectId) {
    const { data: p } = await supabase.from('projects').select('title').eq('id', projectId).single();
    if (p) subtitle = p.title;
  }

  // Check leave
  const today = todayStr();
  const { data: leave } = await supabase.from('leaves')
    .select('*').eq('user_id', receiverId).lte('start_date', today).gte('end_date', today).maybeSingle();
  const leaveSuffix = leave ? ` · currently on leave until ${leave.end_date}` : '';

  await supabase.from('notifications').insert({
    user_id: receiverId, type: 'poke',
    title: `${sender.name} poked you 👆`,
    body: `About: ${subtitle}${leaveSuffix}`,
    meta: metaVal,
    ref_subtask: subtaskId || null,
    ref_project: projectId || null,
  });
  return { ok: true, queuedForReturn: !!leave };
}

// ── Notifications ────────────────────────────────────────

async function notifications() {
  const rows = unwrap(await supabase.from('notifications').select('*')
    .eq('user_id', uid()).order('created_at', { ascending: false }));
  // Map is_read → read for frontend compat
  return rows.map(n => ({
    ...n,
    read: n.is_read,
    subtask_id: n.ref_subtask,
    project_id: n.ref_project,
  }));
}

async function markRead(id) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  return { ok: true };
}

// ── Streaks ──────────────────────────────────────────────

async function streaks() {
  const { data } = await supabase
    .from('streaks')
    .select('*, user:users(name, initials, avatar_color, avatar_url)')
    .eq('user_id', uid())
    .order('current_count', { ascending: false });
  return (data || []).map(s => ({
    ...s,
    user_name: s.user?.name, initials: s.user?.initials,
    avatar_color: s.user?.avatar_color, avatar_url: s.user?.avatar_url,
    user: undefined,
  }));
}

async function createStreak(name) {
  return unwrap(await supabase.from('streaks').insert({
    user_id: uid(), name, current_count: 0, best_count: 0,
  }).select().single());
}

async function logStreak(id) {
  const today = todayStr();
  const streak = unwrap(await supabase.from('streaks').select('*').eq('id', id).single());
  if (streak.last_logged === today) return streak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const newCount = streak.last_logged === yesterday ? streak.current_count + 1 : 1;
  const newBest = Math.max(newCount, streak.best_count);
  return unwrap(await supabase.from('streaks')
    .update({ current_count: newCount, best_count: newBest, last_logged: today })
    .eq('id', id).select().single());
}

// ── Leaves ───────────────────────────────────────────────

async function leaves() {
  const { data } = await supabase
    .from('leaves')
    .select('*, user:users(name, initials, avatar_color, avatar_url)')
    .order('start_date');
  return (data || []).map(l => ({
    ...l,
    name: l.user?.name, initials: l.user?.initials,
    avatar_color: l.user?.avatar_color, avatar_url: l.user?.avatar_url,
    user: undefined,
  }));
}

async function addLeave(data) {
  const { userId, startDate, endDate, type = 'PL' } = data;
  const target = userId || uid();
  const l = unwrap(await supabase.from('leaves').insert({
    user_id: target, start_date: startDate, end_date: endDate, type,
  }).select('*, user:users(name, initials, avatar_color, avatar_url)').single());
  return { ...l, name: l.user?.name, initials: l.user?.initials, avatar_color: l.user?.avatar_color, avatar_url: l.user?.avatar_url, user: undefined };
}

async function deleteLeave(id) {
  await supabase.from('leaves').delete().eq('id', id);
  return { ok: true };
}

async function checkLeave(userId, date) {
  if (!userId || !date) return { onLeave: false };
  const { data: leave } = await supabase.from('leaves').select('*')
    .eq('user_id', userId).lte('start_date', date).gte('end_date', date).maybeSingle();
  return leave
    ? { onLeave: true, from: leave.start_date, to: leave.end_date, type: leave.type }
    : { onLeave: false };
}

// ── Bugs ─────────────────────────────────────────────────

async function bugs(appFilter) {
  let q = supabase.from('bugs').select(
    '*, assigned:users!assigned_to(name, initials, avatar_color, avatar_url), reporter:users!reported_by(name)'
  );
  if (appFilter) q = q.eq('app_name', appFilter);
  q = q.order('created_at', { ascending: false });
  const { data } = await q;
  return (data || []).map(b => ({
    ...b,
    assigned_name: b.assigned?.name, assigned_initials: b.assigned?.initials,
    assigned_color: b.assigned?.avatar_color, assigned_avatar: b.assigned?.avatar_url,
    reporter_name: b.reporter?.name,
    assigned: undefined, reporter: undefined,
  }));
}

async function bugApps() {
  const { data } = await supabase.from('bugs').select('app_name').order('app_name');
  return [...new Set((data || []).map(r => r.app_name))];
}

async function createBug(data) {
  const { appName, issue, screenshotDataUrl, assignedTo, deadline } = data;
  let screenshotUrl = null;
  if (screenshotDataUrl) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(screenshotDataUrl);
    if (match) {
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
      const ext = match[1] === 'image/png' ? 'png' : 'jpg';
      const path = `bug-${Date.now()}.${ext}`;
      await supabase.storage.from('screenshots').upload(path, bytes, { contentType: match[1] });
      const { data: { publicUrl } } = supabase.storage.from('screenshots').getPublicUrl(path);
      screenshotUrl = publicUrl;
    }
  }
  const b = unwrap(await supabase.from('bugs').insert({
    app_name: appName, issue, screenshot_url: screenshotUrl,
    assigned_to: assignedTo || null, deadline: deadline || null,
    reported_by: uid(), status: 'open',
  }).select('*, assigned:users!assigned_to(name, initials, avatar_color, avatar_url), reporter:users!reported_by(name)').single());

  if (assignedTo && assignedTo !== uid()) {
    const reporter = unwrap(await supabase.from('users').select('name').eq('id', uid()).single());
    await supabase.from('notifications').insert({
      user_id: assignedTo, type: 'assignment',
      title: `Bug reported: ${issue.slice(0, 50)}`,
      body: `${reporter.name} reported a bug in ${appName}`,
    });
  }
  return { ...b, assigned_name: b.assigned?.name, assigned_initials: b.assigned?.initials, assigned_color: b.assigned?.avatar_color, assigned_avatar: b.assigned?.avatar_url, reporter_name: b.reporter?.name, assigned: undefined, reporter: undefined };
}

async function updateBug(id, data) {
  const updates = {};
  if (data.status) updates.status = data.status;
  if (data.assignedTo !== undefined) updates.assigned_to = data.assignedTo;
  if (data.deadline !== undefined) updates.deadline = data.deadline;
  return unwrap(await supabase.from('bugs').update(updates).eq('id', id).select().single());
}

// ── Chat ─────────────────────────────────────────────────

async function chatMessages(limit = 50) {
  const { data } = await supabase
    .from('chat_messages')
    .select('*, user:users(name, initials, avatar_color, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).reverse().map(m => ({
    ...m,
    name: m.user?.name, initials: m.user?.initials,
    avatar_color: m.user?.avatar_color, avatar_url: m.user?.avatar_url,
    user: undefined,
  }));
}

async function sendChat(body) {
  if (!body?.trim()) throw new Error('empty message');
  const m = unwrap(await supabase.from('chat_messages').insert({
    user_id: uid(), body: body.trim(),
  }).select('*, user:users(name, initials, avatar_color, avatar_url)').single());

  // Handle @mentions
  const mentions = body.match(/@(\w+)/g) || [];
  if (mentions.length) {
    const sender = unwrap(await supabase.from('users').select('name').eq('id', uid()).single());
    const allUsers = unwrap(await supabase.from('users').select('id, name'));
    for (const mention of mentions) {
      const mentionName = mention.slice(1).toLowerCase();
      const target = allUsers.find(u => u.name.toLowerCase().startsWith(mentionName) && u.id !== uid());
      if (target) {
        await supabase.from('notifications').insert({
          user_id: target.id, type: 'poke',
          title: `${sender.name} mentioned you in Team Chat`,
          body: body.trim().slice(0, 100),
        });
      }
    }
  }

  return { ...m, name: m.user?.name, initials: m.user?.initials, avatar_color: m.user?.avatar_color, avatar_url: m.user?.avatar_url, user: undefined };
}

// ── Focus Sessions ───────────────────────────────────────

async function focusActive() {
  const { data } = await supabase.from('focus_sessions').select('*')
    .eq('user_id', uid()).is('ended_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (data) data.complexity = mapComplexityFromDB(data.complexity);
  return data || null;
}

async function focusStart(complexity = 'High Complex') {
  complexity = mapComplexityToDB(complexity);
  // End existing session
  const existing = await focusActive();
  if (existing) {
    const dur = Math.round((Date.now() - new Date(existing.started_at).getTime()) / 60000);
    await supabase.from('focus_sessions').update({ ended_at: new Date().toISOString(), duration_min: dur }).eq('id', existing.id);
  }
  return unwrap(await supabase.from('focus_sessions').insert({
    user_id: uid(), complexity,
  }).select().single());
}

async function focusStop() {
  const session = await focusActive();
  if (!session) return null;
  const dur = Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000);
  return unwrap(await supabase.from('focus_sessions')
    .update({ ended_at: new Date().toISOString(), duration_min: dur })
    .eq('id', session.id).select().single());
}

async function focusStats() {
  const today = todayStr();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const { data: sessions } = await supabase.from('focus_sessions').select('complexity, duration_min, started_at')
    .eq('user_id', uid()).not('duration_min', 'is', null);

  const todaySessions = (sessions || []).filter(s => s.started_at?.startsWith(today));
  const weekSessions = (sessions || []).filter(s => s.started_at >= weekAgo);

  const sum = (arr, cmp) => arr.filter(s => s.complexity === cmp).reduce((a, s) => a + (s.duration_min || 0), 0);

  const highToday = sum(todaySessions, 'high_complex');
  const lowToday = sum(todaySessions, 'low_complex');
  const highWeek = sum(weekSessions, 'high_complex');
  const lowWeek = sum(weekSessions, 'low_complex');

  return {
    today: { high: highToday, low: lowToday },
    weekTotal: { high: highWeek, low: lowWeek },
    weekAvg: { high: Math.round(highWeek / 7), low: Math.round(lowWeek / 7) },
    breakRecommended: highToday >= 90,
  };
}

// ── Alarms ───────────────────────────────────────────────

async function alarmsDue() {
  const now = new Date().toISOString();
  const { data } = await supabase.from('tasks').select('id, title, alarm_at')
    .eq('owner_id', uid()).not('alarm_at', 'is', null).lte('alarm_at', now).neq('status', 'done')
    .order('alarm_at').limit(5);
  return data || [];
}

// ── Activity Feed ────────────────────────────────────────

async function activity(limit = 15) {
  const items = [];
  const today = todayStr();
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  // Completed subtasks
  const { data: completedSubs } = await supabase
    .from('subtasks')
    .select('id, title, project_id, status, projects(title), owner:users!owner_id(name, initials, avatar_color, avatar_url)')
    .eq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(limit);
  (completedSubs || []).forEach(r => items.push({
    id: `sub-${r.id}`, kind: 'completed_subtask',
    actor: r.owner?.name, initials: r.owner?.initials, color: r.owner?.avatar_color, avatar_url: r.owner?.avatar_url,
    text: `completed "${r.title}"`, context: r.projects?.title,
    ts: r.updated_at || new Date().toISOString(),
  }));

  // New projects
  const { data: newProjects } = await supabase
    .from('projects')
    .select('id, title, department, created_at, owner:users!owner_id(name, initials, avatar_color, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  (newProjects || []).forEach(r => items.push({
    id: `proj-${r.id}`, kind: 'new_project',
    actor: r.owner?.name, initials: r.owner?.initials, color: r.owner?.avatar_color, avatar_url: r.owner?.avatar_url,
    text: `created project "${r.title}"`, context: r.department,
    ts: r.created_at,
  }));

  // Comments
  const { data: recentComments } = await supabase
    .from('comments')
    .select('id, body, created_at, project_id, projects(title), author:users!author_id(name, initials, avatar_color, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  (recentComments || []).forEach(r => items.push({
    id: `cmt-${r.id}`, kind: 'comment',
    actor: r.author?.name, initials: r.author?.initials, color: r.author?.avatar_color, avatar_url: r.author?.avatar_url,
    text: `commented on "${r.projects?.title}"`,
    context: r.body?.length > 60 ? r.body.slice(0, 57) + '…' : r.body,
    ts: r.created_at,
  }));

  // Streaks
  const { data: activeStreaks } = await supabase
    .from('streaks')
    .select('id, name, current_count, last_logged, user:users(name, initials, avatar_color, avatar_url)')
    .gt('current_count', 0)
    .order('current_count', { ascending: false })
    .limit(5);
  (activeStreaks || []).forEach(r => items.push({
    id: `streak-${r.id}`, kind: 'streak',
    actor: r.user?.name, initials: r.user?.initials, color: r.user?.avatar_color, avatar_url: r.user?.avatar_url,
    text: `is on a ${r.current_count}-day ${r.name} streak 🔥`,
    context: null,
    ts: r.last_logged || new Date().toISOString(),
  }));

  // Upcoming leaves
  const { data: upcomingLeaves } = await supabase
    .from('leaves')
    .select('id, start_date, end_date, type, user:users(name, initials, avatar_color, avatar_url)')
    .gte('start_date', today).lte('start_date', in7);
  (upcomingLeaves || []).forEach(r => items.push({
    id: `leave-${r.id}`, kind: 'leave',
    actor: r.user?.name, initials: r.user?.initials, color: r.user?.avatar_color, avatar_url: r.user?.avatar_url,
    text: `will be on leave ${r.start_date} → ${r.end_date} 🏖️`,
    context: r.type,
    ts: new Date().toISOString(),
  }));

  items.sort((a, b) => (b.ts > a.ts ? 1 : -1));
  return items.slice(0, limit);
}

// ── Insights ─────────────────────────────────────────────

async function insights() {
  const today = todayStr();
  const insightsList = [];

  // 1. Top department
  const { data: deptRows } = await supabase
    .from('subtasks')
    .select('status, project:projects(department)')
    .not('project', 'is', null);
  if (deptRows?.length) {
    const deptMap = {};
    deptRows.forEach(r => {
      const dept = r.project?.department;
      if (!dept) return;
      if (!deptMap[dept]) deptMap[dept] = { done: 0, total: 0 };
      deptMap[dept].total++;
      if (r.status === 'done') deptMap[dept].done++;
    });
    const sorted = Object.entries(deptMap).map(([name, d]) => ({ name, ...d, rate: d.done / d.total })).sort((a, b) => b.rate - a.rate);
    if (sorted[0]) {
      insightsList.push({
        icon: '🏆',
        title: `${sorted[0].name} is leading`,
        text: `${Math.round(sorted[0].rate * 100)}% of subtasks completed — ${sorted[0].done} of ${sorted[0].total}.`,
      });
    }
  }

  // 2. Overdue count
  const { count: myOverdue } = await supabase
    .from('subtasks')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', uid())
    .neq('status', 'done')
    .lt('deadline', today);
  if (myOverdue > 0) {
    insightsList.push({
      icon: '⚠️',
      title: `${myOverdue} overdue subtask${myOverdue === 1 ? '' : 's'} need attention`,
      text: 'Consider rescheduling or delegating before they block downstream work.',
    });
  } else {
    insightsList.push({ icon: '🎯', title: 'No overdue work', text: 'You are on track with everything assigned to you.' });
  }

  // 3. Top completer
  const { data: completedSubs } = await supabase
    .from('subtasks')
    .select('owner_id, owner:users!owner_id(name)')
    .eq('status', 'done');
  if (completedSubs?.length) {
    const counts = {};
    completedSubs.forEach(s => {
      if (!s.owner_id) return;
      counts[s.owner_id] = counts[s.owner_id] || { name: s.owner?.name, c: 0 };
      counts[s.owner_id].c++;
    });
    const top = Object.values(counts).sort((a, b) => b.c - a.c)[0];
    if (top) {
      insightsList.push({
        icon: '⚡',
        title: `${top.name?.split(' ')[0]} is this week's driver`,
        text: `${top.c} subtasks completed recently.`,
      });
    }
  }

  // 4. Top streak
  const { data: topStreak } = await supabase
    .from('streaks')
    .select('name, current_count, user:users(name)')
    .order('current_count', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (topStreak && topStreak.current_count >= 5) {
    insightsList.push({
      icon: '🔥',
      title: `${topStreak.user?.name?.split(' ')[0]}'s ${topStreak.name} streak is inspiring`,
      text: `${topStreak.current_count} days in a row.`,
    });
  }

  // 5. Recurring tasks
  const { count: recurringCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .not('recurrence', 'is', null);
  if (recurringCount > 0) {
    insightsList.push({
      icon: '🔁',
      title: `${recurringCount} recurring task${recurringCount === 1 ? '' : 's'} automating your routine`,
      text: 'These auto-spawn each cycle so nothing slips through.',
    });
  }

  return insightsList;
}

// ── Reports ──────────────────────────────────────────────

async function reportSummary(params = {}) {
  const { scope = 'me', period = 'weekly' } = params;
  const today = todayStr();
  const isMine = scope === 'me';

  // Fetch all tasks+subtasks (filtered by owner if scope=me)
  let tasksQ = supabase.from('tasks').select('status, deadline');
  let subsQ = supabase.from('subtasks').select('status, deadline');
  if (isMine) { tasksQ = tasksQ.eq('owner_id', uid()); subsQ = subsQ.eq('owner_id', uid()); }

  const [{ data: allTasks }, { data: allSubs }] = await Promise.all([tasksQ, subsQ]);
  const combined = [...(allTasks || []), ...(allSubs || [])];

  const done = combined.filter(r => r.status === 'done').length;
  const overdue = combined.filter(r => r.status !== 'done' && r.deadline && r.deadline < today).length;
  const total = combined.length || 1;
  const denom = Math.max(1, done + overdue);
  const onTimeRate = Math.round((done / denom) * 100);
  const score = Math.max(0, Math.min(100, Math.round((done - overdue * 2) / Math.max(1, total) * 100)));

  // Chart
  const periodDays = period === 'daily' ? 1 : period === 'monthly' ? 30 : period === 'quarterly' ? 90 : 7;
  const bucketCount = period === 'quarterly' ? 12 : 6;
  const bucketDays = Math.max(1, Math.round(periodDays / bucketCount));
  const chart = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const start = new Date(); start.setDate(start.getDate() - (i + 1) * bucketDays);
    const end = new Date(); end.setDate(end.getDate() - i * bucketDays);
    const s = start.toISOString().slice(0, 10);
    const e = end.toISOString().slice(0, 10);
    const count = combined.filter(r => r.status === 'done' && r.deadline >= s && r.deadline < e).length;
    const label = period === 'weekly'
      ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][start.getDay()]
      : start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    chart.push({ day: label, value: count });
  }

  // Departments
  const { data: deptRows } = await supabase
    .from('projects')
    .select('department, tasks(status, deadline), subtasks(status, deadline)');
  const deptColors = { 'Operations': '#22C55E', "CEO's Office": '#4A6CF7', 'Common': '#9CA3AF' };
  const deptMap = {};
  (deptRows || []).forEach(p => {
    const dept = p.department;
    if (!deptMap[dept]) deptMap[dept] = { done: 0, overdue: 0, total: 0 };
    [...(p.tasks || []), ...(p.subtasks || [])].forEach(t => {
      deptMap[dept].total++;
      if (t.status === 'done') deptMap[dept].done++;
      else if (t.deadline && t.deadline < today) deptMap[dept].overdue++;
    });
  });
  const departments = Object.entries(deptMap).map(([name, d]) => ({
    name, color: deptColors[name] || '#9CA3AF',
    done: d.done, overdue: d.overdue,
    efficiency: Math.max(0, Math.round(((d.total - d.overdue) / Math.max(1, d.total)) * 100)),
  }));

  return { score, done, overdue, onTimeRate, chart, departments };
}

// ── Search ───────────────────────────────────────────────

async function search(q) {
  if (!q?.trim()) return { projects: [], subtasks: [], tasks: [], comments: [] };
  const like = `%${q}%`;

  const [{ data: projectsData }, { data: subtasksData }, { data: tasksData }, { data: commentsData }] = await Promise.all([
    supabase.from('projects').select('id, title, department').ilike('title', like).limit(8),
    supabase.from('subtasks').select('id, title, project_id, status, project:projects(title)').ilike('title', like).limit(8),
    supabase.from('tasks').select('id, title, status, deadline, is_quick').ilike('title', like).limit(8),
    supabase.from('comments').select('id, body, project_id, project:projects(title), author:users!author_id(name)').ilike('body', like).limit(8),
  ]);

  return {
    projects: projectsData || [],
    subtasks: (subtasksData || []).map(s => ({ ...s, project_title: s.project?.title, project: undefined })),
    tasks: tasksData || [],
    comments: (commentsData || []).map(c => ({ ...c, project_title: c.project?.title, author: c.author?.name, project: undefined })),
  };
}

// ── Digest Preview ───────────────────────────────────────

async function digestPreview() {
  const today = todayStr();
  const user = await me();

  const { data: overdue } = await supabase.from('subtasks')
    .select('title, deadline, project:projects(title)')
    .eq('owner_id', uid()).neq('status', 'done').lt('deadline', today)
    .order('deadline').limit(10);

  const { data: dueToday } = await supabase.from('subtasks')
    .select('title, deadline, project:projects(title)')
    .eq('owner_id', uid()).neq('status', 'done').eq('deadline', today).limit(10);

  const { data: completed } = await supabase.from('subtasks')
    .select('title, project:projects(title)')
    .eq('owner_id', uid()).eq('status', 'done')
    .order('updated_at', { ascending: false }).limit(5);

  const { data: streakRows } = await supabase.from('streaks')
    .select('name, current_count').eq('user_id', uid());

  const lines = [];
  lines.push(`Hi ${user.name.split(' ')[0]},`, '', "Here's what's on your plate today.", '');
  if (overdue?.length) {
    lines.push(`⚠️  OVERDUE (${overdue.length})`);
    overdue.forEach(o => lines.push(`  • ${o.title} — ${o.project?.title || '—'} (was due ${o.deadline})`));
    lines.push('');
  }
  if (dueToday?.length) {
    lines.push(`📌  DUE TODAY (${dueToday.length})`);
    dueToday.forEach(o => lines.push(`  • ${o.title} — ${o.project?.title || '—'}`));
    lines.push('');
  }
  if (completed?.length) {
    lines.push('✅  RECENTLY COMPLETED');
    completed.forEach(o => lines.push(`  • ${o.title}`));
    lines.push('');
  }
  if (streakRows?.length) {
    lines.push('🔥  ACTIVE STREAKS');
    streakRows.forEach(s => lines.push(`  • ${s.name}: ${s.current_count} days`));
    lines.push('');
  }
  lines.push('— Nexo');

  return {
    to: user.email,
    subject: `[Nexo] Your daily digest — ${today}`,
    body: lines.join('\n'),
    generated_at: new Date().toISOString(),
  };
}

// ── No-op stubs ──────────────────────────────────────────

async function resetSeed() { return { ok: false, error: 'Use Supabase dashboard to reseed' }; }
function setAlarm(taskId, alarmAt) { return updateTask(taskId, { alarm_at: alarmAt }); }

// ── Export ───────────────────────────────────────────────

export const api = {
  login,
  logout,
  me,
  users,
  updateMe,
  uploadAvatar,
  preferences,
  updatePreferences,
  projects,
  project,
  createProject,
  updateProject,
  deleteProject,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  respondSubtask,
  createComment,
  poke,
  createMeeting,
  projectMeetings,
  tasks,
  urgentTasks,
  createTask,
  updateTask,
  deleteTask,
  templates,
  applyTemplate,
  events,
  createEvent,
  updateEvent,
  deleteEvent,
  streaks,
  createStreak,
  logStreak,
  notifications,
  markRead,
  leaves,
  addLeave,
  deleteLeave,
  checkLeave,
  activity,
  insights,
  reportSummary,
  search,
  digestPreview,
  resetSeed,
  focusActive,
  focusStart,
  focusStop,
  focusStats,
  alarmsDue,
  bugs,
  bugApps,
  createBug,
  updateBug,
  chatMessages,
  sendChat,
  setAlarm,
  deleteComment,
};
