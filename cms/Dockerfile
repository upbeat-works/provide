# Build stage — compile the admin panel.
# Debian slim (glibc) is used instead of Alpine (musl) because Strapi's `sharp`
# image library ships working prebuilt binaries for glibc and is painful on musl.
FROM node:20.13.1-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
ENV NODE_ENV=production
RUN yarn build

# Runtime stage
FROM node:20.13.1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337
COPY --from=build /app ./
# Ensure the local upload provider's target dir exists (dev uploads are
# .dockerignore'd, so the empty folder must be created). Unused when the
# Cloudinary provider is active (production).
RUN mkdir -p public/uploads
EXPOSE 1337
CMD ["yarn", "start"]
