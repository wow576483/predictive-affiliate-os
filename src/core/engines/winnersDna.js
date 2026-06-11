/**
 * Engine 3 — Winners DNA & Similarity (statistical, not ML).
 *
 * Builds a "winning fingerprint" from products that sustained a high
 * confidence score for several days, using simple aggregates (dominant
 * categories, optimal price band, average margin). New products are then
 * scored 0-100 by weighted closeness to that fingerprint.
 */

import { mean, stddev, clamp, finiteNumbers } from '../stats.js';

/**
 * A product qualifies as a "winner" if its confidence history holds at or
 * above the threshold for at least minSustainedDays days.
 * @param {Array<number>} confidenceHistory recent daily confidence values.
 */
export function qualifiesAsWinner(confidenceHistory, config) {
  const hist = finiteNumbers(confidenceHistory || []);
  const { confidenceThreshold, minSustainedDays } = config.winnersDna;
  const daysAtOrAbove = hist.filter((c) => c >= confidenceThreshold).length;
  return daysAtOrAbove >= minSustainedDays;
}

/**
 * Build the winning fingerprint from qualified winner products.
 * @param {Array<{badge:string, priceUsd:number, marginPct:number}>} winners
 * @returns {object|null} fingerprint, or null when no winners yet.
 */
export function buildFingerprint(winners, _config) {
  const valid = (winners || []).filter((w) => w);
  if (valid.length === 0) return null;

  // Category distribution (share per badge).
  const catCounts = new Map();
  for (const w of valid) {
    const key = (w.badge || 'Unknown').trim() || 'Unknown';
    catCounts.set(key, (catCounts.get(key) || 0) + 1);
  }
  const categoryShare = {};
  for (const [k, v] of catCounts) categoryShare[k] = v / valid.length;

  const prices = finiteNumbers(valid.map((w) => w.priceUsd));
  const margins = finiteNumbers(valid.map((w) => w.marginPct));

  const priceMean = mean(prices);
  const priceStd = stddev(prices);
  const marginMean = mean(margins);
  const marginStd = stddev(margins);

  return {
    sampleSize: valid.length,
    categoryShare,
    price: {
      mean: priceMean,
      std: priceStd,
      low: Math.max(0, priceMean - priceStd),
      high: priceMean + priceStd,
    },
    margin: { mean: marginMean, std: marginStd },
  };
}

function gaussianCloseness(value, center, spread) {
  if (value === null || !Number.isFinite(value)) return 0;
  const s = spread && spread > 1e-6 ? spread : Math.max(1e-6, Math.abs(center) * 0.25 || 1);
  const d = (value - center) / s;
  return Math.exp(-0.5 * d * d); // 1 at center, decays with distance
}

/**
 * Similarity of a product to the fingerprint, 0-100.
 * Weighted blend of category match, price closeness and margin closeness.
 */
export function similarityScore(product, fingerprint, config) {
  if (!fingerprint) return { score: 0, components: { noFingerprint: true } };
  const w = config.winnersDna.weights;

  const cat = (product.badge || 'Unknown').trim() || 'Unknown';
  const categoryMatch = fingerprint.categoryShare[cat] !== undefined
    ? clamp(0.5 + fingerprint.categoryShare[cat] * 0.5, 0, 1)
    : 0;

  const priceMatch = gaussianCloseness(product.priceUsd, fingerprint.price.mean, fingerprint.price.std);
  const marginMatch = gaussianCloseness(product.marginPct, fingerprint.margin.mean, fingerprint.margin.std);

  const blended = w.category * categoryMatch + w.price * priceMatch + w.margin * marginMatch;
  const score = Math.round(clamp(blended * 100, 0, 100));
  return {
    score,
    components: {
      categoryMatch: Number(categoryMatch.toFixed(2)),
      priceMatch: Number(priceMatch.toFixed(2)),
      marginMatch: Number(marginMatch.toFixed(2)),
    },
  };
}
