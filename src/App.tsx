import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoadingScreen } from './components/shared/LoadingScreen';
import { NotFoundPage } from './pages/NotFoundPage';

// Each experience is its own chunk: visiting one never downloads or mounts the other.
const HomePage = lazy(() => import('./pages/HomePage'));
const CyberpunkCityPage = lazy(() => import('./pages/CyberpunkCityPage'));
const DigitalTwinPage = lazy(() => import('./pages/DigitalTwinPage'));

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<LoadingScreen variant="neutral" label="Loading" />}>
            <HomePage />
          </Suspense>
        }
      />
      <Route
        path="/cyberpunk-city"
        element={
          <Suspense fallback={<LoadingScreen variant="cyber" label="Booting Neon District" />}>
            <CyberpunkCityPage />
          </Suspense>
        }
      />
      <Route
        path="/digital-twin"
        element={
          <Suspense fallback={<LoadingScreen variant="twin" label="Loading digital twin" />}>
            <DigitalTwinPage />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
