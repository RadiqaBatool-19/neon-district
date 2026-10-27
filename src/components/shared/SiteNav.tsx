import { NavLink } from 'react-router-dom';

interface SiteNavProps {
  variant: 'dark' | 'light';
  className?: string;
}

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/cyberpunk-city', label: 'Cyberpunk City' },
  { to: '/digital-twin', label: 'Digital Twin' },
];

/** Lightweight cross-project navigation shared by every route. */
export function SiteNav({ variant, className = '' }: SiteNavProps) {
  return (
    <nav className={`site-nav site-nav--${variant} ${className}`} aria-label="Projects">
      {LINKS.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `site-nav__link${isActive ? ' is-active' : ''}`}>
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
