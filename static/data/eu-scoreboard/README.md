# Scoreboard map source

The file comes from IIASA's [`scse-geojson`](https://github.com/iiasa/scse-geojson) repository.
The boundaries are provided under CC BY 4.0. Copyright 2025 IIASA Scenario Services team.

## `nuts0_countries.geojson`

The scoreboard's country map: NUTS country level (level 0) of the 2024 edition, built from
[`nuts/NUTS_RG_03M_2024_4326.geojson`](https://github.com/iiasa/scse-geojson/blob/main/nuts/NUTS_RG_03M_2024_4326.geojson)
at commit `ec306cb6802bcb733743dfc9556f5432ecba5671` by `scripts/build-nuts0-geojson.mjs`
(`bun run scripts/build-nuts0-geojson.mjs`). That script keeps the level-0 features, stamps each
with the ISO 3166-1 alpha-3 `geoId` the catalog keys countries on, and rounds coordinates to 5
decimals — upstream carries 15, which is more than half the file and finer than the 1:3M geometry
resolves.

The United Kingdom left NUTS, so the 2024 edition has no level-0 feature for it. The script
dissolves the 12 UK NUTS 1 regions from
[`nuts-with-uk/nuts1_updated_uk_regions.geojson`](https://github.com/iiasa/scse-geojson/blob/main/nuts-with-uk/nuts1_updated_uk_regions.geojson)
into the single country the other 39 arrive as, for 40 in total. Moldova is in neither source: it
is outside NUTS entirely and so cannot be drawn on this map.

Use `geoId` to match overview scores and the selected country's ISO alpha-3 code. Regional
map values use the packaged NUTS1 and NUTS2 files in
[`api/scoreboard/data`](../../../api/scoreboard/data/README.md). Boundaries are from EUROSTAT's
Territorial units for statistics (NUTS); reuse is authorised with due citation of the source.

> Eurostat, _Statistical regions in the European Union and partner countries – NUTS and statistical
> regions 2021 – 2022 edition_, Publications Office of the European Union, 2022.
