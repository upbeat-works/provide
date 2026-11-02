import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

for (const failure of ['', 'backup', 'restore']) {
  test(`CMS copy ${failure || 'success'} preserves the backup-before-restore order`, (t) => {
    const root = mkdtempSync(path.join(tmpdir(), 'cms-copy-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(path.join(root, 'scripts'));
    mkdirSync(path.join(root, 'bin'));
    cpSync(new URL('../scripts/cms-pull.sh', import.meta.url), path.join(root, 'scripts/cms-pull.sh'));
    const mock = `#!/bin/sh
command_name=$(basename "$0")
printf '%s %s\\n' "$command_name" "$*" >> "$TRACE"
case "$command_name $*" in
  'pg_dump --host='*) [ "$FAIL_AT" != backup ] || exit 1 ;;
  'pg_restore '*) [ "$FAIL_AT" != restore ] || exit 1 ;;
esac
`;
    for (const command of ['pg_dump', 'pg_restore', 'docker']) writeFileSync(path.join(root, 'bin', command), mock, { mode: 0o755 });
    const trace = path.join(root, 'trace');
    const result = spawnSync('bash', [path.join(root, 'scripts/cms-pull.sh')], { env: {
      ...process.env, PATH: `${root}/bin:${process.env.PATH}`, TRACE: trace, FAIL_AT: failure,
      CMS_PG_SERVICE: 'remote', DB_USER: 'local', DB_NAME: 'local_copy',
    } });
    const calls = readFileSync(trace, 'utf8').trim().split('\n');
    assert.match(calls[0], /^pg_dump --dbname=service=remote/);
    assert.equal(calls[1], 'docker compose stop cms');
    assert.match(calls[2], /^pg_dump --host=localhost/);
    if (failure === 'backup') assert.equal(calls.length, 3);
    else assert.match(calls[3], /^pg_restore .*--single-transaction/);
    if (!failure) assert.equal(calls[4], 'docker compose start cms');
    else assert.equal(calls.some((call) => call === 'docker compose start cms'), false);
    assert.equal(result.status, failure ? 1 : 0);
  });
}
