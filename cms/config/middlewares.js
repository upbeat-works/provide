module.exports = ({ env }) => {
  // New uploads are served from the object store's public domain; existing
  // content still references res.cloudinary.com. Allow both in the CSP so the
  // admin media library can preview them. S3_PUBLIC_URL is unset locally (local
  // provider), in which case only Cloudinary is allowed.
  const publicUrl = env('S3_PUBLIC_URL');
  const mediaHost = publicUrl ? new URL(publicUrl).host : null;
  const assetHosts = ['res.cloudinary.com', ...(mediaHost ? [mediaHost] : [])];

  return [
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            'img-src': ["'self'", 'data:', 'blob:', ...assetHosts],
            'media-src': ["'self'", 'data:', 'blob:', ...assetHosts],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    'strapi::cors',
    'strapi::poweredBy',
    'strapi::logger',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
