import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/core/config.js';
import { trendQualityScore, marketCapacity, saturationProbability } from '../src/core/engines/trend.js';
import { opportunityHalfLife } from '../src/core/engines/halflife.js';
import { buildFingerprint, similarityScore, qualifiesAsWinner } from '../src/core/engines/winnersDna.js';
import { codFinancials } from '../src/core/engines/financial.js';
import { explainDecision } from '../src/core/engines/explain.js';

const cfg = DEFAULT_CONFIG;

test('trend: sustained growth scores higher than isolated spike', () => {
  const sustained = trendQualityScore([40, 46, 52, 58, 66, 73, 81, 90, 99, 110, 121, 133, 146, 160], cfg);
  const spike = trendQualityScore([20, 18, 22, 19, 21, 230, 25, 20, 18, 22, 19, 21, 20, 23], cfg);
  assert.ok(sustained.score > spike.score, `sustained ${sustained.score} > spike ${spike.score}`);
  assert.equal(spike.components.isolatedSpike, true);
});

test('trend: insufficient data flagged', () => {
  const r = trendQualityScore([10, 12], cfg);
  assert.equal(r.components.insufficientData, true);
});

test('market capacity: young growing product has higher capacity than old flat one', () => {
  const young = marketCapacity([10, 20, 35, 55, 80], 5, cfg);
  const oldFlat = marketCapacity([100, 101, 100, 99, 100, 100, 100, 100], 60, cfg);
  const order = { High: 3, Medium: 2, Low: 1 };
  assert.ok(order[young.label] >= order[oldFlat.label]);
});

test('saturation probability in [0,1]', () => {
  const s = saturationProbability([10, 20, 30, 40, 50], 10, cfg);
  assert.ok(s >= 0 && s <= 1);
});

test('half-life: declining product has short window', () => {
  const decl = opportunityHalfLife([200, 180, 160, 140, 120, 100, 85, 72], 30, 0.7, cfg);
  const grow = opportunityHalfLife([40, 46, 52, 58, 66, 73, 81, 90], 8, 0.2, cfg);
  assert.ok(decl.days < grow.days, `decline ${decl.days} < growth ${grow.days}`);
  assert.match(grow.label, /Days$/);
});

test('winners DNA: fingerprint + similarity', () => {
  const winners = [
    { badge: 'Health', priceUsd: 20, marginPct: 0.6 },
    { badge: 'Health', priceUsd: 22, marginPct: 0.55 },
    { badge: 'Health', priceUsd: 18, marginPct: 0.58 },
  ];
  const fp = buildFingerprint(winners, cfg);
  assert.ok(fp.categoryShare.Health > 0.9);

  const close = similarityScore({ badge: 'Health', priceUsd: 20, marginPct: 0.58 }, fp, cfg);
  const far = similarityScore({ badge: 'Toys', priceUsd: 200, marginPct: 0.02 }, fp, cfg);
  assert.ok(close.score > 70, `close ${close.score}`);
  assert.ok(far.score < close.score);
  assert.equal(similarityScore({}, null, cfg).score, 0);
});

test('qualifiesAsWinner needs sustained days above threshold', () => {
  assert.equal(qualifiesAsWinner([85, 82, 88, 90, 91, 84, 86], cfg), true);
  assert.equal(qualifiesAsWinner([85, 82, 88], cfg), false);
  assert.equal(qualifiesAsWinner([50, 55, 60, 62, 70, 65, 68], cfg), false);
});

test('COD financials: delivery rate and risk affect max CPA', () => {
  const product = { marginUsd: 12 };
  const lowRisk = codFinancials(product, { deliveryRate: 0.7, riskTier: 'low' }, cfg);
  const highRisk = codFinancials(product, { deliveryRate: 0.7, riskTier: 'high' }, cfg);
  assert.ok(lowRisk.maxAllowedCpa > highRisk.maxAllowedCpa);
  assert.ok(lowRisk.effectiveCpa > 0);
  assert.equal(typeof lowRisk.profitable, 'boolean');

  const unprofitable = codFinancials({ marginUsd: 1 }, { deliveryRate: 0.4, returnShippingPenalty: 8, targetCpa: 5 }, cfg);
  assert.equal(unprofitable.profitable, false);
});

test('explainability produces signed reasoning', () => {
  const { reasoning, factors } = explainDecision({
    trendQuality: 85,
    marketCapacity: 'High',
    saturationPct: 20,
    halfLifeDays: 16,
    similarity: 80,
    marginPct: 0.5,
    riskTier: 'high',
    profitable: true,
    isolatedSpike: false,
  }, cfg);
  assert.match(reasoning, /Strong Sales Momentum/);
  assert.match(reasoning, /Low Competition Growth/);
  assert.match(reasoning, /High Delivery Risk/);
  assert.ok(factors.some((f) => f.sign === '+'));
  assert.ok(factors.some((f) => f.sign === '-'));
});
