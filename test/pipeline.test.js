import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../src/core/pipeline.js';
import { multiDayRecords } from './fixtures/generate.js';

test('pipeline produces radar, watchlist and winners DNA', () => {
  const out = runPipeline(multiDayRecords(), {});
  assert.equal(out.products.length, 4);
  assert.ok(Array.isArray(out.opportunityRadar));
  assert.ok(out.opportunityRadar.length <= 10);

  // Every product has the full decision payload.
  for (const p of out.products) {
    assert.equal(typeof p.launchConfidence, 'number');
    assert.equal(typeof p.urgency, 'number');
    assert.equal(typeof p.reasoning, 'string');
    assert.ok(p.reasoning.length > 0);
    assert.ok(['Low', 'Medium', 'High'].includes(p.marketCapacity));
    assert.ok(p.financial);
  }
});

test('pipeline ranks sustained grower above the isolated spike', () => {
  const out = runPipeline(multiDayRecords(), {});
  const grower = out.products.find((p) => p.url === 'u/winner-1');
  const spike = out.products.find((p) => p.url === 'u/spike-1');
  assert.ok(grower.trendQuality > spike.trendQuality);
  assert.ok(grower.launchConfidence >= spike.launchConfidence);
});

test('budget allocation across radar sums to ~100', () => {
  const out = runPipeline(multiDayRecords(), {});
  const total = out.opportunityRadar.reduce((a, r) => a + (r.budgetAllocationPct || 0), 0);
  if (out.opportunityRadar.length > 0) {
    assert.ok(Math.abs(total - 100) <= 2, `allocation total ${total}`);
  }
});

test('confidence history is returned for persistence and grows', () => {
  const first = runPipeline(multiDayRecords(), {});
  const hist = first.updatedConfidenceHistory;
  assert.ok(hist['u/winner-1'].length >= 1);

  // Feeding history back in keeps accumulating (capped).
  const second = runPipeline(multiDayRecords(), { confidenceHistoryByUrl: hist });
  assert.ok(second.updatedConfidenceHistory['u/winner-1'].length > hist['u/winner-1'].length - 1);
});

test('config overrides change FX and thus margins', () => {
  const high = runPipeline(multiDayRecords(), { configOverrides: { fxUsdToLyd: 4.85 } });
  const low = runPipeline(multiDayRecords(), { configOverrides: { fxUsdToLyd: 9.7 } });
  const hP = high.products.find((p) => p.url === 'u/winner-1');
  const lP = low.products.find((p) => p.url === 'u/winner-1');
  // Higher LYD-per-USD => fewer USD per price => smaller margin.
  assert.ok(hP.marginUsd > lP.marginUsd);
});
