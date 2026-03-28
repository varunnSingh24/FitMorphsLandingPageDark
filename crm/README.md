# FitMorphs CRM

Internal sales & lead tracking platform for FitMorphs.

## Quick Start

```bash
cd crm
npm run setup    # installs all dependencies (root + server + client)
npm run dev      # starts both server (3001) and client (3000)
```

Then open: http://localhost:3000

## Demo Credentials

| Role         | Email                    | Password   |
|--------------|--------------------------|------------|
| Admin        | admin@fitmorphs.com      | admin123   |
| Manager      | rahul@fitmorphs.com      | agent123   |
| Sales Agent  | priya@fitmorphs.com      | agent123   |
| Sales Agent  | amit@fitmorphs.com       | agent123   |
| Sales Agent  | sunita@fitmorphs.com     | agent123   |

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + Recharts
- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3) — auto-created on first run
- **Auth:** JWT (7-day expiry)

## Features

- **Dashboard** — Follow-up reminders, pipeline funnel chart, team performance
- **Lead Management** — Filterable list, bulk assign, detailed lead view
- **Call Logging** — Quick modal from any lead; auto-updates lead status
- **Follow-Up Tracker** — Color-coded by urgency (overdue/today/upcoming)
- **Reports** — Source breakdown, agent performance, conversion funnel
- **Settings** — User management (admin only)

## Role Access

| Feature          | Admin | Manager | Sales Agent |
|------------------|-------|---------|-------------|
| All leads        | ✅    | ✅      | Own only    |
| Reports          | ✅    | ✅      | ❌          |
| Settings         | ✅    | ❌      | ❌          |
| Assign leads     | ✅    | ✅      | ❌          |
| Log calls/notes  | ✅    | ✅      | ✅          |

## Database

SQLite file is created at `server/fitmorphs.db` on first run.
Seed data includes 20 realistic leads with call logs, activities, and follow-ups.

To reset: `rm server/fitmorphs.db` then restart the server.
