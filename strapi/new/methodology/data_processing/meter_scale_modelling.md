---
page: methodology
tab: Data processing
title: "Meter-scale modelling"
locale: "en-EU"
---

Apart from 100m, for the iconic cities, also 1m-scale heat stress simulations are executed using the HiREx model ([Souverijns et al., 2023](https://doi.org/10.1002/joc.8268)). This requires a detailed representation of individual features within the city quarters that are modelled, such as trees, buildings (and their height), roads, etc. These simulations are limited to one typical day in summer, due to their high computational costs. By considering the solar zenith and azimuth angles, shaded areas cast by buildings or trees were calculated for each hour of the day, as also the sky view factor (the fraction of the sky hemisphere visible from the ground). Combining the meteorological data with the detailed land surface properties, the HiREx module can iteratively calculate the Wet Bulb Globe Temperature at a 1m resolution, considering shade and solar zenith angles in each model time step. As this approach is nested in the UrbClim simulations, one can do calculations easily for both present and any future scenario calculated by UrbClim.
