// XSD validation in the browser, using the vendored xmllint-wasm (vendor/xmllint-wasm).
//
// The module and the ~760 KB WebAssembly file are only loaded when validation is actually
// used, so starting the form stays fast. Nothing is fetched from a CDN.

export const SCHEMA_DIR = 'schema/kernel-4.7';
const MAIN = 'metadata.xsd';
const INCLUDES = [
  'include/xml.xsd',
  'include/datacite-titleType-v4.xsd',
  'include/datacite-contributorType-v4.xsd',
  'include/datacite-dateType-v4.xsd',
  'include/datacite-resourceType-v4.xsd',
  'include/datacite-relationType-v4.xsd',
  'include/datacite-relatedIdentifierType-v4.xsd',
  'include/datacite-funderIdentifierType-v4.xsd',
  'include/datacite-descriptionType-v4.xsd',
  'include/datacite-nameType-v4.xsd',
  'include/datacite-numberType-v4.xsd',
];

let cached = null;

/** Loads xmllint and the schema files once and keeps them in memory. */
async function load({ readText, importModule }) {
  if (!cached) {
    const [{ validateXML }, main, ...includes] = await Promise.all([
      importModule(),
      readText(`${SCHEMA_DIR}/${MAIN}`),
      ...INCLUDES.map((f) => readText(`${SCHEMA_DIR}/${f}`)),
    ]);
    cached = {
      validateXML,
      schema: [{ fileName: MAIN, contents: main }],
      preload: INCLUDES.map((fileName, i) => ({ fileName, contents: includes[i] })),
    };
  }
  return cached;
}

/**
 * Validates an XML string against the DataCite schema.
 * Returns { valid, errors: [{ message, line }] }; errors never throw for invalid XML,
 * only a missing schema or a broken module does.
 */
export async function validateAgainstSchema(xml, options = {}) {
  const {
    readText = async (path) => {
      const res = await fetch(path); // relative, so a sub-path deployment works too
      if (!res.ok) throw new Error(`${path} konnte nicht geladen werden (HTTP ${res.status}).`);
      return res.text();
    },
    importModule = () => import('../../vendor/xmllint-wasm/index-browser.mjs'),
  } = options;

  const { validateXML, schema, preload } = await load({ readText, importModule });
  const result = await validateXML({
    xml: [{ fileName: 'record.xml', contents: xml }],
    schema,
    preload,
    initialMemoryPages: 256,
    maxMemoryPages: 512,
  });
  return {
    valid: Boolean(result.valid),
    errors: (result.errors ?? []).map((e) => ({
      message: e.message ?? String(e),
      line: e.loc?.lineNumber ?? null,
    })),
  };
}

/** Frees the cached module, e.g. for tests. */
export const resetSchemaValidator = () => {
  cached = null;
};
