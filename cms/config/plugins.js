module.exports = ({ env }) => {
  const bucket = env('R2_BUCKET');

  // Cloudflare R2 (S3-compatible) in environments that configure it (production);
  // the built-in local filesystem provider everywhere else (local dev), so no
  // object-store credentials are required to boot.
  const upload = bucket
    ? {
        config: {
          provider: 'aws-s3',
          providerOptions: {
            baseUrl: env('R2_PUBLIC_URL'),
            s3Options: {
              endpoint: env('R2_ENDPOINT'),
              region: 'auto',
              credentials: {
                accessKeyId: env('R2_ACCESS_KEY_ID'),
                secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
              },
              params: {
                Bucket: bucket,
              },
            },
          },
          actionOptions: {
            upload: {},
            uploadStream: {},
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
