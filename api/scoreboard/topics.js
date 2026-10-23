import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { definitionGroupingError } from './charts.ts';

const topicsDirectory = join(dirname(fileURLToPath(import.meta.url)), 'topics');
const text = (value) => typeof value === 'string' && value.trim().length > 0;

function requireField(valid, message) {
  if (!valid) throw new Error(message);
}

function uniqueNames(items, field, name) {
  requireField(Array.isArray(items), `${name} must be an array`);
  const names = items.map((item) => item?.[field]);
  requireField(names.every(text) && new Set(names).size === names.length, `${name} need unique, nonempty ${field} values`);
}

function validateTopic(topic) {
  requireField(text(topic?.label), 'label is required');
  requireField(topic.order === undefined || Number.isFinite(topic.order), 'order must be a number');
  const map = topic.map;
  requireField(map && typeof map === 'object', 'map is required');
  uniqueNames(map.indicators, 'name', 'map.indicators');
  uniqueNames(map.scenarios, 'id', 'map.scenarios');
  requireField(map.scenarios.length > 0, 'map.scenarios must not be empty');
  requireField(Array.isArray(map.years) && map.years.length > 0 && map.years.every((year) => Number.isInteger(year) && year >= 1000 && year <= 9999), 'map.years must contain four-digit numbers');
  requireField(map.defaultIndicator == null || map.indicators.some(({ name }) => name === map.defaultIndicator), 'map.defaultIndicator must name an indicator');
  for (const indicator of map.indicators) {
    if (indicator.type === 'choropleth') {
      requireField(text(indicator.variable), `${indicator.name}: variable is required`);
      requireField(['NUTS1', 'NUTS2'].includes(indicator.level), `${indicator.name}: level must be NUTS1 or NUTS2`);
      requireField(indicator.aggregate === undefined || indicator.aggregate === 'sum', `${indicator.name}: aggregate must be sum`);
    } else {
      requireField(indicator.type === 'raster', `${indicator.name}: unsupported map type`);
      requireField(['indicator', 'reference', 'time', 'spatial'].every((key) => text(indicator[key])), `${indicator.name}: raster fields are required`);
    }
  }
  uniqueNames(topic.charts, 'chartId', 'charts');
  for (const chart of topic.charts) {
    requireField(text(chart.title) && typeof chart.description === 'string', `${chart.chartId}: title and description are required`);
    requireField(Array.isArray(chart.data?.variables) && chart.data.variables.every(text), `${chart.chartId}: variables must be strings`);
    const error = definitionGroupingError(chart);
    requireField(!error, `${chart.chartId}: ${error}`);
  }
}

export function readTopics(directory = topicsDirectory) {
  const files = readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
  const topics = files.map(({ name }) => {
    try {
      const uid = name.slice(0, -5);
      requireField(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(uid), 'filename must use lowercase words or numbers separated by hyphens');
      let topic;
      try {
        topic = JSON.parse(readFileSync(join(directory, name), 'utf8'));
      } catch {
        throw new Error('Cannot read valid JSON');
      }
      validateTopic(topic);
      return { ...topic, uid };
    } catch (error) {
      throw new Error(`Invalid scoreboard topic ${name}: ${error.message}`);
    }
  });
  requireField(topics.length > 0, 'No scoreboard topics found');
  return topics.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.uid.localeCompare(b.uid));
}
