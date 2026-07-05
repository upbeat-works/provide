# Provide CMS

Access it here on [Heroku](https://provide-cms.herokuapp.com/)

This repository is stored on `Gihtub:master` and `Heroku:main`.

You need the following variables set:

```
HOST
PORT
APP_KEYS
JWT_SECRET
API_TOKEN_SALT
ADMIN_JWT_SECRET
CLOUDINARY_NAME
CLOUDINARY_KEY
CLOUDINARY_SECRET
```

**Everything should be done with `yarn`!**

### `Develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/developer-docs/latest/developer-resources/cli/CLI.html#strapi-develop)

```
npm run develop
```

### `Start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/developer-docs/latest/developer-resources/cli/CLI.html#strapi-start)

```
npm run start
```

### `Build`

Build your admin panel. [Learn more](https://docs.strapi.io/developer-docs/latest/developer-resources/cli/CLI.html#strapi-build)

```
npm run build
```
