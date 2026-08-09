import opening_hours from 'opening_hours';

/**
 * Validates a value against the OSM `opening_hours` grammar.
 *
 * Two things about the upstream parser are worth knowing, because both leak
 * without this wrapper:
 *
 * 1. It throws **plain strings**, not `Error` instances. Callers that assume
 *    `Error` semantics (anything reading `.message`, or a `rejects.toThrow`)
 *    misbehave against a bare string, so every failure is re-thrown as a real
 *    Error carrying the caller's context.
 * 2. Public-holiday macros (`PH`, `SH`) are rejected, and this is deliberate
 *    rather than a shortcut. They need a country code to resolve, and even given
 *    one the library cannot evaluate them for two of our eight seed countries:
 *    measured 2026-08-09, `Mo-Fr 09:00-17:00; PH off` evaluates for de/pl/hu/fr/
 *    it/es but throws for **tr and gb** — Istanbul and London. Accepting such a
 *    value at seed time would therefore store data the closure checker could
 *    never evaluate, turning a loud seed-time failure into a silent runtime one.
 *    Curated data writes explicit dates instead (`Jan 01,Dec 25 off`), which
 *    parse and evaluate everywhere and are reproducible for the thesis.
 *    Sun-relative forms (`sunrise-sunset`) need no location context and work.
 */
export function assertValidOpeningHours(value: string, context: string): void {
  try {
    new opening_hours(value);
  } catch (cause) {
    throw new Error(
      `${context}: invalid OSM opening_hours value ${JSON.stringify(value)} — ${String(cause)}`,
      { cause },
    );
  }
}
