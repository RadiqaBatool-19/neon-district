# NEON DISTRICT — two 3D experiences

One React application with **two independent Three.js products**, each on its own route:

| Route | Experience | Data |
|---|---|---|
| `/` | Landing page introducing both projects | — |
| `/cyberpunk-city` | **Cyberpunk City Explorer** — cinematic, procedural, fictional | Procedurally generated (deterministic seed) |
| `/digital-twin` | **Interactive 3D Digital Twin** — Blue Area West, Islamabad | Real OpenStreetMap extract + Copernicus DEM, prepared in QGIS |

Each route is lazy-loaded, mounts its own `<Canvas>`, and releases its WebGL context, listeners and GPU resources on unmount. Neither experience loads the other's code or data.

## Run

Requires **Node 18.18+** (developed on Node 24.21.0). Node 16 is too old for Vite 6.

```bash
nvm use 24.21.0        # nvm-windows; or any Node >= 18.18
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build into dist/
npm run preview        # serve dist/ on http://localhost:4173
```

Direct navigation and refresh on `/cyberpunk-city` and `/digital-twin` work in dev and preview. For hosting, `vercel.json` (Vercel) and `public/_redirects` (Netlify) rewrite unknown paths to `index.html`.

## Stack

React 18 · TypeScript · Vite 6 · three 0.169 · @react-three/fiber 8 · @react-three/drei 9 · @react-three/postprocessing 2 · React Router 6 · Zustand · Lucide.

## Structure

```
src/
  pages/                      HomePage, CyberpunkCityPage, DigitalTwinPage (route roots, lazy)
  components/shared/          SiteNav, LoadingScreen, ErrorBoundary
  components/cyberpunk/       HUD, intro, districts, systems panel, building panel, metrics
  components/digital-twin/    header, layer/filter panel, inspector, measure toolbar, compass/scale
  scenes/cyberpunk/           generator (pure), shaders, instanced buildings, streets, signs,
                              plaza, highways, traffic, atmosphere, lighting, post-FX, camera
  scenes/digital-twin/        terrain + ground texture, merged buildings, labels, measuring, camera
  data/cyberpunk/             city config & quality presets, districts, simulated metrics
  data/digital-twin/          types, data source, projection, model builder, measure, styling
  stores/                     cyberpunkStore, twinStore (independent)
public/data/twin/             manifest.json + one folder per area (GeoJSON, terrain, meta)
gis/                          QGIS working copies (GeoPackage, clipped UTM DEM)
```

---

## Cyberpunk City Explorer

- **Procedural city** (`scenes/cyberpunk/cityGenerator.ts`): an 11×11 block grid with five districts (Financial, Neon Market, Industrial, Residential, Central Plaza). Building archetypes include tiered, octagonal, podium-and-tower, twin-with-skybridge, slab, stacked market blocks, and factories with chimneys and pipes. The generator is pure and deterministic (`CITY.seed`), and all parameters live in `data/cyberpunk/config.ts`.
- **Rendering:** one `InstancedMesh` per primitive shape, sharing a single facade material. Window grids, lit and flickering windows, crown accents, hover/selection highlights and data-lens tints all come from per-instance attributes in an `onBeforeCompile` shader. Signs, streetlights, rooftop kit, vehicles and rain are instanced as well. Around 37 draw calls in total.
- **Atmosphere:** the exponential fog colour matches the sky horizon, so distant towers dissolve into haze. Bloom has a high luminance threshold, and is followed by vignette, ACES tone mapping and optional grain and chromatic aberration. Rain is GPU-only streaks that wrap around the camera.
- **About reflections:** the wet road is an *approximation*. Low-roughness puddle patches reflect a static procedural environment map, and soft glow decals under signs stand in for reflections. There are no real-time scene reflections.
- **Time of day** (`scenes/cyberpunk/timeOfDay.ts`): keyframed looks for dawn, day, sunset, blue hour and night, blended per frame into shared uniforms (sky, fog, sun/moon direction, window, neon and street-light levels, bloom threshold). Presets, a 24 h slider and an optional auto cycle (24 min / 6 min / 90 s per day). The live clock is a mutable object eased toward its target, so it never triggers React renders.
- **Weather** (`data/cyberpunk/weather.ts`): clear, light rain, heavy rain, fog and thunderstorm, eased over several seconds, plus an intensity slider. Clouds, fog, rain amount and road wetness follow the preset. Thunderstorms add lightning flashes (sky, fog and fill light); flashes are off by default under `prefers-reduced-motion` and under reduced effects.
- **City life:** street and air traffic density (low / normal / heavy) changes only the drawn instance count, never rebuilds. Vehicles ease their speed, and central streets carry more cars. A city-activity control and per-district daily rhythms drive lit windows and sign flicker.
- **Simulation** (`data/cyberpunk/citySimulation.ts`, pure functions): district activity, demand, occupancy and AQI, a district comparison chart and a 24 h demand profile. You can trigger a **simulated** blackout or pollution spike per district: windows, signs, street lights and plaza effects respond, the district's blocks are outlined, and a banner offers reset. All values are synthetic.
- **Interaction:** hover tooltip, click to select (in orbit the camera flies to the building and a panel opens), `Esc` to deselect, district presets and reset. Camera modes are **Orbit**, **Fly** (drone look-from-camera, `WASD` + `Q`/`E`) and **Walk** (street level with building collision), switched with `O` / `F` / `G`. Movement accelerates and decelerates smoothly, there is a speed slider, and optional pointer-lock mouse look (`Esc` releases). Touch devices get an on-screen movement pad. Building metrics are **clearly labelled simulated**.
- **Performance:** Low/Medium/High presets (DPR cap, MSAA, bloom levels, traffic/rain counts, shadows) plus a reduced-effects toggle. The scene automatically steps down quality on sustained low FPS until the user picks a level. Measured during development on an Intel Iris Xe: the scene pass took **11.4 ms at 1920×869**, before post-processing.
- The intro is skippable (button, `Esc`/`Enter`/`Space`), is skipped automatically on repeat visits and under `prefers-reduced-motion`, and runs on wall-clock time so a slow GPU cannot stretch it.

## Interactive 3D Digital Twin

### Data pipeline

1. **QGIS (via the QGIS MCP bridge).** OSM was fetched for 600 m windows over Blue Area and F-7 Markaz using the Overpass API from PyQGIS, and tag coverage was compared. Height tagging is very sparse in Islamabad: only 10 of 3,560 buildings in the wider Blue Area / F-6 / F-7 scan carry `height`, and 25 carry `building:levels`. **Blue Area West (Centaurus & Jinnah Avenue)** was chosen because it is the only 600 m window that contains recorded heights.
2. Footprints, roads and land use were reprojected to **EPSG:32643 (UTM 43N)** for area and length calculations, then exported as RFC 7946 GeoJSON (EPSG:4326, 7-decimal precision) with OSM ids, versions, timestamps and useful tags preserved. The GeoPackage is in `gis/`.
3. **Terrain:** Copernicus DEM GLO-30 was clipped in QGIS (`gis/*_cop30_utm.tif`) and resampled to a 65×65 grid (`terrain.json`).
4. **Browser** (`data/digital-twin/buildTwinModel.ts`): validate → project onto a local tangent plane around one **fixed regional origin** (approximately Zero Point, Islamabad) → sample terrain → extrude buildings → merge into one mesh.

### Height honesty

Every building has a `height_source`:

| Value | Meaning | Count in this extract |
|---|---|---|
| `recorded` | OSM `height` tag | 4 |
| `estimated_from_levels` | `building:levels × 3.0 m` | 1 |
| `estimated_default` | Building-type default (no OSM height or levels) | 85 |

Estimated buildings are hatched in the scene. The inspector shows the source next to the height, and there is a "Height source" colour mode and filter.

**Duplicate in OSM:** The Centaurus Mall is mapped twice with an identical footprint: `way/472380415` (`height=30`) and `way/472383520` (`building:levels=4`). The pipeline renders the recorded-height feature and keeps both available for inspection. The source data is not modified.

### Features

- Layers for buildings, roads/paths, land use, terrain relief (with 1–3× vertical exaggeration) and labels.
- Building colour modes: type, height, height source, plus **simulated** energy use, roof temperature and PM2.5. There is also a **simulated** ground overlay for temperature or PM2.5. Each mode has a legend, and simulated values are badged everywhere they appear.
- Filters by building type, height range and height source. Filtered-out buildings leave dashed footprints on the ground.
- Inspector with geometry, raw OSM tags, a link to the feature on openstreetmap.org, DEM ground elevation, and a separate simulated-metrics block. Roads can be inspected too.
- **Measurement:** distance (Vincenty, WGS84 ellipsoid, plus elevation change and along-surface length), area (ellipsoidal local plane) and point probe (lon/lat + DEM elevation).
  Verified against QGIS `QgsDistanceArea` (EPSG:7030) during development:
  - Distance: 362.903 m in the app vs 362.90 m in QGIS.
  - Area: 359,056.7 m² in the app vs 359,056.7 m² in QGIS.
- Map-style camera (left-drag pan, right-drag orbit, wheel zoom to cursor), compass, scale bar, reset and top-down views.

### Adding areas (Islamabad–Rawalpindi)

1. Extract a new window in QGIS with the same schema (see `public/data/twin/islamabad-blue-area-west/meta.json` for the rules).
2. Add a folder under `public/data/twin/`.
3. Add an entry to `manifest.json`.

All areas are projected against the same regional origin, so neighbouring extracts line up. The area switcher loads one area at a time and disposes the previous one. To move to a backend (e.g. PostGIS behind a REST API), implement `TwinDataSource` in `data/digital-twin/dataSource.ts`; the scene code does not need to change.

## Attribution & licences

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL 1.0. See `public/data/twin/ATTRIBUTION.md`.
- Terrain: Copernicus DEM GLO-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA.
- All energy, temperature, air-quality, occupancy and "city pulse" values in both experiences are **synthetic**.

## Known limitations

- Cyberpunk reflections are approximations (see above). Shadows are only enabled on the High preset.
- Walk-mode collision only covers building footprints (axis-aligned). Highway support pillars can be walked through.
- The Central Plaza's simulated energy demand is very low (about 0.3 MW), because only the Aurora Spire counts toward it.
- There is no thunder audio: no licensed sound asset is bundled.
- Frame rate and mobile behaviour of the time, weather, camera and event features have not been measured or verified on real devices yet. The automated test browser was throttled to about 1–3 fps.
- The DEM is a 30 m **surface** model resampled to a ~9 m grid. Spot elevations differ from QGIS's 10 m resample by up to about 1 m.
- Road widths in the twin are symbolised from class and lanes, not surveyed.
- The twin area contains a single extract for now. Other Islamabad–Rawalpindi areas are listed as "planned".
- `vercel.json` and `public/_redirects` are included but have not been deployed or tested on those hosts.
