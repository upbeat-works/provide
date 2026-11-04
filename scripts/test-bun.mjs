import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function testFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return testFiles(path);
    if (/\.(test|spec)\.[jt]s$/.test(entry.name) && /from ['"]bun:test['"]/.test(readFileSync(path, 'utf8'))) return [`./${path}`];
    return [];
  });
}

const result = spawnSync('bun', ['test', ...process.argv.slice(2), ...testFiles('api'), ...testFiles('src')], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
