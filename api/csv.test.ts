import { describe, test, expect } from 'bun:test';
import { csvCell, toCsv, csvFilename, csvHeaders } from './csv';

describe('csvCell', () => {
  test('leaves plain values unquoted', () => {
    expect(csvCell('Mean Temperature')).toBe('Mean Temperature');
    expect(csvCell(1.5)).toBe('1.5');
  });

  test('quotes separators, quotes and newlines, doubling embedded quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  test('empties missing values and non-finite numbers', () => {
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(null)).toBe('');
    // A year a scenario has no data for arrives as NaN — it must not serialise
    // as the literal "NaN".
    expect(csvCell(NaN)).toBe('');
  });
});

describe('toCsv', () => {
  test('emits the header row followed by CRLF-delimited data rows', () => {
    expect(toCsv(['a', 'b'], [[1, 2], [3, 4]])).toBe('a,b\r\n1,2\r\n3,4');
  });

  test('emits just the header when there are no rows', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b');
  });
});

describe('csvFilename', () => {
  test('slugifies convention names into a safe filename', () => {
    expect(csvFilename('impact-time', 'Mean Temperature', 'France')).toBe('impact-time_Mean-Temperature_France.csv');
  });

  test('drops missing parts and trims separator runs', () => {
    expect(csvFilename('impact-time', undefined, '1850-1900 (Pre-industrial)')).toBe('impact-time_1850-1900-Pre-industrial.csv');
  });
});

describe('csvHeaders', () => {
  test('marks the body as a downloadable csv attachment', () => {
    expect(csvHeaders('x.csv')).toMatchObject({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="x.csv"',
    });
  });
});
