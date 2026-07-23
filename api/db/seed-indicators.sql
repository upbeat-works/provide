-- Auto-generated PROVIDE indicator enrichment seed

DELETE FROM indicators;

INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a year with maximum temperatures above X°C', 'urban-climate', 'urbclim-T2M-dayoverX');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights a year with minimum temperatures above X°C', 'urban-climate', 'urbclim-T2M-nightoverX');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a year with extreme heat stress', 'urban-climate', 'urbclim-WBGT-dayover31');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a year with very high heat stress', 'urban-climate', 'urbclim-WBGT-dayover295');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a year with moderate heat stress', 'urban-climate', 'urbclim-WBGT-dayover25');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Days a year with high heat stress', 'urban-climate', 'urbclim-WBGT-dayover28');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Cooling degree hours', 'urban-climate', 'urbclim-cooling-degree-hours');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a year with extreme heat stress', 'urban-climate', 'urbclim-WBGT-hourover31');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean daily maximum temperature', 'urban-climate', 'urbclim-T2M-daily-mean-max');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Nights a year with high heat stress', 'urban-climate', 'urbclim-WBGT-nightover28');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost working hours per year for moderate activities', 'urban-climate', 'urbclim-LWH-mod');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Heat-wave magnitude index daily (HWMId)', 'urban-climate', 'urbclim-HWMI');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean daily minimum temperature', 'urban-climate', 'urbclim-T2M-daily-mean-min');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a year with moderate heat stress', 'urban-climate', 'urbclim-WBGT-hourover25');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean daily maximum wet bulb globe temperature', 'urban-climate', 'urbclim-WBGT-daily-mean-max');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost working hours per year for light activities', 'urban-climate', 'urbclim-LWH-light');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean daily temperature', 'urban-climate', 'urbclim-T2M-mean');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Lost working hours per year for intense activities', 'urban-climate', 'urbclim-LWH-int');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a year with high heat stress', 'urban-climate', 'urbclim-WBGT-hourover28');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Hours a year with very high heat stress', 'urban-climate', 'urbclim-WBGT-hourover295');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Heatwave days per year', 'urban-climate', 'urbclim-heatwave-days');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population exposed to heatwaves', 'urban-climate', 'urbclim-heatwaves-population-exposed');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population exposed to moderate heatstress', 'urban-climate', 'urbclim-heatstressimpact-wbgt-dayover25');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population exposed to high heat stress', 'urban-climate', 'urbclim-heatstressimpact-wbgt-dayover28');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population exposed to very high heat stress', 'urban-climate', 'urbclim-heatstressimpact-wbgt-dayover295');
INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Population exposed to extreme heatstress', 'urban-climate', 'urbclim-heatstressimpact-wbgt-dayover31');
