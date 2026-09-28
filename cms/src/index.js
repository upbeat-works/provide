'use strict';

const { seedLandingAnalysisCards } = require('./api/landing-analysis-card/lib/seed');

const { seedLandingAnalysisImages } = require('./api/landing-analysis-card/lib/images');

module.exports = {
  async bootstrap({ strapi }) {
    await seedLandingAnalysisCards(strapi, ['en', 'en-EU'], (message) => strapi.log.info(`[landing-analysis-card] ${message}`));
    await seedLandingAnalysisImages(strapi);
  },
};
