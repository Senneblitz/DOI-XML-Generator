// Review of fields taken over from another record. Everything that came from a foreign record
// waits for one deliberate confirmation, so nothing slips into a registration unseen.
//
// What was taken over is fingerprinted, which answers two questions later: is this still the
// foreign content, and which entries of a list are still untouched? Content the person wrote or
// changed afterwards needs no confirmation — working on it is the review.

/** Short, stable fingerprint of a value (FNV-1a over its JSON). Not a checksum against tampering. */
export function fingerprint(value) {
  const text = JSON.stringify(value ?? null);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const itemsOf = (value) => (Array.isArray(value) ? value.map(fingerprint) : null);

/** Marks the fields as taken over from `doi`. An earlier confirmation of a field is revoked. */
export function markTaken(taken, fields, doi, model = {}) {
  const next = { ...taken };
  for (const field of fields) {
    const value = model[field];
    next[field] = {
      doi,
      approved: false,
      source: fingerprint(value),
      items: itemsOf(value),
      approvedItems: [],
    };
  }
  return next;
}

/**
 * Marks only the named entries of a list field as taken over, for takeovers that add to a field
 * instead of replacing it (the subjects of a data package). Entries already under review stay.
 */
export function markTakenEntries(taken, field, doi, value, entries) {
  const previous = taken[field];
  const items = [...new Set([...(previous?.items ?? []), ...entries.map(fingerprint)])];
  return {
    ...taken,
    [field]: {
      doi,
      approved: false,
      source: fingerprint(value),
      items,
      approvedItems: previous?.approved ? items.filter((fp) => !entries.map(fingerprint).includes(fp)) : previous?.approvedItems ?? [],
    },
  };
}

/** Confirms a whole field, including all of its entries. Unknown fields are left alone. */
export function approveTaken(taken, field) {
  return taken[field] ? { ...taken, [field]: { ...taken[field], approved: true } } : taken;
}

/** Confirms one entry of a list field, e.g. a single creator. */
export function approveItem(taken, field, item) {
  const entry = taken[field];
  if (!entry?.items) return taken;
  const fp = fingerprint(item);
  if (!entry.items.includes(fp) || entry.approvedItems.includes(fp)) return taken;
  return { ...taken, [field]: { ...entry, approvedItems: [...entry.approvedItems, fp] } };
}

/**
 * Review state of one field against its current value:
 * - `pending`  unchanged foreign content, still to confirm
 * - `edited`   nothing of the takeover is left, the person has taken it over by working on it
 * - `approved` confirmed, as a whole or entry by entry
 * `open` and `total` count the entries of a list field.
 */
export function reviewOf(taken, field, value) {
  const entry = taken[field];
  if (!entry) return null;
  const total = entry.items?.length ?? 0;

  if (entry.approved) return { doi: entry.doi, state: 'approved', open: 0, total };
  if (entry.items) {
    const current = itemsOf(value) ?? [];
    const left = entry.items.filter((fp) => current.includes(fp));
    const open = left.filter((fp) => !entry.approvedItems.includes(fp));
    const state = open.length
      ? 'pending'
      : (left.length || entry.approvedItems.length ? 'approved' : 'edited');
    return { doi: entry.doi, state, open: open.length, total };
  }
  const state = fingerprint(value) !== entry.source ? 'edited' : 'pending';
  return { doi: entry.doi, state, open: state === 'pending' ? 1 : 0, total };
}

/** Review state of one entry: 'pending', 'approved' or 'own' (written or changed here). */
export function itemReview(taken, field, item) {
  const entry = taken[field];
  if (!entry?.items) return null;
  const fp = fingerprint(item);
  if (!entry.items.includes(fp)) return 'own';
  return entry.approved || entry.approvedItems.includes(fp) ? 'approved' : 'pending';
}

/** Fields that are still waiting, each with its open count, in the order they were taken over. */
export function pendingTaken(taken, model = {}) {
  return Object.keys(taken)
    .map((field) => ({ field, ...reviewOf(taken, field, model[field]) }))
    .filter((r) => r.state === 'pending');
}
