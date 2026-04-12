# Nexo — Internal Productivity & Project Management App

A full-stack productivity & project-management app built from an agrotech company's concept doc. React + Vite + Tailwind frontend, Express + SQLite backend. Mobile-first with a responsive desktop sidebar.

![Nexo tech stack](https://img.shields.io/badge/stack-React_18_·_Vite_·_Tailwind_·_Express_·_SQLite-4A6CF7)

---

## Features

### Home (Dashboard)
- Personalized greeting with current user + live date
- Mood check-in pills (Productive / Moderate / Low Energy)
- **Urgent-task ranking**: top 3 items prioritized overdue → due-today → upcoming, with **red pulse animation** on overdue cards and real relative-time labels ("3h ago", "in 2d")
- **Quick-action modals**: + Task (with recurrence: daily / weekly / monthly), + Project (with template picker + member multi-select), + Event (work/personal)
- **Activity feed**: unioned stream of completed subtasks, new projects, comments, streak milestones and upcoming leaves
- **Duolingo-style streaks** with log button, best-count tracking, and `+ Start a Streak` inline input
- **Leave banner** surfaces upcoming teammate leaves

### Projects
- My / All scope toggle
- Clickable project cards with department dot, priority tag, progress bar and member avatar stack
- Quick-task checklist with confetti animation on completion and 🔁 icon for recurring items

### Project detail
- Auto-recalculating progress bar (from subtask completion %)
- **Checklist** with assignee dropdown, deadline picker, and **live HRM leave warning** when assigning to someone on leave
- **Assignment workflow**: status badges (Pending / Declined), creates `assignment` notification for other owner, recipient can Accept / Modify timeline / Decline with note from the Notifications overlay — original notification auto-marked read, assigner receives confirmation
- **👆 Poke system**: one-tap nudge with per-sender/subtask/day rate limit (429), leave-aware body ("currently on leave until …")
- **Meetings section**: schedule modal generates a Google Meet link, creates a calendar event, notifies attendees
- **Comments** with `@mention` highlighting and **file attachments** (drag-in a file, stored server-side, image thumbnails / download chips)
- **Confetti** (CSS keyframe particles) on every subtask completion

### Calendar
- Day timeline with color-left-border event cards
- Join button for meetings with a Meet link
- Busy blocks for personal events
- High-priority highlight for prioritized work
- Leave indicators for team members

### Reports
- **Live aggregates** (no mock data) from real tasks + subtasks joins
- **Me / Company** scope toggle, **Daily / Weekly / Monthly / Quarterly** period tabs
- Score banner, 3 headline stats (Done / Overdue / On-time rate), SVG trend chart, department efficiency table
- **✨ AI insights** (heuristic): top-performing department, overdue counts, most productive user, top streak, recurring-task coverage
- **CSV + PDF download** (PDF rendered via `pdfkit` with color-coded rows and auto-pagination)

### Profile
- Identity card with **role badge** (admin / manager / member)
- Live stats: Tasks Done, Top Streak, On-time %
- **Working preferences**: Dark mode toggle (flips `html.dark-theme` with real CSS overrides), Notifications toggle, Calendar sync dropdown, Mood check-in time input — all persisted per-user
- **Edit Profile modal** (name + department, initials auto-regenerated)
- Logout

### Notifications
- Full-screen overlay triggered by 🔔 bell in each screen's top-right (unread badge)
- 6+ notification types: `assignment`, `reminder`, `poke`, `overdue`, `optimization`, `completed`, `accepted`, `declined`, `modified`
- Inline Accept / Modify timeline / Decline forms for assignment notifications

### Auth & security
- Password hashing (`scrypt`), signed-cookie sessions (HMAC-SHA256), per-user scoping
- `requireAuth` middleware on all `/api/*` except `/auth/*`
- **Role-based access control** (`admin` / `manager` / `member`) with `requireRole(...)` middleware on sensitive endpoints
- `password_hash` stripped from every user response via explicit column lists

### Layout
- Responsive: **desktop sidebar** (≥768px) with 5-tab vertical nav, Nexo logo, and user footer card; **mobile bottom-tab bar** (<768px)
- Single-mount via `useMediaQuery` hook (no double effects)

### Resilience
- `ErrorBoundary` around main content with "Try again" button
- Skeleton loaders with shimmer animation on Home
- Empty states with copy and icons

---

## Architecture

```
┌──────────────────────┐         ┌──────────────────────┐
│  Frontend (5173)     │  HTTP   │  Backend (4000)      │
│  React + Vite        │◄───────►│  Express             │
│  Tailwind + JSX      │ cookies │  node:sqlite         │
│  state: useState     │         │  pdfkit              │
└──────────────────────┘         └──────────┬───────────┘
         │                                  │
         │ proxied: /api + /uploads         │
         │                                  ▼
         │                       ┌──────────────────────┐
         │                       │   nexo.db (SQLite)   │
         │                       │   + uploads/         │
         │                       └──────────────────────┘
```

**Data model** (14 tables)
`users`, `projects`, `project_members`, `tasks`, `subtasks`, `comments`, `attachments`, `events`, `event_attendees`, `streaks`, `notifications`, `leaves`, `templates`, + recurrence via `tasks.recurrence` + `recurrence_parent`.

---

## Running locally

**Prerequisites:** Node 22+ (uses built-in `node:sqlite`).

```bash
# Backend
cd backend
npm install
npm run seed      # fresh DB with 3 users + sample data
npm run dev       # http://localhost:4000 (restarts on file changes)

# Frontend (new terminal)
cd frontend
npm install
npm run dev       # http://localhost:5173
```

Open http://localhost:5173. The Vite dev server proxies both `/api/*` and `/uploads/*` to the backend.

### Demo accounts (password: `password123`)

| Email | Name | Role | Dept |
|---|---|---|---|
| `arjun@nexo.app` | Arjun Mehta | admin | CEO's Office |
| `ravi@nexo.app` | Ravi Kumar | manager | Operations |
| `ankit@nexo.app` | Ankit Sharma | member | Operations |

---

## API reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → signed-cookie session |
| POST | `/api/auth/logout` | Clears the session cookie |
| GET  | `/api/me` | Current user (401 if unauthed) |
| PATCH| `/api/me` | Update name / department |
| GET  | `/api/me/preferences` | Per-user preferences JSON |
| PATCH| `/api/me/preferences` | Merge preference patch |

### Projects & tasks
| Method | Path | Description |
|---|---|---|
| GET   | `/api/projects?scope=mine\|all` | Projects with members |
| GET   | `/api/projects/:id` | Full detail with owner, subtasks, comments (+attachments), meetings |
| POST  | `/api/projects` | Create project |
| PATCH | `/api/projects/:id` | Update progress/status/priority |
| DELETE| `/api/projects/:id` | **(admin/manager only)** |
| POST  | `/api/projects/:id/subtasks` | Create subtask (pending if assigned to another user) |
| PATCH | `/api/subtasks/:id` | Update status/title/deadline (auto-recalc progress) |
| DELETE| `/api/subtasks/:id` | Remove subtask |
| POST  | `/api/subtasks/:id/respond` | `{ action: accept\|modify\|decline, deadline?, note? }` |
| POST  | `/api/projects/:id/comments` | `{ body, attachments: [{ filename, dataUrl }] }` |
| GET   | `/api/tasks?quick=1&owner=me` | Quick tasks |
| GET   | `/api/tasks/urgent` | Top urgent items for the home screen |
| POST  | `/api/tasks` | Create task (supports `recurrence: daily\|weekly\|monthly`) |
| PATCH | `/api/tasks/:id` | Update status; auto-spawns next occurrence if recurring |

### Templates
| Method | Path | Description |
|---|---|---|
| GET  | `/api/templates` | List all |
| POST | `/api/templates` | Create a new template |
| POST | `/api/templates/:id/apply` | Stamp a new project from a template |

### Collaboration
| Method | Path | Description |
|---|---|---|
| POST | `/api/pokes` | Nudge a user about a subtask (rate-limited 1/day) |
| POST | `/api/projects/:id/meetings` | Schedule meeting + generate Google Meet link |
| GET  | `/api/projects/:id/meetings` | List scheduled meetings |

### Calendar / streaks / notifications / leaves
| Method | Path | Description |
|---|---|---|
| GET  | `/api/events?date=YYYY-MM-DD` | Day events |
| POST | `/api/events` | Create event |
| GET  | `/api/streaks` | My streaks |
| POST | `/api/streaks` | Create streak |
| POST | `/api/streaks/:id/log` | Log today's progress |
| GET  | `/api/notifications` | My inbox |
| PATCH| `/api/notifications/:id/read` | Mark read |
| GET  | `/api/leaves` | Team leaves |
| GET  | `/api/leaves/check?userId=X&date=Y` | Is user on leave on a date? |

### Reports / insights / activity
| Method | Path | Description |
|---|---|---|
| GET  | `/api/reports/summary?scope=me\|all&period=daily\|weekly\|monthly\|quarterly` | Live aggregates |
| GET  | `/api/reports/export?scope=…` | **CSV download** |
| GET  | `/api/reports/export.pdf?scope=…` | **PDF download** (pdfkit) |
| GET  | `/api/insights` | 5 heuristic insights |
| GET  | `/api/activity?limit=N` | Company-wide activity feed |

### Admin-only
| Method | Path |
|---|---|
| PATCH| `/api/users/:id/role` |

---

## Tests

```bash
cd backend
npm run seed    # reset DB
npm run dev     # server must be running in another terminal
npm test        # 15 tests covering auth, projects, roles, pokes, reports, CSV, insights
```

Uses Node's built-in test runner (`node --test`) — no extra dependencies.

---

## Project layout

```
Nexo/
├── backend/
│   ├── src/
│   │   ├── db.js             # SQLite schema (14 tables)
│   │   ├── seed.js           # Sample data: 3 users, 4 projects, 13 subtasks, templates, meetings…
│   │   ├── auth.js           # scrypt hashing + HMAC-signed cookies
│   │   └── server.js         # ~40 endpoints, all middleware/routes
│   ├── test/api.test.js      # 15 integration tests
│   ├── uploads/              # File attachments (created at runtime)
│   └── nexo.db               # Created by `npm run seed`
└── frontend/
    └── src/
        ├── App.jsx                    # Shell: layout router + error boundary + confetti host
        ├── api.js                     # Fetch client
        ├── hooks/useMediaQuery.js
        ├── components/
        │   ├── ui.jsx                 # Avatar, AvatarStack, PriorityTag, ProgressBar, Pill
        │   ├── HeaderActions.jsx      # Bell + avatar cluster
        │   ├── Modal.jsx              # Reusable modal shell
        │   ├── QuickActions.jsx       # Task/Project/Event/Meeting modals
        │   ├── Confetti.jsx           # CSS-particle confetti host
        │   ├── Skeleton.jsx           # SkeletonCard + EmptyState
        │   └── ErrorBoundary.jsx
        └── screens/
            ├── Home.jsx
            ├── Projects.jsx
            ├── ProjectDetail.jsx
            ├── Calendar.jsx
            ├── Reports.jsx
            ├── Profile.jsx
            ├── Notifications.jsx
            └── Login.jsx
```

---

## Design tokens

Match the UI guide:

| Token | Value |
|---|---|
| `brand.blue` | `#4A6CF7` |
| `success` | `#22C55E` |
| `warn` | `#F59E0B` |
| `danger` | `#EF4444` |
| `accent` | `#8B5CF6` |
| `ink.900 / 500 / 300` | `#1A1A2E / #6B7280 / #9CA3AF` |
| `page` | `#F7F8FA` |

Animations:
- `confetti-fall` — celebratory particles on task completion
- `overdue-pulse` — red halo on overdue cards
- `skeleton-shimmer` — loading placeholder animation

---

## Not yet built

- Email digest & web-push notifications (would need SMTP + VAPID keys)
- Profile "Privacy" and "Help & feedback" rows (placeholders)
- Desktop sidebar polish for `Calendar` and `Reports` screens (they use the shared container but aren't layout-optimized for wide screens)

---

*Built from the "Internal Productivity & Project Management App" concept doc for a small agrotech team. Ready for design review and production hardening.*
