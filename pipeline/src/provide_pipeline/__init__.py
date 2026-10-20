"""PROVIDE modern data pipeline.

A small, vectorised reimplementation of the legacy ``provide/`` offline scripts
using modern xarray + regionmask.  It turns MESMER climate-emulator netCDFs into
the JSON products consumed by the PROVIDE dashboard:

* ``impact-time``       -- national warming/extreme time series
* ``impact-geo``        -- gridded change maps
* ``unavoidable-risk``  -- warming-threshold exceedance probabilities

See ``README.md`` for the input layout, output schemas, and how this maps onto
the legacy code.
"""

from __future__ import annotations

from .config import RunSpec
from .pipeline import Session, output_filename, session_from_files

__all__ = ["RunSpec", "Session", "output_filename", "session_from_files"]
__version__ = "0.1.0"
