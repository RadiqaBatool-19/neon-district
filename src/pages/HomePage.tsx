import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { SiteNav } from '../components/shared/SiteNav';
import '../styles/home.css';

/** Neon skyline illustration (SVG, no WebGL) for the Cyberpunk card. */
function CyberPreview() {
  const towers = [
    [18, 120, 24], [46, 160, 30], [80, 90, 22], [106, 200, 34], [146, 130, 26], [176, 230, 28], [208, 150, 30], [242, 185, 24], [270, 110, 30], [304, 170, 26], [334, 95, 34],
  ];
  return (
    <svg className="home-preview__svg" viewBox="0 0 380 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="cp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#06061a" />
          <stop offset="0.65" stopColor="#24103d" />
          <stop offset="1" stopColor="#45205a" />
        </linearGradient>
        <pattern id="cp-win" width="6" height="8" patternUnits="userSpaceOnUse">
          <rect width="6" height="8" fill="#0a0d1a" />
          <rect x="1.5" y="2" width="3" height="3.5" fill="#8fd8ff" opacity="0.55" />
        </pattern>
        <pattern id="cp-win2" width="6" height="8" patternUnits="userSpaceOnUse">
          <rect width="6" height="8" fill="#0d0a16" />
          <rect x="1.5" y="2" width="3" height="3.5" fill="#ff9be6" opacity="0.4" />
        </pattern>
        <filter id="cp-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <rect width="380" height="260" fill="url(#cp-sky)" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={(i * 97) % 380} cy={(i * 53) % 110} r={i % 5 === 0 ? 0.9 : 0.5} fill="#cfe0ff" opacity={0.5} />
      ))}
      {towers.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={260 - h} width={w} height={h} fill={i % 3 === 1 ? 'url(#cp-win2)' : 'url(#cp-win)'} />
          <rect x={x} y={260 - h} width={w} height="2" fill={i % 3 === 1 ? '#ff2bd6' : '#3ef0ff'} filter="url(#cp-glow)" />
          <rect x={x} y={260 - h} width={w} height="1.2" fill={i % 3 === 1 ? '#ff7be6' : '#9ff7ff'} />
        </g>
      ))}
      <path d="M0 214 C 90 200, 160 222, 380 206" stroke="#3ef0ff" strokeWidth="2" fill="none" filter="url(#cp-glow)" />
      <path d="M0 214 C 90 200, 160 222, 380 206" stroke="#bff9ff" strokeWidth="0.8" fill="none" />
      <rect x="114" y="120" width="10" height="34" fill="#ff2bd6" opacity="0.9" filter="url(#cp-glow)" />
      <rect x="114" y="120" width="10" height="34" fill="#ff7be6" />
      <rect x="0" y="246" width="380" height="14" fill="#07070f" />
    </svg>
  );
}

/** Isometric block-model illustration for the Digital Twin card. */
function TwinPreview() {
  const iso = (x: number, y: number, z: number) => [190 + (x - y) * 0.87, 150 + (x + y) * 0.5 - z] as const;
  const box = (x: number, y: number, w: number, d: number, h: number, fill: string, key: string) => {
    const p = (a: number, b: number, c: number) => iso(a, b, c).join(',');
    return (
      <g key={key}>
        <polygon points={`${p(x, y + d, 0)} ${p(x + w, y + d, 0)} ${p(x + w, y + d, h)} ${p(x, y + d, h)}`} fill={fill} stroke="#64748b" strokeWidth="0.4" />
        <polygon points={`${p(x + w, y, 0)} ${p(x + w, y + d, 0)} ${p(x + w, y + d, h)} ${p(x + w, y, h)}`} fill={fill} opacity="0.78" stroke="#64748b" strokeWidth="0.4" />
        <polygon points={`${p(x, y, h)} ${p(x + w, y, h)} ${p(x + w, y + d, h)} ${p(x, y + d, h)}`} fill="#f8fafc" stroke="#64748b" strokeWidth="0.4" />
      </g>
    );
  };
  const tile = [iso(-90, -90, 0), iso(90, -90, 0), iso(90, 90, 0), iso(-90, 90, 0)].map((p) => p.join(',')).join(' ');
  const blocks: [number, number, number, number, number, string][] = [
    [-80, -80, 22, 18, 10, '#e3d6bf'], [-52, -80, 18, 16, 8, '#e3d6bf'], [-28, -78, 20, 18, 12, '#dfe3ea'], [-80, -50, 18, 20, 9, '#e3d6bf'],
    [-54, -48, 22, 16, 11, '#dfe3ea'], [10, -80, 26, 22, 14, '#dfe3ea'], [44, -76, 20, 18, 10, '#e3d6bf'], [-78, 20, 70, 50, 22, '#cbd5e1'],
    [-70, 26, 14, 14, 92, '#93b4e0'], [-48, 26, 14, 14, 92, '#93b4e0'], [-26, 26, 14, 14, 92, '#93b4e0'], [10, 20, 46, 34, 4, '#f2c38b'],
  ];
  return (
    <svg className="home-preview__svg" viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="380" height="260" fill="#e8ecf1" />
      {Array.from({ length: 14 }, (_, i) => (
        <line key={i} x1={i * 30} y1="0" x2={i * 30 - 150} y2="260" stroke="#d4dae2" strokeWidth="0.6" />
      ))}
      <polygon points={tile} fill="#f1f1ec" stroke="#94a3b8" strokeWidth="0.8" />
      <polyline points={[iso(-90, 8, 0), iso(90, 8, 0)].map((p) => p.join(',')).join(' ')} stroke="#ffffff" strokeWidth="7" />
      <polyline points={[iso(0, -90, 0), iso(0, 90, 0)].map((p) => p.join(',')).join(' ')} stroke="#ffffff" strokeWidth="5" />
      <polygon points={[iso(60, 30, 0), iso(88, 30, 0), iso(88, 88, 0), iso(60, 88, 0)].map((p) => p.join(',')).join(' ')} fill="#cfe6c3" />
      {blocks.map(([x, y, w, d, h, c], i) => box(x, y, w, d, h, c, `b${i}`))}
      <polyline points={[iso(-60, -20, 2), iso(40, -20, 2)].map((p) => p.join(',')).join(' ')} stroke="#1d4ed8" strokeWidth="1.6" strokeDasharray="4 2" />
      <circle cx={iso(-60, -20, 2)[0]} cy={iso(-60, -20, 2)[1]} r="2.6" fill="#1d4ed8" />
      <circle cx={iso(40, -20, 2)[0]} cy={iso(40, -20, 2)[1]} r="2.6" fill="#1d4ed8" />
      <rect x={iso(-10, -20, 2)[0] - 22} y={iso(-10, -20, 2)[1] - 18} width="44" height="13" rx="3" fill="#0f172a" />
      <text x={iso(-10, -20, 2)[0]} y={iso(-10, -20, 2)[1] - 8.8} textAnchor="middle" fontSize="7.5" fill="#fff" fontFamily="Inter, sans-serif" fontWeight="600">
        362.9 m
      </text>
    </svg>
  );
}

export default function HomePage() {
  useEffect(() => {
    document.title = 'NEON DISTRICT · Two 3D experiences';
  }, []);

  return (
    <div className="home">
      <header className="home__header">
        <span className="home__wordmark">
          NEON <b>DISTRICT</b>
        </span>
        <SiteNav variant="dark" />
      </header>

      <main className="home__main">
        <section className="home__intro">
          <p className="home__eyebrow">Two independent WebGL projects</p>
          <h1>
            One cinematic city of the future.
            <br />
            <span>One measurable model of a real one.</span>
          </h1>
          <p className="home__lede">Each experience runs its own scene, data pipeline and interface, and loads only when you open it.</p>
        </section>

        <div className="home__grid">
          <Link to="/cyberpunk-city" className="home-card home-card--cyber">
            <div className="home-preview">
              <CyberPreview />
              <span className="home-card__tag">Procedural · Fictional</span>
            </div>
            <div className="home-card__body">
              <div className="home-card__index">01</div>
              <h2>Cyberpunk City Explorer</h2>
              <p>A procedurally generated night city of neon, rain and elevated highways. Fly through five districts, inspect towers and switch on simulated data lenses.</p>
              <ul>
                <li>Instanced procedural architecture</li>
                <li>Bloom, fog, rain & living traffic</li>
                <li>Cinematic camera & intro</li>
              </ul>
              <span className="home-card__cta">
                Enter the city <ArrowUpRight size={16} />
              </span>
            </div>
          </Link>

          <Link to="/digital-twin" className="home-card home-card--twin">
            <div className="home-preview">
              <TwinPreview />
              <span className="home-card__tag">OpenStreetMap · Copernicus DEM</span>
            </div>
            <div className="home-card__body">
              <div className="home-card__index">02</div>
              <h2>Interactive 3D Digital Twin</h2>
              <p>Blue Area West, Islamabad, built from a real OpenStreetMap extract prepared in QGIS and draped on terrain. Inspect buildings and roads, filter, and measure.</p>
              <ul>
                <li>GeoJSON pipeline · shared regional origin</li>
                <li>Recorded vs. estimated heights, clearly marked</li>
                <li>Ellipsoidal distance, area & elevation tools</li>
              </ul>
              <span className="home-card__cta">
                Open the twin <ArrowUpRight size={16} />
              </span>
            </div>
          </Link>
        </div>
      </main>

      <footer className="home__footer">
        <span>Built with React, Three.js & React Three Fiber.</span>
        <span>
          Twin data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL) · Copernicus DEM GLO-30. Metrics in both experiences are simulated unless stated otherwise.
        </span>
      </footer>
    </div>
  );
}
