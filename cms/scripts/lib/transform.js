'use strict';
/**
 * Pure transform: a production REST entry's `attributes` object -> the `data`
 * object for `strapi.entityService.create`.
 *
 * - toCreateData(attributes, mediaIdMap): cleaned create payload
 * - collectMedia(attributes): every nested media file node ({ id, attributes })
 *
 * Rules (derived from real production payloads):
 * - Top-level `createdAt`/`updatedAt`/`localizations` are dropped; `publishedAt`
 *   and `locale` are kept so entries stay published in the right locale.
 * - Component / dynamic-zone items carry their own `id` — strip it (Strapi mints
 *   fresh ones) but keep `__component` and all real fields.
 * - Media fields are v4 wrappers `{ data: { id, attributes: { url, ... } } }`
 *   (or `{ data: [ ... ] }`, or `{ data: null }`). They are rewritten to the
 *   local file id via `mediaIdMap` (keyed by the production media id).
 * - Content relations are also `{ data: ... }` wrappers, distinguished from media
 *   because their `attributes` have no `url`. They are omitted here and wired in
 *   a later pass.
 */

const DROP_KEYS = new Set(['createdAt', 'updatedAt']);
const TOP_DROP_KEYS = new Set(['createdAt', 'updatedAt', 'localizations']);

const isWrapper = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && 'data' in v;
const isFileNode = (n) => n && typeof n === 'object' && n.attributes && typeof n.attributes === 'object' && 'url' in n.attributes;

// 'single' | 'multi' | 'empty' | false
function mediaKind(v) {
  if (!isWrapper(v)) return false;
  const d = v.data;
  if (d == null) return 'empty';
  if (Array.isArray(d)) return d.length && d.every(isFileNode) ? 'multi' : false;
  return isFileNode(d) ? 'single' : false;
}

function isRelation(v) {
  if (!isWrapper(v)) return false;
  const d = v.data;
  if (d == null) return true; // empty relation -> omit
  const arr = Array.isArray(d) ? d : [d];
  return arr.length > 0 && arr.every((x) => x && x.attributes && !('url' in x.attributes));
}

// Clean a component / dynamic-zone item (plain object, no `data` wrapper).
function cleanComponent(obj, mediaIdMap) {
  if (Array.isArray(obj)) return obj.map((o) => cleanComponent(o, mediaIdMap));
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || DROP_KEYS.has(k)) continue;
    const cleaned = cleanValue(v, mediaIdMap);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out;
}

function cleanValue(value, mediaIdMap) {
  // Any single-key `{ data: ... }` wrapper is media or a relation — never a
  // component. Resolve it here so a raw wrapper can never leak into the payload.
  if (isWrapper(value)) {
    const d = value.data;
    const mk = mediaKind(value);
    if (mk === 'single') return mediaIdMap.get(d.id) ?? null;
    if (mk === 'multi') return d.map((n) => mediaIdMap.get(n.id)).filter((id) => id != null);
    if (d == null) return null; // empty single media/relation -> null (safe for both)
    return undefined; // populated content relation or empty to-many -> omit (wired later)
  }
  if (Array.isArray(value)) return value.map((v) => cleanComponent(v, mediaIdMap));
  if (value && typeof value === 'object') return cleanComponent(value, mediaIdMap);
  return value;
}

function toCreateData(attributes, mediaIdMap) {
  const out = {};
  for (const [k, v] of Object.entries(attributes)) {
    if (TOP_DROP_KEYS.has(k)) continue;
    const cleaned = cleanValue(v, mediaIdMap);
    if (cleaned !== undefined) out[k] = cleaned;
  }
  return out;
}

function collectMedia(node, acc = new Map()) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectMedia(n, acc));
  } else if (node && typeof node === 'object') {
    const mk = mediaKind(node);
    if (mk === 'single') acc.set(node.data.id, node.data);
    else if (mk === 'multi') node.data.forEach((n) => acc.set(n.id, n));
    else if (!isRelation(node)) {
      for (const v of Object.values(node)) collectMedia(v, acc);
    }
  }
  return Array.from(acc.values());
}

module.exports = { toCreateData, collectMedia };
