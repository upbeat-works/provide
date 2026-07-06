'use strict';
// Pure helpers to read the vendored content-type + component schemas and derive
// what the REST fetch/import need: API path, kind, i18n, and a deep-populate spec.
const fs = require('node:fs');
const path = require('node:path');

const API_DIR = path.join(__dirname, '..', '..', 'src', 'api');
const COMPONENTS_DIR = path.join(__dirname, '..', '..', 'src', 'components');

// Read every component schema, keyed by its "category.name" component uid.
function loadComponents(componentsDir = COMPONENTS_DIR) {
  const map = {};
  for (const category of fs.readdirSync(componentsDir)) {
    const catDir = path.join(componentsDir, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    for (const file of fs.readdirSync(catDir)) {
      if (!file.endsWith('.json')) continue;
      const uid = `${category}.${file.replace(/\.json$/, '')}`;
      map[uid] = JSON.parse(fs.readFileSync(path.join(catDir, file), 'utf-8'));
    }
  }
  return map;
}

// Read every content-type schema with its info/attributes/kind/i18n flag.
function loadContentTypes(apiDir = API_DIR) {
  const types = [];
  for (const api of fs.readdirSync(apiDir)) {
    const ctDir = path.join(apiDir, api, 'content-types');
    if (!fs.existsSync(ctDir)) continue;
    for (const name of fs.readdirSync(ctDir)) {
      const schemaPath = path.join(ctDir, name, 'schema.json');
      if (!fs.existsSync(schemaPath)) continue;
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
      types.push({
        uid: `api::${schema.info.singularName}.${schema.info.singularName}`,
        singularName: schema.info.singularName,
        pluralName: schema.info.pluralName,
        kind: schema.kind, // 'singleType' | 'collectionType'
        i18n: Boolean(schema.pluginOptions?.i18n?.localized),
        attributes: schema.attributes || {},
        schema,
      });
    }
  }
  return types;
}

// Build a Strapi v4 `populate` object that walks components and dynamic zones so
// their nested media/components come back. Depth is bounded; components resolve
// their own attributes recursively via the components map.
function buildPopulate(attributes, components, depth = 4) {
  const populate = {};
  for (const [name, attr] of Object.entries(attributes)) {
    if (depth <= 0) continue;
    if (attr.type === 'media' || attr.type === 'relation') {
      populate[name] = true;
    } else if (attr.type === 'component') {
      const comp = components[attr.component];
      const inner = comp ? buildPopulate(comp.attributes || {}, components, depth - 1) : {};
      populate[name] = Object.keys(inner).length ? { populate: inner } : true;
    } else if (attr.type === 'dynamiczone') {
      const inner = {};
      for (const compUid of attr.components || []) {
        const comp = components[compUid];
        if (!comp) continue;
        Object.assign(inner, buildPopulate(comp.attributes || {}, components, depth - 1));
      }
      populate[name] = Object.keys(inner).length ? { populate: inner } : true;
    }
  }
  return populate;
}

module.exports = { loadComponents, loadContentTypes, buildPopulate, API_DIR, COMPONENTS_DIR };
