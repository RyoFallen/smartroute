/**
 * Prints one `IATA W,S,E,N REGION_PATH REGION_FILE` line per seeded city — the
 * bounding box the OSRM extract has to cover, padded around the city's
 * Attraction coordinates, plus the pinned Geofabrik region it is clipped from.
 *
 * One whitespace-separated line per city so the shell can `read` all four
 * fields at once: the recipe has to run under macOS's bash 3.2, which has
 * neither associative arrays nor `mapfile`.
 *
 * Derived rather than hand-listed on purpose: a bbox list maintained separately
 * from `attractions.json` drifts silently, and the failure mode is an
 * attraction that sits just outside the extract and routes to `null` at
 * runtime. Deriving it means adding an attraction can never leave the extract
 * behind.
 *
 * Usage: node city-bboxes.mjs [IATA ...]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cities = JSON.parse(readFileSync(join(here, '../../prisma/seed/attractions.json'), 'utf8'));
const { padDegrees, regions, snapshot } = JSON.parse(
  readFileSync(join(here, 'regions.json'), 'utf8'),
);

const wanted = new Set(process.argv.slice(2));
const selected = cities.filter((c) => wanted.size === 0 || wanted.has(c.iata));

if (wanted.size > 0) {
  const missing = [...wanted].filter((i) => !selected.some((c) => c.iata === i));
  if (missing.length > 0) {
    console.error(`No seeded city for: ${missing.join(', ')}`);
    process.exit(1);
  }
}

for (const city of selected) {
  const region = regions[city.iata];
  if (!region) {
    console.error(`No Geofabrik region pinned for ${city.iata} — add one to regions.json`);
    process.exit(1);
  }
  // The city's own centre counts alongside its attractions: it is what the map
  // opens on, and on a compact set of attractions it can sit outside their hull.
  const lats = [city.lat, ...city.attractions.map((a) => a.lat)];
  const lons = [city.lon, ...city.attractions.map((a) => a.lon)];
  const box = [
    Math.min(...lons) - padDegrees,
    Math.min(...lats) - padDegrees,
    Math.max(...lons) + padDegrees,
    Math.max(...lats) + padDegrees,
  ];
  const file = `${region.split('/').pop()}-${snapshot}.osm.pbf`;
  console.log(`${city.iata} ${box.map((n) => n.toFixed(4)).join(',')} ${region} ${file}`);
}
