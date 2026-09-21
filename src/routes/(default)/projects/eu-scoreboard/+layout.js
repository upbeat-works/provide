import { resolveSelection } from './selection.js';

export const load = ({ data, url }) => {
  const { scoreboardOptions: options } = data;
  const requested = Object.fromEntries(['scenario', 'region', 'year'].map((key) => [key, url.searchParams.get(key)]));
  return { ...data, ...options, selection: resolveSelection(options, requested) };
};
