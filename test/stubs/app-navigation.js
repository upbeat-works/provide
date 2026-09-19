// Inert stand-in for SvelteKit's `$app/navigation` under vitest, which renders
// components without a running router. A test that asserts on navigation mocks
// this module (`vi.mock('$app/navigation', …)`); this keeps the import
// resolvable for every test that merely renders something importing it.
export const goto = async () => {};
export const invalidate = async () => {};
export const invalidateAll = async () => {};
export const beforeNavigate = () => {};
export const afterNavigate = () => {};
export const preloadData = async () => {};
export const preloadCode = async () => {};
export const pushState = () => {};
export const replaceState = () => {};
