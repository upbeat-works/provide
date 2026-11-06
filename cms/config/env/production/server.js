module.exports = ({ env }) => ({
  proxy: { koa: true },
  url: env("PUBLIC_URL"),
  app: {
    keys: env.array("APP_KEYS"),
  },
});
