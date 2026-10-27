import { useState } from 'react';
import { ChevronRight, Filter, Layers3 } from 'lucide-react';
import type { TwinModel } from '../../data/digital-twin/buildTwinModel';
import { legendFor, SOURCE_COLORS, SOURCE_LABELS, TYPE_COLORS, TYPE_FALLBACK, typeLabel } from '../../data/digital-twin/styling';
import type { HeightSource } from '../../data/digital-twin/types';
import { useTwinStore, type ColorBy, type SurfaceOverlay } from '../../stores/twinStore';
import { cssGradient } from '../../utils/colorRamp';
import { SIM_SCALES } from '../../data/digital-twin/simulatedMetrics';
import { Check, Panel, Seg, SimBadge } from './ui';

const COLOR_BY: { value: ColorBy; label: string; simulated?: boolean }[] = [
  { value: 'type', label: 'Building type' },
  { value: 'height', label: 'Height' },
  { value: 'heightSource', label: 'Height source' },
  { value: 'energy', label: 'Energy use', simulated: true },
  { value: 'temperature', label: 'Roof temperature', simulated: true },
  { value: 'air', label: 'Air quality (PM2.5)', simulated: true },
];

function Legend({ model }: { model: TwinModel }) {
  const colorBy = useTwinStore((s) => s.colorBy);
  const spec = legendFor(colorBy, model.stats.types, model.stats.maxHeight);
  return (
    <div className="tw-legend" aria-label="Legend">
      <div className="tw-legend__title">
        {spec.title}
        {spec.simulated && <SimBadge />}
      </div>
      {spec.kind === 'categorical' ? (
        <ul>
          {spec.items!.map((i) => (
            <li key={i.label}>
              <span className="tw-swatch" style={{ background: i.color }} />
              {i.label}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="tw-legend__ramp" style={{ background: cssGradient(spec.stops!) }} />
          <div className="tw-legend__ends">
            <span>{spec.min}</span>
            <span>{spec.max}</span>
          </div>
        </>
      )}
      {spec.note && <p className="tw-note">{spec.note}</p>}
    </div>
  );
}

function SurfaceLegend() {
  const surface = useTwinStore((s) => s.surface);
  if (surface === 'none') return null;
  const s = SIM_SCALES[surface];
  return (
    <div className="tw-legend">
      <div className="tw-legend__title">
        Ground overlay · {surface === 'temperature' ? 'surface temperature' : 'PM2.5 at street level'} ({s.unit}) <SimBadge />
      </div>
      <div className="tw-legend__ramp" style={{ background: cssGradient([...s.stops]) }} />
      <div className="tw-legend__ends">
        <span>{s.min}</span>
        <span>{s.max}+</span>
      </div>
    </div>
  );
}

function Filters({ model, visibleCount }: { model: TwinModel; visibleCount: number }) {
  const filters = useTwinStore((s) => s.filters);
  const setFilters = useTwinStore((s) => s.setFilters);
  const resetFilters = useTwinStore((s) => s.resetFilters);
  const maxH = Math.ceil(model.stats.maxHeight);
  const allTypes = model.stats.types.map((t) => t.key);
  const active = filters.types ?? allTypes;
  const total = model.buildings.filter((b) => b.supersededBy === null).length;

  const toggleType = (key: string, on: boolean) => {
    const next = on ? [...active, key] : active.filter((k) => k !== key);
    setFilters({ types: next.length === allTypes.length ? null : next });
  };

  return (
    <div className="tw-filters">
      <div className="tw-subhead">
        <span>Building type</span>
      </div>
      {model.stats.types.map((t) => (
        <Check key={t.key} label={typeLabel(t.key)} swatch={TYPE_COLORS[t.key] ?? TYPE_FALLBACK} count={t.count} checked={active.includes(t.key)} onChange={(v) => toggleType(t.key, v)} />
      ))}
      <div className="tw-subhead">
        <span>Height range</span>
        <span className="tw-mono">
          {filters.heightMin}–{Math.min(filters.heightMax, maxH)} m
        </span>
      </div>
      <div className="tw-range2">
        <input type="range" aria-label="Minimum height" min={0} max={maxH} value={filters.heightMin} onChange={(e) => setFilters({ heightMin: Math.min(Number(e.target.value), filters.heightMax) })} />
        <input type="range" aria-label="Maximum height" min={0} max={maxH} value={Math.min(filters.heightMax, maxH)} onChange={(e) => setFilters({ heightMax: Math.max(Number(e.target.value), filters.heightMin) })} />
      </div>
      <div className="tw-subhead">
        <span>Height source</span>
      </div>
      {(Object.keys(SOURCE_LABELS) as HeightSource[]).map((k) => (
        <Check key={k} label={SOURCE_LABELS[k]} swatch={SOURCE_COLORS[k]} count={model.stats.heightSource[k]} checked={filters.sources[k]} onChange={(v) => setFilters({ sources: { ...filters.sources, [k]: v } })} />
      ))}
      <div className="tw-filters__foot">
        <span>
          Showing <b>{visibleCount}</b> of {total}
        </span>
        <button type="button" className="tw-link" onClick={() => resetFilters(model.stats.maxHeight)}>
          Reset
        </button>
      </div>
    </div>
  );
}

export function LayerPanel({ model, visibleCount, open }: { model: TwinModel; visibleCount: number; open: boolean }) {
  const layers = useTwinStore((s) => s.layers);
  const toggle = useTwinStore((s) => s.toggleLayer);
  const colorBy = useTwinStore((s) => s.colorBy);
  const setColorBy = useTwinStore((s) => s.setColorBy);
  const surface = useTwinStore((s) => s.surface);
  const setSurface = useTwinStore((s) => s.setSurface);
  const mark = useTwinStore((s) => s.markEstimated);
  const setMark = useTwinStore((s) => s.setMarkEstimated);
  const ex = useTwinStore((s) => s.exaggeration);
  const setEx = useTwinStore((s) => s.setExaggeration);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasTerrain = !!model.terrain;

  return (
    <aside className={`tw-side tw-side--left${open ? ' is-open' : ''}`} aria-label="Layers and filters">
      <Panel title="Layers" icon={<Layers3 size={15} />}>
        <Check label="Buildings" checked={layers.buildings} onChange={() => toggle('buildings')} count={model.buildings.length} />
        <Check label="Roads & paths" checked={layers.roads} onChange={() => toggle('roads')} count={model.roads.length} />
        <Check label="Land use & green" checked={layers.landuse} onChange={() => toggle('landuse')} count={model.landuse.length} />
        <Check label={hasTerrain ? 'Terrain relief (DEM)' : 'Terrain relief (no DEM loaded)'} checked={layers.terrain && hasTerrain} disabled={!hasTerrain} onChange={() => toggle('terrain')} />
        <Check label="Labels" checked={layers.labels} onChange={() => toggle('labels')} />

        <label className="tw-field">
          <span>Colour buildings by</span>
          <select value={colorBy} onChange={(e) => setColorBy(e.target.value as ColorBy)}>
            {COLOR_BY.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
                {c.simulated ? ' — simulated' : ''}
              </option>
            ))}
          </select>
        </label>
        <Legend model={model} />

        <div className="tw-field">
          <span>
            Ground overlay <SimBadge />
          </span>
          <Seg<SurfaceOverlay>
            label="Ground overlay"
            value={surface}
            onChange={setSurface}
            options={[
              { value: 'none', label: 'Off' },
              { value: 'temperature', label: 'Temperature' },
              { value: 'air', label: 'PM2.5' },
            ]}
          />
        </div>
        <SurfaceLegend />

        <div className="tw-field">
          <span>Vertical exaggeration (terrain)</span>
          <Seg<number>
            label="Vertical exaggeration"
            value={ex}
            onChange={setEx}
            disabled={!hasTerrain || !layers.terrain}
            options={[
              { value: 1, label: '1×', title: 'True scale' },
              { value: 2, label: '2×' },
              { value: 3, label: '3×' },
            ]}
          />
        </div>
        <Check label="Hatch estimated heights" checked={mark} onChange={setMark} />
      </Panel>

      <section className="tw-card">
        <button type="button" className="tw-card__toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
          <span>
            <Filter size={15} /> Filters
          </span>
          <ChevronRight size={15} className={filtersOpen ? 'is-open' : ''} />
        </button>
        {filtersOpen && <Filters model={model} visibleCount={visibleCount} />}
      </section>
    </aside>
  );
}
