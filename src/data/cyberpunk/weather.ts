export type WeatherPreset = 'clear' | 'lightRain' | 'heavyRain' | 'fog' | 'thunderstorm';

export interface WeatherParams {
  /** Fraction of rain streaks drawn, 0..1. */
  rain: number;
  /** Added to the base FogExp2 density. */
  fog: number;
  /** Cloud cover 0..1 — dims and greys the sky and the sun. */
  cloud: number;
  /** Road wetness 0..1. */
  wet: number;
  /** Whether lightning strikes occur. */
  lightning: boolean;
}

export const WEATHER: Record<WeatherPreset, WeatherParams & { label: string }> = {
  clear: { label: 'Clear', rain: 0, fog: 0, cloud: 0.08, wet: 0.22, lightning: false },
  lightRain: { label: 'Light rain', rain: 0.3, fog: 0.0003, cloud: 0.55, wet: 0.72, lightning: false },
  heavyRain: { label: 'Heavy rain', rain: 0.8, fog: 0.0006, cloud: 0.85, wet: 1, lightning: false },
  fog: { label: 'Fog', rain: 0, fog: 0.0028, cloud: 0.6, wet: 0.5, lightning: false },
  thunderstorm: { label: 'Thunderstorm', rain: 1, fog: 0.0007, cloud: 1, wet: 1, lightning: true },
};

export const WEATHER_ORDER: WeatherPreset[] = ['clear', 'lightRain', 'heavyRain', 'fog', 'thunderstorm'];
