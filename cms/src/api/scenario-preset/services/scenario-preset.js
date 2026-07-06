'use strict';

/**
 * scenario-preset service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::scenario-preset.scenario-preset');
