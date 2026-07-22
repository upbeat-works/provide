import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './api/db/schema.ts',
  out: './api/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Tables live in the `catalog` schema (see search_path), but the generated
    // DDL is unqualified so the same migrations apply into any schema (prod
    // `catalog`, ephemeral `test_*` in tests).
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/provide',
  },
});
