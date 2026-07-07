#!/usr/bin/env node
// Dev tool: snapshot Strapi editorial content as markdown files.
// One subdirectory per content type, one .md per prose section, YAML
// frontmatter for metadata. Read-only — NOT a re-importable Strapi dump.
//
//   node scripts/strapi-export/index.js
//   BASE=https://provide-cms.herokuapp.com LOCALE=en-EU OUT=strapi-export \
//     node scripts/strapi-export/index.js
//
// Defaults come from .env (VITE_CMS_URL, VITE_STRAPI_LOCALE).

import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Content types the frontend consumes (grep "loadFromStrapi(" to refresh).
const TYPES = [
  'about', 'adaptation', 'case-study-dynamics', 'case-study-outro', 'contact',
  'glossaries', 'indicators', 'issue', 'scenario-presets', 'scenarios', 'stories',
];

// Keys that are metadata, never their own section file.
const META_KEYS = new Set([
  'id', 'UID', 'uid', 'slug', 'locale', 'localizations',
  'createdAt', 'updatedAt', 'publishedAt',
]);

// String fields treated as prose even when short.
const PROSE_KEYS = new Set([
  'Text', 'Description', 'Abstract', 'IntroText', 'OutroText',
  'SelfAssessmentText', 'IntegrationText', 'Body', 'Content',
]);

const isProse = (key, val) =>
  typeof val === 'string' && val.trim() !== '' &&
  (PROSE_KEYS.has(key) || /text|description|abstract|body|content/i.test(key) ||
    val.includes('\n') || val.length > 120);

const slug = (s) =>
  String(s ?? '')
    .replace(/['’]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // split camelCase: SelfAssessment -> Self_Assessment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'untitled';

const pad = (n) => String(n).padStart(2, '0');

// Pick the prose body out of a repeatable-component item.
const itemBody = (item) =>
  item.Text ?? item.Description ?? item.Abstract ??
  Object.entries(item).find(([k, v]) => isProse(k, v))?.[1] ?? null;

// --- pure transform: attributes -> [{ path, frontmatter, body }] -----------

function attributesToFiles(attrs, { contentType, locale, basePath }) {
  const files = [];
  for (const [key, val] of Object.entries(attrs)) {
    if (META_KEYS.has(key)) continue;

    // Repeatable component array (e.g. about.Section, issue.Issues).
    if (Array.isArray(val) && val.some((it) => it && typeof it === 'object' && itemBody(it))) {
      val.forEach((item, i) => {
        const body = itemBody(item);
        if (!body) return;
        const title = item.Title ?? item.Label ?? item.Name ?? `${key} ${i + 1}`;
        files.push({
          path: join(basePath, `${pad(i + 1)}_${slug(title)}.md`),
          frontmatter: { contentType, title, locale, order: i + 1 },
          body,
        });
      });
      continue;
    }

    // Flat prose string, possibly half of a *Title / *Text pair.
    if (isProse(key, val)) {
      const stem = key.replace(/Text$/, '');
      const title = attrs[`${stem}Title`] ?? key;
      files.push({
        path: join(basePath, `${slug(stem || key)}.md`),
        frontmatter: { contentType, title, locale },
        body: val,
      });
    }
  }
  return files;
}

function entriesToFiles(contentType, json, locale) {
  const data = json?.data;
  if (!data) return [];

  // Collection type: one subdirectory per entry, keyed by UID -> slug -> id.
  if (Array.isArray(data)) {
    return data.flatMap((entry) => {
      const a = entry.attributes ?? {};
      const key = slug(a.UID ?? a.uid ?? a.slug ?? entry.id);
      return attributesToFiles(a, { contentType, locale, basePath: join(contentType, key) });
    });
  }

  // Single type: files directly under the content-type directory.
  return attributesToFiles(data.attributes ?? {}, { contentType, locale, basePath: contentType });
}

// --- pure serializer: { frontmatter, body } -> file string -----------------

function yamlValue(v) {
  const s = String(v);
  return /[:#\-?\[\]{}&*!|>'"%@`\n]/.test(s) || s !== s.trim() ? JSON.stringify(s) : s;
}

function serialize({ frontmatter, body }) {
  const fm = Object.entries(frontmatter)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${yamlValue(v)}`)
    .join('\n');
  return `---\n${fm}\n---\n\n${String(body).trim()}\n`;
}

// --- thin I/O shell --------------------------------------------------------

async function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = await readFile(new URL('../../.env', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env — rely on process env */ }
  return env;
}

async function fetchType(base, locale, type) {
  const url = `${base}/api/${type}?populate=*&locale=${locale}&pagination[limit]=9999`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const env = await loadEnv();
  const base = (env.BASE ?? env.VITE_CMS_URL ?? '').replace(/\/$/, '');
  const locale = env.LOCALE ?? env.VITE_STRAPI_LOCALE ?? 'en';
  const out = env.OUT ?? 'strapi/original';
  if (!base) throw new Error('No base URL (set BASE or VITE_CMS_URL).');

  console.log(`Exporting from ${base} (locale=${locale}) → ${out}/`);
  await rm(out, { recursive: true, force: true });

  const seen = new Set();
  let total = 0;
  let collisions = 0;
  for (const type of TYPES) {
    let json;
    try {
      json = await fetchType(base, locale, type);
    } catch (e) {
      console.warn(`  ${type}: skipped (${e.message})`);
      continue;
    }
    const files = entriesToFiles(type, json, locale);
    for (const file of files) {
      const full = join(out, file.path);
      // Files are addressed by slug(label); distinct labels can collide on the
      // same path and silently overwrite. Warn rather than lose content quietly.
      if (seen.has(full)) { console.warn(`  ⚠ collision (overwriting): ${full}`); collisions++; }
      seen.add(full);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, serialize(file));
    }
    total += files.length;
    console.log(`  ${type}: ${files.length} section file(s)`);
  }
  console.log(`Done. ${total} markdown files written to ${out}/` + (collisions ? ` — ⚠ ${collisions} collision(s)` : ''));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
