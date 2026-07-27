"""Output sanity gate: is a directory of product JSONs safe to publish?

This turns the scientific sanity assertions that already live in the test
suite (band ordering, probabilities in [0, 1], risk monotonic in threshold,
grid shapes consistent) into a command a scientist runs on *real* outputs
before uploading::

    provide-pipeline check ../data_out

Green means "schema-valid and scientifically plausible", not "correct" -- the
one-time parity validation against legacy outputs still applies when switching
datasets or code versions.
"""

from __future__ import annotations

import glob
import json
import os

from .validate import ERROR, WARNING, Problem, has_errors

_TOL = 1e-6


def check_dir(path: str) -> list[Problem]:
    """Check every ``*.json`` product file in a directory."""
    paths = sorted(glob.glob(os.path.join(path, "*.json")))
    paths = [p for p in paths if os.path.basename(p) != "published.json"]
    if not paths:
        return [Problem(ERROR, path, "no *.json product files found.")]
    problems: list[Problem] = []
    for file_path in paths:
        problems += check_file(file_path)
    return problems


def check_file(path: str) -> list[Problem]:
    """Strict-parse one file and run its product's checks."""
    name = os.path.basename(path)
    try:
        with open(path, encoding="utf-8") as handle:
            document = json.load(handle, parse_constant=_reject_nonfinite)
    except Exception as exc:
        return [Problem(ERROR, name, f"not valid strict JSON: {exc}")]
    return [Problem(p.level, name, p.message) for p in check_document(document)]


def _reject_nonfinite(token: str):
    raise ValueError(f"non-finite constant {token!r} (NaN/Infinity are not valid JSON)")


def check_document(document: dict) -> list[Problem]:
    """Dispatch to the per-product rules."""
    where = "document"
    product = document.get("product")
    checks = {
        "impact-time": _check_impact_time,
        "impact-geo": _check_impact_geo,
        "unavoidable-risk": _check_unavoidable_risk,
    }
    if product not in checks:
        return [Problem(ERROR, where, f"unknown or missing 'product' ({product!r}).")]
    data = document.get("data")
    if not isinstance(data, dict) or not data:
        return [Problem(ERROR, where, "'data' is missing or empty.")]
    if not document.get("years"):
        return [Problem(ERROR, where, "'years' is missing or empty.")]
    return checks[product](document)


# ---------------------------------------------------------------------------
# Per-product rules
# ---------------------------------------------------------------------------
def _check_impact_time(document: dict) -> list[Problem]:
    problems: list[Problem] = []
    n_years = len(document["years"])
    if document.get("columns") != ["lower", "mean", "upper"]:
        problems.append(Problem(ERROR, "impact-time", f"'columns' should be ['lower', 'mean', 'upper'], got {document.get('columns')!r}."))
        return problems
    # For mean-temperature all three columns are percentiles of the same
    # ensemble, so lower <= mean <= upper strictly holds.  For the extremes the
    # central value is a plug-in tail quantile while the band is a *bootstrap*
    # CI of it -- with small ensembles the CI need not contain the plug-in
    # estimate, so "mean outside band" is only a warning there.
    is_extreme = document.get("indicator") != "mean-temperature"
    bad_shape, band_inverted, mean_outside, all_null = [], [], [], []
    for code, rows in document["data"].items():
        if len(rows) != n_years or any(not isinstance(r, list) or len(r) != 3 for r in rows):
            bad_shape.append(code)
            continue
        finite = [r for r in rows if all(v is not None for v in r)]
        if not finite:
            all_null.append(code)
            continue
        if any(r[0] > r[2] + _TOL for r in finite):
            band_inverted.append(code)
        elif any(not (r[0] <= r[1] + _TOL and r[1] <= r[2] + _TOL) for r in finite):
            mean_outside.append(code)
    if bad_shape:
        problems.append(Problem(ERROR, "impact-time", f"{len(bad_shape)} geographies have rows that don't match years x [lower, mean, upper]: {bad_shape[:5]}"))
    if band_inverted:
        problems.append(Problem(ERROR, "impact-time", f"{len(band_inverted)} geographies have lower > upper: {band_inverted[:5]}"))
    if mean_outside:
        level = WARNING if is_extreme else ERROR
        problems.append(Problem(level, "impact-time", f"{len(mean_outside)} geographies have the central value outside [lower, upper]: {mean_outside[:5]}"))
    if all_null:
        problems.append(Problem(WARNING, "impact-time", f"{len(all_null)} geographies are entirely null (no grid cells resolved?): {all_null[:5]}"))
    return problems


def _check_unavoidable_risk(document: dict) -> list[Problem]:
    problems: list[Problem] = []
    thresholds, n_years = document.get("thresholds"), len(document["years"])
    if not thresholds:
        return [Problem(ERROR, "unavoidable-risk", "'thresholds' is missing or empty.")]
    bad_shape, out_of_range, not_monotonic = [], [], []
    for code, per_scenario in document["data"].items():
        for rows in per_scenario.values():
            if len(rows) != len(thresholds) or any(len(r) != n_years for r in rows):
                bad_shape.append(code)
                continue
            values = [v for r in rows for v in r if v is not None]
            if any(v < -_TOL or v > 1 + _TOL for v in values):
                out_of_range.append(code)
            # P(exceed T) must not increase with T, per year column
            for year_idx in range(n_years):
                column = [r[year_idx] for r in rows if r[year_idx] is not None]
                if any(b > a + _TOL for a, b in zip(column, column[1:])):
                    not_monotonic.append(code)
                    break
    if bad_shape:
        problems.append(Problem(ERROR, "unavoidable-risk", f"{len(bad_shape)} geographies don't match thresholds x years: {bad_shape[:5]}"))
    if out_of_range:
        problems.append(Problem(ERROR, "unavoidable-risk", f"{len(out_of_range)} geographies have probabilities outside [0, 1]: {out_of_range[:5]}"))
    if not_monotonic:
        problems.append(Problem(ERROR, "unavoidable-risk", f"{len(not_monotonic)} geographies have risk increasing with threshold: {not_monotonic[:5]}"))
    return problems


def _check_impact_geo(document: dict) -> list[Problem]:
    problems: list[Problem] = []
    year_keys = [str(int(y)) for y in document["years"]]
    bad_shape, empty = [], []
    for code, entry in document["data"].items():
        lat, lon, grids = entry.get("lat", []), entry.get("lon", []), entry.get("grids", {})
        if not lat or not lon:
            empty.append(code)
            continue
        if sorted(grids) != sorted(year_keys):
            bad_shape.append(code)
            continue
        for grid in grids.values():
            if len(grid) != len(lat) or any(len(row) != len(lon) for row in grid):
                bad_shape.append(code)
                break
    if bad_shape:
        problems.append(Problem(ERROR, "impact-geo", f"{len(bad_shape)} geographies have grids not matching lat x lon x years: {bad_shape[:5]}"))
    if empty:
        problems.append(Problem(WARNING, "impact-geo", f"{len(empty)} geographies have no covered grid cells (too small for this grid?): {empty[:5]}"))
    return problems


__all__ = ["check_dir", "check_file", "check_document", "has_errors"]
