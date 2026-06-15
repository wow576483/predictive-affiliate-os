/**
 * Central configuration. Every tunable lives here so the Apps Script layer
 * (and the Financial Calculator sheet) can override values without touching
 * engine logic. All weights, thresholds and financial defaults are explicit.
 */

export const DEFAULT_CONFIG = {
  // --- Currency -----------------------------------------------------------
  // Cost is scraped in USD, market price in LYD. Margin needs a conversion
  // rate. Configurable; user picks official vs parallel rate.
  fxUsdToLyd: 8.75,

  // --- Trend / history windows -------------------------------------------
  trend: {
    minDays: 3, // minimum history before a score is trusted
    shortWindow: 7,
    longWindow: 14,
    // A single isolated spike with z-score above this is treated as a fake
    // trend signal and penalizes the quality score.
    spikeZThreshold: 2.0,
  },

  // --- Market capacity / saturation --------------------------------------
  capacity: {
    // Days in market beyond which saturation pressure grows.
    matureDays: 21,
    // Saturation probability thresholds for Low/Medium/High capacity output.
    highCapacityMaxSaturation: 0.34,
    mediumCapacityMaxSaturation: 0.67,
  },

  // --- Opportunity half-life ---------------------------------------------
  halfLife: {
    maxDays: 30, // cap reported window
    minDays: 1,
  },

  // --- Winners DNA --------------------------------------------------------
  winnersDna: {
    confidenceThreshold: 80, // confidence to qualify as a "winner"
    minSustainedDays: 7, // must hold the threshold this many days
    weights: { category: 0.4, price: 0.35, margin: 0.25 },
  },

  // --- COD financial defaults (editable per product in Sheet 3) ----------
  financial: {
    deliveryRate: 0.62, // share of orders actually delivered (COD reality)
    returnShippingPenalty: 6.0, // USD cost burden per returned order
    targetCpa: 4.0, // USD target cost per acquisition (delivered)
    // Delivery-risk multipliers applied to Max Allowed CPA by region tier.
    riskRegions: {
      low: 1.0,
      medium: 0.85,
      high: 0.65,
    },
    defaultRiskTier: 'medium',
  },

  // --- Composite Launch Confidence weights -------------------------------
  confidenceWeights: {
    trendQuality: 0.35,
    margin: 0.25,
    marketCapacity: 0.2,
    similarity: 0.2,
  },

  // --- Watchlist activation rule -----------------------------------------
  watchlist: {
    minConfidence: 60,
    minSaturation: 50, // saturation percentage (0-100)
    minHalfLifeDays: 7,
  },

  // --- Opportunity Radar --------------------------------------------------
  radar: {
    topN: 10,
  },

  // --- Explainability thresholds (drive +/- reasoning bullets) -----------
  explain: {
    strongMomentum: 70,
    weakMomentum: 35,
    lowCompetitionCapacity: 'High',
    highDeliveryRiskTier: 'high',
    goodSimilarity: 70,
    healthyMarginPct: 0.4,
    thinMarginPct: 0.15,
  },
};

/** Deep-merge an override object onto the default config (1 level deep on objects). */
export function resolveConfig(overrides = {}) {
  const out = { ...DEFAULT_CONFIG };
  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object') {
      out[key] = { ...out[key], ...value };
    } else {
      out[key] = value;
    }
  }
  return out;
}
