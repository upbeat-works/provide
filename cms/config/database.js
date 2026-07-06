module.exports = ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: env('DATABASE_FILENAME', 'database/data.db'),
    },
    useNullAsDefault: true,
  },
});
