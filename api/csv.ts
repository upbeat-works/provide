// RFC-4180 CSV serialisation for the download endpoints. Pure and
// domain-agnostic: views turn their response into rows, this turns rows into
// bytes.

export type CsvCell = string | number | undefined | null;

/**
 * Quote a cell only when it needs it (separator, quote, CR/LF). Embedded quotes
 * are doubled. `undefined`/`null` become an empty field, and a non-finite number
 * (NaN from a missing year cell) does too rather than serialising as "NaN".
 */
export function csvCell(value: CsvCell): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Header row + data rows as a single CRLF-delimited CSV document. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/**
 * A filename-safe slug of the parts (indicator/region names carry spaces,
 * parentheses and the odd degree sign), joined with underscores.
 */
export function csvFilename(...parts: (string | undefined)[]): string {
  const slug = parts
    .filter((p): p is string => Boolean(p))
    .map((p) => p.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('_');
  return `${slug || 'download'}.csv`;
}

/** The response headers that make a browser save the body as `filename`. */
export function csvHeaders(filename: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  };
}
