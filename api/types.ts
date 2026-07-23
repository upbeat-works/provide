import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './db/schema';

export type Db = NodePgDatabase<typeof schema>;

export type Env = {
  Bindings: {
    DB: Db;
    IXMP4_USERNAME: string;
    IXMP4_PASSWORD: string;
  };
};

export interface Ixmp4Instance {
  slug: string;
  name: string;
  url: string;
  managerUrl: string;
}
