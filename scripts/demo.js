/**
 * Quick end-to-end demo of the backend on synthetic data.
 * Run: npm run demo
 */
import { parseDailyTab } from '../src/core/parser.js';
import { runPipeline } from '../src/core/pipeline.js';
import { RAW_DAILY_TAB } from '../test/fixtures/sampleDailyTab.js';
import { multiDayRecords } from '../test/fixtures/generate.js';

console.log('=== 1) Mb-0 Parser on a raw daily tab ===');
const parsed = parseDailyTab(RAW_DAILY_TAB, { date: '2026-06-09' });
console.table(parsed);

console.log('\n=== 2) Full pipeline on multi-day data ===');
const out = runPipeline(multiDayRecords(), {});

console.log('\n-- Opportunity Radar --');
console.table(out.opportunityRadar.map((r) => ({
  Product: r.productName,
  Confidence: r.launchConfidence,
  Urgency: r.urgency,
  Capacity: r.marketCapacity,
  'Budget%': r.budgetAllocationPct,
  Action: r.recommendedAction,
  'Half-Life': r.halfLifeLabel,
})));

console.log('\n-- Reasoning (Explainability Engine) --');
for (const r of out.opportunityRadar) {
  console.log(`${r.productName}: ${r.reasoning}`);
}

console.log('\n-- Watchlist --');
console.table(out.watchlist.map((r) => ({ Product: r.productName, Confidence: r.launchConfidence, Saturation: r.saturationPct, 'Half-Life': r.halfLifeLabel })));

console.log('\n-- Winners DNA fingerprint --');
console.dir(out.winnersDna, { depth: 4 });
