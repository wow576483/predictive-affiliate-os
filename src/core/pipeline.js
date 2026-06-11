/**
 * Orchestration pipeline. Pure function: raw records in, decision tables out.
 *
 * Flow:
 *   records -> time series -> per-product engines -> winners DNA / similarity
 *   -> composite confidence -> Opportunity Radar / Watchlist / Winners DNA.
 *
 * Similarity feeds confidence, and confidence determines winners, so we break
 * the feedback loop by qualifying winners on a similarity-free "base"
 * confidence, then computing final confidence with similarity added.
 */

import { resolveConfig } from './config.js';
import { buildTimeSeries, computeMargin } from './timeseries.js';
import { trendQualityScore, marketCapacity } from './engines/trend.js';
import { opportunityHalfLife } from './engines/halflife.js';
import {
  qualifiesAsWinner,
  buildFingerprint,
  similarityScore,
} from './engines/winnersDna.js';
import { codFinancials } from './engines/financial.js';
import { explainDecision } from './engines/explain.js';
import {
  marginScore,
  capacityScore,
  launchConfidence,
  urgencyScore,
  allocateBudget,
  recommendedAction,
} from './engines/confidence.js';
import { clamp } from './stats.js';

function baseConfidence(trendQuality, marginPct, capacityLabel, config) {
  const w = config.confidenceWeights;
  const denom = w.trendQuality + w.margin + w.marketCapacity;
  const score = (w.trendQuality * trendQuality
    + w.margin * marginScore(marginPct)
    + w.marketCapacity * capacityScore(capacityLabel)) / denom;
  return Math.round(clamp(score, 0, 100));
}

/**
 * @param {Array<object>} records normalized daily records (multi-day).
 * @param {object} opts {
 *   configOverrides, financial (global), financialByUrl, riskByUrl,
 *   confidenceHistoryByUrl (persisted: url -> [daily base confidence])
 * }
 */
export function runPipeline(records, opts = {}) {
  const config = resolveConfig(opts.configOverrides || {});
  const fx = config.fxUsdToLyd;
  const products = buildTimeSeries(records);
  const histIn = opts.confidenceHistoryByUrl || {};
  const updatedHistory = {};

  // ---- Pass 1: per-product engines + base confidence --------------------
  const enriched = products.map((p) => {
    const margin = computeMargin(p, fx);
    const tq = trendQualityScore(p.quantities, config);
    const cap = marketCapacity(p.quantities, p.daysInMarket, config);
    const half = opportunityHalfLife(p.quantities, p.daysInMarket, cap.saturation, config);
    const base = baseConfidence(tq.score, margin.marginPct, cap.label, config);

    const priorHist = Array.isArray(histIn[p.url]) ? histIn[p.url] : [];
    const newHist = [...priorHist, base].slice(-Math.max(config.winnersDna.minSustainedDays * 2, 14));
    updatedHistory[p.url] = newHist;

    return { product: p, margin, tq, cap, half, base, history: newHist };
  });

  // ---- Winners DNA fingerprint ------------------------------------------
  const winners = enriched
    .filter((e) => {
      const byHistory = qualifiesAsWinner(e.history, config);
      const byProxy = e.product.series.length >= config.winnersDna.minSustainedDays
        && e.base >= config.winnersDna.confidenceThreshold;
      return byHistory || byProxy;
    })
    .map((e) => ({ badge: e.product.badge, priceUsd: e.margin.priceUsd, marginPct: e.margin.marginPct }));
  const fingerprint = buildFingerprint(winners, config);

  // ---- Pass 2: similarity, financials, final confidence, explainability -
  const results = enriched.map((e) => {
    const { product: p, margin, tq, cap, half } = e;
    const sim = similarityScore(
      { badge: p.badge, priceUsd: margin.priceUsd, marginPct: margin.marginPct },
      fingerprint,
      config,
    );

    const riskTier = (opts.riskByUrl && opts.riskByUrl[p.url]) || config.financial.defaultRiskTier;
    const finOverrides = { ...(opts.financial || {}), ...((opts.financialByUrl || {})[p.url] || {}), riskTier };
    const fin = codFinancials({ marginUsd: margin.marginUsd }, finOverrides, config);

    const confidence = launchConfidence(
      { trendQuality: tq.score, marginPct: margin.marginPct, capacityLabel: cap.label, similarity: sim.score },
      config,
    );
    const urgency = urgencyScore(half.days, tq.score);

    const explanation = explainDecision(
      {
        trendQuality: tq.score,
        marketCapacity: cap.label,
        saturationPct: cap.saturationPct,
        halfLifeDays: half.days,
        similarity: sim.score,
        marginPct: margin.marginPct,
        riskTier,
        profitable: fin.profitable,
        isolatedSpike: tq.components.isolatedSpike,
      },
      config,
    );

    return {
      url: p.url,
      productName: p.productName,
      badge: p.badge,
      daysInMarket: p.daysInMarket,
      latestQuantity: p.quantities[p.quantities.length - 1] ?? null,
      costUsd: margin && p.latestCostUsd,
      priceLyd: p.latestPriceLyd,
      priceUsd: round2(margin.priceUsd),
      marginUsd: round2(margin.marginUsd),
      marginPct: margin.marginPct === null ? null : Math.round(margin.marginPct * 100) / 100,
      trendQuality: tq.score,
      marketCapacity: cap.label,
      saturationPct: cap.saturationPct,
      halfLifeDays: half.days,
      halfLifeLabel: half.label,
      similarity: sim.score,
      launchConfidence: confidence,
      urgency,
      financial: fin,
      recommendedAction: recommendedAction({ launchConfidence: confidence, urgency, profitable: fin.profitable }),
      reasoning: explanation.reasoning,
      _debug: { trend: tq.components, similarity: sim.components },
    };
  });

  // ---- Opportunity Radar (top N) ----------------------------------------
  const ranked = [...results]
    .filter((r) => r.financial.profitable !== false)
    .sort((a, b) => (b.launchConfidence - a.launchConfidence) || (b.urgency - a.urgency));
  const radar = ranked.slice(0, config.radar.topN);
  const allocations = allocateBudget(radar);
  radar.forEach((r, i) => { r.budgetAllocationPct = allocations[i]; });

  // ---- Watchlist --------------------------------------------------------
  const radarUrls = new Set(radar.map((r) => r.url));
  const { minConfidence, minSaturation, minHalfLifeDays } = config.watchlist;
  const watchlist = results.filter((r) => !radarUrls.has(r.url)
    && r.launchConfidence > minConfidence
    && r.saturationPct > minSaturation
    && r.halfLifeDays > minHalfLifeDays);

  return {
    config,
    products: results,
    opportunityRadar: radar,
    watchlist,
    winnersDna: {
      fingerprint,
      winnerCount: winners.length,
    },
    updatedConfidenceHistory: updatedHistory,
  };
}

function round2(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
