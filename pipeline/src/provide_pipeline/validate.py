"""Input-contract validation: fail fast, in plain language, *before* computing.

This is the "can the pipeline digest this dataset?" gate that scientists run
first when they drop a new MESMER cube (or new polygons/geography list).  Every
rule the pipeline silently assumes is spelled out here as an explicit check
with a message a non-developer can act on.

The contract for a MESMER cube (see ``config.py``):

* a single variable ``tas``
* dimensions drawn from ``(mesmer_esm_calibration, fair_scenario, run_id,
  realisation, year, lat, lon)`` -- ``year``/``lat``/``lon`` are required
* equally-spaced lat/lon (required by ``mask_3D_frac_approx``)
* year coverage that includes a reference window and the forecast years
"""

from __future__ import annotations

import glob
import os
from dataclasses import dataclass

import numpy as np

from . import config

ERROR = "error"
WARNING = "warning"


@dataclass(frozen=True)
class Problem:
    """One validation finding.  ``level`` is :data:`ERROR` or :data:`WARNING`."""

    level: str
    where: str
    message: str

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"[{self.level.upper():7s}] {self.where}: {self.message}"


def has_errors(problems: list[Problem]) -> bool:
    return any(p.level == ERROR for p in problems)


# ---------------------------------------------------------------------------
# MESMER cube
# ---------------------------------------------------------------------------
def discover_scenarios(data_dir: str) -> list[str]:
    """Scenario names in a data dir = the ``*.nc`` file stems."""
    paths = sorted(glob.glob(os.path.join(data_dir, "*.nc")))
    return [os.path.splitext(os.path.basename(p))[0] for p in paths]


def validate_cube(data_dir: str, scenario: str) -> list[Problem]:
    """Validate one scenario cube against the input contract."""
    from . import io

    where = f"{data_dir}/{scenario}"
    try:
        cube = io.load_scenario_cube(data_dir, scenario)
    except FileNotFoundError as exc:
        return [Problem(ERROR, where, str(exc))]
    except Exception as exc:  # unreadable / not a netCDF
        return [Problem(ERROR, where, f"could not open the file as netCDF: {exc}")]

    problems: list[Problem] = []

    # -- variable ----------------------------------------------------------
    if config.VARIABLE not in cube.data_vars:
        return problems + [
            Problem(
                ERROR, where,
                f"expected a variable named {config.VARIABLE!r}; found "
                f"{list(cube.data_vars) or 'none'}. Rename the variable when exporting.",
            )
        ]
    tas = cube[config.VARIABLE]

    # -- dimensions --------------------------------------------------------
    known = set(config.ENSEMBLE_DIMS) | {config.REALISATION_DIM, config.YEAR, config.LAT, config.LON}
    for dim in (config.YEAR, config.LAT, config.LON):
        if dim not in tas.dims:
            problems.append(Problem(
                ERROR, where,
                f"variable {config.VARIABLE!r} has no {dim!r} dimension "
                f"(found {list(tas.dims)}). Rename the dimension when exporting.",
            ))
    for dim in tas.dims:
        if dim not in known:
            problems.append(Problem(
                WARNING, where,
                f"unexpected dimension {dim!r} on {config.VARIABLE!r}; the pipeline only "
                f"understands {sorted(known)} and will not reduce over it.",
            ))
    if has_errors(problems):
        return problems  # coordinate checks below need year/lat/lon

    # -- grid regularity (the mask_3D_frac_approx requirement) -------------
    from .masks import missing_bands, spacing_problem

    for dim in (config.LAT, config.LON):
        message = spacing_problem(cube[dim].values, dim)
        if message:
            problems.append(Problem(ERROR, where, message))
        else:
            gaps = missing_bands(cube[dim].values)
            if gaps:
                problems.append(Problem(
                    WARNING, where,
                    f"{dim} has {gaps} missing band(s) (no-land rows/columns dropped at "
                    f"source?); the pipeline reinserts them as all-null.",
                ))

    # -- coordinate ranges -------------------------------------------------
    lat = np.asarray(cube[config.LAT])
    lon = np.asarray(cube[config.LON])
    if lat.size and (lat.min() < -90.001 or lat.max() > 90.001):
        problems.append(Problem(ERROR, where, f"lat outside [-90, 90] (found {lat.min():.4g}..{lat.max():.4g})."))
    if lon.size and lon.max() > 180.001:
        problems.append(Problem(
            WARNING, where,
            f"lon looks 0..360 (max {lon.max():.4g}); the bundled country polygons are "
            f"-180..180. Check a couple of country maps visually after processing.",
        ))

    # -- year coverage -----------------------------------------------------
    years = set(np.asarray(cube[config.YEAR]).astype(int).tolist())
    usable_refs = [
        name for name, (start, end) in config.REFERENCE_PERIODS.items()
        if any(start <= y <= end for y in years)
    ]
    if not usable_refs:
        problems.append(Problem(
            ERROR, where,
            f"no years fall inside any reference window ({config.REFERENCE_PERIODS}); "
            f"cannot compute anomalies. Cube covers {min(years)}..{max(years)}.",
        ))
    else:
        for name, (start, end) in config.REFERENCE_PERIODS.items():
            if name not in usable_refs:
                problems.append(Problem(
                    WARNING, where,
                    f"reference {name!r} ({start}-{end}) has no years in this cube; "
                    f"runs using it will fail.",
                ))
    for label, wanted in (
        ("impact-time", config.FORECAST_YEARS_TIME),
        ("unavoidable-risk", config.RISK_YEARS),
        ("impact-geo", config.GEO_YEARS),
    ):
        missing = sorted(set(wanted) - years)
        if missing:
            problems.append(Problem(
                WARNING, where,
                f"{label} forecast years missing from the cube: {missing} "
                f"(they will be silently absent from the output).",
            ))

    # -- data sanity (cheap: one slice) ------------------------------------
    first = tas
    for dim in first.dims:
        if dim not in (config.LAT, config.LON):
            first = first.isel({dim: 0})
    if bool(np.isnan(np.asarray(first)).all()):
        problems.append(Problem(ERROR, where, "the first year slice is entirely NaN; the cube looks empty."))

    return problems


# ---------------------------------------------------------------------------
# Polygons + geography list
# ---------------------------------------------------------------------------
def validate_regions(shapefile: str, geographies_csv: str) -> list[Problem]:
    """Validate the country polygons and the ISO-code list against each other."""
    from . import io

    problems: list[Problem] = []
    try:
        gdf = io.load_regions_geodataframe(shapefile)
    except Exception as exc:
        return [Problem(ERROR, shapefile, f"could not read the polygons: {exc}")]
    if config.REGION_CODE_COLUMN not in gdf.columns:
        return [Problem(
            ERROR, shapefile,
            f"missing the {config.REGION_CODE_COLUMN!r} column that holds the ISO-A3 code "
            f"(found {list(gdf.columns)[:8]}...).",
        )]
    if not len(gdf):
        return [Problem(ERROR, shapefile, "contains no features.")]

    try:
        wanted = io.load_geographies(geographies_csv)
    except Exception as exc:
        return problems + [Problem(ERROR, geographies_csv, f"could not read the geography list: {exc}")]
    if not wanted:
        return problems + [Problem(ERROR, geographies_csv, "the 'country' column is empty.")]

    available = set(gdf[config.REGION_CODE_COLUMN])
    missing = [g for g in dict.fromkeys(wanted) if g not in available]
    if missing:
        problems.append(Problem(
            WARNING, geographies_csv,
            f"{len(missing)} listed geographies have no polygon and will be skipped: "
            f"{missing[:5]}{'...' if len(missing) > 5 else ''}",
        ))
    return problems


def validate_inputs(
    data_dir: str,
    scenarios: list[str] | None = None,
    shapefile: str | None = None,
    geographies_csv: str | None = None,
) -> list[Problem]:
    """Validate a full dataset drop.  ``scenarios=None`` -> every ``*.nc`` found."""
    problems: list[Problem] = []
    scenarios = scenarios or discover_scenarios(data_dir)
    if not scenarios:
        problems.append(Problem(ERROR, data_dir, "no *.nc files found."))
    for scenario in scenarios:
        problems += validate_cube(data_dir, scenario)
    if shapefile and geographies_csv:
        problems += validate_regions(shapefile, geographies_csv)
    return problems
