import opening_hours from 'opening_hours';
import { ALWAYS_OPEN } from '../plan/seed-opening-hours.js';
import type { LocalDate } from './zoned.js';

/**
 * Whether an Attraction is shut for the whole of a given calendar day.
 *
 * Day-level rather than minute-level on purpose: this decides which *day* a
 * visit belongs on, and a traveler sent to a museum on its closing Monday has a
 * ruined morning whatever time they arrive. Whether the visit also fits inside
 * that day's opening window is a narrower question, and not one this ticket
 * asks.
 */
export function closedOn(openingHours: string | null, date: LocalDate): boolean {
  // Unknown is a fact about our data, not about the attraction (CONTEXT.md,
  // "OpeningHours"). Reading it as closed would drop attractions from days they
  // are very likely open on, on no evidence at all. Disclosing the assumption is
  // a separate concern.
  if (openingHours === null) return false;
  // Cheap, and says what it means: something with no restriction cannot be shut.
  if (openingHours === ALWAYS_OPEN) return false;

  // The seed validates this grammar, so a value that fails to parse here is
  // already a bug upstream. Refusing to schedule the attraction would compound
  // it; showing it, with hours the traveler can check, does not.
  const parsed = parserFor(openingHours);
  if (parsed === null) return false;

  const dayStart = localMidnight(date, 0);
  const dayEnd = localMidnight(date, 1);
  return parsed.getOpenIntervals(dayStart, dayEnd).length === 0;
}

/**
 * Day of the week for a calendar date, 0 = Sunday — the same numbering as
 * `Date.prototype.getDay`.
 *
 * Exported mostly so the timezone independence can be asserted directly.
 */
export function weekdayOf(date: LocalDate): number {
  return localMidnight(date, 0).getDay();
}

/**
 * A `Date` whose **local** wall clock reads midnight on `date` plus `offsetDays`.
 *
 * The `opening_hours` library reads its inputs through local getters
 * (`getDay`, `getHours`), so it must be handed a Date positioned in the process
 * timezone rather than in UTC — feed it a UTC-built instant and a machine far
 * enough east or west evaluates the rule against the wrong weekday.
 *
 * Building it with the local `Date` constructor makes the *result* independent
 * of the process timezone, which is what `zoned.ts` promises for everything else
 * here: the weekday of 2026-07-14 is Tuesday in Auckland and in Los Angeles.
 *
 * The city's own timezone does not enter into it. A calendar date is already
 * that city's local date — `scheduleCity` derived it from the arrival instant
 * through `toLocal` — so the weekday follows from the date alone.
 */
function localMidnight(date: LocalDate, offsetDays: number): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day + offsetDays);
}

/**
 * Parsed rules are cached because scoring is combinatorial: every candidate cut
 * asks about the same handful of attractions, and parsing an `opening_hours`
 * expression is far more expensive than evaluating one.
 *
 * Keyed on the expression itself, so it stays correct however the caller loops,
 * and bounded in practice by the number of distinct curated values.
 */
const parsers = new Map<string, opening_hours | null>();

/** Null where the value does not parse — that verdict is cached too, so an
 * unparseable value costs one failed parse rather than one per candidate
 * arrangement the scheduler tries. */
function parserFor(value: string): opening_hours | null {
  const cached = parsers.get(value);
  if (cached !== undefined) return cached;
  let created: opening_hours | null;
  try {
    created = new opening_hours(value);
  } catch {
    created = null;
  }
  parsers.set(value, created);
  return created;
}
