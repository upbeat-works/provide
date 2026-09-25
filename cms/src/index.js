'use strict';

const { seedLandingAnalysisCards } = require('./api/landing-analysis-card/lib/seed');

module.exports = {
  async bootstrap({ strapi }) {
    await seedLandingAnalysisCards(strapi, ['en', 'en-EU'], (message) => strapi.log.info(`[landing-analysis-card] ${message}`));
  },
};
