"""impact-geo: gridded change maps, one per forecast year, per country.

Legacy equivalent: ``provide/impact_geo.py``.

The legacy map path kept the spatial grid (it commented out the
``mean(("lon","lat"))`` reduction) and cropped each country to its bounding
box.  Here we compute the global per-cell anomaly once, then clip each country
to the cells its polygon actually covers (fraction > 0) -- a cleaner, mask-based
crop instead of a bounding box.
"""

from __future__ import annotations

import numpy as np
import xarray as xr

from . import config, core
from .config import RunSpec
from .masks import Regions


def compute(cube: xr.Dataset, regions: Regions, fraction: xr.DataArray, spec: RunSpec) -> dict:
    """Compute the impact-geo product for one :class:`RunSpec`.

    ``fraction`` is the ``(region, lat, lon)`` coverage array from
    :func:`masks.region_fraction`.
    """
    grid_median = core.gridded_ensemble_median(cube).load()  # (year, lat, lon)

    start, end = config.REFERENCE_PERIODS[spec.reference]
    baseline = grid_median.sel({config.YEAR: slice(start, end)}).mean(config.YEAR)  # (lat, lon)
    anomaly = grid_median - baseline  # (year, lat, lon)

    years = [y for y in config.GEO_YEARS if y in set(np.asarray(anomaly[config.YEAR]))]
    anomaly = anomaly.sel({config.YEAR: years})

    data = {}
    for i, code in enumerate(regions.codes):
        data[code] = _country_maps(anomaly, fraction.isel(region=i), years)

    return {
        "product": "impact-geo",
        "indicator": spec.indicator,
        "scenario": spec.scenario,
        "reference": spec.reference,
        "frequency": spec.frequency,
        "years": years,
        "units": "deg C (anomaly vs reference)",
        "data": data,
    }


def _country_maps(anomaly: xr.DataArray, cover: xr.DataArray, years: list[int]) -> dict:
    """Clip the global anomaly to one country's covered cells + bounding box."""
    from .io import rows_to_native

    masked = anomaly.where(cover > 0)
    # Crop to the lat/lon extent that actually has data (keeps files small).
    has = cover > 0
    lat_hit = has.any(config.LON)
    lon_hit = has.any(config.LAT)
    if not bool(lat_hit.any()):
        return {"lat": [], "lon": [], "grids": {}}
    masked = masked.isel(
        {config.LAT: np.where(lat_hit.values)[0], config.LON: np.where(lon_hit.values)[0]}
    )
    grids = {str(int(y)): rows_to_native(masked.sel({config.YEAR: y}).values) for y in years}
    return {
        "lat": rows_to_native(masked[config.LAT].values),
        "lon": rows_to_native(masked[config.LON].values),
        "grids": grids,
    }
