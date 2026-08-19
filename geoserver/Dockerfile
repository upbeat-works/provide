ARG GEOSERVER_VERSION=2.28.4
FROM docker.osgeo.org/geoserver:${GEOSERVER_VERSION}

ARG GEOSERVER_VERSION

RUN set -eu; \
    apt-get update; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libnetcdf-dev; \
    rm -rf /var/lib/apt/lists/*; \
    archive="/opt/additional_libs/geoserver-${GEOSERVER_VERSION}-netcdf-plugin.zip"; \
    partial="${archive}.part"; \
    mkdir -p /opt/additional_libs; \
    wget --progress=dot:giga --tries=3 \
      "https://downloads.sourceforge.net/project/geoserver/GeoServer/${GEOSERVER_VERSION}/extensions/geoserver-${GEOSERVER_VERSION}-netcdf-plugin.zip" \
      -O "${partial}"; \
    unzip -t "${partial}"; \
    mv "${partial}" "${archive}"
