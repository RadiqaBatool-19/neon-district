import { useEffect } from 'react';
import { useCyberStore } from '../../stores/cyberpunkStore';
import { INTRO_DURATION } from '../../data/cyberpunk/config';

/** Brief cinematic title card over the intro flight. Never blocks: skip with the button or Space / Enter / Esc. */
export function IntroOverlay() {
  const setPhase = useCyberStore((s) => s.setPhase);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setPhase('explore');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPhase]);

  return (
    <div className="cp-intro" style={{ ['--intro-duration' as string]: `${INTRO_DURATION}s` }}>
      <div className="cp-intro__bar cp-intro__bar--top" />
      <div className="cp-intro__bar cp-intro__bar--bottom" />
      <div className="cp-intro__title">
        <h1>
          NEON <span>DISTRICT</span>
        </h1>
        <p>A Living City. An Infinite Future.</p>
      </div>
      <div className="cp-intro__progress" aria-hidden="true">
        <span />
      </div>
      <button type="button" className="cp-intro__skip" onClick={() => setPhase('explore')}>
        Skip intro <kbd>Esc</kbd>
      </button>
    </div>
  );
}
