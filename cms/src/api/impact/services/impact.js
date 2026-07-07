'use strict';

/**
 * impact service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::impact.impact');
