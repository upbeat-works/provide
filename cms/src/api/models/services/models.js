'use strict';

/**
 * models service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::models.models');
