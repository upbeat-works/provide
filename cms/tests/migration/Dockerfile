FROM node:20.20.2-bookworm-slim
WORKDIR /app
COPY cms/tests/migration/package.json cms/tests/migration/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY cms/config ./config
COPY cms/src ./src
COPY cms/tests/migration ./tests/migration
RUN printf 'module.exports = {};\n' > src/index.js && mkdir -p public/uploads
CMD ["node", "tests/migration/seed.cjs"]
