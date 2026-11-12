/* =========================================================================
   Resume templates — 11 print layouts, rendered from the same resume data.
   Every layout is a pure function of (data, settings) and returns HTML that
   the preview pane drops into the paper element.
   ========================================================================= */

export const SECTION_KEYS = [
  'summary',
  'experience',
  'projects',
  'education',
  'skills',
  'certifications',
  'languages',
  'references',
];

export const SECTION_LABELS = {
  summary: 'Summary',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  skills: 'Skills',
  certifications: 'Certifications',
  languages: 'Languages',
  references: 'References',
};

/**
 * Each template carries the colour palette offered for it in the design panel.
 * `accent` drives headings, sidebar fills, bands and bars, so a template reads
 * correctly from any colour in its list (contrast ink is computed at runtime).
 */
export const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern',
    note: 'Accent headings, left aligned',
    palette: ['#0f766e', '#1d4ed8', '#6d28d9', '#b91c1c', '#b45309', '#111827', '#be185d', '#047857'],
  },
  {
    id: 'classic',
    name: 'Classic',
    note: 'Centred header, ruled sections',
    palette: ['#111827', '#1d4ed8', '#0f766e', '#6d28d9', '#9a3412', '#b91c1c', '#374151', '#0e7490'],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    note: 'Tight, quiet, no rules',
    palette: ['#111827', '#374151', '#0f766e', '#1d4ed8', '#6d28d9', '#9a3412'],
  },
  {
    id: 'slate',
    name: 'Slate',
    note: 'Dark sidebar, photo, details',
    palette: ['#12473a', '#0f2c47', '#3b2131', '#4a2f1a', '#1f2937', '#0b5a58'],
  },
  {
    id: 'executive',
    name: 'Executive',
    note: 'Photo, blue headings, skill columns',
    palette: ['#1d4ed8', '#0e7490', '#166534', '#9a3412', '#6d28d9', '#111827'],
  },
  {
    id: 'mono',
    name: 'Monochrome',
    note: 'Big type, two columns, skill bars',
    palette: ['#111827', '#374151', '#1f2937', '#4b5563', '#0f766e', '#1d4ed8'],
  },
  {
    id: 'editorial',
    name: 'Editorial',
    note: 'Serif, warm headings, classic rule',
    palette: ['#9a3412', '#7c2d12', '#0f766e', '#1d4ed8', '#4c1d95', '#111827'],
  },
  {
    id: 'mint',
    name: 'Band',
    note: 'Colour band, photo, skill bars',
    palette: ['#2fbf8f', '#34d399', '#38bdf8', '#f5b642', '#f472b6', '#a78bfa'],
  },
  {
    id: 'banner',
    name: 'Banner',
    note: 'Grey banner header, single column',
    palette: ['#111827', '#1d4ed8', '#0f766e', '#b91c1c', '#7c3aed', '#b45309'],
  },
  {
    id: 'dots',
    name: 'Dots',
    note: 'Boxed name, dotted skill ratings',
    palette: ['#111827', '#0f766e', '#1d4ed8', '#9a3412', '#6d28d9', '#be185d'],
  },
  {
    id: 'creative',
    name: 'Creative',
    note: 'Portrait photo with shape accents',
    palette: ['#1e3a8a', '#1d4ed8', '#0f766e', '#7c2d12', '#4c1d95', '#be185d'],
  },
];

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}

export function normalizeOrder(order) {
  const result = [];
  for (const key of Array.isArray(order) ? order : []) {
    if (SECTION_KEYS.includes(key) && !result.includes(key)) result.push(key);
  }
  for (const key of SECTION_KEYS) {
    if (!result.includes(key)) result.push(key);
  }
  return result;
}

/** Pick black or white ink for text sitting on `hex`. */
export function contrastInk(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.2 ? '#0b1220' : '#ffffff';
}

/* ------------------------------- helpers -------------------------------- */

const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  );

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

const shortUrl = (url) =>
  String(url || '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');

function dateRange(start, end) {
  const from = hasText(start) ? start.trim() : '';
  const to = hasText(end) ? end.trim() : '';
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

function initialsOf(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '•';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const LANG_LEVELS = {
  native: 5,
  fluent: 5,
  advanced: 4,
  professional: 4,
  proficient: 4,
  intermediate: 3,
  conversational: 3,
  basic: 2,
  beginner: 1,
  elementary: 1,
};

function levelFromText(text) {
  const key = String(text || '').trim().toLowerCase();
  return LANG_LEVELS[key] || 0;
}

function bullets(list) {
  const items = (list || []).filter(hasText);
  if (!items.length) return '';
  return `<ul class="r-bullets">${items.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
}

function section(label, inner, extraClass = '') {
  if (!inner) return '';
  const heading = label ? `<h2 class="r-h">${esc(label)}</h2>` : '';
  return `<section class="r-section${extraClass ? ` ${extraClass}` : ''}">${heading}${inner}</section>`;
}

function paragraphs(text) {
  return String(text)
    .split(/\n{2,}/)
    .map((chunk) => `<p class="r-summary">${esc(chunk).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function headLine(line, dates) {
  return `<div class="r-item-head"><div class="r-item-line">${line}</div>${
    dates ? `<span class="r-item-date">${esc(dates)}</span>` : ''
  }</div>`;
}

function photoOrMonogram(basics, extraClass = '') {
  const cls = `rl-photo${extraClass ? ` ${extraClass}` : ''}`;
  if (hasText(basics.photo)) {
    return `<img class="${cls}" src="${esc(basics.photo)}" alt="" />`;
  }
  return `<div class="${cls} rl-photo-empty" aria-hidden="true">${esc(initialsOf(basics.name))}</div>`;
}

/* --------------------------- content blocks ------------------------------ */

function summaryBlock(data, label = 'Summary') {
  const text = (data.summary || '').trim();
  if (!text) return '';
  return section(label, paragraphs(text));
}

function experienceLine(x, mode) {
  const role = hasText(x.role) ? x.role.trim() : '';
  const company = hasText(x.company) ? x.company.trim() : '';
  const location = hasText(x.location) ? x.location.trim() : '';

  if (mode === 'comma') {
    const parts = [role, company, location].filter(Boolean);
    return parts.length ? `<span class="r-item-title">${esc(parts.join(', '))}</span>` : '';
  }
  if (mode === 'at') {
    const head = [role, company ? `at ${company}` : '', location].filter(Boolean).join(' ');
    return head ? `<span class="r-item-title">${esc(head)}</span>` : '';
  }
  if (mode === 'editorial') {
    const top = [company, location].filter(Boolean).join(', ');
    return `${top ? `<span class="r-item-title">${esc(top)}</span>` : ''}${
      role
        ? `<span class="r-item-role">${esc(role)}</span>`
        : ''
    }`;
  }
  if (mode === 'company-first') {
    const top = [company, location].filter(Boolean).join(', ');
    const line = [top, role].filter(Boolean);
    return line.length ? esc(line.join(' — ')) : '';
  }
  const sub = [company, location].filter(Boolean).join(' · ');
  return `${role ? `<span class="r-item-title">${esc(role)}</span>` : ''}${
    sub ? `${role ? '<span class="r-item-sep">·</span>' : ''}<span class="r-item-sub">${esc(sub)}</span>` : ''
  }`;
}

function experienceBlock(data, label = 'Experience', mode = 'role-first', extraClass = '') {
  const items = (data.experience || [])
    .map((x) => {
      if (!hasText(x.role) && !hasText(x.company)) return '';
      const dates = dateRange(x.start, x.current ? 'Present' : x.end);
      return `<div class="r-item">${headLine(experienceLine(x, mode), dates)}${bullets(x.bullets)}</div>`;
    })
    .join('');
  return section(label, items, extraClass);
}

function projectBlock(data, label = 'Projects') {
  const items = (data.projects || [])
    .map((x) => {
      if (!hasText(x.name)) return '';
      const dates = dateRange(x.start, x.end);
      const line = [
        `<span class="r-item-title">${esc(x.name)}</span>`,
        hasText(x.tech) ? `<span class="r-item-sub">${esc(x.tech)}</span>` : '',
        hasText(x.url) ? `<span class="r-item-link">${esc(shortUrl(x.url))}</span>` : '',
      ]
        .filter(Boolean)
        .join('<span class="r-item-sep">·</span>');
      return `<div class="r-item">${headLine(line, dates)}${bullets(x.bullets)}</div>`;
    })
    .join('');
  return section(label, items);
}

function educationBlock(data, label = 'Education', mode = 'inline') {
  const items = (data.education || [])
    .map((x) => {
      if (!hasText(x.degree) && !hasText(x.school)) return '';
      const dates = dateRange(x.start, x.end);

      if (mode === 'stacked') {
        const sub = [x.school, x.location].filter(hasText).join(', ');
        return `<div class="r-item">${headLine(
          `<span class="r-item-title">${esc(x.degree || x.school)}</span>`,
          dates
        )}${sub ? `<div class="r-item-school">${esc(sub)}</div>` : ''}${
          hasText(x.details) ? `<div class="r-note">${esc(x.details)}</div>` : ''
        }</div>`;
      }

      const sub = [x.school, x.location].filter(hasText).join(' · ');
      const line = [
        hasText(x.degree) ? `<span class="r-item-title">${esc(x.degree)}</span>` : '',
        sub ? `<span class="r-item-sub">${esc(sub)}</span>` : '',
      ]
        .filter(Boolean)
        .join('<span class="r-item-sep">·</span>');
      return `<div class="r-item">${headLine(line, dates)}${
        hasText(x.details) ? `<div class="r-note">${esc(x.details)}</div>` : ''
      }</div>`;
    })
    .join('');
  return section(label, items);
}

function detailRows(basics) {
  const rows = [];
  if (hasText(basics.location)) rows.push(['Address', basics.location.trim()]);
  if (hasText(basics.phone)) rows.push(['Phone', basics.phone.trim()]);
  if (hasText(basics.email)) rows.push(['Email', basics.email.trim()]);
  if (hasText(basics.website)) rows.push(['Website', shortUrl(basics.website)]);
  for (const link of basics.links || []) {
    if (hasText(link.url)) rows.push([link.label || 'Link', shortUrl(link.url)]);
  }
  return rows;
}

function detailsBlock(basics, label = 'Details') {
  const rows = detailRows(basics);
  if (!rows.length) return '';
  return section(
    label,
    `<div class="rl-details">${rows
      .map(
        ([key, value]) =>
          `<div class="rl-detail"><span class="rl-detail-label">${esc(key)}</span><span class="rl-detail-value">${esc(
            value
          )}</span></div>`
      )
      .join('')}</div>`
  );
}

function contactBits(basics, { includeLinks = true } = {}) {
  const bits = [];
  if (hasText(basics.email)) bits.push(basics.email.trim());
  if (hasText(basics.phone)) bits.push(basics.phone.trim());
  if (hasText(basics.location)) bits.push(basics.location.trim());
  if (hasText(basics.website)) bits.push(shortUrl(basics.website));
  if (includeLinks) {
    for (const link of basics.links || []) {
      if (!hasText(link.url)) continue;
      bits.push(hasText(link.label) ? `${link.label.trim()}: ${shortUrl(link.url)}` : shortUrl(link.url));
    }
  }
  return bits;
}

/* skills */

function barMarkup(level) {
  const filled = Math.max(0, Math.min(5, Number(level) || 0));
  return `<div class="rl-bar" aria-hidden="true">${[1, 2, 3, 4, 5]
    .map((n) => `<i class="${n <= filled ? 'on' : ''}"></i>`)
    .join('')}</div>`;
}

function dotsMarkup(level) {
  const filled = Math.max(0, Math.min(5, Number(level) || 1));
  return `<div class="rl-dots" aria-hidden="true">${[1, 2, 3, 4, 5]
    .map((n) => `<i class="${n <= filled ? 'on' : ''}"></i>`)
    .join('')}</div>`;
}

/** Skill items are normally an array, but tolerate a comma-separated string. */
function itemsOf(group) {
  if (Array.isArray(group.items)) return group.items.filter(hasText);
  return String(group.items || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function skillGroups(data) {
  return (data.skills || []).filter((g) => hasText(g.group) || itemsOf(g).length);
}

function skillsRowsBlock(data, label = 'Skills') {
  const groups = skillGroups(data);
  if (!groups.length) return '';
  const rows = groups
    .map(
      (g) => `<div class="r-skill">
        <span class="r-skill-group">${esc(g.group || 'Skills')}</span>
        <span class="r-skill-items">${esc(itemsOf(g).join(', '))}</span>
      </div>`
    )
    .join('');
  return section(label, `<div class="r-skills">${rows}</div>`);
}

/** Group name, a five-segment bar and the skill list underneath. */
function skillsBarsBlock(data, label = 'Skills', { showItems = true } = {}) {
  const groups = skillGroups(data);
  if (!groups.length) return '';
  const rows = groups
    .map((g) => {
      const items = itemsOf(g).join(', ');
      const level = Number(g.level) || 0;
      return `<div class="rl-skill">
        <div class="rl-skill-head">
          <span class="rl-skill-name">${esc(g.group || 'Skills')}</span>
          ${level ? barMarkup(level) : ''}
        </div>
        ${showItems && items ? `<div class="rl-skill-items">${esc(items)}</div>` : ''}
      </div>`;
    })
    .join('');
  return section(label, `<div class="rl-skill-list">${rows}</div>`);
}

function skillsDotsBlock(data, label = 'Skills') {
  const groups = skillGroups(data);
  if (!groups.length) return '';
  const rows = groups
    .map(
      (g) => `<div class="rl-skill">
        <span class="rl-skill-name">${esc(g.group || 'Skills')}</span>
        ${dotsMarkup(g.level)}
      </div>`
    )
    .join('');
  return section(label, `<div class="rl-skill-list">${rows}</div>`);
}

/** Bare list of skills, laid out in CSS columns. */
function skillsColumnsBlock(data, label = 'Skills') {
  const groups = skillGroups(data);
  if (!groups.length) return '';
  const items = groups
    .flatMap((g) => itemsOf(g))
    .map((i) => `<li>${esc(i)}</li>`)
    .join('');
  return section(label, `<ul class="rl-skill-columns">${items}</ul>`);
}

/* languages */

function languagesBlock(data, label = 'Languages', mode = 'inline') {
  const items = (data.languages || []).filter((x) => hasText(x.name));
  if (!items.length) return '';

  if (mode === 'bars') {
    return section(
      label,
      `<div class="rl-skill-list">${items
        .map((x) => {
          const level = levelFromText(x.level);
          return `<div class="rl-skill">
            <div class="rl-skill-head"><span class="rl-skill-name">${esc(x.name)}</span>${
              level ? barMarkup(level) : ''
            }</div>
          </div>`;
        })
        .join('')}</div>`
    );
  }

  if (mode === 'dots') {
    return section(
      label,
      `<div class="rl-skill-list">${items
        .map(
          (x) => `<div class="rl-skill">
            <span class="rl-skill-name">${esc(x.name)}</span>
            ${dotsMarkup(levelFromText(x.level))}
          </div>`
        )
        .join('')}</div>`
    );
  }

  const inline = items
    .map((x) => (hasText(x.level) ? `${x.name} (${x.level})` : x.name))
    .join(' · ');
  return section(label, `<p class="r-inline">${esc(inline)}</p>`);
}

function certificationsBlock(data, label = 'Certifications') {
  const items = (data.certifications || [])
    .filter((x) => hasText(x.name))
    .map((x) => {
      const line = [
        `<span class="r-item-title">${esc(x.name)}</span>`,
        hasText(x.issuer) ? `<span class="r-item-sub">${esc(x.issuer)}</span>` : '',
      ]
        .filter(Boolean)
        .join('<span class="r-item-sep">·</span>');
      return `<div class="r-item">${headLine(line, hasText(x.date) ? x.date : '')}</div>`;
    })
    .join('');
  return section(label, items);
}

function referencesBlock(data, label = 'References') {
  const items = (data.references || []).filter((x) => hasText(x.name));
  if (!items.length) return '';
  const rows = items
    .map(
      (x) => `<div class="rl-reference">
        <span class="rl-reference-name">${esc(x.name)}</span>
        ${hasText(x.role) || hasText(x.company)
          ? `<span class="rl-reference-role">${esc([x.role, x.company].filter(hasText).join(', '))}</span>`
          : ''}
        ${hasText(x.contact) ? `<span class="rl-reference-contact">${esc(x.contact)}</span>` : ''}
      </div>`
    )
    .join('');
  return section(label, `<div class="rl-references">${rows}</div>`);
}

/* -------------------------------- layouts -------------------------------- */

function flowHeader(basics) {
  const bits = contactBits(basics);
  return `<header class="r-head">
    ${hasText(basics.name) ? `<h1 class="r-name">${esc(basics.name)}</h1>` : ''}
    ${hasText(basics.headline) ? `<p class="r-headline">${esc(basics.headline)}</p>` : ''}
    ${bits.length ? `<p class="r-contact">${bits.map(esc).join('<span class="r-sep">•</span>')}</p>` : ''}
  </header>`;
}

/** Classic / Modern / Minimal: one column in the user's chosen order. */
function flowLayout(data, settings) {
  const hidden = new Set(settings.hiddenSections || []);
  const blocks = {
    summary: () => summaryBlock(data, 'Summary'),
    experience: () => experienceBlock(data, 'Experience'),
    projects: () => projectBlock(data, 'Projects'),
    education: () => educationBlock(data, 'Education'),
    skills: () => skillsRowsBlock(data, 'Skills'),
    certifications: () => certificationsBlock(data, 'Certifications'),
    languages: () => languagesBlock(data, 'Languages'),
    references: () => referencesBlock(data, 'References'),
  };
  const sections = normalizeOrder(settings.sectionOrder)
    .filter((key) => !hidden.has(key))
    .map((key) => blocks[key]())
    .filter(Boolean)
    .join('');
  return flowHeader(data.basics || {}) + sections;
}

/** Slate — dark sidebar with photo, details and skills; main job history. */
function slateLayout(data, settings) {
  const b = data.basics || {};
  const v = (key) => !(settings.hiddenSections || []).includes(key);
  const side = `
    <aside class="sl-side">
      <div class="sl-id">
        ${photoOrMonogram(b, 'sl-photo')}
        ${hasText(b.name) ? `<div class="sl-name">${esc(b.name)}</div>` : ''}
        ${hasText(b.headline) ? `<div class="sl-role">${esc(b.headline)}</div>` : ''}
      </div>
      ${detailsBlock(b, 'Details')}
      ${v('skills') ? skillsRowsBlock(data, 'Skills') : ''}
      ${v('languages') ? languagesBlock(data, 'Languages') : ''}
    </aside>`;

  const main = [
    v('summary') ? summaryBlock(data, 'Profile') : '',
    v('experience') ? experienceBlock(data, 'Employment History') : '',
    v('projects') ? projectBlock(data, 'Projects') : '',
    v('education') ? educationBlock(data, 'Education') : '',
    v('certifications') ? certificationsBlock(data, 'Certifications') : '',
    v('references') ? referencesBlock(data, 'References') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="rl rl-slate">${side}<main class="sl-main">${main}</main></div>`;
}

/** Executive — photo header, tinted headings, skills in columns. */
function executiveLayout(data, settings) {
  const b = data.basics || {};
  const v = (key) => !(settings.hiddenSections || []).includes(key);
  const contact = [b.location, [b.phone, b.email].filter(hasText).join(' | ')]
    .filter(hasText)
    .join(' | ');

  const header = `<header class="ex-head">
    <div class="ex-id">
      ${hasText(b.name) ? `<h1 class="ex-name">${esc(b.name)}</h1>` : ''}
      ${hasText(b.headline) ? `<div class="ex-role">${esc(b.headline)}</div>` : ''}
      ${contact ? `<div class="ex-contact">${esc(contact)}</div>` : ''}
      ${
        hasText(b.website)
          ? `<div class="ex-contact">${esc(shortUrl(b.website))}</div>`
          : ''
      }
    </div>
    ${photoOrMonogram(b, 'ex-photo')}
  </header>`;

  const additional = [];
  const langInline = (data.languages || []).filter((x) => hasText(x.name)).map((x) => x.name).join(', ');
  if (v('languages') && langInline) {
    additional.push(`<p class="ex-extra-row"><strong>Languages:</strong> ${esc(langInline)}</p>`);
  }
  const certInline = (data.certifications || []).filter((x) => hasText(x.name)).map((x) => x.name).join(', ');
  if (v('certifications') && certInline) {
    additional.push(`<p class="ex-extra-row"><strong>Certificates:</strong> ${esc(certInline)}</p>`);
  }
  const refInline = (data.references || [])
    .filter((x) => hasText(x.name))
    .map((x) => [x.name, x.company].filter(hasText).join(', '))
    .join(' · ');
  if (v('references') && refInline) {
    additional.push(`<p class="ex-extra-row"><strong>References:</strong> ${esc(refInline)}</p>`);
  }

  const body = [
    v('summary') ? summaryBlock(data, 'Summary') : '',
    v('experience') ? experienceBlock(data, 'Professional Experience') : '',
    v('projects') ? projectBlock(data, 'Projects') : '',
    v('education') ? educationBlock(data, 'Education') : '',
    v('skills') ? skillsColumnsBlock(data, 'Technical Skills') : '',
    additional.length ? section('Additional Information', additional.join(''), 'ex-extra') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="rl rl-executive">${header}<div class="ex-body">${body}</div></div>`;
}

/** Monochrome — oversized name, narrow data column, skill bars. */
function monoLayout(data, settings) {
  const b = data.basics || {};
  const v = (key) => !(settings.hiddenSections || []).includes(key);

  const header = `<header class="mo-head">
    ${hasText(b.name) ? `<h1 class="mo-name">${esc(b.name)}</h1>` : ''}
    ${hasText(b.headline) ? `<div class="mo-role">${esc(b.headline)}</div>` : ''}
  </header>`;

  const side = `
    ${detailsBlock(b, 'Info')}
    ${v('skills') ? skillsBarsBlock(data, 'Skills') : ''}
    ${v('languages') ? languagesBlock(data, 'Languages', 'bars') : ''}`;

  const main = [
    v('summary') ? summaryBlock(data, 'Profile') : '',
    v('experience') ? experienceBlock(data, 'Employment History') : '',
    v('projects') ? projectBlock(data, 'Projects') : '',
    v('education') ? educationBlock(data, 'Education') : '',
    v('certifications') ? certificationsBlock(data, 'Certifications') : '',
    v('references') ? referencesBlock(data, 'References') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="rl rl-mono">${header}<div class="mo-cols"><aside class="mo-side">${side}</aside><main class="mo-main">${main}</main></div></div>`;
}

/** Editorial — serif, warm headings, company-first history. */
function editorialLayout(data, settings) {
  const b = data.basics || {};
  const v = (key) => !(settings.hiddenSections || []).includes(key);
  const bits = contactBits(b);
  const half = Math.ceil(bits.length / 2);
  const left = bits.slice(0, half).join(' · ');
  const right = bits.slice(half).join(' · ');

  const header = `<header class="ed-head">
    <div>
      ${hasText(b.name) ? `<h1 class="ed-name">${esc(b.name)}</h1>` : ''}
      ${hasText(b.headline) ? `<div class="ed-role">${esc(b.headline)}</div>` : ''}
    </div>
    ${
      bits.length
        ? `<div class="ed-contact">${left ? `<span>${esc(left)}</span>` : ''}${
            right ? `<span>${esc(right)}</span>` : ''
          }</div>`
        : ''
    }
  </header>`;

  const main = [
    v('summary') ? summaryBlock(data, 'Profile') : '',
    v('experience') ? experienceBlock(data, 'Career Experience', 'editorial') : '',
    v('projects') ? projectBlock(data, 'Projects') : '',
    v('education') ? educationBlock(data, 'Education', 'stacked') : '',
    v('skills') ? editorialSkills(data) : '',
    v('certifications') ? certificationsBlock(data, 'Certifications') : '',
    v('languages') ? languagesBlock(data, 'Languages') : '',
    v('references') ? referencesBlock(data, 'References') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="rl rl-editorial">${header}<div class="ed-body">${main}</div></div>`;
}

function editorialSkills(data) {
  const groups = skillGroups(data);
  if (!groups.length) return '';
  const rows = groups
    .map(
      (g) => `<div class="ed-skill">
        <span class="ed-skill-name">${esc(g.group || 'Skills')}</span>
        <span class="ed-skill-items">${esc(itemsOf(g).join(', '))}</span>
      </div>`
    )
    .join('');
  return section('Technical Proficiencies', rows);
}

/** Band — photo beside a solid colour name plate, bars underneath. */
function bandLayout(data, settings) {
  const b = data.basics || {};
  const v = (key) => !(settings.hiddenSections || []).includes(key);
  const contact = [b.location, b.phone, b.email].filter(hasText).map(esc).join('<br>');

  const header = `<header class="mi-head">
    ${photoOrMonogram(b, 'mi-photo')}
    <div class="mi-id">
      ${hasText(b.name) ? `<h1 class="mi-name">${esc(b.name)}</h1>` : ''}
      ${hasText(b.headline) ? `<div class="mi-role">${esc(b.headline)}</div>` : ''}
      ${contact ? `<div class="mi-contact">${contact}</div>` : ''}
    </div>
  </header>`;

  const side = `
    ${v('skills') ? skillsBarsBlock(data, 'Skills') : ''}
    ${v('languages') ? languagesBlock(data, 'Languages', 'bars') : ''}
    ${v('certifications') ? certificationsBlock(data, 'Certifications') : ''}`;

  const main = [
    v('summary') ? summaryBlock(data, 'Profile') : '',
    v('experience') ? experienceBlock(data, 'Employment History', 'comma') : '',
    v('projects') ? projectBlock(data, 'Projects') : '',
    v('education') ? educationBlock(data, 'Education', 'stacked') : '',
    v('references') ? referencesBlock(data, 'References') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="rl rl-band">${header}<div class="mi-cols"><aside class="mi-side">${side}</aside><main class="mi-main">${main}</main></div></div>`;
}

/** Banner — grey name banner, everything in one column. */
function bannerLayout(data, settings) {
  const b = data.basics || {};
  const v = (key) => !(settings.hiddenSections || []).includes(key);
  const contact = [b.email, b.phone].filter(hasText).join(' · ');

  const header = `<header class="ba-head">
    ${hasText(b.name) ? `<h1 class="ba-name">${esc(b.name)}</h1>` : ''}
    ${
      contact
        ? `<div class="ba-contact">${esc(contact)}${hasText(b.location) ? `<br>${esc(b.location)}` : ''}</div>`
        : hasText(b.location)
          ? `<div class="ba-contact">${esc(b.location)}</div>`
          : ''
    }
  </header>`;

  const body = [
    hasText(b.headline) ? `<div class="ba-role">${esc(b.headline)}</div>` : '',
    v('summary') ? summaryBlock(data, '') : '',
    v('experience') ? experienceBlock(data, 'Career Experience', 'at') : '',
    v('projects') ? projectBlock(data, 'Projects') : '',
    v('education') ? educationBlock(data, 'Education', 'stacked') : '',
    v('skills') ? skillsRowsBlock(data, 'Skills') : '',
    v('certifications') ? certificationsBlock(data, 'Certifications') : '',
    v('languages') ? languagesBlock(data, 'Languages') : '',
    v('references') ? referencesBlock(data, 'References') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="rl rl-banner">${header}<div class="ba-body">${body}</div></div>`;
}

/** Dots — light side column with dotted ratings, boxed name in main column. */
function dotsLayout(data, settings) {
  const b = data.basics || {};
  const v = (key) => !(settings.hiddenSections || []).includes(key);

  const side = `
    ${detailsBlock(b, 'Info')}
    ${v('skills') ? skillsDotsBlock(data, 'Skills') : ''}
    ${v('languages') ? languagesBlock(data, 'Languages', 'dots') : ''}`;

  const header = `<header class="do-head">
    <div class="do-namebox">
      ${hasText(b.name) ? `<h1 class="do-name">${esc(b.name)}</h1>` : ''}
      ${hasText(b.headline) ? `<div class="do-role">${esc(b.headline)}</div>` : ''}
    </div>
  </header>`;

  const main = [
    v('summary') ? summaryBlock(data, 'Profile') : '',
    v('experience') ? experienceBlock(data, 'Work Experience') : '',
    v('projects') ? projectBlock(data, 'Projects') : '',
    v('education') ? educationBlock(data, 'Education', 'stacked') : '',
    v('certifications') ? certificationsBlock(data, 'Certifications') : '',
    v('references') ? referencesBlock(data, 'References') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="rl rl-dots"><aside class="do-side">${side}</aside><main class="do-main">${header}${main}</main></div>`;
}

/** Creative — portrait with shape accents, two-column body. */
function creativeLayout(data, settings) {
  const b = data.basics || {};
  const v = (key) => !(settings.hiddenSections || []).includes(key);

  const header = `<header class="cr-hero">
    <div class="cr-hero-text">
      ${hasText(b.name) ? `<h1 class="cr-name">${esc(b.name)}</h1>` : ''}
      ${hasText(b.headline) ? `<div class="cr-role">${esc(b.headline)}</div>` : ''}
    </div>
    <div class="cr-portrait">
      <span class="cr-blob cr-blob-a" aria-hidden="true"></span>
      <span class="cr-blob cr-blob-b" aria-hidden="true"></span>
      ${photoOrMonogram(b, 'cr-photo')}
    </div>
  </header>`;

  const side = `
    ${detailsBlock(b, 'Details')}
    ${v('skills') ? skillsRowsBlock(data, 'Skills') : ''}
    ${v('languages') ? languagesBlock(data, 'Languages') : ''}
    ${v('references') ? referencesBlock(data, 'References') : ''}`;

  const main = [
    v('summary') ? summaryBlock(data, 'Profile') : '',
    v('experience') ? experienceBlock(data, 'Employment History') : '',
    v('projects') ? projectBlock(data, 'Projects') : '',
    v('education') ? educationBlock(data, 'Education', 'stacked') : '',
    v('certifications') ? certificationsBlock(data, 'Certifications') : '',
  ]
    .filter(Boolean)
    .join('');

  return `<div class="rl rl-creative">${header}<div class="cr-cols"><main class="cr-main">${main}</main><aside class="cr-side">${side}</aside></div></div>`;
}

const LAYOUTS = {
  modern: flowLayout,
  classic: flowLayout,
  minimal: flowLayout,
  slate: slateLayout,
  executive: executiveLayout,
  mono: monoLayout,
  editorial: editorialLayout,
  mint: bandLayout,
  banner: bannerLayout,
  dots: dotsLayout,
  creative: creativeLayout,
};

export function renderResume(data, settings) {
  const layout = LAYOUTS[settings.template] || flowLayout;
  const html = layout(data, settings) || '';
  if (!html.trim()) {
    return '<p class="r-empty">Start typing on the left and your resume appears here.</p>';
  }
  return html;
}
