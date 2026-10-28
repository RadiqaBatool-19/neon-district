import { useMemo } from 'react';
import { Building, Columns3, Crosshair, Database, ExternalLink, Route, X } from 'lucide-react';
import { buildingFacts, NOT_AVAILABLE, type Fact } from '../../data/digital-twin/buildingFacts';
import type { TwinModel } from '../../data/digital-twin/buildTwinModel';
import { typeLabel } from '../../data/digital-twin/styling';
import { MAX_COMPARE, useTwinStore } from '../../stores/twinStore';
import { InfoTip, KV, SimBadge, SourceBadge } from './ui';

const HIDDEN_TAGS = new Set(['osm_id', 'osm_type', 'osm_version', 'osm_timestamp', 'height_m', 'min_height_m', 'levels', 'height_source', 'height_note', 'footprint_area_m2', 'length_m', 'area_m2', 'class']);

function osmUrl(osmId: string) {
  return `https://www.openstreetmap.org/${osmId}`;
}

function TagTable({ props }: { props: Record<string, unknown> }) {
  const rows = Object.entries(props).filter(([k, v]) => v !== null && v !== '' && !HIDDEN_TAGS.has(k));
  if (!rows.length) return <p className="tw-note">No additional OSM tags.</p>;
  return (
    <table className="tw-tags">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td dir="auto">{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Missing values are shown as "Not available", never as a dash or an estimate. */
function FactValue({ value }: { value: string | null }) {
  return value === null ? <span className="tw-na">{NOT_AVAILABLE}</span> : <>{value}</>;
}

/** One line listing the fields a feature does not have, instead of a "Not available" row each. */
function MissingLine({ label, names }: { label: string; names: string[] }) {
  if (!names.length) return null;
  return (
    <p className="tw-missing">
      <span>{label}:</span> {names.join(' · ')}
    </p>
  );
}

/** Facts that have a value, each with its method behind an ⓘ; missing ones are listed together below. */
function FactList({ facts, missingLabel = 'Not in OSM' }: { facts: Fact[]; missingLabel?: string }) {
  return (
    <>
      <dl className="tw-kvs tw-facts">
        {facts
          .filter((f) => f.value !== null)
          .map((f) => (
            <KV key={f.key} k={f.label} info={f.method}>
              <span dir="auto">{f.value}</span>
              {f.estimated && <span className="tw-cmp__est">{f.key === 'volume_m3' ? 'Indicative' : 'Estimated'}</span>}
            </KV>
          ))}
      </dl>
      <MissingLine label={missingLabel} names={facts.filter((f) => f.value === null).map((f) => f.label)} />
    </>
  );
}

const HEIGHT_NOTE = {
  recorded: 'Taken from the OSM height tag.',
  estimated_from_levels: 'Not a measurement: estimated as building:levels × 3.0 m.',
  estimated_default: 'Not a measurement: OSM has no height or levels for this building, so a default for its type is used.',
} as const;

function BuildingInspector({ model, index }: { model: TwinModel; index: number }) {
  const b = model.buildings[index];
  const select = useTwinStore((s) => s.select);
  const requestCamera = useTwinStore((s) => s.requestCamera);
  const p = b.props;
  const facts = useMemo(() => buildingFacts(model, index), [model, index]);
  // Height and its source are in the height card, so the list does not repeat them.
  const derived = useMemo(() => facts.derived.filter((f) => f.key !== 'height_m' && f.key !== 'height_source'), [facts]);
  const osmId = String(p.osm_id);
  const inCompare = useTwinStore((s) => s.compareIds.includes(osmId));
  const compareFull = useTwinStore((s) => s.compareIds.length >= MAX_COMPARE);
  const toggleCompare = useTwinStore((s) => s.toggleCompare);

  return (
    <>
      <header className="tw-inspector__head">
        <div>
          <div className="tw-eyebrow">
            <Building size={13} /> {typeLabel(b.typeKey)}
          </div>
          <h2 dir="auto">{b.displayName ?? 'Unnamed building'}</h2>
          <a className="tw-osm-link" href={osmUrl(osmId)} target="_blank" rel="noopener noreferrer">
            {osmId} <ExternalLink size={11} />
          </a>
        </div>
        <button type="button" className="tw-icon-btn" onClick={() => select(null)} aria-label="Close inspector">
          <X size={16} />
        </button>
      </header>

      <div className="tw-height">
        <div>
          <span className="tw-height__value">{b.height.toFixed(1)}</span>
          <span className="tw-height__unit">m</span>
        </div>
        <span className="tw-height__src">
          <SourceBadge source={b.source} />
          <InfoTip label="About this height">{HEIGHT_NOTE[b.source]}</InfoTip>
        </span>
      </div>

      <h3 className="tw-h3">
        OpenStreetMap
        <InfoTip label="About OpenStreetMap values">Values exactly as tagged in OpenStreetMap. Nothing here is estimated.</InfoTip>
      </h3>
      <FactList facts={facts.source} />

      <h3 className="tw-h3">
        Computed
        <InfoTip label="About computed values">Derived from the footprint, the DEM and nearby roads. Each row's ⓘ gives its method.</InfoTip>
      </h3>
      <FactList facts={derived} missingLabel="Not available" />

      {b.overlaps.length > 0 && (
        <p className="tw-missing tw-missing--warn">
          <span>Duplicate OSM footprint:</span> {b.overlaps.map((o) => model.buildings[o].props.osm_id).join(', ')}
          <InfoTip label="About the duplicate">
            {b.supersededBy !== null
              ? 'Another OSM way has the same footprint and a better height source, so that one is drawn. Both are kept for inspection.'
              : 'Another OSM way has the same footprint. This one is drawn because its height source ranks higher; both are kept for inspection.'}
          </InfoTip>
        </p>
      )}

      <details className="tw-details">
        <summary>
          Simulated metrics <SimBadge />
        </summary>
        <dl className="tw-kvs tw-kvs--sim">
          <KV k="Energy intensity">{b.sim.energyIntensity.toFixed(0)} kWh/m²/yr</KV>
          <KV k="Annual energy" info="Energy intensity × footprint × estimated floor count.">
            {b.sim.energyMWhYr.toFixed(0)} MWh/yr
          </KV>
          <KV k="Roof temperature">{b.sim.roofTempC.toFixed(1)} °C</KV>
          <KV k="PM2.5 (street)">{b.sim.pm25.toFixed(0)} µg/m³</KV>
        </dl>
        <p className="tw-note">Synthetic, shaped by real geometry. Not sensor readings.</p>
      </details>

      <details className="tw-details">
        <summary>All OSM tags</summary>
        <TagTable props={p} />
        <p className="tw-note tw-mono">
          v{p.osm_version ?? '?'} · edited {p.osm_timestamp ? new Date(String(p.osm_timestamp)).toISOString().slice(0, 10) : 'unknown'} · extracted {model.data.meta.extracted_at.slice(0, 10)}
        </p>
      </details>

      <div className="tw-actions">
        <button type="button" className="tw-btn" onClick={() => requestCamera('focus')}>
          <Crosshair size={14} /> Zoom to
        </button>
        <button
          type="button"
          className={`tw-btn tw-btn--ghost${inCompare ? ' is-on' : ''}`}
          onClick={() => toggleCompare(osmId)}
          disabled={!inCompare && compareFull}
          aria-pressed={inCompare}
          title={!inCompare && compareFull ? `The comparison holds up to ${MAX_COMPARE} buildings` : undefined}
        >
          <Columns3 size={14} /> {inCompare ? 'Remove from compare' : 'Compare'}
        </button>
      </div>
    </>
  );
}

const ROAD_FIELDS = { lanes: 'Lanes', oneway: 'One-way', surface: 'Surface' } as const;

function RoadInspector({ model, index }: { model: TwinModel; index: number }) {
  const r = model.roads[index];
  const select = useTwinStore((s) => s.select);
  const keys = Object.keys(ROAD_FIELDS) as (keyof typeof ROAD_FIELDS)[];
  return (
    <>
      <header className="tw-inspector__head">
        <div>
          <div className="tw-eyebrow">
            <Route size={13} /> {String(r.props.highway ?? 'Road')}
          </div>
          <h2 dir="auto">{r.displayName ?? 'Unnamed way'}</h2>
          <a className="tw-osm-link" href={osmUrl(String(r.props.osm_id))} target="_blank" rel="noopener noreferrer">
            {r.props.osm_id} <ExternalLink size={11} />
          </a>
        </div>
        <button type="button" className="tw-icon-btn" onClick={() => select(null)} aria-label="Close inspector">
          <X size={16} />
        </button>
      </header>
      <dl className="tw-kvs">
        <KV k="Length" info="Length of this way inside the extract, computed in QGIS (UTM 43N).">
          {Number(r.props.length_m).toFixed(1)} m
        </KV>
        {keys
          .filter((k) => r.props[k])
          .map((k) => (
            <KV key={k} k={ROAD_FIELDS[k]}>
              <FactValue value={r.props[k]} />
            </KV>
          ))}
        <KV k="Drawn width" info="Symbolised from the road class and lane count. Not a surveyed width.">
          {r.widthM.toFixed(1)} m
        </KV>
      </dl>
      <MissingLine label="Not in OSM" names={keys.filter((k) => !r.props[k]).map((k) => ROAD_FIELDS[k])} />
      <details className="tw-details">
        <summary>All OSM tags</summary>
        <TagTable props={r.props} />
      </details>
    </>
  );
}

function AreaSummary({ model }: { model: TwinModel }) {
  const m = model.data.meta;
  const hs = model.stats.heightSource;
  const total = model.buildings.length;
  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`;
  const crs = m.processing_crs.split(' for ')[0];
  const snapshot = m.osm_base_timestamp ? new Date(m.osm_base_timestamp).toISOString() : null;
  return (
    <>
      <header className="tw-inspector__head">
        <div>
          <div className="tw-eyebrow">
            <Database size={13} /> {m.city}
          </div>
          <h2>{model.data.entry.name}</h2>
          <div className="tw-sub">{model.data.entry.subtitle}</div>
        </div>
      </header>
      <dl className="tw-kvs">
        <KV k="Extent">
          {m.size_m[0]} × {m.size_m[1]} m
        </KV>
        <KV k="Buildings · roads · land use">
          {total} · {model.roads.length} · {model.landuse.length}
        </KV>
        <KV k="OSM data" info={snapshot ? `OpenStreetMap snapshot from ${snapshot.replace('T', ' ').slice(0, 16)} UTC.` : undefined}>
          {snapshot ? snapshot.slice(0, 10) : 'Unknown'}
        </KV>
        <KV k="Processing CRS" info={`${crs}. Extract areas and lengths were computed in this projection; in-app measurements use the WGS84 ellipsoid.`}>
          {crs.split(' ')[0]}
        </KV>
        {model.terrain && (
          <KV k="Terrain" info="Copernicus DEM GLO-30, a ~30 m surface model that can include vegetation and structures.">
            {model.terrain.baseElevation.toFixed(0)}–{model.terrain.maxElevation.toFixed(0)} m ASL
          </KV>
        )}
      </dl>

      <h3 className="tw-h3">
        Height data
        <InfoTip label="About height data">
          Height tagging in OpenStreetMap is sparse here. Estimated heights are hatched in the scene and badged in the inspector.
          {model.stats.duplicatesResolved > 0 && ` ${model.stats.duplicatesResolved} duplicate OSM footprint is resolved; both copies are kept for inspection.`}
        </InfoTip>
      </h3>
      <div className="tw-coverage" role="img" aria-label={`Recorded ${hs.recorded}, from levels ${hs.estimated_from_levels}, default ${hs.estimated_default}`}>
        <span className="tw-cov--recorded" style={{ flexGrow: hs.recorded }} />
        <span className="tw-cov--levels" style={{ flexGrow: hs.estimated_from_levels }} />
        <span className="tw-cov--default" style={{ flexGrow: hs.estimated_default }} />
      </div>
      <ul className="tw-coverage__legend">
        <li>
          <i className="tw-cov--recorded" /> Recorded <b>{hs.recorded}</b> ({pct(hs.recorded)})
        </li>
        <li>
          <i className="tw-cov--levels" /> From levels <b>{hs.estimated_from_levels}</b> ({pct(hs.estimated_from_levels)})
        </li>
        <li>
          <i className="tw-cov--default" /> Type default <b>{hs.estimated_default}</b> ({pct(hs.estimated_default)})
        </li>
      </ul>
    </>
  );
}

export function InspectorPanel({ model, open }: { model: TwinModel; open: boolean }) {
  const selection = useTwinStore((s) => s.selection);
  return (
    <aside className={`tw-side tw-side--right${open ? ' is-open' : ''}`} aria-label="Inspector">
      <section className="tw-card tw-inspector">
        {selection?.kind === 'building' ? (
          <BuildingInspector model={model} index={selection.index} />
        ) : selection?.kind === 'road' ? (
          <RoadInspector model={model} index={selection.index} />
        ) : (
          <AreaSummary model={model} />
        )}
      </section>
    </aside>
  );
}
