"""The new-dataset workflow end to end: run-all -> check -> publish."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from provide_pipeline.check import check_dir, check_document
from provide_pipeline.cli import main
from provide_pipeline.config import RunSpec
from provide_pipeline.manifest import ManifestError, load_manifest, plan
from provide_pipeline.validate import has_errors

DATA = Path(__file__).resolve().parents[1] / "data"

needs_bundled = pytest.mark.skipif(
    not (DATA / "mesmer" / "GS.nc").exists(),
    reason="bundled synthetic cube missing; run `provide-pipeline make-synthetic`",
)


def _write_manifest(tmp_path, out_dir, scenarios=("GS",)) -> str:
    path = tmp_path / "manifest.yaml"
    path.write_text(
        f"""
data_dir: {DATA / 'mesmer'}
shapefile: {DATA / 'countries.geojson'}
geographies: {DATA / 'geographies.csv'}
out: {out_dir}
scenarios: [{', '.join(scenarios)}]
products:
  - product: impact-time
    indicators: [mean-temperature]
  - product: impact-geo
    indicators: [mean-temperature]
  - product: unavoidable-risk
    indicators: [mean-temperature]
"""
    )
    return str(path)


# ---------------------------------------------------------------------------
# Manifest parsing / expansion
# ---------------------------------------------------------------------------
def test_manifest_expands_scenarios_times_jobs(tmp_path):
    path = _write_manifest(tmp_path, tmp_path / "out", scenarios=("GS", "CurPol"))
    manifest = load_manifest(path)
    jobs = plan(manifest)
    assert len(jobs) == 2 * 3
    assert {scenario for scenario, _, _ in jobs} == {"GS", "CurPol"}
    assert all(spec.scenario == scenario for scenario, _, spec in jobs)


def test_manifest_missing_keys_is_friendly(tmp_path):
    path = tmp_path / "manifest.yaml"
    path.write_text("data_dir: somewhere\n")
    with pytest.raises(ManifestError, match="missing keys"):
        load_manifest(path.as_posix())


def test_manifest_extreme_without_frequency_is_friendly(tmp_path):
    path = tmp_path / "manifest.yaml"
    path.write_text(
        f"""
data_dir: {DATA / 'mesmer'}
shapefile: {DATA / 'countries.geojson'}
geographies: {DATA / 'geographies.csv'}
out: {tmp_path / 'out'}
scenarios: [GS]
products:
  - product: impact-time
    indicators: [hot-extreme]
"""
    )
    with pytest.raises(ManifestError, match="frequencies"):
        load_manifest(path.as_posix())


# ---------------------------------------------------------------------------
# run-all -> check -> publish, through the CLI
# ---------------------------------------------------------------------------
@needs_bundled
def test_run_all_dry_run(tmp_path, capsys):
    manifest = _write_manifest(tmp_path, tmp_path / "out")
    assert main(["run-all", "--manifest", manifest, "--dry-run"]) == 0
    printed = capsys.readouterr().out
    assert "3 outputs" in printed
    assert (tmp_path / "out").exists() is False  # nothing computed


@needs_bundled
def test_run_all_check_publish_roundtrip(tmp_path):
    out = tmp_path / "out"
    manifest = _write_manifest(tmp_path, out)

    assert main(["run-all", "--manifest", manifest]) == 0
    written = sorted(p.name for p in out.glob("*.json"))
    assert written == [
        "impact_geo_GS_mean-temperature_None_pre-industrial.json",
        "impact_time_GS_mean-temperature_None_pre-industrial.json",
        "unavoidable_risk_GS_mean-temperature_None_pre-industrial.json",
    ]

    # check gate passes on real outputs
    assert main(["check", str(out)]) == 0

    # publish copies everything and writes a verifiable index
    dest = tmp_path / "dest"
    assert main(["publish", "--src", str(out), "--dest", str(dest)]) == 0
    index = json.loads((dest / "published.json").read_text())
    assert index["count"] == 3
    assert sorted(f["name"] for f in index["files"]) == written
    for f in index["files"]:
        assert (dest / f["name"]).stat().st_size == f["bytes"]


@needs_bundled
def test_check_catches_tampered_outputs_and_publish_refuses(tmp_path):
    out = tmp_path / "out"
    manifest = _write_manifest(tmp_path, out)
    assert main(["run-all", "--manifest", manifest, "--skip-validate"]) == 0

    # Corrupt the risk file: probability > 1
    risk_path = out / "unavoidable_risk_GS_mean-temperature_None_pre-industrial.json"
    document = json.loads(risk_path.read_text())
    first = next(iter(document["data"].values()))
    next(iter(first.values()))[0][0] = 5.0
    risk_path.write_text(json.dumps(document))

    assert has_errors(check_dir(str(out)))
    assert main(["check", str(out)]) == 1
    assert main(["publish", "--src", str(out), "--dest", str(tmp_path / "dest")]) == 1
    assert not (tmp_path / "dest" / "published.json").exists()


# ---------------------------------------------------------------------------
# check rules on in-memory documents
# ---------------------------------------------------------------------------
def test_check_flags_inverted_band(session):
    document = session.impact_time(RunSpec("mean-temperature", "GS"))
    assert not has_errors(check_document(document))
    code = next(iter(document["data"]))
    row = document["data"][code][0]
    row[0], row[2] = row[2] + 1.0, row[0]  # lower > upper
    assert has_errors(check_document(document))


def test_check_flags_grid_shape_mismatch(session):
    document = session.impact_geo(RunSpec("mean-temperature", "GS"))
    assert not has_errors(check_document(document))
    code = next(iter(document["data"]))
    document["data"][code]["lat"].append(0.0)  # now grids no longer match lat
    assert has_errors(check_document(document))
