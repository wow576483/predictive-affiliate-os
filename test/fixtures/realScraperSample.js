/**
 * Regression fixture taken from a REAL scraper export (seller.shipeh.com),
 * trimmed to a representative slice. Mirrors the exact daily-tab format the
 * pipeline ingests: header `URL | Product Name | Badge | Mb-0 | Mb-0 | Quantity`
 * where the two `Mb-0` columns are Cost (USD, `$`) and Market Price (LYD).
 *
 * It deliberately preserves the two real-world quirks we observed:
 *  - Some daily tabs carry trailing empty columns (e.g. 14-wide rows).
 *  - The scraper sometimes leaves gaps: a row with only a URL, or a row with a
 *    `$` cost but a blank LYD price. The parser must degrade gracefully (null),
 *    not crash or mis-assign columns.
 */

// 2026-06-08 — rows padded to 14 columns (trailing empties), plus a URL-only gap row.
export const REAL_DAY_2026_06_08 = [
  ['URL', 'Product Name', 'Badge', 'Mb-0', 'Mb-0', 'Quantity', '', '', '', '', '', '', '', ''],
  ['https://seller.shipeh.com/cod-drop/ahdiya-rijal', 'احدية رجال عصرية', 'Fashion', '$10', '219 LYD', 37, '', '', '', '', '', '', '', ''],
  ['https://seller.shipeh.com/cod-drop/lasaqat-kinoki', 'لصقات كينوكي الطبيعية للقدم', 'Beauty', '$2.6', '199 LYD', 72, '', '', '', '', '', '', '', ''],
  ['https://seller.shipeh.com/cod-drop/maryalat-matbakh', 'مريلة المطبخ الشفافة', 'Home', '$4.41', '219 LYD', 30, '', '', '', '', '', '', '', ''],
  // gap: scraper captured only the URL for this row.
  ['https://seller.shipeh.com/cod-drop/kursi-takhyeem', '', '', '', '', '', '', '', '', '', '', '', '', ''],
];

// 2026-06-11 — standard 6-column rows, plus a row with cost but no LYD price.
export const REAL_DAY_2026_06_11 = [
  ['URL', 'Product Name', 'Badge', 'Mb-0', 'Mb-0', 'Quantity'],
  ['https://seller.shipeh.com/cod-drop/ahdiya-rijal', 'احدية رجال عصرية', 'Fashion', '$10', '219 LYD', 7],
  ['https://seller.shipeh.com/cod-drop/lasaqat-kinoki', 'لصقات كينوكي الطبيعية للقدم', 'Beauty', '$2.6', '199 LYD', 44],
  ['https://seller.shipeh.com/cod-drop/maryalat-matbakh', 'مريلة المطبخ الشفافة', 'Home', '$4.41', '219 LYD', 30],
  ['https://seller.shipeh.com/cod-drop/martaba-hawaiya-v2', 'مرتبة هوائية للمقعد الخلفي v2', 'Gadget', '$15.6', '369 LYD', 200],
  // gap: cost present, LYD price missing.
  ['https://seller.shipeh.com/cod-drop/ustuwana-tilaa', 'أسطوانة طلاء وفرشاة طلاء ذكية', 'Home', '$8.12', '', 96],
];
