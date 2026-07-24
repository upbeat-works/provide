"""Command-line interface for the PROVIDE modern pipeline.

Examples
--------
Run the whole thing on bundled synthetic data (no external files needed)::

    provide-pipeline demo --out ./out

The new-dataset workflow (validate -> run-all -> check -> publish)::

    provide-pipeline validate --data-dir ../data_in/MESMER \
        --shapefile data/countries.geojson --geographies data/geographies.csv
    provide-pipeline run-all --manifest manifest.yaml
    provide-pipeline check ../data_out
    provide-pipeline publish --src ../data_out --dest /srv/dashboard-data

Process a single scenario from disk::

    provide-pipeline run impact-time \
        --data-dir ../data_in/MESMER --scenario GS \
        --shapefile ../data_in/NaturalEarth/ne_10m_admin_0_countries_deu_CA/ne_10m_admin_0_countries_deu_CA.shp \
        --geographies ../data_in/list_countries_pixel_stat.csv \
        --indicator mean-temperature --reference pre-industrial --out ../data_out
"""

from __future__ import annotations

import argparse
import os

from . import config
from .config import RunSpec


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--out", default="./out", help="output directory")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="provide-pipeline", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="process a scenario from on-disk MESMER files")
    run.add_argument("product", choices=["impact-time", "impact-geo", "unavoidable-risk"])
    run.add_argument("--data-dir", required=True, help="dir holding <scenario>*.nc MESMER cubes")
    run.add_argument("--scenario", required=True)
    run.add_argument("--shapefile", required=True)
    run.add_argument("--geographies", required=True, help="CSV with a 'country' column")
    run.add_argument("--indicator", default="mean-temperature", choices=list(config.INDICATORS))
    run.add_argument("--reference", default="pre-industrial", choices=list(config.REFERENCE_PERIODS))
    run.add_argument("--frequency", type=float, default=None, help="required for extreme indicators")
    _add_common(run)

    demo = sub.add_parser("demo", help="run every product on bundled synthetic data")
    _add_common(demo)
    demo.add_argument("--scenario", default="GS")

    mksyn = sub.add_parser("make-synthetic", help="(re)generate the bundled synthetic MESMER cubes")
    mksyn.add_argument("--out", default="./data/mesmer", help="directory to write <scenario>.nc into")
    mksyn.add_argument("--scenarios", nargs="+", default=["GS", "CurPol", "SP"])

    validate = sub.add_parser("validate", help="check a dataset drop against the input contract")
    validate.add_argument("--data-dir", required=True, help="dir holding <scenario>.nc MESMER cubes")
    validate.add_argument("--scenario", nargs="*", default=None,
                          help="scenarios to check (default: every *.nc in --data-dir)")
    validate.add_argument("--shapefile", default=None)
    validate.add_argument("--geographies", default=None, help="CSV with a 'country' column")

    runall = sub.add_parser("run-all", help="run every product/scenario a manifest describes")
    runall.add_argument("--manifest", required=True, help="YAML (or JSON) manifest; see manifest.example.yaml")
    runall.add_argument("--dry-run", action="store_true", help="print the plan without computing")
    runall.add_argument("--skip-validate", action="store_true", help="skip the input-contract gate")

    checkp = sub.add_parser("check", help="sanity-check a directory of output JSONs before publishing")
    checkp.add_argument("out_dir", help="directory of product *.json files")

    pub = sub.add_parser("publish", help="copy checked outputs to a destination dir, with an index")
    pub.add_argument("--src", required=True, help="directory of product *.json files")
    pub.add_argument("--dest", required=True, help="destination directory (API data dir / mounted bucket)")
    pub.add_argument("--no-check", action="store_true", help="publish even if the check gate fails")

    fetch = sub.add_parser("fetch-legacy", help="download legacy-API impact-geo slices as parity references")
    fetch.add_argument("--out", default="./legacy", help="directory to write the slices into")
    fetch.add_argument("--geographies", nargs="+", required=True, help="ISO-A3 codes, e.g. DEU IND")
    fetch.add_argument("--scenarios", nargs="+", required=True, help="e.g. CurPol GS SP")
    fetch.add_argument("--years", nargs="+", type=int, default=[2030, 2050, 2100])
    fetch.add_argument("--indicator", default="mean-temperature", choices=list(config.INDICATORS))
    fetch.add_argument("--reference", default="pre-industrial", choices=list(config.REFERENCE_PERIODS))
    fetch.add_argument("--frequency", type=float, default=None, help="required for extreme indicators")
    fetch.add_argument("--base-url", default=None, help="legacy API base (default: staging)")

    cmp_ = sub.add_parser("compare-legacy", help="compare one legacy netCDF slice against our impact-geo JSON")
    cmp_.add_argument("--legacy", required=True, help="a fetched legacy .nc slice")
    cmp_.add_argument("--modern", required=True, help="an impact_geo_*.json produced by this pipeline")
    cmp_.add_argument("--geography", required=True, help="ISO-A3 code")
    cmp_.add_argument("--year", type=int, required=True)
    cmp_.add_argument("--tolerance", type=float, default=None,
                      help="fail (exit 1) if max abs diff exceeds this (deg C)")

    args = parser.parse_args(argv)

    if args.command == "run":
        return _cmd_run(args)
    if args.command == "demo":
        return _cmd_demo(args)
    if args.command == "make-synthetic":
        return _cmd_make_synthetic(args)
    if args.command == "validate":
        return _cmd_validate(args)
    if args.command == "run-all":
        return _cmd_run_all(args)
    if args.command == "check":
        return _cmd_check(args)
    if args.command == "publish":
        return _cmd_publish(args)
    if args.command == "fetch-legacy":
        return _cmd_fetch_legacy(args)
    if args.command == "compare-legacy":
        return _cmd_compare_legacy(args)
    parser.error("no command")
    return 2


def _cmd_run(args) -> int:
    from . import io
    from .pipeline import output_filename, session_from_files

    spec = RunSpec(indicator=args.indicator, scenario=args.scenario,
                   reference=args.reference, frequency=args.frequency)
    session = session_from_files(args.data_dir, args.scenario, args.shapefile, args.geographies)
    document = session.run(args.product, spec)
    path = os.path.join(args.out, output_filename(args.product, spec))
    io.write_json(document, path)
    print(f"wrote {path} ({len(document['data'])} geographies)")
    return 0


def _cmd_demo(args) -> int:
    from . import io, synthetic
    from .masks import build_regions
    from .pipeline import Session, output_filename

    cube = synthetic.make_cube(args.scenario)
    regions = build_regions(synthetic.make_geodataframe(), synthetic.geographies())
    session = Session(cube, regions)

    specs = [
        ("impact-time", RunSpec("mean-temperature", args.scenario)),
        ("impact-time", RunSpec("hot-extreme", args.scenario, frequency=0.1)),
        ("impact-geo", RunSpec("mean-temperature", args.scenario)),
        ("unavoidable-risk", RunSpec("mean-temperature", args.scenario)),
    ]
    for product, spec in specs:
        document = session.run(product, spec)
        path = os.path.join(args.out, output_filename(product, spec))
        io.write_json(document, path)
        print(f"wrote {path}")
    return 0


def _cmd_validate(args) -> int:
    from .validate import has_errors, validate_inputs

    problems = validate_inputs(args.data_dir, args.scenario or None,
                               args.shapefile, args.geographies)
    for problem in problems:
        print(problem)
    if has_errors(problems):
        print("FAILED: fix the errors above before running the pipeline.")
        return 1
    print("OK: inputs satisfy the pipeline contract."
          + (f" ({len(problems)} warning(s))" if problems else ""))
    return 0


def _cmd_run_all(args) -> int:
    from .manifest import ManifestError, load_manifest, plan, run
    from .pipeline import output_filename
    from .validate import has_errors, validate_inputs

    try:
        manifest = load_manifest(args.manifest)
    except (ManifestError, FileNotFoundError) as exc:
        print(f"manifest error: {exc}")
        return 1

    jobs = plan(manifest)
    if args.dry_run:
        for scenario, product, spec in jobs:
            print(f"would write {output_filename(product, spec)}")
        print(f"{len(jobs)} outputs -> {manifest.out}")
        return 0

    if not args.skip_validate:
        problems = validate_inputs(manifest.data_dir, manifest.scenarios,
                                   manifest.shapefile, manifest.geographies)
        for problem in problems:
            print(problem)
        if has_errors(problems):
            print("FAILED: inputs do not satisfy the contract (use --skip-validate to override).")
            return 1

    written = run(manifest)
    print(f"done: {len(written)} files -> {manifest.out}. Next: provide-pipeline check {manifest.out}")
    return 0


def _cmd_check(args) -> int:
    from .check import check_dir
    from .validate import has_errors

    problems = check_dir(args.out_dir)
    for problem in problems:
        print(problem)
    if has_errors(problems):
        print("FAILED: do not publish these outputs.")
        return 1
    print("OK: outputs are schema-valid and pass the sanity checks."
          + (f" ({len(problems)} warning(s))" if problems else ""))
    return 0


def _cmd_publish(args) -> int:
    from .publish import PublishError, publish

    try:
        publish(args.src, args.dest, run_check=not args.no_check)
    except PublishError as exc:
        print(str(exc))
        return 1
    return 0


def _cmd_fetch_legacy(args) -> int:
    from . import legacy

    kwargs = dict(indicator=args.indicator, reference=args.reference, frequency=args.frequency)
    if args.base_url:
        kwargs["base_url"] = args.base_url
    written = legacy.fetch_impact_geo(args.out, args.geographies, args.scenarios, args.years, **kwargs)
    wanted = len(args.geographies) * len(args.scenarios) * len(args.years)
    print(f"fetched {len(written)}/{wanted} slices -> {args.out}")
    return 0 if written else 1


def _cmd_compare_legacy(args) -> int:
    import json

    from . import legacy

    with open(args.modern, encoding="utf-8") as handle:
        document = json.load(handle)
    try:
        stats = legacy.compare_impact_geo(args.legacy, document, args.geography, args.year)
    except ValueError as exc:
        print(f"cannot compare: {exc}")
        return 1
    for key, value in stats.items():
        print(f"{key}: {value}")
    if args.tolerance is not None and stats["max_abs_diff"] > args.tolerance:
        print(f"FAILED: max abs diff {stats['max_abs_diff']:.4g} exceeds tolerance {args.tolerance}")
        return 1
    return 0


def _cmd_make_synthetic(args) -> int:
    from . import synthetic

    # A small ensemble (2 x 1 x 2 x 1 = 4 members) keeps the committed netCDFs
    # tiny while preserving the full MESMER dimension layout.
    for scenario in args.scenarios:
        path = os.path.join(args.out, f"{scenario}.nc")
        synthetic.save_cube(scenario, path, n_cal=2, n_scen=1, n_run=2, n_real=1)
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
