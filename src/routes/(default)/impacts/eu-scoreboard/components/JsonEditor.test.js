import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import { highlightAll } from 'microlighter';
import JsonEditor from './JsonEditor.svelte';

vi.mock('microlighter', () => ({ highlightAll: vi.fn(async ({ root }) => [...root.querySelectorAll('code')]) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

test('highlights the initial JSON and edits, including incomplete JSON', async () => {
  vi.stubGlobal('CSS', { highlights: new Map() });
  vi.stubGlobal('Highlight', Set);
  const { getByRole } = render(JsonEditor, { id: 'json', value: '{"count": 2}' });
  const input = getByRole('textbox');
  await waitFor(() => expect(highlightAll).toHaveBeenCalled());
  expect(highlightAll.mock.calls.at(-1)[0].root.textContent).toContain('{"count": 2}');
  highlightAll.mockClear();
  await fireEvent.input(input, { target: { value: '{"count":' } });
  await waitFor(() => expect(highlightAll).toHaveBeenCalled());
  expect(highlightAll.mock.calls.at(-1)[0].root.textContent).toContain('{"count":');
  expect(input.value).toBe('{"count":');
});

test('keeps plain JSON editable when highlights are not supported', async () => {
  vi.stubGlobal('CSS', {});
  const { getByRole } = render(JsonEditor, { id: 'json', value: '{}' });
  const input = getByRole('textbox');
  await fireEvent.input(input, { target: { value: '{"enabled": true}' } });
  expect(input.value).toBe('{"enabled": true}');
  expect(highlightAll).not.toHaveBeenCalled();
});
