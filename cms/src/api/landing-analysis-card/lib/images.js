'use strict';

const path = require('node:path');
const { stat } = require('node:fs/promises');
const { UID } = require('./seed');

const IMAGE_STORE = { type: 'core', name: 'landing-analysis-cards', key: 'media-images' };
const IMAGES = [
  { key: 'avoid-future-impacts', file: 'emission-scenarios.png' },
  { key: 'explore-future-impacts', file: 'impacts.png' },
];

async function seedLandingAnalysisImages(strapi) {
  const store = strapi.store(IMAGE_STORE);
  if (await store.get()) return;

  for (const image of IMAGES) {
    const cards = await strapi.entityService.findMany(UID, {
      locale: 'all',
      publicationState: 'preview',
      filters: { Key: image.key },
      populate: ['Image'],
    });
    const missing = cards.filter((card) => !card.Image);
    if (!missing.length) continue;

    const name = `landing-analysis-${image.key}.png`;
    let media = await strapi.db.query('plugin::upload.file').findOne({ where: { name } });
    if (!media) {
      const filePath = path.join(__dirname, '../assets', image.file);
      const { size } = await stat(filePath);
      [media] = await strapi.plugin('upload').service('upload').upload({
        data: { fileInfo: { name, alternativeText: missing[0].ImageAlt } },
        files: { path: filePath, name, type: 'image/png', size },
      });
    }

    for (const card of missing) {
      await strapi.entityService.update(UID, card.id, { data: { Image: media.id } });
    }
  }
  await store.set({ value: true });
}

module.exports = { IMAGE_STORE, seedLandingAnalysisImages };
