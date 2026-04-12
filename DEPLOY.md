# Deploying Nexo

## Current target: Vercel (frontend) + Supabase (backend, later)

The frontend can be deployed to Vercel **right now** as a static SPA. It will load and show the Login screen. Since there's no backend yet, log-in attempts will display a friendly "Backend is not reachable" message — that's expected.

When you're ready to build the Supabase backend, set the `VITE_API_BASE` env var in Vercel → redeploy, and the same build will start talking to it.

---

## Step 1 — Push the code to GitHub

From the project root (`D:\Work\App Tools\Nexo`):

```bash
git init
git add .
git commit -m "Initial Nexo commit"

# Create an empty repo on github.com first, then:
git remote add origin git@github.com:<you>/nexo.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Deploy the frontend to Vercel

### Option A: Vercel dashboard (easiest)

1. Go to https://vercel.com/new and import your GitHub repo.
2. When Vercel asks for the **Root Directory**, set it to `frontend`.
3. Vercel auto-detects Vite. The rest of the defaults are fine:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
4. Under **Environment Variables**, leave `VITE_API_BASE` unset for now. You'll add it after you have a backend.
5. Click **Deploy**. You'll get a URL like `https://nexo-<hash>.vercel.app`.

### Option B: Vercel CLI

```bash
npm i -g vercel           # once
cd frontend
vercel                    # follow prompts; pick "frontend" as root when asked
vercel --prod             # deploy the production build
```

### What you'll see on the deployed preview

- The Login screen loads with correct styling.
- Clicking **Sign in** with any credentials will show:
  > Backend is not reachable. If you're viewing this on Vercel, the API lives elsewhere — see the README for local run instructions.
- That's expected. The UI works; there's just nothing behind it yet.

---

## Step 3 — Later: connect the Supabase backend

When your Supabase backend is up, it needs to expose the same REST endpoints documented in `README.md` under **API reference**. Then:

1. Add the env var in Vercel:
   - `VITE_API_BASE` = `https://<your-project>.supabase.co` (or wherever the API lives, **without** a trailing slash)
2. Redeploy the frontend (Vercel does this automatically on the next push, or you can click "Redeploy" in the dashboard).

**Backend requirements to work with this frontend:**
- CORS must allow your Vercel origin (e.g. `https://nexo-*.vercel.app`) and include `Access-Control-Allow-Credentials: true`.
- Session cookie needs `SameSite=None; Secure` so the browser sends it on cross-origin requests.
- Or use a `Authorization: Bearer <token>` header scheme — in that case you'll update `src/api.js` to read the token from `localStorage` instead of relying on cookies.

---

## Step 4 — (Optional) Run the existing Node backend anywhere

If you want to point the Vercel frontend at the current Express + SQLite backend while you build the Supabase version, host the backend on **Railway**, **Render**, or **Fly.io** and set `VITE_API_BASE` to that URL. The backend code in `backend/` needs **no changes** — just make sure:

- `NEXO_SECRET` env var is set (any long random string)
- The host allows CORS from your Vercel origin
- The `uploads/` directory has a persistent volume

---

## Files relevant to deployment

| File | Purpose |
|---|---|
| `frontend/vercel.json` | Vercel config: Vite framework, SPA rewrites |
| `frontend/.env.example` | Template for `VITE_API_BASE` |
| `frontend/src/api.js` | Uses `import.meta.env.VITE_API_BASE` to build request URLs |
| `.gitignore` | Keeps `node_modules/`, `.env`, `*.db`, and `uploads/` out of git |

---

## Smoke test before deploying

```bash
cd frontend
npm run build          # should produce dist/ with index.html + assets/
npm run preview        # serves the production build at http://localhost:4173
```

Visit http://localhost:4173 — you should see the Login screen exactly as it will appear on Vercel.
