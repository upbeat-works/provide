import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toAnalysisCards } from './landing-analysis-cards.js';

test('maps published Strapi card entries to carousel props in sort order', () => {
  const entries = [
    { id: 2, Path: '/impacts/explore', Image: { url: 'https://media.example/impacts.png', alternativeText: 'Media map' }, ImageAlt: 'Map', Description: 'Explore', Project: 'Provide', Geography: 'Global', DataSource: 'CMIP6', SortOrder: 2 },
    { id: 1, Path: '/impacts/avoid', Image: { url: '/uploads/scenarios.png' }, ImageAlt: 'Chart', Description: 'Avoid', Project: 'Provide', Geography: 'Cities', DataSource: 'CMIP6', SortOrder: 1 },
  ];

  assert.deepEqual(toAnalysisCards(entries, 'https://cms.example'), [
    { path: '/impacts/avoid', image: 'https://cms.example/uploads/scenarios.png', imageAlt: 'Chart', description: 'Avoid', project: 'Provide', geography: 'Cities', dataSource: 'CMIP6' },
    { path: '/impacts/explore', image: 'https://media.example/impacts.png', imageAlt: 'Map', description: 'Explore', project: 'Provide', geography: 'Global', dataSource: 'CMIP6' },
  ]);
});

test('drops incomplete entries and accepts a missing response', () => {
  assert.deepEqual(toAnalysisCards(null), []);
  assert.deepEqual(toAnalysisCards([{ Key: 'unfinished', Path: '', Description: 'Missing a path' }]), []);
});

test('uses media alt text when the card has no override and handles missing media', () => {
  const card = { Path: '/impacts/avoid', Description: 'Avoid' };
  const [withImage, withoutImage] = toAnalysisCards([
    { ...card, Image: { url: 'https://media.example/chart.png', alternativeText: 'Media chart' } },
    { ...card, Image: null },
  ]);
  assert.equal(withImage.imageAlt, 'Media chart');
  assert.equal(withoutImage.image, null);
  assert.equal(withoutImage.imageAlt, '');
});
