// @vitest-environment node
import { expect, test } from 'vitest';
import testTopic from '../../../../../test/fixtures/scoreboard/topics/testing.json';
import { encodePreview, decodePreview } from './preview.js';

test('shares a topic with Unicode labels in a compressed URL fragment', async () => {
  const topic = { ...testTopic, label: 'Température 🌡' };
  const encoded = await encodePreview(topic);
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(encoded.length).toBeLessThan(JSON.stringify(topic).length);
  expect(await decodePreview(encoded)).toEqual(topic);
});

test.each(['broken', '%bad', ''])('reports an unreadable preview link: %s', async (value) => {
  await expect(decodePreview(value)).rejects.toThrow('This preview link could not be read');
});
