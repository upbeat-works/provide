const origin = process.argv[2] ?? process.env.PROVIDE_DEV_ORIGIN ?? 'http://localhost:8080';

const modules = [
  ['/api/conventions.ts'],
  ['/api/scoreboard/boundaries.ts'],
  ['/api/scoreboard/countries.ts'],
  ['/api/scoreboard/controller.js'],
  ['/api/scoreboard/heat-stress.json?import'],
  ['/api/scoreboard/testing.json?import'],
  ['/api/scoreboard/socioeconomic.json?import'],
  ['/api/db/import/country-iso3.ts'],
];

let failed = false;

for (const [path] of modules) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(10_000) });
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  const transformed = response.ok && contentType.includes('javascript') && !body.trimStart().startsWith('{');
  if (transformed) {
    console.log(`PASS module path=${path} status=${response.status}`);
    continue;
  }
  failed = true;
  console.error(`FAIL module path=${path} status=${response.status} type=${contentType || 'missing'}`);
}

const apiPath = '/api/scoreboard/map';
const apiResponse = await fetch(new URL(apiPath, origin), { signal: AbortSignal.timeout(10_000) });
const apiContentType = apiResponse.headers.get('content-type') ?? '';
let apiBody;
try {
  apiBody = await apiResponse.json();
} catch {
  apiBody = null;
}
if (apiResponse.status === 400 && apiContentType.includes('application/json') && typeof apiBody?.error === 'string') {
  console.log(`PASS backend path=${apiPath} status=${apiResponse.status}`);
} else {
  failed = true;
  console.error(`FAIL backend path=${apiPath} status=${apiResponse.status} type=${apiContentType || 'missing'}`);
}

if (failed) process.exitCode = 1;
