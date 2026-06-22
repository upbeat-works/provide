---
page: methodology
tab: Impact
impact: Terrestrial climate
category: Model simulations
title: MESMER emulations
locale: "en-EU"
---

First, for each scenario and each of the 25 configurations of MESMER, the MESMER module simulating the response of local annual mean temperature to the GMT forcing is used to generate one single forced response of MESMER to each of the selected 100 FaIR emulations (i.e., 100 forced responses are obtained once this step is complete). Then, for each of these 100 runs, the MESMER module simulating the local variability of annual mean temperature is run 10 times to generate 1000 manifestations of stochastic variability. Because this second module is independent of Global Mean Temperature, each of the 1000 manifestations of variability can be combined with each of the 100 forced responses. Therefore, in theory 100x1000 possible evolutions of the spatially resolved fields of annual mean temperature from 1850 to 2100 can be obtained for each scenario and each of the 25 model configurations.

Because they sample the effect of natural variability, the 1000 realisations are used to calculate the temperature values during extreme events for specific return periods (see section Data Processing). For the calculation of the changes in Mean Temperature however, the amount of data is first reduced by selecting 10 representative manifestations of natural variability out of the 1000 generated with MESMER, which can be combined with each MESMER configuration and FaIR emulation. This results in 25x100x10 = 25,000 MESMER emulations for each scenario. This procedure is described in more detail in Schwaab et al. (in prep.).
