"""Tests for the impact-geo (gridded map) product."""

from __future__ import annotations

import numpy as np

from provide_pipeline.config import RunSpec


def test_schema_and_years(session):
    doc = session.impact_geo(RunSpec("mean-temperature", "GS"))
    assert doc["product"] == "impact-geo"
    assert doc["years"] == [2030, 2050, 2100]
    for code in ("AAA", "BBB"):
        entry = doc["data"][code]
        assert set(entry) == {"lat", "lon", "grids"}
        n_lat, n_lon = len(entry["lat"]), len(entry["lon"])
        assert n_lat > 0 and n_lon > 0
        for year in ("2030", "2050", "2100"):
            grid = entry["grids"][year]
            assert len(grid) == n_lat
            assert all(len(row) == n_lon for row in grid)


def test_map_is_cropped_to_country(session, regions):
    # AAA box is (-20,-10,20,10): the cropped grid must stay within a small margin.
    entry = session.impact_geo(RunSpec("mean-temperature", "GS"))["data"]["AAA"]
    assert min(entry["lat"]) >= -20 and max(entry["lat"]) <= 20
    assert min(entry["lon"]) >= -25 and max(entry["lon"]) <= 25


def test_warming_grid_mostly_positive_by_2100(session):
    entry = session.impact_geo(RunSpec("mean-temperature", "GS"))["data"]["AAA"]
    grid = np.array([[v for v in row] for row in entry["grids"]["2100"]], dtype="float64")
    finite = grid[np.isfinite(grid)]
    assert np.nanmean(finite) > 0.0
