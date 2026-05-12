import geographyTypesJson from './geography-types.json' assert { type: 'json' };

export interface GeographyTypeCuration {
  uid: string;
  label: string;
  labelSingular?: string;
  icon: string;
  availableIndicators: string[];
  isAvailable: boolean;
}

export const geographyTypes: GeographyTypeCuration[] = geographyTypesJson as GeographyTypeCuration[];

export const geographyTypeByUid: Record<string, GeographyTypeCuration> = Object.fromEntries(
  geographyTypes.map((t) => [t.uid, t]),
);
