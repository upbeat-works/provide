import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const coverage =
  'mean-temperature__2011-2020-present-day__annual__area__50th-percentile__2020-climate-policies__cameroon__2030'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

async function runBootstrap(capabilities: string) {
  const importDirectory = await mkdtemp(join(tmpdir(), 'provide-geoserver-'))
  temporaryDirectories.push(importDirectory)
  await writeFile(join(importDirectory, `${coverage}.nc`), '')
  const binDirectory = join(importDirectory, 'bin')
  const curlPath = join(binDirectory, 'curl')
  await mkdir(binDirectory)
  await writeFile(
    curlPath,
    `#!/bin/sh
for argument do
  case "$argument" in
    *request=GetCapabilities*) printf '%s' "$FAKE_CAPABILITIES" ;;
  esac
done
`,
  )
  await chmod(curlPath, 0o755)

  const process = Bun.spawn(['/bin/sh', join(import.meta.dir, 'bootstrap.sh')], {
    env: {
      ...Bun.env,
      FAKE_CAPABILITIES: capabilities,
      GEOSERVER_IMPORT_DIR: importDirectory,
      GEOSERVER_URL: 'http://geoserver.test/geoserver',
      PATH: `${binDirectory}:${Bun.env.PATH}`,
    },
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const [exitCode, stderr] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
  ])
  return { exitCode, stderr }
}

describe('GeoServer bootstrap', () => {
  test('fails when GeoServer cannot advertise a published NetCDF coverage', async () => {
    const result = await runBootstrap(
      '<wcs:WCS_Capabilities xmlns:wcs="http://www.opengis.net/wcs" />',
    )

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain(`GeoServer did not advertise provide:${coverage}`)
  })

  test('succeeds when GeoServer advertises the published NetCDF coverage', async () => {
    const result = await runBootstrap(
      `<wcs:WCS_Capabilities xmlns:wcs="http://www.opengis.net/wcs"><wcs:name>provide:${coverage}</wcs:name></wcs:WCS_Capabilities>`,
    )

    expect(result).toEqual({ exitCode: 0, stderr: '' })
  })
})
