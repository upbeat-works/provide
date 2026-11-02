const path = require('path');

module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'postgres');

  // Read an env var, treating an empty string (e.g. an undeclared Docker ENV) as unset.
  const val = (key, def) => {
    const v = env(key);
    return v === undefined || v === '' ? def : v;
  };
  const ssl = env.bool('DATABASE_SSL', false) && {
    rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
  };

  const connections = {
    // The CMS and API share a database but use separate schemas.
    postgres: {
      // Some Strapi migrations use unqualified table names.
      searchPath: [val('DATABASE_SCHEMA', 'strapi')],
      connection: {
        host: val('DATABASE_HOST', 'localhost'),
        port: Number(val('DATABASE_PORT', 5432)),
        database: val('DATABASE_NAME', 'provide'),
        user: val('DATABASE_USERNAME', 'postgres'),
        password: val('DATABASE_PASSWORD', 'postgres'),
        ssl,
        schema: val('DATABASE_SCHEMA', 'strapi'),
      },
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10),
      },
    },
    sqlite: {
      connection: {
        filename: path.resolve(__dirname, '..', val('DATABASE_FILENAME', 'database/data.db')),
      },
      useNullAsDefault: true,
    },
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
    // Run database/migrations on boot. They run BEFORE the schema sync, which is
    // what makes a column rename survive (sync would otherwise drop + recreate).
    settings: { runMigrations: true },
  };
};
