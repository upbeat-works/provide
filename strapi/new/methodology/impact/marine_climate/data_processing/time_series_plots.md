---
page: methodology
tab: Impact
impact: Marine Climate
category: Data processing
title: Time series plots
locale: "en-EU"
---

For most countries with access to the sea, projected changes in the indicators from the Marine Climate sector averaged over these countries' Exclusive Economic Zones (EEZs) can be visualised on the climate risk dashboard. Projected changes in comparison to two different reference periods can be selected: 1861-1900 (representative of pre-industrial conditions) or 2011-2020 (present-day). The shapefiles of the EEZs are obtained from the [marineregions.org](https://www.marineregions.org/) website (version 11 is used). A 31-year running mean is first applied to the spatial output data from GFDL-ESM2M at yearly resolution to remove the influence of natural variability and focus on the indicators' response to global warming. Then, for each EEZ the data geographically located within the shapefiles are averaged using an area-weighted mean for each year between 2020 and 2300. The data included for each EEZ can be seen on the map displayed under each time series plot. There it can be noticed that the marine areas closest to the shore may be missing, as the separation between ocean and land grid cells in the model doesn't fully match that of the real world. The results obtained after conducting the spatial averaging constitute the best estimate shown on the time series plots, visualised with a line.

Uncertainties around those mean projections are visualised with a confidence interval that is estimated by adding +/- one standard deviation of the variations in GFDL-ESM2M results simulated in a 500-year long control simulation representative of preindustrial climate conditions. It is thus important to highlight that the results for the Marine Climate sector shown in the climate risk dashboard were obtained with one single Earth System Model, while the visualised confidence intervals account only for uncertainty arising from natural variations of the studied indicators around the response to global warming (and not for uncertainty across models as for example is the case for indicators of the Terrestrial Climate sector).
