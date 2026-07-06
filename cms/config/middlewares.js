module.exports = ({ env }) => {
  // New uploads are served from R2's public domain; existing content still
  // references res.cloudinary.com. Allow both in the CSP so the admin media
  // library can preview them. R2_PUBLIC_URL is unset locally (local provider),
  // in which case only Cloudinary is allowed.
  const publicUrl = env('R2_PUBLIC_URL');
  const r2Host = publicUrl ? new URL(publicUrl).host : null;
  const assetHosts = ['res.cloudinary.com', ...(r2Host ? [r2Host] : [])];

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
