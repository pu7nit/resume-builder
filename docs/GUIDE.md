# Resume Forge — Operations Guide

Everything you need to **start, reach and look after** your resume server: first run, everyday
commands, backups, port and password changes, and what to do when something breaks.

For how the code works internally, see [`PROJECT.md`](./PROJECT.md).

---

## 1. What you need

| To run with Docker (recommended) | To run without Docker          |
| -------------------------------- | ------------------------------ |
| Docker Desktop (running)         | Node.js 22.5 or newer          |
| A terminal in the project folder | A terminal in the project folder |
| Any modern browser               | Any modern browser             |

There is **nothing to install** beyond that: the app has zero npm dependencies, no build step
and no database server. Your resumes live in a single SQLite file.

Project folder (shortened to `resume-builder/` below):

```
C:\Users\jagana\Documents\resume-builder
```

---

## 2. Start it (Docker, five minutes)

Open a terminal **in the project folder** (PowerShell, Windows Terminal or Git Bash):

```powershell
cd C:\Users\jagana\Documents\resume-builder
docker compose up -d --build
```

Then open **<http://localhost:3000>**.

What the command does:

- `--build` builds the image from `Dockerfile` (first build pulls `node:24-bookworm-slim`, ~80 MB;
  later builds take seconds because the layer is cached).
- `-d` runs it in the background, so you get your terminal back.
- `docker compose ps` shows it as `Up … (healthy)` after about five seconds.

On the very first start the app seeds one resume with the content from your existing DOCX, titled
**“Jagana Ritvik — Data Analyst”**.

**Rebuild whenever the code changes** — `docker compose up -d` alone reuses the old image:

```powershell
docker compose up -d --build
```

### Optional: set a password first

```powershell
Copy-Item .env.example .env
notepad .env          # set APP_PASSWORD=something-only-you-know
docker compose up -d --build
```

Without an `.env` the app is open to anyone who can reach the port — fine on your own machine,
not fine on a shared network.

---

## 3. Start it without Docker

```powershell
cd C:\Users\jagana\Documents\resume-builder
npm start            # http://localhost:3000
```

- `npm start` — normal run.
- `npm run dev` — same, but restarts automatically when a server file changes (front-end files
  are served from disk, so a browser refresh is enough for those).
- `npm run verify` — runs the full check suite (source, 11 templates, live HTTP API). See §12.

Data goes to `.\data\resume-builder.db` instead of the Docker volume. You can run Docker and
non-Docker side by side only on different ports (`$env:PORT=3001; npm start`).

---

## 4. Accessing it

### On this computer

<http://localhost:3000>

### From your phone or another computer on the same Wi-Fi

1. Find this computer's LAN address: `ipconfig` → IPv4 Address, e.g. `192.168.1.42`.
2. Allow the port once through the Windows firewall (Docker Desktop usually prompts; if not,
   run PowerShell **as administrator**):

   ```powershell
   New-NetFirewallRule -DisplayName "Resume Forge 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

3. On the phone open `http://192.168.1.42:3000`.

Set `APP_PASSWORD` before doing this — otherwise anyone on the network can read and edit your
resumes. The app deliberately has no accounts, only that one shared password.

### Change the port

Edit `.env` (create it from `.env.example`):

```
APP_PORT=8080
```

Then `docker compose up -d --build` and use <http://localhost:8080>. The container always
listens on 3000 internally; `APP_PORT` is only the host side.

If the port is taken you will see *“port is already allocated”*. Check who holds it:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Get-Process -Id <pid>
```

### Password behaviour

| Situation | Result |
| --- | --- |
| `APP_PASSWORD` empty | No login; anyone with the URL is in. |
| `APP_PASSWORD` set | Login page first; API returns `401` without a session. |
| Change the password | All existing sessions stop working (the signing key is derived from it). |
| Session length | 30 days, renewed each login. |
| Forgot it | Set a new one in `.env` and `docker compose up -d --build`. |
| Too many wrong tries | 5 failures per minute per IP, then a 60-second cool-down. |
| Sign out | **⋯ → Log out**, or clear the site's cookies. |

Optional extra: `APP_SECRET` overrides the session signing key, so you can rotate sessions
without changing the password.

---

## 5. Everyday command cheat sheet

Run from the project folder.

| Task | Command |
| --- | --- |
| Start / update in background | `docker compose up -d --build` |
| Stop (data kept) | `docker compose down` |
| Restart | `docker compose restart` |
| Show status + health | `docker compose ps` |
| Follow logs | `docker compose logs -f` |
| Last 100 log lines | `docker compose logs --tail 100` |
| Open a shell inside the container | `docker compose exec resume-builder sh` |
| Quick health probe | `curl http://localhost:3000/healthz` |
| Open the database (SQL) | `docker compose exec resume-builder node -e "const{DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('/app/data/resume-builder.db').prepare('select id,title,updated_at from resumes').all())"` |
| Stop and **delete all resumes** | `docker compose down -v` |
| Rebuild from scratch | `docker compose build --no-cache` |
| Update the base image | `docker pull node:24-bookworm-slim` then rebuild |

`docker compose down` removes the container but keeps the `resume-builder_resume-data` volume.
`down -v` deletes the volume too — that is the "start over" button, and it is irreversible.

---

## 6. Where your data lives

| Setup | Location |
| --- | --- |
| Docker | Named volume `resume-builder_resume-data` mounted at `/app/data` |
| Without Docker | `resume-builder/data/` |

Inside either location:

```
resume-builder.db        the SQLite database (all resumes)
resume-builder.db-wal    write-ahead log — recent changes live here too
resume-builder.db-shm    shared-memory index
```

All three belong together: copying only the `.db` while the app is running can miss the newest
edits. To copy safely, stop the container first (see §7).

Inspect the volume without starting the app:

```powershell
docker volume inspect resume-builder_resume-data
```

---

## 7. Backups

Do **at least one** of these regularly. Your resume is text you can retype, but your edits,
templates and photos are not.

### A. Per-resume JSON export (recommended, works everywhere)

In the app: **⋯ → Export JSON backup**. You get `<resume-name>.json` containing the title, all
content and all design settings (template, palette, section order, hidden sections).

Restore later with **⋯ → Import JSON backup**. Import always creates a **new** resume, so it
cannot overwrite something by accident.

### B. Copy the whole database

```powershell
# 1. stop the app so the WAL is flushed
docker compose down

# 2. copy the volume's files out
docker run --rm -v resume-builder_resume-data:/data -v ${PWD}:/backup alpine `
  tar czf /backup/resume-backup.tar.gz -C /data .

# 3. start again
docker compose up -d
```

Restore by reversing it (stop the app first, extract into the volume, start):

```powershell
docker compose down
docker run --rm -v resume-builder_resume-data:/data -v ${PWD}:/backup alpine `
  sh -c "rm -rf /data/* && tar xzf /backup/resume-backup.tar.gz -C /data"
docker compose up -d
```

Without Docker, just stop the server and copy `data/` (`resume-builder.db*`).

### C. Move to another computer

Copy the project folder, then either import your JSON exports there, or restore a database
backup as above. The image carries no user data, only code.

---

## 8. Managing resumes in the app

| Action | Where |
| --- | --- |
| Switch resume | Dropdown in the top bar |
| Rename | Edit the title field in the top bar (autosaves) |
| New blank resume | `+` next to the dropdown |
| Duplicate (keep a variant per job) | `⧉` |
| Delete | `✕` (asks for confirmation) |
| Backup / restore | `⋯` menu |
| Edit content | **Content** tab — bullets one per line, skills comma-separated |
| Template, palette, typeface, density | **Design & sections** tab |
| Hide or reorder a section | **Design & sections → Sections** |
| Add a photo | **Content → Basics → Upload photo** (resized to 720 px, stored in the resume) |
| Save now | `Ctrl/Cmd + S`; otherwise saves ~0.7 s after you stop typing |
| See save state | Top-right label: *Unsaved changes / Saving… / Saved 2 min ago* |

The page-count chip above the preview is an estimate; the print engine does the real pagination.

---

## 9. Exporting a PDF

1. Click **Export PDF** (or `Ctrl/Cmd + P`).
2. In the print dialog choose **Save as PDF** / **Microsoft Print to PDF**.
3. Match the paper size to the app: **A4** unless you set US Letter in Design.
4. Keep margins on **Default** (the app already sets its own 11–14 mm page margins).
5. Turn **Background graphics** on if you want the accent colour, sidebars and bands printed.

If no sections appear or the wrong page shows, cancel and press `Ctrl/Cmd + R` to reload, then
export again — the print view is generated from the current preview.

---

## 10. Health, logs and monitoring

- **Liveness endpoint:** `GET /healthz` → `{"ok":true,"uptime":42}`. No auth required.
- **Docker healthcheck:** built into the image, every 30 s. `docker compose ps` shows
  `(healthy)` or `(unhealthy)`; `docker inspect --format ...` shows the last result.
- **Startup log:** should contain `listening on http://localhost:3000`, the database path and
  whether a password is required.
- **Errors:** 5xx responses log with `[error]` and the method + path. Client-side errors are in
  the browser console (F12).

---

## 11. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `port is already allocated` | Something else holds 3000 — often an earlier dev server. Stop it, or set `APP_PORT=8080`. |
| `Cannot connect to the Docker daemon` | Start Docker Desktop and wait for “Engine running”. |
| Page loads but is unstyled / empty | Hard reload (`Ctrl + Shift + R`); the browser cached an old `app.js`. |
| `Saved` label stuck on “Unsaved changes” | The request failed — check `docker compose logs`, then press `Ctrl/Cmd + S`. |
| `401 Unauthorized` in the console | Password is set and your session expired: reload to get the login page. |
| Login says “Too many attempts” | 5 wrong passwords per minute per IP — wait 60 seconds. |
| Healthcheck flapping | Disk full or `data` volume unwritable; check `docker volume inspect` and free space. |
| PDF is blank / only part of the resume | Reload, then print; keep “Background graphics” on for colour templates. |
| Photo missing after switching template | Only Slate, Executive, Band and Creative use photos; upload it in Basics. |
| Bars/dots missing | Those layouts need **Proficiency** set per skill group (Design-adjacent field in Skills). |
| Resume looks like it starts mid-page | Template uses a sidebar; print applies its own margins. Check page size matches. |
| Container starts then exits | `docker compose logs` — usually an unwritable `/app/data`; `docker compose down -v` recreates the volume. |
| Can't reach it from phone | Firewall rule missing, or you used `localhost` on the phone (use the LAN IP). |

---

## 12. Verifying a deployment

The project ships its own check suite:

```powershell
npm run verify
```

It checks syntax of every JS file, CSS balance, Docker Compose validity, all 11 templates
(including photo, references, visibility and contrast behaviour) and — when a server is
reachable — the whole HTTP API: CRUD, validation, security headers, static files and cleanup.
It creates and removes its own test resumes.

Point it at a container or another host:

```powershell
$env:BASE_URL="http://127.0.0.1:3200"; npm run verify
```

Skip the HTTP part: `node scripts/verify.mjs --offline`.

---

## 13. Security checklist

- [ ] `APP_PASSWORD` set before the port leaves your machine.
- [ ] Not exposed straight to the internet — put Caddy/nginx in front for HTTPS, or use a VPN.
- [ ] Backups stored somewhere private; a JSON export is your personal data in clear text.
- [ ] `APP_SECRET` set if you want to invalidate sessions without changing the password.
- [ ] Docker Desktop's “expose to LAN” kept off unless you actually need phone access.

The app already sets a strict CSP, `X-Frame-Options: DENY`, `nosniff`, no-referrer, refuses
cross-origin writes, keeps sessions HttpOnly/SameSite, and confines static file serving to
`public/`.

---

## 14. Moving house / running two instances

Different ports, different volumes — edit a copy of `docker-compose.yml` or use a project name:

```powershell
docker compose -p resume-work up -d --build      # separate container, separate volume
```

That gives you an isolated second instance (e.g. a “tailored to a specific job” set) on a
different `APP_PORT`, with no shared data.

To move everything to a new machine: copy the folder, copy your JSON exports (or the volume
backup), `docker compose up -d --build`, import.

---

## 15. FAQ

**Do I need to keep the terminal open?** No with `-d`; Docker keeps it running until you stop it
or reboot. Docker Desktop can start on login.

**Does it work offline?** Yes — no fonts, analytics or CDNs are fetched. Only the browser and
your machine.

**Can two people edit at once?** Technically yes, but last write wins per resume; the editor
overwrites the whole document. Use separate resumes for parallel work.

**Where is the password stored?** Only in `.env` / the container's environment, never in the
database or the repo. Sessions are signed cookies, not stored server-side.

**How do I remove everything?** `docker compose down -v` deletes the container and its volume.
To delete the app itself, remove the `resume-builder` folder and `docker rmi resume-builder:latest`.

**Is my data in the Docker image?** No. The image contains code only; resumes live in the volume.
