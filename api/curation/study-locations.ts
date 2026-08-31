export interface StudyLocation {
  uid: string;
  label: string;
  order: number;
}

export const studyLocations: StudyLocation[] = [
  { uid: 'urban-hot-spot', label: 'urban hot spot', order: 1 },
  { uid: 'urban-medium-spot', label: 'urban medium spot', order: 10 },
  { uid: 'urban-cool-spot', label: 'urban cool spot', order: 1 },
  { uid: 'suburban-hot-spot', label: 'suburban hot spot', order: 10 },
  { uid: 'suburban-medium-spot', label: 'suburban medium spot', order: 1 },
  { uid: 'suburban-cool-spot', label: 'suburban cool spot', order: 10 },
  { uid: 'city-average', label: 'city average', order: 10 },
];
