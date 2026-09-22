"""Central configuration for the PROVIDE modern pipeline.

Every "magic number" from the legacy scripts (``provide/impact_time.py`` etc.)
lives here so the science is auditable in one place.  Nothing in this module
imports xarray, so it is cheap to read and safe to import anywhere.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# MESMER cube structure
# ---------------------------------------------------------------------------
# The MESMER netCDF exposes a single variable ``tas`` over these dimensions:
#
#     tas(mesmer_esm_calibration, fair_scenario, run_id, realisation,
#         year, lat, lon)
#
# ``ENSEMBLE_DIMS`` are the dimensions we treat as the probabilistic ensemble
# (we take medians / quantiles across them).  ``REALISATION_DIM`` is averaged
# out first, exactly as the legacy code does.
VARIABLE = "tas"
ENSEMBLE_DIMS = ("mesmer_esm_calibration", "fair_scenario", "run_id")
REALISATION_DIM = "realisation"
LAT = "lat"
LON = "lon"
YEAR = "year"

# Column in the NaturalEarth shapefile that holds the ISO-A3 country code.
REGION_CODE_COLUMN = "ADM0_A3"

# ---------------------------------------------------------------------------
# Reference (baseline) periods  ->  legacy ``reference_period()``
# ---------------------------------------------------------------------------
REFERENCE_PERIODS = {
    "pre-industrial": (1850, 1900),
    "present-day": (2011, 2020),
}

# ---------------------------------------------------------------------------
# Forecast year grids for each product  (legacy used different ones per script)
# ---------------------------------------------------------------------------
FORECAST_YEARS_TIME = list(range(2020, 2101, 5))   # impact-time: 2020..2100 /5
RISK_YEARS = [2020, 2030, 2050, 2100]              # unavoidable-risk
GEO_YEARS = [2030, 2050, 2100]                     # impact-geo maps

# Warming thresholds (deg C above baseline) for the exceedance probability.
RISK_THRESHOLDS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]

# ---------------------------------------------------------------------------
# Uncertainty band definitions
# ---------------------------------------------------------------------------
# mean-temperature: the band is simply the 10th/90th ensemble percentile
# (this is exactly what the legacy mean-temperature path did).
ENSEMBLE_BAND = (0.10, 0.90)

# hot/cold-extreme: the legacy code puts a bootstrap confidence interval around
# the tail quantile.  We reproduce that (see ``impact_time._bootstrap_band``)
# with a *seeded* generator so results are reproducible and testable.
BOOTSTRAP_BAND = (0.025, 0.975)
N_BOOTSTRAP = 100
N_SAMPLESIZE = 100
BOOTSTRAP_SEED = 0

# Rounding applied before serialising to JSON (keeps files small & stable).
JSON_DECIMALS = 4

# All indicators are derived from the ``tas`` field; they differ only in the
# statistic applied along the ensemble dimension.
INDICATORS = ("mean-temperature", "hot-extreme", "cold-extreme")


@dataclass(frozen=True)
class RunSpec:
    """A single processing request.

    ``frequency`` is only meaningful for the extreme indicators (it is the
    exceedance frequency, e.g. ``0.1`` -> the hottest/coldest 10 %).
    """

    indicator: str
    scenario: str
    reference: str = "pre-industrial"
    frequency: float | None = None

    def __post_init__(self) -> None:
        if self.indicator not in INDICATORS:
            raise ValueError(f"unknown indicator {self.indicator!r}; expected one of {INDICATORS}")
        if self.reference not in REFERENCE_PERIODS:
            raise ValueError(f"unknown reference {self.reference!r}; expected one of {list(REFERENCE_PERIODS)}")
        if self.indicator != "mean-temperature" and self.frequency is None:
            raise ValueError(f"indicator {self.indicator!r} requires a frequency")

    @property
    def frequency_tag(self) -> str:
        """Filename fragment, matching legacy naming (``None`` when unused)."""
        return "None" if self.frequency is None else str(self.frequency)


def present_ensemble_dims(dims) -> tuple[str, ...]:
    """Return the ensemble dims that actually exist on a given cube.

    Real MESMER cubes carry all of :data:`ENSEMBLE_DIMS`; small synthetic test
    cubes may carry only a subset.  Working with the intersection keeps the
    same code path valid for both.
    """
    return tuple(d for d in ENSEMBLE_DIMS if d in set(dims))
