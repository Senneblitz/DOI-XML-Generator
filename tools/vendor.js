// Copies the browser files of xmllint-wasm from node_modules into vendor/, so the app can be
// served as static files without a build step and without loading anything from a CDN.
//
// Usage: node tools/vendor.js [--check]

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FROM = 'node_modules/xmllint-wasm';
const TO = 'vendor/xmllint-wasm';

// Only what the browser needs, plus the licence.
export const FILES = ['index-browser.mjs', 'xmllint-browser.mjs', 'xmllint.wasm', 'COPYING'];

const read = (dir, file) => readFileSync(join(ROOT, dir, file));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  mkdirSync(join(ROOT, TO), { recursive: true });
  let stale = [];
  for (const file of FILES) {
    const source = read(FROM, file);
    if (check) {
      let current = null;
      try {
        current = read(TO, file);
      } catch {
        /* missing */
      }
      if (!current || !current.equals(source)) stale.push(file);
    } else {
      writeFileSync(join(ROOT, TO, file), source);
    }
  }
  if (check) {
    if (stale.length) {
      console.error(`${TO} is out of date (${stale.join(', ')}) - run: node tools/vendor.js`);
      process.exit(1);
    }
    console.log(`${TO} is up to date`);
  } else {
    const version = JSON.parse(readFileSync(join(ROOT, FROM, 'package.json'), 'utf8')).version;
    const size = FILES.reduce((sum, f) => sum + statSync(join(ROOT, TO, f)).size, 0);
    writeFileSync(
      join(ROOT, TO, 'README.md'),
      `# xmllint-wasm (vendored)\n\nKopie der Browser-Dateien aus \`node_modules/xmllint-wasm\`, erzeugt mit \`node tools/vendor.js\`.\n\n- Version: ${version}\n- Lizenz: MIT (siehe COPYING)\n- Quelle: https://github.com/noppa/xmllint-wasm\n- Umfang: ${(size / 1024).toFixed(0)} KB\n\nNicht von Hand bearbeiten. Ein Test prüft, dass die Kopie zur installierten Version passt.\n`,
    );
    console.log(`${TO} written (xmllint-wasm ${version}, ${(size / 1024).toFixed(0)} KB)`);
  }
}
