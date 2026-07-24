export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function jitter(baseMs: number, ratio = 0.1): number {
  return Math.round((Math.random() * 2 - 1) * baseMs * ratio);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function noise(seed: number): number {
  const value = Math.sin(seed * 12_989.27 + 78.233) * 43_758.545_312_3;
  return value - Math.floor(value);
}

export function pickOne<T>(items: readonly T[], seed: number): T {
  return items[Math.floor(noise(seed) * items.length)] ?? items[0]!;
}

export function seasonalBaseTemp(month: number): number {
  const bases = [1, 3, 8, 14, 20, 24, 28, 29, 24, 18, 11, 4];
  return bases[month] ?? 20;
}

export function hourAngle(date: Date): number {
  return ((date.getHours() - 15) / 24) * Math.PI * 2;
}
