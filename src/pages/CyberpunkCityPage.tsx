import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { CityHUD } from '../components/cyberpunk/CityHUD';
import { IntroOverlay } from '../components/cyberpunk/IntroOverlay';
import { ErrorBoundary, FailureScreen } from '../components/shared/ErrorBoundary';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { useCyberStore } from '../stores/cyberpunkStore';
import { frameStats } from '../utils/frameStats';
import { isWebGL2Available, prefersReducedMotion, safeStorageGet, safeStorageSet } from '../utils/webgl';
import '../styles/cyberpunk.css';

const CityCanvas = lazy(() => import('../scenes/cyberpunk/CityCanvas'));
const INTRO_SEEN_KEY = 'neon-district.intro-seen';

/** The sign atlas draws with Space Grotesk; wait briefly for it, but never block on it. */
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const timeout = new Promise((r) => setTimeout(r, 1500));
    const fonts = document.fonts?.load ? Promise.all([document.fonts.load('600 92px "Space Grotesk"'), document.fonts.load('700 78px "Space Grotesk"')]) : Promise.resolve();
    Promise.race([fonts, timeout])
      .catch(() => undefined)
      .then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

export default function CyberpunkCityPage() {
  const phase = useCyberStore((s) => s.phase);
  const fontsReady = useFontsReady();
  const [webgl] = useState(isWebGL2Available);

  useEffect(() => {
    document.title = 'Cyberpunk City Explorer · NEON DISTRICT';
    return () => {
      // Leave no state behind for the next visit or route.
      useCyberStore.getState().reset();
      frameStats.reset();
      document.body.style.cursor = '';
    };
  }, []);

  const handleReady = useCallback(() => {
    const skip = prefersReducedMotion() || safeStorageGet(INTRO_SEEN_KEY) === '1';
    safeStorageSet(INTRO_SEEN_KEY, '1');
    useCyberStore.getState().setPhase(skip ? 'explore' : 'intro');
  }, []);

  if (!webgl) {
    return <FailureScreen variant="dark" title="WebGL 2 is not available" message="This experience needs WebGL 2. Try a recent version of Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is enabled." />;
  }

  return (
    <div className="cp-root">
      <ErrorBoundary variant="dark" title="The city failed to render">
        {fontsReady && (
          <Suspense fallback={null}>
            <CityCanvas onReady={handleReady} />
          </Suspense>
        )}
        {phase === 'intro' && <IntroOverlay />}
        <CityHUD visible={phase === 'explore'} />
        {phase === 'loading' && <LoadingScreen variant="cyber" label="Generating Neon District" detail="Procedural city · shaders · lighting" />}
      </ErrorBoundary>
    </div>
  );
}
