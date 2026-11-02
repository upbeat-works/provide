const assert = require('node:assert/strict');
const { createStrapi } = require('@strapi/strapi');

async function verify() {
  for (let boot = 0; boot < 2; boot++) {
    const strapi = createStrapi();
    try {
      await strapi.load();
      const cards = strapi.documents('api::landing-analysis-card.landing-analysis-card');
      const en = await cards.findMany({ locale: 'en', status: 'published', populate: ['Image'] });
      const eu = await cards.findMany({ locale: 'en-EU', status: 'published', populate: ['Image'] });
      assert.equal(en.length, 2);
      assert.equal(eu.length, 2);
      for (const card of en) {
        const translation = eu.find((entry) => entry.Key === card.Key);
        assert.equal(card.documentId, translation.documentId);
        assert.equal(card.Description, 'Editor text');
        assert.equal(translation.Description, 'EU editor text');
        assert.equal(card.Image.url, translation.Image.url);
        assert.equal(card.Image.alternativeText, 'Editor image');
      }
      const draft = await cards.findFirst({ locale: 'en', status: 'draft', filters: { Key: 'private-draft' } });
      assert.equal(draft.Description, 'Unpublished text');
      assert.equal(await cards.findFirst({ locale: 'en', status: 'published', filters: { Key: 'private-draft' } }), null);
      const scenario = await strapi.documents('api::scenario.scenario').findFirst({ locale: 'en', status: 'published', filters: { UID: 'migration-scenario' }, populate: ['ScenarioCharacteristics'] });
      assert.equal(scenario.ScenarioCharacteristics[0].Description, 'Keep this component');
      const study = await strapi.documents('api::case-study-dynamic.case-study-dynamic').findFirst({ locale: 'en', status: 'published', filters: { Slug: 'migration-study' }, populate: ['Project', 'CoverImage', 'MainContent'] });
      assert.equal(study.Project.Title, 'Migration project');
      assert.equal(study.CoverImage.url, en[0].Image.url);
      assert.equal(study.MainContent[0].Text, 'Saved text');
      await new Promise((resolve) => strapi.server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${strapi.server.httpServer.address().port}`;
      const query = new URLSearchParams({
        locale: 'en',
        'populate[CoverImage]': 'true',
        'populate[Project]': 'true',
        'populate[MainContent][on][section.section][populate]': '*',
        'populate[MainContent][on][image-slider.image-slider][populate][ImageSliderPair][populate][Image1]': 'true',
        'populate[MainContent][on][image-slider.image-slider][populate][ImageSliderPair][populate][Image2]': 'true',
      });
      const response = await fetch(`${base}/api/case-study-dynamics?${query}`);
      const body = await response.json();
      assert.equal(response.status, 200, JSON.stringify(body));
      const { data } = body;
      assert.equal(data[0].Title, 'Migration study');
      assert.equal(data[0].Project.Title, 'Migration project');
      const pair = data[0].MainContent[1].ImageSliderPair[0];
      assert.equal(pair.Image1.url, en[0].Image.url);
      assert.equal(pair.Image2.url, en[0].Image.url);
      assert.equal((await fetch(`${base}${pair.Image1.url}`)).status, 200);
    } finally {
      await strapi.destroy();
    }
  }
  console.log('Strapi 4 → 5 PostgreSQL migration and restart checks passed');
}
verify().catch((error) => { console.error(error); process.exitCode = 1; });
