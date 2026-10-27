import { useMemo } from 'react';
import { Building, Crosshair, Database, ExternalLink, Route, X } from 'lucide-react';
import { buildingFacts, NOT_AVAILABLE, type Fact } from '../../data/digital-twin/buildingFacts';
import type { TwinModel } from '../../data/digital-twin/buildTwinModel';
import { typeLabel } from '../../data/digital-twin/styling';
import { useTwinStore } from '../../stores/twinStore';
import { KV, SimBadge, SourceBadge } from './ui';

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

function FactList({ facts, showMethod }: { facts: Fact[]; showMethod?: boolean }) {
  return (
    <dl className="tw-kvs tw-facts">
      {facts.map((f) => (
        <div key={f.key} className="tw-kv">
          <dt>{f.label}</dt>
          <dd dir="auto">
            <FactValue value={f.value} />
            {showMethod && f.method && <small className="tw-method">{f.method}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BuildingInspector({ model, index }: { model: TwinModel; index: number }) {
  const b = model.buildings[index];
  const select = useTwinStore((s) => s.select);
  const requestCamera = useTwinStore((s) => s.requestCamera);
  const p = b.props;
  const facts = useMemo(() => buildingFacts(model, index), [model, index]);

  return (
    <>
      <header className="tw-inspector__head">
        <div>
          <div className="tw-eyebrow">
            <Building size={13} /> Building · {typeLabel(b.typeKey)}
          </div>
          <h2 dir="auto">{b.displayName ?? 'Unnamed building'}</h2>
          <a className="tw-osm-link" href={osmUrl(String(p.osm_id))} target="_blank" rel="noopener noreferrer">
            {p.osm_id} <ExternalLink size={11} />
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
        <SourceBadge source={b.source} />
      </div>
      <p className="tw-note">{b.source === 'recorded' ? 'Height taken from the OSM height tag.' : `Not a measurement: ${p.height_note}.`}</p>

      <h3 className="tw-h3">
        Source attributes <span className="tw-prov">OpenStreetMap</span>
      </h3>
      <FactList facts={facts.source} />

      <h3 className="tw-h3">
        Derived values <span className="tw-prov tw-prov--derived">Computed</span>
      </h3>
      <FactList facts={facts.derived} showMethod />
      {b.overlaps.length > 0 && (
        <div className="tw-callout">
          <strong>Overlapping OSM feature.</strong> {b.overlaps.map((o) => model.buildings[o].props.osm_id).join(', ')} shares this exact footprint.{' '}
          {b.supersededBy !== null ? 'That feature is rendered instead because its height source ranks higher.' : 'This feature is rendered; the other is kept for inspection.'}
        </div>
      )}

      <h3 className="tw-h3">
        Synthetic metrics <SimBadge />
      </h3>
      <dl className="tw-kvs tw-kvs--sim">
        <KV k="Energy use intensity">{b.sim.energyIntensity.toFixed(0)} kWh/m²/yr</KV>
        <KV k="Annual energy (est. floor area)">{b.sim.energyMWhYr.toFixed(0)} MWh/yr</KV>
        <KV k="Roof surface temp.">{b.sim.roofTempC.toFixed(1)} °C</KV>
        <KV k="PM2.5 at street level">{b.sim.pm25.toFixed(0)} µg/m³</KV>
      </dl>
      <p className="tw-note">Synthetic values for demonstration, shaped by real geometry. Not sensor readings.</p>

      <details className="tw-details">
        <summary>All OSM tags</summary>
        <TagTable props={p} />
      </details>
      <p className="tw-note tw-mono">
        OSM v{p.osm_version ?? '?'} · last edited {p.osm_timestamp ? new Date(String(p.osm_timestamp)).toISOString().slice(0, 10) : 'unknown'} · extracted {model.data.meta.extracted_at.slice(0, 10)}
      </p>

      <div className="tw-actions">
        <button type="button" className="tw-btn" onClick={() => requestCamera('focus')}>
          <Crosshair size={14} /> Zoom to building
        </button>
      </div>
    </>
  );
}

function RoadInspector({ model, index }: { model: TwinModel; index: number }) {
  const r = model.roads[index];
  const select = useTwinStore((s) => s.select);
  return (
    <>
      <header className="tw-inspector__head">
        <div>
          <div className="tw-eyebrow">
            <Route size={13} /> Road · {String(r.props.highway ?? 'unknown')}
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
        <KV k="Length within extract">{Number(r.props.length_m).toFixed(1)} m (QGIS, UTM 43N)</KV>
        <KV k="Lanes">
          <FactValue value={r.props.lanes} />
        </KV>
        <KV k="One-way">
          <FactValue value={r.props.oneway} />
        </KV>
        <KV k="Surface">
          <FactValue value={r.props.surface} />
        </KV>
        <KV k="Drawn width">{r.widthM.toFixed(1)} m (symbolised)</KV>
      </dl>
      <h3 className="tw-h3">OSM tags</h3>
      <TagTable props={r.props} />
    </>
  );
}

function AreaSummary({ model }: { model: TwinModel }) {
  const m = model.data.meta;
  const hs = model.stats.heightSource;
  const total = model.buildings.length;
  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`;
  return (
    <>
      <header className="tw-inspector__head">
        <div>
          <div className="tw-eyebrow">
            <Database size={13} /> Area · {m.city}
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
        <KV k="OSM data as of" mono>
          {m.osm_base_timestamp ? new Date(m.osm_base_timestamp).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'unknown'}
        </KV>
        <KV k="Processing CRS">{m.processing_crs.split(' for ')[0]}</KV>
      </dl>
      <h3 className="tw-h3">Height data coverage</h3>
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
      <p className="tw-note">
        OSM height tagging is sparse in Islamabad. Estimated heights are hatched in the scene and labelled in the inspector. {model.stats.duplicatesResolved > 0 && `${model.stats.duplicatesResolved} duplicate OSM footprint resolved (both kept for inspection).`}
      </p>
      {model.terrain && (
        <>
          <h3 className="tw-h3">Terrain</h3>
          <p className="tw-note">
            Copernicus DEM GLO-30 (surface model), {model.terrain.baseElevation.toFixed(0)}–{model.terrain.maxElevation.toFixed(0)} m ASL. ~30 m native resolution; may include vegetation and structures.
          </p>
        </>
      )}
      <p className="tw-hint">Click a building or road to inspect it. Right-drag to orbit, left-drag to pan.</p>
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
