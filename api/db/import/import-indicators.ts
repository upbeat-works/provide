/**
 * Imports curated indicator enrichment (sector + legacy translation uid) from a
 * YAML into a SQLite seed file. Pure builders are exported for testing; the CLI
 * tail writes the file.
 *
 * Usage: bun run api/db/import/import-indicators.ts [yamlPath] [outPath]
 *
 * Additive: only indicators that need a curated fact ixmp4 can't provide (a
 * sector tag, or a `legacyUid` bridge to the frozen legacy /meta) appear here.
 * A missing row leaves that indicator unchanged in the indicator index.
 */
import { readFileSync } from 'node:fs';

export interface IndicatorRow {
  id: string;
  sector: string | null;
  legacyUid: string | null;
}

const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'per', 'to', 'via', 'with']);

function titleCasePart(part: string): string {
  if (/[A-Z].*[A-Z0-9°]|^[a-z][A-Z]/.test(part)) return part;
  return part.toLowerCase().replace(/[a-z]/, (letter) => letter.toUpperCase());
}

export function titleCaseIndicator(value: string): string {
  const words = value.split(' ');
  return words.map((word, index) => {
    const small = SMALL_WORDS.has(word.toLowerCase());
    if (small && index > 0 && index < words.length - 1) return word.toLowerCase();
    return word.split('-').map(titleCasePart).join('-');
  }).join(' ');
}

function esc(value: string | null | undefined): string {
  if (value == null || value === '') return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

/** Minimal YAML: a list of `- id:` blocks with optional `sector:`/`legacyUid:`. */
export function parseIndicatorsYaml(text: string): IndicatorRow[] {
  const rows: IndicatorRow[] = [];
  let cur: IndicatorRow | null = null;
  const val = (line: string) => {
    const v = line.slice(line.indexOf(':') + 1).trim();
    return v === '' ? null : v.replace(/^["']|["']$/g, '');
  };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (line === '' || line.trimStart().startsWith('#')) continue;
    if (line.startsWith('- id:')) {
      cur = { id: val(line) ?? '', sector: null, legacyUid: null };
      rows.push(cur);
    } else if (cur && line.trimStart().startsWith('sector:')) {
      cur.sector = val(line);
    } else if (cur && line.trimStart().startsWith('legacyUid:')) {
      cur.legacyUid = val(line);
    }
  }
  return rows;
}

export function buildIndicatorsSeedSql(rows: IndicatorRow[]): string {
  const ids = new Set<string>();
  const legacy = new Set<string>();
  for (const r of rows) {
    if (r.id !== titleCaseIndicator(r.id)) throw new Error(`indicator id is not in title case: "${r.id}"`);
    if (ids.has(r.id)) throw new Error(`duplicate id: "${r.id}"`);
    ids.add(r.id);
    if (r.legacyUid) {
      if (legacy.has(r.legacyUid)) throw new Error(`duplicate legacyUid: "${r.legacyUid}"`);
      legacy.add(r.legacyUid);
    }
  }
  const lines = ['-- Auto-generated PROVIDE indicator enrichment seed', '', 'DELETE FROM indicators;', ''];
  for (const r of rows) {
    lines.push(`INSERT INTO indicators (id, sector, legacy_uid) VALUES (${esc(r.id)}, ${esc(r.sector)}, ${esc(r.legacyUid)});`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---- CLI ----
if (import.meta.main) {
  const yamlPath = process.argv[2] ?? new URL('./indicators.yaml', import.meta.url).pathname;
  const outPath = process.argv[3] ?? new URL('../seed-indicators.sql', import.meta.url).pathname;
  const rows = parseIndicatorsYaml(readFileSync(yamlPath, 'utf-8'));
  await Bun.write(outPath, buildIndicatorsSeedSql(rows));
  console.log(`Wrote indicator enrichment seed to ${outPath} (${rows.length} rows).`);
}
