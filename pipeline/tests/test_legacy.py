"""Legacy-API parity tooling: URL building and grid comparison (no network)."""

from __future__ import annotations

import urllib.parse

import numpy as np
import pytest
import xarray as xr

from provide_pipeline import legacy
from provide_pipeline.config import RunSpec


def test_impact_geo_url_matches_real_api_request():
    # The exact request the client shared for DEU/curpol/2030.
    url = legacy.impact_geo_url(geography="DEU", scenario="CurPol", year=2030)
    parsed = urllib.parse.urlparse(url)
    assert parsed.netloc == "provide-api-staging.climateanalytics.org"
    assert parsed.path == "/api/impact-geo/"
    params = dict(urllib.parse.parse_qsl(parsed.query))
    assert params == {
        "scenario": "curpol",
        "indicator": "terclim-mean-temperature",
        "geography": "DEU",
        "year": "2030",
        "time": "annual",
        "frequency": "None",
        "reference": "pre-industrial",
        "spatial": "area",
        "format": "netcdf",
    }


def test_scenario_and_indicator_mapping():
    assert legacy.legacy_scenario("CurPol_OS") == "curpol-os"
    assert legacy.legacy_indicator("hot-extreme") == "terclim-hot-extreme"


def _legacy_nc_from_modern(document: dict, geography: str, year: int, tmp_path, jitter=0.0):
    """Round-trip a modern impact-geo entry into a legacy-shaped netCDF."""
    entry = document["data"][geography]
    grid = entry["grids"][str(year)]
    values = np.asarray([[np.nan if v is None else v + jitter for v in row] for row in grid])
    ds = xr.Dataset(
        {"terclim-mean-temperature": (("latitude", "longitude"), values)},
        coords={"latitude": entry["lat"], "longitude": entry["lon"]},
    )
    path = tmp_path / f"legacy_{geography}_{year}.nc"
    ds.to_netcdf(path)
    return str(path)


@pytest.fixture(scope="module")
def geo_document(session):
    return session.impact_geo(RunSpec("mean-temperature", "GS"))


def test_compare_identical_grids_is_zero_diff(geo_document, tmp_path):
    path = _legacy_nc_from_modern(geo_document, "AAA", 2030, tmp_path)
    stats = legacy.compare_impact_geo(path, geo_document, "AAA", 2030)
    assert stats["n_compared"] > 0
    assert stats["max_abs_diff"] == pytest.approx(0.0, abs=1e-12)


def test_compare_detects_systematic_offset(geo_document, tmp_path):
    path = _legacy_nc_from_modern(geo_document, "AAA", 2030, tmp_path, jitter=0.5)
    stats = legacy.compare_impact_geo(path, geo_document, "AAA", 2030)
    assert stats["max_abs_diff"] == pytest.approx(0.5, abs=1e-9)
    assert stats["mean_abs_diff"] == pytest.approx(0.5, abs=1e-9)


def test_compare_with_no_overlap_is_a_clear_error(geo_document, tmp_path):
    entry = geo_document["data"]["AAA"]
    ds = xr.Dataset(
        {"terclim-mean-temperature": (("latitude", "longitude"), [[1.0]])},
        coords={"latitude": [89.0], "longitude": [179.0]},  # nowhere near AAA
    )
    path = tmp_path / "far.nc"
    ds.to_netcdf(path)
    with pytest.raises(ValueError, match="no overlapping"):
        legacy.compare_impact_geo(str(path), geo_document, "AAA", 2030)
    assert entry["lat"]  # sanity: AAA does have a grid


def test_compare_missing_year_is_a_clear_error(geo_document, tmp_path):
    path = _legacy_nc_from_modern(geo_document, "AAA", 2030, tmp_path)
    with pytest.raises(ValueError, match="not in the modern document"):
        legacy.compare_impact_geo(path, geo_document, "AAA", 1999)
