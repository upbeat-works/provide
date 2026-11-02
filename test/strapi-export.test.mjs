import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const responses = {
  about: { data: { documentId: 'about', Section: [{ Title: 'The dashboard', Text: 'About this project.' }] } },
  scenarios: { data: [{ documentId: 'scenario', UID: 'current-policies', Description: 'Scenario details.' }] },
  methodology: { data: { documentId: 'methodology', DataType: [{ Label: 'Heat', Model: [{ Label: 'Climate model', Description: 'Model details.' }] }] } },
  glossaries: { data: [{ documentId: 'term', Title: 'Risk', Description: 'Risk details.' }] },
};

for (const [script, expected] of [
  ['index.js', { 'about/01_the_dashboard.md': 'About this project.', 'scenarios/current_policies/description.md': 'Scenario details.' }],
  ['pages.js', { 'about/the_dashboard.md': 'About this project.', 'methodology/models/climate_model.md': 'Model details.', 'methodology/key_terms/risk.md': 'Risk details.' }],
]) {
  test(`${script} exports readable content from the CMS`, async (t) => {
    const out = await mkdtemp(join(tmpdir(), 'provide-export-'));
    const server = createServer((req, res) => {
      const type = new URL(req.url, 'http://localhost').pathname.split('/').at(-1);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(responses[type] ?? { data: [] }));
    });
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await rm(out, { recursive: true, force: true });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const child = spawn(process.execPath, [`scripts/strapi-export/${script}`], {
      env: { ...process.env, BASE: `http://127.0.0.1:${server.address().port}`, LOCALE: 'en-EU', OUT: out },
      stdio: 'pipe',
    });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    assert.equal(status, 0, output);
    for (const [file, content] of Object.entries(expected)) {
      const written = await readFile(join(out, file), 'utf8').catch(() => '');
      assert.ok(written.includes(content), `${file} should contain ${content}`);
    }
  });
}
