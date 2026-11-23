/**
 * Writes the competitor benchmark report, docs/benchmark/report.md (#35, #38):
 * every frozen BenchmarkScenario priced from every transcribed CaptureSession,
 * by the shipped optimize() path over seeds 1–30 and by brute force.
 *
 * Run by hand (never CI):
 *   pnpm --filter @smartroute/backend exec tsx scripts/benchmark/report.ts
 *   ... --sessions <dir>   read session files from elsewhere (default docs/benchmark/sessions)
 *   ... --out <file>       write the report elsewhere (default docs/benchmark/report.md)
 *
 * It refuses to write anything if a session is missing a checklist fare, so an
 * incomplete transcription can never quietly change a reported number.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';
import {
  SessionFile,
  BENCHMARK_SEEDS,
  evaluateBenchmark,
  type AcrossSessions,
  type BenchmarkReport,
  type GroupSummary,
  type ScenarioResult,
  type SpotCheckSummary,
} from '../../src/services/benchmark/index.js';
import { BENCHMARK_DOCS, loadFrozenScenarios } from './frozen-scenarios.js';

const docs = BENCHMARK_DOCS;
const argValue = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};
const sessionsDir = path.resolve(argValue('--sessions') ?? path.join(docs, 'sessions'));
const outPath = path.resolve(argValue('--out') ?? path.join(docs, 'report.md'));

const file = loadFrozenScenarios();

const sessionFiles = existsSync(sessionsDir)
  ? readdirSync(sessionsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
  : [];
if (sessionFiles.length === 0) {
  console.error(`No session files in ${path.relative(process.cwd(), sessionsDir)}.`);
  process.exit(1);
}
const sessions = sessionFiles.map((f) =>
  SessionFile.parse(JSON.parse(readFileSync(path.join(sessionsDir, f), 'utf8'))),
);

/**
 * A session's owner audit, `<date>-audit.md` beside its session file: each
 * table row's last cell is `[x]` (matches), `[ ]` (not yet audited) or the
 * value the auditor saw instead (a mismatch).
 */
interface Audit {
  date: string;
  sampled: number;
  audited: number;
  mismatches: number;
}
const audits: Audit[] = sessions.flatMap(({ date }) => {
  const file = path.join(sessionsDir, `${date}-audit.md`);
  if (!existsSync(file)) return [];
  const cells = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => line.split('|').at(-2)!.trim());
  return [
    {
      date,
      sampled: cells.length,
      audited: cells.filter((c) => c !== '[ ]').length,
      mismatches: cells.filter((c) => c !== '[ ]' && c !== '[x]').length,
    },
  ];
});
/** One-sided exact (Clopper–Pearson) 95% upper bound on an error rate. */
function upperBound95(errors: number, n: number): number {
  if (errors === n) return 1;
  // Bisection on P(X ≤ errors | p) = 0.05.
  const cdf = (p: number) => {
    let sum = 0;
    let term = Math.pow(1 - p, n);
    for (let k = 0; k <= errors; k++) {
      sum += term;
      term *= ((n - k) / (k + 1)) * (p / (1 - p));
    }
    return sum;
  };
  let lo = errors / n;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) > 0.05) lo = mid;
    else hi = mid;
  }
  return hi;
}

const report = await evaluateBenchmark(file.scenarios, sessions, { seeds: BENCHMARK_SEEDS });
if (report.refused.length > 0) {
  for (const { date, problems } of report.refused) {
    console.error(`Session ${date} refused:`);
    for (const p of problems) console.error(`  ${p}`);
  }
  process.exit(1);
}

const eur = (cents: number | null) => (cents === null ? '—' : `€${(cents / 100).toFixed(2)}`);
const pct = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`);
/** A saving to one decimal, signed so a GA that costs more reads as negative. */
const savingPct = (share: number | null) => (share === null ? '—' : `${(share * 100).toFixed(1)}%`);

/** Milliseconds below a second (the GA usually takes a few), seconds above. */
const secs = (ms: number | null) =>
  ms === null ? '—' : ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`;

/** An across-session median, flagged with how many sessions it covers when fewer than all. */
function across(a: AcrossSessions, of: number, fmt: (v: number | null) => string): string {
  return fmt(a.value) + (a.value !== null && a.sessions < of ? ` (${a.sessions}/${of})` : '');
}

function groupRow(g: GroupSummary): string {
  const label = g.visitedCount === null ? '**All**' : `origin + ${g.visitedCount}`;
  const nomad = `${g.nomad.wins}/${g.nomad.compared} (${pct(g.nomad.winRate)})`;
  return `| ${label} | ${g.scenarios} | ${savingPct(g.savingVsNaive)} | ${savingPct(g.savingVsMean)} | ${savingPct(g.optimalityGap)} | ${pct(g.hitRate)} | ${pct(g.ordersEvaluatedShare)} | ${nomad} | ${savingPct(g.nomad.medianSaving)} | ${secs(g.gaMs)} | ${secs(g.maxGaMs)} |`;
}

/** The first optimal order, with how many others tie with it. */
function optimumOrder(optimum: ScenarioResult['optimum']): string {
  if (!optimum) return '—';
  const [first, ...tied] = optimum.orders;
  return first!.join(' → ') + (tied.length > 0 ? ` (+${tied.length} tied)` : '');
}

/** A spot-check summary as one sentence, with its sample size. */
function driftLine(d: SpotCheckSummary): string {
  if (d.compared === 0) return `No spot-check compared (${d.checked} taken).`;
  return (
    `Median drift **${savingPct(d.medianDrift)}** (live minus grid, as a share of grid) over ` +
    `**${d.compared}** spot-checks; the live price was at or below the grid's in ` +
    `${d.liveAtOrBelowGrid} of ${d.compared}.` +
    (d.checked > d.compared ? ` ${d.checked - d.compared} found no price to compare.` : '')
  );
}

function render(r: BenchmarkReport): string {
  const out: string[] = [];
  out.push('# Competitor benchmark report');
  out.push('');
  out.push(
    '_Generated by `scripts/benchmark/report.ts` from the frozen [`scenarios.json`](scenarios.json)',
    'and the transcribed CaptureSessions in [`sessions/`](sessions/) — do not edit by hand._',
  );
  out.push('');
  out.push(
    `Every BenchmarkScenario (seed **${file.seed}**) is priced from each session's RecordedFares by`,
    `the shipped \`optimize()\` path, run ${BENCHMARK_SEEDS.length} times with seeds 1–${BENCHMARK_SEEDS.length}, and by`,
    'brute force over every order of the cities between the origin and the end city. Prices are',
    'EUR, price only (ADR-0006).',
  );
  out.push('');
  out.push(
    "Ordering value is the share of a baseline's price the GA median saves. The headline baseline is",
    'the **NaiveOrder**: from the origin, the nearest unvisited city by great-circle distance between',
    'the curated city coordinates, the end city last, ties to the lower IATA code. The mean over every',
    'feasible order is given beside it for context; infeasible orders are left out of it and counted.',
    'A NaiveOrder with a "no fare" leg has no price, so it has no saving.',
  );
  out.push('');

  const sm = r.summary;
  const n = sm.sessions.length;
  out.push('## Protocol');
  out.push('');
  out.push(
    `- **Scenarios:** ${file.scenarios.length} BenchmarkScenarios drawn with seed **${file.seed}** by`,
    '  `drawScenarios`, frozen in [`scenarios.json`](scenarios.json) before any price was seen.',
    `- **CaptureSessions:** ${sm.sessions.join(', ') || 'none'}; each one continuous sitting,`,
    '  run to [`capture-protocol.md`](capture-protocol.md).',
    '- **Airports:** each city is one explicit airport list, identical on Google Flights and Nomad',
    '  ([`capture-protocol.md` § 2](capture-protocol.md#2-airports), `BENCHMARK_AIRPORTS`).',
    '- **Scope:** price only, one-way economy, 1 adult, no checked bags, EUR. Duration and stops are',
    '  not recorded, so the `time` and `comfort` presets are out of scope (ADR-0006).',
    "- **Timing:** the GA's own wall-clock time per `optimize()` call on in-memory RecordedFares;",
    '  provider latency is excluded. The target is < 10 s. Timing is the only figure that differs',
    '  between otherwise identical runs.',
  );
  out.push('');

  out.push(n === 1 ? '## Summary (one session)' : `## Across all ${n} sessions`);
  out.push('');
  out.push(
    'Each scenario\'s figure is the median across sessions. Where a session has no value (a "no fare"',
    'NaiveOrder, an excluded or missing Nomad result) the median is over the sessions that have one,',
    'shown as (sessions/total). A scenario beats Nomad when its median saving against Nomad is ≥ 0;',
    'the win rate counts scenarios with a valid Nomad result in at least one session.',
  );
  out.push('');
  out.push(
    `**Headline:** the GA saves a median **${savingPct(sm.overall.savingVsNaive)}** against the NaiveOrder,`,
    `and matches or beats Kiwi.com Nomad in **${sm.overall.nomad.wins} of ${sm.overall.nomad.compared}**`,
    `scenarios (${pct(sm.overall.nomad.winRate)}). The slowest scenario's median GA time is`,
    `${secs(sm.overall.maxGaMs)}.`,
  );
  out.push('');
  out.push('### Calendar vs live drift');
  out.push('');
  out.push(
    "RecordedFares are the date grid's cached prices. Spot-checks searched a sample of checklist",
    'fares live in the same sitting (capture-protocol § 6). A negative drift means the grid',
    'showed a higher price than the live search.',
  );
  out.push('');
  out.push(driftLine(sm.spotChecks));
  out.push('');
  out.push('### Spec § 2.4 targets');
  out.push('');
  const allMs = r.sessions
    .flatMap((x) => x.scenarios.flatMap((sc) => sc.gaRuns.map((g) => g.ms)))
    .sort((a, b) => a - b);
  const p95 = allMs.length > 0 ? allMs[Math.ceil(0.95 * allMs.length) - 1]! : null;
  const naiveSavings = sm.scenarios.flatMap((x) =>
    x.savingVsNaive.value === null ? [] : [x.savingVsNaive.value],
  );
  const meanNaive =
    naiveSavings.length > 0 ? naiveSavings.reduce((a, b) => a + b, 0) / naiveSavings.length : null;
  const met = (ok: boolean | null) => (ok === null ? '—' : ok ? 'met' : 'not met');
  out.push('| Metric | Target | Measured | Result |');
  out.push('| ------ | ------ | -------- | ------ |');
  out.push(
    `| Route optimisation time | < 10 s, 95th percentile | ${secs(p95)} over ${allMs.length} GA runs | ${met(p95 === null ? null : p95 < 10_000)} |`,
    `| Cost savings | > 15% vs NaiveOrder, average over scenarios | mean ${savingPct(meanNaive)}, median ${savingPct(sm.overall.savingVsNaive)} (${naiveSavings.length} priced scenarios) | ${met(meanNaive === null ? null : meanNaive > 0.15)} |`,
    `| Competitor benchmark | match or beat Nomad in ≥ 60% of scenarios | ${sm.overall.nomad.wins} of ${sm.overall.nomad.compared} (${pct(sm.overall.nomad.winRate)}) | ${met(sm.overall.nomad.winRate === null ? null : sm.overall.nomad.winRate >= 0.6)} |`,
  );
  out.push('');
  out.push(
    'User satisfaction and itinerary generation time are outside this benchmark. The timing figure',
    "is the GA's own time on in-memory fares, without provider latency.",
  );
  out.push('');
  out.push('### Threats to validity, measured');
  out.push('');
  const sampled = audits.reduce((a, b) => a + b.audited, 0);
  const wrong = audits.reduce((a, b) => a + b.mismatches, 0);
  const excluded = r.sessions.reduce((a, s) => a + s.nomad.excluded + s.nomad.missing, 0);
  out.push(
    sampled === 0
      ? '- **Transcription:** no owner audit recorded yet.'
      : `- **Transcription:** the owner's audit of a random 5% found **${wrong} mismatch${wrong === 1 ? '' : 'es'} in ${sampled}** sampled prices (${audits.map((a) => a.date).join(', ')}); error rate ${savingPct(wrong / sampled)}, one-sided 95% upper bound ${savingPct(upperBound95(wrong, sampled))}.` +
          (audits.some((a) => a.audited < a.sampled)
            ? ' Some sampled items are not yet audited.'
            : ''),
    `- **Calendar vs live:** ${driftLine(sm.spotChecks)}`,
    `- **Nomad comparability:** ${excluded} of ${r.sessions.length * file.scenarios.length} scenario captures were excluded or missing (dates or stays differ, or no all-flight result) and are left out of the win rate.`,
    n === 1
      ? '- **One session:** the planned second and third CaptureSessions were not run (ADR-0006 amendment), so these are one market snapshot and stability over time is not measured. Optimality gap, orders evaluated and GA time depend only on the fares, not on the session.'
      : `- **Sessions:** ${n}; each figure is a median across them.`,
  );
  out.push('');
  out.push('### By size');
  out.push('');
  out.push(
    '| Size | Scenarios | vs NaiveOrder | vs mean | Optimality gap | Hit rate | Orders evaluated | Beats Nomad | vs Nomad | GA time | Slowest |',
  );
  out.push(
    '| ---- | --------: | ------------: | ------: | -------------: | -------: | ---------------: | ----------: | -------: | ------: | ------: |',
  );
  for (const g of sm.bySize) out.push(groupRow(g));
  out.push(groupRow(sm.overall));
  out.push('');
  out.push('### By scenario');
  out.push('');
  out.push(
    '| Scenario | Visited | GA median | vs NaiveOrder | vs mean | Optimality gap | Hit rate | Orders evaluated | vs Nomad | Same order as Nomad | GA time |',
  );
  out.push(
    '| -------- | ------: | --------: | ------------: | ------: | -------------: | -------: | ---------------: | -------: | ------------------: | ------: |',
  );
  for (const s of sm.scenarios) {
    const evaluated =
      s.ordersEvaluated.value === null ? '—' : `${s.ordersEvaluated.value} / ${s.totalOrders}`;
    out.push(
      `| ${s.scenarioId} | ${s.visitedCount} | ${across(s.gaMedianCents, n, eur)} | ${across(s.savingVsNaive, n, savingPct)} | ${across(s.savingVsMean, n, savingPct)} | ${across(s.optimalityGap, n, savingPct)} | ${across(s.hitRate, n, pct)} | ${evaluated} | ${across(s.nomadSaving, n, savingPct)} | ${s.nomadOrderMatches}/${s.nomadSaving.sessions} | ${secs(s.gaMs.value)} |`,
    );
  }
  out.push('');

  for (const session of r.sessions) {
    out.push(`## CaptureSession ${session.date}`);
    out.push('');
    out.push(
      '| Scenario | Visited | Orders | Feasible | GA evaluated (median) | Optimum | GA median | Gap | Hit rate | GA time | Optimum order |',
    );
    out.push(
      '| -------- | ------: | -----: | -------: | --------------------: | ------: | --------: | --: | -------: | ------: | ------------- |',
    );
    for (const s of session.scenarios) {
      out.push(
        `| ${s.scenarioId} | ${s.visitedCount} | ${s.totalOrders} | ${s.feasibleOrders} | ${s.ordersEvaluatedMedian} | ${eur(s.optimum?.priceCents ?? null)} | ${eur(s.gaMedianCents)} | ${savingPct(s.optimalityGap)} | ${pct(s.hitRate)} | ${secs(s.gaMsMedian)} | ${optimumOrder(s.optimum)} |`,
      );
    }
    out.push('');
    out.push(`### Ordering value, ${session.date}`);
    out.push('');
    out.push(
      '| Scenario | NaiveOrder | Naive price | GA saves vs naive | Mean (feasible / all) | GA saves vs mean |',
    );
    out.push(
      '| -------- | ---------- | ----------: | ----------------: | --------------------: | ---------------: |',
    );
    for (const s of session.scenarios) {
      const naivePrice = s.naive.priceCents === null ? 'no fare' : eur(s.naive.priceCents);
      const mean =
        s.meanCents === null
          ? '—'
          : `${eur(Math.round(s.meanCents))} (${s.feasibleOrders} / ${s.totalOrders})`;
      out.push(
        `| ${s.scenarioId} | ${s.naive.order.join(' → ')} | ${naivePrice} | ${savingPct(s.savingVsNaive)} | ${mean} | ${savingPct(s.savingVsMean)} |`,
      );
    }
    out.push('');

    out.push(`### Spot-checks, ${session.date}`);
    out.push('');
    out.push(driftLine(session.spotChecks));
    out.push('');
    if (session.spotChecks.rows.length > 0) {
      out.push('| Item | Fare | Grid | Live | Drift |');
      out.push('| ---- | ---- | ---: | ---: | ----: |');
      for (const r of session.spotChecks.rows) {
        out.push(
          `| ${r.item ?? '—'} | ${r.origin} → ${r.destination} ${r.date} | ${eur(r.gridCents)} | ${eur(r.liveCents)} | ${savingPct(r.drift)} |`,
        );
      }
      out.push('');
    }

    const n = session.nomad;
    out.push(`### Versus Kiwi.com Nomad, ${session.date}`);
    out.push('');
    out.push(
      `GA median at or below Nomad's cheapest all-flight price in **${n.wins} of ${n.valid}** valid`,
      `results (win rate ${pct(n.winRate)}); median saving **${savingPct(n.medianSaving)}**. Nomad flew the`,
      `GA's order in ${n.orderMatches} of ${n.valid}. Excluded (dates or stays differ, or no all-flight`,
      `result): ${n.excluded}. Missing: ${n.missing}.`,
    );
    out.push('');
    out.push(
      '| Scenario | Status | Nomad all-flight | GA median | GA saves | Same order | Nomad order | Any-mode (context) |',
    );
    out.push(
      '| -------- | ------ | ---------------: | --------: | -------: | ---------- | ----------- | ------------------ |',
    );
    for (const s of session.scenarios) {
      const c = s.competitor;
      const status = c.status === 'invalid' ? `invalid: ${c.problems.join('; ')}` : c.status;
      const same = c.orderMatchesGa === null ? '—' : c.orderMatchesGa ? 'yes' : 'no';
      const anyMode = c.anyMode
        ? `${eur(c.anyMode.priceCents)} (${[...new Set(c.anyMode.modes)].join(', ')})`
        : '—';
      out.push(
        `| ${s.scenarioId} | ${status} | ${eur(c.priceCents)} | ${eur(s.gaMedianCents)} | ${savingPct(c.saving)} | ${same} | ${c.order?.join(' → ') ?? '—'} | ${anyMode} |`,
      );
    }
    out.push('');
  }
  return out.join('\n');
}

const md = await prettier.format(render(report), {
  ...(await prettier.resolveConfig(outPath)),
  parser: 'markdown',
});
writeFileSync(outPath, md);
console.log(
  `Wrote ${path.relative(process.cwd(), outPath)}: ${report.sessions.length} session(s), ` +
    `${file.scenarios.length} scenarios.`,
);
