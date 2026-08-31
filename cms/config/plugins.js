module.exports = ({ env }) => {
  const bucket = env('S3_BUCKET');

  // Any S3-compatible object store in environments that configure it —
  // Cloudflare R2, or an in-cluster MinIO/Ceph. The built-in local filesystem
  // provider everywhere else (local dev), so no credentials are required to boot.
  //
  // S3_ENDPOINT is the S3 API root the SDK writes to (it appends /<bucket>/<key>
  // itself); S3_PUBLIC_URL is the public read prefix baked into stored media
  // URLs, joined to the object key alone — so it must already include the bucket.
  const upload = bucket
    ? {
        config: {
          provider: 'aws-s3',
          providerOptions: {
            baseUrl: env('S3_PUBLIC_URL'),
            s3Options: {
              endpoint: env('S3_ENDPOINT'),
              // 'auto' is an R2-ism; MinIO and friends want a real region.
              region: env('S3_REGION', 'auto'),
              // Self-hosted gateways can't do virtual-host addressing, and R2
              // accepts path-style too — so pin it rather than expose a knob.
              forcePathStyle: true,
              credentials: {
                accessKeyId: env('S3_ACCESS_KEY_ID'),
                secretAccessKey: env('S3_SECRET_ACCESS_KEY'),
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
