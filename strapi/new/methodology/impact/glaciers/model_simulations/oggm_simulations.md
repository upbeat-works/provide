---
page: methodology
tab: Impact
impact: Glaciers
category: Model simulations
title: OGGM simulations
locale: "en-EU"
---

We start our glacier projections from the initial glacier state 2020 obtained from OGGM v1.6.1 as described above. From 2020 until 2100, we forced OGGM with climate change realisations from the MESMER-FaIR ensemble. For each of the 10 PROVIDE scenarios (link to scenario description), 1000 FaIR realisation were computed to account for the climate system response, and for each FaIR realisation 20 General Circulation Models or Earth System Models (in the following 'climate models') were emulated by MESMER. Computing glacier projections for 10x1000x20 experiments was not computationally feasible, nor could we store the input and output data. Instead, we generated quantiles (5%, 25%, 50%, 75%, 95%iles) from the MESMER-FaIR ensemble to generate a smaller ensemble of 100 realisations per scenario (20 climate models, 5 quantiles). The quantiles were chosen to accurately represent the spread of the ensemble for each glacier region. All climate projections were bias-corrected to the W5E5v2.0 dataset ([Lange and others, 2021](https://doi.org/10.48364/ISIMIP.342217)) over the period 2000-2019 to then simulate future glacier projections for all glaciers individually. The projections are available for all mountain glaciers of the world except those in Subantarctic and Antarctic Islands (where MESMER data was not available).
