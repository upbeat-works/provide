import { afterEach, describe, expect, test } from 'vitest';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const copies: string[] = [];
afterEach(async () => Promise.all(copies.splice(0).map((copy) => rm(copy, { recursive: true, force: true }))));

describe('API package boundary', () => {
  test('builds when only API source is packaged', async () => {
    const copy = await mkdtemp(path.join(process.cwd(), '.scoreboard-api-package-'));
    copies.push(copy);
    await cp(path.join(process.cwd(), 'api'), path.join(copy, 'api'), { recursive: true });

    const output = execFileSync('bun', [
      'build', path.join(copy, 'api/index.ts'), '--target', 'bun', '--outfile', path.join(copy, 'index.js'),
    ], { encoding: 'utf8', stdio: 'pipe' });

    expect(output).toContain('index.js');
  });
});
