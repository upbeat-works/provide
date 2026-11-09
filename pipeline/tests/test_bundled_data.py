"""Exercise the on-disk loading path against the bundled data files.

This complements the synthetic-fixture tests: it proves the real
``data/countries.geojson`` + ``data/geographies.csv`` + a bundled synthetic
MESMER cube load and flow through the pipeline end to end.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from provide_pipeline import io
from provide_pipeline.config import RunSpec
from provide_pipeline.masks import build_regions
from provide_pipeline.pipeline import Session

DATA = Path(__file__).resolve().parents[1] / "data"

pytestmark = pytest.mark.skipif(
    not (DATA / "mesmer" / "GS.nc").exists(),
    reason="bundled synthetic cube missing; run `provide-pipeline make-synthetic`",
)


@pytest.fixture(scope="module")
def bundled_session():
    cube = io.load_scenario_cube(str(DATA / "mesmer"), "GS")
    gdf = io.load_regions_geodataframe(str(DATA / "countries.geojson"))
    geographies = io.load_geographies(str(DATA / "geographies.csv"))
    regions = build_regions(gdf, geographies)
    return Session(cube, regions), geographies


def test_bundled_files_present():
    assert (DATA / "countries.geojson").exists()
    assert (DATA / "geographies.csv").exists()
    assert (DATA / "mesmer" / "GS.nc").exists()


def test_all_geographies_load(bundled_session):
    session, geographies = bundled_session
    assert len(geographies) == 174
    assert session.regions.codes  # non-empty after mask build


def test_impact_time_over_real_countries(bundled_session, tmp_path):
    session, _ = bundled_session
    doc = session.impact_time(RunSpec("mean-temperature", "GS"))
    # Large countries resolve on the coarse demo grid; check a couple.
    for code in ("DEU", "IND", "BRA"):
        assert code in doc["data"]
        rows = doc["data"][code]
        assert len(rows) == len(doc["years"])
    out = tmp_path / "impact_time.json"
    io.write_json(doc, str(out))
    assert out.stat().st_size > 0
