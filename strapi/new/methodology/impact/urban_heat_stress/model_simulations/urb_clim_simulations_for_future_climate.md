---
page: methodology
tab: Impact
impact: Urban heat stress
category: Model simulations
title: UrbClim simulations for future climate
locale: "en-EU"
---

The UrbClim numerical model is also used to project future climate until 2100 in the same cities. The forcing for these simulations is obtained by combining simulations from the MESMER-FaIR ensemble (see above) and the Earth System Model data archive from the [CMIP6](https://wcrp-cmip.org/cmip-phase-6-cmip6/) project. Instead of re-running the UrbClim model with MESMER forcing, time series data from the present-day simulations calculated with UrbClim are perturbed with the climate change signal obtained from the combined MESMER-CMIP6 data archive using a quantile mapping bias algorithm ([Olsson et al., 2009](https://doi.org/10.1016/j.atmosres.2009.01.015); [Willems and Vrac, 2011](https://doi.org/10.1016/j.jhydrol.2011.02.030)). The result of the perturbation based statistical downscaling method consists of time series of the same length and time scale as the historical time series but representative of future climate conditions. A detailed description of the procedure applied can be found in [Souverijns et al. (2022)](https://doi.org/10.1016/j.uclim.2022.101331). Future climate and WBGT calculations were executed for the three main PROVIDE scenarios:

-   2020 climate policies
-   Delayed climate action
-   Shifting pathway

For each of these scenarios, the median (50th percentile) as well as the 5th & 95th percentiles of the MESMER-FaIR ensemble runs are extracted and used to force UrbClim, so as to generate an estimate of uncertainty reflecting how the spread in the response from climate models to greenhouse gas emissions influences UrbClim results.

It must be noted that future urban development and growth is not included. As such, the spatial profile of the city is constant in future simulations.
