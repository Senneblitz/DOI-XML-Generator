// Builds the public fixtures from the private originals: every personal name and ORCID iD is
// replaced by an invented one, everything else stays byte for byte as it was.
//
// Why: the reference XMLs are copies of registered DataCite records and therefore carry the names
// and ORCID iDs of real people. The repository is public, so they must not travel with it. The
// originals stay in fixtures-private/ (git-ignored) and remain the source for every question about
// conventions; fixtures/ holds the anonymised copies that the tests run against.
//
// The replacement works on single name parts, not on whole names. That keeps the differences the
// fixtures are valued for: a swapped given/family name stays swapped, a divergent spelling stays
// divergent, and the same part becomes the same invented part in every file.
//
// Usage: node tools/anonymize.js [--check]

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { parse } from '../src/xml/parse.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'fixtures-private';
const TARGET = 'fixtures';

// Invented names. Tree and plant names as family names read naturally and cannot be mistaken for
// the authors of the real records; the given names are ordinary ones.
const FAMILY_NAMES = [
  'Ahorn', 'Akazie', 'Birke', 'Buche', 'Distel', 'Eibe', 'Eiche', 'Erle', 'Esche', 'Espe',
  'Farn', 'Fichte', 'Flieder', 'Ginster', 'Hasel', 'Holunder', 'Kastanie', 'Kiefer', 'Lärche', 'Linde',
  'Lorbeer', 'Malve', 'Mandel', 'Nessel', 'Olive', 'Pappel', 'Platane', 'Quitte', 'Raute', 'Robinie',
  'Salbei', 'Schlehe', 'Tanne', 'Thymian', 'Ulme', 'Weide', 'Weißdorn', 'Wicke', 'Zeder', 'Zypresse',
  'Ampfer', 'Anis', 'Beifuß', 'Dill', 'Efeu', 'Enzian', 'Fenchel', 'Gerste', 'Hafer', 'Iris',
];

const GIVEN_NAMES = [
  'Alina', 'Bernd', 'Carla', 'David', 'Elena', 'Fabian', 'Greta', 'Hannes', 'Ida', 'Jonas',
  'Katrin', 'Lars', 'Maja', 'Nils', 'Olga', 'Peter', 'Quirin', 'Rita', 'Sven', 'Tanja',
  'Ulf', 'Vera', 'Willi', 'Xenia', 'Yannick', 'Zoe', 'Anton', 'Berta', 'Cornelius', 'Doris',
  'Emil', 'Frieda', 'Gustav', 'Helga', 'Ingo', 'Jutta', 'Klaus', 'Lena', 'Martin', 'Nadja',
  'Otto', 'Paula', 'Rolf', 'Sonja', 'Theo', 'Ute', 'Volker', 'Wanda', 'Yvonne', 'Zacharias',
];

/** ISO 7064 MOD 11-2, the check digit an ORCID iD carries. */
function checkDigit(base) {
  let total = 0;
  for (const c of base.replace(/-/g, '')) total = (total + Number(c)) * 2;
  const result = (12 - (total % 11)) % 11;
  return result === 10 ? 'X' : String(result);
}

/**
 * Invented ORCID iD for position `index`, with a valid check digit. They all start with
 * 0000-0000-, a block ORCID has never issued (assignment begins in the 0000-0001 block), so an
 * invented iD cannot collide with a real person's.
 */
function inventedOrcid(index) {
  const digits = String(1000000000000000 + index * 7919).slice(-15); // spread out, stays 15 digits
  const base = digits.replace(/(\d{4})(\d{4})(\d{4})(\d{3})/, '$1-$2-$3-$4');
  return `${base}${checkDigit(base)}`;
}

/** Every file of the source folder, the cross-check folder included. */
function sourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...sourceFiles(join(dir, entry.name)));
    else if (entry.name.endsWith('.xml')) files.push(join(dir, entry.name));
  }
  return files;
}

/**
 * Collects the name parts and ORCID iDs of all personal creators and contributors and assigns an
 * invented counterpart to each. Sorted input keeps the assignment stable between runs.
 */
export function buildMapping(files) {
  const familyNames = new Set();
  const givenNames = new Set();
  const orcids = new Set();
  const dom = { DOMParser, XMLSerializer };

  for (const file of files) {
    const { model } = parse(readFileSync(join(ROOT, file), 'utf8'), dom);
    for (const p of [...model.creators, ...model.contributors]) {
      if (p.nameType === 'Organizational') continue;
      if (p.familyName.trim()) familyNames.add(p.familyName.trim());
      if (p.givenName.trim()) givenNames.add(p.givenName.trim());
      // A name without given/family parts still has to be covered, so split it here.
      if (!p.familyName.trim() && !p.givenName.trim() && p.name.includes(',')) {
        const [family, given] = p.name.split(',').map((s) => s.trim());
        if (family) familyNames.add(family);
        if (given) givenNames.add(given);
      }
      for (const n of p.nameIdentifiers) {
        if (n.nameIdentifierScheme === 'ORCID' && n.value.trim()) {
          orcids.add(n.value.trim().replace(/^https?:\/\/orcid\.org\//i, ''));
        }
      }
    }
  }

  const assign = (values, pool, label) => {
    const sorted = [...values].sort((a, b) => a.localeCompare(b, 'de'));
    if (sorted.length > pool.length) throw new Error(`Not enough invented ${label}: ${sorted.length} needed`);
    return new Map(sorted.map((value, i) => [value, pool[i]]));
  };

  return {
    family: assign(familyNames, FAMILY_NAMES, 'family names'),
    given: assign(givenNames, GIVEN_NAMES, 'given names'),
    orcid: new Map([...orcids].sort().map((value, i) => [value, inventedOrcid(i)])),
  };
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replaces the mapped strings in the raw XML. The look-arounds keep parts of other words
 * untouched, so only the name itself is replaced, never a syllable inside a title.
 */
export function anonymize(xml, mapping) {
  let out = xml;
  const parts = [...mapping.family, ...mapping.given].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of parts) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRegExp(from)}(?![\\p{L}\\p{N}_-])`, 'gu'), to);
  }
  for (const [from, to] of mapping.orcid) {
    out = out.replace(new RegExp(escapeRegExp(from), 'g'), to);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(join(ROOT, SOURCE))) {
    console.error(`${SOURCE}/ is missing - it holds the original records and is not part of the repository.`);
    process.exit(1);
  }
  const files = sourceFiles(SOURCE);
  const mapping = buildMapping(files);
  const check = process.argv.includes('--check');
  let differs = 0;

  for (const file of files) {
    const target = join(ROOT, file.replace(SOURCE, TARGET));
    const result = anonymize(readFileSync(join(ROOT, file), 'utf8'), mapping);
    if (check) {
      const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
      if (current !== result) {
        differs += 1;
        console.error(`  differs: ${relative(ROOT, target).replace(/\\/g, '/')}`);
      }
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, result);
    }
  }

  const summary = `${files.length} files, ${mapping.family.size} family names, ${mapping.given.size} given names, ${mapping.orcid.size} ORCID iDs`;
  if (check && differs) {
    console.error(`${TARGET}/ is out of date - run: node tools/anonymize.js`);
    process.exit(1);
  }
  console.log(check ? `${TARGET}/ is up to date (${summary})` : `${TARGET}/ written (${summary})`);
}
