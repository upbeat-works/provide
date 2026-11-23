-- Auto-generated PROVIDE indicator enrichment seed

INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a Year with Maximum Temperatures Above X°C', 'urban-climate', 'urbclim-T2M-dayoverX')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights a Year with Minimum Temperatures Above X°C', 'urban-climate', 'urbclim-T2M-nightoverX')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a Year with Extreme Heat Stress', 'urban-climate', 'urbclim-WBGT-dayover31')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a Year with Very High Heat Stress', 'urban-climate', 'urbclim-WBGT-dayover295')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a Year with Moderate Heat Stress', 'urban-climate', 'urbclim-WBGT-dayover25')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a Year with High Heat Stress', 'urban-climate', 'urbclim-WBGT-dayover28')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Cooling Degree Hours', 'urban-climate', 'urbclim-cooling-degree-hours')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a Year with Extreme Heat Stress', 'urban-climate', 'urbclim-WBGT-hourover31')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean Daily Maximum Temperature', 'urban-climate', 'urbclim-T2M-daily-mean-max')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights a Year with High Heat Stress', 'urban-climate', 'urbclim-WBGT-nightover28')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost Working Hours per Year for Moderate Activities', 'urban-climate', 'urbclim-LWH-mod')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Heat-Wave Magnitude Index Daily (HWMId)', 'urban-climate', 'urbclim-HWMI')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean Daily Minimum Temperature', 'urban-climate', 'urbclim-T2M-daily-mean-min')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a Year with Moderate Heat Stress', 'urban-climate', 'urbclim-WBGT-hourover25')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean Daily Maximum Wet Bulb Globe Temperature', 'urban-climate', 'urbclim-WBGT-daily-mean-max')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost Working Hours per Year for Light Activities', 'urban-climate', 'urbclim-LWH-light')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean Daily Temperature', 'urban-climate', 'urbclim-T2M-mean')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost Working Hours per Year for Intense Activities', 'urban-climate', 'urbclim-LWH-int')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a Year with High Heat Stress', 'urban-climate', 'urbclim-WBGT-hourover28')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a Year with Very High Heat Stress', 'urban-climate', 'urbclim-WBGT-hourover295')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Heatwave Days per Year', 'urban-climate', 'urbclim-heatwave-days')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population Exposed to Heatwaves', 'urban-climate', 'urbclim-heatwaves-population-exposed')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population Exposed to Moderate Heatstress', 'urban-climate', 'urbclim-heatstressimpact-wbgt-dayover25')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population Exposed to High Heat Stress', 'urban-climate', 'urbclim-heatstressimpact-wbgt-dayover28')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population Exposed to Very High Heat Stress', 'urban-climate', 'urbclim-heatstressimpact-wbgt-dayover295')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population Exposed to Extreme Heatstress', 'urban-climate', 'urbclim-heatstressimpact-wbgt-dayover31')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean Temperature', 'terrestrial-climate', 'terclim-mean-temperature')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Extremely Hot Year', 'terrestrial-climate', 'terclim-hot-extreme')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Extremely Cold Year', 'terrestrial-climate', 'terclim-cold-extreme')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Annual Maximum Temperature', 'terrestrial-climate', 'terclim-txx')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Annual Minimum of Monthly Mean Soil Moisture Content', 'terrestrial-climate', 'terclim-mrso-minmon')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Fire Weather Index During the Fire Season', 'terrestrial-climate', 'terclim-fwisa')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Length of the Fire Season', 'terrestrial-climate', 'terclim-fwils')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Soil Moisture Content', 'terrestrial-climate', 'terclim-mrso')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Annual Maximum of the Fire Weather Index', 'terrestrial-climate', 'terclim-fwixx')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Number of Days with Extreme Fire Weather', 'terrestrial-climate', 'terclim-fwixd')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Species at Risk from Local Extinction', 'biodiversity', 'biodiversity-srr')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Timber Species at Risk from Local Extinction', 'biodiversity', 'biodiversity-timber-srr')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Pollinator Species at Risk from Local Extinction', 'biodiversity', 'biodiversity-pollinators-srr')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Plant Species at Risk from Local Extinction', 'biodiversity', 'biodiversity-plantae-srr')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Glacier Area', 'glacier', 'glacier-area')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Glacier Volume', 'glacier', 'glacier-volume')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Glacier Thinning Rate', 'glacier', 'glacier-thinning_rate')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights a Year with Moderate Heat Stress', 'urban-climate', 'urbclim-WBGT-nightover25')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Sea Surface Temperature', 'maritime-climate', 'marclim-sst')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Sea Surface pH', 'maritime-climate', 'marclim-ph')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Ocean Oxygen Content', 'maritime-climate', 'marclim-oxygen')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Marine Heatwave Days per Year', 'maritime-climate', 'marclim-sst_ext')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Global Atmospheric CH4 Concentration from Peatland Emissions', 'carboncycle', 'carboncycle-d-ch4')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Global Atmospheric CO2 Concentration from Peatland Emissions', 'carboncycle', 'carboncycle-d-co2')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Peatland CH4 Emission', 'carboncycle', 'carboncycle-d-ept-ch4')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Peatland CO2 Flux', 'carboncycle', 'carboncycle-d-ept-co2')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Global Annual Mean Temperature Rise from Peatland Emissions', 'carboncycle', 'carboncycle-d-tg')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Climate Change Impact on GDP', 'macroeconomy', 'macroeconomy-bhm')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Export Supply (Food Sector)', 'macroeconomy', 'macroeconomy-export-supply-food')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Export Supply (Livestock Sector)', 'macroeconomy', 'macroeconomy-export-supply-livestock')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Export Supply (Manufacturing Sector)', 'macroeconomy', 'macroeconomy-export-supply-manufacturing')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Export Supply (Services Sector)', 'macroeconomy', 'macroeconomy-export-supply-services')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Private Consumption (Food Sector)', 'macroeconomy', 'macroeconomy-private-consumption-food')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Private Consumption (Livestock Sector)', 'macroeconomy', 'macroeconomy-private-consumption-livestock')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Private Consumption (Manufacturing Sector)', 'macroeconomy', 'macroeconomy-private-consumption-manufacturing')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Private Consumption (Services Sector)', 'macroeconomy', 'macroeconomy-private-consumption-services')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('GDP (All Sectors)', 'macroeconomy', 'macroeconomy-gdp-macro')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Import Demand (Food Sector)', 'macroeconomy', 'macroeconomy-import-demand-food')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Import Demand (Livestock Sector)', 'macroeconomy', 'macroeconomy-import-demand-livestock')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Import Demand (Manufacturing Sector)', 'macroeconomy', 'macroeconomy-import-demand-manufacturing')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Import Demand (Services Sector)', 'macroeconomy', 'macroeconomy-import-demand-services')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Producer Price (Food Sector)', 'macroeconomy', 'macroeconomy-producer-price-food')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Producer Price (Livestock Sector)', 'macroeconomy', 'macroeconomy-producer-price-livestock')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Producer Price (Manufacturing Sector)', 'macroeconomy', 'macroeconomy-producer-price-manufacturing')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Producer Price (Services Sector)', 'macroeconomy', 'macroeconomy-producer-price-services')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Wages (Food Sector)', 'macroeconomy', 'macroeconomy-wages-food')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Wages (Livestock Sector)', 'macroeconomy', 'macroeconomy-wages-livestock')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Wages (Manufacturing Sector)', 'macroeconomy', 'macroeconomy-wages-manufacturing')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Wages (Services Sector)', 'macroeconomy', 'macroeconomy-wages-services')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Consumer Price Index (All Sectors)', 'macroeconomy', 'macroeconomy-consumer-price-index-macro')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Production (Food Sector)', 'macroeconomy', 'macroeconomy-production-food')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Production (Livestock Sector)', 'macroeconomy', 'macroeconomy-production-livestock')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Production (Manufacturing Sector)', 'macroeconomy', 'macroeconomy-production-manufacturing')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Production (Services Sector)', 'macroeconomy', 'macroeconomy-production-services')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Labour Productivity', 'macroeconomy', 'macroeconomy-labour-productivity')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights a Year Where Minimum Wet-Bulb Globe Temperatures Stay Above X°C', 'urban-climate', 'urbclim-WBGT-nightoverX')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a Year with Maximum Wet-Bulb Globe Temperature Above X°C', 'urban-climate', 'urbclim-WBGT-houroverX')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Daytime Urban Heat Island Corrected for Topography', 'urban-climate', 'urbclim-T2M-daily-mean-max-topography')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nighttime Urban Heat Island Corrected for Topography', 'urban-climate', 'urbclim-T2M-daily-mean-min-topography')
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days with Extreme High Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days with High Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days with Maximum Temperatures above 25 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days with Maximum Temperatures above 30 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days with Maximum Temperatures above 35 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days with Moderate Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days with Very High Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Heat-Wave Magnitude Index daily (HWMId)', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Heatwave Days', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours with Extreme Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours with High Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours with Moderate Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours with Very High Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost Working Hours for Intense Activities', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost Working Hours for Light Activities', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost Working Hours for Moderate Activities', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights with High Heat Stress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights with Minimum Temperatures above 20 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights with Minimum Temperatures above 25 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights with Minimum Temperatures above 28 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population Exposed to High Heatstress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population Exposed to Very High Heatstress', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Annual Maximum Fire Weather Index', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Extremely Hot Year with a 10-Year Return Period', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Extremely Hot Year with a 20-Year Return Period', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Extremely Hot Year with a 50-Year Return Period', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Extremely Cold Year with a 10-Year Return Period', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Extremely Cold Year with a 20-Year Return Period', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Extremely Cold Year with a 50-Year Return Period', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Annual Minimum Monthly Mean Soil Moisture Content', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Fire Season Length', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Fire Weather Index (Fire Season)', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Glacier Runoff', 'glacier', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Marine Heatwave Days', 'maritime-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Peatland C02 Flux', 'carboncycle', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Global Mean Temperature', 'global', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Global Mean Sea Level Rise', 'global', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Heat-Wave Magnitude Index daily (HMWId)', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights with Maximum Temperatures above 20 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights with Maximum Temperatures above 25 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights with Maximum Temperatures above 28 °C', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('High Heat Risk', 'urban-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean Air Temperature', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Maximum Air Temperature', 'terrestrial-climate', NULL)
ON CONFLICT (id) DO UPDATE SET
  sector = COALESCE(EXCLUDED.sector, indicators.sector),
  legacy_uid = COALESCE(EXCLUDED.legacy_uid, indicators.legacy_uid);
