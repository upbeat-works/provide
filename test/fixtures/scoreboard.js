import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getScoreboard } from '../../api/scoreboard/controller.js';

export const scoreboardTopicsDirectory = join(dirname(fileURLToPath(import.meta.url)), 'scoreboard/topics');

export function getTestScoreboard(sector, indicator) {
  return getScoreboard(sector, indicator, { directory: scoreboardTopicsDirectory });
}
