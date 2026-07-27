"""Tests for the impact-time product."""

from __future__ import annotations

import numpy as np
import pytest

from provide_pipeline import config
from provide_pipeline.config import RunSpec


def test_schema_and_shapes(session):
    doc = session.impact_time(RunSpec("mean-temperature", "GS"))
    assert doc["product"] == "impact-time"
    assert doc["columns"] == ["lower", "mean", "upper"]
    assert set(doc["data"]) == {"AAA", "BBB"}
    n_years = len(doc["years"])
    assert doc["years"] == config.FORECAST_YEARS_TIME
    for rows in doc["data"].values():
        assert len(rows) == n_years
        assert all(len(r) == 3 for r in rows)


def test_band_orders_lower_mean_upper(session):
    doc = session.impact_time(RunSpec("mean-temperature", "GS"))
    for rows in doc["data"].values():
        for lower, mean, upper in rows:
            if None in (lower, mean, upper):
                continue
            assert lower <= mean + 1e-9
            assert mean <= upper + 1e-9


def test_reference_anomaly_is_zero_at_baseline(session):
    # With a flat pre-2000 climatology, the pre-industrial anomaly baseline is ~0
    # and 2020 warming should be small and positive for GS.
    doc = session.impact_time(RunSpec("mean-temperature", "GS"))
    rows = doc["data"]["AAA"]
    means = [r[1] for r in rows]
    assert means[0] == pytest.approx(0.0, abs=0.3)      # 2020, just after 2000
    assert means[-1] > means[0]                          # 2100 warmer than 2020


def test_hotter_scenario_warms_more(session, cube_curpol, regions):
    from provide_pipeline.pipeline import Session

    gs = session.impact_time(RunSpec("mean-temperature", "GS"))["data"]["AAA"][-1][1]
    cp = Session(cube_curpol, regions).impact_time(RunSpec("mean-temperature", "CurPol"))["data"]["AAA"][-1][1]
    assert cp > gs


def test_extreme_requires_frequency():
    with pytest.raises(ValueError):
        RunSpec("hot-extreme", "GS")  # no frequency


def test_hot_extreme_runs_and_is_deterministic(session):
    a = session.impact_time(RunSpec("hot-extreme", "GS", frequency=0.1))
    b = session.impact_time(RunSpec("hot-extreme", "GS", frequency=0.1))
    assert a["data"]["AAA"] == b["data"]["AAA"]   # seeded bootstrap -> reproducible


def test_hot_extreme_above_cold_extreme(session):
    hot = session.impact_time(RunSpec("hot-extreme", "GS", frequency=0.1))["data"]["AAA"]
    cold = session.impact_time(RunSpec("cold-extreme", "GS", frequency=0.1))["data"]["AAA"]
    # The hot tail should sit above the cold tail on average (anomalies aside).
    hot_mean = np.nanmean([r[1] for r in hot if r[1] is not None])
    cold_mean = np.nanmean([r[1] for r in cold if r[1] is not None])
    assert hot_mean >= cold_mean
