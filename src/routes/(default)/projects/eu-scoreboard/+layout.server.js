import { getScoreboard } from './controller.js';

export const load = ({ url }) => ({ scoreboard: getScoreboard(url?.searchParams.get('sector')) });
