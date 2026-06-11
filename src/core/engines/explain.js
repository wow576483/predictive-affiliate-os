/**
 * Engine 5 — Decision Explainability Engine (critical).
 *
 * Turns the numeric signals from the other engines into a human-readable
 * reasoning string of `+`/`-` factors, e.g.:
 *   "+ Strong Sales Momentum | + Low Competition Growth | - High Delivery Risk"
 */

/**
 * @param {object} signals {trendQuality, marketCapacity, saturationPct,
 *   halfLifeDays, similarity, marginPct, riskTier, profitable, isolatedSpike}
 * @returns {{reasoning:string, factors:Array<{sign:string,text:string}>}}
 */
export function explainDecision(signals, config) {
  const e = config.explain;
  const factors = [];
  const add = (sign, text) => factors.push({ sign, text });

  // Sales momentum / trend quality
  if (signals.trendQuality >= e.strongMomentum) add('+', 'Strong Sales Momentum');
  else if (signals.trendQuality <= e.weakMomentum) add('-', 'Weak/Unstable Demand');

  // Fake trend warning
  if (signals.isolatedSpike) add('-', 'Isolated Spike (Possible Fake Trend)');

  // Competition / market capacity
  if (signals.marketCapacity === e.lowCompetitionCapacity) add('+', 'Low Competition Growth');
  else if (signals.marketCapacity === 'Low') add('-', 'Market Near Saturation');

  // Opportunity window
  if (Number.isFinite(signals.halfLifeDays)) {
    if (signals.halfLifeDays <= 5) add('-', 'Closing Entry Window');
    else if (signals.halfLifeDays >= 14) add('+', 'Wide Entry Window');
  }

  // Similarity to winners
  if (signals.similarity >= e.goodSimilarity) add('+', 'Matches Winning DNA');

  // Margin health
  if (Number.isFinite(signals.marginPct)) {
    if (signals.marginPct >= e.healthyMarginPct) add('+', 'Healthy Profit Margin');
    else if (signals.marginPct <= e.thinMarginPct) add('-', 'Thin Margin');
  }

  // Delivery risk / profitability
  if (signals.riskTier === e.highDeliveryRiskTier) add('-', 'High Delivery Risk');
  if (signals.profitable === false) add('-', 'Negative Expected Profit');

  if (factors.length === 0) add('~', 'Neutral — Insufficient Signal');

  const reasoning = factors.map((f) => `${f.sign} ${f.text}`).join(' | ');
  return { reasoning, factors };
}
