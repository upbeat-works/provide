# Slim devcontainer for the PROVIDE modern pipeline.
#
# We deliberately start from python:*-slim rather than a heavy geo image: the
# scientific stack (shapely, pyproj, rasterio, netcdf4, geopandas) ships
# manylinux wheels that bundle GEOS/PROJ/GDAL/HDF5, so no system geo libraries
# or C toolchain are needed. Result: a small, fast-building image.
FROM python:3.12-slim

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1

# git is handy inside the container; nothing else is required to build the wheels.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspaces/provide-modern
