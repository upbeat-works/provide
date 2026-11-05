import { afterEach, expect, test } from 'vitest';
import _ from 'lodash-es';
import renderTemplate from './renderTemplate.js';

const originalSettings = _.templateSettings;
afterEach(() => { _.templateSettings = originalSettings; });

test('renders escaped text when a page overrides the global template settings', () => {
  _.templateSettings = { interpolate: /\{\{(.+?)\}\}/g, evaluate: /\{\{=(.+?)\}\}/g };
  const text = '<img src=x onerror="window.chartReview=true"> & people';
  const content = document.createElement('div');
  content.innerHTML = renderTemplate('<span>{{-text}}</span>', { text });

  expect(content.querySelector('span')?.textContent).toBe(text);
  expect(content.querySelector('img')).toBeNull();
});
