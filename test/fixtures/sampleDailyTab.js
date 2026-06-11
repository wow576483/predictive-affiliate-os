/**
 * Synthetic raw daily tab mimicking the scraper output, including the two
 * columns that share the ambiguous `Mb-0` header (one USD with `$`, one LYD).
 * Used to validate the content-based parser until a real sample is provided.
 */

export const RAW_DAILY_TAB = [
  ['URL', 'Product Name', 'Badge', 'Mb-0', 'Mb-0', 'Quantity'],
  ['https://shop.example/p/1', 'Mini Massage Gun', 'Health', '$12.50', '95 LYD', '120'],
  ['https://shop.example/p/2', 'LED Strip 5m', 'Home', '$4.20', '38 LYD', '64'],
  ['https://shop.example/p/3', 'Posture Corrector', 'Health', '$3.10', '29 LYD', '210'],
  // messy formats: thousands separators, arabic dinar marker, spaces
  ['https://shop.example/p/4', 'Smart Watch X8', 'Electronics', '$ 18,90', '1 450 د.ل', '15'],
  ['https://shop.example/p/5', 'Kitchen Scale', 'Home', 'USD 6.00', '52 LYD', ''],
];

// Same products, but the two Mb-0 columns are in SWAPPED order (LYD first).
export const RAW_DAILY_TAB_SWAPPED = [
  ['URL', 'Product Name', 'Badge', 'Mb-0', 'Mb-0', 'Quantity'],
  ['https://shop.example/p/1', 'Mini Massage Gun', 'Health', '95 LYD', '$12.50', '120'],
  ['https://shop.example/p/2', 'LED Strip 5m', 'Home', '38 LYD', '$4.20', '64'],
];
