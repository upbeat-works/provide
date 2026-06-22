---
page: methodology
tab: Impact
impact: Urban heat stress
category: Model simulations
title: "UrbClim simulations for present-day climate"
locale: "en-EU"
---

As a first step, the UrbClim model is run for a historical period of 10 years (2008-2017). The synoptic forcing at the top and lateral boundaries of the UrbClim domain is provided by the ERA-5 re-analysis product of the ECMWF ([Hersbach et al., 2020](<https://doi.org/> 10.1002/qj.3803)), which is available at a spatial resolution of 31 kms and at hourly temporal resolution. Next to state-of-the-art meteorological data, a detailed representation of land surface properties is required as input for the UrbClim numerical model, and is achieved with the following datasets:

-   Land cover: CORINE (Europe; [Copernicus, 2019](https://doi.org/10.2909/960998c1-1870-4e82-8051-6485205ebbac)), WorldCover (rest of the world; [Zanaga et al., 2021](https://zenodo.org/doi/10.5281/zenodo.5571935))
-   Building fraction: Global Human Settlement Layer ([Corbane et al., 2021](https://doi.org/10.1007/s00521-020-05449-7)),
-   Soil sealing fraction: Landsat, Sentinel-1 & VIIRS ([Zhang et al., 2020](https://doi.org/10.5194/essd-12-1625-2020))
-   Soil texture: [Hengl and MacMillan ,2019](http://www.soilmapper.org/)
-   Normalized Difference Vegetation Index (NDVI): Landsat or MODIS
-   Anthropogenic heat flux: [Jin et al., 2019](https://doi.org/10.1038/s41597-019-0143-1)
-   Digital Elevation Model: COPERNICUS ([ESA, 2020](https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model))

The UrbClim model produces hourly output for meteorological variables such as temperatures, humidity, wind speed, but also soil properties and energy fluxes for the 2008-2017 period and at 100m spatial resolution, from which are calculated the results for the indicators selectable in the climate risk dashboard.

Next to basic meteorological variables, heat stress is calculated based on the model of [Liljegren et al. (2008)](https://doi.org/10.1080/15459620802310770). Wet bulb globe temperature, a metric that accounts for temperature, humidity and radiation and serves as a proxy for perceived temperature is calculated following ISO 7243 norms based on the meteorological output of UrbClim, solar radiation information from the reanalysis dataset ERA-5 ([Hersbach et al., 2020](https://rmets.onlinelibrary.wiley.com/doi/10.1002/qj.3803)) & a detailed representation of the building footprints within the urban areas to account for cooling due to shading effects. This latter information is obtained from Open Street Map, Google Africa Buildings and Microsoft Building Footprints. This information is used to calculate heat stress at 100m spatial resolution for every hour of the day.
