"""Manifest-driven batch runs: one YAML file describes a whole dataset drop.

Instead of remembering flag combinations, a scientist writes (or copies)
``manifest.yaml`` next to their data and runs::

    provide-pipeline run-all --manifest manifest.yaml

Schema (see ``manifest.example.yaml`` for a commented copy)::

    data_dir:    ../data_in/MESMER      # dir holding <scenario>.nc cubes
    shapefile:   data/countries.geojson
    geographies: data/geographies.csv
    out:         ../data_out
    scenarios:   [GS, CurPol, SP]
    products:
      - product: impact-time
        indicators: [mean-temperature, hot-extreme, cold-extreme]
        references: [pre-industrial]    # optional, this is the default
        frequencies: [0.1]              # applies to extreme indicators only
      - product: impact-geo
        indicators: [mean-temperature]
      - product: unavoidable-risk
        indicators: [mean-temperature]

Every ``scenario x product x indicator x reference (x frequency)`` combination
becomes one output JSON.  The expensive region mask is built once per scenario
and reused across all of that scenario's jobs (see ``pipeline.Session``).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from . import config
from .config import RunSpec

PRODUCTS = ("impact-time", "impact-geo", "unavoidable-risk")
_REQUIRED_KEYS = ("data_dir", "shapefile", "geographies", "out", "scenarios", "products")


class ManifestError(ValueError):
    """A manifest problem, phrased so the author can fix the file."""


@dataclass(frozen=True)
class Manifest:
    """A parsed, validated manifest."""

    data_dir: str
    shapefile: str
    geographies: str
    out: str
    scenarios: list[str]
    jobs: list[tuple[str, RunSpec]] = field(default_factory=list)  # (product, spec)


def load_manifest(path: str) -> Manifest:
    """Read + validate a YAML (or JSON) manifest, expanding all jobs."""
    raw = _read(path)
    missing = [k for k in _REQUIRED_KEYS if k not in raw]
    if missing:
        raise ManifestError(f"{path}: missing keys {missing}; expected {list(_REQUIRED_KEYS)}")
    scenarios = list(raw["scenarios"])
    if not scenarios:
        raise ManifestError(f"{path}: 'scenarios' is empty")

    base = os.path.dirname(os.path.abspath(path))
    resolve = lambda p: p if os.path.isabs(p) else os.path.normpath(os.path.join(base, p))  # noqa: E731

    jobs: list[tuple[str, RunSpec]] = []
    for i, entry in enumerate(raw["products"]):
        jobs += _expand_entry(entry, where=f"{path}: products[{i}]")
    if not jobs:
        raise ManifestError(f"{path}: 'products' expands to no jobs")

    return Manifest(
        data_dir=resolve(raw["data_dir"]),
        shapefile=resolve(raw["shapefile"]),
        geographies=resolve(raw["geographies"]),
        out=resolve(raw["out"]),
        scenarios=scenarios,
        jobs=jobs,
    )


def _read(path: str) -> dict:
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    if path.endswith(".json"):
        raw = json.loads(text)
    else:
        import yaml

        raw = yaml.safe_load(text)
    if not isinstance(raw, dict):
        raise ManifestError(f"{path}: expected a mapping at the top level, got {type(raw).__name__}")
    return raw


def _expand_entry(entry: dict, where: str) -> list[tuple[str, RunSpec]]:
    """products[i] -> the (product, RunSpec) combinations it describes."""
    if not isinstance(entry, dict) or "product" not in entry:
        raise ManifestError(f"{where}: each entry needs a 'product' key")
    product = entry["product"]
    if product not in PRODUCTS:
        raise ManifestError(f"{where}: unknown product {product!r}; expected one of {list(PRODUCTS)}")
    indicators = entry.get("indicators", ["mean-temperature"])
    references = entry.get("references", ["pre-industrial"])
    frequencies = entry.get("frequencies", [])

    jobs = []
    for indicator in indicators:
        for reference in references:
            # frequency only applies to the extreme indicators
            freqs = frequencies if indicator != "mean-temperature" else [None]
            if indicator != "mean-temperature" and not frequencies:
                raise ManifestError(
                    f"{where}: indicator {indicator!r} needs 'frequencies' (e.g. [0.1])"
                )
            for frequency in freqs:
                try:
                    spec = RunSpec(indicator, scenario="__manifest__",
                                   reference=reference, frequency=frequency)
                except ValueError as exc:
                    raise ManifestError(f"{where}: {exc}") from exc
                jobs.append((product, spec))
    return jobs


def plan(manifest: Manifest) -> list[tuple[str, str, RunSpec]]:
    """The full run plan: one (scenario, product, spec) per output file."""
    from dataclasses import replace

    return [
        (scenario, product, replace(spec, scenario=scenario))
        for scenario in manifest.scenarios
        for product, spec in manifest.jobs
    ]


def run(manifest: Manifest, log=print) -> list[str]:
    """Execute the whole plan, one Session per scenario.  Returns written paths."""
    from . import io
    from .pipeline import output_filename, session_from_files

    written: list[str] = []
    for scenario in manifest.scenarios:
        log(f"— scenario {scenario}: building region mask …")
        session = session_from_files(
            manifest.data_dir, scenario, manifest.shapefile, manifest.geographies
        )
        for product, spec in manifest.jobs:
            spec = _with_scenario(spec, scenario)
            document = session.run(product, spec)
            path = os.path.join(manifest.out, output_filename(product, spec))
            io.write_json(document, path)
            log(f"  wrote {path} ({len(document['data'])} geographies)")
            written.append(path)
    return written


def _with_scenario(spec: RunSpec, scenario: str) -> RunSpec:
    from dataclasses import replace

    return replace(spec, scenario=scenario)
