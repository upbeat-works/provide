#!/usr/bin/env python3
from pathlib import Path

import numpy as np
from scipy.io import netcdf_file


OUTPUT = Path(__file__).parent / "fixtures"
PREFIX = "mean-temperature__2011-2020-present-day__annual__area__50th-percentile"
SCENARIOS = {
    "2020-climate-policies": {
        2030: [[0.8, 0.9, 1.0], [1.1, 1.2, 1.3]],
        2050: [[1.2, 1.3, 1.4], [1.5, 1.6, 1.7]],
    },
    "low-demand": {
        2030: [[0.6, 0.7, 0.8], [0.9, 1.0, 1.1]],
        2050: [[0.7, 0.8, 0.9], [1.0, 1.1, 1.2]],
    },
}


def write_fixture(path: Path, values: list[list[float]]) -> None:
    with netcdf_file(path, "w") as dataset:
        dataset.createDimension("lat", 2)
        dataset.createDimension("lon", 3)

        latitude = dataset.createVariable("lat", "f4", ("lat",))
        latitude[:] = np.array([3.0, 5.0], dtype=np.float32)
        latitude.units = "degrees_north"
        latitude.standard_name = "latitude"

        longitude = dataset.createVariable("lon", "f4", ("lon",))
        longitude[:] = np.array([9.0, 11.0, 13.0], dtype=np.float32)
        longitude.units = "degrees_east"
        longitude.standard_name = "longitude"

        temperature = dataset.createVariable("mean_temperature_change", "f4", ("lat", "lon"))
        data = np.array(values, dtype=np.float32)
        data[0, 2] = -9999.0
        temperature[:] = data
        temperature.units = "degC"
        temperature.long_name = "Mean temperature change"
        temperature.missing_value = np.float32(-9999.0)
        temperature._FillValue = np.float32(-9999.0)

        dataset.Conventions = "CF-1.8"
        dataset.title = "Cameroon mean temperature change"
        dataset.model = "PROVIDE test fixture"
        dataset.source = "Generated fixture for local development"


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    for scenario, years in SCENARIOS.items():
        for year, values in years.items():
            coverage = f"{PREFIX}__{scenario}__cameroon__{year}"
            write_fixture(OUTPUT / f"{coverage}.nc", values)


if __name__ == "__main__":
    main()
