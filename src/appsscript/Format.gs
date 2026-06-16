/**
 * STEP 2 — Frontend Sheets UI styling layer.
 *
 * Pure presentation: header styling, conditional color rules, data validation,
 * number formats and charts applied on top of the data the writers produce.
 * No business logic lives here.
 */

var THEME = {
  headerBg: '#1F2A44',
  headerFont: '#FFFFFF',
  inputBg: '#FFF8E1',
  outputBg: '#F2F4F7',
  scoreLow: '#F8696B',
  scoreMid: '#FFEB84',
  scoreHigh: '#63BE7B',
  goodBg: '#C6EFCE', goodFont: '#006100',
  warnBg: '#FFEB9C', warnFont: '#9C6500',
  badBg: '#FFC7CE', badFont: '#9C0006',
  neutralBg: '#E7E9EE', neutralFont: '#3C4043',
};

/** Bold navy header row, frozen, with banded data rows. */
function styleHeader_(sh, numCols, numRows) {
  var head = sh.getRange(1, 1, 1, numCols);
  head
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.headerFont)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 34);
  if (numRows > 0) {
    sh.getRange(2, 1, numRows, numCols)
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#E0E3E8', SpreadsheetApp.BorderStyle.SOLID);
  }
}

/** 0..100 red-yellow-green color scale on a single column. */
function scoreColorScaleRule_(range) {
  return SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue(THEME.scoreLow, SpreadsheetApp.InterpolationType.NUMBER, '0')
    .setGradientMidpointWithValue(THEME.scoreMid, SpreadsheetApp.InterpolationType.NUMBER, '50')
    .setGradientMaxpointWithValue(THEME.scoreHigh, SpreadsheetApp.InterpolationType.NUMBER, '100')
    .setRanges([range])
    .build();
}

/** Percent color scale anchored to the max value in the column. */
function percentColorScaleRule_(range) {
  return SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue(THEME.scoreLow, SpreadsheetApp.InterpolationType.PERCENTILE, '0')
    .setGradientMidpointWithValue(THEME.scoreMid, SpreadsheetApp.InterpolationType.PERCENTILE, '50')
    .setGradientMaxpointWithValue(THEME.scoreHigh, SpreadsheetApp.InterpolationType.PERCENTILE, '100')
    .setRanges([range])
    .build();
}

/** Text chips: High=green, Medium=amber, Low=red. */
function capacityRules_(range) {
  return [
    textRule_(range, 'High', THEME.goodBg, THEME.goodFont),
    textRule_(range, 'Medium', THEME.warnBg, THEME.warnFont),
    textRule_(range, 'Low', THEME.badBg, THEME.badFont),
  ];
}

/** Recommended Action chips. */
function actionRules_(range) {
  return [
    textRule_(range, 'Launch', THEME.goodBg, THEME.goodFont),
    textRule_(range, 'Test', THEME.warnBg, THEME.warnFont),
    textRule_(range, 'Watch', THEME.neutralBg, THEME.neutralFont),
    textRule_(range, 'Avoid', THEME.badBg, THEME.badFont),
    textRule_(range, 'Skip', THEME.badBg, THEME.badFont),
  ];
}

function textRule_(range, text, bg, font) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains(text)
    .setBackground(bg)
    .setFontColor(font)
    .setRanges([range])
    .build();
}

/** Positive number green, negative red (for profit columns). */
function signRules_(range) {
  return [
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0).setBackground(THEME.goodBg).setFontColor(THEME.goodFont)
      .setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThanOrEqualTo(0).setBackground(THEME.badBg).setFontColor(THEME.badFont)
      .setRanges([range]).build(),
  ];
}

function colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function autoResize_(sh, numCols) {
  for (var c = 1; c <= numCols; c++) sh.autoResizeColumn(c);
}
