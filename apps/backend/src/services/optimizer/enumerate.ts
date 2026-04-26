export interface EnumerateOptions {
  startCity?: string;
  endCity?: string;
}

export function enumerateOrderings(cities: string[], opts: EnumerateOptions = {}): string[][] {
  const head = opts.startCity ? [opts.startCity] : [];
  const tail = opts.endCity ? [opts.endCity] : [];
  const middle = cities.filter((c) => c !== opts.startCity && c !== opts.endCity);
  const perms = permute(middle);
  return perms.map((p) => [...head, ...p, ...tail]);
}

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permute(rest)) out.push([arr[i]!, ...p]);
  }
  return out;
}
