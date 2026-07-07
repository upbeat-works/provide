---
page: methodology
tab: Impact
impact: Marine Climate
category: Model simulations
title: The Adaptive Emission Reduction Approach
locale: "en-EU"
---

As a fully coupled Earth System Model, GFDL-ESM2M calculates its own Global Mean Temperature (GMT) and is therefore not exactly following the GMT trajectories modelled with FaIR for a given scenario, but rather approximating those using the Adaptive Emission Reduction Approach (AERA, [Terhaar et al. 2022](https://www.nature.com/articles/s41558-022-01537-9)). This approach relies on a dynamic (every 5-year timestep) estimation of the emission reductions required to stabilise at a given GMT target in the future (such as the 1.5°C goal of the Paris Agreement), based on the relationship between the cumulative emissions used to force the model and the simulated change in GMT.

In practice, the AREA consists of three main steps. First, past anthropogenic warming until the timestep of interest is determined using a 31-year running mean, in order to filter out GMT variations caused by natural variability. This also gives the amount of global warming remaining until the given GMT target is reached. Second, the remaining emission budget that can still be emitted before the target GMT will be reached is estimated using the transient climate response to cumulative emissions (TCRE) up to the current timestep, defined as the ratio of past warming and past cumulative emissions. The remaining emission budget is estimated as the remaining global warming until the GMT target is reached divided by TCRE (assuming a linear relationship). As a last step, an emission trajectory until the GMT target is reached is suggested by distributing the remaining emissions budget over the future using a cubic polynomial function.

Because GFDL-ESM2M is run with the AERA and not driven by FaIR, the GMT and emissions trajectories it simulates do not exactly follow those simulated by FaIR but only approximate them. However, in the climate risk dashboard projected impacts for sectors for which impacts are derived using GMT trajectories from FaIR (for example for the Terrestrial Climate sector) and those for the Marine Climate sector simulated with GFDL are accessible by clicking on the same scenario name, illustrated in both cases by the scenario trajectories simulated by FaIR for the sake of simplicity.
