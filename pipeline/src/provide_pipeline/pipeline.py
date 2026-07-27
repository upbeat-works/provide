"""End-to-end orchestration: turn a cube + regions + spec into a JSON document.

This is the glue that the CLI and the tests both call.  It keeps the expensive,
grid-dependent objects (the fractional mask and area weights) so they can be
reused across many specs on the same cube.
"""

from __future__ import annotations

import xarray as xr

from . import config, impact_geo, impact_time, masks, unavoidable_risk
from .config import RunSpec
from .masks import Regions


class Session:
    """A cube + region masks, ready to compute many products.

    Build the mask/weights once (they depend only on the grid), then call
    :meth:`impact_time` / :meth:`impact_geo` / :meth:`unavoidable_risk` for as
    many scenarios/indicators as you like.
    """

    def __init__(self, cube: xr.Dataset, regions: Regions):
        self.cube = masks.ensure_regular(cube)
        self.regions = regions
        self.fraction = masks.region_fraction(regions, self.cube)
        self.weights = masks.area_weights(self.fraction)

    # -- products -----------------------------------------------------------
    def impact_time(self, spec: RunSpec) -> dict:
        return impact_time.compute(self.cube, self.regions, self.weights, spec)

    def impact_geo(self, spec: RunSpec) -> dict:
        return impact_geo.compute(self.cube, self.regions, self.fraction, spec)

    def unavoidable_risk(self, spec: RunSpec) -> dict:
        return unavoidable_risk.compute(self.cube, self.regions, self.weights, spec)

    def run(self, product: str, spec: RunSpec) -> dict:
        dispatch = {
            "impact-time": self.impact_time,
            "impact-geo": self.impact_geo,
            "unavoidable-risk": self.unavoidable_risk,
        }
        if product not in dispatch:
            raise ValueError(f"unknown product {product!r}; expected one of {list(dispatch)}")
        return dispatch[product](spec)


def output_filename(product: str, spec: RunSpec) -> str:
    """Legacy-compatible output filename for a product/spec."""
    return (
        f"{product.replace('-', '_')}_{spec.scenario}_{spec.indicator}_"
        f"{spec.frequency_tag}_{spec.reference}.json"
    )


def session_from_files(data_dir: str, scenario: str, shapefile: str, geographies_csv: str) -> Session:
    """Build a :class:`Session` from on-disk inputs."""
    from . import io

    cube = io.load_scenario_cube(data_dir, scenario)
    gdf = io.load_regions_geodataframe(shapefile)
    geographies = io.load_geographies(geographies_csv)
    regions = masks.build_regions(gdf, geographies, config.REGION_CODE_COLUMN)
    return Session(cube, regions)
