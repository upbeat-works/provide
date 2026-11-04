// @vitest-environment node
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodePreview, decodePreview } from './preview.js';

test('shares a topic with Unicode labels in a compressed URL fragment', async () => {
  const topic = JSON.parse(readFileSync('api/scoreboard/topics/testing.json', 'utf8'));
  topic.label = 'Température 🌡';
  const encoded = await encodePreview(topic);
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(encoded.length).toBeLessThan(JSON.stringify(topic).length);
  expect(await decodePreview(encoded)).toEqual(topic);
});

test.each(['broken', '%bad', ''])('reports an unreadable preview link: %s', async (value) => {
  await expect(decodePreview(value)).rejects.toThrow('This preview link could not be read');
});
