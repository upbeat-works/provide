import indicatorsJson from './indicators.json' assert { type: 'json' };

export interface IndicatorCuration {
  uid: string;
  label: string;
  unit: string;
  sector: string;
  direction: number;
  parameters: Record<string, string[]>;
  availableGeographies: string[];
  availableScenarios: string[];
  excludedScenarios?: string[];
}

export const indicators: IndicatorCuration[] = indicatorsJson as IndicatorCuration[];

export const indicatorByUid: Record<string, IndicatorCuration> = Object.fromEntries(
  indicators.map((i) => [i.uid, i]),
);
