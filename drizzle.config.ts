import { defineConfig } from 'drizzle-kit';
import { pgBaseConfig } from './api/db/connection';

// Same DB config as the runtime (discrete DATABASE_* fields). Tables live in the
// `catalog` schema (via search_path), but the DDL is unqualified so the same
// migrations apply into any schema.
const base = pgBaseConfig();

export default defineConfig({
  schema: './api/db/schema.ts',
  out: './api/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: base.host,
    port: base.port,
    user: base.user,
    password: base.password,
    database: base.database,
    ssl: base.ssl,
  },
});
