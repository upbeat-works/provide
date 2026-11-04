const { statSync } = require('node:fs');
const path = require('node:path');
const createStrapi = require('@strapi/strapi');

async function main() {
  const strapi = createStrapi();
  try {
    await strapi.load();
    await strapi.plugin('i18n').service('locales').create({ code: 'en-EU', name: 'English EU' });
    const file = path.resolve('src/api/landing-analysis-card/assets/impacts.png');
    const [image] = await strapi.plugin('upload').service('upload').upload({
      data: { fileInfo: { name: 'editor-image.png', alternativeText: 'Editor image' } },
      files: { path: file, name: 'editor-image.png', type: 'image/png', size: statSync(file).size },
    });
    const uid = 'api::landing-analysis-card.landing-analysis-card';
    for (const key of ['avoid-future-impacts', 'explore-future-impacts']) {
      const entry = await strapi.entityService.create(uid, { data: {
        Key: key, Path: '/impacts/explore', Description: 'Editor text', locale: 'en', Image: image.id, publishedAt: new Date(),
      } });
      await strapi.entityService.create(uid, { data: {
        Key: key, Path: '/impacts/explore', Description: 'EU editor text', locale: 'en-EU', Image: image.id, publishedAt: new Date(), localizations: [entry.id],
      } });
    }
    await strapi.entityService.create(uid, { data: { Key: 'private-draft', Path: '/draft', Description: 'Unpublished text', locale: 'en' } });
    for (const key of ['initial-content', 'media-images']) await strapi.store({ type: 'core', name: 'landing-analysis-cards', key }).set({ value: true });
    await strapi.entityService.create('api::scenario.scenario', { data: {
      UID: 'migration-scenario', Label: 'Migration scenario', locale: 'en', publishedAt: new Date(),
      ScenarioCharacteristics: [{ Year: '2050', Description: 'Keep this component' }],
    } });
    const project = await strapi.entityService.create('api::project.project', { data: { Title: 'Migration project', locale: 'en', publishedAt: new Date() } });
    await strapi.entityService.create('api::case-study-dynamic.case-study-dynamic', { data: {
      Title: 'Migration study', Slug: 'migration-study', locale: 'en', publishedAt: new Date(), Project: project.id, CoverImage: image.id,
      MainContent: [
        { __component: 'section.section', Title: 'Editor section', Text: 'Saved text' },
        { __component: 'image-slider.image-slider', ImageSliderPair: [{ Image1: image.id, Image2: image.id, Description: 'Image comparison' }] },
      ],
    } });
    const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
    for (const uid of ['api::case-study-dynamic.case-study-dynamic', 'api::project.project', 'api::scenario.scenario', 'api::landing-analysis-card.landing-analysis-card']) {
      await strapi.db.query('plugin::users-permissions.permission').create({ data: { action: `${uid}.find`, role: role.id } });
    }
  } finally {
    await strapi.destroy();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
