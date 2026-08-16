/**
 * Wall-clock arithmetic in a city's own timezone.
 *
 * An Itinerary is read as local time — "Colosseum 09:00" means nine in the
 * morning in Rome — so every window bound and slot boundary is computed on the
 * city's wall clock and only converted to an instant at the edges. Built on
 * `Intl.DateTimeFormat`, which carries the IANA rules Node already ships, so
 * there is no date library and no DST table to keep current.
 *
 * Everything here is pure: no `Date.now()`, no ambient timezone. The process
 * TZ never leaks into a result.
 */

/** A calendar date in a city's timezone, "YYYY-MM-DD". */
export type LocalDate = string;

/**
 * Minutes since local midnight. May exceed 1440: an arrival at 22:40 plus the
 * transfer buffer opens a window past midnight, and `localIso` rolls the date
 * forward rather than pretending the time wrapped.
 */
export type MinutesOfDay = number;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timezone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(timezone, created);
  return created;
}

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallPartsAt(timezone: string, instant: Date): WallParts {
  const parts = formatterFor(timezone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Intl gave no ${type} part for timezone ${timezone}`);
    return Number(part.value);
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');

function parseLocalDate(date: LocalDate): [year: number, month: number, day: number] {
  return date.split('-').map(Number) as [number, number, number];
}

/** The zone's UTC offset in minutes at `instant` — DST-correct by construction. */
export function utcOffsetMinutes(timezone: string, instant: Date): number {
  const p = wallPartsAt(timezone, instant);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asIfUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** Reads an ISO-8601 instant on `timezone`'s wall clock. */
export function toLocal(
  timezone: string,
  isoInstant: string,
): { date: LocalDate; minutesOfDay: MinutesOfDay } {
  const p = wallPartsAt(timezone, new Date(isoInstant));
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    minutesOfDay: p.hour * 60 + p.minute,
  };
}

/**
 * Renders a local wall-clock time as ISO-8601 carrying the city's own offset
 * (`2026-07-14T09:00:00+03:00`), so a client can display it without knowing the
 * zone and still has an unambiguous instant.
 *
 * The offset is resolved in two passes because the offset depends on the very
 * instant we are deriving: guess with the offset at the naive instant, then
 * re-read the offset there. One pass is wrong across a DST boundary.
 */
export function localIso(timezone: string, date: LocalDate, minutesOfDay: MinutesOfDay): string {
  const [year, month, day] = parseLocalDate(date);
  const wallMs = Date.UTC(year, month - 1, day, 0, minutesOfDay);
  const firstGuess = utcOffsetMinutes(timezone, new Date(wallMs));
  const offset = utcOffsetMinutes(timezone, new Date(wallMs - firstGuess * 60_000));

  const wall = new Date(wallMs);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return (
    `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}` +
    `T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Calendar arithmetic on "YYYY-MM-DD", free of any timezone. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const [year, month, day] = parseLocalDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return (
    `${shifted.getUTCFullYear()}-` +
    `${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
  );
}

/** Whole days from `from` to `to`; negative when `to` precedes `from`. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const asMs = (d: LocalDate): number => {
    const [year, month, day] = parseLocalDate(d);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((asMs(to) - asMs(from)) / 86_400_000);
}

/** Every date from `from` to `to` inclusive; just `[from]` if `to` precedes it. */
export function datesInclusive(from: LocalDate, to: LocalDate): LocalDate[] {
  const span = daysBetween(from, to);
  if (span < 0) return [from];
  return Array.from({ length: span + 1 }, (_, i) => addDays(from, i));
}

/** Parses the profile's "HH:mm" wake-up time into minutes since midnight. */
export function minutesOfDayFromHhMm(hhmm: string): MinutesOfDay {
  const [hours, minutes] = hhmm.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
}
