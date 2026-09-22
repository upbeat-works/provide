"""Shared fixtures: a synthetic MESMER cube, box countries, and a Session."""

from __future__ import annotations

import pytest

from provide_pipeline import synthetic
from provide_pipeline.masks import build_regions
from provide_pipeline.pipeline import Session


@pytest.fixture(scope="session")
def cube():
    return synthetic.make_cube("GS", seed=1)


@pytest.fixture(scope="session")
def cube_curpol():
    # A hotter scenario, used to check monotonic risk / warming behaviour.
    return synthetic.make_cube("CurPol", seed=1)


@pytest.fixture(scope="session")
def regions():
    return build_regions(synthetic.make_geodataframe(), synthetic.geographies())


@pytest.fixture(scope="session")
def session(cube, regions):
    return Session(cube, regions)
