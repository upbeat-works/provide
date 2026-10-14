import { afterEach, describe, expect, test } from 'vitest';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const copies: string[] = [];
afterEach(async () => Promise.all(copies.splice(0).map((copy) => rm(copy, { recursive: true, force: true }))));

describe('API package boundary', () => {
  test('builds and discovers topics when only API source is packaged', async () => {
    const copy = await mkdtemp(path.join(process.cwd(), '.scoreboard-api-package-'));
    copies.push(copy);
    await cp(path.join(process.cwd(), 'api'), path.join(copy, 'api'), { recursive: true });

    const output = execFileSync('bun', [
      'build', path.join(copy, 'api/index.ts'), '--target', 'bun', '--outfile', path.join(copy, 'index.js'),
    ], { encoding: 'utf8', stdio: 'pipe' });

    expect(output).toContain('index.js');

    const topic = JSON.parse(await readFile(path.join(copy, 'api/scoreboard/topics/testing.json'), 'utf8'));
    topic.label = 'Packaged topic';
    await writeFile(path.join(copy, 'api/scoreboard/topics/packaged-topic.json'), JSON.stringify(topic));
    const result = execFileSync('bun', ['-e', `
      import { api } from './api/index.ts';
      import { tmpdir } from 'node:os';
      process.chdir(tmpdir());
      const response = await api.request('/api/scoreboard/definition?sector=packaged-topic');
      const definition = await response.json();
      console.log(JSON.stringify({ status: response.status, sector: definition.sector, charts: definition.charts }));
    `], { cwd: copy, encoding: 'utf8', stdio: 'pipe' });
    expect(JSON.parse(result)).toMatchObject({ status: 200, sector: { uid: 'packaged-topic', label: 'Packaged topic' }, charts: topic.charts });
  });
});
