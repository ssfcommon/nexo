// Run with: node --test test/api.test.js
// Requires the backend to be running on http://localhost:4000 with a fresh seeded DB.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:4000/api';

// Minimal cookie jar
function makeJar() {
  let cookie = '';
  return {
    async req(path, opts = {}) {
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      if (cookie) headers.Cookie = cookie;
      const res = await fetch(BASE + path, { ...opts, headers });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      return res;
    },
    clear() { cookie = ''; }
  };
}

async function login(jar, email, password = 'password123') {
  const res = await jar.req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  return res;
}

describe('Auth (currently bypassed — app defaults to Arjun)', () => {
  test('GET /me without session defaults to user 1 (Arjun)', async () => {
    const jar = makeJar();
    const res = await jar.req('/me');
    assert.equal(res.status, 200);
    const user = await res.json();
    assert.equal(user.name, 'Arjun Mehta');
    assert.ok(!('password_hash' in user), 'password_hash must not leak');
  });

  test('login with wrong password still returns 401', async () => {
    const jar = makeJar();
    const res = await login(jar, 'arjun@nexo.app', 'nope');
    assert.equal(res.status, 401);
  });

  test('login with correct credentials returns safe user', async () => {
    const jar = makeJar();
    const res = await login(jar, 'arjun@nexo.app');
    assert.equal(res.status, 200);
    const user = await res.json();
    assert.equal(user.name, 'Arjun Mehta');
    assert.ok(!('password_hash' in user), 'password_hash must not leak');
    assert.equal(user.role, 'admin');
  });
});

describe('Projects & subtasks', () => {
  test('GET /projects?scope=mine returns current user projects', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    const res = await jar.req('/projects?scope=mine');
    assert.equal(res.status, 200);
    const projects = await res.json();
    assert.ok(Array.isArray(projects));
    assert.ok(projects.length > 0, 'Arjun should have at least one project');
    assert.ok(projects[0].members, 'project should include members');
  });

  test('project detail includes subtasks + comments', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    const res = await jar.req('/projects/1');
    assert.equal(res.status, 200);
    const p = await res.json();
    assert.ok(Array.isArray(p.subtasks));
    assert.ok(Array.isArray(p.comments));
    assert.ok(p.owner && !('password_hash' in p.owner));
  });

  test('creating subtask for self sets accepted, other user sets pending + notification', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    // self
    let res = await jar.req('/projects/1/subtasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'TEST self subtask' }),
    });
    let sub = await res.json();
    assert.equal(sub.assignment_status, 'accepted');

    // to Ravi
    res = await jar.req('/projects/1/subtasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'TEST assigned subtask', ownerId: 2, deadline: '2026-05-01' }),
    });
    sub = await res.json();
    assert.equal(sub.assignment_status, 'pending');
    assert.equal(sub.owner_id, 2);

    // Ravi should see assignment notif
    const jar2 = makeJar();
    await login(jar2, 'ravi@nexo.app');
    const notifs = await (await jar2.req('/notifications')).json();
    const match = notifs.find(n => n.subtask_id === sub.id && n.type === 'assignment');
    assert.ok(match, 'assignee should have assignment notification');
  });

  test('completing subtask auto-updates project progress', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    const before = await (await jar.req('/projects/1')).json();
    const pending = before.subtasks.find(s => s.status !== 'done');
    if (!pending) return; // nothing to do
    await jar.req(`/subtasks/${pending.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
    const after = await (await jar.req('/projects/1')).json();
    const doneNow = after.subtasks.filter(s => s.status === 'done').length;
    const expected = Math.round((doneNow / after.subtasks.length) * 100);
    assert.equal(after.progress, expected);
  });
});

describe('Role-based access', () => {
  test('member cannot change a user role → 403', async () => {
    const jar = makeJar();
    await login(jar, 'ankit@nexo.app');
    const res = await jar.req('/users/2/role', { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) });
    assert.equal(res.status, 403);
  });

  test('admin can change a user role → 200', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    const res = await jar.req('/users/3/role', { method: 'PATCH', body: JSON.stringify({ role: 'member' }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.role, 'member');
  });
});

describe('Pokes & leaves', () => {
  test('poking a user twice on the same day → 429', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    // find a subtask owned by Ravi
    const p = await (await jar.req('/projects/3')).json();
    const target = p.subtasks.find(s => s.owner_id === 2);
    assert.ok(target, 'expected a Ravi-owned subtask');
    const first = await jar.req('/pokes', {
      method: 'POST',
      body: JSON.stringify({ receiverId: 2, subtaskId: target.id, projectId: 3 }),
    });
    const second = await jar.req('/pokes', {
      method: 'POST',
      body: JSON.stringify({ receiverId: 2, subtaskId: target.id, projectId: 3 }),
    });
    assert.ok([200, 429].includes(first.status), 'first poke should succeed or already rate-limited');
    if (first.status === 200) assert.equal(second.status, 429);
  });

  test('leave check returns onLeave true for seeded Ankit window', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    const res = await jar.req('/leaves/check?userId=3&date=2026-04-14');
    const body = await res.json();
    assert.equal(body.onLeave, true);
  });
});

describe('Reports & insights', () => {
  test('reports summary returns aggregated numbers', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    const res = await jar.req('/reports/summary?scope=all&period=weekly');
    const body = await res.json();
    assert.ok(typeof body.done === 'number');
    assert.ok(typeof body.overdue === 'number');
    assert.ok(Array.isArray(body.chart));
    assert.ok(Array.isArray(body.departments));
  });

  test('CSV export returns text/csv', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    const res = await jar.req('/reports/export?scope=me');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/csv/);
    const csv = await res.text();
    assert.match(csv, /Type,Title,Project/);
  });

  test('insights returns at least one item', async () => {
    const jar = makeJar();
    await login(jar, 'arjun@nexo.app');
    const res = await jar.req('/insights');
    const items = await res.json();
    assert.ok(Array.isArray(items) && items.length > 0);
    assert.ok(items[0].title && items[0].icon);
  });
});
