#!/usr/bin/env node
// Dev tool: organize Strapi content into the NEW page/tab/section layout
// ($Page/$Tab/$Section.md) for the `about` and `methodology` pages.
//
// The tab/section structure is the TARGET design (from the mockups), not
// something stored in Strapi — this script maps existing Strapi content into
// it. Content that doesn't belong to these two pages is left out. Where a
// section is expected but Strapi has no text, an empty placeholder .md is
// written.
//
//   node scripts/strapi-export/pages.js
//   BASE=… LOCALE=… OUT=export node scripts/strapi-export/pages.js

import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// The about page has a flat index (no tabs) — every Strapi Section becomes a
// top-level about/*.md in Strapi order.

// methodology Impact tab: each impact splits into these categories, sourced
// from the matching DataType array.
const IMPACT_CATEGORIES = [
  ['Models', 'Model'],
  ['Model simulations', 'Simulation'],
  ['Data processing', 'Processing'],
];

// Convert a label into a lower_snake_case path segment.
const slug = (s) =>
  String(s ?? '')
    .replace(/['’]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // split camelCase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'untitled';

// Build a path from segments, snake-casing each (filename keeps its .md).
const P = (...parts) => join(...parts.map((p) => (p.endsWith('.md') ? `${slug(p.slice(0, -3))}.md` : slug(p))));

function serialize(frontmatter, body) {
  const yaml = (v) => {
    const s = String(v);
    return /[:#\-?\[\]{}&*!|>'"%@`\n]/.test(s) || s !== s.trim() ? JSON.stringify(s) : s;
  };
  const fm = Object.entries(frontmatter)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${yaml(v)}`)
    .join('\n');
  return `---\n${fm}\n---\n\n${String(body ?? '').trim()}\n`;
}

// --- pure mapping: raw payloads -> [{ path, frontmatter, body }] ------------

function aboutFiles(aboutJson, locale) {
  const sections = aboutJson?.data?.attributes?.Section ?? [];
  return sections
    .filter((s) => (s.Title ?? '').trim())
    .map((s) => {
      const title = s.Title.trim();
      return {
        path: P('about', `${title}.md`),
        frontmatter: { page: 'about', title, locale },
        body: s.Text ?? '',
      };
    });
}

function methodologyFiles(methJson, glossJson, locale) {
  const dataTypes = methJson?.data?.attributes?.DataType ?? [];
  const files = [];

  const named = (arr) => (arr ?? []).filter((it) => (it?.Label ?? '').trim());

  // Models tab: deduped union of every DataType's Model.
  const seenModels = new Set();
  for (const dt of dataTypes) {
    for (const m of named(dt.Model)) {
      const label = m.Label.trim();
      if (seenModels.has(label)) continue;
      seenModels.add(label);
      files.push({
        path: P('methodology', 'Models', `${label}.md`),
        frontmatter: { page: 'methodology', tab: 'Models', title: label, locale },
        body: m.Description ?? '',
      });
    }
  }

  // Data processing tab: deduped union of every DataType's Processing.
  const seenProc = new Set();
  for (const dt of dataTypes) {
    for (const p of named(dt.Processing)) {
      const label = p.Label.trim();
      if (seenProc.has(label)) continue;
      seenProc.add(label);
      files.push({
        path: P('methodology', 'Data processing', `${label}.md`),
        frontmatter: { page: 'methodology', tab: 'Data processing', title: label, locale },
        body: p.Description ?? '',
      });
    }
  }

  // Impact tab: nested per impact -> category -> item.
  for (const dt of dataTypes) {
    const impact = (dt.Label ?? '').trim();
    for (const [category, key] of IMPACT_CATEGORIES) {
      const base = P('methodology', 'Impact', impact, category);
      const items = named(dt[key]);
      if (items.length === 0) {
        // expected category with no Strapi content -> empty placeholder
        files.push({
          path: join(base, 'empty.md'),
          frontmatter: { page: 'methodology', tab: 'Impact', impact, category, title: '', locale },
          body: '',
        });
        continue;
      }
      for (const it of items) {
        const label = it.Label.trim();
        files.push({
          path: join(base, `${slug(label)}.md`),
          frontmatter: { page: 'methodology', tab: 'Impact', impact, category, title: label, locale },
          body: it.Description ?? '',
        });
      }
    }
  }

  // Key terms tab: from glossaries.
  for (const g of glossJson?.data ?? []) {
    const a = g.attributes ?? {};
    const title = (a.Title ?? '').trim();
    if (!title) continue;
    files.push({
      path: P('methodology', 'Key terms', `${title}.md`),
      frontmatter: { page: 'methodology', tab: 'Key terms', title, locale },
      body: a.Description ?? '',
    });
  }

  return files;
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
  } catch { /* no .env */ }
  return env;
}

async function get(base, locale, path) {
  const url = `${base}/api/${path}${path.includes('?') ? '&' : '?'}locale=${locale}&pagination[limit]=9999`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

async function main() {
  const env = await loadEnv();
  const base = (env.BASE ?? env.VITE_CMS_URL ?? '').replace(/\/$/, '');
  const locale = env.LOCALE ?? env.VITE_STRAPI_LOCALE ?? 'en';
  const out = env.OUT ?? 'strapi/new';
  if (!base) throw new Error('No base URL (set BASE or VITE_CMS_URL).');

  console.log(`Organizing pages from ${base} (locale=${locale}) → ${out}/`);

  const [about, methodology, glossaries] = await Promise.all([
    get(base, locale, 'about?populate=*'),
    get(base, locale, 'methodology?populate[DataType][populate]=*'),
    get(base, locale, 'glossaries?populate=*'),
  ]);

  await rm(out, { recursive: true, force: true });

  const files = [...aboutFiles(about, locale), ...methodologyFiles(methodology, glossaries, locale)];
  const seen = new Set();
  let empty = 0;
  let collisions = 0;
  for (const f of files) {
    const full = join(out, f.path);
    // Paths are slug(label)-addressed; two labels can map to the same file and
    // silently overwrite. Warn so dropped sections don't pass unnoticed.
    if (seen.has(full)) { console.warn(`  ⚠ collision (overwriting): ${full}`); collisions++; }
    seen.add(full);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, serialize(f.frontmatter, f.body));
    if (!String(f.body ?? '').trim()) empty++;
  }
  console.log(`Done. ${files.length} files written (${empty} empty placeholder(s)${collisions ? `, ⚠ ${collisions} collision(s)` : ''}) to ${out}/`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
