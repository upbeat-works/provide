module.exports = ({ env }) => {
  // Parse lazily inside the config function (Strapi's default pattern) and
  // tolerate a missing DATABASE_URL, so `strapi build` (NODE_ENV=production,
  // no DB env — e.g. during a Docker image build) does not crash. At runtime
  // DATABASE_URL is set and behaviour is identical to before.
  const { parse } = require('pg-connection-string');
  const config = parse(env('DATABASE_URL', ''));

  return {
    connection: {
      client: 'postgres',
      connection: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        // SSL on by default (Heroku Postgres requires it). Set DATABASE_SSL=false
        // for a plain Postgres without SSL (e.g. a local container smoke test).
        ssl: env.bool('DATABASE_SSL', true) ? { rejectUnauthorized: false } : false,
      },
      debug: false,
    },
  };
};
