"""Tests for the unavoidable-risk product."""

from __future__ import annotations

from provide_pipeline import config
from provide_pipeline.config import RunSpec
from provide_pipeline.pipeline import Session


def test_schema(session):
    doc = session.unavoidable_risk(RunSpec("mean-temperature", "GS"))
    assert doc["product"] == "unavoidable-risk"
    assert doc["thresholds"] == config.RISK_THRESHOLDS
    scenario_key = "gs"
    for code in ("AAA", "BBB"):
        table = doc["data"][code][scenario_key]
        assert len(table) == len(config.RISK_THRESHOLDS)   # one row per threshold
        assert all(len(row) == len(doc["years"]) for row in table)


def test_probabilities_in_unit_interval(session):
    doc = session.unavoidable_risk(RunSpec("mean-temperature", "GS"))
    for entry in doc["data"].values():
        for table in entry.values():
            for row in table:
                for p in row:
                    if p is not None:
                        assert 0.0 - 1e-9 <= p <= 1.0 + 1e-9


def test_risk_decreases_with_higher_threshold(session):
    doc = session.unavoidable_risk(RunSpec("mean-temperature", "GS"))
    table = doc["data"]["AAA"]["gs"]  # rows ordered by ascending threshold
    # For a fixed (last) year, exceedance probability must be non-increasing in T.
    last_year_probs = [row[-1] for row in table]
    finite = [p for p in last_year_probs if p is not None]
    assert finite == sorted(finite, reverse=True)


def test_hotter_scenario_has_higher_risk(session, cube_curpol, regions):
    gs = session.unavoidable_risk(RunSpec("mean-temperature", "GS"))["data"]["AAA"]["gs"]
    cp = Session(cube_curpol, regions).unavoidable_risk(RunSpec("mean-temperature", "CurPol"))["data"]["AAA"]["curpol"]
    # Probability of exceeding 1.5C in the final year should be higher for CurPol.
    idx = config.RISK_THRESHOLDS.index(1.5)
    assert cp[idx][-1] >= gs[idx][-1]
