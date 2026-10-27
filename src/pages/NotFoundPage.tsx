import { Link } from 'react-router-dom';
import { SiteNav } from '../components/shared/SiteNav';

export function NotFoundPage() {
  return (
    <div className="home">
      <header className="home__header">
        <span className="home__wordmark">NEON DISTRICT</span>
        <SiteNav variant="dark" />
      </header>
      <main className="notfound">
        <h1>404</h1>
        <p>This route doesn't exist.</p>
        <Link to="/">Back to projects</Link>
      </main>
    </div>
  );
}
