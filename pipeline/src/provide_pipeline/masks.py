"""Country masking and area weighting.

This module replaces the entire hand-rolled masking machinery of the legacy
``tools.py`` (``transform_from_latlon`` / ``rasterize`` /
``add_shape_coord_from_data_array`` / ``calc_pixel_percentage_mask`` plus the
per-country Python loop and the manual reindex-upsample-coarsen dance).

The legacy code, for every country, upsampled the grid 10x, rasterised the
polygon, then coarsened back to get the fraction of each cell inside the
country.  ``regionmask.mask_3D_frac_approx`` implements *exactly* that
algorithm (10x subsampling averaged back to a 0..1 fraction) but vectorised
over every region at once -- see
https://regionmask.readthedocs.io/en/stable/notebooks/method_mask_3D_frac_approx.html
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import regionmask
import xarray as xr

from . import config


@dataclass
class Regions:
    """A set of regions plus their ordered ISO-A3 codes.

    ``mask`` and ``weights`` are lazily attached once we know the target grid.
    ``codes[i]`` is the ISO-A3 code for integer region index ``i`` (the
    ``region`` dimension is positional, 0..N-1).
    """

    regionmask: regionmask.Regions
    codes: list[str]


def build_regions(geodataframe, geographies: list[str], code_column: str = config.REGION_CODE_COLUMN) -> Regions:
    """Build a :class:`Regions` for the requested country codes.

    Parameters
    ----------
    geodataframe:
        NaturalEarth countries as a ``geopandas.GeoDataFrame``.
    geographies:
        ISO-A3 codes to keep, in the order they should appear in outputs.
    code_column:
        Column in ``geodataframe`` holding the ISO-A3 code.
    """
    wanted = [g for g in dict.fromkeys(geographies)]  # dedupe, keep order
    available = set(geodataframe[code_column])
    codes = [g for g in wanted if g in available]
    missing = [g for g in wanted if g not in available]
    if missing:
        # Not fatal: the legacy code silently skipped unknown geographies too.
        # We surface it instead of hiding it.
        import warnings

        warnings.warn(f"{len(missing)} geographies not found in shapefile: {missing[:5]}...", stacklevel=2)

    subset = (
        geodataframe[geodataframe[code_column].isin(codes)]
        .drop_duplicates(subset=code_column)
        .set_index(code_column)
        .loc[codes]              # enforce requested order
        .reset_index()
    )
    ordered_codes = subset[code_column].tolist()
    # ``numbers`` is omitted so regionmask numbers the regions 0..N-1 in row
    # order -- i.e. positionally aligned with ``ordered_codes``.  ``overlap`` is
    # False because countries only touch borders, they don't overlap.
    regions = regionmask.from_geopandas(
        subset,
        names=code_column,
        abbrevs=code_column,
        name="provide-geographies",
        overlap=False,
    )
    return Regions(regionmask=regions, codes=ordered_codes)


def spacing_problem(coord: np.ndarray, dim: str) -> str | None:
    """Return a plain-language message if ``coord`` is not equally spaced.

    ``mask_3D_frac_approx`` requires an equally-spaced grid; this single rule is
    shared by :func:`ensure_regular` (which raises) and ``validate`` (which
    reports).  ``None`` means the coordinate is fine.
    """
    coord = np.sort(np.asarray(coord))
    if coord.size < 2:
        return None
    steps = np.diff(coord)
    if not np.allclose(steps, steps[0], rtol=1e-3, atol=1e-6):
        return (
            f"{dim} is not equally spaced (steps range "
            f"{steps.min():.4g}..{steps.max():.4g}); mask_3D_frac_approx needs a regular grid. "
            f"Reindex/interpolate the cube onto a regular grid first."
        )
    return None


def ensure_regular(cube: xr.Dataset) -> xr.Dataset:
    """Return ``cube`` with ascending, equally-spaced lat/lon.

    ``mask_3D_frac_approx`` requires an equally-spaced grid.  This is the modern
    equivalent of the legacy ``reindex(... np.arange(min, max+2.5, 2.5) ...)``
    "make it a regular grid" step -- but here we only *verify* regularity and
    fix ordering rather than blindly resampling.
    """
    cube = cube.sortby([config.LAT, config.LON])
    for dim in (config.LAT, config.LON):
        problem = spacing_problem(cube[dim].values, dim)
        if problem:
            raise ValueError(problem)
    return cube


def region_fraction(regions: Regions, cube: xr.Dataset) -> xr.DataArray:
    """Fraction (0..1) of each grid cell covered by each region.

    Shape ``(region, lat, lon)``.  This single call replaces the legacy
    per-country upsample/rasterise/coarsen pipeline.
    """
    frac = regions.regionmask.mask_3D_frac_approx(cube[config.LON], cube[config.LAT], drop=False)
    # ``region`` is positional (0..N-1) and aligned with ``regions.codes``.
    return frac


def area_weights(fraction: xr.DataArray) -> xr.DataArray:
    """Combine the coverage fraction with cos(latitude) area weighting.

    ``cos(lat)`` accounts for grid cells shrinking toward the poles; the
    fraction accounts for cells that only partly fall inside a country.  This is
    the ``weights * ppm`` product from the legacy code, but computed once for
    all regions.
    """
    cos_lat = np.cos(np.deg2rad(fraction[config.LAT]))
    weights = fraction * cos_lat
    weights.name = "area_weights"
    return weights
