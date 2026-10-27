import type { TwinManifest } from '../../data/digital-twin/types';
import { SiteNav } from '../shared/SiteNav';

export function TwinHeader({ manifest, areaId, onAreaChange }: { manifest: TwinManifest; areaId: string; onAreaChange: (id: string) => void }) {
  const available = manifest.areas.filter((a) => a.status === 'available');
  return (
    <header className="tw-header">
      <div className="tw-brand">
        <span className="tw-brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M3 17 L12 21 L21 17 L21 8 L12 4 L3 8 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M3 8 L12 12 L21 8 M12 12 L12 21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <div className="tw-brand__title">Interactive 3D Digital Twin</div>
          <div className="tw-brand__sub">{manifest.region.name}</div>
        </div>
      </div>

      <label className="tw-area">
        <span className="visually-hidden">Area</span>
        <select value={areaId} onChange={(e) => onAreaChange(e.target.value)}>
          {available.map((a) => (
            <option key={a.id} value={a.id}>
              {a.city} · {a.name}
              {a.subtitle ? ` (${a.subtitle})` : ''}
            </option>
          ))}
          <option disabled>More Islamabad–Rawalpindi areas — planned</option>
        </select>
      </label>

      <SiteNav variant="light" className="tw-sitenav" />
    </header>
  );
}

export function Attribution({ osmTimestamp, hasDem }: { osmTimestamp: string | null; hasDem: boolean }) {
  return (
    <footer className="tw-attrib">
      <span>
        ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap contributors
        </a>{' '}
        (ODbL){osmTimestamp ? ` · data ${osmTimestamp.slice(0, 10)}` : ''}
      </span>
      {hasDem && <span>Terrain: Copernicus DEM GLO-30 © DLR e.V. 2010–2014, © Airbus 2014–2018, provided under COPERNICUS by the EU and ESA</span>}
      <span>Energy, temperature & air-quality values are simulated</span>
    </footer>
  );
}
