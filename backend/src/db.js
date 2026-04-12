import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'nexo.db');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      initials TEXT NOT NULL,
      department TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      preferences TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL,
      deadline TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      complexity TEXT NOT NULL DEFAULT 'Medium',
      progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      project_id INTEGER,
      owner_id INTEGER NOT NULL,
      deadline TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      complexity TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'pending',
      is_quick INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      recurrence TEXT, -- null | 'daily' | 'weekly' | 'monthly'
      recurrence_parent INTEGER,
      alarm_at TEXT, -- ISO datetime for alarm notification
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      complexity TEXT NOT NULL DEFAULT 'Medium',
      description TEXT,
      subtasks_json TEXT NOT NULL DEFAULT '[]',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 60,
      event_type TEXT NOT NULL DEFAULT 'work',
      department TEXT,
      priority TEXT,
      meet_link TEXT,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS event_attendees (
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (event_id, user_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      current_count INTEGER NOT NULL DEFAULT 0,
      best_count INTEGER NOT NULL DEFAULT 0,
      last_logged TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      meta TEXT,
      subtask_id INTEGER,
      project_id INTEGER,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      parent_id INTEGER,
      depth INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      owner_id INTEGER,
      assigned_by INTEGER,
      assignment_status TEXT NOT NULL DEFAULT 'accepted',
      proposed_deadline TEXT,
      decline_note TEXT,
      deadline TEXT,
      complexity TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES subtasks(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER,
      task_id INTEGER,
      event_id INTEGER,
      project_id INTEGER,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime TEXT,
      size INTEGER
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      complexity TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      duration_min INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT NOT NULL,
      issue TEXT NOT NULL,
      screenshot_url TEXT,
      assigned_to INTEGER,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      reported_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (reported_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'planned',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}
