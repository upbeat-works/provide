# NUTS boundaries

These files are byte-for-byte copies from
[`iiasa/scse-geojson`](https://github.com/iiasa/scse-geojson/tree/ec306cb6802bcb733743dfc9556f5432ecba5671/nuts-with-uk)
at commit `ec306cb6802bcb733743dfc9556f5432ecba5671`. Only the file extension changed so the application can import them as JSON.

| Local file | Source file | Size | SHA-256 |
| --- | --- | ---: | --- |
| `nuts1.json` | [`nuts1_updated_uk_regions.geojson`](https://raw.githubusercontent.com/iiasa/scse-geojson/ec306cb6802bcb733743dfc9556f5432ecba5671/nuts-with-uk/nuts1_updated_uk_regions.geojson) | 3,371,391 bytes | `5e9d0926bbb2396eb7e1fec6c9cb60043b251548212b0f10f99c64b908c1195e` |
| `nuts2.json` | [`nuts2_updated_uk_regions.geojson`](https://raw.githubusercontent.com/iiasa/scse-geojson/ec306cb6802bcb733743dfc9556f5432ecba5671/nuts-with-uk/nuts2_updated_uk_regions.geojson) | 4,479,942 bytes | `6fc472ecf145bcdba80e51209c7deb8cb961062c5c46a64423a5e88e0d186f58` |

The source repository README states copyright 2025 IIASA Scenario Services team and licenses the content under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). It says the NUTS data comes from Eurostat and asks users to cite:

> Eurostat, *Statistical regions in the European Union and partner countries – NUTS and statistical regions 2021 – 2022 edition*, Publications Office of the European Union, 2022. <https://data.europa.eu/doi/10.2785/321792>

The pinned repository commit has no separate license file.

## Refresh

1. Choose and review a new source commit.
2. Download the two raw source files to the local names above without changing their content.
3. Check that each file is a GeoJSON `FeatureCollection`, all features contain `LEVL_CODE`, `NUTS_ID`, and `CNTR_CODE`, the level is correct, and Austria and the United Kingdom are present.
4. Update the commit, links, byte sizes, and SHA-256 values in this file.

Do not format, minify, simplify, reproject, reorder, or otherwise change properties or coordinates during a refresh.
