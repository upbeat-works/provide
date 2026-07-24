"""Tests for the regionmask-based masking + weighting (replaces legacy tools.py)."""

from __future__ import annotations

import numpy as np
import pytest

from provide_pipeline import masks, synthetic
from provide_pipeline.masks import build_regions


def test_fraction_in_unit_interval(session):
    frac = session.fraction
    assert set(("region", "lat", "lon")).issubset(frac.dims)
    vals = frac.values
    finite = vals[np.isfinite(vals)]
    assert finite.min() >= -1e-9
    assert finite.max() <= 1 + 1e-9


def test_region_order_matches_codes(regions, cube):
    # region dimension is positional and aligned with regions.codes
    assert regions.codes == ["AAA", "BBB"]


def test_box_country_fraction_is_one_in_interior(session, regions):
    # AAA is the box (-20,-10,20,10); a cell well inside should be ~fully covered.
    frac = session.fraction.isel(region=regions.codes.index("AAA"))
    interior = frac.sel(lat=2.5, lon=2.5, method="nearest").item()
    assert interior == pytest.approx(1.0, abs=0.1)
    # A cell far outside the box must be zero.
    outside = frac.sel(lat=-80.0, lon=170.0, method="nearest").item()
    assert outside == pytest.approx(0.0, abs=1e-6)


def test_area_weights_apply_cos_latitude(session):
    # For a fully-covered cell, weight == cos(lat).
    frac = session.fraction.isel(region=0)
    weights = session.weights.isel(region=0)
    full = frac.where(frac > 0.99)
    lat = weights["lat"]
    expected = np.cos(np.deg2rad(lat))
    got = (weights / frac).where(full.notnull())
    # ratio weight/frac should equal cos(lat) wherever frac>0
    diff = (got - expected).values
    diff = diff[np.isfinite(diff)]
    assert np.allclose(diff, 0.0, atol=1e-9)


def test_ensure_regular_rejects_irregular_grid(cube):
    import numpy as np

    irregular = cube.copy()
    new_lat = irregular["lat"].values.copy()
    new_lat[0] -= 3.0  # break equal spacing
    irregular = irregular.assign_coords(lat=new_lat)
    with pytest.raises(ValueError, match="equally spaced"):
        masks.ensure_regular(irregular)


def test_missing_geography_warns_but_continues(cube):
    gdf = synthetic.make_geodataframe()
    with pytest.warns(UserWarning):
        built = build_regions(gdf, ["AAA", "ZZZ"])  # ZZZ absent
    assert built.codes == ["AAA"]
