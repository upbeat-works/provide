import { afterEach, expect, test } from 'bun:test';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const coverage = 'low-demand_cameroon_mean-temperature-2011-2020-present-day_annual_area_50th-percentile_2030';
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function runBootstrap(filename: string, capabilities: string) {
  const directory = await mkdtemp(join(tmpdir(), 'provide-geoserver-'));
  temporaryDirectories.push(directory);
  await writeFile(join(directory, filename), '');
  const bin = join(directory, 'bin');
  await mkdir(bin);
  const curl = join(bin, 'curl');
  const curlLog = join(directory, 'curl.log');
  await writeFile(curl, `#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_CURL_LOG"
for argument do
  case "$argument" in
    *request=GetCapabilities*) printf '%s' "$FAKE_CAPABILITIES" ;;
  esac
done
`);
  await chmod(curl, 0o755);
  const process = Bun.spawn(['/bin/sh', join(import.meta.dir, 'bootstrap.sh')], {
    env: { ...Bun.env, FAKE_CAPABILITIES: capabilities, FAKE_CURL_LOG: curlLog, GEOSERVER_IMPORT_DIR: directory,
      GEOSERVER_URL: 'http://geoserver.test/geoserver', GEOSERVER_AUTH: 'publisher:test-password', PATH: `${bin}:${Bun.env.PATH}` },
    stdout: 'pipe', stderr: 'pipe',
  });
  const exitCode = await process.exited;
  const calls = await Bun.file(curlLog).exists() ? await Bun.file(curlLog).text() : '';
  return { exitCode, calls };
}

test('rejects a file outside the coverage naming convention before publication', async () => {
  const result = await runBootstrap(
    'Low Demand_cameroon_mean-temperature-2011-2020-present-day_annual_area_50th-percentile_2030.nc',
    '',
  );
  expect(result.exitCode).not.toBe(0);
  expect(result.calls).toBe('');
});

test('requires every published filename in WCS 1 capabilities', async () => {
  const missing = await runBootstrap(`${coverage}.nc`, '<WCS_Capabilities/>');
  expect(missing.exitCode).not.toBe(0);
  const advertised = await runBootstrap(`${coverage}.nc`, `<name>provide:${coverage}</name>`);
  expect(advertised.exitCode).toBe(0);
  const verification = advertised.calls.split('\n').find((call) => call.includes('request=GetCapabilities'));
  expect(verification).toContain('-u publisher:test-password');
});
