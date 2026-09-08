"""Input-contract validation: bundled data passes; broken cubes fail loudly."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from provide_pipeline import synthetic
from provide_pipeline.validate import ERROR, has_errors, validate_cube, validate_inputs, validate_regions

DATA = Path(__file__).resolve().parents[1] / "data"

needs_bundled = pytest.mark.skipif(
    not (DATA / "mesmer" / "GS.nc").exists(),
    reason="bundled synthetic cube missing; run `provide-pipeline make-synthetic`",
)


def _errors(problems):
    return [p for p in problems if p.level == ERROR]


@needs_bundled
def test_bundled_inputs_have_no_errors():
    problems = validate_inputs(
        str(DATA / "mesmer"),
        shapefile=str(DATA / "countries.geojson"),
        geographies_csv=str(DATA / "geographies.csv"),
    )
    assert not has_errors(problems), [str(p) for p in _errors(problems)]


def test_missing_file_is_an_error(tmp_path):
    problems = validate_cube(str(tmp_path), "NOPE")
    assert has_errors(problems)


def test_missing_variable_is_an_error(tmp_path):
    cube = synthetic.make_cube("GS", years=synthetic.DEMO_YEARS).rename({"tas": "temperature"})
    cube.to_netcdf(tmp_path / "GS.nc")
    problems = validate_cube(str(tmp_path), "GS")
    assert has_errors(problems)
    assert any("tas" in p.message for p in _errors(problems))


def test_irregular_latitude_is_an_error(tmp_path):
    cube = synthetic.make_cube("GS", years=synthetic.DEMO_YEARS)
    lat = cube["lat"].values.copy()
    lat[3] += 1.7  # break the equal spacing
    cube = cube.assign_coords(lat=lat)
    cube.to_netcdf(tmp_path / "GS.nc")
    problems = validate_cube(str(tmp_path), "GS")
    assert any("equally spaced" in p.message for p in _errors(problems))


def test_no_reference_years_is_an_error(tmp_path):
    cube = synthetic.make_cube("GS", years=np.arange(2030, 2101, 5))
    cube.to_netcdf(tmp_path / "GS.nc")
    problems = validate_cube(str(tmp_path), "GS")
    assert any("reference window" in p.message for p in _errors(problems))


@needs_bundled
def test_unknown_geography_is_a_warning_not_an_error(tmp_path):
    csv = tmp_path / "geos.csv"
    csv.write_text("country\nDEU\nXXX\n")
    problems = validate_regions(str(DATA / "countries.geojson"), str(csv))
    assert not has_errors(problems)
    assert any("XXX" in p.message for p in problems)
