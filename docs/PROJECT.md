# Resume Forge — Complete Project Documentation

This document explains **everything** in the project: how each file works, the data model, the
HTTP API, the authentication layer, the frontend state machine, all eleven templates, the CSS
system, the container setup, and how to extend or verify it.

If you only want to run the thing, read [`GUIDE.md`](./GUIDE.md) instead.

---

## 1. What it is, and the decisions behind it

A single-user resume builder. You edit structured fields on the left, an A4 page renders on the
right, and you export PDF through the browser's print dialog. Everything is stored in one SQLite
file that Docker keeps on a named volume.

Four decisions shape the whole codebase:

| Decision | Why | Consequence |
| --- | --- | --- |
| **Zero npm dependencies** | No supply-chain surface, no lockfile drift, instant installs | `package.json` has no `dependencies`; server uses `node:http`, `node:sqlite`, `node:crypto`, `node:fs`, `node:path` |
| **No build step** | The code you edit is the code that runs | `public/*.js` are plain ES modules loaded with `<script type="module">` |
| **PDF via the print engine** | Output matches the preview exactly, no headless Chromium in the image | `@media print` CSS + a dynamically injected `@page` rule |
| **Data as one JSON document per resume** | Schema changes never need a migration | `resumes.data` and `resumes.settings` are JSON text columns; the client normalises on load |

Requirements: **Node 22.5+** (for `node:sqlite`), Node 24 recommended and used in the image.
Any modern browser (Chromium, Firefox, Safari 16+). Docker Desktop if you use containers.

---

## 2. Repository map

```
resume-builder/
├─ package.json              Metadata, scripts (start, dev, verify, docker:*)
├─ server.js                 HTTP server: routing, static files, API, security headers, shutdown
├─ src/
│  ├─ db.js                  SQLite storage layer (node:sqlite) + first-run seeding
│  ├─ auth.js                Optional password gate: HMAC-signed session cookie
│  └─ seed.js                The first resume's content (extracted from the DOCX)
├─ public/
│  ├─ index.html             App shell: top bar, editor pane, preview pane, toast, print hook
│  ├─ app.js                 Client controller: editor rendering, autosave, import/export, events
│  ├─ resume-templates.js    Eleven print layouts + template metadata and palettes
│  ├─ styles.css             Design system, editor UI, all resume layouts, print rules
│  ├─ login.html             Password page shell
│  ├─ login.js               Password form logic
│  └─ favicon.svg            Inline SVG icon
├─ scripts/
│  └─ verify.mjs             Source + template + HTTP verification suite
├─ docs/
│  ├─ GUIDE.md               Operations guide (start, access, manage, back up)
│  └─ PROJECT.md             This document
├─ Dockerfile                node:24-bookworm-slim, non-root, healthcheck
├─ docker-compose.yml        Service + named volume + optional password
├─ .dockerignore             Keeps data, env files and git out of the build context
├─ .gitignore                Ignores local data, WAL files, .env
├─ .env.example              Documented compose variables
└─ README.md                 Short overview + quick start
```

Generated at runtime (never committed, never in the image):

```
data/resume-builder.db       SQLite database (local, non-Docker runs)
data/resume-builder.db-wal   Write-ahead log
data/resume-builder.db-shm   Shared-memory index
```

---

## 3. Server lifecycle (`server.js`)

### Boot

1. Read environment: `PORT` (default `3000`), `HOST` (`0.0.0.0`), `DATA_DIR` (default `./data`).
2. `initDb(DATA_DIR/resume-builder.db)` — creates the directory, opens SQLite, enables WAL,
   creates the `resumes` table, and seeds one resume **only if the table is empty**.
3. `http.createServer(...)` starts listening. Three log lines confirm the port, the database path
   and whether a password is required.

### Every request

```
request
  → parse URL (bad URL → 400 plain text)
  → applySecurityHeaders()
  → /healthz            → {"ok":true,"uptime":n}
  → /api/*              → handleApi()
  → everything else     → handleStatic()
  → thrown errors       → JSON {error} with the error's status, 500 if unset
```

Static files are resolved with `path.resolve(PUBLIC_DIR, relativePath)` after stripping leading
slashes, then checked with `target.startsWith(PUBLIC_DIR + path.sep)`. This is what stops
`/%2e%2e%2fpackage.json` from escaping `public/` — and why the leading-slash strip matters on
Windows, where `/index.html` would otherwise resolve to `C:\index.html`.

Unknown paths return `404`; there is no SPA catch-all, because the app has exactly one route.

### Responses

`sendJson(res, status, payload, extraHeaders)` sets `Content-Type`, `Content-Length` and
`Cache-Control: no-store`. Static files get `Cache-Control: no-cache` (revalidate each load),
which is why editing a file and reloading shows changes immediately. Files are read from disk per
request — fine for a personal app, and it removes all build/cache complexity.

### Request bodies

`readJson(req)` streams the body, refuses anything over **1 MB** (`413`) and returns `400` for
invalid JSON. The 1 MB cap comfortably holds a resume with an embedded 720 px photo.

### Shutdown

`SIGTERM`/`SIGINT` close the server, close the database, exit 0 — with a 5-second forced exit
timer so `docker stop` never hangs. `docker compose down` therefore flushes the WAL cleanly.

---

## 4. Data model

### SQLite schema

```sql
CREATE TABLE IF NOT EXISTS resumes (
  id         TEXT PRIMARY KEY,   -- UUID v4
  title      TEXT NOT NULL,      -- display name, max 120 chars
  data       TEXT NOT NULL,      -- JSON: the resume content
  settings   TEXT NOT NULL,      -- JSON: template, palette, order, visibility
  created_at TEXT NOT NULL,      -- ISO 8601
  updated_at TEXT NOT NULL       -- ISO 8601, drives list ordering
);
```

Pragmas: `journal_mode = WAL`, `synchronous = NORMAL`. WAL gives fast writes and crash safety;
it also means recent changes may sit in `resume-builder.db-wal` until a checkpoint — relevant when
copying the database by hand (see GUIDE §7).

`src/db.js` exposes: `initDb`, `closeDb`, `listResumes`, `getResume`, `createResume`,
`duplicateResume`, `updateResume`, `deleteResume`. JSON is parsed on read with a safe fallback, so
a corrupt row yields `{}` rather than a crash. `updateResume` merges partial patches: only keys
present in the body are replaced.

### Resume document (the `data` column)

```jsonc
{
  "basics": {
    "name": "Jagana Ritvik",
    "headline": "Data Analyst · B.Tech Computer Science & Engineering",
    "email": "ritvikjagana655@gmail.com",
    "phone": "+91 88853 60071",
    "location": "Visakhapatnam, Andhra Pradesh, India",
    "website": "https://portfolio-jagana-ritvik.vercel.app",
    "photo": "",                       // data URL (JPEG, ≤720 px) or ""
    "links": [{ "label": "GitHub", "url": "https://github.com/pu7nit" }]
  },
  "summary": "Free text. Blank lines start a new paragraph.",
  "experience": [{
    "id": "uuid",
    "role": "Junior Data Analyst",
    "company": "Cognifyz Technologies",
    "location": "Remote",
    "start": "Mar 2026",
    "end": "",                        // ignored when current is true
    "current": true,
    "bullets": ["One achievement per string"]
  }],
  "projects": [{
    "id": "uuid", "name": "...", "tech": "...", "url": "...",
    "start": "...", "end": "...", "bullets": ["..."]
  }],
  "education": [{
    "id": "uuid", "degree": "...", "school": "...", "location": "...",
    "start": "...", "end": "...", "details": "CGPA 7.0"
  }],
  "skills": [{
    "id": "uuid", "group": "Data & Analytics",
    "items": ["SQL", "Power BI"],     // strings, or a comma string in legacy data
    "level": 5                        // 0 = unset, 1..5 = bar/dot length
  }],
  "certifications": [{ "id": "uuid", "name": "...", "issuer": "...", "date": "...", "url": "..." }],
  "languages": [{ "id": "uuid", "name": "English", "level": "Professional" }],
  "references": [{ "id": "uuid", "name": "...", "role": "...", "company": "...", "contact": "..." }]
}
```

Dates are **free text** (`"Mar 2026"`, `"2023"`, `"Present"`) rather than parsed dates: resumes
are written by hand and this avoids fighting date pickers or locale formats.

### Settings (the `settings` column)

```jsonc
{
  "template": "modern",        // one of the eleven ids
  "accent": "#0f766e",         // hex colour; drives headings/sidebars/bands/bars
  "font": "sans",              // sans | serif | mono
  "fontSize": 10.5,            // pt, clamped 8..13
  "density": "regular",        // regular | compact
  "pageSize": "a4",            // a4 | letter
  "sectionOrder": ["summary","experience","projects","education","skills","certifications","languages","references"],
  "hiddenSections": []         // keys omitted from the printed page
}
```

### Normalisation and migration (`normalizeResume` in `public/app.js`)

Every document is repaired as it is opened, so old or hand-edited data keeps working:

- missing arrays are created; `basics` is merged over defaults;
- `basics.photo` coerced to a string; `basics.links` to an array;
- `skills[].items` coerced to an array (a comma-separated string is split);
- `skills[].level` clamped to `0..5`;
- `settings.fontSize` clamped to `8..13`;
- `sectionOrder` passed through `normalizeOrder` (known keys only, missing keys appended);
- `hiddenSections` coerced to an array.

Because normalisation happens on read and save stores the normalised document, an old database
upgrades itself the first time each resume is edited.

### IDs

Resume IDs are `crypto.randomUUID()` values. Item IDs use `crypto.randomUUID()` when available,
falling back to `id-<timestamp>-<random>` on non-secure origins (plain HTTP on a LAN IP), where
`crypto.randomUUID` is unavailable. IDs are only used as React-style keys — the templates do not
depend on them.

---

## 5. HTTP API

All responses are JSON except static files and plain-text errors. Mutations (`POST`/`PUT`/`PATCH`/
`DELETE`) from a browser must carry an `Origin` header matching the host, otherwise `403`.
Identifiers must match `^[A-Za-z0-9-]{8,64}$` or the request is rejected with `400`.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/healthz` | none | `{ ok: true, uptime: seconds }` |
| `GET` | `/api/session` | none | `{ authEnabled, authenticated }` — used to show/hide Log out |
| `POST` | `/api/login` | none | `{ password }` → sets `rb_session` cookie, `200` or `401`; `429` while locked out |
| `POST` | `/api/logout` | none | Clears the cookie |
| `GET` | `/api/resumes` | session | `{ resumes: [{ id, title, updated_at }] }`, newest first |
| `POST` | `/api/resumes` | session | Create. Body `{ title, data?, settings? }` **or** `{ fromId }` to duplicate. `201` |
| `GET` | `/api/resumes/:id` | session | `{ resume: { id, title, data, settings, created_at, updated_at } }` |
| `PUT`/`PATCH` | `/api/resumes/:id` | session | Partial update of `title`, `data`, `settings`. `200` |
| `DELETE` | `/api/resumes/:id` | session | `{ ok: true }`, `404` if unknown |

Status codes used: `200`, `201`, `400` (bad id/JSON), `401` (no session), `403` (cross-origin),
`404` (unknown route/resume), `405` (wrong method on a static path), `413` (body > 1 MB),
`429` (login rate limit), `500` (unexpected).

Example:

```bash
curl -s http://localhost:3000/api/resumes
curl -s -X POST http://localhost:3000/api/resumes \
  -H 'content-type: application/json' \
  -d '{"title":"Backend role","data":{"basics":{"name":"Jagana Ritvik"}}}'
curl -s -X PUT http://localhost:3000/api/resumes/<id> \
  -H 'content-type: application/json' \
  -d '{"settings":{"template":"slate","accent":"#12473a"}}'
```

---

## 6. Authentication and security

### Password mode (`src/auth.js`)

Disabled when `APP_PASSWORD` is empty (the default, suited to localhost). When set:

- `POST /api/login` compares the submitted password with `crypto.timingSafeEqual` (length check
  first, so different-length inputs are rejected without timing leaks).
- On success it returns `rb_session=<expiry>.<hmac>` with `HttpOnly; SameSite=Lax; Path=/;
  Max-Age=2592000` (30 days).
- The HMAC is `HMAC-SHA256(APP_SECRET or sha256("resume-builder:"+password), expiry)` encoded
  base64url. Changing the password changes the key, so every existing session becomes invalid.
- `isAuthorized(req)` parses the cookie, re-computes the signature, compares with
  `timingSafeEqual`, and rejects expired tokens.
- Failed attempts: **5 per IP per 60 seconds**, then `429` with a readable retry message. The
  counter resets on success. State is in memory, so it resets when the container restarts.

Without a session, HTML requests get the login page and everything else gets `401`. Static assets
(`app.js`, `styles.css`) are still served so the login page can render; they contain no data.

### Hardening already in place

| Control | Implementation |
| --- | --- |
| CSRF | Mutations require a same-origin `Origin`; session cookie is `SameSite=Lax` |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Injection into HTML | All user text passes through `escapeHtml`/`esc` |
| Path traversal | Resolved path must stay inside `public/`; null bytes rejected |
| Payload abuse | 1 MB request cap |
| Indexing | `X-Robots-Tag: noindex, nofollow` + meta robots |
| Referrer leakage | `Referrer-Policy: no-referrer` |
| XSS | CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` — no inline scripts, no external origins; images allow `data:` for photos |
| Container | Runs as the unprivileged `node` user, `no-new-privileges` |

`'unsafe-inline'` for styles is required because the app sets CSS custom properties and a print
`<style>` block at runtime. It is the only relaxation.

### Limits of the model

One shared password, no accounts or roles, no audit log, no TLS. If you expose this to the
internet, terminate HTTPS in a reverse proxy (Caddy, nginx, Traefik) or keep it on a VPN.

---

## 7. Frontend architecture (`public/app.js`)

### Module structure

`index.html` loads `app.js` as a module; `app.js` imports the template engine:

```js
import { TEMPLATES, SECTION_KEYS, SECTION_LABELS, normalizeOrder, contrastInk, renderResume }
  from './resume-templates.js';
```

There is no framework and no virtual DOM. Rendering is explicit: build an HTML string, assign it,
then let event delegation handle interaction.

### State

```js
const state = {
  resumes: [],        // list metadata
  current: null,      // { id, title, data, settings, updated_at }
  view: 'content',    // content | design
  editVersion: 0,     // increments on every change
  savedVersion: 0,    // last version confirmed by the server
  saving: false,
  saveTimer: 0,
  previewTimer: 0,
  authEnabled: false,
};
```

`editVersion`/`savedVersion` are the heart of autosave: a save is only skipped when the two match,
so edits made while a request is in flight cannot be lost.

### Save pipeline

```
input/change → applyPathValue / applySetting → markDirty()
    markDirty: editVersion++, status "Unsaved changes", debounce 700 ms
    save(): if saving → retry in 400 ms
            if editVersion == savedVersion → nothing to do
            PUT { title, data, settings }
            on success: savedVersion = version; refresh list metadata
                        if editVersion moved on, schedule another save
            on failure: status "Save failed" + toast
```

Saves also fire on `Ctrl/Cmd+S` (immediately), on tab hide, and on `pagehide`, so closing the tab
does not lose the last keystrokes.

### Editor rendering

`renderEditor()` switches between `renderContent()` and `renderDesign()`. Structural changes
(add/remove/move item, add/remove link, template or accent change) re-render the editor; typing
does not (it would steal focus), only the preview updates.

Small builders keep markup consistent:

| Builder | Produces |
| --- | --- |
| `field(label, path, value, opts)` | labelled `<input>`, optional `data-list` mode, optional type (`email`, `tel`) |
| `area(...)` | `<textarea>` with optional `data-list="lines"`/`"csv"` |
| `checkbox(label, path, checked)` | boolean field |
| `card(title, note, body, actions)` | editor section panel |
| `itemShell(section, index, title, body)` | repeatable entry with move up/down/remove |
| `addButton(key, label)` | "+ Add …" button |
| `levelSelect(path, value)` | 0–5 proficiency dropdown |
| `photoPreview(basics)` | thumbnail or initials placeholder |

### Field binding (`data-path`)

Inputs carry `data-path="experience.2.bullets"`. On input, `setPath(obj, path, value)` walks and
assigns. Modes:

| Markup | Stored as |
| --- | --- |
| default | string as typed |
| `data-list="lines"` | array of non-empty lines (leading `-`, `•`, `*` stripped) |
| `data-list="csv"` | array of trimmed comma-separated values |
| `data-number="1"` | `Number(value)` |
| checkbox | boolean |
| `select` | string (or number with `data-number`) |

This is why bullets are "one per line" and skills are "comma separated".

### Photo pipeline

`#photo-input` (hidden) is triggered by the **Upload photo** button. On change, `applyPhoto`:

1. rejects non-images;
2. `resizeImage(file, 720)` reads the file with `FileReader`, draws it into a canvas scaled so the
   longest edge is ≤720 px (white background for transparent PNGs), and exports
   `toDataURL('image/jpeg', 0.86)` — typically 40–90 KB;
3. stores it in `data.basics.photo`, re-renders and saves.

Storing the image inside the resume keeps exports portable: the JSON backup carries the photo.

### Preview pipeline

```
renderPreview()
  → sets --page-w / --page-h / --pad from settings
  → writes @page { size; margin } into <style id="page-style">
  → sets --accent and --on-accent (contrast ink)
  → paper.innerHTML = renderResume(data, settings)
  → fitPreview(true)

fitPreview(force)
  → measures the pane width and the paper's unscaled height
  → zoom = clamp(availableWidth / 794px, 0.25, 1) applied as a CSS transform
  → sizes the frame to the scaled dimensions so the pane scrolls correctly
  → updates the page chip: ceil((height - 2·pad) / (pageHeight - 2·pad))
```

Page geometry is real: 210×297 mm for A4, 216×279 mm for Letter, converted to pixels at 96 dpi
(`96 / 25.4`). A `ResizeObserver` refits on window/pane changes, guarded by a width/height cache so
it cannot loop.

### Print

`Export PDF` calls `renderPreview()` then `window.print()`. The print stylesheet hides the app
chrome, removes the transform, drops paper padding, and lets `@page` supply the margins — so the
printed page has correct margins on every page, not just the first. `Ctrl/Cmd+P` works too.

### Backup format

```jsonc
{
  "app": "resume-builder",
  "version": 1,
  "title": "Jagana Ritvik — Data Analyst",
  "data": { /* resume document */ },
  "settings": { /* settings */ },
  "exported_at": "2026-11-11T13:00:00.000Z"
}
```

Import accepts this object, or a bare resume document; it always creates a new resume, never
overwrites.

---

## 8. Template engine (`public/resume-templates.js`)

### Metadata

```js
export const TEMPLATES = [
  { id: 'modern', name: 'Modern', note: '…', palette: ['#0f766e', …] },
  // … eleven entries
];
```

`palette` holds six colours offered for that template in the Design panel; any custom hex is also
allowed. Order in this array is the order in the picker.

### Contrast ink

`contrastInk(hex)` computes relative luminance and returns `#0b1220` (dark) for luminance > 0.2,
otherwise `#ffffff`. `app.js` stores it as `--on-accent`; sidebars, name bands and colour panels
use it for text, so a light mint or amber palette still reads correctly.

### Layout registry

`LAYOUTS` maps each template id to a function `(data, settings) → HTML`. `renderResume` picks the
layout, falls back to `flowLayout`, and returns an empty-state paragraph when there is nothing to
show.

Shared blocks used by the layouts:

| Block | Behaviour |
| --- | --- |
| `summaryBlock` | splits the summary on blank lines into paragraphs |
| `experienceBlock(mode)` | `role-first` (default), `comma`, `at` ("Role at Company, City"), `editorial` (company line + role line), `company-first` |
| `projectBlock` | name · tech · link, dates right, bullets |
| `educationBlock(mode)` | `inline` (degree · school · location) or `stacked` (degree + dates, school beneath) |
| `detailsBlock` | address/phone/email/website/links as label + value rows |
| `skillsRowsBlock` | two-column group + items (the classic look) |
| `skillsBarsBlock` | group name + five-segment bar from `level`, items beneath |
| `skillsDotsBlock` | group name + five dots from `level` |
| `skillsColumnsBlock` | flat skill list in three CSS columns |
| `languagesBlock(mode)` | `inline`, `bars` (maps "Native/Fluent/Professional/Intermediate/Basic"), `dots` |
| `certificationsBlock` | name · issuer with the date right |
| `referencesBlock` | two-column name / role / contact grid; skipped when empty |
| `bulletList` | `<ul>` of achievements |

All blocks return `''` when there is no data, and `section(label, inner)` returns `''` for empty
content and omits the heading when `label` is empty (the Banner layout's unlabelled summary).

### The eleven layouts

| id | Root classes | Structure |
| --- | --- | --- |
| `modern` | `.r-head` + sections | Single column, accent headings with a rule to the right edge |
| `classic` | same | Centred uppercase name, ruled headings, serif-friendly |
| `minimal` | same | Tight spacing, no rules |
| `slate` | `.rl-slate`, `.sl-side`, `.sl-main` | 36 % accent sidebar: photo, name, role, details, skills, languages; main column: profile, employment, projects, education, certifications, references |
| `executive` | `.ex-head`, `.ex-body` | Photo top-right, accent name and ruled headings, skills as newspaper columns, "Additional Information" with bold labels |
| `mono` | `.mo-head`, `.mo-cols` | Oversized uppercase name, 2px rule, 33 % data column with bars, main column |
| `editorial` | `.rl-editorial` | Serif throughout; name left, contact right; warm headings underlined; company-first history |
| `mint` | `.mi-head`, `.mi-cols` | Photo beside an accent name plate; 31 % side column with bars; main column |
| `banner` | `.ba-head`, `.ba-body` | Grey banner header (name left, contact right); single column below |
| `dots` | `.do-side`, `.do-main` | 30 % light side column with dotted ratings; bordered name box in the main column |
| `creative` | `.cr-hero`, `.cr-cols` | Portrait with two accent blobs, two-column body: main + 33 % details/skills/references |

Sidebar and band layouts give certain blocks a fixed home (details, skills, languages) because the
design requires it; everything else follows `sectionOrder`, and `hiddenSections` is honoured
everywhere.

### CSS architecture (`public/styles.css`)

Three layers in one file:

1. **App shell** — CSS custom properties for the dark UI (`--bg`, `--panel`, `--line`, `--accent`,
   `--muted`), top bar, editor cards, form controls, template picker, photo control, toast, login.
2. **Resume paper** — `.paper` with `--page-w`, `--page-h`, `--pad`, `--fs`, `--zoom`, `--accent`,
   `--on-accent`. Base typography (`r-head`, `r-name`, `r-section`, `r-h`, `r-item*`, `r-bullets`,
   `r-skill*`), then per-template overrides scoped to `.paper.tpl-*` or the layout root class.
   Shared engine pieces: `.rl-bar` (5 segments, `.on` filled), `.rl-dots`, `.rl-details`,
   `.rl-skill-*`, `.rl-references`, `.rl-skill-columns`, `.rl-photo`.
3. **Responsive + print** — desktop grid is editor | preview; under 900 px they stack; print hides
   the chrome, resets the transform, and preserves colour panels.

Units are physical (`mm`, `pt`, `em`) so the preview and the printed page match. Page breaks use
`break-inside: avoid` on entries and headings.

---

## 9. Editor UI (`renderContent`, `renderDesign`)

**Content tab** cards, in order: Basics (name/headline/email/phone/location/website, profile links,
photo), Summary, Experience, Projects, Education, Skills (group + proficiency + comma list),
Certifications, Languages, References. Every repeatable card has an add button; every entry has
↑ ↓ ✕.

**Design & sections tab**: eleven template tiles with miniature previews, the active template's
six-colour palette plus a custom colour input, typeface, density, paper size, font-size slider, and
the section list with visibility checkboxes and up/down arrows.

The colour input is a native `<input type="color">`; changing it writes the hex straight into
settings, and `contrastInk` immediately adjusts text colour.

---

## 10. Docker and deployment

### Dockerfile, line by line

```dockerfile
FROM node:24-bookworm-slim          # glibc, node:sqlite included, ~230 MB base
ENV NODE_ENV=production \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning \   # silences the node:sqlite notice
    PORT=3000 DATA_DIR=/app/data
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY public ./public                # no npm install — nothing to install
RUN mkdir -p /app/data && chown -R node:node /app
USER node                           # never runs as root
EXPOSE 3000
VOLUME ["/app/data"]                # anonymous volume if run without compose
HEALTHCHECK … node -e "fetch(.../healthz)…"   # every 30 s, 5 s timeout
CMD ["node", "server.js"]
```

Image size: ~331 MB on disk, mostly the Node base. There is no build stage because there is no
build.

### Compose

```yaml
services:
  resume-builder:
    build: .
    container_name: resume-builder
    restart: unless-stopped        # survives reboots/crashes
    init: true                     # PID 1 reaping
    ports: ["${APP_PORT:-3000}:3000"]
    environment:
      APP_PASSWORD: "${APP_PASSWORD:-}"
      TZ: "${TZ:-UTC}"
    volumes: [resume-data:/app/data]
    security_opt: [no-new-privileges:true]
volumes: { resume-data: }
```

`docker compose down` keeps the volume; `down -v` deletes the data. The container is named
`resume-builder`, the volume `resume-builder_resume-data`.

### Configuration reference

| Variable | Default | Read by | Effect |
| --- | --- | --- | --- |
| `PORT` | `3000` | `server.js` | HTTP port inside the container / locally |
| `HOST` | `0.0.0.0` | `server.js` | Bind address (use `127.0.0.1` for loopback-only) |
| `DATA_DIR` | `./data` | `server.js` | Directory holding `resume-builder.db` |
| `APP_PASSWORD` | empty | `src/auth.js` | Empty disables the gate; anything else requires login |
| `APP_SECRET` | derived | `src/auth.js` | Session signing key override |
| `APP_PORT` | `3000` | `docker-compose.yml` | Host port published |
| `TZ` | `UTC` | container | Timestamps in logs/health |

No secret ever lives in the repo; `.env` is gitignored and `.dockerignore`d.

---

## 11. Verification (`scripts/verify.mjs`)

```bash
npm run verify                                  # local server on :3000
BASE_URL=http://127.0.0.1:3100 npm run verify   # a container or remote host
node scripts/verify.mjs --offline               # no HTTP, template engine only
```

It covers:

1. **Source** — `node --check` on every JS file, `package.json` parses, CSS braces balanced,
   `docker compose config` valid.
2. **Template engine** — eleven layouts render against the seed data; no `undefined`/`NaN`, no
   empty headings, no empty-state fallback; palettes are six valid hex values; photos appear only
   in the four photo layouts; references render and disappear when empty; hidden sections are
   omitted; `normalizeOrder` behaviour; six contrast-ink cases.
3. **HTTP** — health, session, list, document shape, resume CRUD, duplicate, cross-origin refusal,
   invalid/missing IDs, static file content types, CSP/nosniff/frame headers, traversal and 404
   handling. It creates and deletes its own resumes, so it is safe against live data.

Exit code is non-zero if anything fails, which makes it suitable for CI or a cron health check.

Additional manual/automated checks performed during development: browser sweep of all eleven
templates with zero console errors, photo upload simulated through the real file input, section
hide/show, autosave persistence, password login flow inside Docker, and compose build/run on a
mapped port.

---

## 12. Maintenance recipes

### Add a section type

1. `public/resume-templates.js`: add the key to `SECTION_KEYS` and `SECTION_LABELS`.
2. Add a block builder (mirror `referencesBlock`) and place it in the layouts that should show it.
3. `public/app.js`: add the array to `blankData()`, a case in `newItem()`, and an editor card in
   `renderContent()`.
4. Add CSS only if the block needs bespoke styling; otherwise reuse `.r-item`/`.r-section`.
5. Run `npm run verify` (the section-order check expects every key to be present).

### Add a template

1. Append `{ id, name, note, palette }` to `TEMPLATES`.
2. Write `myLayout(data, settings)`, composing the shared blocks; add it to `LAYOUTS`.
3. Add `.paper.tpl-<id>`/`.rl-<id>` CSS, and a `.tpl-preview-<id>` miniature for the picker.
4. Run `npm run verify` — it will fail until the layout renders cleanly.

### Change the palette of a template

Edit its `palette` array. Nothing else — the Design panel and the swatch active state read from it.

### Add an API route

Add a branch in `handleApi()` before the `isAuthorized` guard for public routes, or after it for
protected ones. Validate IDs with `RESUME_ID`, read bodies with `readJson`, respond with
`sendJson`. Mutations are already origin-checked.

### Change the database schema

It is a one-table store, so adding a column means editing the `CREATE TABLE` in `initDb()` plus a
guarded `ALTER TABLE` for existing databases. Content changes do **not** need this: put them in the
JSON document and normalise them in `normalizeResume`.

### Reset a forgotten password

`docker compose down`, edit `APP_PASSWORD` in `.env`, `docker compose up -d --build`. Data is
untouched.

---

## 13. Data safety

- Writes are transactional per request; WAL protects against torn writes.
- The app never writes outside `DATA_DIR` and `public/` is read-only at runtime.
- Restarting or rebuilding the image does not touch the volume.
- Deleting the volume (`down -v`) is the only destructive built-in action; there is no undo.
- Exports are self-contained (content + settings + photo).

---

## 14. Known limits and trade-offs

| Limit | Reason / workaround |
| --- | --- |
| Single shared password, no multi-user | Deliberate for a personal tool; run separate instances/volumes for separate people |
| Last-write-wins editing | The whole document is replaced per save; two people editing one resume can overwrite each other |
| Page count is an estimate | Derived from content height; the print engine paginates for real |
| Sidebars do not repeat on page 2 | Inherent to a CSS panel; keep sidebar layouts to one page |
| Bars/dots rate skill **groups**, not items | Skills are stored as groups (see §4); per-item levels would need a data-shape change |
| No Hobbies block | Not modelled; would be another section type (see §12) |
| No drag-and-drop reordering | Up/down buttons keep it keyboard-accessible and dependency-free |
| Print fonts are system stacks | Guarantees offline operation; exact fonts vary slightly per OS |
| No server-side PDF render | Avoids shipping Chromium; the browser's PDF writer is used instead |

---

## 15. Glossary

| Term | Meaning here |
| --- | --- |
| **SQLite / WAL** | The single-file database and its write-ahead log. `-wal`/`-shm` belong with the `.db`. |
| **`node:sqlite`** | Node's built-in SQLite binding (experimental status, stable API use), which is why no npm package is needed. |
| **HMAC** | Keyed hash used to sign the session cookie so it cannot be forged. |
| **CSP** | Content-Security-Policy: restricts what the page may load; here everything is same-origin. |
| **`@page`** | CSS rule setting paper size and print margins. |
| **data URL** | `data:image/jpeg;base64,…` — the photo embedded in the resume JSON. |
| **Named volume** | Docker-managed storage that survives container rebuilds. |
| **Healthcheck** | Docker's periodic probe of `/healthz`. |
| **Normalisation** | Repairing a stored document into the current shape on read. |
| **Contrast ink** | Black or white text chosen from the accent's luminance. |

---

## 16. Decision log

| Date | Decision |
| --- | --- |
| Build 1 | Zero dependencies over Express/React: fewer moving parts, faster container builds |
| Build 1 | JSON document per resume instead of relational tables: schema changes are free |
| Build 1 | Print-to-PDF instead of headless Chromium: exact preview parity, small image |
| Build 1 | Optional single password: safe to expose on a LAN without a user system |
| Templates update | Eight new layouts recreated from reference designs, each with its own palette |
| Templates update | Added photo (data URL), references, and per-group proficiency to serve those layouts |
| Templates update | Added `scripts/verify.mjs` so the whole project can be re-checked in one command |
