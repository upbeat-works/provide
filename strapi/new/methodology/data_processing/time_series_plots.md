---
page: methodology
tab: Data processing
title: Time series plots
locale: "en-EU"
---

The climate risk dashboard includes time series plots showing the median evolution of each indicator over time for each country and for each scenario. To obtain these time series, results from each simulation obtained with each model configuration were first spatially averaged over the country areas. Data were then extracted for each timestep visualised in the tool (from 2020 till 2100 or 2300 depending on the scenario), as well as each reference period (2011-2020 and 1850-1900), from which the changes between each timestep and each reference period were calculated.

For the indicators quantifying changes in soil moisture, fire weather or Annual maximum temperature (obtained with MESMER-X) and Mean temperature (obtained with MESMER), the median projections (visualised with a thick line) were calculated by identifying the 50th percentile across all obtained realisations (1000 times the number of model configurations for each scenario), while the confidence interval was calculated by identifying the 5th and 95th percentiles across those. Changes in indicators quantifying changes in soil moisture are expressed in % relative to values simulated over the selected reference period.

For the Extremely cold year and Extremely hot year indicators, in order to calculate the results for their 1-in-10-year, 1-in-20-year and 1-in-50-year events their 2nd, 5th, 10th, 90th, 95th, and 98th percentiles were first identified from the ensemble of 1000 MESMER realisations of variability, for each of the 25 model configurations. These percentiles were then combined with the 100 MESMER forced responses corresponding to each model configuration. 25*100 values are thus obtained for each of the 6 indicators (1-in-10-year, 1-in-20-year and 1-in-50-year Extremely cold and hot years). The mean projections (visualised with a thick line) were calculated by identifying the 50th percentile across this ensemble, while the confidence interval was calculated by identifying the 5th and 95th percentiles across those.
