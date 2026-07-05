module.exports = ({ env }) => {
  const cloudName = env('CLOUDINARY_NAME');

  // Cloudinary in environments that configure it (production); the built-in
  // local filesystem provider everywhere else (local dev / staging), so no
  // Cloudinary credentials are required to boot.
  const upload = cloudName
    ? {
        config: {
          provider: 'cloudinary',
          providerOptions: {
            cloud_name: cloudName,
            api_key: env('CLOUDINARY_KEY'),
            api_secret: env('CLOUDINARY_SECRET'),
          },
          actionOptions: {
            upload: {},
            delete: {},
          },
        },
      }
    : {
        config: {
          provider: 'local',
          providerOptions: {
            sizeLimit: 100 * 1024 * 1024, // 100 MB
          },
        },
      };

  return {
    'users-permissions': {
      config: {
        jwtSecret: env('JWT_SECRET'),
      },
    },
    upload,
  };
};
