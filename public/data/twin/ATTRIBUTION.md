# Data attribution — Digital Twin

## OpenStreetMap
Building footprints, roads and land use: © OpenStreetMap contributors.
Available under the Open Database License (ODbL) 1.0 — https://www.openstreetmap.org/copyright

Extracted via the Overpass API and processed in QGIS (reprojected to EPSG:32643 for area/length
calculations, exported as RFC 7946 GeoJSON in EPSG:4326). Each area folder contains a `meta.json`
with the OSM base timestamp, bounding box and processing rules. The derived database in these
folders is also made available under the ODbL.

### Building heights
`height_source` on every building records where its height came from:

- `recorded` — the OSM `height` tag, as mapped by contributors.
- `estimated_from_levels` — `building:levels × 3.0 m`. An estimate, not a measurement.
- `estimated_default` — a per-building-type default used when OSM has neither tag. An estimate.

## Terrain
Copernicus DEM GLO-30 (tile N33 E073), via AWS Open Data.
Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
This is a surface model (DSM) at ~30 m resolution and may include vegetation and structures.

## Simulated values
Energy, temperature and air-quality values in the Digital Twin are synthetic, generated
deterministically in the browser. They are not sensor readings.
