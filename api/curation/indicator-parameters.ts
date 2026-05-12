export interface IndicatorParameterOption {
  uid: string;
  label: string;
  labelLong?: string;
}

export interface IndicatorParameter {
  uid: string;
  label: string;
  options: IndicatorParameterOption[];
}

export const indicatorParameters: IndicatorParameter[] = [
  {
    uid: 'time',
    label: 'Time',
    options: [
      { uid: 'annual', label: 'Annual' },
      { uid: 'djf', label: 'December, January, February' },
      { uid: 'mam', label: 'March, April, May' },
      { uid: 'jja', label: 'June, July, August' },
      { uid: 'son', label: 'September, October, November' },
    ],
  },
  {
    uid: 'indicator_value',
    label: 'Temperature',
    options: [
      { uid: '20', label: '20' },
      { uid: '25', label: '25' },
      { uid: '28', label: '28' },
      { uid: '295', label: '29.5' },
      { uid: '31', label: '31' },
      { uid: '35', label: '35' },
    ],
  },
  {
    uid: 'reference',
    label: 'Reference',
    options: [
      { uid: 'present-day', label: '2011–2020', labelLong: '2011–2020 (present-day)' },
      { uid: 'pre-industrial', label: '1850–1900', labelLong: '1850-1900 (pre-industrial)' },
    ],
  },
  {
    uid: 'frequency',
    label: 'Frequency',
    options: [
      { uid: '0.1', label: '1-in-10' },
      { uid: '0.05', label: '1-in-20' },
      { uid: '0.02', label: '1-in-50' },
    ],
  },
  {
    uid: 'spatial',
    label: 'Spatial',
    options: [{ uid: 'area', label: 'Area-weighted average' }],
  },
];
