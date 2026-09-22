"""Publish: copy checked product JSONs to their destination, with an index.

The destination is a directory -- typically the dashboard API's data dir or a
locally-mounted bucket.  Remote uploads (rsync/s3) should wrap this step in CI
rather than live here; keeping publish a plain copy keeps it testable and
storage-agnostic.

Every publish writes a ``published.json`` index (file list + sha256 + sizes)
so consumers can verify a complete, untruncated upload.
"""

from __future__ import annotations

import glob
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone

from . import check
from .validate import has_errors


class PublishError(RuntimeError):
    """Publishing was refused; the message says why."""


def publish(src_dir: str, dest_dir: str, run_check: bool = True, log=print) -> str:
    """Copy all product JSONs from ``src_dir`` to ``dest_dir``.

    Refuses to publish (raising :class:`PublishError`) if the sanity gate
    reports errors, unless ``run_check`` is False.  Returns the index path.
    """
    if run_check:
        problems = check.check_dir(src_dir)
        for problem in problems:
            log(str(problem))
        if has_errors(problems):
            raise PublishError(
                f"refusing to publish {src_dir}: the check gate found errors "
                f"(run `provide-pipeline check {src_dir}` to inspect, or pass --no-check to override)."
            )

    paths = sorted(glob.glob(os.path.join(src_dir, "*.json")))
    paths = [p for p in paths if os.path.basename(p) != "published.json"]
    if not paths:
        raise PublishError(f"nothing to publish: no *.json files in {src_dir}")

    os.makedirs(dest_dir, exist_ok=True)
    entries = []
    for path in paths:
        name = os.path.basename(path)
        shutil.copy2(path, os.path.join(dest_dir, name))
        entries.append({
            "name": name,
            "bytes": os.path.getsize(path),
            "sha256": _sha256(path),
        })
        log(f"published {name}")

    index = {
        "published_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(entries),
        "files": entries,
    }
    index_path = os.path.join(dest_dir, "published.json")
    with open(index_path, "w", encoding="utf-8") as handle:
        json.dump(index, handle, indent=2)
    log(f"wrote {index_path} ({len(entries)} files)")
    return index_path


def _sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()
