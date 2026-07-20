'use strict';

/**
 * scenario-simplified service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::scenario-simplified.scenario-simplified');
