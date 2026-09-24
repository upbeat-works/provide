import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';

export const load = () => ({ title: generatePageTitle(LABEL_EU_SCOREBOARD) });
