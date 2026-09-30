// Canonical form of a DataCite XML document for content comparison in tests.
//
// - Elements keep their document order (order of repeatable elements is significant).
// - Attributes are sorted by name; namespace declarations are dropped.
// - Text is trimmed and inner whitespace runs are collapsed; whitespace-only text is ignored.
// - Elements without attributes, children or text (e.g. <sizes/>, <affiliation/>) are treated as
//   absent: they carry no information and the serializer omits them.
// - Option brAsText: <br/> inside text counts as a line break (the model stores it as '\n').

import { DOMParser } from '@xmldom/xmldom';

function canon(node, opts) {
  const attrs = [...node.attributes]
    .filter((a) => !/^xmlns(:|$)/.test(a.name))
    .map((a) => [a.name, a.value])
    .sort(([a], [b]) => a.localeCompare(b));
  const children = [];
  let text = '';
  for (const c of [...node.childNodes]) {
    if (c.nodeType === 1 && opts.brAsText && c.localName === 'br') {
      text += '\n';
    } else if (c.nodeType === 1) {
      const cc = canon(c, opts);
      if (cc) children.push(cc);
    } else if (c.nodeType === 3 || c.nodeType === 4) {
      text += c.data;
    }
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!attrs.length && !children.length && !text) return null;
  return { name: node.localName, attrs, text, children };
}

export function canonical(xml, opts = {}) {
  return canon(new DOMParser().parseFromString(xml, 'application/xml').documentElement, opts);
}
