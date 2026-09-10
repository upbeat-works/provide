import { expect, test, vi } from 'vitest';
import { sendLegacyAvoidRequest } from './legacy-avoid-request.js';

test('does not send an old API request when the canonical source pair cannot translate', () => {
  const fetcher = vi.fn();
  sendLegacyAvoidRequest(fetcher, {}, '/avoiding-impact', undefined, { level: 2 });
  expect(fetcher).not.toHaveBeenCalled();
});
