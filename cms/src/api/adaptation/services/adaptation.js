'use strict';

/**
 * adaptation service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::adaptation.adaptation');
