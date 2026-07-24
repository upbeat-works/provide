"""Input / output helpers: loading MESMER cubes and writing JSON.

Inputs
------
* MESMER netCDF cubes            -> ``data_in/MESMER/<scenario>*.nc``
* NaturalEarth country polygons  -> a shapefile / GeoJSON
* Geography list                 -> a CSV with a ``country`` column

Outputs
-------
Self-describing JSON documents (see ``README.md`` for the schemas).  All NaNs
are converted to ``null`` so the files are valid JSON.
"""

from __future__ import annotations

import glob
import json
import os
from typing import Any

import numpy as np
import xarray as xr

from . import config


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------
def load_scenario_cube(data_dir: str, scenario: str, engine: str | None = None) -> xr.Dataset:
    """Open the MESMER cube for a scenario.

    Mirrors the legacy ``glob.glob(mesmerFilePath + scenario + '*')`` lookup but
    fails loudly (rather than ``IndexError``) when nothing matches, and uses
    ``open_mfdataset`` so a scenario split across files still works.
    """
    pattern = os.path.join(data_dir, f"{scenario}*")
    matches = sorted(glob.glob(pattern))
    matches = [m for m in matches if m.endswith((".nc", ".nc4", ".zarr"))] or matches
    if not matches:
        raise FileNotFoundError(f"no MESMER file matching {pattern!r}")
    if len(matches) == 1:
        return xr.open_dataset(matches[0], engine=engine, chunks="auto")
    return xr.open_mfdataset(matches, engine=engine, chunks="auto", combine="by_coords")


def load_regions_geodataframe(shapefile: str):
    """Read the NaturalEarth polygons.  Kept thin so tests can inject a GDF."""
    import geopandas as gpd

    return gpd.read_file(shapefile)


def load_geographies(csv_path: str, column: str = "country") -> list[str]:
    """Read the ordered list of ISO-A3 codes to process."""
    import pandas as pd

    frame = pd.read_csv(csv_path)
    return frame[column].astype(str).tolist()


# ---------------------------------------------------------------------------
# Serialising
# ---------------------------------------------------------------------------
def _clean(obj: Any) -> Any:
    """Recursively convert numpy types and NaN/inf into JSON-native values."""
    if isinstance(obj, dict):
        return {str(k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return _clean(obj.tolist())
    if isinstance(obj, (np.floating, float)):
        value = float(obj)
        return None if not np.isfinite(value) else value
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    return obj


def rows_to_native(array: np.ndarray, decimals: int = config.JSON_DECIMALS) -> list:
    """Round a numeric array and convert NaN -> None, returning nested lists."""
    rounded = np.round(np.asarray(array, dtype="float64"), decimals)
    return _clean(rounded)


def write_json(document: dict, path: str) -> str:
    """Write ``document`` to ``path`` (creating parent dirs), returning the path."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(_clean(document), handle, ensure_ascii=False, allow_nan=False)
    return path
