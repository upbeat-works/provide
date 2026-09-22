"""End-to-end tests: JSON serialisation, filenames, and the CLI demo."""

from __future__ import annotations

import json

from provide_pipeline import io
from provide_pipeline.cli import main
from provide_pipeline.config import RunSpec
from provide_pipeline.pipeline import output_filename


def test_output_json_is_valid_and_nan_free(session, tmp_path):
    doc = session.impact_geo(RunSpec("mean-temperature", "GS"))
    path = tmp_path / "geo.json"
    io.write_json(doc, str(path))
    # Reload with strict parsing: NaN/Infinity must NOT appear.
    reloaded = json.loads(path.read_text(), parse_constant=_reject)
    assert reloaded["product"] == "impact-geo"


def _reject(token):  # pragma: no cover - only fires on malformed JSON
    raise AssertionError(f"non-finite constant in JSON: {token}")


def test_output_filename_matches_legacy_pattern():
    spec = RunSpec("hot-extreme", "GS", reference="pre-industrial", frequency=0.1)
    assert output_filename("impact-time", spec) == "impact_time_GS_hot-extreme_0.1_pre-industrial.json"
    spec2 = RunSpec("mean-temperature", "GS")
    assert output_filename("impact-time", spec2) == "impact_time_GS_mean-temperature_None_pre-industrial.json"


def test_cli_demo_writes_files(tmp_path):
    rc = main(["demo", "--out", str(tmp_path), "--scenario", "GS"])
    assert rc == 0
    written = list(tmp_path.glob("*.json"))
    assert len(written) == 4
    for path in written:
        json.loads(path.read_text())  # each file is valid JSON
