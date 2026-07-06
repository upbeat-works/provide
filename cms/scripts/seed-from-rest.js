'use strict';
/**
 * Seed the LOCAL Strapi from a production snapshot (see fetch-snapshot.js).
 * Boots Strapi programmatically and writes via the entity service.
 *
 *   1. media pre-pass  — create a local file row per Cloudinary media (keeping
 *                        the absolute URL), building prodMediaId -> localFileId.
 *   2. entries         — wipe + recreate each type per locale (published), with
 *                        media refs rewritten and content relations deferred.
 *   3. relations       — wire scenario <-> scenario-preset by title, per locale.
 *
 * Run with the dev server stopped. Usage: node scripts/seed-from-rest.js [snapDir]
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadContentTypes } = require('./lib/schema');
const { toCreateData, collectMedia } = require('./lib/transform');

const SNAP = process.argv[2] || path.join(__dirname, '..', '.snapshot');
const LOCALES = ['en', 'en-EU'];
const PRIMARY = 'en-EU';
const SKIP = new Set(['case-study']); // not publicly exposed on prod

function readSnap(singularName, locale) {
  const f = path.join(SNAP, `${singularName}.${locale}.json`);
  if (!fs.existsSync(f)) return [];
  const d = JSON.parse(fs.readFileSync(f, 'utf-8')).data;
  return Array.isArray(d) ? d : d ? [d] : [];
}

async function main() {
  const strapi = await require('@strapi/strapi')().load();
  const log = (m) => strapi.log.info(`[seed] ${m}`);
  try {
    const types = loadContentTypes().filter((t) => !SKIP.has(t.singularName));

    // ---- 0. ensure required locales exist (a fresh Strapi has only `en`) ----
    const localeService = strapi.plugin('i18n').service('locales');
    const haveLocales = (await localeService.find()).map((l) => l.code);
    for (const code of LOCALES) {
      if (!haveLocales.includes(code)) {
        await localeService.create({ code, name: code });
        log(`created locale ${code}`);
      }
    }

    // ---- 1. media pre-pass ----
    const mediaNodes = new Map();
    for (const t of types) {
      for (const loc of LOCALES) {
        for (const e of readSnap(t.singularName, loc)) {
          for (const m of collectMedia(e.attributes)) mediaNodes.set(m.id, m);
        }
      }
    }
    // Wipe existing files so re-runs stay idempotent (content types are wiped
    // below; the files table must be cleared here or media rows accumulate).
    await strapi.db.query('plugin::upload.file').deleteMany({ where: {} });
    const mediaIdMap = new Map();
    for (const [prodId, node] of mediaNodes) {
      const a = node.attributes;
      const rec = await strapi.db.query('plugin::upload.file').create({
        data: {
          name: a.name, alternativeText: a.alternativeText, caption: a.caption,
          width: a.width, height: a.height, formats: a.formats, hash: a.hash,
          ext: a.ext, mime: a.mime, size: a.size, url: a.url,
          previewUrl: a.previewUrl, provider: a.provider || 'cloudinary',
          provider_metadata: a.provider_metadata, folderPath: '/',
        },
      });
      mediaIdMap.set(prodId, rec.id);
    }
    log(`media: created ${mediaIdMap.size} file rows`);

    // ---- 2. entries (wipe + recreate per locale) ----
    const idByKey = {}; // uid -> locale -> Map(businessKey -> localId)
    for (const t of types) {
      await strapi.db.query(t.uid).deleteMany({ where: {} });
      idByKey[t.uid] = {};
      const locales = t.i18n ? LOCALES : [PRIMARY];
      let count = 0;
      const failures = [];
      for (const locale of locales) {
        idByKey[t.uid][locale] = new Map();
        for (const e of readSnap(t.singularName, locale)) {
          const key = e.attributes.UID ?? e.attributes.Title ?? e.attributes.Name ?? `#${e.id}`;
          try {
            const data = toCreateData(e.attributes, mediaIdMap);
            // Strapi's i18n decorator reads the target locale from data.locale,
            // so keep it for localized types and strip it for non-localized ones.
            if (!t.i18n) delete data.locale;
            const rec = await strapi.entityService.create(t.uid, { data });
            idByKey[t.uid][locale].set(key, rec.id);
            count += 1;
          } catch (err) {
            // Keep going so ONE run surfaces every schema-vs-prod-data drift.
            failures.push(`${locale}/${key}: ${err.message}`);
          }
        }
      }
      log(`${t.singularName}: created ${count} entries` + (failures.length ? ` — ${failures.length} FAILED` : ''));
      for (const f of failures) log(`  ✗ ${t.singularName} ${f}`);
    }

    // ---- 3. wire scenario <-> scenario-preset (by title) per locale ----
    const scenarioUid = 'api::scenario.scenario';
    const presetUid = 'api::scenario-preset.scenario-preset';
    let wired = 0;
    for (const locale of LOCALES) {
      const presetByTitle = new Map();
      for (const p of readSnap('scenario-preset', locale)) {
        const localId = idByKey[presetUid]?.[locale]?.get(p.attributes.Title);
        if (localId) presetByTitle.set(p.attributes.Title, localId);
      }
      for (const s of readSnap('scenario', locale)) {
        const localId = idByKey[scenarioUid]?.[locale]?.get(s.attributes.UID);
        const presetTitles = (s.attributes.ScenarioPresets?.data ?? []).map((x) => x.attributes.Title);
        const presetIds = presetTitles.map((tt) => presetByTitle.get(tt)).filter(Boolean);
        if (localId && presetIds.length) {
          await strapi.entityService.update(scenarioUid, localId, { data: { ScenarioPresets: presetIds } });
          wired += 1;
        }
      }
    }
    log(`relations: wired ScenarioPresets on ${wired} scenarios`);

    // ---- 4. grant Public read permissions (a fresh Strapi grants none) ----
    const pubRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    const wanted = [];
    for (const t of types) {
      wanted.push(`${t.uid}.find`);
      if (t.kind === 'collectionType') wanted.push(`${t.uid}.findOne`);
    }
    const existing = await strapi.db
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: pubRole.id } });
    const have = new Set(existing.map((p) => p.action));
    let granted = 0;
    for (const action of wanted) {
      if (have.has(action)) continue;
      await strapi.db
        .query('plugin::users-permissions.permission')
        .create({ data: { action, role: pubRole.id } });
      granted += 1;
    }
    log(`permissions: granted ${granted} of ${wanted.length} public read actions`);
    log('done');
  } finally {
    await strapi.destroy();
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
