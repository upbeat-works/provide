/**
 * Fetches geography data from the Climate Analytics API and generates
 * a SQL seed file for the local D1 database.
 *
 * Usage: bun run api/db/seed.ts
 */

const API_URL = 'https://provide-api.iiasa.ac.at/api/meta/';

function esc(value: string | null | undefined): string {
  if (value == null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  console.log(`Fetching from ${API_URL}...`);
  const res = await fetch(API_URL);
  const meta = await res.json();

  const lines: string[] = [
    '-- Auto-generated seed file',
    `-- Source: ${API_URL}`,
    `-- Generated: ${new Date().toISOString()}`,
    '',
    'DELETE FROM geographies;',
    'DELETE FROM geography_types;',
    '',
  ];

  // Insert geography types
  for (const [i, gt] of meta.geographyTypes.entries()) {
    lines.push(
      `INSERT INTO geography_types (id, label, label_singular, "order", is_available) VALUES (${esc(gt.uid)}, ${esc(gt.label)}, ${esc(gt.labelSingular)}, ${i}, ${gt.isAvailable ? 1 : 0});`
    );
  }

  lines.push('');

  // Collect all geographies
  const allGeos: { uid: string; label: string; type: string; sharedId?: string }[] = [];

  for (const gt of meta.geographyTypes) {
    const geos = meta[gt.uid];
    if (!geos) continue;
    const entries = Array.isArray(geos) ? geos : Object.values(geos);
    for (const geo of entries as any[]) {
      allGeos.push({ uid: geo.uid, label: geo.label, type: gt.uid, sharedId: geo.sharedId });
    }
  }

  // Insert geographies (parent_id left NULL for now — legacy API uses loose group labels, not proper FKs)
  let totalGeos = 0;
  for (const gt of meta.geographyTypes) {
    const geos = allGeos.filter((g) => g.type === gt.uid);
    if (!geos.length) continue;

    lines.push(`-- ${gt.label} (${geos.length} entries)`);
    for (const geo of geos) {
      lines.push(
        `INSERT INTO geographies (id, label, geography_type, shared_id) VALUES (${esc(geo.uid)}, ${esc(geo.label)}, ${esc(geo.type)}, ${esc(geo.sharedId)});`
      );
      totalGeos++;
    }
    lines.push('');
  }

  const sql = lines.join('\n');
  const outPath = new URL('./seed.sql', import.meta.url).pathname;
  await Bun.write(outPath, sql);
  console.log(`Wrote ${meta.geographyTypes.length} geography types and ${totalGeos} geographies to ${outPath}`);
}

main().catch(console.error);
