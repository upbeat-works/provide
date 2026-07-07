---
page: methodology
tab: Impact
impact: Glaciers
category: Models
title: OGGM
locale: "en-EU"
---

We used the open-source Open Global Glacier Model (OGGM v1.6.1; [Maussion et al., 2019](https://doi.org/10.5194/gmd-12-909-2019), [Maussion et al., 2024](https://doi.org/10.5281/zenodo.8287580)) to simulate individual glacier volume, area and runoff changes for the more than 200,000 glaciers worldwide ([Randolph Glacier Inventory](http://www.glims.org/RGI), v6). The term `glaciers` describes here all glaciers and ice caps outside the Greenland and Antarctic ice sheets ([World Glaciers Explorer](https://edu.oggm.org/en/latest/explorer.html)). 

OGGM computes ice flow along a one dimensional glacier flowline, obtained from global digital elevation models and glacier outlines. Annual glacier mass balance (or glacier thinning rate, expressed in m water equivalent per year) is estimated with a temperature index melt model ([Maussion et al., 2019](https://doi.org/10.5194/gmd-12-909-2019)). We calibrate the model to match glacier mass change observations averaged over 2000-2020 ([Hugonnet et al., 2021](https://doi.org/10.1038/s41586-021-03436-z)) obtained with remote sensing, and use additional in-situ observations from the World Glacier Monitoring Service ([WGMS](https://wgms.ch/)) where available. The gridded monthly climate data used as reference for the 1979 to 2020 period is W5E5v2.0 ([Lange and others, 2021](https://doi.org/10.48364/ISIMIP.342217)). For the initialisation of the model to the 2020 glacier state, OGGM v1.6.1 relies on a [dynamic spinup](https://docs.oggm.org/en/latest/dynamic-spinup.html) which iteratively searches for a 1979 glacier state and recalibrates the temperature index model to find a dynamically consistent model initialisation run which simultaneously matches (1) glacier area at the inventory date and (2) mass change observations.  

For more information, [please visit the model documentation website of the used OGGM version](https://docs.oggm.org/en/v1.6.1/) or the documentation of the [OGGM standard projections](https://github.com/OGGM/oggm-standard-projections-csv-files).
