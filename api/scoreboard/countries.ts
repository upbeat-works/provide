import { countryIso3 } from '../db/import/country-iso3';

const countryCodes = [
  ['Albania', 'AL'],
  ['Austria', 'AT'],
  ['Bosnia and Herzegovina', 'BA'],
  ['Belgium', 'BE'],
  ['Bulgaria', 'BG'],
  ['Switzerland', 'CH'],
  ['Cyprus', 'CY'],
  ['Czechia', 'CZ'],
  ['Germany', 'DE'],
  ['Denmark', 'DK'],
  ['Estonia', 'EE'],
  ['Greece', 'EL'],
  ['Spain', 'ES'],
  ['Finland', 'FI'],
  ['France', 'FR'],
  ['Croatia', 'HR'],
  ['Hungary', 'HU'],
  ['Ireland', 'IE'],
  ['Iceland', 'IS'],
  ['Italy', 'IT'],
  ['Liechtenstein', 'LI'],
  ['Lithuania', 'LT'],
  ['Luxembourg', 'LU'],
  ['Latvia', 'LV'],
  ['Montenegro', 'ME'],
  ['North Macedonia', 'MK'],
  ['Malta', 'MT'],
  ['Netherlands', 'NL'],
  ['Norway', 'NO'],
  ['Poland', 'PL'],
  ['Portugal', 'PT'],
  ['Romania', 'RO'],
  ['Serbia', 'RS'],
  ['Sweden', 'SE'],
  ['Slovenia', 'SI'],
  ['Slovakia', 'SK'],
  ['Turkey', 'TR'],
  ['Ukraine', 'UA'],
  ['United Kingdom', 'UK'],
  ['Kosovo', 'XK'],
] as const;

export const SCOREBOARD_COUNTRIES = countryCodes.map(([name, code]) => ({ name, iso3: countryIso3[name], code }));

export function scoreboardCountry(name: string | undefined) {
  return SCOREBOARD_COUNTRIES.find((country) => country.name === name);
}
