import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toAnalysisCards } from './landing-analysis-cards.js';

test('maps published Strapi card entries to carousel props in sort order', () => {
  const entries = [
    { id: 2, attributes: { Path: '/impacts/explore', Image: '/img/impacts.png', ImageAlt: 'Map', Description: 'Explore', Project: 'Provide', Geography: 'Global', DataSource: 'CMIP6', SortOrder: 2 } },
    { id: 1, attributes: { Path: '/impacts/avoid', Image: '/img/emission-scenarios.png', ImageAlt: 'Chart', Description: 'Avoid', Project: 'Provide', Geography: 'Cities', DataSource: 'CMIP6', SortOrder: 1 } },
  ];

  assert.deepEqual(toAnalysisCards(entries), [
    { path: '/impacts/avoid', image: '/img/emission-scenarios.png', imageAlt: 'Chart', description: 'Avoid', project: 'Provide', geography: 'Cities', dataSource: 'CMIP6' },
    { path: '/impacts/explore', image: '/img/impacts.png', imageAlt: 'Map', description: 'Explore', project: 'Provide', geography: 'Global', dataSource: 'CMIP6' },
  ]);
});

test('drops incomplete entries and accepts a missing response', () => {
  assert.deepEqual(toAnalysisCards(null), []);
  assert.deepEqual(toAnalysisCards([{ attributes: { Key: 'unfinished', Path: '', Description: 'Missing a path' } }]), []);
});
