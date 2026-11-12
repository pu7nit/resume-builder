/* =========================================================================
   Resume Forge client — editor, live preview, autosave, import/export
   Plain ES module, no build step and no third-party dependencies.
   ========================================================================= */

import {
  TEMPLATES,
  SECTION_KEYS,
  SECTION_LABELS,
  normalizeOrder,
  contrastInk,
  renderResume,
} from './resume-templates.js';

const state = {
  resumes: [],
  current: null,
  view: 'content',
  editVersion: 0,
  savedVersion: 0,
  saving: false,
  saveTimer: 0,
  previewTimer: 0,
  authEnabled: false,
};

const dom = {
  editor: document.getElementById('editor'),
  paper: document.getElementById('paper'),
  paperFrame: document.getElementById('paper-frame'),
  previewScroll: document.getElementById('preview-scroll'),
  resumeSelect: document.getElementById('resume-select'),
  titleInput: document.getElementById('title-input'),
  saveStatus: document.getElementById('save-status'),
  pageChip: document.getElementById('page-chip'),
  toast: document.getElementById('toast'),
  importFile: document.getElementById('import-file'),
  moreMenu: document.getElementById('more-menu'),
  moreBtn: document.getElementById('btn-more'),
  pageStyle: document.getElementById('page-style'),
  dirtyHint: document.getElementById('dirty-hint'),
};

/* ------------------------------- utilities ------------------------------- */

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function setPath(target, path, value) {
  const keys = path.split('.');
  let node = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (node[key] === null || typeof node[key] !== 'object') {
      node[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
}

function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}


function timeAgo(iso) {
  if (!iso) return 'just now';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 30) return 'just now';
  if (seconds < 90) return 'a minute ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

function slug(value) {
  return (
    String(value || 'resume')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'resume'
  );
}

/* --------------------------------- api ---------------------------------- */

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401) {
    window.location.reload();
    throw new Error('Session expired');
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

/* ------------------------------ data shapes ------------------------------ */

function blankData() {
  return {
    basics: { name: '', headline: '', email: '', phone: '', location: '', website: '', photo: '', links: [] },
    summary: '',
    experience: [],
    projects: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    references: [],
  };
}

function normalizeResume(resume) {
  const incoming = resume.data && typeof resume.data === 'object' ? resume.data : {};
  const data = {
    ...blankData(),
    ...incoming,
    basics: { ...blankData().basics, ...(incoming.basics || {}) },
    summary: typeof incoming.summary === 'string' ? incoming.summary : '',
  };
  data.basics.links = Array.isArray(data.basics.links) ? data.basics.links : [];
  data.basics.photo = typeof data.basics.photo === 'string' ? data.basics.photo : '';
  for (const key of SECTION_KEYS) {
    if (key === 'summary') continue;
    if (!Array.isArray(data[key])) data[key] = [];
  }
  data.skills = data.skills.map((group) => ({
    ...group,
    level: clamp(Number(group.level) || 0, 0, 5),
    items: Array.isArray(group.items)
      ? group.items
      : String(group.items || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
  }));

  const settings = {
    template: 'modern',
    accent: '#0f766e',
    font: 'sans',
    fontSize: 10.5,
    density: 'regular',
    pageSize: 'a4',
    sectionOrder: SECTION_KEYS.slice(),
    hiddenSections: [],
    ...(resume.settings && typeof resume.settings === 'object' ? resume.settings : {}),
  };
  settings.sectionOrder = normalizeOrder(settings.sectionOrder);
  settings.hiddenSections = Array.isArray(settings.hiddenSections) ? settings.hiddenSections : [];
  settings.fontSize = clamp(Number(settings.fontSize) || 10.5, 8, 13);

  return { ...resume, data, settings };
}

function newItem(key) {
  switch (key) {
    case 'experience':
      return { id: uid(), role: '', company: '', location: '', start: '', end: '', current: false, bullets: [] };
    case 'projects':
      return { id: uid(), name: '', tech: '', url: '', start: '', end: '', bullets: [] };
    case 'education':
      return { id: uid(), degree: '', school: '', location: '', start: '', end: '', details: '' };
    case 'skills':
      return { id: uid(), group: '', items: [], level: 0 };
    case 'certifications':
      return { id: uid(), name: '', issuer: '', date: '', url: '' };
    case 'languages':
      return { id: uid(), name: '', level: '' };
    case 'references':
      return { id: uid(), name: '', role: '', company: '', contact: '' };
    default:
      return { id: uid() };
  }
}

/* ------------------------------ bootstrapping ---------------------------- */

async function init() {
  bindEvents();

  try {
    const session = await api('GET', '/api/session');
    state.authEnabled = Boolean(session.authEnabled);
    $('btn-logout').hidden = !state.authEnabled;

    const { resumes } = await api('GET', '/api/resumes');
    state.resumes = resumes;

    if (!state.resumes.length) {
      const { resume } = await api('POST', '/api/resumes', { title: 'My resume', data: blankData() });
      state.resumes = [{ id: resume.id, title: resume.title, updated_at: resume.updated_at }];
    }

    const lastId = localStorage.getItem('rb:last');
    const target = state.resumes.find((r) => r.id === lastId) || state.resumes[0];
    await openResume(target.id);
    renderSwitcher();
  } catch (error) {
    dom.editor.innerHTML = `<div class="card"><p class="empty">Could not load your resumes: ${escapeHtml(
      error.message
    )}</p></div>`;
    toast(error.message, 'error');
  }
}

async function openResume(id) {
  const { resume } = await api('GET', `/api/resumes/${id}`);
  state.current = normalizeResume(resume);
  state.editVersion = 0;
  state.savedVersion = 0;
  localStorage.setItem('rb:last', id);

  dom.titleInput.value = state.current.title || '';
  renderSwitcher();
  renderEditor();
  renderPreview();
  setStatus('idle');
}

/* -------------------------------- saving -------------------------------- */

function setStatus(kind) {
  const label = {
    idle: state.current ? `Saved ${timeAgo(state.current.updated_at)}` : 'Ready',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    saved: `Saved ${timeAgo(state.current && state.current.updated_at)}`,
    error: 'Save failed',
  }[kind];
  dom.saveStatus.dataset.state = kind;
  dom.saveStatus.textContent = label || '';
  if (dom.dirtyHint) dom.dirtyHint.textContent = kind === 'dirty' ? '•' : '';
}

function markDirty() {
  state.editVersion += 1;
  setStatus('dirty');
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(() => {
    void save();
  }, 700);
}

async function save() {
  if (!state.current) return;
  if (state.saving) {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => {
      void save();
    }, 400);
    return;
  }
  if (state.editVersion === state.savedVersion) {
    setStatus('saved');
    return;
  }

  const version = state.editVersion;
  state.saving = true;
  setStatus('saving');

  try {
    const { resume } = await api('PUT', `/api/resumes/${state.current.id}`, {
      title: state.current.title,
      data: state.current.data,
      settings: state.current.settings,
    });

    state.current.updated_at = resume.updated_at;
    state.savedVersion = version;

    const meta = state.resumes.find((r) => r.id === resume.id);
    if (meta) {
      meta.title = resume.title;
      meta.updated_at = resume.updated_at;
    }
    state.resumes.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    renderSwitcher();

    if (state.editVersion === version) {
      setStatus('saved');
    } else {
      setStatus('dirty');
      state.saveTimer = window.setTimeout(() => {
        void save();
      }, 400);
    }
  } catch (error) {
    setStatus('error');
    toast(`Save failed — ${error.message}`, 'error');
  } finally {
    state.saving = false;
  }
}

async function flushSave() {
  window.clearTimeout(state.saveTimer);
  if (state.current && state.editVersion !== state.savedVersion) await save();
}

/* ------------------------------ editor view ------------------------------ */

function renderSwitcher() {
  const currentId = state.current ? state.current.id : '';
  dom.resumeSelect.innerHTML = state.resumes
    .map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.title || 'Untitled resume')}</option>`)
    .join('');
  if (currentId) dom.resumeSelect.value = currentId;
}

function renderEditor() {
  if (!state.current) return;
  dom.editor.innerHTML = state.view === 'content' ? renderContent() : renderDesign();
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.view === state.view);
  });
}

/* form primitives */

function field(label, path, value, options = {}) {
  const hint = options.hint ? `<em>${escapeHtml(options.hint)}</em>` : '';
  const mode = options.mode ? ` data-list="${options.mode}"` : '';
  return `<label class="field"><span>${escapeHtml(label)}${hint}</span>
    <input type="${options.type || 'text'}" data-path="${escapeHtml(path)}"${mode} value="${escapeHtml(
    value ?? ''
  )}" placeholder="${escapeHtml(options.placeholder || '')}" autocomplete="off" spellcheck="false" /></label>`;
}

function area(label, path, value, options = {}) {
  const mode = options.mode ? ` data-list="${options.mode}"` : '';
  const hint = options.hint ? `<em>${escapeHtml(options.hint)}</em>` : '';
  const labelHtml = label ? `<span>${escapeHtml(label)}${hint}</span>` : '';
  return `<label class="field">${labelHtml}
    <textarea rows="${options.rows || 3}" data-path="${escapeHtml(path)}"${mode} placeholder="${escapeHtml(
    options.placeholder || ''
  )}">${escapeHtml(value ?? '')}</textarea></label>`;
}

function checkbox(label, path, checked) {
  return `<label class="check"><input type="checkbox" data-path="${escapeHtml(path)}" ${
    checked ? 'checked' : ''
  } /><span>${escapeHtml(label)}</span></label>`;
}

function card(title, note, body, actions = '') {
  return `<section class="card">
    <header class="card-head">
      <div><h2>${escapeHtml(title)}</h2>${note ? `<p>${escapeHtml(note)}</p>` : ''}</div>
      ${actions}
    </header>
    ${body}
  </section>`;
}

function itemShell(sectionKey, index, title, body) {
  return `<div class="item">
    <div class="item-head">
      <span class="item-title">${escapeHtml(title)}</span>
      <div class="item-actions">
        <button type="button" class="icon-btn" data-action="move-item" data-section="${sectionKey}" data-index="${index}" data-dir="-1" title="Move up">↑</button>
        <button type="button" class="icon-btn" data-action="move-item" data-section="${sectionKey}" data-index="${index}" data-dir="1" title="Move down">↓</button>
        <button type="button" class="icon-btn danger" data-action="remove-item" data-section="${sectionKey}" data-index="${index}" title="Remove">✕</button>
      </div>
    </div>
    <div class="item-body">${body}</div>
  </div>`;
}

function addButton(key, label) {
  return `<button type="button" class="btn tiny" data-action="add-item" data-value="${key}">+ ${escapeHtml(label)}</button>`;
}

function levelSelect(path, value) {
  const current = Number(value) || 0;
  const options = [
    [0, 'Not set'],
    [1, '1 — basic'],
    [2, '2'],
    [3, '3 — working'],
    [4, '4'],
    [5, '5 — expert'],
  ]
    .map(
      ([level, label]) =>
        `<option value="${level}" ${current === level ? 'selected' : ''}>${label}</option>`
    )
    .join('');
  return `<label class="field"><span>Proficiency <em>bars and dots</em></span><select data-path="${escapeHtml(
    path
  )}" data-number="1">${options}</select></label>`;
}

function photoPreview(basics) {
  if (hasText(basics.photo)) {
    return `<img class="photo-thumb" src="${escapeHtml(basics.photo)}" alt="Current photo" />`;
  }
  const initials =
    String(basics.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return `<span class="photo-thumb photo-thumb-empty">${escapeHtml(initials)}</span>`;
}

async function applyPhoto(file) {
  if (!file.type.startsWith('image/')) {
    toast('That file is not an image', 'error');
    return;
  }
  try {
    state.current.data.basics.photo = await resizeImage(file, 720);
    renderEditor();
    markDirty();
    renderPreview();
    toast('Photo added');
  } catch (error) {
    toast(`Could not use that image — ${error.message}`, 'error');
  }
}

function resizeImage(file, maxEdge) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('the file could not be read'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('the image could not be decoded'));
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- content view ---------- */

function renderContent() {
  const d = state.current.data;
  const b = d.basics;

  const linkRows = b.links.length
    ? b.links
        .map(
          (link, i) => `<div class="row-inline">
            <input type="text" data-path="basics.links.${i}.label" value="${escapeHtml(
            link.label || ''
          )}" placeholder="GitHub" spellcheck="false" />
            <input type="text" data-path="basics.links.${i}.url" value="${escapeHtml(
              link.url || ''
            )}" placeholder="https://github.com/you" spellcheck="false" />
            <button type="button" class="icon-btn danger" data-action="remove-link" data-index="${i}" title="Remove link">✕</button>
          </div>`
        )
        .join('')
    : '<p class="empty">No links yet — add LinkedIn, GitHub or a portfolio URL.</p>';

  const experience = d.experience.length
    ? d.experience
        .map((x, i) =>
          itemShell(
            'experience',
            i,
            x.role || x.company || `Role ${i + 1}`,
            `<div class="grid two">
              ${field('Role', `experience.${i}.role`, x.role, { placeholder: 'Data Analyst' })}
              ${field('Company', `experience.${i}.company`, x.company, { placeholder: 'Company name' })}
            </div>
            <div class="grid two">
              ${field('Start', `experience.${i}.start`, x.start, { placeholder: 'Mar 2026' })}
              ${field('End', `experience.${i}.end`, x.end, { placeholder: 'Apr 2026' })}
            </div>
            ${field('Location', `experience.${i}.location`, x.location, { placeholder: 'Remote / City' })}
            ${checkbox('Current role — show “Present” as the end date', `experience.${i}.current`, x.current)}
            ${area('Highlights', `experience.${i}.bullets`, (x.bullets || []).join('\n'), {
              mode: 'lines',
              rows: 4,
              hint: 'one per line',
              placeholder: 'What you built, the tools you used, the result.',
            })}`
          )
        )
        .join('')
    : '<p class="empty">No roles yet.</p>';

  const projects = d.projects.length
    ? d.projects
        .map((x, i) =>
          itemShell(
            'projects',
            i,
            x.name || `Project ${i + 1}`,
            `<div class="grid two">
              ${field('Project name', `projects.${i}.name`, x.name, { placeholder: 'Attendance System' })}
              ${field('Tech / tools', `projects.${i}.tech`, x.tech, { placeholder: 'React, Node.js, MongoDB' })}
            </div>
            <div class="grid two">
              ${field('Start', `projects.${i}.start`, x.start, { placeholder: 'Apr 2025' })}
              ${field('End', `projects.${i}.end`, x.end, { placeholder: 'May 2025' })}
            </div>
            ${field('Link', `projects.${i}.url`, x.url, { placeholder: 'https://github.com/you/project' })}
            ${area('Highlights', `projects.${i}.bullets`, (x.bullets || []).join('\n'), {
              mode: 'lines',
              rows: 3,
              hint: 'one per line',
            })}`
          )
        )
        .join('')
    : '<p class="empty">No projects yet.</p>';

  const education = d.education.length
    ? d.education
        .map((x, i) =>
          itemShell(
            'education',
            i,
            x.degree || x.school || `Education ${i + 1}`,
            `<div class="grid two">
              ${field('Degree', `education.${i}.degree`, x.degree, { placeholder: 'B.Tech, Computer Science' })}
              ${field('Institution', `education.${i}.school`, x.school, { placeholder: 'College or school' })}
            </div>
            <div class="grid two">
              ${field('Start', `education.${i}.start`, x.start, { placeholder: '2023' })}
              ${field('End', `education.${i}.end`, x.end, { placeholder: 'Present' })}
            </div>
            ${field('Location', `education.${i}.location`, x.location, { placeholder: 'City' })}
            ${field('Details', `education.${i}.details`, x.details, { placeholder: 'CGPA 7.0 / 94%' })}`
          )
        )
        .join('')
    : '<p class="empty">No education yet.</p>';

  const skills = d.skills.length
    ? d.skills
        .map((x, i) =>
          itemShell(
            'skills',
            i,
            x.group || `Group ${i + 1}`,
            `<div class="grid two">
              ${field('Group', `skills.${i}.group`, x.group, { placeholder: 'Data & Analytics' })}
              ${levelSelect(`skills.${i}.level`, x.level)}
            </div>
            ${field('Skills', `skills.${i}.items`, (x.items || []).join(', '), {
              hint: 'comma separated',
              mode: 'csv',
              placeholder: 'SQL, Power BI, Pandas',
            })}`
          )
        )
        .join('')
    : '<p class="empty">No skill groups yet.</p>';

  const certifications = d.certifications.length
    ? d.certifications
        .map((x, i) =>
          itemShell(
            'certifications',
            i,
            x.name || `Certificate ${i + 1}`,
            `<div class="grid two">
              ${field('Certificate', `certifications.${i}.name`, x.name, {
                placeholder: 'Google Data Analytics',
              })}
              ${field('Issuer', `certifications.${i}.issuer`, x.issuer, { placeholder: 'Coursera' })}
              ${field('Date', `certifications.${i}.date`, x.date, { placeholder: 'Dec 2025' })}
              ${field('Link', `certifications.${i}.url`, x.url, { placeholder: 'https://…' })}
            </div>`
          )
        )
        .join('')
    : '<p class="empty">No certificates yet.</p>';

  const languages = d.languages.length
    ? d.languages
        .map((x, i) =>
          itemShell(
            'languages',
            i,
            x.name || `Language ${i + 1}`,
            `<div class="grid two">
              ${field('Language', `languages.${i}.name`, x.name, { placeholder: 'English' })}
              ${field('Level', `languages.${i}.level`, x.level, { placeholder: 'Native / Fluent' })}
            </div>`
          )
        )
        .join('')
    : '<p class="empty">No languages yet.</p>';

  const references = d.references.length
    ? d.references
        .map((x, i) =>
          itemShell(
            'references',
            i,
            x.name || `Reference ${i + 1}`,
            `<div class="grid two">
              ${field('Name', `references.${i}.name`, x.name, { placeholder: 'Marisa Leeds' })}
              ${field('Role', `references.${i}.role`, x.role, { placeholder: 'General Manager' })}
              ${field('Company', `references.${i}.company`, x.company, { placeholder: 'Gold Coast Hotel' })}
              ${field('Contact', `references.${i}.contact`, x.contact, { placeholder: 'email or phone' })}
            </div>`
          )
        )
        .join('')
    : '<p class="empty">No references yet.</p>';

  return [
    card(
      'Basics',
      'The header block every template starts with.',
      `<div class="grid two">
        ${field('Full name', 'basics.name', b.name, { placeholder: 'Alex Morgan' })}
        ${field('Headline', 'basics.headline', b.headline, { placeholder: 'Data Analyst' })}
        ${field('Email', 'basics.email', b.email, { placeholder: 'you@email.com', type: 'email' })}
        ${field('Phone', 'basics.phone', b.phone, { placeholder: '+91 90000 00000', type: 'tel' })}
        ${field('Location', 'basics.location', b.location, { placeholder: 'City, Country' })}
        ${field('Website', 'basics.website', b.website, { placeholder: 'https://your-site.com' })}
      </div>
      <div class="sub-block">
        <div class="sub-head"><span>Profile links</span><button type="button" class="btn tiny" data-action="add-link">+ Add link</button></div>
        ${linkRows}
      </div>
      <div class="sub-block">
        <div class="sub-head"><span>Photo</span></div>
        <div class="photo-row">
          ${photoPreview(b)}
          <div class="photo-actions">
            <button type="button" class="btn tiny" data-action="pick-photo">Upload photo</button>
            ${b.photo ? '<button type="button" class="btn tiny" data-action="remove-photo">Remove photo</button>' : ''}
            <p class="empty">Used by Slate, Executive, Band and Creative.</p>
          </div>
        </div>
        <input type="file" id="photo-input" accept="image/*" hidden />
      </div>`
    ),
    card(
      'Summary',
      'Two or three lines on what you do and the role you want.',
      area('', 'summary', d.summary, {
        rows: 4,
        placeholder: 'Data analyst with a B.Tech in CSE…',
      })
    ),
    card('Experience', 'Roles, internships and freelance work.', experience, addButton('experience', 'Add role')),
    card('Projects', 'Things you built — with the outcome, not just the stack.', projects, addButton('projects', 'Add project')),
    card('Education', 'Degrees and schooling, newest first.', education, addButton('education', 'Add education')),
    card('Skills', 'Grouped so a recruiter can scan them.', skills, addButton('skills', 'Add group')),
    card('Certifications', 'Courses and certificates worth naming.', certifications, addButton('certifications', 'Add certificate')),
    card('Languages', 'Spoken languages and levels.', languages, addButton('languages', 'Add language')),
    card(
      'References',
      'People who can vouch for you. Templates that show them skip this block when empty.',
      references,
      addButton('references', 'Add reference')
    ),
  ].join('');
}

/* ---------- design view ---------- */

function renderDesign() {
  const s = state.current.settings;

  const options = (pairs, selected) =>
    pairs
      .map(
        ([value, label]) =>
          `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`
      )
      .join('');

  const templates = TEMPLATES.map(
    (t) => `<button type="button" class="tpl ${s.template === t.id ? 'is-active' : ''}" data-action="set-template" data-value="${t.id}">
      <span class="tpl-preview tpl-preview-${t.id}"><i></i><i></i><i></i></span>
      <strong>${escapeHtml(t.name)}</strong>
      <em>${escapeHtml(t.note)}</em>
    </button>`
  ).join('');

  const activeTemplate = TEMPLATES.find((t) => t.id === s.template) || TEMPLATES[0];
  const currentAccent = String(s.accent || '').toLowerCase();
  const swatches = activeTemplate.palette
    .map(
      (color) =>
        `<button type="button" class="swatch ${
          currentAccent === color.toLowerCase() ? 'is-active' : ''
        }" style="--sw:${color}" data-action="set-accent" data-value="${color}" aria-label="Accent ${color}" title="${color}"></button>`
    )
    .join('');

  const sections = s.sectionOrder
    .map(
      (key, i) => `<li>
        <label class="check"><input type="checkbox" data-action="toggle-section" data-value="${key}" ${
        s.hiddenSections.includes(key) ? '' : 'checked'
      } /><span>${escapeHtml(SECTION_LABELS[key])}</span></label>
        <div class="item-actions">
          <button type="button" class="icon-btn" data-action="move-section" data-value="${key}" data-dir="-1" ${
        i === 0 ? 'disabled' : ''
      } title="Move up">↑</button>
          <button type="button" class="icon-btn" data-action="move-section" data-value="${key}" data-dir="1" ${
        i === s.sectionOrder.length - 1 ? 'disabled' : ''
      } title="Move down">↓</button>
        </div>
      </li>`
    )
    .join('');

  return [
    card('Template', 'Pick the layout that matches the job you are applying to.', `<div class="tpl-grid">${templates}</div>`),
    card(
      'Look',
      `Colours suggested for ${activeTemplate.name}, plus type controls.`,
      `<div class="control">
        <span class="control-label">Accent</span>
        <div class="swatches">
          ${swatches}
          <label class="swatch custom" title="Custom accent">
            <input type="color" value="${escapeHtml(s.accent)}" data-setting="accent" aria-label="Custom accent colour" />
            <span>+</span>
          </label>
        </div>
      </div>
      <div class="grid two">
        <label class="field"><span>Typeface</span>
          <select data-setting="font">${options(
            [
              ['sans', 'Sans — clean'],
              ['serif', 'Serif — classic'],
              ['mono', 'Mono — technical'],
            ],
            s.font
          )}</select>
        </label>
        <label class="field"><span>Density</span>
          <select data-setting="density">${options(
            [
              ['regular', 'Regular'],
              ['compact', 'Compact — fit more'],
            ],
            s.density
          )}</select>
        </label>
        <label class="field"><span>Paper size</span>
          <select data-setting="pageSize">${options(
            [
              ['a4', 'A4 — 210 × 297 mm'],
              ['letter', 'US Letter — 8.5 × 11 in'],
            ],
            s.pageSize
          )}</select>
        </label>
        <label class="field"><span>Font size <em>${Number(s.fontSize)}pt</em></span>
          <input type="range" min="8" max="13" step="0.5" value="${Number(s.fontSize)}" data-setting="fontSize" data-number="1" />
        </label>
      </div>`
    ),
    card('Sections', 'Reorder or hide blocks. Hidden sections stay in your data.', `<ul class="sec-list">${sections}</ul>`),
  ].join('');
}

/* -------------------------------- actions -------------------------------- */

function onEditorInput(event) {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return;

  if (el.matches('[data-path]')) {
    applyPathValue(el);
    markDirty();
    queuePreview();
    return;
  }
  if (el.matches('[data-setting]')) {
    applySetting(el);
    markDirty();
    queuePreview();
  }
}

function onEditorChange(event) {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return;

  if (el.matches('#photo-input')) {
    const file = el.files && el.files[0];
    el.value = '';
    if (file) void applyPhoto(file);
    return;
  }

  if (el.matches('[data-path]')) {
    applyPathValue(el);
    markDirty();
    queuePreview();
    return;
  }
  if (el.matches('[data-setting]')) {
    applySetting(el);
    markDirty();
    queuePreview();
    return;
  }
  if (el.matches('[data-action="toggle-section"]')) {
    toggleSection(el.dataset.value);
  }
}

function applyPathValue(el) {
  let value;
  if (el.type === 'checkbox') {
    value = el.checked;
  } else if (el.dataset.list === 'lines') {
    value = el.value
      .split('\n')
      .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
      .filter(Boolean);
  } else if (el.dataset.list === 'csv') {
    value = el.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (el.dataset.number) {
    value = Number(el.value);
  } else {
    value = el.value;
  }
  setPath(state.current.data, el.dataset.path, value);
}

function applySetting(el) {
  const key = el.dataset.setting;
  let value = el.value;
  if (el.dataset.number) value = Number(value);
  if (key === 'fontSize') {
    value = clamp(Number(value) || 10.5, 8, 13);
    const label = el.closest('.field') && el.closest('.field').querySelector('em');
    if (label) label.textContent = `${value}pt`;
  }
  state.current.settings[key] = value;
}

function onEditorClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button || button.matches('input, select, textarea')) return;

  const action = button.dataset.action;
  const data = state.current.data;
  const index = Number(button.dataset.index);

  if (action === 'pick-photo') {
    const input = dom.editor.querySelector('#photo-input');
    if (input) input.click();
    return;
  }

  switch (action) {
    case 'add-link':
      data.basics.links.push({ label: '', url: '' });
      break;
    case 'remove-link':
      data.basics.links.splice(index, 1);
      break;
    case 'remove-photo':
      data.basics.photo = '';
      break;
    case 'add-item':
      data[button.dataset.value].push(newItem(button.dataset.value));
      break;
    case 'remove-item':
      data[button.dataset.section].splice(index, 1);
      break;
    case 'move-item':
      moveItem(button.dataset.section, index, Number(button.dataset.dir));
      break;
    case 'set-template':
      state.current.settings.template = button.dataset.value;
      break;
    case 'set-accent':
      state.current.settings.accent = button.dataset.value;
      break;
    case 'move-section':
      moveSection(button.dataset.value, Number(button.dataset.dir));
      break;
    default:
      return;
  }

  renderEditor();
  markDirty();
  renderPreview();
}

function moveItem(sectionKey, index, direction) {
  const list = state.current.data[sectionKey];
  const next = index + direction;
  if (!Array.isArray(list) || next < 0 || next >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(next, 0, item);
}

function moveSection(key, direction) {
  const order = state.current.settings.sectionOrder;
  const from = order.indexOf(key);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
}

function toggleSection(key) {
  const hidden = new Set(state.current.settings.hiddenSections);
  if (hidden.has(key)) hidden.delete(key);
  else hidden.add(key);
  state.current.settings.hiddenSections = [...hidden];
  markDirty();
  renderPreview();
}

/* -------------------------------- preview -------------------------------- */

let lastFit = { width: 0, height: 0 };

function queuePreview() {
  window.clearTimeout(state.previewTimer);
  state.previewTimer = window.setTimeout(renderPreview, 90);
}

function renderPreview() {
  if (!state.current) return;
  const { data, settings } = state.current;

  const root = document.documentElement;
  root.style.setProperty('--page-w', settings.pageSize === 'letter' ? '216mm' : '210mm');
  root.style.setProperty('--page-h', settings.pageSize === 'letter' ? '279mm' : '297mm');
  root.style.setProperty('--pad', settings.density === 'compact' ? '11mm' : '14mm');

  dom.pageStyle.textContent = `@page { size: ${
    settings.pageSize === 'letter' ? 'Letter' : 'A4'
  }; margin: ${settings.density === 'compact' ? '11mm' : '14mm'}; }`;

  dom.paper.className = `paper tpl-${settings.template} font-${settings.font} density-${settings.density}`;
  const accent = settings.accent || '#0f766e';
  dom.paper.style.setProperty('--accent', accent);
  dom.paper.style.setProperty('--on-accent', contrastInk(accent));
  dom.paper.style.setProperty('--fs', `${settings.fontSize}pt`);
  dom.paper.innerHTML = renderResume(data, settings);

  fitPreview(true);
}

function fitPreview(force = false) {
  const width = dom.previewScroll.clientWidth;
  const height = dom.paper.offsetHeight;
  if (!force && width === lastFit.width && height === lastFit.height) return;
  lastFit = { width, height };

  const natural = dom.paper.offsetWidth || 794;
  const available = width - 44;
  const zoom = available > 0 ? clamp(available / natural, 0.25, 1) : 1;

  document.documentElement.style.setProperty('--zoom', zoom.toFixed(4));
  dom.paperFrame.style.width = `${Math.round(natural * zoom)}px`;
  dom.paperFrame.style.height = `${Math.round(height * zoom)}px`;

  const pages = pageCount();
  dom.pageChip.textContent = pages === 1 ? '1 page' : `≈ ${pages} pages`;
  dom.pageChip.dataset.state = pages > 1 ? 'multi' : 'single';
}

function pageCount() {
  const settings = state.current ? state.current.settings : { pageSize: 'a4', density: 'regular' };
  const pxPerMm = 96 / 25.4;
  const pageHeight = (settings.pageSize === 'letter' ? 279 : 297) * pxPerMm;
  const padding = (settings.density === 'compact' ? 11 : 14) * pxPerMm;
  const usable = pageHeight - padding * 2;
  const content = dom.paper.offsetHeight - padding * 2;
  return Math.max(1, Math.ceil((content - 1) / usable));
}

/* ------------------------------ resume actions --------------------------- */

async function createBlankResume() {
  await flushSave();
  const { resume } = await api('POST', '/api/resumes', {
    title: 'Untitled resume',
    data: blankData(),
    settings: state.current ? { ...state.current.settings } : undefined,
  });
  state.resumes.unshift({ id: resume.id, title: resume.title, updated_at: resume.updated_at });
  await openResume(resume.id);
  dom.titleInput.focus();
  dom.titleInput.select();
  toast('New resume created');
}

async function duplicateCurrent() {
  if (!state.current) return;
  await flushSave();
  const { resume } = await api('POST', '/api/resumes', { fromId: state.current.id });
  state.resumes.unshift({ id: resume.id, title: resume.title, updated_at: resume.updated_at });
  await openResume(resume.id);
  toast('Duplicated');
}

async function deleteCurrent() {
  if (!state.current) return;
  const label = state.current.title || 'this resume';
  if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;

  const id = state.current.id;
  try {
    await api('DELETE', `/api/resumes/${id}`);
    state.resumes = state.resumes.filter((r) => r.id !== id);
    state.current = null;

    if (!state.resumes.length) {
      await createBlankResume();
      return;
    }
    await openResume(state.resumes[0].id);
    toast('Resume deleted');
  } catch (error) {
    toast(`Delete failed — ${error.message}`, 'error');
  }
}

function exportJson() {
  if (!state.current) return;
  const payload = {
    app: 'resume-builder',
    version: 1,
    title: state.current.title,
    data: state.current.data,
    settings: state.current.settings,
    exported_at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slug(state.current.title)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  toast('Backup downloaded');
}

async function importJson(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Unrecognised file');

    const { resume } = await api('POST', '/api/resumes', {
      title: parsed.title || `Imported ${new Date().toLocaleDateString()}`,
      data,
      settings: parsed.settings,
    });
    state.resumes.unshift({ id: resume.id, title: resume.title, updated_at: resume.updated_at });
    await openResume(resume.id);
    toast('Backup imported');
  } catch (error) {
    toast(`Import failed — ${error.message}`, 'error');
  }
}

function printResume() {
  renderPreview();
  window.print();
}

/* --------------------------------- toast --------------------------------- */

let toastTimer = 0;

function toast(message, kind = 'info') {
  dom.toast.textContent = message;
  dom.toast.dataset.state = kind;
  dom.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), 3200);
}

/* --------------------------------- events -------------------------------- */

function closeMenu() {
  dom.moreMenu.hidden = true;
  dom.moreBtn.setAttribute('aria-expanded', 'false');
}

function bindEvents() {
  dom.editor.addEventListener('input', onEditorInput);
  dom.editor.addEventListener('change', onEditorChange);
  dom.editor.addEventListener('click', (event) => {
    if (!state.current) return;
    onEditorClick(event);
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.view === state.view) return;
      state.view = tab.dataset.view;
      renderEditor();
    });
  });

  dom.resumeSelect.addEventListener('change', async (event) => {
    const id = event.target.value;
    if (!state.current || id === state.current.id) return;
    try {
      await flushSave();
      await openResume(id);
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  dom.titleInput.addEventListener('input', () => {
    if (!state.current) return;
    state.current.title = dom.titleInput.value;
    const meta = state.resumes.find((r) => r.id === state.current.id);
    if (meta) meta.title = dom.titleInput.value || 'Untitled resume';
    renderSwitcher();
    markDirty();
  });

  $('btn-new').addEventListener('click', () => {
    void createBlankResume().catch((error) => toast(error.message, 'error'));
  });
  $('btn-duplicate').addEventListener('click', () => {
    void duplicateCurrent().catch((error) => toast(error.message, 'error'));
  });
  $('btn-delete').addEventListener('click', () => {
    void deleteCurrent();
  });
  $('btn-print').addEventListener('click', printResume);
  $('btn-export').addEventListener('click', () => {
    exportJson();
    closeMenu();
  });
  $('btn-import').addEventListener('click', () => {
    dom.importFile.click();
    closeMenu();
  });
  dom.importFile.addEventListener('change', () => {
    const file = dom.importFile.files && dom.importFile.files[0];
    dom.importFile.value = '';
    if (file) void importJson(file);
  });
  $('btn-logout').addEventListener('click', async () => {
    await flushSave();
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  });

  dom.moreBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = dom.moreMenu.hidden;
    dom.moreMenu.hidden = !willOpen;
    dom.moreBtn.setAttribute('aria-expanded', String(willOpen));
  });
  document.addEventListener('click', (event) => {
    if (dom.moreMenu.hidden) return;
    if (dom.moreMenu.contains(event.target) || dom.moreBtn.contains(event.target)) return;
    closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void flushSave();
      toast('Saved');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushSave();
  });
  window.addEventListener('pagehide', () => {
    void flushSave();
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => fitPreview());
    observer.observe(dom.previewScroll);
  } else {
    window.addEventListener('resize', () => fitPreview());
  }
}

/* --------------------------------- start --------------------------------- */

init();
