# Resume Forge

A personal resume builder you own end to end: edit structured fields, watch an A4 page render
live, switch templates, and export a clean PDF from the browser's print dialog. Runs in Docker,
stores everything in SQLite on a volume, and has zero npm dependencies.

## Documentation

- **[docs/GUIDE.md](docs/GUIDE.md)** — how to start, access, back up and manage the server
  (day-to-day operations, ports, passwords, troubleshooting).
- **[docs/PROJECT.md](docs/PROJECT.md)** — complete technical documentation: every file, the data
  model, the HTTP API, authentication, the template engine and the CSS system.

Check the whole project at any time with `npm run verify` (source, templates and the live API).

## Features

- **Live paper preview** — true A4 / US Letter geometry, page-fit zoom and a page-count estimate.
- **Eleven templates** — Modern, Classic and Minimal are single-column; Slate, Executive,
  Monochrome, Editorial, Band, Banner, Dots and Creative bring sidebars, photo headers,
  accent bands, skill bars and dotted ratings. Every template ships its own colour palette,
  and typeface (sans / serif / mono), font size and compact density work on top.
- **Photo** — upload a portrait in Basics; it is resized in the browser, stored inside the
  resume and used by the Slate, Executive, Band and Creative layouts.
- **References** — an optional block that the templates skip when it is empty.
- **Proficiency levels** — 1–5 per skill group and per language, driving the bars and dots in
  the Monochrome, Band and Dots layouts.
- **Structured editor** — basics + profile links + photo, summary, experience, projects,
  education, grouped skills, certifications, languages and references. Reorder or hide any
  section.
- **Autosave** — changes persist to SQLite after a short debounce; `Ctrl/Cmd + S` saves immediately.
- **Multiple resumes** — create, duplicate and delete documents (e.g. one per role).
- **PDF export** — `Export PDF` opens the print dialog with the resume already isolated and
  paginated; choose "Save as PDF".
- **JSON backup / restore** — download the current resume and re-import it later or on another machine.
- **Optional password** — set `APP_PASSWORD` to gate the whole app with a signed session cookie.
- **No build step, no npm packages** — plain ES modules and Node's built-in `http` + `sqlite`.

## Quick start (Docker)

```bash
cd resume-builder
docker compose up -d --build
```

Open <http://localhost:3000>. The first launch seeds a resume with the content from
`Ritvik Jagana - Data Analyst Resume.docx`, so you start from real material.

Stop it with `docker compose down`. Data survives in the `resume-data` volume; `docker compose
down -v` deletes the resumes too.

### Require a password

```bash
cp .env.example .env
# edit .env and set APP_PASSWORD=something-only-you-know
docker compose up -d --build
```

Sessions last 30 days and are signed with `APP_SECRET` (derived from the password if unset, so
changing the password signs everyone out). Failed attempts are limited to 5 per minute per IP.

### Change the host port

Set `APP_PORT` in `.env` (e.g. `APP_PORT=8080`) or run `docker compose up -d --build` after
editing the compose file.

## Run without Docker

Node 22.5+ is required (Node 24 recommended — `node:sqlite` ships with it).

```bash
cd resume-builder
npm start          # http://localhost:3000
npm run dev        # same, with --watch restarts
```

Local data is written to `./data/resume-builder.db`.

## Using it

1. **Content** tab — fill in the sections. In multi-value fields, bullets are *one per line* and
   skills are *comma separated*.
2. **Design & sections** tab — pick a template, accent and typeface; hide sections you don't need
   for a given application.
3. **Export PDF** — the print dialog opens on the resume only. In Chrome/Edge choose
   *Save as PDF*, paper size A4 (or Letter to match the setting), margins **Default** and
   **Background graphics** on if you want the accent colour in headings.
4. **⋯ menu** — JSON backup, JSON import, open in a new tab, log out.

## Templates

Pick a template in **Design & sections**; the swatches below it change to that template's own
palette, and any custom colour can be used as well.

| Template    | Layout                                                                     |
| ----------- | -------------------------------------------------------------------------- |
| Modern      | Accent headings with a rule that runs to the right edge                     |
| Classic     | Centred uppercase header, ruled section headings                            |
| Minimal     | Tight, quiet, no rules                                                      |
| Slate       | Full-height colour sidebar with photo, details and skills                   |
| Executive   | Portrait photo header, tinted headings, skills in newspaper columns         |
| Monochrome  | Oversized two-line name, data column, five-segment skill bars               |
| Editorial   | Serif type, warm headings, company-first history                            |
| Band        | Photo beside a solid colour name plate, bars in the side column             |
| Banner      | Grey name banner with contact details, single column below                  |
| Dots        | Boxed name, light side column with dotted skill ratings                     |
| Creative    | Large portrait with shape accents, experience and details side by side       |

Layouts place some blocks in a fixed position (a sidebar, a header band) but still honour the
section visibility you set, and the main column follows your section order.

## Configuration

| Variable       | Default        | Purpose                                                        |
| -------------- | -------------- | -------------------------------------------------------------- |
| `PORT`         | `3000`         | Port inside the container / locally.                            |
| `HOST`         | `0.0.0.0`      | Bind address.                                                   |
| `DATA_DIR`     | `./data`       | Directory for `resume-builder.db` (mounted volume in Docker).   |
| `APP_PASSWORD` | _(empty)_      | If set, a password is required. Empty means open access.        |
| `APP_SECRET`   | derived        | Optional override for the session-cookie signing key.           |
| `APP_PORT`     | `3000`         | Compose only: host port to publish.                             |
| `TZ`           | `UTC`          | Container timezone used for "last edited" labels.               |

## Project layout

```
resume-builder/
├─ server.js           HTTP server, routing, auth gate, static files
├─ src/
│  ├─ db.js            SQLite storage (node:sqlite) + seed on first run
│  ├─ auth.js          Password check, HMAC session cookie
│  └─ seed.js          Initial resume content
├─ public/
│  ├─ index.html        App shell (topbar, editor, preview)
│  ├─ app.js            Editor rendering, preview, autosave, import/export
│  ├─ resume-templates.js  The eleven layouts + per-template colour palettes
│  ├─ styles.css        App UI + resume paper templates + print rules
│  ├─ login.html/.js   Password gate
│  └─ favicon.svg
├─ Dockerfile          node:24-bookworm-slim, non-root, healthcheck
├─ docker-compose.yml  Named volume, restart policy, optional password
└─ .env.example
```

## API

All endpoints return JSON. Mutations require a same-origin `Origin` header.

| Method   | Path                | Purpose                                                  |
| -------- | ------------------- | -------------------------------------------------------- |
| `GET`    | `/healthz`          | Liveness probe used by the Docker healthcheck.           |
| `GET`    | `/api/session`      | `{ authEnabled, authenticated }`.                        |
| `POST`   | `/api/login`        | `{ password }` → sets the session cookie.                |
| `POST`   | `/api/logout`       | Clears the session cookie.                               |
| `GET`    | `/api/resumes`      | List documents (id, title, updated_at).                  |
| `POST`   | `/api/resumes`      | Create — `{ title, data?, settings? }` or `{ fromId }`.  |
| `GET`    | `/api/resumes/:id`  | Full document.                                           |
| `PUT`    | `/api/resumes/:id`  | Update `{ title?, data?, settings? }`.                   |
| `DELETE` | `/api/resumes/:id`  | Delete a document.                                       |

## Notes and limits

- Single-user by design: one password, no accounts. If you expose it beyond your machine, set
  `APP_PASSWORD` — there is no other authentication layer.
- PDF export uses the browser's print engine rather than a server-side headless browser, so the
  output matches what you see and needs no Chromium in the image.
- The page-count chip is an estimate derived from content height; the print engine does the real
  pagination.
- Fonts are system stacks (Inter/Segoe/Georgia), so nothing is fetched from the network and the
  image works offline.
