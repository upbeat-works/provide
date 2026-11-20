export const PROJECTION_YEARS = [2030, 2050, 2070, 2090, 2100, 2200, 2300];

export const PROJECTION_TIMEFRAME = {
  yearStart: PROJECTION_YEARS[0],
  yearEnd: PROJECTION_YEARS.at(-1),
  yearStep: Math.min(...PROJECTION_YEARS.slice(1).map((year, index) => year - PROJECTION_YEARS[index])),
};
