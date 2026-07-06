'use strict';

/**
 * scenario-preset router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::scenario-preset.scenario-preset');
