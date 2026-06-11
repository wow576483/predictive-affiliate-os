/**
 * Composite scoring: Launch Confidence, Urgency, and portfolio budget
 * allocation. All weighted blends of the underlying engine outputs.
 */

import { clamp, scaleLinear } from '../stats.js';

/** Map margin fraction to a 0-100 score (0% -> 0, 60%+ -> 100). */
export function marginScore(marginPct) {
  if (!Number.isFinite(marginPct)) return 0;
  return Math.round(scaleLinear(marginPct, 0, 0.6, 0, 100));
}

/** Map Low/Medium/High capacity to a 0-100 score. */
export function capacityScore(label) {
  return { High: 100, Medium: 60, Low: 25 }[label] ?? 50;
}

/**
 * Launch Confidence Score (0-100): weighted blend of the four pillars.
 */
export function launchConfidence({ trendQuality, marginPct, capacityLabel, similarity }, config) {
  const w = config.confidenceWeights;
  const score = w.trendQuality * trendQuality
    + w.margin * marginScore(marginPct)
    + w.marketCapacity * capacityScore(capacityLabel)
    + w.similarity * similarity;
  return Math.round(clamp(score, 0, 100));
}

/**
 * Urgency Score (0-100): rises as the entry window closes, amplified by
 * strong momentum (a closing window on a strong product is most urgent).
 */
export function urgencyScore(halfLifeDays, trendQuality) {
  const windowUrgency = scaleLinear(halfLifeDays, 30, 1, 15, 100); // fewer days -> higher
  const momentumBoost = scaleLinear(trendQuality, 0, 100, 0.6, 1.2);
  return Math.round(clamp(windowUrgency * momentumBoost, 0, 100));
}

/**
 * Allocate budget percentages across the selected opportunities,
 * proportional to confidence^1.5 (mild concentration on the best bets).
 */
export function allocateBudget(opportunities) {
  const weights = opportunities.map((o) => Math.pow(Math.max(0, o.launchConfidence), 1.5));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const even = opportunities.length ? Math.round(100 / opportunities.length) : 0;
    return opportunities.map(() => even);
  }
  return weights.map((w) => Math.round((w / total) * 100));
}

/** Recommended action from confidence + urgency + financial profitability. */
export function recommendedAction({ launchConfidence: lc, urgency, profitable }) {
  if (!profitable) return 'Avoid — Unprofitable';
  if (lc >= 75 && urgency >= 60) return 'Launch Now';
  if (lc >= 75) return 'Launch';
  if (lc >= 60) return 'Test Small Budget';
  if (lc >= 45) return 'Watch';
  return 'Skip';
}
