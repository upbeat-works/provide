---
page: methodology
tab: Impact
impact: Urban heat stress
category: Model simulations
title: Heat impact metrics
locale: "en-EU"
---

To compute the heat impact metrics ‘Population exposed to heatwaves’ and ‘Population exposed to moderate/high/very high/extreme heatstress’ we input the annual UrbClim indicators 'Heatwave days' and 'Days a year with moderate/high/very high/extreme heatstress' as hazard event data into the CLIMADA model. The exposure in terms of population is obtained from the 'WorldPop Constrained Individual countries 2020 UN adjusted (100m resolution)' dataset ([Bondarenko et al., 2020a](https://hub.worldpop.org/doi/10.5258/SOTON/WP00685), [Bondarenko et al., 2020b](https://hub.worldpop.org/doi/10.5258/SOTON/WP00683)). The WorldPop dataset matches the United Nations national population estimate with data on building locations. Thus, it provides accurate data on the city-level and is well-suited for our calculation in which we extract the four vertices of the rectangular domain of the hazard to trim the original country-level gridded population data into the city-level gridded population data.

The size and distribution of the population stays constant over time, meaning that we only account for changes in climate and not those in socio-economic factors.  We furthermore only consider the outdoor temperatures meaning that mitigating or amplifying effects of staying indoors on heat stress are ignored. No particular vulnerabilities, such as age group, are considered. 

The impact function is represented by a one-to-one mapping, meaning that the impact is computed by multiplying the population at a given location by the hazard occurring in this location. If a location has a population of 100 and experiences 23 heatwave days on average per year, the impact at the location would be 100 * 23 = 2300 average person-heatwave days per year. We apply the same calculation methodology for the other indicators.  The heat impact indicators are available in mean, 5th percentile and 95th percentile for the three main PROVIDE scenarios from 2011 to 2100 decadally. The mean, 5th percentile and 95th percentile are obtained by inputting the mean, 5th percentile and 95th percentile of the hazard data into CLIMADA.
