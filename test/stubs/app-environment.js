// `$app/environment` under vitest: the tests render in jsdom, so this is the
// browser. A test that needs the server side mocks this module.
export const browser = true;
export const dev = true;
export const building = false;
export const version = 'test';
