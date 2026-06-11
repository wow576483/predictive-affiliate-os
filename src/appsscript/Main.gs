/**
 * Entry points for the Predictive Affiliate OS (backend orchestration).
 *
 * STEP 1 scope: read raw daily tabs -> parse -> run statistical engines ->
 * write decision tables back into the sheet, and persist state.
 * Visual UI styling (STEP 2) is intentionally minimal here.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Affiliate OS')
    .addItem('Run Analysis', 'runAnalysis')
    .addItem('Seed Demo Tabs', 'seedDemoTabs')
    .addToUi();
}

/**
 * Main pipeline run. Reads all daily tabs, computes, and writes outputs.
 */
function runAnalysis() {
  var records = readAllRecords_();
  if (!records.length) {
    SpreadsheetApp.getActiveSpreadsheet().toast('No daily tabs (YYYY-MM-DD) found.', 'Affiliate OS', 6);
    return;
  }

  var state = loadState_();
  var configOverrides = loadConfigOverrides_();
  var fin = loadFinancialOverrides_();

  var out = AffiliateOSCore.runPipeline(records, {
    configOverrides: configOverrides,
    confidenceHistoryByUrl: state.confidenceHistoryByUrl || {},
    financialByUrl: fin.financialByUrl,
    riskByUrl: fin.riskByUrl,
  });

  writeRadar_(out.opportunityRadar);
  writeWatchlist_(out.watchlist);
  writeWinnersDna_(out.winnersDna);
  writeTimeseries_(out.products);
  ensureCalculatorSheet_(out.products);

  saveState_({
    confidenceHistoryByUrl: out.updatedConfidenceHistory,
    fingerprint: out.winnersDna.fingerprint,
    lastRun: new Date().toISOString(),
  });

  SpreadsheetApp.getActiveSpreadsheet().toast('Analysis complete: ' + out.products.length + ' products.', 'Affiliate OS', 5);
}

// ---- Writers (data only; formatting is STEP 2) --------------------------

function writeRadar_(radar) {
  var header = ['Product Name', 'Launch Confidence Score', 'Urgency Score', 'Market Capacity',
    'Budget Allocation %', 'Recommended Action', 'Decision Explanation (Reasoning)'];
  var rows = radar.map(function (r) {
    return [r.productName, r.launchConfidence, r.urgency, r.marketCapacity,
      r.budgetAllocationPct, r.recommendedAction, r.reasoning];
  });
  writeTable_(SHEETS.RADAR, header, rows);
}

function writeWatchlist_(watchlist) {
  var header = ['Product Name', 'Confidence', 'Saturation %', 'Half-Life', 'Market Capacity', 'Reasoning'];
  var rows = watchlist.map(function (r) {
    return [r.productName, r.launchConfidence, r.saturationPct, r.halfLifeLabel, r.marketCapacity, r.reasoning];
  });
  writeTable_(SHEETS.WATCHLIST, header, rows);
}

function writeWinnersDna_(dna) {
  var fp = dna.fingerprint;
  var header = ['Metric', 'Value'];
  var rows = [['Winner Count', dna.winnerCount]];
  if (fp) {
    rows.push(['Optimal Price (USD) mean', round2_(fp.price.mean)]);
    rows.push(['Optimal Price Band (USD)', round2_(fp.price.low) + ' - ' + round2_(fp.price.high)]);
    rows.push(['Average Margin %', Math.round((fp.margin.mean || 0) * 100)]);
    var cats = Object.keys(fp.categoryShare || {});
    for (var i = 0; i < cats.length; i++) {
      rows.push(['Category Share: ' + cats[i], Math.round(fp.categoryShare[cats[i]] * 100) + '%']);
    }
  } else {
    rows.push(['Fingerprint', 'Not enough sustained winners yet']);
  }
  writeTable_(SHEETS.WINNERS, header, rows);
}

function writeTimeseries_(products) {
  var header = ['URL', 'Product Name', 'Badge', 'Days In Market', 'Latest Quantity',
    'Cost USD', 'Price LYD', 'Price USD', 'Margin USD', 'Margin %',
    'Trend Quality', 'Market Capacity', 'Saturation %', 'Half-Life Days',
    'Similarity', 'Launch Confidence', 'Urgency', 'Effective CPA', 'Max Allowed CPA',
    'Expected Net Profit', 'Recommended Action', 'Reasoning'];
  var rows = products.map(function (p) {
    return [p.url, p.productName, p.badge, p.daysInMarket, p.latestQuantity,
      p.costUsd, p.priceLyd, p.priceUsd, p.marginUsd, p.marginPct,
      p.trendQuality, p.marketCapacity, p.saturationPct, p.halfLifeDays,
      p.similarity, p.launchConfidence, p.urgency,
      p.financial.effectiveCpa, p.financial.maxAllowedCpa, p.financial.expectedNetProfit,
      p.recommendedAction, p.reasoning];
  });
  writeTable_(SHEETS.TIMESERIES, header, rows);
}

/** Create the Financial Calculator input sheet if it doesn't exist yet. */
function ensureCalculatorSheet_(products) {
  var ss = getSpreadsheet_();
  if (ss.getSheetByName(SHEETS.CALCULATOR)) return;
  var header = ['URL', 'Product Name', 'Delivery Rate', 'Return Penalty', 'Target CPA', 'Risk Tier'];
  var rows = products.slice(0, 20).map(function (p) {
    return [p.url, p.productName, p.financial.deliveryRate, '', '', p.financial.riskTier];
  });
  writeTable_(SHEETS.CALCULATOR, header, rows);
}

function round2_(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return Math.round(n * 100) / 100;
}

// ---- Demo seeding (optional convenience) --------------------------------

function seedDemoTabs() {
  var ss = getSpreadsheet_();
  var base = ['URL', 'Product Name', 'Badge', 'Mb-0', 'Mb-0', 'Quantity'];
  var qty = [40, 46, 52, 58, 66, 73, 81];
  for (var d = 0; d < qty.length; d++) {
    var name = '2026-06-0' + (d + 1);
    if (ss.getSheetByName(name)) continue;
    var sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, base.length).setValues([base]);
    sh.getRange(2, 1, 1, base.length).setValues([[
      'https://shop.example/p/1', 'Mini Massage Gun', 'Health', '$5.00', '95 LYD', qty[d],
    ]]);
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('Seeded demo daily tabs.', 'Affiliate OS', 5);
}
