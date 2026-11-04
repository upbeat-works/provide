import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { get } from 'node:http';

const output = execFileSync('docker', ['compose', 'ps', '--format', 'json'], { encoding: 'utf8' });
const services = output.trim().split('\n').map((line) => JSON.parse(line));

for (const name of ['api', 'cms', 'web']) {
  const service = services.find((entry) => entry.Service === name);
  assert.equal(service?.Health, 'healthy', `${name} must pass its readiness check`);
}

const origin = process.env.PROVIDE_DEV_ORIGIN ?? 'http://localhost:8080';
for (const [path, host] of [['/api/'], ['/@vite/client'], ['/_health', 'cms.localhost']]) {
  const status = await new Promise((resolve, reject) => {
    get(new URL(path, origin), {
      headers: host ? { Host: host } : {},
      signal: AbortSignal.timeout(10_000),
    }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.ok(status >= 200 && status < 300, `${host ?? origin}${path} returned ${status}`);
  console.log(`PASS ${host ?? origin}${path}`);
}
