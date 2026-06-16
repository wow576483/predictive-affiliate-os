/**
 * Sheet I/O helpers for the Predictive Affiliate OS.
 * Pure glue: reads raw daily tabs, persists state, writes decision tables.
 * All heavy logic lives in the bundled AffiliateOSCore (AffiliateOSCore.gs).
 */

var SHEETS = {
  RADAR: 'OPPORTUNITY RADAR',
  WATCHLIST: 'WATCHLIST',
  CALCULATOR: 'FINANCIAL CALCULATOR',
  WINNERS: 'WINNERS DNA',
  TIMESERIES: '_TIMESERIES',
  CONF_HISTORY: '_CONF_HISTORY',
  STATE: '_STATE',
  CONFIG: '_CONFIG',
};

// Daily ingestion tabs are named like "2026-06-09".
var DAILY_TAB_RE = /^\d{4}-\d{2}-\d{2}$/;

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet_(name, hidden) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (hidden) sh.hideSheet();
  }
  return sh;
}

/** All daily ingestion tabs, sorted ascending by date. */
function listDailyTabs_() {
  return getSpreadsheet_()
    .getSheets()
    .filter(function (sh) { return DAILY_TAB_RE.test(sh.getName()); })
    .sort(function (a, b) { return a.getName().localeCompare(b.getName()); });
}

/** Read every daily tab and parse into normalized records via the core. */
function readAllRecords_() {
  var tabs = listDailyTabs_();
  var records = [];
  for (var i = 0; i < tabs.length; i++) {
    var sh = tabs[i];
    var values = sh.getDataRange().getValues();
    var parsed = AffiliateOSCore.parseDailyTab(values, { date: sh.getName() });
    records = records.concat(parsed);
  }
  return records;
}

// Cells cap at 50000 chars; chunk state JSON across rows in column A.
var STATE_CHUNK_SIZE = 45000;

/** Load persisted state (JSON chunked down column A of _STATE). */
function loadState_() {
  var sh = getOrCreateSheet_(SHEETS.STATE, true);
  var last = sh.getLastRow();
  if (!last) return { confidenceHistoryByUrl: {}, fingerprint: null };
  var vals = sh.getRange(1, 1, last, 1).getValues();
  var raw = vals.map(function (r) { return r[0]; }).join('');
  if (!raw) return { confidenceHistoryByUrl: {}, fingerprint: null };
  try { return JSON.parse(raw); } catch (e) { return { confidenceHistoryByUrl: {}, fingerprint: null }; }
}

function saveState_(state) {
  var sh = getOrCreateSheet_(SHEETS.STATE, true);
  sh.clearContents();
  var json = JSON.stringify(state);
  var chunks = [];
  for (var i = 0; i < json.length; i += STATE_CHUNK_SIZE) {
    chunks.push([json.substring(i, i + STATE_CHUNK_SIZE)]);
  }
  if (!chunks.length) chunks.push(['']);
  sh.getRange(1, 1, chunks.length, 1).setValues(chunks);
}

/** Read optional config overrides from the _CONFIG sheet (key | value rows). */
function loadConfigOverrides_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEETS.CONFIG);
  if (!sh) return {};
  var rows = sh.getDataRange().getValues();
  var overrides = {};
  for (var i = 1; i < rows.length; i++) {
    var key = String(rows[i][0] || '').trim();
    var val = rows[i][1];
    if (!key) continue;
    if (key === 'fxUsdToLyd' && val !== '' && val !== null) overrides.fxUsdToLyd = Number(val);
  }
  return overrides;
}

/** Read per-product financial overrides from the FINANCIAL CALCULATOR sheet. */
function loadFinancialOverrides_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEETS.CALCULATOR);
  if (!sh) return { financialByUrl: {}, riskByUrl: {} };
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return { financialByUrl: {}, riskByUrl: {} };
  var header = rows[0].map(function (h) { return String(h).trim(); });
  var idx = {};
  header.forEach(function (h, i) { idx[h] = i; });
  var financialByUrl = {};
  var riskByUrl = {};
  for (var r = 1; r < rows.length; r++) {
    var url = idx['URL'] !== undefined ? String(rows[r][idx['URL']]).trim() : '';
    if (!url) continue;
    var o = {};
    if (idx['Delivery Rate'] !== undefined && rows[r][idx['Delivery Rate']] !== '') o.deliveryRate = Number(rows[r][idx['Delivery Rate']]);
    if (idx['Return Penalty'] !== undefined && rows[r][idx['Return Penalty']] !== '') o.returnShippingPenalty = Number(rows[r][idx['Return Penalty']]);
    if (idx['Target CPA'] !== undefined && rows[r][idx['Target CPA']] !== '') o.targetCpa = Number(rows[r][idx['Target CPA']]);
    financialByUrl[url] = o;
    if (idx['Risk Tier'] !== undefined && rows[r][idx['Risk Tier']]) riskByUrl[url] = String(rows[r][idx['Risk Tier']]).trim().toLowerCase();
  }
  return { financialByUrl: financialByUrl, riskByUrl: riskByUrl };
}

/** Overwrite a sheet with a header row + data matrix. */
function writeTable_(name, header, rows) {
  var sh = getOrCreateSheet_(name, false);
  sh.clearContents();
  var matrix = [header].concat(rows);
  if (matrix.length && matrix[0].length) {
    sh.getRange(1, 1, matrix.length, matrix[0].length).setValues(matrix);
    sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
