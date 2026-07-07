'use strict';

/**
 * data-processing service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::data-processing.data-processing');
