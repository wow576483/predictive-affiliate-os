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
  writeCalculator_(out.products);
  orderSheets_();

  saveState_({
    confidenceHistoryByUrl: out.updatedConfidenceHistory,
    fingerprint: out.winnersDna.fingerprint,
    lastRun: new Date().toISOString(),
  });

  SpreadsheetApp.getActiveSpreadsheet().toast('Analysis complete: ' + out.products.length + ' products.', 'Affiliate OS', 5);
}

// ---- Writers (data + STEP 2 presentation styling) -----------------------

function writeRadar_(radar) {
  var header = ['Product Name', 'Launch Confidence Score', 'Urgency Score', 'Market Capacity',
    'Budget Allocation %', 'Recommended Action', 'Decision Explanation (Reasoning)'];
  var rows = radar.map(function (r) {
    return [r.productName, r.launchConfidence, r.urgency, r.marketCapacity,
      r.budgetAllocationPct / 100, r.recommendedAction, r.reasoning];
  });
  var sh = writeTable_(SHEETS.RADAR, header, rows);
  var n = rows.length;
  styleHeader_(sh, header.length, n);
  if (n > 0) {
    var rules = [
      scoreColorScaleRule_(sh.getRange(2, 2, n, 1)),
      scoreColorScaleRule_(sh.getRange(2, 3, n, 1)),
      percentColorScaleRule_(sh.getRange(2, 5, n, 1)),
    ]
      .concat(capacityRules_(sh.getRange(2, 4, n, 1)))
      .concat(actionRules_(sh.getRange(2, 6, n, 1)));
    sh.setConditionalFormatRules(rules);
    sh.getRange(2, 5, n, 1).setNumberFormat('0.0%');
    sh.getRange(2, 7, n, 1).setWrap(true).setHorizontalAlignment('left');
  }
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(7, 360);
}

function writeWatchlist_(watchlist) {
  var header = ['Product Name', 'Confidence', 'Saturation %', 'Half-Life', 'Market Capacity', 'Reasoning'];
  var rows = watchlist.map(function (r) {
    return [r.productName, r.launchConfidence, r.saturationPct / 100, r.halfLifeLabel, r.marketCapacity, r.reasoning];
  });
  var sh = writeTable_(SHEETS.WATCHLIST, header, rows);
  var n = rows.length;
  styleHeader_(sh, header.length, n);
  if (n > 0) {
    var rules = [
      scoreColorScaleRule_(sh.getRange(2, 2, n, 1)),
      percentColorScaleRule_(sh.getRange(2, 3, n, 1)),
    ].concat(capacityRules_(sh.getRange(2, 5, n, 1)));
    sh.setConditionalFormatRules(rules);
    sh.getRange(2, 3, n, 1).setNumberFormat('0%');
    sh.getRange(2, 6, n, 1).setWrap(true).setHorizontalAlignment('left');
  }
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(6, 360);
}

function writeWinnersDna_(dna) {
  var fp = dna.fingerprint;
  var sh = getOrCreateSheet_(SHEETS.WINNERS, false);
  sh.clear();
  removeCharts_(sh);

  // Left block: headline metric cards (A:B).
  var header = ['Metric', 'Value'];
  var rows = [['Winner Count', dna.winnerCount]];
  if (fp) {
    rows.push(['Optimal Price (USD) mean', round2_(fp.price.mean)]);
    rows.push(['Optimal Price Band (USD)', round2_(fp.price.low) + ' - ' + round2_(fp.price.high)]);
    rows.push(['Average Margin %', Math.round((fp.margin.mean || 0) * 100) + '%']);
  } else {
    rows.push(['Fingerprint', 'Not enough sustained winners yet']);
  }
  var matrix = [header].concat(rows);
  sh.getRange(1, 1, matrix.length, 2).setValues(matrix);
  styleHeader_(sh, 2, rows.length);
  sh.getRange(2, 1, rows.length, 1).setBackground(THEME.outputBg).setFontWeight('bold');
  sh.setColumnWidth(1, 210);
  sh.setColumnWidth(2, 160);

  // Right block: category share table (D:E) + chart.
  var cats = fp ? Object.keys(fp.categoryShare || {}) : [];
  if (cats.length) {
    var catHeader = [['Category', 'Winning Share']];
    var catRows = cats.map(function (c) { return [c, fp.categoryShare[c]]; });
    sh.getRange(1, 4, 1, 2).setValues(catHeader);
    sh.getRange(2, 4, catRows.length, 2).setValues(catRows);
    sh.getRange(1, 4, 1, 2)
      .setBackground(THEME.headerBg).setFontColor(THEME.headerFont).setFontWeight('bold');
    sh.getRange(2, 5, catRows.length, 1).setNumberFormat('0%');
    sh.setColumnWidth(4, 160);
    sh.setColumnWidth(5, 120);

    var chart = sh.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sh.getRange(1, 4, catRows.length + 1, 2))
      .setPosition(rows.length + 4, 1, 0, 0)
      .setOption('title', 'Winning Category Share')
      .setOption('legend', { position: 'none' })
      .setOption('colors', [THEME.scoreHigh])
      .setOption('width', 520)
      .setOption('height', 300)
      .build();
    sh.insertChart(chart);
  }
}

function removeCharts_(sh) {
  var charts = sh.getCharts();
  for (var i = 0; i < charts.length; i++) sh.removeChart(charts[i]);
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

/**
 * Financial Calculator sheet: editable inputs (A:F) + read-only outputs (G:K).
 * User edits to inputs are preserved across runs; only outputs are refreshed
 * with the latest computed financials per URL.
 */
function writeCalculator_(products) {
  var sh = getOrCreateSheet_(SHEETS.CALCULATOR, false);

  var inputHeader = ['URL', 'Product Name', 'Delivery Rate', 'Return Penalty', 'Target CPA', 'Risk Tier'];
  var outputHeader = ['Effective CPA', 'Return Penalty Burden', 'Expected Net Profit', 'Max Allowed CPA', 'Profitable?'];
  var fullHeader = inputHeader.concat(outputHeader);

  // Preserve any existing input edits keyed by URL.
  var existing = {};
  var existingRows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues() : [];
  existingRows.forEach(function (r) {
    var url = String(r[0]).trim();
    if (url) existing[url] = r;
  });

  var dataRows = products.slice(0, 50).map(function (p) {
    var f = p.financial;
    var prev = existing[p.url];
    var deliveryRate = prev && prev[2] !== '' ? prev[2] : f.deliveryRate;
    var returnPenalty = prev && prev[3] !== '' ? prev[3] : '';
    var targetCpa = prev && prev[4] !== '' ? prev[4] : '';
    var riskTier = prev && prev[5] !== '' ? prev[5] : f.riskTier;
    return [p.url, p.productName, deliveryRate, returnPenalty, targetCpa, riskTier,
      round2_(f.effectiveCpa), round2_(f.returnPenaltyBurden), round2_(f.expectedNetProfit),
      round2_(f.maxAllowedCpa), f.profitable ? 'Yes' : 'No'];
  });

  sh.clear();
  removeCharts_(sh);
  var matrix = [fullHeader].concat(dataRows);
  sh.getRange(1, 1, matrix.length, fullHeader.length).setValues(matrix);
  styleHeader_(sh, fullHeader.length, dataRows.length);
  sh.setFrozenColumns(2);

  var n = dataRows.length;
  if (n > 0) {
    // Visually separate editable inputs (C:F) from read-only outputs (G:K).
    sh.getRange(2, 3, n, 4).setBackground(THEME.inputBg);
    sh.getRange(2, 7, n, 5).setBackground(THEME.outputBg);
    sh.getRange(2, 3, n, 1).setNumberFormat('0%');
    sh.getRange(2, 7, n, 5).setNumberFormat('0.00');
    sh.getRange(2, 11, n, 1).setNumberFormat('@');

    // Risk Tier dropdown (column F).
    var riskRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['low', 'medium', 'high'], true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, 6, n, 1).setDataValidation(riskRule);

    var rules = signRules_(sh.getRange(2, 9, n, 1))
      .concat([
        textRule_(sh.getRange(2, 11, n, 1), 'Yes', THEME.goodBg, THEME.goodFont),
        textRule_(sh.getRange(2, 11, n, 1), 'No', THEME.badBg, THEME.badFont),
      ]);
    sh.setConditionalFormatRules(rules);
  }
  sh.setColumnWidth(1, 220);
  sh.setColumnWidth(2, 200);
}

/** Put user-facing sheets first; hide backend state sheets. */
function orderSheets_() {
  var ss = getSpreadsheet_();
  var order = [SHEETS.RADAR, SHEETS.WATCHLIST, SHEETS.CALCULATOR, SHEETS.WINNERS];
  for (var i = 0; i < order.length; i++) {
    var sh = ss.getSheetByName(order[i]);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  }
  [SHEETS.TIMESERIES, SHEETS.STATE, SHEETS.CONF_HISTORY].forEach(function (name) {
    var s = ss.getSheetByName(name);
    if (s) s.hideSheet();
  });
  var radar = ss.getSheetByName(SHEETS.RADAR);
  if (radar) ss.setActiveSheet(radar);
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
