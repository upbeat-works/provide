import type { Ixmp4Instance } from './types';
import instancesJson from './instances.json' assert { type: 'json' };

export const instances: Ixmp4Instance[] = instancesJson as Ixmp4Instance[];
