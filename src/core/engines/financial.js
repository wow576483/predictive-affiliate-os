/**
 * Engine 4 — COD Financial Engine.
 *
 * Cash-on-Delivery economics: only delivered orders earn margin, but every
 * order (including returns) can incur reverse-shipping cost. Computes:
 *  - Effective CPA          : ad spend per DELIVERED order
 *  - Return Penalty Burden  : expected reverse-shipping cost per order
 *  - Expected Net Profit    : per-order profit after delivery + penalty + CPA
 *  - Max Allowed CPA        : highest CPA keeping profit >= 0, adjusted by
 *                             the delivery-risk tier of the target region.
 */

import { clamp } from '../stats.js';

/**
 * @param {object} product must expose marginUsd (USD margin per delivered sale).
 * @param {object} opts overrides: { deliveryRate, returnShippingPenalty, targetCpa, riskTier, adSpend, orders }
 */
export function codFinancials(product, opts, config) {
  const f = config.financial;
  const deliveryRate = clamp(opts.deliveryRate ?? f.deliveryRate, 0, 1);
  const returnPenalty = opts.returnShippingPenalty ?? f.returnShippingPenalty;
  const targetCpa = opts.targetCpa ?? f.targetCpa;
  const riskTier = opts.riskTier ?? f.defaultRiskTier;
  const riskMultiplier = f.riskRegions[riskTier] ?? f.riskRegions[f.defaultRiskTier];

  const marginUsd = product.marginUsd ?? 0;

  // Effective CPA: spend per delivered order. If actual spend/orders provided,
  // use them; otherwise fall back to target CPA grossed up by delivery rate.
  let effectiveCpa;
  if (Number.isFinite(opts.adSpend) && Number.isFinite(opts.orders) && opts.orders > 0) {
    const delivered = Math.max(1e-9, opts.orders * deliveryRate);
    effectiveCpa = opts.adSpend / delivered;
  } else {
    effectiveCpa = deliveryRate > 0 ? targetCpa / deliveryRate : Infinity;
  }

  // Reverse-shipping burden spread across all orders (returns pay the penalty).
  const returnRate = 1 - deliveryRate;
  const returnPenaltyBurden = returnRate * returnPenalty;

  // Expected net profit per ORDER attempted (the unit you pay CPA on).
  const expectedRevenue = deliveryRate * marginUsd;
  const cpaPerOrder = Number.isFinite(opts.adSpend) && Number.isFinite(opts.orders) && opts.orders > 0
    ? opts.adSpend / opts.orders
    : targetCpa;
  const expectedNetProfit = expectedRevenue - returnPenaltyBurden - cpaPerOrder;

  // Max Allowed CPA (per delivered order) keeping per-order profit >= 0,
  // then scaled down by region delivery-risk multiplier.
  const breakevenCpaPerOrder = expectedRevenue - returnPenaltyBurden;
  const breakevenCpaPerDelivered = deliveryRate > 0 ? breakevenCpaPerOrder / deliveryRate : 0;
  const maxAllowedCpa = Math.max(0, breakevenCpaPerDelivered) * riskMultiplier;

  return {
    deliveryRate,
    returnRate: Number(returnRate.toFixed(3)),
    riskTier,
    riskMultiplier,
    effectiveCpa: round2(effectiveCpa),
    returnPenaltyBurden: round2(returnPenaltyBurden),
    expectedNetProfit: round2(expectedNetProfit),
    maxAllowedCpa: round2(maxAllowedCpa),
    profitable: expectedNetProfit > 0,
  };
}

function round2(n) {
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
