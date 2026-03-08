export type Rgb = [number, number, number];

export function rgb(color: Rgb, alpha?: number): string {
  if (alpha === undefined) return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpColor(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

export function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

export function weightedChoice<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < items.length; i += 1) {
    acc += weights[i] ?? 0;
    if (r <= acc) return items[i] as T;
  }
  return items[items.length - 1] as T;
}
