---
page: methodology
tab: Data processing
title: General
locale: "en-EU"
---

For the dashboard, we analyse the glacier projections for various geographies, including the country level. For the aggregation, each glacier is assigned to a geography based on the glacier’s terminus position. For each geography and each climate change scenario, we processed the corresponding data to generate three distinct plots, as described below.

The uncertainty in the projections originates from the global climate system response and climate variability as well as the emulated local climate. The uncertainty range is computed from the full ensemble for each scenario, taking the respective weight of each quantile into account. Glacier model uncertainty is not taken into account here.

The glacier variables shown in the dashboard consist of volume and area as percentages relative to the geographies total value in 2020 and the thinning rate in metres of water equivalent (w. e.) per year. A thinning rate of 1 means that, on average, the glaciers lost what corresponds to 1 metre of water across the entire glacierized area in that year. Thinning rate is calculated by dividing the annual volume change by the average area and adjusting for the density of ice and water.

For more details on our data aggregation methods, please refer to our GitHub repository at [https://github.com/OGGM/provide](https://github.com/OGGM/provide), where you can find the actual code used for the creation of the glacier data displayed on the dashboard.
