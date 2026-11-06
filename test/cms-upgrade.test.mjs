import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runUpgrade(t, databaseState) {
  const root = mkdtempSync(path.join(tmpdir(), 'cms-upgrade-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'scripts'));
  mkdirSync(path.join(root, 'bin'));
  cpSync(new URL('../scripts/test-cms-upgrade.sh', import.meta.url), path.join(root, 'scripts/test-cms-upgrade.sh'));
  writeFileSync(path.join(root, 'bin', 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  writeFileSync(path.join(root, 'bin', 'docker'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const statePath = process.env.DATABASE_STATE_FILE;
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath)) : { checks: 0, ready: false };
fs.appendFileSync(process.env.TRACE, JSON.stringify(args) + '\\n');
if (args[0] === 'exec' && args.includes('pg_isready')) process.exit(0);
if (args[0] === 'exec' && args.includes('psql')) {
  if (args.includes('SELECT 1')) {
    state.checks++;
    const tcp = args.includes('--host=127.0.0.1') || args[args.indexOf('-h') + 1] === '127.0.0.1';
    const database = args[args.indexOf('-d') + 1] === 'migration';
    state.ready = process.env.DATABASE_STATE === 'starting' && state.checks >= 3 && tcp && database;
    fs.writeFileSync(statePath, JSON.stringify(state));
    process.exit(state.ready ? 0 : 1);
  }
  if (!state.ready) {
    console.error('FATAL: database "migration" does not exist');
    process.exit(2);
  }
}
`, { mode: 0o755 });
  const trace = path.join(root, 'trace');
  const result = spawnSync('bash', [path.join(root, 'scripts/test-cms-upgrade.sh')], {
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      PATH: `${root}/bin:${process.env.PATH}`,
      TRACE: trace,
      DATABASE_STATE: databaseState,
      DATABASE_STATE_FILE: path.join(root, 'database-state.json'),
    },
  });
  const calls = readFileSync(trace, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  return { result, calls };
}

test('CMS upgrade waits for the test database before seeding and migrating', (t) => {
  const { result, calls } = runUpgrade(t, 'starting');
  assert.equal(result.status, 0, result.stderr);
  const images = calls.filter((args) => args[0] === 'run').flat();
  assert.ok(images.includes('provide-cms-upgrade-v4'));
  assert.ok(images.includes('provide-cms-upgrade-v5'));
});

test('CMS upgrade stops before creating the schema when the database stays unavailable', (t) => {
  const { result, calls } = runUpgrade(t, 'unavailable');
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /database.*not ready/i);
  assert.equal(calls.some((args) => args.includes('CREATE SCHEMA strapi')), false);
  assert.equal(calls.some((args) => args[0] === 'run' && args.includes('provide-cms-upgrade-v4')), false);
});
