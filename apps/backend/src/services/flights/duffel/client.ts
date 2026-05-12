import { Duffel } from '@duffel/api';

export interface DuffelClientOptions {
  token: string;
  basePath?: string;
}

export function createDuffelClient(opts: DuffelClientOptions): Duffel {
  return new Duffel({ token: opts.token, basePath: opts.basePath });
}

export type DuffelClient = Duffel;
