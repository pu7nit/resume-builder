#!/usr/bin/env node
/**
 * Project verification suite.
 *
 *   node scripts/verify.mjs                     # source + templates + local API
 *   BASE_URL=http://127.0.0.1:3100 node scripts/verify.mjs
 *   node scripts/verify.mjs --offline           # skip the HTTP checks
 *
 * Creates and deletes its own test resumes, so it is safe to run against a
 * live instance. Exit code is 0 when everything passes.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedResume } from '../src/seed.js';
import {
  renderResume,
  TEMPLATES,
  contrastInk,
  normalizeOrder,
  SECTION_KEYS,
} from '../public/resume-templates.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OFFLINE = process.argv.includes('--offline');

let passed = 0;
const failures = [];

function check(name, ok, info = '') {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}${info ? `  [${info}]` : ''}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}${info ? `  [${info}]` : ''}`);
  }
}

function section(title) {
  console.log(`\n— ${title} —`);
}

/* ------------------------------ 1. source -------------------------------- */

section('source');

for (const file of [
  'server.js',
  'src/auth.js',
  'src/db.js',
  'src/seed.js',
  'public/app.js',
  'public/resume-templates.js',
  'public/login.js',
]) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  check(`syntax: ${file}`, result.status === 0, result.stderr.split('\n')[0] || '');
}

try {
  JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  check('package.json parses', true);
} catch (error) {
  check('package.json parses', false, error.message);
}

const css = readFileSync(path.join(root, 'public/styles.css'), 'utf8');
let depth = 0;
let unbalanced = false;
for (const char of css) {
  if (char === '{') depth += 1;
  if (char === '}') depth -= 1;
  if (depth < 0) unbalanced = true;
}
check('styles.css braces balanced', depth === 0 && !unbalanced, `${css.split('\n').length} lines`);

const compose = spawnSync('docker', ['compose', 'config'], { cwd: root, encoding: 'utf8' });
check('docker-compose.yml is valid', compose.status === 0, compose.status === 0 ? '' : 'docker unavailable or invalid');

/* ---------------------------- 2. templates ------------------------------- */

section('template engine');

const seed = seedResume();
const sample = {
  ...seed.data,
  basics: { ...seed.data.basics, photo: 'data:image/png;base64,AAA' },
  references: [
    { id: 'r1', name: 'Ref One', role: 'Manager', company: 'ACME', contact: 'ref@example.com' },
  ],
};

check('eleven templates registered', TEMPLATES.length === 11, TEMPLATES.map((t) => t.id).join(','));
check('template ids unique', new Set(TEMPLATES.map((t) => t.id)).size === TEMPLATES.length);

for (const template of TEMPLATES) {
  const html = renderResume(sample, { ...seed.settings, template: template.id });
  const sections = (html.match(/class="r-section/g) || []).length;
  const bars = (html.match(/rl-bar/g) || []).length;
  const dots = (html.match(/rl-dots/g) || []).length;
  const clean = !html.includes('r-empty') && !html.includes('<h2 class="r-h"></h2>') && !/undefined|NaN/.test(html);
  check(`layout: ${template.id}`, clean && html.length > 500, `sections=${sections} bars=${bars} dots=${dots}`);
  check(`palette: ${template.id}`, template.palette.length >= 6 && template.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c)));
}

for (const id of ['slate', 'executive', 'mint', 'creative']) {
  check(`photo slot: ${id}`, renderResume(sample, { ...seed.settings, template: id }).includes('data:image/png'));
}
for (const id of ['modern', 'classic', 'minimal', 'banner', 'mono', 'editorial', 'dots']) {
  check(`no photo slot: ${id}`, !renderResume(sample, { ...seed.settings, template: id }).includes('data:image/png'));
}

check('references render', renderResume(sample, { ...seed.settings, template: 'slate' }).includes('Ref One'));
check(
  'empty references skipped',
  !renderResume({ ...sample, references: [] }, { ...seed.settings, template: 'slate' }).includes('>References<')
);

const hiddenHtml = renderResume(sample, {
  ...seed.settings,
  template: 'modern',
  hiddenSections: ['skills', 'projects'],
});
check('hidden sections omitted', !hiddenHtml.includes('>Skills<') && !hiddenHtml.includes('>Projects<'));

check('order normalisation keeps known keys', normalizeOrder(['bogus', 'experience']).length === SECTION_KEYS.length);
check('order normalisation puts requested key first', normalizeOrder(['experience'])[0] === 'experience');

const contrastCases = [
  ['#2fbf8f', '#0b1220'],
  ['#f5b642', '#0b1220'],
  ['#0f766e', '#ffffff'],
  ['#12473a', '#ffffff'],
  ['#111827', '#ffffff'],
  ['#1d4ed8', '#ffffff'],
];
for (const [colour, ink] of contrastCases) {
  check(`contrast ink: ${colour}`, contrastInk(colour) === ink, contrastInk(colour));
}

/* ------------------------------- 3. HTTP --------------------------------- */

async function http(pathname, options = {}) {
  const res = await fetch(BASE_URL + pathname, options);
  const type = res.headers.get('content-type') || '';
  const body = type.includes('json') ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, body, headers: res.headers };
}

function jsonBody(method, body) {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

if (OFFLINE) {
  section('HTTP checks skipped (--offline)');
} else {
  section(`HTTP API (${BASE_URL})`);

  let reachable = true;
  try {
    const health = await http('/healthz');
    check('healthz responds', health.status === 200 && health.body.ok === true);
  } catch {
    reachable = false;
    check('server reachable', false, `start it with "npm start" or set BASE_URL`);
  }

  if (reachable) {
    const session = await http('/api/session');
    check('session endpoint', session.status === 200 && typeof session.body.authEnabled === 'boolean');

    const list = await http('/api/resumes');
    check('resume list', list.status === 200 && Array.isArray(list.body.resumes) && list.body.resumes.length >= 1);

    const first = list.body.resumes[0];
    const doc = await http('/api/resumes/' + first.id);
    const resume = doc.body && doc.body.resume;
    check('document loads', doc.status === 200 && Boolean(resume));
    check('document has basics', Boolean(resume && resume.data && typeof resume.data.basics === 'object'));
    check('section order complete', Boolean(resume) && resume.settings.sectionOrder.length === SECTION_KEYS.length);
    check('known template', Boolean(resume) && TEMPLATES.some((t) => t.id === resume.settings.template), resume && resume.settings.template);
    check(
      'skill levels numeric',
      Boolean(resume) && resume.data.skills.every((s) => typeof s.level === 'number')
    );

    const created = await http('/api/resumes', jsonBody('POST', { title: 'Verify test', data: { basics: { name: 'V' } } }));
    const id = created.body && created.body.resume && created.body.resume.id;
    check('create resume', created.status === 201 && typeof id === 'string');

    const updated = await http('/api/resumes/' + id, jsonBody('PUT', { title: 'Verify renamed', settings: { template: 'mono' } }));
    check('update resume', updated.status === 200 && updated.body.resume.settings.template === 'mono');

    const copy = await http('/api/resumes', jsonBody('POST', { fromId: id }));
    check('duplicate resume', copy.status === 201 && /copy/.test(copy.body.resume.title));

    const cross = await http('/api/resumes/' + id, {
      ...jsonBody('PUT', { title: 'nope' }),
      headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
    });
    check('cross-origin write refused', cross.status === 403);

    check('invalid id refused', (await http('/api/resumes/bad-id!!')).status === 400);
    check('missing resume 404', (await http('/api/resumes/00000000-0000-4000-8000-000000000000')).status === 404);

    await http('/api/resumes/' + id, { method: 'DELETE' });
    const deleted = await http('/api/resumes/' + copy.body.resume.id, { method: 'DELETE' });
    check('delete resume', deleted.status === 200);

    const after = await http('/api/resumes');
    check('test data cleaned up', after.body.resumes.length === list.body.resumes.length);

    for (const [pathname, type] of [
      ['/', 'text/html'],
      ['/app.js', 'text/javascript'],
      ['/resume-templates.js', 'text/javascript'],
      ['/styles.css', 'text/css'],
      ['/login.html', 'text/html'],
      ['/login.js', 'text/javascript'],
      ['/favicon.svg', 'image/svg+xml'],
    ]) {
      const res = await fetch(BASE_URL + pathname);
      check(`static ${pathname}`, res.status === 200 && (res.headers.get('content-type') || '').includes(type));
    }

    const page = await fetch(BASE_URL + '/');
    const csp = page.headers.get('content-security-policy') || '';
    check('CSP header', csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'"));
    check('nosniff header', page.headers.get('x-content-type-options') === 'nosniff');
    check('frame options', page.headers.get('x-frame-options') === 'DENY');
    check('path traversal blocked', (await fetch(BASE_URL + '/%2e%2e%2fpackage.json')).status === 404);
    check('unknown route 404', (await fetch(BASE_URL + '/nope')).status === 404);
  }
}

/* ------------------------------ summary ---------------------------------- */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('Failed checks:');
  for (const name of failures) console.log('  - ' + name);
}
process.exit(failures.length ? 1 : 0);
