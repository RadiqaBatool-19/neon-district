import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Crosshair, Info, X } from 'lucide-react';
import { buildingFacts, compareRows, NOT_AVAILABLE, type CompareRow, type Fact } from '../../data/digital-twin/buildingFacts';
import type { TwinModel } from '../../data/digital-twin/buildTwinModel';
import { passesFilters } from '../../data/digital-twin/filters';
import { typeLabel } from '../../data/digital-twin/styling';
import { MAX_COMPARE, useTwinStore } from '../../stores/twinStore';
import { InfoTip, SourceBadge } from './ui';

function Cell({ fact, row, showMethod }: { fact: Fact | null; row: CompareRow; showMethod: boolean }) {
  if (fact === null) return <td className="tw-cmp__na">Not loaded</td>;
  if (fact.value === null) return <td className="tw-cmp__na">{NOT_AVAILABLE}</td>;
  const n = typeof fact.raw === 'number' ? fact.raw : null;
  const isMax = row.extremes && n === row.extremes.max;
  const isMin = row.extremes && n === row.extremes.min;
  return (
    <td className={isMax ? 'is-max' : isMin ? 'is-min' : undefined} dir="auto">
      <span className="tw-cmp__value">
        {fact.value}
        {isMax && <ArrowUp size={11} aria-label="highest" />}
        {isMin && <ArrowDown size={11} aria-label="lowest" />}
      </span>
      {fact.estimated && <span className="tw-cmp__est">{fact.key === 'volume_m3' ? 'Indicative' : 'Estimated'}</span>}
      {showMethod && fact.method && <InfoTip label={`Method for ${row.label.toLowerCase()}`}>{fact.method}</InfoTip>}
    </td>
  );
}

/**
 * Side-by-side comparison of the buildings in `compareIds`. Every value comes
 * from `buildingFacts`, the same source as the inspector. Columns are keyed by
 * stable OSM id, so a building missing from the loaded area shows as such.
 */
export function ComparePanel({ model }: { model: TwinModel }) {
  const ids = useTwinStore((s) => s.compareIds);
  const open = useTwinStore((s) => s.compareOpen);
  const filters = useTwinStore((s) => s.filters);
  const setOpen = useTwinStore((s) => s.setCompareOpen);
  const remove = useTwinStore((s) => s.removeCompare);
  const clear = useTwinStore((s) => s.clearCompare);
  const focus = useTwinStore((s) => s.focusBuilding);
  const select = useTwinStore((s) => s.select);
  const setLocated = useTwinStore((s) => s.setLocated);

  const columns = useMemo(
    () =>
      ids.map((id) => {
        const index = model.buildingIndexById.get(id);
        return index === undefined ? { id, index: null, facts: null } : { id, index, facts: buildingFacts(model, index) };
      }),
    [ids, model],
  );
  const rows = useMemo(() => compareRows(columns.map((c) => c.facts)), [columns]);

  if (!open) return null;

  const groups: { id: CompareRow['group']; title: string; tag: string }[] = [
    { id: 'source', title: 'Source attributes', tag: 'OpenStreetMap' },
    { id: 'derived', title: 'Derived values', tag: 'Computed' },
  ];

  return (
    <section className="tw-card tw-compare" aria-label="Building comparison">
      <header className="tw-compare__head">
        <h2>
          Compare buildings <span className="tw-count">{ids.length}/{MAX_COMPARE}</span>
        </h2>
        <div className="tw-compare__actions">
          {ids.length > 0 && (
            <button type="button" className="tw-link" onClick={clear}>
              Clear all
            </button>
          )}
          <button type="button" className="tw-icon-btn" onClick={() => setOpen(false)} aria-label="Close comparison">
            <X size={15} />
          </button>
        </div>
      </header>

      {ids.length === 0 ? (
        <p className="tw-note tw-compare__empty">Turn on <b>Compare</b> in the toolbar and click buildings, or Shift+click buildings while inspecting. Up to {MAX_COMPARE} buildings.</p>
      ) : (
        <div className="tw-compare__scroll">
          <table className="tw-cmp">
            <thead>
              <tr>
                <th scope="col" className="tw-cmp__field">
                  Field
                </th>
                {columns.map((c, n) => {
                  const b = c.index !== null ? model.buildings[c.index] : null;
                  const hidden = b !== null && !passesFilters(b, filters);
                  return (
                    <th key={c.id} scope="col" onMouseEnter={() => c.index !== null && setLocated(c.index)} onMouseLeave={() => setLocated(null)}>
                      <div className="tw-cmp__col">
                        <span className="tw-cmp__num">{n + 1}</span>
                        <div className="tw-cmp__title">
                          <strong dir="auto">{b ? b.displayName ?? 'Unnamed building' : 'Not in loaded area'}</strong>
                          <span className="tw-mono">{c.id}</span>
                          {b && <span className="tw-cmp__type">{typeLabel(b.typeKey)}</span>}
                          {b && <SourceBadge source={b.source} />}
                          {hidden && <span className="tw-cmp__hidden">Hidden by filters</span>}
                        </div>
                      </div>
                      <div className="tw-cmp__btns">
                        {c.index !== null && (
                          <>
                            <button type="button" className="tw-icon-btn" onClick={() => focus(c.index!)} title="Zoom to building" aria-label={`Zoom to building ${n + 1}`}>
                              <Crosshair size={13} />
                            </button>
                            <button type="button" className="tw-icon-btn" onClick={() => select({ kind: 'building', index: c.index! })} title="Open in inspector" aria-label={`Inspect building ${n + 1}`}>
                              <Info size={13} />
                            </button>
                          </>
                        )}
                        <button type="button" className="tw-icon-btn" onClick={() => remove(c.id)} title="Remove from comparison" aria-label={`Remove building ${n + 1} from comparison`}>
                          <X size={13} />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.id}>
                <tr className="tw-cmp__group">
                  <th scope="rowgroup" colSpan={columns.length + 1}>
                    {g.title} <span className={`tw-prov${g.id === 'derived' ? ' tw-prov--derived' : ''}`}>{g.tag}</span>
                  </th>
                </tr>
                {rows
                  .filter((r) => r.group === g.id)
                  .map((r) => (
                    <tr key={r.key}>
                      <th scope="row" className="tw-cmp__field">
                        {r.label}
                        {r.method && <InfoTip label={`About ${r.label.toLowerCase()}`}>{r.method}</InfoTip>}
                      </th>
                      {r.cells.map((f, i) => (
                        <Cell key={columns[i].id} fact={f} row={r} showMethod={g.id === 'derived' && !r.method} />
                      ))}
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      {ids.length > 0 && (
        <p className="tw-note tw-compare__foot">
          <ArrowUp size={11} /> highest · <ArrowDown size={11} /> lowest, marked only where every building has a value from the same kind of source. Estimated heights and the volumes that use them are never ranked. Synthetic metrics are not compared here.
        </p>
      )}
    </section>
  );
}
