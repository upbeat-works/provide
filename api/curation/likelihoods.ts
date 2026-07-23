export interface Likelihood {
  uid: string;
  label: string;
  value: number;
}

export const likelihoods: Likelihood[] = [
  { uid: 'likely', label: '33%', value: 0.66 },
  { uid: 'very-likely', label: '10%', value: 0.9 },
  { uid: 'extremely-likely', label: '5%', value: 0.95 },
];
