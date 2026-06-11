/**
 * Bundles the ES-module backend core into a single global-scope `.gs` file
 * for Google Apps Script (which has no ES module import/export), and copies
 * the hand-written Apps Script glue files + manifest into dist/appsscript/
 * ready for `clasp push`.
 */
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'dist', 'appsscript');
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'core', 'index.js')],
  bundle: true,
  format: 'iife',
  globalName: 'AffiliateOSCore',
  target: 'es2020',
  legalComments: 'none',
  outfile: join(outDir, 'AffiliateOSCore.gs'),
  banner: { js: '// AUTO-GENERATED from src/core — do not edit. Run: npm run build:gs\n' },
});

// Copy glue + manifest verbatim.
const glueDir = join(root, 'src', 'appsscript');
for (const file of readdirSync(glueDir)) {
  copyFileSync(join(glueDir, file), join(outDir, file));
}

console.log(`Built Apps Script bundle -> ${outDir}`);
