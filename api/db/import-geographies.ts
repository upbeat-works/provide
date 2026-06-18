/**
 * Imports the PROVIDE geographies YAML into a SQLite seed file.
 *
 * Usage: bun run api/db/import-geographies.ts [yamlPath] [outPath]
 *
 * Sources (committed in this directory so the seed is reproducible from a
 * clean checkout):
 *   yamlPath = api/db/geographies.yaml
 *   outPath  = api/db/seed.sql
 *
 * Convention: human-readable names act as both id and label for every
 * geography. Geography types are short stable slugs (cities, eez, admin0, …)
 * so the frontend can keep using `meta.cities`, `meta.eez`, `meta.admin0`.
 */
import { readFileSync } from 'node:fs';

const yamlPath = process.argv[2] ?? new URL('./geographies.yaml', import.meta.url).pathname;
const outPath = process.argv[3] ?? new URL('./seed.sql', import.meta.url).pathname;

function esc(value: string | null | undefined): string {
  if (value == null || value === '') return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

interface GType {
  id: string;
  items: string[];
}

// Type metadata, keyed by the YAML's top-level heading. We deliberately keep
// short, stable slugs as the geography_type id so the frontend keeps using
// `meta.cities`, `meta.eez` etc. (ixmp4 has no concept of geography type, so
// we are free to pick our own slugs). label stays as the YAML heading;
// label_singular feeds the modal copy ("Select a City").
const typeConfig: Record<string, { id: string; labelSingular: string }> = {
  'Countries': { id: 'admin0', labelSingular: 'Country' },
  'Cities': { id: 'cities', labelSingular: 'City' },
  'Exclusive Economic Zones (EEZ)': { id: 'eez', labelSingular: 'Exclusive Economic Zone (EEZ)' },
  'River Basins (RB)': { id: 'river_basins', labelSingular: 'River Basin (RB)' },
  'Glacier Regions (GR)': { id: 'glacier_regions', labelSingular: 'Glacier Region (GR)' },
  'Macroeconomies (ME)': { id: 'macroeconomies', labelSingular: 'Macroeconomy (ME)' },
  'Northern Latitudes': { id: 'northern_latitudes', labelSingular: 'Northern Latitude' },
};

const types: GType[] = [];
let currentType: GType | null = null;

const text = readFileSync(yamlPath, 'utf-8');
for (const rawLine of text.split('\n')) {
  const line = rawLine.replace(/\s+$/, ''); // trim trailing whitespace
  if (line === '') continue;

  // Type heading (top-level "- Name:" or standalone "- Name")
  if (line.startsWith('- ')) {
    let name = line.slice(2).trim();
    const hasColon = name.endsWith(':');
    if (hasColon) name = name.slice(0, -1).trim();

    if (hasColon) {
      currentType = { id: name, items: [] };
      types.push(currentType);
    } else {
      // Standalone entry: model as a singleton type whose only item shares its name.
      types.push({ id: name, items: [name] });
      currentType = null;
    }
  } else if (line.startsWith('  - ') && currentType) {
    currentType.items.push(line.slice(4).trim());
  }
}

const lines: string[] = [
  '-- Auto-generated PROVIDE geographies seed',
  `-- Source: ${yamlPath}`,
  `-- Generated: ${new Date().toISOString()}`,
  '',
  'DELETE FROM geographies;',
  'DELETE FROM geography_types;',
  '',
  '-- Geography types (id is a stable slug; label is the human heading)',
];

for (const sourceName of Object.keys(typeConfig)) {
  if (!types.some((t) => t.id === sourceName)) {
    throw new Error(`YAML contains no type "${sourceName}" — update typeConfig or check the source file.`);
  }
}

types.forEach((t, i) => {
  const cfg = typeConfig[t.id];
  if (!cfg) throw new Error(`Unmapped geography type in YAML: "${t.id}" — add it to typeConfig.`);
  lines.push(
    `INSERT INTO geography_types (id, label, label_singular, "order", is_available) VALUES (${esc(cfg.id)}, ${esc(t.id)}, ${esc(cfg.labelSingular)}, ${i}, 1);`,
  );
});
lines.push('');

for (const t of types) {
  const cfg = typeConfig[t.id];
  lines.push(`-- ${t.id} → ${cfg.id} (${t.items.length} entries)`);
  for (const item of t.items) {
    lines.push(
      `INSERT INTO geographies (id, label, geography_type, parent_id) VALUES (${esc(item)}, ${esc(item)}, ${esc(cfg.id)}, NULL);`,
    );
  }
  lines.push('');
}

await Bun.write(outPath, lines.join('\n'));
const total = types.reduce((s, t) => s + t.items.length, 0);
console.log(`Wrote ${types.length} types and ${total} geographies to ${outPath}`);
for (const t of types) {
  console.log(`  ${t.id.padEnd(42)} (${t.items.length})`);
}
