'use strict';
/**
 * Fetch a read-only snapshot of production content via the public REST API,
 * one JSON file per (content-type, locale), with deep populate so nested
 * components + media come through. No writes to production.
 *
 * Usage: node scripts/fetch-snapshot.js [baseUrl] [outDir]
 * Defaults: https://provide-cms.herokuapp.com  ./.snapshot
 */
const fs = require('node:fs');
const path = require('node:path');
const qs = require('qs');
const { loadContentTypes, loadComponents, buildPopulate } = require('./lib/schema');

const BASE = process.argv[2] || 'https://provide-cms.herokuapp.com';
const OUT = process.argv[3] || path.join(__dirname, '..', '.snapshot');
const LOCALES = ['en', 'en-EU'];

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchType(type, components) {
  const populate = buildPopulate(type.attributes, components);
  // Strapi routes single types at the singular path (/api/about) and collection
  // types at the plural path (/api/scenarios).
  const route = type.kind === 'singleType' ? type.singularName : type.pluralName;
  const out = {};
  for (const locale of LOCALES) {
    if (type.kind === 'singleType') {
      const query = qs.stringify({ locale, populate }, { encodeValuesOnly: true });
      const body = await getJson(`${BASE}/api/${route}?${query}`);
      out[locale] = { data: body.data ?? null };
    } else {
      const all = [];
      let page = 1;
      let pageCount = 1;
      do {
        const query = qs.stringify(
          { locale, populate, pagination: { page, pageSize: 100 } },
          { encodeValuesOnly: true },
        );
        const body = await getJson(`${BASE}/api/${route}?${query}`);
        all.push(...(body.data ?? []));
        pageCount = body.meta?.pagination?.pageCount ?? 1;
        page += 1;
      } while (page <= pageCount);
      out[locale] = { data: all };
    }
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const components = loadComponents();
  const types = loadContentTypes();
  const summary = [];
  for (const type of types) {
    try {
      const out = await fetchType(type, components);
      for (const locale of LOCALES) {
        const file = path.join(OUT, `${type.singularName}.${locale}.json`);
        fs.writeFileSync(file, JSON.stringify(out[locale], null, 2));
      }
      const counts = LOCALES.map((l) => {
        const d = out[l].data;
        return `${l}=${Array.isArray(d) ? d.length : d ? 1 : 0}`;
      }).join(' ');
      summary.push(`  ${type.singularName} (${type.kind === 'singleType' ? 'single' : 'coll'}): ${counts}`);
    } catch (e) {
      summary.push(`  ${type.singularName}: ERROR ${e.message}`);
    }
  }
  console.log(`Snapshot written to ${OUT}:`);
  console.log(summary.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
